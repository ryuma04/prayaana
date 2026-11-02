package engine

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"trizpyy/internal/domain"
)

// Adaptive Swapping extends the Trip Fixer. When the Change Impact Map says an experience
// can't happen (or is at risk), the swap engine looks for a rearrangement before the
// traveler loses it:
//
//	Day swap      – exchange it with the experiences of another day
//	Route swap    – reorder the areas visited on two days (one hotel, so check-in/out stay put)
//	Activity swap – replace it with a similar catalog experience, ranked with the Travel DNA
//
// Every candidate is an ordinary FixPlan made of the existing move/swap actions, so it goes
// through the same safety checks, vendor confirmation, commit and undo as the three fix
// plans. Candidates are validated on the simulated trip: a failed hard constraint drops the
// candidate (it is listed under Rejected with the reason); soft preferences only rank.
// The engine reads the Travel DNA and never changes it.

const (
	SwapDay      = "day_swap"
	SwapRoute    = "route_swap"
	SwapActivity = "activity_swap"
)

// IsSwapStrategy reports whether a plan strategy comes from the swap engine.
func IsSwapStrategy(s string) bool { return s == SwapDay || s == SwapRoute || s == SwapActivity }

// SwapCheck is one hard constraint evaluated on the simulated trip.
type SwapCheck struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

// SwapComparison is the before/after a traveler sees for one candidate.
type SwapComparison struct {
	Original         string   `json:"original"`
	Proposed         string   `json:"proposed"`
	PriceBefore      int      `json:"priceBefore"`
	PriceAfter       int      `json:"priceAfter"`
	PriceDelta       int      `json:"priceDelta"`
	TimeDeltaMin     int      `json:"timeDeltaMin"`
	DistanceDeltaKm  float64  `json:"distanceDeltaKm"`
	WeatherBefore    string   `json:"weatherBefore"`
	WeatherAfter     string   `json:"weatherAfter"`
	DNAMatchBefore   int      `json:"dnaMatchBefore"`
	DNAMatchAfter    int      `json:"dnaMatchAfter"`
	AffectedItems    []string `json:"affectedItems"`
	AffectedBookings []string `json:"affectedBookings"`
	AffectedVendors  []string `json:"affectedVendors"`
	Risks            []string `json:"risks"`
}

// RouteStop is one day of the route: the area the day is spent in.
type RouteStop struct {
	Day     int     `json:"day"`
	Area    string  `json:"area"`
	Km      float64 `json:"km"`
	Minutes int     `json:"minutes"`
}

// RouteChange is the original and proposed order of areas for a route swap.
type RouteChange struct {
	Original      []RouteStop `json:"original"`
	Proposed      []RouteStop `json:"proposed"`
	KmBefore      float64     `json:"kmBefore"`
	KmAfter       float64     `json:"kmAfter"`
	MinutesBefore int         `json:"minutesBefore"`
	MinutesAfter  int         `json:"minutesAfter"`
	Hotel         string      `json:"hotel"`
	Dependencies  []string    `json:"dependencies"`
}

type SwapCandidate struct {
	// ID equals Plan.ID; start the agent with it as planId to apply this swap.
	ID         string               `json:"id"`
	Type       string               `json:"type"`
	ForItemID  string               `json:"forItemId"`
	Title      string               `json:"title"`
	Summary    string               `json:"summary"`
	Plan       domain.FixPlan       `json:"plan"`
	Comparison SwapComparison       `json:"comparison"`
	Route      *RouteChange         `json:"route,omitempty"`
	HardChecks []SwapCheck          `json:"hardChecks"`
	Safety     []domain.SafetyCheck `json:"safety"`
	Score      int                  `json:"score"`
	Reasons    []string             `json:"reasons"`
	// NeedsApproval: the swap costs more; the traveler must approve the extra explicitly.
	NeedsApproval  bool   `json:"needsApproval"`
	ApprovalReason string `json:"approvalReason,omitempty"`
	// RequiresAcceptance: never applied automatically (route swaps).
	RequiresAcceptance bool `json:"requiresAcceptance"`
}

// SwapRejection is a candidate that failed a hard constraint, kept so the choice is explainable.
type SwapRejection struct {
	Type      string   `json:"type"`
	ForItemID string   `json:"forItemId"`
	Label     string   `json:"label"`
	Reasons   []string `json:"reasons"`
}

type SwapReport struct {
	Day      []SwapCandidate `json:"day"`
	Route    []SwapCandidate `json:"route"`
	Activity []SwapCandidate `json:"activity"`
	Rejected []SwapRejection `json:"rejected"`
	// DNASource is "travel-dna" when the traveler's quiz DNA ranked the options,
	// "trip-preferences" when they have no DNA yet and the trip's interests were used.
	DNASource string `json:"dnaSource"`
	// SimilaritySource is "semantic" when the AI service's embeddings ranked activity swaps, else "tags".
	SimilaritySource string   `json:"similaritySource"`
	Notes            []string `json:"notes"`
}

// Find returns the candidate whose plan has this id.
func (r SwapReport) Find(planID string) *SwapCandidate {
	for _, list := range [][]SwapCandidate{r.Day, r.Route, r.Activity} {
		for i := range list {
			if list[i].ID == planID {
				return &list[i]
			}
		}
	}
	return nil
}

const (
	maxSwapCandidates = 4
	maxRejections     = 8
	// rebookFeeRate is the Trip Fixer's existing change fee for re-dating a vendor booking (see moveAction).
	rebookFeeRate = 0.1
)

var interestTrait = map[string]string{
	"adventure": "adventure", "nature": "nature", "culture": "culture", "food": "food",
	"luxury": "luxury", "social": "social", "relax": "luxury", "photo": "nature",
}

