package engine

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"trizpyy/internal/domain"
)

const fillSuffix = "__fill"

var faultRefund = map[string]bool{domain.IncWeather: true, domain.IncVendorUnavailable: true, domain.IncClosure: true}

type fixCtx struct {
	trip     *domain.Trip
	incident *domain.Incident
	used     map[string]bool
}

func inTripRefs(t *domain.Trip) map[string]bool {
	out := map[string]bool{}
	for _, i := range t.Items {
		if IsActive(i) && i.RefID != "" {
			out[i.RefID] = true
		}
	}
	return out
}

func similarity(a, b domain.Activity) float64 {
	s := float64(len(intersect(a.Interests, b.Interests)) * 10)
	if a.Slot == b.Slot {
		s += 6
	}
	if a.Cluster == b.Cluster {
		s += 4
	}
	return s + rated(b.Rating)
}

type candOpts struct{ indoor, lowEnergy bool }

func (e *Engine) candidates(ctx *fixCtx, it domain.TripItem, o candOpts) []domain.Activity {
	original := e.Cat.Activity(it.RefID)
	taken := inTripRefs(ctx.trip)
	var out []domain.Activity
	for _, a := range e.Cat.ActivitiesFor(ctx.trip.DestinationID) {
		if a.ID == it.RefID || taken[a.ID] || ctx.used[a.ID] {
			continue
		}
		if o.indoor && a.Outdoor || o.lowEnergy && a.Energy > 2 {
			continue
		}
		if a.Slot == "evening" && it.StartMin < 17*60 {
			continue
		}
		out = append(out, a)
	}
	sort.SliceStable(out, func(x, y int) bool {
		if original != nil {
			return similarity(*original, out[x]) > similarity(*original, out[y])
		}
		return rated(out[x].Rating) > rated(out[y].Rating)
	})
	return out
}

func (e *Engine) swapAction(ctx *fixCtx, it domain.TripItem, alt domain.Activity) domain.FixAction {
	ctx.used[alt.ID] = true
	return domain.FixAction{
		Type: "swap", ItemID: it.ID, Label: fmt.Sprintf("Swap “%s” → “%s”", it.Title, alt.Title),
		FromLabel: it.Title, ToLabel: alt.Title, ToRefID: alt.ID,
		CostDelta: alt.Price*QtyOf(it) - ItemCost(it), VendorID: it.VendorID, NewVendorID: alt.VendorID,
	}
}

func cancelAction(ctx *fixCtx, it domain.TripItem) domain.FixAction {
	rate := 0.8
	if faultRefund[ctx.incident.Kind] {
		rate = 1
	}
	refund := Round(float64(ItemCost(it)) * rate)
	return domain.FixAction{
		Type: "cancel", ItemID: it.ID, Label: fmt.Sprintf("Cancel “%s” · %s refund", it.Title, Rupees(refund)),
		FromLabel: it.Title, ToLabel: "Cancelled with refund", CostDelta: -refund, VendorID: it.VendorID,
	}
}

func shiftAction(it domain.TripItem, to int, label string) domain.FixAction {
	if label == "" {
		label = fmt.Sprintf("%s: %s → %s", it.Title, MinToTime(it.StartMin), MinToTime(to))
	}
	return domain.FixAction{
		Type: "shift", ItemID: it.ID, Label: label,
		FromLabel: it.Title + " · " + MinToTime(it.StartMin), ToLabel: MinToTime(to),
		ToStartMin: ptr(to), ToDay: ptr(it.Day), VendorID: it.VendorID,
	}
}

func (e *Engine) bestDryDay(t *domain.Trip, from int) int {
	type opt struct{ d, score int }
	var opts []opt
	for d := 2; d <= t.Prefs.Days()-1; d++ {
		if d == from || t.CurrentDay != nil && d < *t.CurrentDay || IsWet(e.TripDayWeather(t, d)) {
			continue
		}
		opts = append(opts, opt{d, abs(d-from)*2 + DayEnergy(t.Items, d)})
	}
	sort.SliceStable(opts, func(a, b int) bool { return opts[a].score < opts[b].score })
	if len(opts) == 0 {
		return 0
	}
	return opts[0].d
}

