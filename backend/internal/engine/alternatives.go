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

type Alternative struct {
	Activity     domain.Activity `json:"activity"`
	IsCurrent    bool            `json:"isCurrent"`
	TotalCost    int             `json:"totalCost"`
	PriceDelta   int             `json:"priceDelta"`
	DistanceKm   float64         `json:"distanceKm"`
	Match        int             `json:"match"`
	WeatherSafe  bool            `json:"weatherSafe"`
	WeatherLabel string          `json:"weatherLabel"`
	Availability string          `json:"availability"`
}

// availabilityFor is whether the partner is taking bookings (the operator's Available switch);
// every booking is still confirmed by the partner itself.
func (e *Engine) availabilityFor(a domain.Activity) string {
	if !e.Cat.Available(a.VendorID) {
		return "Partner paused"
	}
	return "Available"
}

func (e *Engine) ActivityAlternatives(t *domain.Trip, it domain.TripItem, limit int) []Alternative {
	current := e.Cat.Activity(it.RefID)
	taken := inTripRefs(t)
	weather := e.TripDayWeather(t, it.Day)
	wet := IsWet(weather)
	qty := QtyOf(it)
	oLat, oLng := 0.0, 0.0
	if it.HasPoint() {
		oLat, oLng = *it.Lat, *it.Lng
	}
	toAlt := func(a domain.Activity, isCurrent bool) Alternative {
		total := a.Price * qty
		delta := 0
		if !isCurrent {
			delta = total - ItemCost(it)
		}
		label := "Clear day"
		if !a.Outdoor {
			label = "Rain-safe (indoor)"
		} else if wet {
			label = fmt.Sprintf("Rain forecast (%d%%)", weather.RainChance)
		}
		avail := "Available"
		if !isCurrent {
			avail = e.availabilityFor(a)
		}
		return Alternative{
			Activity: a, IsCurrent: isCurrent, TotalCost: total, PriceDelta: delta,
			DistanceKm: math.Round(HaversineKm(oLat, oLng, a.Lat, a.Lng)*10) / 10,
			Match:      MatchPercent(a, t.Prefs), WeatherSafe: !a.Outdoor || !wet, WeatherLabel: label, Availability: avail,
		}
	}
	type sc struct {
		a     domain.Activity
		score float64
	}
	var pool []sc
	for _, a := range e.Cat.ActivitiesFor(t.DestinationID) {
		if a.ID == it.RefID || taken[a.ID] {
			continue
		}
		shared, same := 0, 0
		if current != nil {
			shared = len(intersect(a.Interests, current.Interests))
			if a.Slot == current.Slot {
				same = 1
			}
		}
		km := HaversineKm(oLat, oLng, a.Lat, a.Lng)
		pool = append(pool, sc{a, float64(shared*12+same*10) + float64(MatchPercent(a, t.Prefs))*0.4 - math.Min(km, 60)*0.3})
	}
	sort.SliceStable(pool, func(x, y int) bool { return pool[x].score > pool[y].score })
	if len(pool) > limit {
		pool = pool[:limit]
	}
	var out []Alternative
	if current != nil {
		out = append(out, toAlt(*current, true))
	}
	for _, p := range pool {
		out = append(out, toAlt(p.a, false))
	}
	return out
}

type StayAlternative struct {
	Stay      domain.Stay `json:"stay"`
	IsCurrent bool        `json:"isCurrent"`
	Total     int         `json:"total"`
	Delta     int         `json:"delta"`
}

func (e *Engine) StayAlternatives(t *domain.Trip) []StayAlternative {
	rooms := RoomsFor(t.Prefs)
	cur := 0
	if s := e.Cat.Stay(t.StayID); s != nil {
		cur = s.NightlyPrice * rooms * t.Prefs.Nights
	}
	var out []StayAlternative
	for _, s := range e.Cat.StaysFor(t.DestinationID) {
		total := s.NightlyPrice * rooms * t.Prefs.Nights
		out = append(out, StayAlternative{Stay: s, IsCurrent: s.ID == t.StayID, Total: total, Delta: total - cur})
	}
	return out
}

type PrepItem struct {
	ID    string `json:"id"`
	Group string `json:"group"`
	Label string `json:"label"`
	Why   string `json:"why"`
}