// DNAFit scores how well an experience suits a Travel DNA (0–100): mostly its strongest
// matching trait, partly the average of every trait its interests touch.
func DNAFit(a domain.Activity, dna domain.TravelDNA) int {
	t := traitsOf(dna.Traits)
	seen := map[string]bool{}
	sum, n, best := 0, 0, 0
	for _, in := range a.Interests {
		k, ok := interestTrait[in]
		if !ok || seen[k] {
			continue
		}
		seen[k] = true
		sum += t[k]
		n++
		best = max(best, t[k])
	}
	if n == 0 {
		return 50
	}
	return clamp(Round(float64(best)*0.6+float64(sum)/float64(n)*0.4), 0, 100)
}

// dnaDrivers names the traits behind a match ("Food + Culture").
func dnaDrivers(a domain.Activity, dna domain.TravelDNA) string {
	t := traitsOf(dna.Traits)
	var keys []string
	for _, in := range a.Interests {
		if k, ok := interestTrait[in]; ok && !contains(keys, k) && t[k] >= 60 {
			keys = append(keys, k)
		}
	}
	sort.SliceStable(keys, func(x, y int) bool { return t[keys[x]] > t[keys[y]] })
	labels := make([]string, 0, len(keys))
	for _, k := range first(keys, 2) {
		labels = append(labels, strings.ToUpper(traitLabel[k][:1])+traitLabel[k][1:])
	}
	return strings.Join(labels, " + ")
}

func hasDNA(d *domain.TravelDNA) bool {
	if d == nil {
		return false
	}
	x := d.Traits
	return x.Adventure+x.Nature+x.Culture+x.Food+x.Luxury+x.Social > 0
}

type swapScope struct {
	t        *domain.Trip
	inc      *domain.Incident
	dna      *domain.TravelDNA
	price    domain.PriceBreakdown
	booked   bool
	report   *SwapReport
	seenPlan map[string]bool
}

func (s *swapScope) fit(a domain.Activity) int {
	if hasDNA(s.dna) {
		return DNAFit(a, *s.dna)
	}
	return MatchPercent(a, s.t.Prefs)
}

func (s *swapScope) reject(kind, itemID, label string, reasons []string) {
	s.report.Rejected = append(s.report.Rejected, SwapRejection{Type: kind, ForItemID: itemID, Label: label, Reasons: reasons})
}

// AdaptiveSwaps proposes validated day, route and activity swaps for the items the
// incident breaks. dna may be nil (the trip's preferences are used instead).
func (e *Engine) AdaptiveSwaps(t *domain.Trip, inc *domain.Incident, impact domain.ImpactSummary, dna *domain.TravelDNA) SwapReport {
	report := SwapReport{Day: []SwapCandidate{}, Route: []SwapCandidate{}, Activity: []SwapCandidate{}, Rejected: []SwapRejection{}, Notes: []string{}, DNASource: "trip-preferences", SimilaritySource: "tags"}
	if hasDNA(dna) {
		report.DNASource = "travel-dna"
	}
	s := &swapScope{t: t, inc: inc, dna: dna, price: e.PriceTrip(t), booked: t.Status == domain.TripBooked || t.Status == domain.TripLive,
		report: &report, seenPlan: map[string]bool{}}

	var broken []domain.TripItem
	for _, ii := range impact.Items {
		if ii.Level != domain.LevelCannotHappen && ii.Level != domain.LevelAtRisk {
			continue
		}
		if it := t.Item(ii.ItemID); it != nil && it.Kind == "activity" && IsActive(*it) && it.Status != domain.ItemDone {
			broken = append(broken, *it)
		}
	}
	if len(broken) == 0 {
		report.Notes = append(report.Notes, "No experience is blocked by this problem, so nothing needs swapping.")
		return report
	}
	for _, x := range broken {
		report.Day = append(report.Day, e.daySwaps(s, x)...)
		report.Activity = append(report.Activity, e.activitySwaps(s, x)...)
	}
	report.Route = e.routeSwaps(s, broken)

	rank := func(list []SwapCandidate) []SwapCandidate {
		sort.SliceStable(list, func(a, b int) bool { return list[a].Score > list[b].Score })
		if len(list) > maxSwapCandidates {
			list = list[:maxSwapCandidates]
		}
		return list
	}
	report.Day, report.Route = rank(report.Day), rank(report.Route)
	// Activity swaps: best few per blocked item so every item gets a choice.
	per := map[string]int{}
	var acts []SwapCandidate
	sort.SliceStable(report.Activity, func(a, b int) bool { return report.Activity[a].Score > report.Activity[b].Score })
	for _, c := range report.Activity {
		if per[c.ForItemID] < maxSwapCandidates {
			per[c.ForItemID]++
			acts = append(acts, c)
		}
	}
	if acts == nil {
		acts = []SwapCandidate{}
	}
	report.Activity = acts
	// Keep a few rejections of each type so every kind of swap stays explainable.
	kept, seen := []SwapRejection{}, map[string]int{}
	for _, x := range report.Rejected {
		if seen[x.Type] < maxRejections {
			seen[x.Type]++
			kept = append(kept, x)
		}
	}
	report.Rejected = kept
	return report
}

// ── Shared validation ────────────────────────────────────────────────────────

func openDay(t *domain.Trip, d int) bool {
	return d >= 1 && d <= t.Prefs.Days() && (t.CurrentDay == nil || d >= *t.CurrentDay)
}

func movableItem(t *domain.Trip, it domain.TripItem) bool {
	return IsActive(it) && it.Status != domain.ItemDone && !lockedKind(it.Kind) && openDay(t, it.Day)
}

// OpeningWindow is the opening window of an experience (see windowFor).
func (e *Engine) OpeningWindow(it domain.TripItem) (int, int, bool) { return e.windowFor(it) }

