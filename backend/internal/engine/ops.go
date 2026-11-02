package engine

import (
	"fmt"
	"math"
	"regexp"
	"strings"

	"trizpyy/internal/domain"
)

func TourStatus(t *domain.Trip, today string, hasOpenIncident bool) string {
	if t.Status == domain.TripDraft {
		return "planning"
	}
	end := AddDays(t.Prefs.StartDate, t.Prefs.Nights)
	if DaysBetween(end, today) > 0 || t.Status == domain.TripCompleted {
		return "completed"
	}
	if hasOpenIncident {
		return "at_risk"
	}
	if DaysBetween(t.Prefs.StartDate, today) >= 0 {
		return "live"
	}
	return "confirmed"
}

func CurrentDayOf(t *domain.Trip, today string) int {
	return clamp(DaysBetween(t.Prefs.StartDate, today)+1, 1, t.Prefs.Days())
}

type TourRow struct {
	Trip           *domain.Trip `json:"trip"`
	Status         string       `json:"status"`
	Risk           int          `json:"risk"`
	RiskReasons    []string     `json:"riskReasons"`
	Revenue        int          `json:"revenue"`
	Travelers      int          `json:"travelers"`
	PendingVendors int          `json:"pendingVendors"`
	EndDate        string       `json:"endDate"`
}

func (e *Engine) TourRow(t *domain.Trip, open []domain.Incident, bookings []domain.Booking) TourRow {
	today := e.Today()
	var titles []string
	for _, i := range open {
		titles = append(titles, i.Title)
	}
	status := TourStatus(t, today, len(open) > 0)
	pendingSet := map[string]bool{}
	declined := 0
	for _, b := range bookings {
		if b.Status == "requested" {
			pendingSet[b.VendorID] = true
		}
		if b.Status == "declined" {
			declined++
		}
	}
	pending := len(pendingSet)
	reasons := []string{}
	risk := 8
	if len(open) > 0 {
		risk += 45
		reasons = append(reasons, strings.Join(titles, ", "))
	}
	if pending > 0 {
		risk += min(20, pending*6)
		s := ""
		if pending > 1 {
			s = "s"
		}
		reasons = append(reasons, fmt.Sprintf("%d vendor%s yet to confirm", pending, s))
	}
	if declined > 0 {
		risk += 15
		s := ""
		if declined > 1 {
			s = "s"
		}
		reasons = append(reasons, fmt.Sprintf("%d declined booking%s", declined, s))
	}
	if status == "live" || status == "confirmed" {
		cur := 1
		if t.CurrentDay != nil {
			cur = *t.CurrentDay
		}
		var wet []string
		for d := cur; d <= t.Prefs.Days(); d++ {
			if !IsWet(e.TripDayWeather(t, d)) {
				continue
			}
			for _, i := range t.Items {
				if i.Day == d && i.Outdoor && i.Kind == "activity" && IsActive(i) {
					wet = append(wet, fmt.Sprint(d))
					break
				}
			}
		}
		if len(wet) > 0 {
			risk += 18
			reasons = append(reasons, "Rain on day "+strings.Join(wet, ", ")+" with outdoor plans")
		}
		for _, i := range t.Items {
			if i.VendorID != "" && i.Status != domain.ItemDone && e.Cat.TrustScore(i.VendorID, 90) < 65 {
				risk += 8
				reasons = append(reasons, "Low-trust vendor in plan")
				break
			}
		}
	}
	if status == "completed" {
		risk = 0
	} else if status == "planning" {
		risk = 5
	}
	revenue := 0
	if t.Status != domain.TripDraft {
		revenue = e.PriceTrip(t).Total
	}
	return TourRow{
		Trip: t, Status: status, Risk: min(99, risk), RiskReasons: reasons, Revenue: revenue,
		Travelers: t.Prefs.Travelers(), PendingVendors: pending, EndDate: AddDays(t.Prefs.StartDate, t.Prefs.Nights),
	}
}

type Overview struct {
	Active             int `json:"active"`
	DeparturesThisWeek int `json:"departuresThisWeek"`
	Bookings           int `json:"bookings"`
	AtRisk             int `json:"atRisk"`
	PendingVendors     int `json:"pendingVendors"`
	Revenue            int `json:"revenue"`
	Refunds            int `json:"refunds"`
	Payouts            int `json:"payouts"`
	OpenIncidents      int `json:"openIncidents"`
	ReplyRate          int `json:"replyRate"`
}

