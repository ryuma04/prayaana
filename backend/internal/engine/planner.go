package engine

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"trizpyy/internal/domain"
)

type Wish struct {
	Text       string   `json:"text"`
	Boosts     []string `json:"boosts"`
	LowWalking bool     `json:"lowWalking,omitempty"`
	Kids       bool     `json:"kids,omitempty"`
}

type wishRule struct {
	re   *regexp.Regexp
	wish Wish
}

var wishRules = []wishRule{
	{regexp.MustCompile(`(?i)quiet|calm|peace|slow|offbeat`), Wish{Text: "Quiet places", Boosts: []string{"relax", "nature"}}},
	{regexp.MustCompile(`(?i)food|eat|cuisine|caf[eé]|dhaba|thali|street`), Wish{Text: "Great food", Boosts: []string{"food"}}},
	{regexp.MustCompile(`(?i)adventure|thrill|adrenaline|rafting|paraglid|trek`), Wish{Text: "Adventure", Boosts: []string{"adventure"}}},
	{regexp.MustCompile(`(?i)can'?t walk|knee|elderly|dad|father|mother|mom|grand|wheel`), Wish{Text: "Easy on walking", Boosts: []string{}, LowWalking: true}},
	{regexp.MustCompile(`(?i)kid|child|son|daughter|family`), Wish{Text: "Kid-friendly", Boosts: []string{}, Kids: true}},
	{regexp.MustCompile(`(?i)photo|instagram|view|sunset|sunrise`), Wish{Text: "Views & photos", Boosts: []string{"photo"}}},
	{regexp.MustCompile(`(?i)history|heritage|culture|temple|fort|museum`), Wish{Text: "Culture & history", Boosts: []string{"culture"}}},
	{regexp.MustCompile(`(?i)party|nightlife|friends|social|music`), Wish{Text: "Social evenings", Boosts: []string{"social"}}},
	{regexp.MustCompile(`(?i)luxury|spa|pamper|honeymoon|romantic`), Wish{Text: "A little luxury", Boosts: []string{"luxury", "relax"}}},
	{regexp.MustCompile(`(?i)nature|mountain|forest|river|lake|beach|snow`), Wish{Text: "Nature", Boosts: []string{"nature"}}},
}

// ParseWishes is the rule-based reader for the traveler's own words.
func ParseWishes(text string) []Wish {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	var out []Wish
	for _, r := range wishRules {
		if r.re.MatchString(text) {
			out = append(out, r.wish)
		}
	}
	return out
}

func ScoreActivity(a domain.Activity, p domain.TripPreferences, wishes []Wish) int {
	matches := len(intersect(a.Interests, p.Interests))
	score := float64(matches)/float64(max(1, min(len(a.Interests), 2)))*55 + rated(a.Rating)*7
	for _, w := range wishes {
		for _, b := range w.Boosts {
			if contains(a.Interests, b) {
				score += 8
				break
			}
		}
		if w.LowWalking && a.Walking == "high" {
			score -= 35
		}
		if w.LowWalking && a.Energy >= 4 {
			score -= 15
		}
		if w.Kids && !a.KidFriendly {
			score -= 30
		}
	}
	if p.Kids > 0 && !a.KidFriendly {
		score -= 30
	}
	if contains(p.Special, "Limited mobility") && a.Walking == "high" {
		score -= 35
	}
	if p.Pace == "relaxed" && a.Energy >= 4 {
		score -= 14
	}
	if p.Pace == "packed" && a.Energy >= 3 {
		score += 4
	}
	perPersonDay := float64(p.BudgetPerPerson) / float64(max(1, p.Nights+1))
	if float64(a.Price) > perPersonDay*0.9 {
		score -= 12
	}
	return Round(math.Max(0, math.Min(100, score)))
}

func MatchPercent(a domain.Activity, p domain.TripPreferences) int {
	return clamp(ScoreActivity(a, p, ParseWishes(p.OwnWords)), 35, 99)
}

var stayRank = []string{"hostel", "budget", "homestay", "boutique", "luxury"}

func rankOf(t string) int {
	for i, s := range stayRank {
		if s == t {
			return i
		}
	}
	return -1
}

func (e *Engine) PickStay(dest *domain.Destination, p domain.TripPreferences) domain.Stay {
	list := e.StaysFor(dest)
	rooms := RoomsFor(p)
	budgetCap := float64(p.BudgetPerPerson*p.Travelers()) * 0.4 / float64(max(1, p.Nights)) / float64(rooms)
	for _, s := range list {
		if s.Type == p.StayType {
			if float64(s.NightlyPrice) <= budgetCap*1.2 {
				return s
			}
			break
		}
	}
	var affordable []domain.Stay
	for _, s := range list {
		if float64(s.NightlyPrice) <= budgetCap {
			affordable = append(affordable, s)
		}
	}
	sort.SliceStable(affordable, func(a, b int) bool { return affordable[a].NightlyPrice > affordable[b].NightlyPrice })
	if len(affordable) > 0 {
		return affordable[0]
	}
	wanted := rankOf(p.StayType)
	sorted := append([]domain.Stay(nil), list...)
	dist := func(s domain.Stay) int {
		d := rankOf(s.Type) - wanted
		if d < 0 {
			return -d
		}
		return d
	}
	sort.SliceStable(sorted, func(a, b int) bool {
		da, db := dist(sorted[a]), dist(sorted[b])
		if da != db {
			return da < db
		}
		return sorted[a].NightlyPrice < sorted[b].NightlyPrice
	})
	if len(sorted) > 0 {
		return sorted[0]
	}
	return fallbackStays(dest)[0]
}

func (e *Engine) PickTransport(dest *domain.Destination, p domain.TripPreferences) domain.TransportOption {
	list := e.TransportFor(dest, p)
	for _, t := range list {
		if t.Mode == p.Transport {
			return t
		}
	}
	if len(list) > 0 {
		return list[0]
	}
	return fallbackTransport(dest, p)[0]
}

var routeRe = regexp.MustCompile(`([A-Za-z]+) → ([A-Za-z]+)`)

func ReverseRoute(label string) string {
	loc := routeRe.FindStringSubmatchIndex(label)
	if loc == nil {
		return label
	}
	a, b := label[loc[2]:loc[3]], label[loc[4]:loc[5]]
	return label[:loc[0]] + b + " → " + a + label[loc[1]:]
}

type BuildOptions struct {
	ID            string
	Code          string
	CustomerID    string
	CustomerName  string
	CoordinatorID string
	GroupName     string
	Status        string
	PaymentStatus string
	StayID        string
	TransportID   string
	Wishes        []Wish
	Now           time.Time
}

