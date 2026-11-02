package engine

import (
	"sort"

	"trizpyy/internal/domain"
)

type window struct{ Start, End int }

var SlotWindows = map[string]window{
	"morning":   {8 * 60, 13*60 + 30},
	"afternoon": {13 * 60, 18*60 + 30},
	"evening":   {17 * 60, 22*60 + 30},
}

var PaceLimit = map[string]int{"relaxed": 9, "balanced": 12, "packed": 15}

var TransportKinds = map[string]bool{"flight": true, "train": true, "bus": true, "car": true}

func IsTransport(i domain.TripItem) bool { return TransportKinds[i.Kind] }

func IsActive(i domain.TripItem) bool { return i.Status != domain.ItemCancelled }

func RoundTo5(m int) int { return Round(float64(m)/5) * 5 }

func TravelGap(a, b domain.TripItem) int {
	if !a.HasPoint() || !b.HasPoint() {
		return 15
	}
	km := HaversineKm(*a.Lat, *a.Lng, *b.Lat, *b.Lng)
	if km < 0.8 {
		return 5
	}
	return min(120, RoadMinutes(km))
}

func kindOrder(i domain.TripItem) int {
	switch i.Kind {
	case "flight", "train", "bus", "car", "checkout":
		return 0
	case "transfer":
		return 1
	case "checkin":
		return 2
	}
	return 3
}

// ReflowDay re-times one day so nothing overlaps and there is travel time
// between places. Transport legs never move.
func ReflowDay(items []domain.TripItem, day int) []domain.TripItem {
	var list []domain.TripItem
	for _, it := range items {
		if it.Day == day && IsActive(it) {
			list = append(list, it)
		}
	}
	sort.SliceStable(list, func(a, b int) bool {
		if list[a].StartMin != list[b].StartMin {
			return list[a].StartMin < list[b].StartMin
		}
		return kindOrder(list[a]) < kindOrder(list[b])
	})
	updated := map[string]int{}
	var prev *domain.TripItem
	for idx := range list {
		it := list[idx]
		if prev != nil && !IsTransport(it) {
			gap := TravelGap(*prev, it)
			if it.Kind == "meal" || prev.Kind == "transfer" {
				gap = 0
			}
			earliest := prev.End() + gap
			if it.StartMin < earliest {
				it.StartMin = RoundTo5(earliest)
			}
		}
		updated[it.ID] = it.StartMin
		list[idx] = it
		prev = &list[idx]
	}
	out := domain.CloneItems(items)
	for i := range out {
		if s, ok := updated[out[i].ID]; ok {
			out[i].StartMin = s
		}
	}
	return out
}

// DayItems returns the active items of a day ordered by start time.
func DayItems(items []domain.TripItem, day int) []domain.TripItem {
	var out []domain.TripItem
	for _, it := range items {
		if it.Day == day && IsActive(it) {
			out = append(out, it)
		}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].StartMin < out[b].StartMin })
	return out
}

func DayEnergy(items []domain.TripItem, day int) int {
	s := 0
	for _, it := range DayItems(items, day) {
		s += it.Energy
	}
	return s
}

func SlotOf(min int) string {
	switch {
	case min < 12*60+30:
		return "morning"
	case min < 17*60:
		return "afternoon"
	}
	return "evening"
}

func SlotStart(slot, rhythm string) int {
	switch slot {
	case "morning":
		if rhythm == "night-owl" {
			return 10*60 + 30
		}
		return 9*60 + 30
	case "afternoon":
		return 15 * 60
	}
	return 18 * 60
}