func (e *Engine) Overview(rows []TourRow, incidents []domain.Incident, bookings []domain.Booking, ledger []domain.LedgerEntry) Overview {
	today := e.Today()
	var o Overview
	for _, l := range ledger {
		switch l.Kind {
		case "payment", "adjustment":
			o.Revenue += l.Amount
		case "refund":
			o.Refunds += abs(l.Amount)
		case "payout":
			o.Payouts += abs(l.Amount)
		}
	}
	for _, r := range rows {
		if r.Status == "live" || r.Status == "at_risk" {
			o.Active++
		}
		if d := DaysBetween(today, r.Trip.Prefs.StartDate); d >= 0 && d <= 7 && r.Status != "planning" {
			o.DeparturesThisWeek++
		}
		if r.Status == "at_risk" || r.Risk >= 40 && r.Status != "completed" {
			o.AtRisk++
		}
	}
	pending := map[string]bool{}
	replied := 0
	for _, b := range bookings {
		if b.Status == "requested" {
			pending[b.TripID+":"+b.VendorID] = true
		} else {
			replied++
		}
	}
	for _, i := range incidents {
		if i.Status != domain.IncResolved {
			o.OpenIncidents++
		}
	}
	o.Bookings = len(bookings)
	o.PendingVendors = len(pending)
	o.ReplyRate = 100
	if len(bookings) > 0 {
		o.ReplyRate = Round(float64(replied) / float64(len(bookings)) * 100)
	}
	return o
}

type IncidentPreset struct {
	Title    string
	Detail   string
	Severity int
}

func (e *Engine) IncidentPreset(t *domain.Trip, kind string, day int, delayMin *int, place string) IncidentPreset {
	destName := t.DestinationID
	if d := e.Cat.Destination(t.DestinationID); d != nil {
		destName = d.Name
	}
	delay := func(def int) int {
		if delayMin != nil {
			return *delayMin
		}
		return def
	}
	pl, plLower := place, place
	if pl == "" {
		pl, plLower = "Attraction", "The attraction"
	}
	switch kind {
	case domain.IncWeather:
		return IncidentPreset{"Heavy rain forecast", fmt.Sprintf("Open-Meteo: 42 mm rain and 45 km/h gusts over %s on Day %d. IMD orange alert.", destName, day), 4}
	case domain.IncFlightDelay:
		h := Round(float64(delay(180)) / 60)
		return IncidentPreset{fmt.Sprintf("Flight delayed %dh", h), fmt.Sprintf("Inbound flight now lands %d hours late.", h), 3}
	case domain.IncVendorUnavailable:
		return IncidentPreset{"Vendor unavailable", "A vendor cancelled their booking.", 4}
	case domain.IncTravelerRequest:
		return IncidentPreset{"Traveler asked for a change", "Traveler wants an easier day.", 2}
	case domain.IncClosure:
		return IncidentPreset{pl + " closed", plLower + " is closed today.", 4}
	case domain.IncRunningLate:
		return IncidentPreset{fmt.Sprintf("Group running %d min late", delay(45)), "Early warning from the live location check.", 3}
	case domain.IncCrowdReport:
		if place == "" {
			pl = "attraction"
		}
		return IncidentPreset{"Crowd report · " + pl, "Verified crowd report from a guide.", 2}
	case domain.IncHealth:
		return IncidentPreset{"Traveler not feeling well", "Traveler reported feeling unwell in the trip chat.", 3}
	}
	return IncidentPreset{"Trip issue", "", 3}
}

func DefaultDelay(kind string) *int {
	switch kind {
	case domain.IncFlightDelay:
		return ptr(180)
	case domain.IncRunningLate:
		return ptr(45)
	}
	return nil
}

// DefaultDisruptionDay picks the day a "tomorrow" event should hit (always a day with plans).
func DefaultDisruptionDay(t *domain.Trip, kind string) int {
	last := t.Prefs.Days()
	if kind == domain.IncFlightDelay {
		return 1
	}
	start := 2
	if t.Status == domain.TripLive {
		cur := 1
		if t.CurrentDay != nil {
			cur = *t.CurrentDay
		}
		start = min(last-1, cur+1)
	}
	for d := max(2, start); d < last; d++ {
		for _, a := range DayItems(t.Items, d) {
			if a.Kind == "activity" && (kind != domain.IncWeather || a.Outdoor) {
				return d
			}
		}
	}
	return max(1, min(start, last))
}