// windowFor is the opening window of an experience. The catalog has no per-place opening
// hours, so this uses the engine's existing rules: the slot's end is closing time (as in the
// Change Impact Map) and evening-only experiences don't start before 5 PM.
func (e *Engine) windowFor(it domain.TripItem) (int, int, bool) {
	if it.Kind != "activity" {
		return 0, 0, false
	}
	open := 6 * 60
	if a := e.Cat.Activity(it.RefID); a != nil && a.Slot == "evening" {
		open = 17 * 60
	}
	return open, e.closingFor(it), true
}

type pair struct{ a, b string }

func clashes(items []domain.TripItem, day int) map[pair]bool {
	out := map[pair]bool{}
	list := DayItems(items, day)
	for k := 1; k < len(list); k++ {
		prev, it := list[k-1], list[k]
		if prev.End() > it.StartMin+5 {
			out[pair{prev.ID, it.ID}] = true
		}
	}
	return out
}

func depBreaks(items []domain.TripItem, day int) map[pair]bool {
	out := map[pair]bool{}
	byID := map[string]domain.TripItem{}
	for _, it := range DayItems(items, day) {
		byID[it.ID] = it
	}
	for _, it := range byID {
		for _, d := range it.DependsOn {
			if dep, ok := byID[d]; ok && it.StartMin < dep.End()-5 {
				out[pair{it.ID, d}] = true
			}
		}
	}
	return out
}

func lateEnds(items []domain.TripItem, day int) map[string]bool {
	out := map[string]bool{}
	for _, it := range DayItems(items, day) {
		if !IsTransport(it) && it.End() > 23*60 {
			out[it.ID] = true
		}
	}
	return out
}

// validate simulates the actions and checks every hard constraint. changed lists the
// items whose day, time or content the swap sets on purpose.
func (e *Engine) validate(s *swapScope, actions []domain.FixAction) (*domain.Trip, []SwapCheck, []string) {
	t, inc := s.t, s.inc
	after := e.Simulate(t, actions)
	after.WeatherOverrides = t.WeatherOverrides
	changed := map[string]bool{}
	days := map[int]bool{}
	cost := 0
	var fails []string
	var checks []SwapCheck
	add := func(id, label string, ok bool, detail string) {
		checks = append(checks, SwapCheck{ID: id, Label: label, Passed: ok, Detail: detail})
		if !ok {
			fails = append(fails, detail)
		}
	}

	bookingsOK, bookingWhy := true, "Only upcoming, not-yet-done plans move; travel legs and check-in/out stay fixed"
	for _, a := range actions {
		cost += a.CostDelta
		it := t.Item(a.ItemID)
		if it == nil {
			bookingsOK, bookingWhy = false, "An item in this swap is no longer in the plan"
			continue
		}
		changed[it.ID] = true
		days[it.Day] = true
		if !movableItem(t, *it) {
			bookingsOK, bookingWhy = false, fmt.Sprintf("“%s” is already done or fixed and can't change", it.Title)
		}
		if a.ToDay != nil {
			days[*a.ToDay] = true
			if !openDay(t, *a.ToDay) {
				bookingsOK, bookingWhy = false, fmt.Sprintf("Day %d has already passed", *a.ToDay)
			}
		}
	}
	add("bookings", "Existing bookings allow it", bookingsOK, bookingWhy)

	// Weather: every changed outdoor experience lands on a day without rain.
	weatherOK, weatherWhy := true, "Outdoor plans only land on dry days"
	for id := range changed {
		it := after.Item(id)
		if it == nil || !IsActive(*it) || it.Kind != "activity" || !it.Outdoor {
			continue
		}
		if f := e.TripDayWeather(after, it.Day); IsWet(f) {
			weatherOK, weatherWhy = false, fmt.Sprintf("“%s” is outdoors and Day %d has %s (%d%% rain)", it.Title, it.Day, strings.ToLower(ConditionLabel[f.Condition]), f.RainChance)
		}
	}
	add("weather", "Weather suits every moved plan", weatherOK, weatherWhy)

	// The same problem must not break the rearranged plan again.
	problemOK, problemWhy := true, "The problem no longer touches the new plan"
	for _, ii := range e.AnalyzeImpact(after, inc).Items {
		if changed[ii.ItemID] && (ii.Level == domain.LevelCannotHappen || ii.Level == domain.LevelAtRisk) {
			it := after.Item(ii.ItemID)
			problemOK, problemWhy = false, fmt.Sprintf("“%s” would still be affected: %s", it.Title, strings.ToLower(ii.Reason))
		}
	}
	add("problem", "Clear of the original problem", problemOK, problemWhy)

	hoursOK, hoursWhy := true, "Every moved experience starts after opening and ends before closing"
	for id := range changed {
		it := after.Item(id)
		if it == nil || !IsActive(*it) {
			continue
		}
		if open, close, ok := e.windowFor(*it); ok && (it.StartMin < open || it.End() > close) {
			hoursOK, hoursWhy = false, fmt.Sprintf("“%s” would run %s to %s, outside its %s to %s hours", it.Title, MinToTime(it.StartMin), MinToTime(it.End()), MinToTime(open), MinToTime(close))
		}
	}
	add("hours", "Inside opening hours", hoursOK, hoursWhy)

	// Timing, dependencies and energy: only new problems count, so a day that was
	// already tight in the original plan never blocks an unrelated swap.
	limit := PaceLimit[t.Prefs.Pace]
	if limit == 0 {
		limit = 12
	}
	timeOK, timeWhy := true, "No clashes, enough travel time, nothing runs past 11 PM or into a departure"
	depOK, depWhy := true, "Every item still follows what it depends on (pickups, check-in, travel legs)"
	energyOK, energyWhy := true, fmt.Sprintf("Day effort stays within %d for a %s pace", limit+2, t.Prefs.Pace)
	for d := range days {
		before, now := clashes(t.Items, d), clashes(after.Items, d)
		for p := range now {
			if !before[p] {
				a, b := after.Item(p.a), after.Item(p.b)
				timeOK, timeWhy = false, fmt.Sprintf("Day %d: “%s” would run into “%s”", d, a.Title, b.Title)
			}
		}
		lateBefore := lateEnds(t.Items, d)
		for id := range lateEnds(after.Items, d) {
			if !lateBefore[id] {
				timeOK, timeWhy = false, fmt.Sprintf("Day %d: “%s” would end after 11 PM", d, after.Item(id).Title)
			}
		}
		depBefore := depBreaks(t.Items, d)
		for p := range depBreaks(after.Items, d) {
			if !depBefore[p] {
				depOK, depWhy = false, fmt.Sprintf("Day %d: “%s” would start before “%s” finishes", d, after.Item(p.a).Title, after.Item(p.b).Title)
			}
		}
		if eb, ea := DayEnergy(t.Items, d), DayEnergy(after.Items, d); ea > limit+2 && ea > eb {
			energyOK, energyWhy = false, fmt.Sprintf("Day %d would be too tiring (effort %d, limit %d)", d, ea, limit+2)
		}
	}
	add("timing", "No time conflicts", timeOK, timeWhy)
	add("dependencies", "Dependencies and buffers hold", depOK, depWhy)
	add("energy", "Energy stays balanced", energyOK, energyWhy)

	vendorsOK, vendorWhy := true, "Every partner involved is taking bookings and reliable"
	for _, a := range actions {
		v := a.Vendor()
		if v == "" {
			continue
		}
		switch {
		case !e.Cat.Available(v):
			vendorsOK, vendorWhy = false, e.Cat.VendorName(v)+" has paused bookings"
		case inc.Kind == domain.IncVendorUnavailable && v == inc.VendorID:
			vendorsOK, vendorWhy = false, e.Cat.VendorName(v)+" is the partner that can't serve this trip"
		case e.Cat.TrustScore(v, 80) < 50:
			vendorsOK, vendorWhy = false, e.Cat.VendorName(v)+" is below the trust bar (score < 50)"
		}
	}
	add("vendors", "Vendors available", vendorsOK, vendorWhy)

	newPrice := e.PriceTrip(after)
	budgetOK, budgetWhy := true, "Stays within the trip budget"
	if cost > 0 && newPrice.Total > newPrice.Budget {
		budgetOK, budgetWhy = false, fmt.Sprintf("Adds %s and takes the trip over its %s budget", Rupees(cost), Rupees(newPrice.Budget))
	}
	add("budget", "Budget limit", budgetOK, budgetWhy)

	dupOK, dupWhy := true, "No experience appears twice"
	refs := map[string]bool{}
	for _, it := range after.Items {
		if IsActive(it) && it.Kind == "activity" && it.RefID != "" {
			if refs[it.RefID] {
				dupOK, dupWhy = false, fmt.Sprintf("“%s” is already in the plan", it.Title)
			}
			refs[it.RefID] = true
		}
	}
	add("duplicates", "No duplicate activity", dupOK, dupWhy)

	groupOK, groupWhy := true, "Suits everyone in the group"
	mobility := contains(t.Prefs.Special, "Limited mobility") || mobilityRe.MatchString(t.Prefs.OwnWords)
	for _, a := range actions {
		x := e.Cat.Activity(a.ToRefID)
		if x == nil || a.Type != "swap" {
			continue
		}
		if t.Prefs.Kids > 0 && !x.KidFriendly {
			groupOK, groupWhy = false, fmt.Sprintf("“%s” isn't suitable for kids", x.Title)
		}
		if mobility && x.Walking == "high" {
			groupOK, groupWhy = false, fmt.Sprintf("“%s” needs a lot of walking", x.Title)
		}
	}
	add("group", "Suits the group", groupOK, groupWhy)
	return after, checks, fails
}

