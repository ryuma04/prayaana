package engine

import (
	"errors"
	"fmt"
	"math"
	"sort"

	"trizpyy/internal/domain"
)

const MaxHearts = 5

var (
	ErrItemNotFound = errors.New("That item is no longer in your plan.")
	ErrHeartsFull   = errors.New("All 5 Must-Do hearts are used. Remove one first.")
	ErrBadDay       = errors.New("That day is not part of this trip.")
	ErrLockedItem   = errors.New("Travel legs and check-in/out can't be removed or moved.")
)

func HeartsUsed(t *domain.Trip) int {
	n := 0
	for _, i := range t.Items {
		if i.Hearted && IsActive(i) {
			n++
		}
	}
	return n
}

func (e *Engine) ToggleHeart(t *domain.Trip, itemID string) (*domain.Trip, error) {
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	if !it.Hearted && HeartsUsed(c) >= MaxHearts {
		return nil, ErrHeartsFull
	}
	it.Hearted = !it.Hearted
	return c, nil
}

func lockedKind(k string) bool {
	return TransportKinds[k] || k == "checkin" || k == "checkout"
}

func (e *Engine) RemoveItem(t *domain.Trip, itemID string) (*domain.Trip, error) {
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	if lockedKind(it.Kind) {
		return nil, ErrLockedItem
	}
	items := make([]domain.TripItem, 0, len(c.Items))
	for _, i := range c.Items {
		if i.ID == itemID {
			continue
		}
		deps := i.DependsOn[:0]
		for _, d := range i.DependsOn {
			if d != itemID {
				deps = append(deps, d)
			}
		}
		i.DependsOn = deps
		items = append(items, i)
	}
	c.Items = items
	return c, nil
}

func validDay(t *domain.Trip, day int) bool { return day >= 1 && day <= t.Prefs.Days() }

func (e *Engine) MoveItem(t *domain.Trip, itemID string, toDay int) (*domain.Trip, error) {
	if !validDay(t, toDay) {
		return nil, ErrBadDay
	}
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	if lockedKind(it.Kind) {
		return nil, ErrLockedItem
	}
	if it.Day == toDay {
		return c, nil
	}
	var target []domain.TripItem
	for _, i := range DayItems(c.Items, toDay) {
		if !IsTransport(i) {
			target = append(target, i)
		}
	}
	start := it.StartMin
	if len(target) == 0 {
		start = max(it.StartMin, min(10*60+30, 19*60))
	} else {
		lastEnd, found := math.MinInt, false
		for _, i := range target {
			if i.StartMin < 20*60 {
				lastEnd, found = max(lastEnd, i.End()), true
			}
		}
		if found {
			start = max(it.StartMin, min(lastEnd+30, 19*60))
		}
	}
	it.Day, it.StartMin, it.DependsOn = toDay, start, []string{}
	c.Items = ReflowDay(c.Items, toDay)
	return c, nil
}

func (e *Engine) ChangeTime(t *domain.Trip, itemID string, startMin int) (*domain.Trip, error) {
	if startMin < 0 || startMin >= 24*60 {
		return nil, errors.New("Pick a time within the day.")
	}
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	it.StartMin = startMin
	c.Items = ReflowDay(c.Items, it.Day)
	return c, nil
}

func (e *Engine) ChangeQty(t *domain.Trip, itemID string, qty int) (*domain.Trip, error) {
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	it.Qty = clamp(qty, 1, max(1, c.Prefs.Travelers()))
	return c, nil
}

func (e *Engine) AddActivity(t *domain.Trip, a domain.Activity, day int) (*domain.Trip, error) {
	if !validDay(t, day) {
		return nil, ErrBadDay
	}
	if a.DestinationID != t.DestinationID {
		return nil, errors.New("That experience is in a different destination.")
	}
	c := t.Clone()
	preferred := SlotStart(a.Slot, c.Prefs.Rhythm)
	start := preferred
	for _, i := range DayItems(c.Items, day) {
		if IsTransport(i) {
			continue
		}
		if preferred < i.End() && preferred+a.DurationMin > i.StartMin {
			start = i.End() + 30
			break
		}
	}
	c.Items = append(c.Items, e.ItemFromActivity(a, day, start, c.Prefs.Travelers(), c.ID))
	c.Items = ReflowDay(c.Items, day)
	return c, nil
}

func applyActivity(it *domain.TripItem, a domain.Activity) {
	it.RefID = a.ID
	it.Title = a.Title
	it.Subtitle = activitySubtitle(a)
	it.DurationMin = a.DurationMin
	it.UnitCost = a.Price
	it.VendorID = a.VendorID
	it.Outdoor = a.Outdoor
	it.Energy = a.Energy
	it.Icon = a.Icon
	it.Tone = a.Tone
	it.Lat, it.Lng = fptr(a.Lat), fptr(a.Lng)
}