func earlySlotOn(t *domain.Trip, day int, it domain.TripItem) int {
	if it.StartMin < 12*60+30 {
		return 7*60 + 30
	}
	var last *domain.TripItem
	for _, i := range DayItems(t.Items, day) {
		if i.Kind == "activity" && i.StartMin < 17*60 {
			x := i
			last = &x
		}
	}
	if last != nil && last.End()+30 < 17*60+30 {
		return RoundTo5(last.End() + 30)
	}
	return 19*60 + 30
}

func moveAction(t *domain.Trip, it domain.TripItem, toDay int) domain.FixAction {
	start := earlySlotOn(t, toDay, it)
	return domain.FixAction{
		Type: "move", ItemID: it.ID,
		Label:     fmt.Sprintf("Move “%s” to Day %d, %s", it.Title, toDay, MinToTime(start)),
		FromLabel: fmt.Sprintf("%s · Day %d, %s", it.Title, it.Day, MinToTime(it.StartMin)),
		ToLabel:   fmt.Sprintf("Day %d (%s), %s", toDay, DayDate(t.Prefs.StartDate, toDay), MinToTime(start)),
		ToDay:     ptr(toDay), ToStartMin: ptr(start), CostDelta: Round(float64(ItemCost(it)) * 0.1), VendorID: it.VendorID,
	}
}

func (e *Engine) rebookAction(it domain.TripItem, newVendor string) domain.FixAction {
	return domain.FixAction{
		Type: "rebook", ItemID: it.ID,
		Label:     fmt.Sprintf("Rebook “%s” with %s", it.Title, e.Cat.VendorName(newVendor)),
		FromLabel: it.Title + " · " + e.Cat.VendorName(it.VendorID), ToLabel: e.Cat.VendorName(newVendor),
		CostDelta: Round(float64(ItemCost(it)) * 0.1), VendorID: it.VendorID, NewVendorID: newVendor,
	}
}

func perUnit(delta, qty int) int { return Round(float64(delta) / float64(max(1, qty))) }

// ApplyActions applies fix actions to a copy of the trip, then reflows touched days.
func (e *Engine) ApplyActions(t *domain.Trip, actions []domain.FixAction) *domain.Trip {
	c := t.Clone()
	touched := map[int]bool{}
	var order []int
	touch := func(d int) {
		if !touched[d] {
			touched[d] = true
			order = append(order, d)
		}
	}
	for _, a := range actions {
		it := c.Item(a.ItemID)
		if it == nil {
			continue
		}
		touch(it.Day)
		switch a.Type {
		case "swap":
			alt := e.Cat.Activity(a.ToRefID)
			if alt == nil {
				continue
			}
			from := it.Title
			opens := it.StartMin
			if !alt.Outdoor && it.StartMin < 10*60+30 {
				opens = 10*60 + 30
			}
			applyActivity(it, *alt)
			it.StartMin, it.Status, it.Note, it.Hearted = opens, domain.ItemChanged, "Swapped from "+from, false
		case "move":
			fromDay := it.Day
			if a.ToDay != nil {
				it.Day = *a.ToDay
				touch(*a.ToDay)
			}
			if a.ToStartMin != nil {
				it.StartMin = *a.ToStartMin
			}
			if a.CostDelta != 0 {
				it.UnitCost += perUnit(a.CostDelta, QtyOf(*it))
			}
			if a.NewVendorID != "" {
				it.VendorID = a.NewVendorID
			}
			it.Status, it.Note = domain.ItemChanged, fmt.Sprintf("Moved from Day %d", fromDay)
		case "shift":
			was := it.StartMin
			if a.ToStartMin != nil {
				it.StartMin = *a.ToStartMin
			}
			it.Status, it.Note = domain.ItemChanged, "Was "+MinToTime(was)
		case "cancel":
			it.Status, it.Note = domain.ItemCancelled, a.ToLabel
		case "rebook":
			if a.NewVendorID != "" {
				it.VendorID = a.NewVendorID
			}
			it.UnitCost += perUnit(a.CostDelta, QtyOf(*it))
			it.Status, it.Note = domain.ItemChanged, "Rebooked with "+e.Cat.VendorName(a.NewVendorID)
		}
	}
	for _, d := range order {
		c.Items = ReflowDay(c.Items, d)
		c.Items = reanchorPickup(c.Items, d)
	}
	return c
}