// finish turns validated actions into a candidate, running the existing safety checks too.
// It returns false (and records a rejection) when a hard constraint or content safety check fails.
func (e *Engine) finish(s *swapScope, kind, itemID, key, label string, actions []domain.FixAction) (SwapCandidate, bool) {
	id := fmt.Sprintf("%s-%s-%s", s.inc.ID, kind, key)
	if s.seenPlan[id] {
		return SwapCandidate{}, false
	}
	s.seenPlan[id] = true
	after, checks, fails := e.validate(s, actions)
	plan := e.assemblePlan(s.t, s.inc, kind, actions)
	plan.ID = id
	safety := e.SafetyChecks(s.t, plan)
	for _, c := range safety {
		// Content checks decide; timing/energy/rain are already checked above against the
		// original plan, and the budget rule is the auto-approve limit (an approval, not a veto).
		if (c.ID == "walking" || c.ID == "kids" || c.ID == "vendors") && !c.Passed {
			fails = append(fails, "Safety check failed: "+c.Label)
		}
	}
	if len(fails) > 0 {
		s.reject(kind, itemID, label, uniq(fails))
		return SwapCandidate{}, false
	}
	c := SwapCandidate{ID: id, Type: kind, ForItemID: itemID, Plan: plan, HardChecks: checks, Safety: safety, Reasons: []string{}}
	c.Comparison = e.compare(s, after, plan)
	if plan.CostDelta > 0 {
		c.NeedsApproval = true
		c.ApprovalReason = fmt.Sprintf("Costs %s more. You need to approve the extra before we ask the vendors.", Rupees(plan.CostDelta))
	}
	return c, true
}

