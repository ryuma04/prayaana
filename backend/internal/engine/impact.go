package engine

import (
	"fmt"
	"sort"
	"strings"

	"trizpyy/internal/domain"
)

var levelRank = map[string]int{domain.LevelSafe: 0, domain.LevelMoves: 1, domain.LevelAtRisk: 2, domain.LevelCannotHappen: 3}

func (e *Engine) closingFor(it domain.TripItem) int {
	if it.Kind == "activity" && it.RefID != "" {
		slot := SlotOf(it.StartMin)
		if a := e.Cat.Activity(it.RefID); a != nil {
			slot = a.Slot
		}
		return SlotWindows[slot].End
	}
	if it.Kind == "meal" {
		if it.StartMin < 17*60 {
			return 16 * 60
		}
		return 23 * 60
	}
	return 24 * 60
}

func (e *Engine) levelForShift(it domain.TripItem, newStart int) string {
	if newStart <= it.StartMin {
		return domain.LevelSafe
	}
	if it.Kind == "transfer" || it.Kind == "checkin" || IsTransport(it) {
		return domain.LevelMoves
	}
	end := newStart + it.DurationMin
	close := e.closingFor(it)
	switch {
	case end <= close-30:
		return domain.LevelMoves
	case end <= close:
		return domain.LevelAtRisk
	}
	return domain.LevelCannotHappen
}

func matchesPlace(it domain.TripItem, place string) bool {
	if place == "" {
		return false
	}
	p := strings.ToLower(place)
	return strings.Contains(strings.ToLower(it.Place), p) || strings.Contains(strings.ToLower(it.Title), p)
}

func delayOf(inc *domain.Incident, fallback int) int {
	if inc.DelayMin != nil {
		return *inc.DelayMin
	}
	return fallback
}