func (e *Engine) SwapActivity(t *domain.Trip, itemID string, a domain.Activity) (*domain.Trip, error) {
	c := t.Clone()
	it := c.Item(itemID)
	if it == nil {
		return nil, ErrItemNotFound
	}
	if it.Kind != "activity" {
		return nil, errors.New("Only experiences can be swapped.")
	}
	if a.DestinationID != t.DestinationID {
		return nil, errors.New("That experience is in a different destination.")
	}
	applyActivity(it, a)
	c.Items = ReflowDay(c.Items, it.Day)
	return c, nil
}

func (e *Engine) ChangeStay(t *domain.Trip, stayID string) (*domain.Trip, error) {
	s := e.Cat.Stay(stayID)
	if s == nil || s.DestinationID != t.DestinationID {
		return nil, errors.New("That stay isn't available for this destination.")
	}
	c := t.Clone()
	c.StayID = s.ID
	for i := range c.Items {
		it := &c.Items[i]
		switch it.Kind {
		case "checkin":
			it.RefID, it.Title = s.ID, "Check-in · "+s.Name
			it.Subtitle = fmt.Sprintf("%s · %d nights", s.Area, c.Prefs.Nights)
			it.VendorID, it.Lat, it.Lng = s.VendorID, fptr(s.Lat), fptr(s.Lng)
		case "checkout":
			it.RefID, it.Subtitle, it.VendorID = s.ID, s.Name, s.VendorID
			it.Lat, it.Lng = fptr(s.Lat), fptr(s.Lng)
		case "transfer":
			it.Lat, it.Lng = fptr(s.Lat), fptr(s.Lng)
			if it.Title == "Hotel pickup" {
				it.Place = s.Name
			}
		}
	}
	return c, nil
}

func (e *Engine) ChangeTransport(t *domain.Trip, transportID string) (*domain.Trip, error) {
	tr := e.Cat.TransportOption(transportID)
	if tr == nil || tr.DestinationID != t.DestinationID {
		return nil, errors.New("That transport isn't available for this destination.")
	}
	c := t.Clone()
	c.TransportID = tr.ID
	c.Prefs.Transport = tr.Mode
	for i := range c.Items {
		it := &c.Items[i]
		if !IsTransport(*it) {
			continue
		}
		outbound := it.Day == 1
		it.Kind, it.RefID, it.UnitCost, it.VendorID, it.Icon = tr.Mode, tr.ID, tr.PricePerPerson, tr.VendorID, tr.Mode
		if outbound {
			it.Title = tr.Label
			it.Subtitle = fmt.Sprintf("Departs %s · %s", MinToTime(TimeToMin(tr.Departs)), Duration(tr.DurationMin))
		} else {
			it.Title = "Return · " + ReverseRoute(tr.Label)
		}
	}
	return c, nil
}

func (e *Engine) SetTravelers(t *domain.Trip, adults, kids int) (*domain.Trip, error) {
	if adults < 1 || kids < 0 || adults+kids > 60 {
		return nil, errors.New("Travelers must be 1 to 60 with at least one adult.")
	}
	c := t.Clone()
	c.Prefs.Adults, c.Prefs.Kids = adults, kids
	for i := range c.Items {
		if c.Items[i].CostMode == "per-person" {
			c.Items[i].Qty = adults + kids
		}
	}
	return c, nil
}

func travelFor(items []domain.TripItem) int {
	total := 0
	for k := 1; k < len(items); k++ {
		a, b := items[k-1], items[k]
		if !a.HasPoint() || !b.HasPoint() {
			continue
		}
		total += RoadMinutes(HaversineKm(*a.Lat, *a.Lng, *b.Lat, *b.Lng))
	}
	return total
}

func distance(a, b domain.TripItem) float64 {
	if !a.HasPoint() || !b.HasPoint() {
		return 999
	}
	return HaversineKm(*a.Lat, *a.Lng, *b.Lat, *b.Lng)
}

type OptimizeResult struct {
	Trip         *domain.Trip `json:"trip"`
	SavedMin     int          `json:"savedMin"`
	MovedOutdoor int          `json:"movedOutdoor"`
}

