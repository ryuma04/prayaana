package engine

import (
	"fmt"
	"sort"

	"trizpyy/internal/domain"
)

type MoodInfo struct {
	ID    string `json:"id"`
	Emoji string `json:"emoji"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
}

var Moods = []MoodInfo{
	{"tired", "😴", "Tired", "Swap hard plans for easy ones + a rest break"},
	{"hungry", "🍴", "Hungry", "Find the best food stop nearby, now"},
	{"raining", "🌧", "Raining", "Move outdoor plans indoors"},
	{"late", "🏃", "Running late", "Shift the rest of today"},
	{"over_budget", "💰", "Over budget", "Cheaper swaps for the rest of the trip"},
	{"bored", "🥱", "Bored", "Add something more exciting"},
}

func ValidMood(m string) bool {
	for _, x := range Moods {
		if x.ID == m {
			return true
		}
	}
	return false
}

type MoodProposal struct {
	Mood         string         `json:"mood"`
	Plan         domain.FixPlan `json:"plan"`
	Headline     string         `json:"headline"`
	EnergyBefore int            `json:"energyBefore"`
	EnergyAfter  int            `json:"energyAfter"`
	Thinking     []string       `json:"thinking"`
	Trip         *domain.Trip   `json:"-"`
}

func swapTo(it domain.TripItem, alt domain.Activity) domain.FixAction {
	return domain.FixAction{
		Type: "swap", ItemID: it.ID, Label: fmt.Sprintf("Swap “%s” → “%s”", it.Title, alt.Title),
		FromLabel: it.Title, ToLabel: alt.Title, ToRefID: alt.ID,
		CostDelta: alt.Price*QtyOf(it) - ItemCost(it), VendorID: it.VendorID, NewVendorID: alt.VendorID,
	}
}

// MoodAdapt re-plans the rest of the day for a one-tap mood (Hero 6). The
// returned proposal carries the resulting trip so accepting is deterministic.
func (e *Engine) MoodAdapt(t *domain.Trip, mood string, day, nowMin int) MoodProposal {
	dest := e.Cat.Destination(t.DestinationID)
	var remaining []domain.TripItem
	for _, i := range DayItems(t.Items, day) {
		if i.End() > nowMin && !IsTransport(i) {
			remaining = append(remaining, i)
		}
	}
	taken := inTripRefs(t)
	used := map[string]bool{}
	var pool []domain.Activity
	for _, a := range e.Cat.ActivitiesFor(t.DestinationID) {
		if !taken[a.ID] {
			pool = append(pool, a)
		}
	}
	byRating := func(a, b domain.Activity) bool { return rated(a.Rating) > rated(b.Rating) }
	pickAlt := func(filter func(domain.Activity) bool, less func(a, b domain.Activity) bool) *domain.Activity {
		var list []domain.Activity
		for _, a := range pool {
			if !used[a.ID] && filter(a) {
				list = append(list, a)
			}
		}
		sort.SliceStable(list, func(x, y int) bool { return less(list[x], list[y]) })
		if len(list) == 0 {
			return nil
		}
		used[list[0].ID] = true
		return &list[0]
	}
	slotFits := func(a domain.Activity, it domain.TripItem) bool { return a.Slot != "evening" || it.StartMin >= 17*60 }
	var actions []domain.FixAction
	headline := ""
	thinking := []string{"Understanding how you feel…", "Checking the rest of today…"}

	switch mood {
	case "tired":
		for _, it := range remaining {
			if it.Kind == "activity" && it.Energy >= 3 && !it.Hearted {
				if alt := pickAlt(func(a domain.Activity) bool { return a.Energy <= 1 && slotFits(a, it) }, byRating); alt != nil {
					actions = append(actions, swapTo(it, *alt))
				}
			}
		}
		headline = "Added a rest break, today is already easy"
		if len(actions) > 0 {
			headline = "Swapped the hard stuff for something gentle, plus a rest break"
		}
		thinking = append(thinking, "Finding calm places nearby…", "Protecting your Must-Do items…")
	case "raining":
		for _, it := range remaining {
			if it.Kind != "activity" || !it.Outdoor || it.Hearted {
				continue
			}
			var alt *domain.Activity
			if orig := e.Cat.Activity(it.RefID); orig != nil {
				if b := e.Cat.Activity(orig.BackupID); b != nil && !taken[b.ID] && !used[b.ID] && !b.Outdoor {
					used[b.ID] = true
					alt = b
				}
			}
			if alt == nil {
				alt = pickAlt(func(a domain.Activity) bool { return !a.Outdoor }, byRating)
			}
			if alt != nil {
				actions = append(actions, swapTo(it, *alt))
			}
		}
		headline = "Everything left today is already indoors"
		if len(actions) > 0 {
			headline = "Moved today's outdoor plans indoors"
		}
		thinking = append(thinking, "Checking the radar…", "Finding covered places nearby…")
	case "late":
		for _, it := range remaining {
			if it.StartMin < nowMin {
				continue
			}
			to := RoundTo5(it.StartMin + 45)
			actions = append(actions, domain.FixAction{
				Type: "shift", ItemID: it.ID, Label: fmt.Sprintf("%s: %s → %s", it.Title, MinToTime(it.StartMin), MinToTime(it.StartMin+45)),
				FromLabel: it.Title + " · " + MinToTime(it.StartMin), ToLabel: MinToTime(it.StartMin + 45),
				ToStartMin: ptr(to), ToDay: ptr(day), VendorID: it.VendorID,
			})
		}
		headline = "Pushed the rest of today by 45 minutes and told every vendor"
		thinking = append(thinking, "Recalculating travel times…", "Asking vendors for later slots…")
	case "over_budget":
		var pricey []domain.TripItem
		for _, it := range t.Items {
			if it.Day >= day && it.Kind == "activity" && IsActive(it) && !it.Hearted && ItemCost(it) > 0 {
				pricey = append(pricey, it)
			}
		}
		sort.SliceStable(pricey, func(a, b int) bool { return ItemCost(pricey[a]) > ItemCost(pricey[b]) })
		if len(pricey) > 2 {
			pricey = pricey[:2]
		}
		for _, it := range pricey {
			if alt := pickAlt(func(a domain.Activity) bool {
				return float64(a.Price*QtyOf(it)) < float64(ItemCost(it))*0.5 && slotFits(a, it)
			}, byRating); alt != nil {
				actions = append(actions, swapTo(it, *alt))
			}
		}
		saved := 0
		for _, a := range actions {
			saved -= a.CostDelta
		}
		headline = "Your remaining plan is already the best value"
		if saved > 0 {
			headline = "Found cheaper swaps that save " + Rupees(saved)
		}
		thinking = append(thinking, "Scanning the rest of the trip…", "Keeping your Must-Dos untouched…")
	case "bored":
		var target *domain.TripItem
		for _, it := range remaining {
			if it.Kind == "activity" && !it.Hearted && (target == nil || it.Energy < target.Energy) {
				x := it
				target = &x
			}
		}
		if target != nil {
			tg := *target
			if alt := pickAlt(func(a domain.Activity) bool { return a.Energy >= 3 && rated(a.Rating) >= 4.5 && slotFits(a, tg) }, func(a, b domain.Activity) bool {
				if a.Energy != b.Energy {
					return a.Energy > b.Energy
				}
				return rated(a.Rating) > rated(b.Rating)
			}); alt != nil {
				actions = append(actions, swapTo(tg, *alt))
			}
		}
		headline = "Nothing to swap, try the Discover tab for extras"
		if len(actions) > 0 {
			headline = "Swapped in something with more buzz"
		}
		thinking = append(thinking, "Looking for top-rated thrills nearby…")
	case "hungry":
		if dest != nil {
			headline = "Booked a table at " + dest.Clusters[0].Lunch.Name + " in 20 minutes"
		}
		thinking = append(thinking, "Finding the best-rated food stop nearby…")
	}

	next := e.Simulate(t, actions)
	travelers := t.Prefs.Travelers()
	addItem := func(it domain.TripItem) {
		it.ID = fmt.Sprintf("%s-d%d-m%s", t.ID, day, RandomID("x")[2:8])
		it.Day, it.Qty, it.CostMode, it.Status = day, travelers, "per-person", domain.ItemChanged
		it.DependsOn, it.BufferMin = []string{}, 10
		if dest != nil {
			it.Place = dest.Name
		}
		next.Items = append(next.Items, it)
		switch it.Kind {
		case "rest":
			actions = append(actions, domain.FixAction{Type: "shift", ItemID: it.ID, Label: "Add a 1-hour rest break", FromLabel: "", ToLabel: "Rest break · " + MinToTime(it.StartMin)})
		case "meal":
			actions = append(actions, domain.FixAction{Type: "shift", ItemID: it.ID, Label: "Table at " + dest.Clusters[0].Lunch.Name, FromLabel: "", ToLabel: dest.Clusters[0].Lunch.Name + " · " + MinToTime(it.StartMin), CostDelta: it.UnitCost * travelers})
		}
	}
	if mood == "tired" {
		addItem(domain.TripItem{Kind: "rest", Title: "Rest break at your stay", Subtitle: "Feet up, chai on the way", StartMin: RoundTo5(max(nowMin+15, 14*60)), DurationMin: 60, Icon: "rest", Tone: "sky", Note: "Added: you were tired"})
	}
	if mood == "hungry" && dest != nil {
		lunch := dest.Clusters[0].Lunch
		addItem(domain.TripItem{Kind: "meal", Title: "Quick bite · " + lunch.Name, Subtitle: "Table held for 20 min", StartMin: RoundTo5(nowMin + 20), DurationMin: 45, UnitCost: lunch.PricePerPerson, Icon: "food", Tone: "sun", Note: "Added: you were hungry"})
	}

	hearts := 0
	for _, i := range t.Items {
		if i.Hearted {
			hearts++
		}
	}
	cost, swaps := 0, 0
	var vendors []string
	for _, a := range actions {
		cost += a.CostDelta
		if a.Type == "swap" {
			swaps++
		}
		vendors = append(vendors, a.Vendor())
	}
	label := mood
	for _, m := range Moods {
		if m.ID == mood {
			label = m.Label
		}
	}
	timeDelta := 0
	if mood == "late" {
		timeDelta = 45
	}
	vendors = uniq(vendors)
	if vendors == nil {
		vendors = []string{}
	}
	if actions == nil {
		actions = []domain.FixAction{}
	}
	thinking = append(thinking, "Replanning…")
	return MoodProposal{
		Mood: mood, Headline: headline, Thinking: thinking, Trip: next,
		EnergyBefore: DayEnergy(t.Items, day), EnergyAfter: DayEnergy(next.Items, day),
		Plan: domain.FixPlan{
			ID: "mood-" + mood + "-" + RandomID("x")[2:8], IncidentID: "mood-" + mood, Strategy: domain.StrategyFastest,
			Title: label, Tagline: headline, CostDelta: cost, TimeDeltaMin: timeDelta, HeartsKept: hearts, HeartsTotal: hearts,
			Swaps: swaps, Actions: actions, Vendors: vendors, Confidence: 94, WeatherOK: true,
			Score: domain.PlanScore{Cost: 70, Time: 80, Happiness: 85},
		},
	}
}