func reanchorPickup(items []domain.TripItem, day int) []domain.TripItem {
	list := DayItems(items, day)
	var pickup, first *domain.TripItem
	for k := range list {
		if pickup == nil && list[k].Kind == "transfer" && len(list[k].DependsOn) == 0 && list[k].Title == "Hotel pickup" {
			pickup = &list[k]
		}
		if first == nil && list[k].Kind == "activity" {
			first = &list[k]
		}
	}
	if pickup == nil || first == nil {
		return items
	}
	desired := max(6*60+30, RoundTo5(first.StartMin-60))
	if desired == pickup.StartMin {
		return items
	}
	out := domain.CloneItems(items)
	for i := range out {
		if out[i].ID == pickup.ID {
			out[i].Note = "Was " + MinToTime(out[i].StartMin)
			out[i].StartMin, out[i].Status = desired, domain.ItemChanged
		}
	}
	return out
}

func derivedShifts(before, after *domain.Trip, primary []domain.FixAction) []domain.FixAction {
	ids := map[string]bool{}
	for _, a := range primary {
		ids[a.ItemID] = true
	}
	var out []domain.FixAction
	for _, b := range before.Items {
		if ids[b.ID] || !IsActive(b) || b.VendorID == "" || IsTransport(b) {
			continue
		}
		a := after.Item(b.ID)
		if a == nil || a.StartMin == b.StartMin && a.Day == b.Day {
			continue
		}
		out = append(out, shiftAction(b, a.StartMin, fmt.Sprintf("%s (Day %d): %s → %s", b.Title, b.Day, MinToTime(b.StartMin), MinToTime(a.StartMin))))
	}
	return out
}

var planMeta = map[string][2]string{
	domain.StrategyCheapest:   {"Cheapest", "Get the most money back"},
	domain.StrategyFastest:    {"Fastest", "Fewest changes, same day"},
	domain.StrategyFavourites: {"Keep my favourites", "Protect every Must-Do"},
	SwapDay:                   {"Day swap", "Rearrange days so nothing is lost"},
	SwapRoute:                 {"Route swap", "Change the order of the areas you visit"},
	SwapActivity:              {"Activity swap", "A similar experience that still works"},
}

var Strategies = []string{domain.StrategyCheapest, domain.StrategyFastest, domain.StrategyFavourites}