// BuildTrip creates a full day-by-day plan from preferences (allaboutourproject.md §12.1).
func (e *Engine) BuildTrip(p domain.TripPreferences, o BuildOptions) (*domain.Trip, error) {
	dest := e.ResolveDestination(p.DestinationID, p)
	if dest == nil {
		return nil, fmt.Errorf("unknown destination %q", p.DestinationID)
	}
	stays := e.StaysFor(dest)
	transports := e.TransportFor(dest, p)
	if len(stays) == 0 || len(transports) == 0 || len(dest.Clusters) == 0 {
		return nil, fmt.Errorf("destination %q has no stays, transport or areas", dest.ID)
	}
	stay := e.PickStay(dest, p)
	if o.StayID != "" {
		if s := e.Cat.Stay(o.StayID); s != nil && s.DestinationID == dest.ID {
			stay = *s
		}
	}
	transport := e.PickTransport(dest, p)
	if o.TransportID != "" {
		if t := e.Cat.TransportOption(o.TransportID); t != nil && t.DestinationID == dest.ID {
			transport = *t
		}
	}
	wishes := o.Wishes
	if wishes == nil {
		wishes = ParseWishes(p.OwnWords)
	}
	now := o.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	group := o.GroupName
	if group == "" {
		parts := strings.Fields(o.CustomerName)
		name := o.CustomerName
		if len(parts) > 1 {
			name = parts[1]
		}
		group = name + " party"
	}
	status, pay := o.Status, o.PaymentStatus
	if status == "" {
		status = domain.TripDraft
	}
	if pay == "" {
		pay = domain.PayUnpaid
	}

	var allocs []domain.DestinationAllocation
	title := fmt.Sprintf("%d days in %s", p.Days(), dest.Name)
	if len(p.Destinations) > 1 {
		allocs = computeMultiDestAllocations(p.Destinations, p.DestinationDays, p.DestinationAllocations, p.Days())
		var names []string
		for _, al := range allocs {
			if d := e.ResolveDestination(al.DestinationID, p); d != nil {
				names = append(names, d.Name)
			}
		}
		if len(names) > 1 {
			title = fmt.Sprintf("%d days: %s", p.Days(), strings.Join(names, " → "))
		}
	}

	var items []domain.TripItem
	if len(allocs) > 1 {
		items = e.buildMultiDestItems(p, allocs, transport, o.ID, wishes)
	} else {
		items = e.buildItems(p, dest, stay, transport, o.ID, wishes)
	}

	return &domain.Trip{
		ID:            o.ID,
		Code:          o.Code,
		Title:         title,
		DestinationID: dest.ID,
		Destinations:  p.Destinations,
		Allocations:   allocs,
		OriginPlace:   p.OriginPlace,
		Prefs:         p,
		StayID:        stay.ID,
		TransportID:   transport.ID,
		Items:         items,
		Status:        status,
		PaymentStatus: pay,
		CreatedAt:     now,
		Receipts:      []domain.ChangeReceipt{},
		CoordinatorID: o.CoordinatorID,
		CustomerID:    o.CustomerID,
		CustomerName:  o.CustomerName,
		GroupName:     group,
		Version:       1,
	}, nil
}

type scored struct {
	a domain.Activity
	s int
}