type Scenario struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Question      string `json:"question"`
	DestinationID string `json:"destinationId"`
	Kind          string `json:"kind"`
	Emoji         string `json:"emoji"`
	When          string `json:"when"`
	Place         string `json:"place,omitempty"`
	VendorID      string `json:"vendorId,omitempty"`
	DelayMin      *int   `json:"delayMin,omitempty"`
}

var Scenarios = []Scenario{
	{ID: "rain-coorg", Title: "Heavy rain in Coorg", Question: "What if heavy rain hits Coorg tomorrow?", DestinationID: "coorg", Kind: domain.IncWeather, Emoji: "🌧", When: "tomorrow"},
	{ID: "ropeway-closed", Title: "Abbey Falls shut", Question: "What if Abbey Falls closes tomorrow?", DestinationID: "coorg", Kind: domain.IncClosure, Emoji: "🌊", When: "tomorrow", Place: "Abbey Falls"},
	{ID: "cabs-down", Title: "Kodagu Cabs unavailable", Question: "What if Kodagu Cabs can't serve any trips?", DestinationID: "coorg", Kind: domain.IncVendorUnavailable, Emoji: "🚕", When: "tomorrow", VendorID: "v-coo-cabs"},
	{ID: "rain-gokarna", Title: "High swell in Gokarna", Question: "What if rough seas hit Gokarna tomorrow?", DestinationID: "gokarna", Kind: domain.IncWeather, Emoji: "⛈", When: "tomorrow"},
	{ID: "blr-flight", Title: "Bengaluru flights delayed", Question: "What if Bengaluru flights land 3 hours late?", DestinationID: "bengaluru", Kind: domain.IncFlightDelay, Emoji: "✈", When: "today", DelayMin: ptr(180)},
	{ID: "dandeli-river", Title: "Rafting suspended", Question: "What if Kali dam discharge stops Dandeli rafting?", DestinationID: "dandeli", Kind: domain.IncClosure, Emoji: "🌊", When: "tomorrow", Place: "Kali River"},
}

func FindScenario(id string) *Scenario {
	for i := range Scenarios {
		if Scenarios[i].ID == id {
			return &Scenarios[i]
		}
	}
	return nil
}

// WhatIfLevels counts the tour's items on each level of the Change Impact Map.
type WhatIfLevels struct {
	Safe         int `json:"safe"`
	Moves        int `json:"moves"`
	AtRisk       int `json:"atRisk"`
	CannotHappen int `json:"cannotHappen"`
}

func (l *WhatIfLevels) add(o WhatIfLevels) {
	l.Safe += o.Safe
	l.Moves += o.Moves
	l.AtRisk += o.AtRisk
	l.CannotHappen += o.CannotHappen
}

// WhatIfItem is one plan item on the simulated Change Impact Map.
type WhatIfItem struct {
	ItemID     string `json:"itemId"`
	Title      string `json:"title"`
	Day        int    `json:"day"`
	StartMin   int    `json:"startMin"`
	Level      string `json:"level"`
	Reason     string `json:"reason"`
	CostAtRisk int    `json:"costAtRisk"`
}

type WhatIfTour struct {
	Trip          *domain.Trip `json:"trip"`
	Day           int          `json:"day"`
	AffectedItems int          `json:"affectedItems"`
	MoneyAtRisk   int          `json:"moneyAtRisk"`
	Travelers     int          `json:"travelers"`
	AutoFixable   bool         `json:"autoFixable"`
	BestPlan      string       `json:"bestPlan"`
	// Breakdown of the same impact analysis and recommended plan (added for the operator What-If page).
	Levels       WhatIfLevels `json:"levels"`
	MinutesLost  int          `json:"minutesLost"`
	HeartsAtRisk int          `json:"heartsAtRisk"`
	BestStrategy string       `json:"bestStrategy"`
	FixCost      int          `json:"fixCost"`
	FixTimeMin   int          `json:"fixTimeMin"`
	Items        []WhatIfItem `json:"items"`
}

type WhatIfTotals struct {
	Tours       int          `json:"tours"`
	Travelers   int          `json:"travelers"`
	MoneyAtRisk int          `json:"moneyAtRisk"`
	Activities  int          `json:"activities"`
	AutoFixable int          `json:"autoFixable"`
	Levels      WhatIfLevels `json:"levels"`
	MinutesLost int          `json:"minutesLost"`
	FixCost     int          `json:"fixCost"`
}

type WhatIfResult struct {
	Scenario Scenario     `json:"scenario"`
	Tours    []WhatIfTour `json:"tours"`
	Totals   WhatIfTotals `json:"totals"`
}