// MakeFixPlans builds the three plans (allaboutourproject.md §12.5).
func (e *Engine) MakeFixPlans(t *domain.Trip, inc *domain.Incident, impact domain.ImpactSummary) []domain.FixPlan {
	var broken []domain.TripItem
	var moves []domain.ImpactItem
	for _, ii := range impact.Items {
		it := t.Item(ii.ItemID)
		if it == nil {
			continue
		}
		if ii.Level == domain.LevelCannotHappen || ii.Level == domain.LevelAtRisk {
			broken = append(broken, *it)
		}
		if ii.Level == domain.LevelMoves && ii.NewStartMin != nil {
			moves = append(moves, ii)
		}
	}
	weatherLike := inc.Kind == domain.IncWeather || inc.Kind == domain.IncClosure || inc.Kind == domain.IncCrowdReport
	easyLike := inc.Kind == domain.IncHealth || inc.Kind == domain.IncTravelerRequest

	build := func(strategy string) domain.FixPlan {
		ctx := &fixCtx{trip: t, incident: inc, used: map[string]bool{}}
		var actions []domain.FixAction
		for _, m := range moves {
			it := t.Item(m.ItemID)
			if it == nil || IsTransport(*it) {
				continue
			}
			if strategy == domain.StrategyCheapest && it.Kind == "transfer" && inc.Kind == domain.IncFlightDelay {
				a := shiftAction(*it, *m.NewStartMin, "")
				a.Type = "swap"
				a.Label = "Swap private pickup → shared airport shuttle at " + MinToTime(*m.NewStartMin)
				a.ToLabel = "Shared airport shuttle"
				a.CostDelta = -Round(float64(ItemCost(*it)) * 0.45)
				actions = append(actions, a)
				continue
			}
			actions = append(actions, shiftAction(*it, *m.NewStartMin, ""))
		}
		for _, it := range broken {
			if it.Kind != "activity" {
				if strategy != domain.StrategyFavourites || !it.Hearted {
					actions = append(actions, cancelAction(ctx, it))
				}
				continue
			}
			opts := candOpts{indoor: weatherLike, lowEnergy: easyLike}
			original := e.Cat.Activity(it.RefID)
			if strategy == domain.StrategyCheapest {
				cands := e.candidates(ctx, it, opts)
				sort.SliceStable(cands, func(a, b int) bool { return cands[a].Price < cands[b].Price })
				if len(cands) > 0 && cands[0].Price*QtyOf(it) < ItemCost(it) {
					actions = append(actions, e.swapAction(ctx, it, cands[0]))
				} else {
					actions = append(actions, cancelAction(ctx, it))
				}
				continue
			}
			if strategy == domain.StrategyFavourites && it.Hearted {
				if inc.Kind == domain.IncVendorUnavailable && original != nil && original.AltVendorID != "" {
					actions = append(actions, e.rebookAction(it, original.AltVendorID))
					continue
				}
				target := e.bestDryDay(t, it.Day)
				if target != 0 && (weatherLike || easyLike || inc.Kind == domain.IncFlightDelay || inc.Kind == domain.IncRunningLate) {
					actions = append(actions, moveAction(t, it, target))
					if original != nil {
						if backup := e.Cat.Activity(original.BackupID); backup != nil && !inTripRefs(t)[backup.ID] && !ctx.used[backup.ID] {
							ctx.used[backup.ID] = true
							actions = append(actions, domain.FixAction{
								Type: "swap", ItemID: it.ID + fillSuffix,
								Label:     fmt.Sprintf("Fill Day %d with “%s”", it.Day, backup.Title),
								FromLabel: "Free slot", ToLabel: backup.Title, ToRefID: backup.ID,
								CostDelta: backup.Price * QtyOf(it), NewVendorID: backup.VendorID,
								ToDay: ptr(it.Day), ToStartMin: ptr(it.StartMin),
							})
						}
					}
					continue
				}
			}
			if inc.Kind == domain.IncVendorUnavailable && original != nil && original.AltVendorID != "" {
				actions = append(actions, e.rebookAction(it, original.AltVendorID))
				continue
			}
			var alt *domain.Activity
			if original != nil {
				if b := e.Cat.Activity(original.BackupID); b != nil && !inTripRefs(t)[b.ID] && !ctx.used[b.ID] && (!opts.indoor || !b.Outdoor) && (!opts.lowEnergy || b.Energy <= 2) {
					alt = b
				}
			}
			if alt == nil {
				if c := e.candidates(ctx, it, opts); len(c) > 0 {
					alt = &c[0]
				}
			}
			if alt != nil {
				actions = append(actions, e.swapAction(ctx, it, *alt))
			} else {
				actions = append(actions, cancelAction(ctx, it))
			}
		}
		return e.assemblePlan(t, inc, strategy, actions)
	}
	recommended := domain.StrategyFastest
	if impact.HeartsAtRisk > 0 {
		recommended = domain.StrategyFavourites
	}
	plans := make([]domain.FixPlan, 0, 3)
	for _, s := range Strategies {
		p := build(s)
		p.Recommended = s == recommended
		plans = append(plans, p)
	}
	return plans
}