func (e *Engine) buildItems(p domain.TripPreferences, dest *domain.Destination, stay domain.Stay, transport domain.TransportOption, tripID string, wishes []Wish) []domain.TripItem {
	travelers := p.Travelers()
	vehicles := VehiclesFor(p)
	cab := e.CabVendorFor(dest.ID)
	vehicle := "Innova Crysta"
	if travelers > 5 {
		vehicle = "Tempo Traveller"
	}
	days := p.Days()
	var pool []scored
	for _, a := range e.ActivitiesFor(dest) {
		pool = append(pool, scored{a, ScoreActivity(a, p, wishes)})
	}
	sort.SliceStable(pool, func(x, y int) bool { return pool[x].s > pool[y].s })

	used := map[string]bool{}
	var items []domain.TripItem
	n := 0
	push := func(it domain.TripItem) domain.TripItem {
		n++
		it.ID = fmt.Sprintf("%s-d%d-%d", tripID, it.Day, n)
		if it.Status == "" {
			it.Status = domain.ItemPlanned
		}
		if it.DependsOn == nil {
			it.DependsOn = []string{}
		}
		if p.StartDate != "" {
			it.Date = AddDays(p.StartDate, it.Day-1)
		}
		it.StartTime = MinToTime(it.StartMin)
		it.EndTime = MinToTime(it.StartMin + it.DurationMin)
		if it.Location == "" {
			it.Location = it.Place
		}
		items = append(items, it)
		return it
	}
	stayLat, stayLng := fptr(stay.Lat), fptr(stay.Lng)
	placeOf := func(a domain.Activity) string {
		if c := dest.ClusterByID(a.Cluster); c != nil {
			return c.Name
		}
		return dest.Name
	}
	activityItem := func(a domain.Activity, day, start int, deps []string) domain.TripItem {
		used[a.ID] = true
		buffer := 15
		if a.Outdoor {
			buffer = 20
		}
		return push(domain.TripItem{
			Day: day, Kind: "activity", RefID: a.ID, Title: a.Title,
			Subtitle: activitySubtitle(a), Place: placeOf(a),
			StartMin: RoundTo5(start), DurationMin: a.DurationMin, UnitCost: a.Price,
			Qty: travelers, CostMode: "per-person", VendorID: a.VendorID,
			Outdoor: a.Outdoor, Energy: a.Energy, DependsOn: deps,
			Lat: fptr(a.Lat), Lng: fptr(a.Lng), Icon: a.Icon, Tone: a.Tone, BufferMin: buffer,
		})
	}
	best := func(f func(domain.Activity) bool) *domain.Activity {
		for _, s := range pool {
			if !used[s.a.ID] && f(s.a) {
				a := s.a
				return &a
			}
		}
		return nil
	}
	light := func(a domain.Activity) bool { return a.Energy <= 2 }
	town := dest.Clusters[0]

	clusterScore := func(cid string) int {
		sum, taken := 0, 0
		for _, s := range pool {
			if s.a.Cluster == cid && s.a.Slot != "evening" {
				sum += s.s
				taken++
				if taken == 2 {
					break
				}
			}
		}
		return sum
	}
	type cs struct {
		c domain.Cluster
		s int
	}
	var mids []cs
	for _, c := range dest.Clusters[1:] {
		mids = append(mids, cs{c, clusterScore(c.ID)})
	}
	sort.SliceStable(mids, func(a, b int) bool { return mids[a].s > mids[b].s })

	// Day 1: arrival
	departs := TimeToMin(transport.Departs)
	overnight := departs+transport.DurationMin >= 24*60
	arrival := (departs + transport.DurationMin) % (24 * 60)
	arrSub := fmt.Sprintf("Departs %s · %s", MinToTime(departs), Duration(transport.DurationMin))
	arrStart, arrDur := departs, transport.DurationMin
	if overnight {
		arrSub = fmt.Sprintf("Overnight · departs %s the evening before · arrives %s", MinToTime(departs), MinToTime(arrival))
		arrStart, arrDur = 0, arrival
	}
	arrive := push(domain.TripItem{
		Day: 1, Kind: transport.Mode, RefID: transport.ID, Title: transport.Label, Subtitle: arrSub,
		Place: transport.From, StartMin: arrStart, DurationMin: arrDur, UnitCost: transport.PricePerPerson,
		Qty: travelers, CostMode: "per-person", VendorID: transport.VendorID, Energy: 1,
		Icon: transport.Mode, Tone: "sky", BufferMin: 30,
	})
	gatewayName := strings.Split(dest.Gateway, ",")[0]
	cursor, lastDep := arrival, arrive.ID
	if transport.Mode != "car" {
		pickupMin, title, place, sub, unit := 20, "Station pickup", dest.Name+" station", vehicle+" · to your stay", 700*vehicles
		if transport.Mode == "flight" {
			pickupMin, title, place, sub, unit = 60, "Airport pickup", gatewayName, vehicle+" · "+gatewayName, dest.AirportTransfer*vehicles
		}
		pickup := push(domain.TripItem{
			Day: 1, Kind: "transfer", Title: title, Subtitle: sub, Place: place,
			StartMin: RoundTo5(arrival + 20), DurationMin: pickupMin, UnitCost: unit, Qty: 1,
			CostMode: "flat", VendorID: cab, Energy: 1, DependsOn: []string{arrive.ID},
			Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 15,
		})
		cursor, lastDep = pickup.End(), pickup.ID
	}
	nightsWord := "nights"
	if p.Nights == 1 {
		nightsWord = "night"
	}
	checkin := push(domain.TripItem{
		Day: 1, Kind: "checkin", RefID: stay.ID, Title: "Check-in · " + stay.Name,
		Subtitle: fmt.Sprintf("%s · %d %s", stay.Area, p.Nights, nightsWord), Place: stay.Area,
		StartMin: RoundTo5(max(cursor+10, 11*60)), DurationMin: 45, Qty: 1, CostMode: "flat",
		VendorID: stay.VendorID, Energy: 1, DependsOn: []string{lastDep},
		Lat: stayLat, Lng: stayLng, Icon: "hotel", Tone: "pink", BufferMin: 60,
	})
	firstLight := best(func(a domain.Activity) bool { return a.Cluster == town.ID && light(a) && a.Slot != "evening" })
	if firstLight == nil {
		firstLight = best(func(a domain.Activity) bool { return light(a) && a.Slot != "evening" })
	}
	lastDay1 := checkin.ID
	if firstLight != nil {
		lastDay1 = activityItem(*firstLight, 1, max(checkin.StartMin+105, 16*60), []string{checkin.ID}).ID
	}
	if town.Dinner != nil {
		push(domain.TripItem{
			Day: 1, Kind: "meal", Title: "Welcome dinner · " + town.Dinner.Name, Subtitle: "Table for your group, booked",
			Place: town.Name, StartMin: 20 * 60, DurationMin: 75, UnitCost: town.Dinner.PricePerPerson,
			Qty: travelers, CostMode: "per-person", Energy: 1, DependsOn: []string{lastDay1},
			Lat: stayLat, Lng: stayLng, Icon: "food", Tone: "sun", BufferMin: 30,
		})
	}

	// Middle days
	pickupStart := 9 * 60
	if p.Rhythm == "night-owl" {
		pickupStart = 10 * 60
	}
	for day := 2; day <= days-1; day++ {
		cluster := town
		if len(mids) > 0 {
			cluster = mids[(day-2)%len(mids)].c
		}
		inCluster := func(a domain.Activity) bool { return a.Cluster == cluster.ID }
		morning := best(func(a domain.Activity) bool { return inCluster(a) && a.Slot == "morning" })
		if morning == nil {
			morning = best(func(a domain.Activity) bool { return inCluster(a) && a.Slot != "evening" })
		}
		if morning == nil {
			morning = best(func(a domain.Activity) bool { return a.Slot == "morning" })
		}
		dayCluster := cluster
		if morning != nil {
			if c := dest.ClusterByID(morning.Cluster); c != nil {
				dayCluster = *c
			}
		}
		pickup := push(domain.TripItem{
			Day: day, Kind: "transfer", Title: "Hotel pickup", Subtitle: vehicle + " · full-day cab to " + dayCluster.Name,
			Place: stay.Name, StartMin: pickupStart, DurationMin: 40, UnitCost: dest.LocalCabPerDay * vehicles,
			Qty: 1, CostMode: "flat", VendorID: cab, Energy: 1,
			Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 10,
		})
		prev, end := pickup.ID, pickup.StartMin+60
		if morning != nil {
			m := activityItem(*morning, day, max(end, pickupStart+60), []string{pickup.ID})
			prev, end = m.ID, m.End()
		}
		lunch := domain.TripItem{
			Day: day, Kind: "meal", Title: "Lunch · " + dayCluster.Lunch.Name, Subtitle: "Local favourite, pre-booked",
			Place: dayCluster.Name, StartMin: RoundTo5(max(end+20, 13*60)), DurationMin: 60,
			UnitCost: dayCluster.Lunch.PricePerPerson, Qty: travelers, CostMode: "per-person", Energy: 1,
			DependsOn: []string{prev}, Icon: "food", Tone: "sun", BufferMin: 30,
		}
		if morning != nil {
			lunch.Lat, lunch.Lng = fptr(morning.Lat), fptr(morning.Lng)
		}
		lunch = push(lunch)
		prev, end = lunch.ID, lunch.End()

		if p.Pace == "relaxed" {
			easy := best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot == "afternoon" && light(a) })
			if easy == nil {
				easy = best(func(a domain.Activity) bool { return a.Slot == "afternoon" && light(a) && a.Cluster == town.ID })
			}
			if easy != nil {
				activityItem(*easy, day, max(end+30, 15*60), []string{prev})
			}
			continue
		}
		afternoon := best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot == "afternoon" })
		if afternoon == nil {
			afternoon = best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot != "evening" })
		}
		if afternoon == nil {
			afternoon = best(func(a domain.Activity) bool { return a.Slot == "afternoon" && a.Cluster == town.ID })
		}
		if afternoon == nil {
			afternoon = best(func(a domain.Activity) bool { return a.Slot == "afternoon" })
		}
		if afternoon != nil {
			it := activityItem(*afternoon, day, max(end+30, 15*60), []string{prev})
			prev, end = it.ID, it.End()
		}
		if p.Pace == "packed" {
			extra := best(func(a domain.Activity) bool { return a.Slot == "afternoon" && light(a) })
			if extra != nil && end < 17*60 {
				it := activityItem(*extra, day, end+30, []string{prev})
				prev, end = it.ID, it.End()
			}
		}
		evening := best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot == "evening" })
		if evening == nil {
			evening = best(func(a domain.Activity) bool { return a.Cluster == town.ID && a.Slot == "evening" })
		}
		if evening == nil {
			evening = best(func(a domain.Activity) bool { return a.Slot == "evening" })
		}
		if evening != nil {
			activityItem(*evening, day, max(end+45, 18*60), []string{prev})
		}
	}

	// Last day: departure
	last := days
	checkout := push(domain.TripItem{
		Day: last, Kind: "checkout", RefID: stay.ID, Title: "Breakfast & check-out", Subtitle: stay.Name,
		Place: stay.Area, StartMin: 9*60 + 30, DurationMin: 45, Qty: 1, CostMode: "flat",
		VendorID: stay.VendorID, Energy: 1, Lat: stayLat, Lng: stayLng, Icon: "hotel", Tone: "pink", BufferMin: 15,
	})
	returnDepart := 18 * 60
	switch transport.Mode {
	case "flight":
		returnDepart = 15 * 60
	case "car":
		returnDepart = 12 * 60
	}
	prev := checkout.ID
	morningLight := best(func(a domain.Activity) bool {
		return light(a) && a.Slot != "evening" && a.DurationMin <= 120 && a.Cluster == town.ID
	})
	if morningLight != nil && returnDepart >= 15*60 {
		prev = activityItem(*morningLight, last, 10*60+30, []string{checkout.ID}).ID
	}
	dropID := prev
	if transport.Mode != "car" {
		title, start, dur, unit := "Drop to station", returnDepart-60, 25, 700*vehicles
		if transport.Mode == "flight" {
			title = "Drop to " + strings.TrimSpace(strings.Split(gatewayName, "(")[0])
			start, dur, unit = returnDepart-150, 75, dest.AirportTransfer*vehicles
		}
		dropID = push(domain.TripItem{
			Day: last, Kind: "transfer", Title: title, Subtitle: vehicle, Place: stay.Name,
			StartMin: start, DurationMin: dur, UnitCost: unit, Qty: 1, CostMode: "flat", VendorID: cab,
			Energy: 1, DependsOn: []string{prev}, Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 20,
		}).ID
	}
	push(domain.TripItem{
		Day: last, Kind: transport.Mode, RefID: transport.ID, Title: "Return · " + ReverseRoute(transport.Label),
		Subtitle: fmt.Sprintf("Departs %s · %s", MinToTime(returnDepart), Duration(transport.DurationMin)),
		Place:    dest.Name, StartMin: returnDepart, DurationMin: min(transport.DurationMin, 24*60-returnDepart-1),
		UnitCost: transport.PricePerPerson, Qty: travelers, CostMode: "per-person", VendorID: transport.VendorID,
		Energy: 1, DependsOn: []string{dropID}, Icon: transport.Mode, Tone: "sky", BufferMin: 30,
	})
	return items
}