func (e *Engine) dayStats(items []domain.TripItem, day int, stayLat, stayLng float64, hasStay bool) (float64, int) {
	km := 0.0
	var prevLat, prevLng float64
	started := false
	if hasStay {
		prevLat, prevLng, started = stayLat, stayLng, true
	}
	for _, it := range DayItems(items, day) {
		if !it.HasPoint() || IsTransport(it) {
			continue
		}
		if started {
			km += HaversineKm(prevLat, prevLng, *it.Lat, *it.Lng)
		}
		prevLat, prevLng, started = *it.Lat, *it.Lng, true
	}
	if hasStay && started {
		km += HaversineKm(prevLat, prevLng, stayLat, stayLng)
	}
	mins := 0
	if km > 0.8 {
		mins = RoadMinutes(km)
	}
	return math.Round(km*10) / 10, mins
}

func (e *Engine) stayPoint(t *domain.Trip) (float64, float64, bool) {
	if st := e.Cat.Stay(t.StayID); st != nil {
		return st.Lat, st.Lng, true
	}
	return 0, 0, false
}

func wetOutdoor(e *Engine, t *domain.Trip, days []int) int {
	n := 0
	for _, d := range days {
		wet := IsWet(e.TripDayWeather(t, d))
		for _, it := range DayItems(t.Items, d) {
			if wet && it.Kind == "activity" && it.Outdoor {
				n++
			}
		}
	}
	return n
}

func weatherLine(n int) string {
	if n == 0 {
		return "No outdoor plans in the rain"
	}
	return fmt.Sprintf("%s in the rain", Plural(n, "outdoor plan"))
}

// compare builds the traveler-facing impact of a validated plan.
func (e *Engine) compare(s *swapScope, after *domain.Trip, plan domain.FixPlan) SwapComparison {
	t := s.t
	var days []int
	for _, a := range plan.Actions {
		if it := t.Item(a.ItemID); it != nil && !containsInt(days, it.Day) {
			days = append(days, it.Day)
		}
		if a.ToDay != nil && !containsInt(days, *a.ToDay) {
			days = append(days, *a.ToDay)
		}
	}
	sort.Ints(days)
	lat, lng, ok := e.stayPoint(t)
	kmB, kmA, minB, minA, durB, durA := 0.0, 0.0, 0, 0, 0, 0
	for _, d := range days {
		k, m := e.dayStats(t.Items, d, lat, lng, ok)
		kmB, minB = kmB+k, minB+m
		k, m = e.dayStats(after.Items, d, lat, lng, ok)
		kmA, minA = kmA+k, minA+m
		for _, it := range DayItems(t.Items, d) {
			if it.Kind == "activity" {
				durB += it.DurationMin
			}
		}
		for _, it := range DayItems(after.Items, d) {
			if it.Kind == "activity" {
				durA += it.DurationMin
			}
		}
	}
	newPrice := e.PriceTrip(after)
	c := SwapComparison{
		PriceBefore: s.price.Total, PriceAfter: newPrice.Total, PriceDelta: plan.CostDelta,
		TimeDeltaMin: (durA + minA) - (durB + minB), DistanceDeltaKm: math.Round((kmA-kmB)*10) / 10,
		WeatherBefore: weatherLine(wetOutdoor(e, t, days)), WeatherAfter: weatherLine(wetOutdoor(e, after, days)),
		AffectedItems: []string{}, AffectedBookings: []string{}, AffectedVendors: []string{}, Risks: []string{},
	}
	seen := map[string]bool{}
	for _, a := range plan.Actions {
		it := t.Item(a.ItemID)
		if it == nil || seen[it.ID] {
			continue
		}
		seen[it.ID] = true
		c.AffectedItems = append(c.AffectedItems, fmt.Sprintf("%s (Day %d)", it.Title, it.Day))
		if !s.booked {
			continue
		}
		switch {
		case a.Type == "swap" && a.NewVendorID != "":
			c.AffectedBookings = append(c.AffectedBookings, fmt.Sprintf("%s: cancel “%s”, new booking “%s”", e.Cat.VendorName(it.VendorID), it.Title, a.ToLabel))
		case it.VendorID != "" && (a.Type == "move" || a.Type == "shift"):
			to := it.Day
			if a.ToDay != nil {
				to = *a.ToDay
			}
			c.AffectedBookings = append(c.AffectedBookings, fmt.Sprintf("%s: “%s” re-dated to Day %d", e.Cat.VendorName(it.VendorID), it.Title, to))
		}
	}
	for _, v := range plan.Vendors {
		c.AffectedVendors = append(c.AffectedVendors, e.Cat.VendorName(v))
		if tr := e.Cat.TrustScore(v, 80); tr < 70 {
			c.Risks = append(c.Risks, fmt.Sprintf("%s has a modest trust score (%d)", e.Cat.VendorName(v), tr))
		}
	}
	for _, a := range plan.Actions {
		if it := t.Item(a.ItemID); it != nil && it.Hearted && a.Type == "move" {
			c.Risks = append(c.Risks, fmt.Sprintf("Must-Do “%s” moves to another day (kept, not lost)", it.Title))
		}
	}
	for _, d := range days {
		if f := e.TripDayWeather(after, d); !IsWet(f) && f.RainChance >= 45 {
			for _, it := range DayItems(after.Items, d) {
				if seen[it.ID] && it.Kind == "activity" && it.Outdoor {
					c.Risks = append(c.Risks, fmt.Sprintf("Day %d has a %d%% chance of rain for “%s”", d, f.RainChance, it.Title))
				}
			}
		}
	}
	if c.TimeDeltaMin > 45 {
		c.Risks = append(c.Risks, "Adds "+Duration(c.TimeDeltaMin)+" to those days")
	}
	return c
}

// ── Day swap ─────────────────────────────────────────────────────────────────