// WhatIf simulates a scenario on every matching tour without touching real data.
func (e *Engine) WhatIf(s Scenario, trips []*domain.Trip) WhatIfResult {
	offset := 1
	if s.When == "today" {
		offset = 0
	}
	target := AddDays(e.Today(), offset)
	res := WhatIfResult{Scenario: s, Tours: []WhatIfTour{}}
	for _, t := range trips {
		if t.DestinationID != s.DestinationID || t.Status == domain.TripDraft || t.Status == domain.TripCompleted {
			continue
		}
		offsetDay := DaysBetween(t.Prefs.StartDate, target) + 1
		inRange := offsetDay >= 1 && offsetDay <= t.Prefs.Days()
		day := DefaultDisruptionDay(t, s.Kind)
		if s.Kind == domain.IncFlightDelay {
			day = 1
		} else if inRange {
			day = offsetDay
		}
		if s.Kind == domain.IncFlightDelay && DaysBetween(t.Prefs.StartDate, target) != 0 && t.Status != domain.TripLive {
			continue
		}
		if !inRange && t.Status == domain.TripLive && s.Kind != domain.IncVendorUnavailable {
			continue
		}
		inc := &domain.Incident{ID: "sim-" + t.ID, TripID: t.ID, Kind: s.Kind, Title: s.Title, Detail: s.Question, Day: day, Severity: 4, Source: "simulator", Status: domain.IncOpen, DelayMin: s.DelayMin, Place: s.Place, VendorID: s.VendorID}
		impact := e.AnalyzeImpact(t, inc)
		affected, moved, notSafe := 0, false, 0
		var levels WhatIfLevels
		items := make([]WhatIfItem, 0, len(impact.Items))
		for _, i := range impact.Items {
			switch i.Level {
			case domain.LevelCannotHappen, domain.LevelAtRisk:
				affected++
			case domain.LevelMoves:
				moved = true
			}
			if i.Level != domain.LevelSafe {
				notSafe++
			}
			switch i.Level {
			case domain.LevelSafe:
				levels.Safe++
			case domain.LevelMoves:
				levels.Moves++
			case domain.LevelAtRisk:
				levels.AtRisk++
			case domain.LevelCannotHappen:
				levels.CannotHappen++
			}
			wi := WhatIfItem{ItemID: i.ItemID, Level: i.Level, Reason: i.Reason, CostAtRisk: i.CostAtRisk}
			if it := t.Item(i.ItemID); it != nil {
				wi.Title, wi.Day, wi.StartMin = it.Title, it.Day, it.StartMin
			}
			items = append(items, wi)
		}
		if affected == 0 && !moved {
			continue
		}
		plans := e.MakeFixPlans(t, inc, impact)
		best := plans[1]
		for _, p := range plans {
			if p.Recommended {
				best = p
			}
		}
		res.Tours = append(res.Tours, WhatIfTour{
			Trip: t, Day: day, AffectedItems: notSafe, MoneyAtRisk: impact.MoneyAtRisk, Travelers: t.Prefs.Travelers(),
			AutoFixable: best.CostDelta <= 1500 && best.HeartsKept == best.HeartsTotal,
			BestPlan:    best.Title + " · " + RupeesSigned(best.CostDelta),
			Levels:      levels, MinutesLost: impact.MinutesLost, HeartsAtRisk: impact.HeartsAtRisk,
			BestStrategy: best.Strategy, FixCost: best.CostDelta, FixTimeMin: best.TimeDeltaMin, Items: items,
		})
	}
	for _, t := range res.Tours {
		res.Totals.Tours++
		res.Totals.Travelers += t.Travelers
		res.Totals.MoneyAtRisk += t.MoneyAtRisk
		res.Totals.Activities += t.AffectedItems
		res.Totals.Levels.add(t.Levels)
		res.Totals.MinutesLost += t.MinutesLost
		res.Totals.FixCost += t.FixCost
		if t.AutoFixable {
			res.Totals.AutoFixable++
		}
	}
	return res
}

type RequestDraft struct {
	VendorID  string
	Original  string
	Proposed  string
	ItemTitle string
	DateLabel string
}