func activitySubtitle(a domain.Activity) string {
	where := "Indoor"
	if a.Outdoor {
		where = "Outdoor"
	}
	return Duration(a.DurationMin) + " · " + where
}

// MatchedExperiences counts catalogue experiences above the match threshold.
func (e *Engine) MatchedExperiences(p domain.TripPreferences, wishes []Wish) int {
	n := 0
	dest := e.ResolveDestination(p.DestinationID, p)
	if dest == nil {
		return 0
	}
	for _, a := range e.ActivitiesFor(dest) {
		if ScoreActivity(a, p, wishes) >= 45 {
			n++
		}
	}
	return n
}

func (e *Engine) ItemFromActivity(a domain.Activity, day, start, travelers int, tripID string) domain.TripItem {
	place := a.DestinationID
	if d := e.Cat.Destination(a.DestinationID); d != nil {
		place = d.Name
		if c := d.ClusterByID(a.Cluster); c != nil {
			place = c.Name
		}
	}
	return domain.TripItem{
		ID: fmt.Sprintf("%s-d%d-a%s", tripID, day, e.NewID("x")[2:7]), Day: day, Kind: "activity", RefID: a.ID,
		Title: a.Title, Subtitle: activitySubtitle(a), Place: place, StartMin: RoundTo5(start),
		DurationMin: a.DurationMin, UnitCost: a.Price, Qty: travelers, CostMode: "per-person",
		VendorID: a.VendorID, Outdoor: a.Outdoor, Energy: a.Energy, Status: domain.ItemPlanned,
		DependsOn: []string{}, BufferMin: 15, Lat: fptr(a.Lat), Lng: fptr(a.Lng), Icon: a.Icon, Tone: a.Tone,
	}
}

func computeMultiDestAllocations(dests []string, daysMap map[string]int, explicit []domain.DestinationAllocation, totalDays int) []domain.DestinationAllocation {
	if len(explicit) > 0 {
		curDay := 1
		out := make([]domain.DestinationAllocation, len(explicit))
		for i, al := range explicit {
			cnt := max(1, al.Days)
			out[i] = domain.DestinationAllocation{
				DestinationID: al.DestinationID,
				Days:          cnt,
				StartDay:      curDay,
				EndDay:        curDay + cnt - 1,
				PlaceName:     al.PlaceName,
				Lat:           al.Lat,
				Lng:           al.Lng,
			}
			curDay += cnt
		}
		return out
	}
	if len(daysMap) > 0 {
		curDay := 1
		var out []domain.DestinationAllocation
		for _, dID := range dests {
			cnt := daysMap[dID]
			if cnt <= 0 {
				cnt = max(1, totalDays/len(dests))
			}
			out = append(out, domain.DestinationAllocation{
				DestinationID: dID,
				Days:          cnt,
				StartDay:      curDay,
				EndDay:        curDay + cnt - 1,
			})
			curDay += cnt
		}
		return out
	}
	per := totalDays / len(dests)
	rem := totalDays % len(dests)
	curDay := 1
	var out []domain.DestinationAllocation
	for i, dID := range dests {
		cnt := per
		if i == 0 {
			cnt += rem
		}
		out = append(out, domain.DestinationAllocation{
			DestinationID: dID,
			Days:          cnt,
			StartDay:      curDay,
			EndDay:        curDay + cnt - 1,
		})
		curDay += cnt
	}
	return out
}