func dayMove(t *domain.Trip, it domain.TripItem, toDay, start int, fee bool) domain.FixAction {
	cost := 0
	if fee && it.VendorID != "" {
		cost = Round(float64(ItemCost(it)) * rebookFeeRate)
	}
	return domain.FixAction{
		Type: "move", ItemID: it.ID,
		Label:     fmt.Sprintf("Move “%s” to Day %d, %s", it.Title, toDay, MinToTime(start)),
		FromLabel: fmt.Sprintf("%s · Day %d, %s", it.Title, it.Day, MinToTime(it.StartMin)),
		ToLabel:   fmt.Sprintf("Day %d (%s), %s", toDay, DayDate(t.Prefs.StartDate, toDay), MinToTime(start)),
		ToDay:     ptr(toDay), ToStartMin: ptr(RoundTo5(start)), CostDelta: cost, VendorID: it.VendorID,
	}
}

func titles(items []domain.TripItem) string {
	names := make([]string, 0, len(items))
	for _, it := range items {
		names = append(names, it.Title)
	}
	return strings.Join(names, " + ")
}

func (e *Engine) daySwaps(s *swapScope, x domain.TripItem) []SwapCandidate {
	t := s.t
	if !movableItem(t, x) {
		return nil
	}
	var out []SwapCandidate
	for d2 := 1; d2 <= t.Prefs.Days(); d2++ {
		if d2 == x.Day || !openDay(t, d2) {
			continue
		}
		var ys []domain.TripItem
		for _, it := range DayItems(t.Items, d2) {
			if it.Kind == "activity" && movableItem(t, it) {
				ys = append(ys, it)
			}
		}
		if len(ys) == 0 {
			continue
		}
		groups := make([][]domain.TripItem, 0, len(ys)+1)
		for _, y := range ys {
			groups = append(groups, []domain.TripItem{y})
		}
		if len(ys) > 1 {
			groups = append(groups, ys)
		}
		for _, g := range groups {
			// Two placements: take over each other's time slots, or keep their own times.
			for _, keepTimes := range []bool{false, true} {
				actions := []domain.FixAction{}
				xStart := g[0].StartMin
				if keepTimes {
					xStart = x.StartMin
				}
				actions = append(actions, dayMove(t, x, d2, xStart, true))
				for _, y := range g {
					start := x.StartMin + (y.StartMin - g[0].StartMin)
					if keepTimes {
						start = y.StartMin
					}
					actions = append(actions, dayMove(t, y, x.Day, start, true))
				}
				// Same moves from both placements (e.g. equal start times) are one candidate.
				sig := make([]string, 0, len(actions))
				for _, a := range actions {
					sig = append(sig, fmt.Sprintf("%s>%d@%d", a.ItemID, *a.ToDay, *a.ToStartMin))
				}
				key := fmt.Sprintf("%s-d%d-%x", x.ID, d2, HashString(strings.Join(sig, ",")))
				label := fmt.Sprintf("Day %d “%s” ⇄ Day %d “%s”", x.Day, x.Title, d2, titles(g))
				c, ok := e.finish(s, SwapDay, x.ID, key, label, actions)
				if !ok {
					continue
				}
				c.Title = fmt.Sprintf("Swap Day %d and Day %d plans", x.Day, d2)
				c.Summary = fmt.Sprintf("Day %d → %s. Day %d → %s.", x.Day, titles(g), d2, x.Title)
				c.Comparison.Original = fmt.Sprintf("Day %d: %s · Day %d: %s", x.Day, x.Title, d2, titles(g))
				c.Comparison.Proposed = fmt.Sprintf("Day %d: %s · Day %d: %s", x.Day, titles(g), d2, x.Title)
				fit := 0
				if a := e.Cat.Activity(x.RefID); a != nil {
					fit = s.fit(*a)
				}
				c.Comparison.DNAMatchBefore, c.Comparison.DNAMatchAfter = fit, fit
				score := 80.0 - float64(len(g)-1)*6 - float64(c.Plan.CostDelta)/250 - float64(abs(d2-x.Day))*4
				c.Reasons = append(c.Reasons, fmt.Sprintf("Keeps “%s”, it moves to Day %d instead of being cancelled", x.Title, d2))
				if x.Hearted {
					score += 12
					c.Reasons = append(c.Reasons, "Protects a Must-Do")
				}
				if !keepTimes {
					score += 3
					c.Reasons = append(c.Reasons, "Each plan takes over the other's time slot")
				}
				if f := e.TripDayWeather(t, d2); !IsWet(f) && x.Outdoor {
					c.Reasons = append(c.Reasons, fmt.Sprintf("Day %d looks %s (%d%% rain)", d2, strings.ToLower(ConditionLabel[f.Condition]), f.RainChance))
				}
				c.Score = clamp(Round(score), 1, 99)
				out = append(out, c)
			}
		}
	}
	return out
}

// ── Route swap ───────────────────────────────────────────────────────────────

// dayArea is the area a day is spent in: the cluster most of its experiences are in.
func (e *Engine) dayArea(t *domain.Trip, d int) string {
	dest := e.Cat.Destination(t.DestinationID)
	count := map[string]int{}
	best, bestN := "", 0
	for _, it := range DayItems(t.Items, d) {
		if a := e.Cat.Activity(it.RefID); a != nil && it.Kind == "activity" {
			count[a.Cluster]++
			if count[a.Cluster] > bestN {
				best, bestN = a.Cluster, count[a.Cluster]
			}
		}
	}
	if dest != nil {
		if c := dest.ClusterByID(best); c != nil {
			return c.Name
		}
		return "Around " + dest.Name
	}
	return "Free day"
}

func (e *Engine) route(t *domain.Trip) ([]RouteStop, float64, int) {
	lat, lng, ok := e.stayPoint(t)
	var stops []RouteStop
	km, mins := 0.0, 0
	for d := 1; d <= t.Prefs.Days(); d++ {
		k, m := e.dayStats(t.Items, d, lat, lng, ok)
		stops = append(stops, RouteStop{Day: d, Area: e.dayArea(t, d), Km: k, Minutes: m})
		km, mins = km+k, mins+m
	}
	return stops, math.Round(km*10) / 10, mins
}