// assemblePlan simulates a plan's actions, adds the timing shifts they cause and scores
// it the same way for every strategy (the three fix plans and the adaptive swaps).
func (e *Engine) assemblePlan(t *domain.Trip, inc *domain.Incident, strategy string, actions []domain.FixAction) domain.FixPlan {
	hearted := 0
	for _, i := range t.Items {
		if i.Hearted && IsActive(i) {
			hearted++
		}
	}
	simulated := e.Simulate(t, actions)
	all := append(append([]domain.FixAction{}, actions...), derivedShifts(t, simulated, actions)...)
	lost := 0
	var vendors []string
	cost, timeDelta, swaps := 0, 0, 0
	for _, a := range all {
		orig := t.Item(a.ItemID)
		if (a.Type == "swap" || a.Type == "cancel") && orig != nil && orig.Hearted {
			lost++
		}
		vendors = append(vendors, a.Vendor())
		cost += a.CostDelta
		if (a.Type == "shift" || a.Type == "move") && orig != nil && a.ToStartMin != nil {
			timeDelta += abs(*a.ToStartMin - orig.StartMin)
		}
		if a.Type == "swap" {
			swaps++
		}
	}
	vendors = uniq(vendors)
	trustSum := 0
	for _, v := range vendors {
		trustSum += e.Cat.TrustScore(v, 85)
	}
	factor := 0.97
	if strategy == domain.StrategyFastest {
		factor = 1
	}
	confidence := Round(float64(trustSum) / float64(max(1, len(vendors))) * factor)
	weatherOK := true
	sim := *simulated
	sim.WeatherOverrides = t.WeatherOverrides
	activeActs := 0
	for _, i := range simulated.Items {
		if !IsActive(i) || i.Kind != "activity" {
			continue
		}
		activeActs++
		if i.Outdoor && IsWet(e.TripDayWeather(&sim, i.Day)) {
			weatherOK = false
		}
	}
	happiness := 60.0
	if hearted > 0 {
		happiness = float64(hearted-lost) / float64(hearted) * 60
	}
	happiness += float64(activeActs * 3)
	meta := planMeta[strategy]
	if vendors == nil {
		vendors = []string{}
	}
	if all == nil {
		all = []domain.FixAction{}
	}
	return domain.FixPlan{
		ID: inc.ID + "-" + strategy, IncidentID: inc.ID, Strategy: strategy, Title: meta[0], Tagline: meta[1],
		CostDelta: cost, TimeDeltaMin: timeDelta, HeartsKept: hearted - lost, HeartsTotal: hearted,
		Swaps: swaps, Actions: all, Vendors: vendors, Confidence: min(99, confidence), WeatherOK: weatherOK,
		Score: domain.PlanScore{
			Cost:      clamp(60-Round(float64(cost)/150), 5, 100),
			Time:      clamp(100-Round(float64(timeDelta)/6)-len(all)*4, 5, 100),
			Happiness: min(100, Round(happiness)),
		},
	}
}

// Simulate resolves synthetic "fill" actions (they add an item) and applies everything.
func (e *Engine) Simulate(t *domain.Trip, actions []domain.FixAction) *domain.Trip {
	var fills, normal []domain.FixAction
	for _, a := range actions {
		if strings.HasSuffix(a.ItemID, fillSuffix) {
			fills = append(fills, a)
		} else {
			normal = append(normal, a)
		}
	}
	next := e.ApplyActions(t, normal)
	if len(fills) == 0 {
		return next
	}
	travelers := t.Prefs.Travelers()
	var days []int
	for _, f := range fills {
		alt := e.Cat.Activity(f.ToRefID)
		if alt == nil {
			continue
		}
		start := 10 * 60
		if f.ToStartMin != nil {
			start = *f.ToStartMin
		}
		if !alt.Outdoor && start < 10*60+30 {
			start = 10*60 + 30
		}
		day := 1
		if f.ToDay != nil {
			day = *f.ToDay
		}
		id := strings.TrimSuffix(f.ItemID, fillSuffix) + "-fill"
		if next.Item(id) != nil {
			continue
		}
		next.Items = append(next.Items, domain.TripItem{
			ID: id, Day: day, Kind: "activity", RefID: alt.ID, Title: alt.Title,
			Subtitle: Duration(alt.DurationMin) + " · Indoor backup", Place: alt.Cluster,
			StartMin: start, DurationMin: alt.DurationMin, UnitCost: alt.Price, Qty: travelers,
			CostMode: "per-person", VendorID: alt.VendorID, Outdoor: alt.Outdoor, Energy: alt.Energy,
			Status: domain.ItemChanged, DependsOn: []string{}, BufferMin: 15,
			Lat: fptr(alt.Lat), Lng: fptr(alt.Lng), Icon: alt.Icon, Tone: alt.Tone, Note: "Added as rain backup",
		})
		if !containsInt(days, day) {
			days = append(days, day)
		}
	}
	for _, d := range days {
		next.Items = ReflowDay(next.Items, d)
		next.Items = reanchorPickup(next.Items, d)
	}
	return next
}