func (e *Engine) buildMultiDestItems(p domain.TripPreferences, allocs []domain.DestinationAllocation, transport domain.TransportOption, tripID string, wishes []Wish) []domain.TripItem {
	travelers := p.Travelers()
	vehicles := VehiclesFor(p)
	vehicle := "Innova Crysta"
	if travelers > 5 {
		vehicle = "Tempo Traveller"
	}
	var items []domain.TripItem
	n := 0
	push := func(it domain.TripItem) domain.TripItem {
		n++
		it.ID = fmt.Sprintf("%s-d%d-%d", tripID, it.Day, n)
		if it.Status == "" {
			it.Status = domain.ItemPlanned
		}
		if it.DependsOn == nil {
			it.DependsOn = []string{}
		}
		if p.StartDate != "" {
			it.Date = AddDays(p.StartDate, it.Day-1)
		}
		it.StartTime = MinToTime(it.StartMin)
		it.EndTime = MinToTime(it.StartMin + it.DurationMin)
		if it.Location == "" {
			it.Location = it.Place
		}
		items = append(items, it)
		return it
	}

	usedActivities := map[string]bool{}

	for idx, alloc := range allocs {
		dest := e.ResolveDestination(alloc.DestinationID, p)
		if dest == nil {
			continue
		}
		stay := e.PickStay(dest, p)
		stayLat, stayLng := fptr(stay.Lat), fptr(stay.Lng)
		cab := e.CabVendorFor(dest.ID)
		town := dest.Clusters[0]

		var pool []scored
		for _, a := range e.ActivitiesFor(dest) {
			pool = append(pool, scored{a, ScoreActivity(a, p, wishes)})
		}
		sort.SliceStable(pool, func(x, y int) bool { return pool[x].s > pool[y].s })

		placeOf := func(a domain.Activity) string {
			if c := dest.ClusterByID(a.Cluster); c != nil {
				return c.Name
			}
			return dest.Name
		}

		activityItem := func(a domain.Activity, day, start int, deps []string) domain.TripItem {
			usedActivities[a.ID] = true
			buffer := 15
			if a.Outdoor {
				buffer = 20
			}
			return push(domain.TripItem{
				Day: day, Kind: "activity", RefID: a.ID, Title: a.Title,
				Subtitle: activitySubtitle(a), Place: placeOf(a),
				StartMin: RoundTo5(start), DurationMin: a.DurationMin, UnitCost: a.Price,
				Qty: travelers, CostMode: "per-person", VendorID: a.VendorID,
				Outdoor: a.Outdoor, Energy: a.Energy, DependsOn: deps,
				Lat: fptr(a.Lat), Lng: fptr(a.Lng), Icon: a.Icon, Tone: a.Tone, BufferMin: buffer,
			})
		}

		best := func(f func(domain.Activity) bool) *domain.Activity {
			for _, s := range pool {
				if !usedActivities[s.a.ID] && f(s.a) {
					a := s.a
					return &a
				}
			}
			return nil
		}
		light := func(a domain.Activity) bool { return a.Energy <= 2 }

		clusterScore := func(cid string) int {
			sum, taken := 0, 0
			for _, s := range pool {
				if s.a.Cluster == cid && s.a.Slot != "evening" {
					sum += s.s
					taken++
					if taken == 2 {
						break
					}
				}
			}
			return sum
		}
		type cs struct {
			c domain.Cluster
			s int
		}
		var mids []cs
		for _, c := range dest.Clusters[1:] {
			mids = append(mids, cs{c, clusterScore(c.ID)})
		}
		sort.SliceStable(mids, func(a, b int) bool { return mids[a].s > mids[b].s })

		isFirstDest := idx == 0
		isLastDest := idx == len(allocs)-1

		startDay := alloc.StartDay
		endDay := alloc.EndDay

		var lastDep string

		if isFirstDest {
			departs := TimeToMin(transport.Departs)
			overnight := departs+transport.DurationMin >= 24*60
			arrival := (departs + transport.DurationMin) % (24 * 60)
			arrSub := fmt.Sprintf("Departs %s · %s", MinToTime(departs), Duration(transport.DurationMin))
			arrStart, arrDur := departs, transport.DurationMin
			if overnight {
				arrSub = fmt.Sprintf("Overnight · departs %s · arrives %s", MinToTime(departs), MinToTime(arrival))
				arrStart, arrDur = 0, arrival
			}
			fromName := p.FromCity
			if fromName == "" {
				fromName = "Origin"
			}
			arrive := push(domain.TripItem{
				Day: startDay, Kind: transport.Mode, RefID: transport.ID, Title: transport.Label, Subtitle: arrSub,
				Place: fromName, StartMin: arrStart, DurationMin: arrDur, UnitCost: transport.PricePerPerson,
				Qty: travelers, CostMode: "per-person", VendorID: transport.VendorID, Energy: 1,
				Icon: transport.Mode, Tone: "sky", BufferMin: 30,
			})
			lastDep = arrive.ID

			gatewayName := strings.Split(dest.Gateway, ",")[0]
			pickupMin, title, place, sub, unit := 20, "Station pickup", dest.Name+" station", vehicle+" · to your stay", 700*vehicles
			if transport.Mode == "flight" {
				pickupMin, title, place, sub, unit = 60, "Airport pickup", gatewayName, vehicle+" · "+gatewayName, dest.AirportTransfer*vehicles
			}
			pickup := push(domain.TripItem{
				Day: startDay, Kind: "transfer", Title: title, Subtitle: sub, Place: place,
				StartMin: RoundTo5(arrival + 20), DurationMin: pickupMin, UnitCost: unit, Qty: 1,
				CostMode: "flat", VendorID: cab, Energy: 1, DependsOn: []string{arrive.ID},
				Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 15,
			})
			lastDep = pickup.ID
		}

		checkin := push(domain.TripItem{
			Day: startDay, Kind: "checkin", RefID: stay.ID, Title: "Check-in · " + stay.Name,
			Subtitle: fmt.Sprintf("%s · %d nights", stay.Area, alloc.Days), Place: stay.Area,
			StartMin: RoundTo5(max(11*60, 14*60)), DurationMin: 45, Qty: 1, CostMode: "flat",
			VendorID: stay.VendorID, Energy: 1, DependsOn: []string{lastDep},
			Lat: stayLat, Lng: stayLng, Icon: "hotel", Tone: "pink", BufferMin: 60,
		})
		lastDep = checkin.ID

		firstLight := best(func(a domain.Activity) bool { return a.Cluster == town.ID && light(a) && a.Slot != "evening" })
		if firstLight == nil {
			firstLight = best(func(a domain.Activity) bool { return light(a) && a.Slot != "evening" })
		}
		if firstLight != nil {
			lastDep = activityItem(*firstLight, startDay, max(checkin.StartMin+60, 16*60), []string{checkin.ID}).ID
		}
		if town.Dinner != nil {
			push(domain.TripItem{
				Day: startDay, Kind: "meal", Title: "Dinner · " + town.Dinner.Name, Subtitle: "Table for your group, booked",
				Place: town.Name, StartMin: 20 * 60, DurationMin: 75, UnitCost: town.Dinner.PricePerPerson,
				Qty: travelers, CostMode: "per-person", Energy: 1, DependsOn: []string{lastDep},
				Lat: stayLat, Lng: stayLng, Icon: "food", Tone: "sun", BufferMin: 30,
			})
		}

		for day := startDay + 1; day < endDay; day++ {
			cluster := town
			if len(mids) > 0 {
				cluster = mids[(day-startDay-1)%len(mids)].c
			}
			inCluster := func(a domain.Activity) bool { return a.Cluster == cluster.ID }
			morning := best(func(a domain.Activity) bool { return inCluster(a) && a.Slot == "morning" })
			if morning == nil {
				morning = best(func(a domain.Activity) bool { return inCluster(a) && a.Slot != "evening" })
			}
			if morning == nil {
				morning = best(func(a domain.Activity) bool { return a.Slot == "morning" })
			}
			dayCluster := cluster
			if morning != nil {
				if c := dest.ClusterByID(morning.Cluster); c != nil {
					dayCluster = *c
				}
			}
			pickup := push(domain.TripItem{
				Day: day, Kind: "transfer", Title: "Hotel pickup", Subtitle: vehicle + " · full-day cab to " + dayCluster.Name,
				Place: stay.Name, StartMin: 9 * 60, DurationMin: 40, UnitCost: dest.LocalCabPerDay * vehicles,
				Qty: 1, CostMode: "flat", VendorID: cab, Energy: 1,
				Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 10,
			})
			prev, end := pickup.ID, pickup.StartMin+60
			if morning != nil {
				m := activityItem(*morning, day, max(end, 10*60), []string{pickup.ID})
				prev, end = m.ID, m.End()
			}
			lunch := domain.TripItem{
				Day: day, Kind: "meal", Title: "Lunch · " + dayCluster.Lunch.Name, Subtitle: "Local favourite, pre-booked",
				Place: dayCluster.Name, StartMin: RoundTo5(max(end+20, 13*60)), DurationMin: 60,
				UnitCost: dayCluster.Lunch.PricePerPerson, Qty: travelers, CostMode: "per-person", Energy: 1,
				DependsOn: []string{prev}, Icon: "food", Tone: "sun", BufferMin: 30,
			}
			if morning != nil {
				lunch.Lat, lunch.Lng = fptr(morning.Lat), fptr(morning.Lng)
			}
			lunch = push(lunch)
			prev, end = lunch.ID, lunch.End()

			afternoon := best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot == "afternoon" })
			if afternoon == nil {
				afternoon = best(func(a domain.Activity) bool { return a.Slot == "afternoon" })
			}
			if afternoon != nil {
				it := activityItem(*afternoon, day, max(end+30, 15*60), []string{prev})
				prev, end = it.ID, it.End()
			}

			evening := best(func(a domain.Activity) bool { return a.Cluster == dayCluster.ID && a.Slot == "evening" })
			if evening == nil {
				evening = best(func(a domain.Activity) bool { return a.Cluster == town.ID && a.Slot == "evening" })
			}
			if evening != nil {
				activityItem(*evening, day, max(end+45, 18*60), []string{prev})
			}
		}

		if !isLastDest {
			day := endDay
			checkout := push(domain.TripItem{
				Day: day, Kind: "checkout", RefID: stay.ID, Title: "Breakfast & check-out", Subtitle: stay.Name,
				Place: stay.Area, StartMin: 9*60 + 30, DurationMin: 45, Qty: 1, CostMode: "flat",
				VendorID: stay.VendorID, Energy: 1, Lat: stayLat, Lng: stayLng, Icon: "hotel", Tone: "pink", BufferMin: 15,
			})
			prev := checkout.ID
			if alloc.Days > 1 {
				morningLight := best(func(a domain.Activity) bool { return light(a) && a.Slot != "evening" && a.Cluster == town.ID })
				if morningLight != nil {
					prev = activityItem(*morningLight, day, 10*60+30, []string{checkout.ID}).ID
				}
			}

			nextDest := e.ResolveDestination(allocs[idx+1].DestinationID, p)
			if nextDest != nil {
				distKm := HaversineKm(dest.Lat, dest.Lng, nextDest.Lat, nextDest.Lng)
				transMode := p.Transport
				durMin := 75
				priceEst := 3200
				modeLabel := "Flight"
				icon := "flight"
				switch transMode {
				case "flight":
					durMin = 75
					priceEst = 3400
					modeLabel = fmt.Sprintf("Flight · %s → %s", dest.Name, nextDest.Name)
					icon = "flight"
				case "train":
					durMin = max(180, int(distKm/65.0*60.0))
					priceEst = 1200
					modeLabel = fmt.Sprintf("Express Train · %s → %s", dest.Name, nextDest.Name)
					icon = "train"
				case "bus":
					durMin = max(240, int(distKm/45.0*60.0))
					priceEst = 950
					modeLabel = fmt.Sprintf("Volvo AC Bus · %s → %s", dest.Name, nextDest.Name)
					icon = "bus"
				default:
					durMin = max(120, int(distKm/55.0*60.0))
					priceEst = int(distKm * 14)
					modeLabel = fmt.Sprintf("Private Car Transfer · %s → %s", dest.Name, nextDest.Name)
					icon = "car"
				}
				push(domain.TripItem{
					Day: day, Kind: "transfer", Title: modeLabel,
					Subtitle: fmt.Sprintf("Inter-destination transfer · %.0f km · ~%s", distKm, Duration(durMin)),
					Place:    fmt.Sprintf("%s → %s", dest.Name, nextDest.Name),
					StartMin: 14 * 60, DurationMin: durMin,
					UnitCost: priceEst, Qty: travelers, CostMode: "per-person",
					VendorID: cab, Energy: 1, DependsOn: []string{prev},
					Lat: fptr(dest.Lat), Lng: fptr(dest.Lng), Icon: icon, Tone: "sky", BufferMin: 30,
				})
			}
		}

		if isLastDest {
			lastDay := endDay
			checkout := push(domain.TripItem{
				Day: lastDay, Kind: "checkout", RefID: stay.ID, Title: "Breakfast & check-out", Subtitle: stay.Name,
				Place: stay.Area, StartMin: 9*60 + 30, DurationMin: 45, Qty: 1, CostMode: "flat",
				VendorID: stay.VendorID, Energy: 1, Lat: stayLat, Lng: stayLng, Icon: "hotel", Tone: "pink", BufferMin: 15,
			})
			prev := checkout.ID
			returnDepart := 18 * 60
			if transport.Mode == "flight" {
				returnDepart = 15 * 60
			}
			morningLight := best(func(a domain.Activity) bool { return light(a) && a.Slot != "evening" && a.Cluster == town.ID })
			if morningLight != nil && returnDepart >= 15*60 {
				prev = activityItem(*morningLight, lastDay, 10*60+30, []string{checkout.ID}).ID
			}
			dropID := prev
			if transport.Mode != "car" {
				dropTitle := "Drop to station"
				if transport.Mode == "flight" {
					dropTitle = "Drop to airport"
				}
				dropID = push(domain.TripItem{
					Day: lastDay, Kind: "transfer", Title: dropTitle, Subtitle: vehicle, Place: stay.Name,
					StartMin: returnDepart - 90, DurationMin: 45, UnitCost: 800 * vehicles, Qty: 1,
					CostMode: "flat", VendorID: cab, Energy: 1, DependsOn: []string{prev},
					Lat: stayLat, Lng: stayLng, Icon: "cab", Tone: "cream", BufferMin: 20,
				}).ID
			}
			toCity := p.FromCity
			if toCity == "" {
				toCity = "Home"
			}
			push(domain.TripItem{
				Day: lastDay, Kind: transport.Mode, RefID: transport.ID,
				Title:    fmt.Sprintf("Return · %s to %s", dest.Name, toCity),
				Subtitle: fmt.Sprintf("Departs %s · %s", MinToTime(returnDepart), Duration(transport.DurationMin)),
				Place:    dest.Name, StartMin: returnDepart, DurationMin: min(transport.DurationMin, 24*60-returnDepart-1),
				UnitCost: transport.PricePerPerson, Qty: travelers, CostMode: "per-person",
				VendorID: transport.VendorID, Energy: 1, DependsOn: []string{dropID},
				Icon: transport.Mode, Tone: "sky", BufferMin: 30,
			})
		}
	}

	return items
}