var (
	waterRe = regexp.MustCompile(`(?i)raft|kayak|snorkel|scuba|swim|sea walk|lagoon`)
	shoesRe = regexp.MustCompile(`(?i)paraglid|trek|hike|jeep|fort|pass`)
)

func (e *Engine) PrepChecklist(t *domain.Trip) []PrepItem {
	var titles []string
	for _, i := range t.Items {
		if i.RefID != "" && IsActive(i) {
			if a := e.Cat.Activity(i.RefID); a != nil {
				titles = append(titles, a.Title)
			}
		}
	}
	has := func(re *regexp.Regexp) bool {
		for _, s := range titles {
			if re.MatchString(s) {
				return true
			}
		}
		return false
	}
	forecast := e.TripForecast(t)
	wetDays, cold, hot := 0, false, false
	for _, f := range forecast {
		if IsWet(f) {
			wetDays++
		}
		cold = cold || f.TempC <= 15
		hot = hot || f.TempC >= 30
	}
	list := []PrepItem{
		{"id", "Documents", "Government photo ID for every traveler", "Needed at hotels, airports and activity check-ins"},
		{"tickets", "Documents", "Tickets saved in your Trip Pass", "Works offline in the mountains"},
		{"insurance", "Documents", "Travel insurance policy PDF", "Adventure activities often ask for it"},
		{"cash", "Money", "₹3,000 in small notes", "Dhabas, parking and tips are often cash-only"},
		{"upi", "Money", "UPI app working on your phone", "Most shops accept UPI"},
		{"app", "Apps & offline", "Install Trizpyy on your phone", "Open the trip once online so it works offline (Offline Trip Pass)"},
		{"offline", "Apps & offline", "Download offline map of the area", "Network drops outside town"},
		{"meds", "Health", "Personal medicines + basic first-aid", "Pharmacies close early in small towns"},
	}
	if wetDays > 0 {
		list = append(list, PrepItem{"rain", "Packing", "Rain jacket & waterproof phone pouch", fmt.Sprintf("Rain is likely on %d day(s)", wetDays)})
	}
	if cold {
		list = append(list, PrepItem{"warm", "Packing", "Fleece + light down jacket", "Evenings drop below 15°C"})
	}
	if hot {
		list = append(list, PrepItem{"sun", "Packing", "Sunscreen SPF 50, cap & sunglasses", "Days go above 30°C"})
	}
	if has(waterRe) {
		list = append(list, PrepItem{"quickdry", "Packing", "Quick-dry clothes & a spare set", "You will get wet on the water activities"})
	}
	if has(shoesRe) {
		list = append(list, PrepItem{"shoes", "Packing", "Closed shoes with good grip", "Required for paragliding and trails"})
	}
	if t.DestinationID == "bandipur" || t.DestinationID == "kabini" {
		list = append(list, PrepItem{"safari-permit", "Documents", "Government Safari Permit & ID Proof", "Mandatory check by Karnataka Forest Dept at safari gates"})
	}
	if t.DestinationID == "coorg" || t.DestinationID == "chikmagalur" {
		list = append(list, PrepItem{"leech-socks", "Packing", "Leech socks & rain poncho", "Recommended for coffee estate walks & Western Ghats rainforest trails"})
	}
	if t.Prefs.Kids > 0 {
		list = append(list, PrepItem{"kids", "Packing", "Snacks, wipes & a small backpack for the kids", "Long drives between places"})
	}
	return list
}

var interestLabel = map[string]string{
	"nature": "Nature", "adventure": "Adventure", "culture": "Culture", "food": "Food",
	"luxury": "Luxury", "social": "Nightlife", "relax": "Quiet places", "photo": "Views",
}

type DestinationMatch struct {
	Score   int      `json:"score"`
	Because []string `json:"because"`
}

func labels(list []string) []string {
	out := make([]string, 0, len(list))
	for _, i := range list {
		out = append(out, interestLabel[i])
	}
	return out
}

func (e *Engine) DestinationMatch(d domain.Destination, wants []string, month time.Month) DestinationMatch {
	if len(wants) == 0 {
		return DestinationMatch{Score: Round(62 + rated(d.Rating)*5), Because: labels(first(d.Interests, 3))}
	}
	shared := intersect(d.Interests, wants)
	season := 0.0
	if containsInt(d.BestMonths, int(month)) {
		season = 8
	} else if containsInt(d.RainyMonths, int(month)) {
		season = -10
	}
	score := clamp(Round(48+float64(len(shared))*14+rated(d.Rating)*3+season), 40, 98)
	because := shared
	if len(because) == 0 {
		because = first(d.Interests, 2)
	}
	return DestinationMatch{Score: score, Because: labels(because)}
}