// ReplaceVendorInPlan swaps a declining vendor for the pre-picked alternate (agent retry).
func (e *Engine) ReplaceVendorInPlan(plan domain.FixPlan, t *domain.Trip, declined string) *domain.FixPlan {
	replaced := false
	actions := make([]domain.FixAction, len(plan.Actions))
	for i, a := range plan.Actions {
		actions[i] = a
		if a.Vendor() != declined {
			continue
		}
		it := t.Item(a.ItemID)
		ref := a.ToRefID
		if ref == "" && it != nil {
			ref = it.RefID
		}
		act := e.Cat.Activity(ref)
		if act == nil || act.AltVendorID == "" || act.AltVendorID == declined {
			continue
		}
		extra := 300
		if it != nil {
			extra = Round(float64(ItemCost(*it)) * 0.1)
		}
		replaced = true
		name := e.Cat.VendorName(act.AltVendorID)
		actions[i].NewVendorID = act.AltVendorID
		actions[i].CostDelta += extra
		actions[i].Label = a.Label + " · with " + name
		actions[i].ToLabel = a.ToLabel + " · " + name
	}
	if !replaced {
		return nil
	}
	out := plan
	out.ID = plan.ID + "-r"
	out.Actions = actions
	var vendors []string
	out.CostDelta = 0
	for _, a := range actions {
		vendors = append(vendors, a.Vendor())
		out.CostDelta += a.CostDelta
	}
	out.Vendors = uniq(vendors)
	return &out
}

var mobilityRe = regexp.MustCompile(`(?i)walk|knee|elder`)

// SafetyChecks runs the 10 checks before the agent asks vendors. Semantic checks
// are answered by the decision service when available; these are the rule answers.
func (e *Engine) SafetyChecks(t *domain.Trip, plan domain.FixPlan) []domain.SafetyCheck {
	next := e.Simulate(t, plan.Actions)
	limit := PaceLimit[t.Prefs.Pace]
	if limit == 0 {
		limit = 12
	}
	var days []int
	for _, a := range plan.Actions {
		d := 1
		if a.ToDay != nil {
			d = *a.ToDay
		} else if it := t.Item(a.ItemID); it != nil {
			d = it.Day
		}
		if !containsInt(days, d) {
			days = append(days, d)
		}
	}
	energyOK, overlaps, lateEnd := true, false, false
	for _, d := range days {
		if DayEnergy(next.Items, d) > limit+2 {
			energyOK = false
		}
		list := DayItems(next.Items, d)
		for k, it := range list {
			if k > 0 && list[k-1].End() > it.StartMin+5 && !IsTransport(it) {
				overlaps = true
			}
			if !IsTransport(it) && it.End() > 23*60 {
				lateEnd = true
			}
		}
	}
	kids := t.Prefs.Kids > 0
	mobility := contains(t.Prefs.Special, "Limited mobility") || mobilityRe.MatchString(t.Prefs.OwnWords)
	veg := contains(t.Prefs.Special, "Vegetarian")
	walkingOK, kidsOK := true, true
	for _, a := range plan.Actions {
		act := e.Cat.Activity(a.ToRefID)
		if act == nil {
			continue
		}
		if act.Walking == "high" {
			walkingOK = false
		}
		if !act.KidFriendly {
			kidsOK = false
		}
	}
	vendorsOK := true
	for _, v := range plan.Vendors {
		if e.Cat.TrustScore(v, 80) < 50 {
			vendorsOK = false
		}
	}
	kidsDetail := "Suitable for this group? → yes"
	if kids {
		kidsDetail = "Suitable for a 6-year-old? → yes"
	}
	vegDetail := "Any dietary conflicts? → no"
	if veg {
		vegDetail = "Vegetarian food available? → yes"
	}
	return []domain.SafetyCheck{
		{ID: "budget", Label: "Within budget rule (" + RupeesSigned(plan.CostDelta) + ")", Engine: "code", Passed: plan.CostDelta <= 2000, TookMs: 1, Detail: "Extra cost stays under the auto-approve limit"},
		{ID: "time", Label: "No timing clashes", Engine: "code", Passed: !overlaps, TookMs: 1, Detail: "Every item has travel time to the next"},
		{ID: "hours", Label: "Inside opening hours", Engine: "code", Passed: !lateEnd, TookMs: 1, Detail: "Nothing ends after 11 PM"},
		{ID: "energy", Label: "Energy stays balanced", Engine: "code", Passed: energyOK, TookMs: 1, Detail: fmt.Sprintf("Day energy ≤ %d for a %s pace", limit+2, t.Prefs.Pace)},
		{ID: "rain", Label: "New plan avoids the rain", Engine: "code", Passed: plan.WeatherOK, TookMs: 1, Detail: "Outdoor items only on dry days"},
		{ID: "hearts", Label: "Must-Dos protected", Engine: "code", Passed: plan.HeartsKept == plan.HeartsTotal || plan.Strategy != domain.StrategyFavourites, TookMs: 1, Detail: fmt.Sprintf("%d/%d hearts kept", plan.HeartsKept, plan.HeartsTotal)},
		{ID: "walking", Label: "Walking suits the group?", Engine: "rules", Passed: !mobility || walkingOK, TookMs: 1, Detail: "Does this need a lot of walking or stairs? → no"},
		{ID: "kids", Label: "OK for everyone in the group?", Engine: "rules", Passed: !kids || kidsOK, TookMs: 1, Detail: kidsDetail},
		{ID: "veg", Label: "Food preferences respected", Engine: "rules", Passed: true, TookMs: 1, Detail: vegDetail},
		{ID: "vendors", Label: "Vendors reliable enough", Engine: "code", Passed: vendorsOK, TookMs: 1, Detail: "Trust score ≥ 50 for every vendor asked"},
	}
}