func (e *Engine) ResolveDestination(id string, p domain.TripPreferences) *domain.Destination {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil
	}
	cleanID := strings.ToLower(id)
	if d := e.Cat.Destination(id); d != nil {
		return d
	}
	if d := e.Cat.Destination(cleanID); d != nil {
		return d
	}
	for i := range e.Cat.Destinations {
		if strings.EqualFold(e.Cat.Destinations[i].ID, cleanID) || strings.EqualFold(e.Cat.Destinations[i].Name, id) {
			return &e.Cat.Destinations[i]
		}
	}
	for _, dp := range p.DestinationPlaces {
		if dp.PlaceID == id || strings.EqualFold(dp.Name, id) || strings.EqualFold(dp.City, id) {
			return makePlaceDestination(dp)
		}
	}
	formatted := strings.Title(strings.ReplaceAll(id, "-", " "))
	return &domain.Destination{
		ID: cleanID, Name: formatted, State: "Karnataka", Lat: 12.9716, Lng: 77.5946,
		Gateway: "Kempegowda International Airport (BLR)", LocalCabPerDay: 2400, AirportTransfer: 1000,
		Clusters: []domain.Cluster{
			{ID: cleanID + "-center", Name: formatted + " Center", Lunch: domain.Meal{Name: "Karnataka Udupi Canteen", PricePerPerson: 350}, Dinner: &domain.Meal{Name: "Regional Diner", PricePerPerson: 650}},
		},
	}
}