func first(list []string, n int) []string {
	if len(list) > n {
		return list[:n]
	}
	return list
}

// EstimatedPerPerson runs the real planner and pricing for a typical 2-adult, 4-night trip.
func (e *Engine) EstimatedPerPerson(d domain.Destination) int {
	transport := e.Cat.TransportFor(d.ID)
	if len(transport) == 0 {
		return 0
	}
	cheapest := transport[0]
	for _, t := range transport {
		if t.PricePerPerson < cheapest.PricePerPerson {
			cheapest = t
		}
	}
	p := domain.TripPreferences{
		DestinationID: d.ID, StartDate: AddDays(e.Today(), 21), Nights: 4, Adults: 2, BudgetPerPerson: 30000,
		StayType: "boutique", Transport: cheapest.Mode, Interests: first(d.Interests, 3), Pace: "balanced",
		Rhythm: "early-bird", Special: []string{}, FromCity: d.FromCity,
	}
	trip, err := e.BuildTrip(p, BuildOptions{ID: "est-" + d.ID, Code: "EST", CustomerName: "Estimate"})
	if err != nil {
		return 0
	}
	return e.PriceTrip(trip).PerPerson
}

type feeling struct {
	re        *regexp.Regexp
	interests []string
	moods     []string
}

var feelings = []feeling{
	{regexp.MustCompile(`(?i)quiet|calm|peace|slow`), []string{"relax", "nature"}, []string{"Slow travel", "Backwaters"}},
	{regexp.MustCompile(`(?i)mountain|snow|hill|cold`), []string{"nature", "adventure"}, []string{"Mountains"}},
	{regexp.MustCompile(`(?i)beach|sea|island|sun`), []string{"relax"}, []string{"Beaches", "Islands"}},
	{regexp.MustCompile(`(?i)food|eat|cafe|café`), []string{"food"}, []string{"Food", "Cafés", "Seafood"}},
	{regexp.MustCompile(`(?i)history|fort|palace|heritage|culture`), []string{"culture"}, []string{"Heritage"}},
	{regexp.MustCompile(`(?i)adventure|thrill|raft|trek|dive|scuba`), []string{"adventure"}, []string{"Adventure", "Scuba"}},
	{regexp.MustCompile(`(?i)romantic|honeymoon|couple`), []string{"luxury"}, []string{"Romance", "Honeymoon"}},
	{regexp.MustCompile(`(?i)party|nightlife|friends`), []string{"social"}, []string{"Nightlife"}},
}

// ScoreByFeeling ranks a destination for "search by feeling".
func ScoreByFeeling(d domain.Destination, query string) int {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return 0
	}
	score := 0
	nameLower := strings.ToLower(d.Name)
	stateLower := strings.ToLower(d.State)
	descLower := strings.ToLower(d.Description)
	taglineLower := strings.ToLower(d.Tagline)

	if strings.Contains(nameLower, q) || strings.Contains(stateLower, q) {
		score += 120
	}
	if strings.Contains(taglineLower, q) {
		score += 40
	}
	if strings.Contains(descLower, q) {
		score += 25
	}

	tokens := strings.Fields(q)
	for _, tok := range tokens {
		if len(tok) < 2 {
			continue
		}
		if strings.Contains(nameLower, tok) {
			score += 100
		}
		if strings.Contains(stateLower, tok) {
			score += 50
		}
		if strings.Contains(taglineLower, tok) {
			score += 20
		}
		for _, h := range d.Highlights {
			if strings.Contains(strings.ToLower(h), tok) {
				score += 30
				break
			}
		}
		for _, m := range d.Moods {
			if strings.Contains(strings.ToLower(m), tok) {
				score += 25
				break
			}
		}
	}

	for _, f := range feelings {
		if !f.re.MatchString(query) {
			continue
		}
		score += len(intersect(f.interests, d.Interests)) * 20
		score += len(intersect(f.moods, d.Moods)) * 25
	}
	return score
}