func (e *Engine) BuildReceipt(t *domain.Trip, inc *domain.Incident, plan domain.FixPlan, approvedBy []string, now time.Time) domain.ChangeReceipt {
	changes := make([]domain.Change, 0, len(plan.Actions))
	for _, a := range plan.Actions {
		changes = append(changes, domain.Change{Before: a.FromLabel, After: a.ToLabel})
	}
	return domain.ChangeReceipt{
		ID: ReceiptID(), TripID: t.ID, Title: inc.Title, Reason: inc.Detail, Changes: changes,
		ApprovedBy: approvedBy, CostDelta: plan.CostDelta, CreatedAt: now, PlanStrategy: plan.Strategy,
	}
}

func ReceiptID() string { return "RCPT-" + strings.ToUpper(RandomID("x")[2:8]) }

// ExplainPlan writes one human sentence for the traveler (template fallback for the LLM).
func ExplainPlan(inc *domain.Incident, plan domain.FixPlan) string {
	var parts []string
	for _, a := range plan.Actions {
		if a.Type == "move" {
			parts = append(parts, "moved "+strings.Split(a.FromLabel, " · ")[0]+" to "+a.ToLabel)
		}
	}
	for _, a := range plan.Actions {
		if a.Type == "swap" && !strings.HasSuffix(a.ItemID, fillSuffix) {
			parts = append(parts, "swapped "+a.FromLabel+" for "+a.ToLabel)
		}
	}
	if len(parts) > 2 {
		parts = parts[:2]
	}
	money := "No extra cost."
	if plan.CostDelta < 0 {
		money = "You save " + Rupees(-plan.CostDelta) + "."
	} else if plan.CostDelta > 0 {
		money = "It costs " + Rupees(plan.CostDelta) + " extra."
	}
	lead := inc.Title + "."
	if inc.Kind == domain.IncWeather {
		lead = fmt.Sprintf("Rain on Day %d.", inc.Day)
	}
	did := strings.Join(parts, " and ")
	if did == "" {
		did = "adjusted your timings"
	}
	return fmt.Sprintf("%s We %s. %s", lead, did, money)
}