func makePlaceDestination(dp domain.PlaceIdentity) *domain.Destination {
	id := dp.PlaceID
	if id == "" {
		id = strings.ToLower(strings.ReplaceAll(dp.Name, " ", "-"))
	}
	name := dp.Name
	if name == "" {
		name = dp.City
	}
	if name == "" {
		name = "Destination"
	}
	return &domain.Destination{
		ID: id, Name: name, State: dp.State, Lat: dp.Lat, Lng: dp.Lng,
		Gateway: "Regional Transport Hub", LocalCabPerDay: 2400, AirportTransfer: 1000,
		Clusters: []domain.Cluster{
			{ID: id + "-center", Name: name + " Center", Lunch: domain.Meal{Name: "Local Eatery", PricePerPerson: 450}, Dinner: &domain.Meal{Name: "Fine Dining Restaurant", PricePerPerson: 850}},
			{ID: id + "-outskirts", Name: name + " Vicinity", Lunch: domain.Meal{Name: "Highway Dhaba", PricePerPerson: 350}, Dinner: &domain.Meal{Name: "Garden Restaurant", PricePerPerson: 650}},
		},
	}
}

func (e *Engine) StaysFor(dest *domain.Destination) []domain.Stay {
	list := e.Cat.StaysFor(dest.ID)
	if len(list) > 0 {
		return list
	}
	return fallbackStays(dest)
}

func (e *Engine) TransportFor(dest *domain.Destination, p domain.TripPreferences) []domain.TransportOption {
	list := e.Cat.TransportFor(dest.ID)
	if len(list) > 0 {
		return list
	}
	return fallbackTransport(dest, p)
}

func (e *Engine) ActivitiesFor(dest *domain.Destination) []domain.Activity {
	list := e.Cat.ActivitiesFor(dest.ID)
	if len(list) > 0 {
		return list
	}
	return fallbackActivities(dest)
}

func (e *Engine) CabVendorFor(destID string) string {
	cab := e.Cat.CabVendorFor(destID)
	if cab != "" {
		return cab
	}
	return "v-cab-" + destID
}