func (e *Engine) describeAction(t *domain.Trip, a domain.FixAction, vendor string) (title, original, proposed string) {
	it := t.Item(a.ItemID)
	guests := t.Prefs.Travelers()
	date := ""
	if it != nil {
		date = DayDate(t.Prefs.StartDate, it.Day)
	}
	switch {
	case a.Type == "shift" && it != nil:
		to := it.StartMin
		if a.ToStartMin != nil {
			to = *a.ToStartMin
		}
		return it.Title, fmt.Sprintf("%s, %s, %s", it.Title, date, MinToTime(it.StartMin)), fmt.Sprintf("%s, %s, %s", it.Title, date, MinToTime(to))
	case a.Type == "move" && it != nil:
		day, to := it.Day, it.StartMin
		if a.ToDay != nil {
			day = *a.ToDay
		}
		if a.ToStartMin != nil {
			to = *a.ToStartMin
		}
		return it.Title, fmt.Sprintf("%s, %s, %s · %d guests", it.Title, date, MinToTime(it.StartMin), guests), fmt.Sprintf("%s, %s · %d guests", DayDate(t.Prefs.StartDate, day), MinToTime(to), guests)
	case a.Type == "cancel" && it != nil:
		return it.Title, fmt.Sprintf("%s, %s, %s", it.Title, date, MinToTime(it.StartMin)), "Cancel · refund " + Rupees(-a.CostDelta)
	case (a.Type == "swap" || a.Type == "rebook") && vendor == a.NewVendorID && vendor != "":
		day, at := 1, 10*60
		if it != nil {
			day, at = it.Day, it.StartMin
		}
		if a.ToDay != nil {
			day = *a.ToDay
		}
		if a.ToStartMin != nil {
			at = *a.ToStartMin
		}
		if a.Type == "swap" && at < 630 {
			at = 630
		}
		return a.ToLabel, "New booking", fmt.Sprintf("%s, %s, %s · %d guests", strings.Split(a.ToLabel, " · ")[0], DayDate(t.Prefs.StartDate, day), MinToTime(at), guests)
	case it != nil:
		return it.Title, fmt.Sprintf("%s, %s, %s", it.Title, date, MinToTime(it.StartMin)), "Released, booking replaced by another partner"
	}
	return a.Label, a.FromLabel, a.ToLabel
}

// VendorRequests groups a plan's actions into one change request per vendor.
func (e *Engine) VendorRequests(t *domain.Trip, plan domain.FixPlan) []RequestDraft {
	idx := map[string]int{}
	var rows []RequestDraft
	var origs, props, titles [][]string
	for _, a := range plan.Actions {
		for _, v := range uniq([]string{a.VendorID, a.NewVendorID}) {
			if a.Type == "rebook" && v == a.VendorID {
				continue
			}
			title, o, p := e.describeAction(t, a, v)
			k, ok := idx[v]
			if !ok {
				k = len(rows)
				idx[v] = k
				rows = append(rows, RequestDraft{VendorID: v})
				origs, props, titles = append(origs, nil), append(props, nil), append(titles, nil)
			}
			origs[k] = append(origs[k], o)
			props[k] = append(props[k], p)
			titles[k] = append(titles[k], title)
		}
	}
	for k := range rows {
		rows[k].Original = strings.Join(origs[k], "\n")
		rows[k].Proposed = strings.Join(props[k], "\n")
		rows[k].ItemTitle = strings.Join(titles[k], " + ")
		if parts := strings.SplitN(props[k][0], ", ", 2); len(parts) == 2 {
			rows[k].DateLabel = strings.Split(parts[1], ",")[0]
		}
	}
	return rows
}

var (
	timeRe = regexp.MustCompile(`(\d{1,2}):(\d{2}) (AM|PM)`)
	dateRe = regexp.MustCompile(`(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`)
)

type RevenuePoint struct {
	Date    string `json:"date"`
	Revenue int    `json:"revenue"`
	Payouts int    `json:"payouts"`
	Refunds int    `json:"refunds"`
}

func RevenueSeries(ledger []domain.LedgerEntry, today string, days int, loc func(domain.LedgerEntry) string) []RevenuePoint {
	out := make([]RevenuePoint, days)
	for i := range out {
		date := AddDays(today, i-days+1)
		p := RevenuePoint{Date: date[5:]}
		for _, l := range ledger {
			if loc(l) != date {
				continue
			}
			switch l.Kind {
			case "payment", "adjustment":
				p.Revenue += l.Amount
			case "payout":
				p.Payouts += int(math.Abs(float64(l.Amount)))
			case "refund":
				p.Refunds += int(math.Abs(float64(l.Amount)))
			}
		}
		out[i] = p
	}
	return out
}