func routeLine(stops []RouteStop) string {
	parts := make([]string, 0, len(stops))
	for _, s := range stops {
		parts = append(parts, fmt.Sprintf("D%d %s", s.Day, s.Area))
	}
	return strings.Join(parts, " → ")
}

// routeSwaps exchanges the whole of the problem day with another middle day. Day 1 and
// the last day are tied to arrival, check-in, check-out and the journey home, so they never move.
func (e *Engine) routeSwaps(s *swapScope, broken []domain.TripItem) []SwapCandidate {
	t := s.t
	last := t.Prefs.Days()
	var problemDays []int
	for _, b := range broken {
		if !containsInt(problemDays, b.Day) {
			problemDays = append(problemDays, b.Day)
		}
	}
	sort.Ints(problemDays)
	var out []SwapCandidate
	orig, kmB, minB := e.route(t)
	for _, d := range problemDays {
		if d <= 1 || d >= last {
			s.report.Notes = append(s.report.Notes, fmt.Sprintf("Day %d is tied to hotel check-in/check-out and your travel legs, so its place in the route can't change.", d))
			continue
		}
		for d2 := 2; d2 < last; d2++ {
			if d2 == d || !openDay(t, d2) || !openDay(t, d) {
				continue
			}
			var actions []domain.FixAction
			var reasons []string
			for _, pairDays := range [][2]int{{d, d2}, {d2, d}} {
				for _, it := range DayItems(t.Items, pairDays[0]) {
					if lockedKind(it.Kind) {
						continue
					}
					if it.Status == domain.ItemDone {
						reasons = append(reasons, fmt.Sprintf("Day %d has started (“%s” is done)", pairDays[0], it.Title))
						continue
					}
					actions = append(actions, dayMove(t, it, pairDays[1], it.StartMin, it.Kind == "activity"))
				}
			}
			areaD, areaD2 := e.dayArea(t, d), e.dayArea(t, d2)
			label := fmt.Sprintf("Route: Day %d %s ⇄ Day %d %s", d, areaD, d2, areaD2)
			if len(reasons) > 0 {
				s.reject(SwapRoute, broken[0].ID, label, reasons)
				continue
			}
			c, ok := e.finish(s, SwapRoute, broken[0].ID, fmt.Sprintf("d%d-d%d", min(d, d2), max(d, d2)), label, actions)
			if !ok {
				continue
			}
			after := e.Simulate(t, c.Plan.Actions)
			after.WeatherOverrides = t.WeatherOverrides
			prop, kmA, minA := e.route(after)
			stay := "your stay"
			if st := e.Cat.Stay(t.StayID); st != nil {
				stay = st.Name
			}
			deps := []string{fmt.Sprintf("Day %d and Day %d cab pickups follow their new areas", d, d2), "Lunch bookings move with their area"}
			c.Route = &RouteChange{Original: orig, Proposed: prop, KmBefore: kmB, KmAfter: kmA, MinutesBefore: minB, MinutesAfter: minA,
				Hotel:        fmt.Sprintf("No hotel change, %s covers every night; Day 1 check-in and Day %d check-out stay fixed.", stay, last),
				Dependencies: deps}
			c.RequiresAcceptance = true
			c.Title = fmt.Sprintf("Visit %s on Day %d and %s on Day %d", areaD2, d, areaD, d2)
			c.Summary = "Changes the order of your days. Nothing is applied until you accept."
			c.Comparison.Original, c.Comparison.Proposed = routeLine(orig), routeLine(prop)
			if kmA == kmB {
				c.Reasons = append(c.Reasons, "Same total driving, every day starts and ends at your hotel")
			}
			// The same experiences, in a different order: the DNA match doesn't change.
			fit, n := 0, 0
			for _, it := range t.Items {
				if a := e.Cat.Activity(it.RefID); a != nil && it.Kind == "activity" && IsActive(it) && (it.Day == d || it.Day == d2) {
					fit += s.fit(*a)
					n++
				}
			}
			c.Comparison.DNAMatchBefore, c.Comparison.DNAMatchAfter = fit/max(1, n), fit/max(1, n)
			score := 70.0 - float64(c.Plan.CostDelta)/250 - float64(abs(d2-d))*4 - float64(kmA-kmB)*0.5
			c.Reasons = append(c.Reasons, fmt.Sprintf("Keeps every plan of Day %d and Day %d, only their order changes", d, d2))
			c.Score = clamp(Round(score), 1, 99)
			out = append(out, c)
		}
	}
	return out
}

// ── Activity swap ────────────────────────────────────────────────────────────

func jaccard(a, b []string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 0
	}
	inter := len(intersect(a, b))
	union := len(uniq(append(append([]string{}, a...), b...)))
	return float64(inter) / float64(max(1, union))
}