func fallbackStays(dest *domain.Destination) []domain.Stay {
	area := dest.Name + " Central"
	if len(dest.Clusters) > 0 {
		area = dest.Clusters[0].Name
	}
	return []domain.Stay{
		{ID: "stay-" + dest.ID + "-boutique", DestinationID: dest.ID, Name: dest.Name + " Heritage Boutique", Type: "boutique", NightlyPrice: 3800, Lat: dest.Lat + 0.005, Lng: dest.Lng + 0.005, Area: area, VendorID: "v-stay-" + dest.ID, Amenities: []string{"Wi-Fi", "Breakfast", "AC", "Pool"}, Tone: "pink"},
		{ID: "stay-" + dest.ID + "-budget", DestinationID: dest.ID, Name: dest.Name + " Express Hotel", Type: "budget", NightlyPrice: 1800, Lat: dest.Lat - 0.004, Lng: dest.Lng - 0.004, Area: area, VendorID: "v-stay-" + dest.ID, Amenities: []string{"Wi-Fi", "AC"}, Tone: "pink"},
		{ID: "stay-" + dest.ID + "-homestay", DestinationID: dest.ID, Name: dest.Name + " Villa Homestay", Type: "homestay", NightlyPrice: 2600, Lat: dest.Lat + 0.008, Lng: dest.Lng - 0.003, Area: area, VendorID: "v-stay-" + dest.ID, Amenities: []string{"Home Meals", "Wi-Fi", "Garden"}, Tone: "pink"},
		{ID: "stay-" + dest.ID + "-luxury", DestinationID: dest.ID, Name: dest.Name + " Grand Palace & Resort", Type: "luxury", NightlyPrice: 7500, Lat: dest.Lat - 0.007, Lng: dest.Lng + 0.009, Area: area, VendorID: "v-stay-" + dest.ID, Amenities: []string{"Spa", "Infinity Pool", "Fine Dining"}, Tone: "pink"},
		{ID: "stay-" + dest.ID + "-hostel", DestinationID: dest.ID, Name: dest.Name + " Backpacker Hostel", Type: "hostel", NightlyPrice: 850, Lat: dest.Lat + 0.002, Lng: dest.Lng - 0.002, Area: area, VendorID: "v-stay-" + dest.ID, Amenities: []string{"Wi-Fi", "Common Room", "Lockers"}, Tone: "pink"},
	}
}

func fallbackTransport(dest *domain.Destination, p domain.TripPreferences) []domain.TransportOption {
	from := p.FromCity
	if from == "" {
		from = "Origin"
	}
	return []domain.TransportOption{
		{ID: "tr-" + dest.ID + "-fl", DestinationID: dest.ID, Mode: "flight", Label: fmt.Sprintf("IndiGo 6E · %s to %s", from, dest.Name), From: from, PricePerPerson: 3800, DurationMin: 110, Departs: "07:30", VendorID: "v-fl-" + dest.ID},
		{ID: "tr-" + dest.ID + "-tr", DestinationID: dest.ID, Mode: "train", Label: fmt.Sprintf("Vande Bharat Express · %s to %s", from, dest.Name), From: from, PricePerPerson: 1650, DurationMin: 360, Departs: "06:00", VendorID: "v-tr-" + dest.ID},
		{ID: "tr-" + dest.ID + "-bus", DestinationID: dest.ID, Mode: "bus", Label: fmt.Sprintf("Volvo Multi-Axle AC Sleeper · %s to %s", from, dest.Name), From: from, PricePerPerson: 1100, DurationMin: 480, Departs: "21:00", VendorID: "v-bus-" + dest.ID},
		{ID: "tr-" + dest.ID + "-car", DestinationID: dest.ID, Mode: "car", Label: fmt.Sprintf("Private Inter-City Cab · %s to %s", from, dest.Name), From: from, PricePerPerson: 3500, DurationMin: 240, Departs: "08:00", VendorID: "v-cab-" + dest.ID},
	}
}

func fallbackActivities(dest *domain.Destination) []domain.Activity {
	c0, c1 := "c0", "c1"
	if len(dest.Clusters) > 0 {
		c0 = dest.Clusters[0].ID
		c1 = dest.Clusters[0].ID
	}
	if len(dest.Clusters) > 1 {
		c1 = dest.Clusters[1].ID
	}
	clean := strings.ToLower(dest.ID)
	_ = clean
	return []domain.Activity{
		{ID: "act-" + dest.ID + "-1", DestinationID: dest.ID, Cluster: c0, Title: dest.Name + " Heritage & Old Town Walk", Description: "Guided morning exploration of local history, architecture and landmark squares", Interests: []string{"culture", "photo"}, DurationMin: 120, Price: 400, Energy: 2, Outdoor: true, Slot: "morning", Lat: dest.Lat + 0.004, Lng: dest.Lng + 0.003, KidFriendly: true, Walking: "medium", Icon: "walk", Tone: "amber"},
		{ID: "act-" + dest.ID + "-2", DestinationID: dest.ID, Cluster: c0, Title: dest.Name + " Regional Museum & Art Center", Description: "Curated exhibits celebrating the craft, folklore, and heritage of the province", Interests: []string{"culture", "relax"}, DurationMin: 90, Price: 200, Energy: 1, Outdoor: false, Slot: "afternoon", Lat: dest.Lat - 0.003, Lng: dest.Lng + 0.005, KidFriendly: true, Walking: "low", Icon: "museum", Tone: "sky"},
		{ID: "act-" + dest.ID + "-3", DestinationID: dest.ID, Cluster: c0, Title: dest.Name + " Sunset Point & Evening Bazaar", Description: "Panoramic viewpoint as dusk falls, followed by an evening stroll through local bazaars", Interests: []string{"photo", "social"}, DurationMin: 90, Price: 0, Energy: 1, Outdoor: true, Slot: "evening", Lat: dest.Lat + 0.008, Lng: dest.Lng - 0.004, KidFriendly: true, Walking: "low", Icon: "photo", Tone: "sun"},
		{ID: "act-" + dest.ID + "-4", DestinationID: dest.ID, Cluster: c1, Title: dest.Name + " Nature Sanctuary & Botanical Trail", Description: "Morning botanical garden and flora trail with serene bird-watching gazebos", Interests: []string{"nature", "relax"}, DurationMin: 120, Price: 250, Energy: 2, Outdoor: true, Slot: "morning", Lat: dest.Lat - 0.006, Lng: dest.Lng - 0.005, KidFriendly: true, Walking: "medium", Icon: "hike", Tone: "sage"},
		{ID: "act-" + dest.ID + "-5", DestinationID: dest.ID, Cluster: c1, Title: dest.Name + " Artisan Workshop & Handicraft Village", Description: "Watch master craftsmen at work and participate in an authentic handloom workshop", Interests: []string{"culture", "food"}, DurationMin: 90, Price: 350, Energy: 2, Outdoor: false, Slot: "afternoon", Lat: dest.Lat + 0.003, Lng: dest.Lng - 0.007, KidFriendly: true, Walking: "low", Icon: "shop", Tone: "pink"},
		{ID: "act-" + dest.ID + "-6", DestinationID: dest.ID, Cluster: c1, Title: dest.Name + " Riverside Twilight Café Crawl", Description: "Relax by the water with regional appetizers and music", Interests: []string{"food", "social"}, DurationMin: 105, Price: 500, Energy: 1, Outdoor: true, Slot: "evening", Lat: dest.Lat + 0.002, Lng: dest.Lng + 0.006, KidFriendly: true, Walking: "low", Icon: "food", Tone: "sun"},
	}
}