// AnalyzeImpact follows the problem through the plan (allaboutourproject.md §12.4).
func (e *Engine) AnalyzeImpact(t *domain.Trip, inc *domain.Incident) domain.ImpactSummary {
	D := inc.Day
	out := map[string]*domain.ImpactItem{}
	var seq []string
	order := 1
	mark := func(it domain.TripItem, level, reason string, newStart *int, cause string) {
		prev := out[it.ID]
		if prev == nil {
			seq = append(seq, it.ID)
		}
		if prev != nil && levelRank[prev.Level] >= levelRank[level] {
			return
		}
		cost := 0
		if level == domain.LevelCannotHappen {
			cost = ItemCost(it)
		} else if level == domain.LevelAtRisk {
			cost = Round(float64(ItemCost(it)) * 0.5)
		}
		o := order
		if prev != nil {
			o = prev.Order
		} else {
			order++
		}
		out[it.ID] = &domain.ImpactItem{ItemID: it.ID, Level: level, Reason: reason, CostAtRisk: cost, Order: o, NewStartMin: newStart, CauseID: cause}
	}
	today := DayItems(t.Items, D)
	var broken []domain.TripItem

	switch inc.Kind {
	case domain.IncWeather:
		for _, it := range today {
			if it.Kind == "activity" && it.Outdoor {
				if inc.Severity >= 4 {
					mark(it, domain.LevelCannotHappen, "Outdoor activity · heavy rain & gusts forecast", nil, "")
				} else {
					mark(it, domain.LevelAtRisk, "Outdoor · light rain possible", nil, "")
				}
				broken = append(broken, it)
			}
		}
	case domain.IncHealth, domain.IncTravelerRequest:
		for _, it := range today {
			if it.Kind != "activity" {
				continue
			}
			if it.Energy >= 4 {
				mark(it, domain.LevelCannotHappen, "Too strenuous for today", nil, "")
				broken = append(broken, it)
			} else if it.Energy == 3 {
				mark(it, domain.LevelAtRisk, "Moderate effort, may be tiring", nil, "")
				broken = append(broken, it)
			}
		}
	case domain.IncVendorUnavailable:
		for _, it := range t.Items {
			if !IsActive(it) || it.Day < D {
				continue
			}
			if inc.VendorID != "" && it.VendorID == inc.VendorID {
				mark(it, domain.LevelCannotHappen, "Vendor cannot serve this booking", nil, "")
				broken = append(broken, it)
			}
		}
	case domain.IncClosure, domain.IncCrowdReport:
		for _, it := range t.Items {
			if !IsActive(it) || it.Day < D || !matchesPlace(it, inc.Place) {
				continue
			}
			if inc.Kind == domain.IncClosure {
				mark(it, domain.LevelCannotHappen, inc.Place+" is closed", nil, "")
			} else {
				mark(it, domain.LevelAtRisk, "Crowd report at "+inc.Place, nil, "")
			}
			broken = append(broken, it)
		}
	case domain.IncFlightDelay, domain.IncRunningLate:
		delay := delayOf(inc, 60)
		var root *domain.TripItem
		for k := range today {
			it := today[k]
			if inc.Kind == domain.IncFlightDelay && IsTransport(it) || inc.Kind == domain.IncRunningLate && it.Status != domain.ItemDone && !IsTransport(it) {
				root = &today[k]
				break
			}
		}
		if root == nil && len(today) > 0 {
			root = &today[0]
		}
		if root == nil {
			break
		}
		reason := "Group running " + Duration(delay) + " late"
		if inc.Kind == domain.IncFlightDelay {
			reason = "Now lands " + Duration(delay) + " late"
		}
		mark(*root, domain.LevelMoves, reason, ptr(root.StartMin+delay), "")
		prev := *root
		prev.StartMin += delay
		for _, it := range today {
			if it.StartMin <= root.StartMin || it.ID == root.ID {
				continue
			}
			gap := min(TravelGap(prev, it), 30)
			if it.Kind == "meal" {
				gap = 0
			}
			newStart := max(it.StartMin, prev.End()+gap)
			if newStart > it.StartMin {
				level := e.levelForShift(it, newStart)
				late := Duration(newStart - it.StartMin)
				var why string
				switch level {
				case domain.LevelCannotHappen:
					why = "Would end after closing if started " + late + " late"
				case domain.LevelAtRisk:
					why = "Tight, starts " + late + " late"
				default:
					why = "Starts " + late + " later"
				}
				mark(it, level, why, ptr(newStart), prev.ID)
				if level == domain.LevelCannotHappen {
					broken = append(broken, it)
				} else {
					prev = it
					prev.StartMin = newStart
				}
			} else {
				prev = it
			}
		}
	}

	for _, b := range broken {
		for _, it := range t.Items {
			if it.Day != b.Day || !IsActive(it) {
				continue
			}
			if o := out[it.ID]; o != nil && o.Level == domain.LevelCannotHappen {
				continue
			}
			if contains(it.DependsOn, b.ID) {
				mark(it, domain.LevelMoves, fmt.Sprintf("Timing depends on “%s”", b.Title), nil, b.ID)
			}
		}
		day := DayItems(t.Items, b.Day)
		var pickup, firstAct *domain.TripItem
		for k := range day {
			if pickup == nil && day[k].Kind == "transfer" && len(day[k].DependsOn) == 0 {
				pickup = &day[k]
			}
			if firstAct == nil && day[k].Kind == "activity" {
				firstAct = &day[k]
			}
		}
		if pickup != nil && firstAct != nil && firstAct.ID == b.ID && out[pickup.ID] == nil {
			mark(*pickup, domain.LevelMoves, "Pickup time will change with the new plan", nil, b.ID)
		}
	}
	for _, it := range today {
		if out[it.ID] == nil {
			seq = append(seq, it.ID)
			out[it.ID] = &domain.ImpactItem{ItemID: it.ID, Level: domain.LevelSafe, Reason: "Not affected", Order: 99}
		}
	}

	items := make([]domain.ImpactItem, 0, len(seq))
	for _, id := range seq {
		items = append(items, *out[id])
	}
	sort.SliceStable(items, func(a, b int) bool { return items[a].Order < items[b].Order })
	byID := map[string]domain.TripItem{}
	for _, it := range t.Items {
		byID[it.ID] = it
	}
	s := domain.ImpactSummary{Items: items, VendorsTouched: []string{}}
	var vendors []string
	for _, i := range items {
		if i.Level == domain.LevelSafe {
			continue
		}
		it := byID[i.ItemID]
		s.MoneyAtRisk += i.CostAtRisk
		if i.Level != domain.LevelMoves && it.Hearted {
			s.HeartsAtRisk++
		}
		if i.Level == domain.LevelCannotHappen {
			s.MinutesLost += it.DurationMin
		}
		vendors = append(vendors, it.VendorID)
	}
	if inc.Kind == domain.IncFlightDelay || inc.Kind == domain.IncRunningLate {
		s.MinutesLost = delayOf(inc, 0)
	}
	if v := uniq(vendors); v != nil {
		s.VendorsTouched = v
	}
	s.Root = fmt.Sprintf("%s · Day %d, %s", inc.Title, D, DayDate(t.Prefs.StartDate, D))
	return s
}