func (e *Engine) activitySwaps(s *swapScope, x domain.TripItem) []SwapCandidate {
	t, inc := s.t, s.inc
	if !movableItem(t, x) {
		return nil
	}
	orig := e.Cat.Activity(x.RefID)
	taken := inTripRefs(t)
	wet := IsWet(e.TripDayWeather(t, x.Day))
	easy := inc.Kind == domain.IncHealth || inc.Kind == domain.IncTravelerRequest
	mobility := contains(t.Prefs.Special, "Limited mobility") || mobilityRe.MatchString(t.Prefs.OwnWords)
	oLat, oLng := 0.0, 0.0
	if x.HasPoint() {
		oLat, oLng = *x.Lat, *x.Lng
	}
	origFit := 0
	if orig != nil {
		origFit = s.fit(*orig)
	}
	var out []SwapCandidate
	for _, a := range e.Cat.ActivitiesFor(t.DestinationID) {
		if a.ID == x.RefID {
			continue
		}
		label := fmt.Sprintf("“%s” instead of “%s”", a.Title, x.Title)
		var why []string
		if taken[a.ID] {
			why = append(why, "Already in your plan")
		}
		if !e.Cat.Available(a.VendorID) {
			why = append(why, e.Cat.VendorName(a.VendorID)+" has paused bookings")
		}
		if inc.Kind == domain.IncVendorUnavailable && a.VendorID == inc.VendorID {
			why = append(why, "Same partner that can't serve this trip")
		}
		if a.Slot == "evening" && x.StartMin < 17*60 {
			why = append(why, "Evening-only experience; this slot is during the day")
		}
		if wet && a.Outdoor {
			why = append(why, fmt.Sprintf("Outdoors, and Day %d is rainy", x.Day))
		}
		if easy && a.Energy > 2 {
			why = append(why, "Too strenuous for how the group feels")
		}
		if (inc.Kind == domain.IncClosure || inc.Kind == domain.IncCrowdReport) && inc.Place != "" &&
			(strings.Contains(strings.ToLower(a.Title), strings.ToLower(inc.Place)) || strings.Contains(strings.ToLower(a.Cluster), strings.ToLower(inc.Place))) {
			why = append(why, "At the place that is closed")
		}
		if t.Prefs.Kids > 0 && !a.KidFriendly {
			why = append(why, "Not suitable for kids")
		}
		if mobility && a.Walking == "high" {
			why = append(why, "Needs a lot of walking")
		}
		km := HaversineKm(oLat, oLng, a.Lat, a.Lng)
		if x.HasPoint() && RoadMinutes(km) > 120 {
			why = append(why, fmt.Sprintf("%.0f km away, over 2 hours by road", km))
		}
		if len(why) > 0 {
			s.reject(SwapActivity, x.ID, label, why)
			continue
		}
		action := domain.FixAction{
			Type: "swap", ItemID: x.ID, Label: fmt.Sprintf("Swap “%s” → “%s”", x.Title, a.Title),
			FromLabel: x.Title, ToLabel: a.Title, ToRefID: a.ID,
			CostDelta: a.Price*QtyOf(x) - ItemCost(x), VendorID: x.VendorID, NewVendorID: a.VendorID,
		}
		c, ok := e.finish(s, SwapActivity, x.ID, x.ID+"-"+a.ID, label, []domain.FixAction{action})
		if !ok {
			continue
		}
		fit := s.fit(a)
		c.Title = fmt.Sprintf("“%s” instead of “%s”", a.Title, x.Title)
		c.Summary = strings.TrimSpace(a.Description)
		c.Comparison.Original = fmt.Sprintf("%s · %s · %s", x.Title, Duration(x.DurationMin), Rupees(ItemCost(x)))
		c.Comparison.Proposed = fmt.Sprintf("%s · %s · %s", a.Title, Duration(a.DurationMin), Rupees(a.Price*QtyOf(x)))
		c.Comparison.DNAMatchBefore, c.Comparison.DNAMatchAfter = origFit, fit
		c.Comparison.DistanceDeltaKm = math.Round(km*10) / 10

		// Soft ranking, in the order the traveler cares about.
		var shared []string
		sim := 0.0
		if orig != nil {
			shared = intersect(orig.Interests, a.Interests)
			sim = jaccard(orig.Interests, a.Interests)
			// Embeddings from the AI service understand descriptions, not only tags.
			if sem, ok := e.Cat.Similarity(orig.ID, a.ID); ok {
				s.report.SimilaritySource = "semantic"
				sim = 0.4*sim + 0.6*math.Max(0, sem)
				if sem >= 0.5 {
					c.Reasons = append(c.Reasons, fmt.Sprintf("Similar experience by description (%d%%)", Round(sem*100)))
				}
			}
		}
		score := sim * 40
		if orig != nil && a.Slot == orig.Slot {
			score += 6
		}
		if orig != nil && a.Cluster == orig.Cluster {
			score += 4
		}
		score += float64(fit) * 0.3
		delta := c.Plan.Actions[0].CostDelta
		if delta <= 0 {
			score += 8
		} else {
			score -= math.Min(20, float64(delta)/100)
		}
		score -= float64(abs(a.DurationMin-x.DurationMin)) / 20
		score -= math.Min(km, 40) * 0.3
		score += float64(e.Cat.TrustScore(a.VendorID, 80)-75) / 5
		score += (rated(a.Rating) - 4.3) * 10
		c.Score = clamp(Round(score), 1, 99)

		if len(shared) > 0 {
			c.Reasons = append(c.Reasons, "Same kind of experience: "+strings.Join(labels(shared), ", "))
		}
		if s.report.DNASource == "travel-dna" {
			if drivers := dnaDrivers(a, *s.dna); drivers != "" {
				c.Reasons = append(c.Reasons, fmt.Sprintf("Strong match for your %s preferences (%d%%)", drivers, fit))
			} else {
				c.Reasons = append(c.Reasons, fmt.Sprintf("%d%% Travel DNA match", fit))
			}
		} else {
			c.Reasons = append(c.Reasons, fmt.Sprintf("%d%% match with your trip interests", fit))
		}
		if fit >= origFit {
			c.Reasons = append(c.Reasons, "As good a fit as the original, or better")
		}
		switch {
		case delta < 0:
			c.Reasons = append(c.Reasons, "Saves "+Rupees(-delta))
		case delta == 0:
			c.Reasons = append(c.Reasons, "Same price")
		default:
			c.NeedsApproval = true
			c.ApprovalReason = fmt.Sprintf("Original %s · alternative %s · extra cost %s. Approve the extra to continue.",
				Rupees(ItemCost(x)), Rupees(a.Price*QtyOf(x)), Rupees(delta))
		}
		if !a.Outdoor && wet {
			c.Reasons = append(c.Reasons, "Indoors, safe from the rain")
		}
		if km < 3 {
			c.Reasons = append(c.Reasons, "Close to the original spot")
		}
		out = append(out, c)
	}
	return out
}