// OptimizeTrip moves outdoor plans off wet days and orders each day nearest-next (quick §12.3).
func (e *Engine) OptimizeTrip(t *domain.Trip) OptimizeResult {
	c := t.Clone()
	items := c.Items
	saved, moved := 0, 0
	days := c.Prefs.Days()
	idx := func(id string) int {
		for i := range items {
			if items[i].ID == id {
				return i
			}
		}
		return -1
	}
	for d := 1; d <= days; d++ {
		if !IsWet(e.TripDayWeather(c, d)) {
			continue
		}
		for _, out := range DayItems(items, d) {
			if out.Kind != "activity" || !out.Outdoor || out.Hearted {
				continue
			}
			for d2 := 2; d2 < days; d2++ {
				if d2 == d || IsWet(e.TripDayWeather(c, d2)) {
					continue
				}
				var indoor *domain.TripItem
				for _, i := range DayItems(items, d2) {
					if i.Kind == "activity" && !i.Outdoor && abs(i.StartMin-out.StartMin) < 240 {
						in := i
						indoor = &in
						break
					}
				}
				if indoor == nil {
					continue
				}
				oi, ii := idx(out.ID), idx(indoor.ID)
				items[oi].Day, items[oi].StartMin = d2, indoor.StartMin
				items[ii].Day, items[ii].StartMin = d, out.StartMin
				moved++
				break
			}
		}
	}
	for d := 1; d <= days; d++ {
		list := DayItems(items, d)
		before := travelFor(list)
		var acts []domain.TripItem
		for _, i := range list {
			if i.Kind == "activity" && i.StartMin < 17*60 {
				acts = append(acts, i)
			}
		}
		if len(acts) >= 2 {
			times := make([]int, len(acts))
			for k, a := range acts {
				times[k] = a.StartMin
			}
			sort.Ints(times)
			anchor := list[0]
			for _, i := range list {
				if i.Kind == "transfer" {
					anchor = i
					break
				}
			}
			remaining := append([]domain.TripItem(nil), acts...)
			var ordered []domain.TripItem
			cur := anchor
			for len(remaining) > 0 {
				from := cur
				sort.SliceStable(remaining, func(a, b int) bool { return distance(from, remaining[a]) < distance(from, remaining[b]) })
				cur = remaining[0]
				ordered = append(ordered, cur)
				remaining = remaining[1:]
			}
			retimed := map[string]int{}
			for k, a := range ordered {
				retimed[a.ID] = times[k]
			}
			candidate := domain.CloneItems(items)
			for k := range candidate {
				if s, ok := retimed[candidate[k].ID]; ok {
					candidate[k].StartMin = s
				}
			}
			if after := travelFor(DayItems(candidate, d)); after < before {
				saved += before - after
				items = candidate
			}
		}
		items = ReflowDay(items, d)
	}
	c.Items = items
	c.Optimized = &domain.Optimized{SavedMin: saved, MovedOutdoor: moved}
	return OptimizeResult{Trip: c, SavedMin: saved, MovedOutdoor: moved}
}

type BudgetOptimization struct {
	Trip    *domain.Trip `json:"trip"`
	Changes []string     `json:"changes"`
	Saved   int          `json:"saved"`
}

// OptimizeBudget swaps stays, transport, and costly activities to cheaper catalog alternatives to fit within budget.
func (e *Engine) OptimizeBudget(t *domain.Trip) BudgetOptimization {
	initialPrice := e.PriceTrip(t)
	budgetCap := t.Prefs.Budget()
	current := t.Clone()
	var changes []string

	// 1. Optimize Stay if current stay is expensive
	stays := e.Cat.StaysFor(t.DestinationID)
	if len(stays) > 1 {
		sort.SliceStable(stays, func(i, j int) bool { return stays[i].NightlyPrice < stays[j].NightlyPrice })
		currentStay := e.Cat.Stay(current.StayID)
		for _, s := range stays {
			if currentStay != nil && s.NightlyPrice < currentStay.NightlyPrice {
				if next, err := e.ChangeStay(current, s.ID); err == nil {
					savedStay := (currentStay.NightlyPrice - s.NightlyPrice) * current.Prefs.Nights
					changes = append(changes, fmt.Sprintf("Swapped stay to %s (%s) saving ₹%d", s.Name, s.Type, savedStay))
					current = next
					break
				}
			}
		}
	}

	// 2. Optimize Transport if still over budget
	curPrice := e.PriceTrip(current)
	if curPrice.Total > budgetCap {
		transports := e.Cat.TransportFor(t.DestinationID)
		if len(transports) > 1 {
			sort.SliceStable(transports, func(i, j int) bool { return transports[i].PricePerPerson < transports[j].PricePerPerson })
			curTr := e.Cat.TransportOption(current.TransportID)
			for _, tr := range transports {
				if curTr != nil && tr.PricePerPerson < curTr.PricePerPerson {
					if next, err := e.ChangeTransport(current, tr.ID); err == nil {
						savedTr := (curTr.PricePerPerson - tr.PricePerPerson) * current.Prefs.Travelers() * 2
						changes = append(changes, fmt.Sprintf("Swapped transport to %s saving ₹%d", tr.Label, savedTr))
						current = next
						break
					}
				}
			}
		}
	}

	// 3. Optimize Activities if still over budget
	curPrice = e.PriceTrip(current)
	if curPrice.Total > budgetCap {
		allActs := e.Cat.ActivitiesFor(t.DestinationID)
		sort.SliceStable(allActs, func(i, j int) bool { return allActs[i].Price < allActs[j].Price })
		for i := range current.Items {
			it := &current.Items[i]
			if it.Kind == "activity" && it.UnitCost > 1500 {
				for _, alt := range allActs {
					if alt.Price < it.UnitCost {
						diff := (it.UnitCost - alt.Price) * it.Qty
						oldTitle := it.Title
						applyActivity(it, alt)
						changes = append(changes, fmt.Sprintf("Replaced %s with %s saving ₹%d", oldTitle, alt.Title, diff))
						break
					}
				}
				if e.PriceTrip(current).Total <= budgetCap {
					break
				}
			}
		}
	}

	finalPrice := e.PriceTrip(current)
	saved := initialPrice.Total - finalPrice.Total
	if saved < 0 {
		saved = 0
	}
	return BudgetOptimization{
		Trip:    current,
		Changes: changes,
		Saved:   saved,
	}
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
