// Package learning is the Travel DNA Learning Engine: it turns what a traveler does (hearts,
// removals, swaps chosen, ratings, end-of-trip feedback) into small, bounded, explained changes
// to their Travel DNA. The quiz sets the baseline; only this package changes it afterwards.
package learning

import (
	"fmt"
	"math"
	"sort"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
)

// Event is one meaningful thing the traveler did.
type Event struct {
	Kind       string `json:"kind"`
	TripID     string `json:"tripId,omitempty"`
	ActivityID string `json:"activityId,omitempty"`
	ItemID     string `json:"itemId,omitempty"`
	Value      int    `json:"value,omitempty"`     // stars for "rated"; +1/-1 sentiment for "note"
	Dimension  string `json:"dimension,omitempty"` // for events about a dimension, not an activity
	Detail     string `json:"detail,omitempty"`    // what to show in the history ("Abbey Falls trek")
}

// Weights is how strongly each behaviour says "more like this" (+) or "less like this" (−).
// All tuning lives here.
var Weights = map[string]float64{
	"hearted":       2.0,
	"unhearted":     -1.0,
	"added":         2.0,
	"removed":       -2.0,
	"swap_chosen":   2.5, // picked this experience as a replacement
	"swap_replaced": -1.0,
	"more":          3.0, // feedback: "I wanted more <dimension>"
	"less":          -3.0,
	"note":          2.0, // feedback note, signed by its sentiment
}

// Rating strength by stars: 5★ is a strong positive, 1★ a strong negative.
var ratingStrength = map[int]float64{5: 4, 4: 2, 3: 0, 2: -2, 1: -4}

const (
	MinTrait = 5  // same bounds as the quiz (engine.ComputeDNA)
	MaxTrait = 98 //
	// MaxStep caps how far one event moves one dimension, so a single action never rewrites a profile.
	MaxStep = 5
)

var Dimensions = []string{"adventure", "nature", "culture", "food", "luxury", "social"}

var interestTrait = map[string]string{
	"adventure": "adventure", "nature": "nature", "culture": "culture", "food": "food",
	"luxury": "luxury", "social": "social", "relax": "luxury", "photo": "nature",
}

// Affinity is how much an experience speaks to each dimension (an activity can touch several):
// its first tag fully, the others partly, and strenuous experiences also count as adventure.
func Affinity(a domain.Activity) map[string]float64 {
	out := map[string]float64{}
	for i, in := range a.Interests {
		k, ok := interestTrait[in]
		if !ok {
			continue
		}
		w := 0.6
		if i == 0 {
			w = 1
		}
		out[k] = math.Max(out[k], w)
	}
	if a.Energy >= 4 {
		out["adventure"] = math.Max(out["adventure"], 0.5)
	}
	return out
}

func strength(ev Event) float64 {
	switch ev.Kind {
	case "rated":
		return ratingStrength[ev.Value]
	case "note":
		return Weights["note"] * float64(sign(ev.Value))
	}
	return Weights[ev.Kind]
}

func sign(n int) int {
	switch {
	case n > 0:
		return 1
	case n < 0:
		return -1
	}
	return 0
}

// Change is one recorded movement of one dimension.
type Change struct {
	Dimension string `json:"dimension"`
	Old       int    `json:"old"`
	New       int    `json:"new"`
	Reason    string `json:"reason"`
}

func traitPtr(t *domain.DNATraits, dim string) *int {
	switch dim {
	case "adventure":
		return &t.Adventure
	case "nature":
		return &t.Nature
	case "culture":
		return &t.Culture
	case "food":
		return &t.Food
	case "luxury":
		return &t.Luxury
	case "social":
		return &t.Social
	}
	return nil
}

var paces = []string{"relaxed", "balanced", "packed"}

func paceIndex(p string) int {
	for i, x := range paces {
		if x == p {
			return i
		}
	}
	return 1
}

// Apply returns the DNA after one event and what changed. act is the experience the event is
// about (nil for dimension or pace events). The input DNA is not modified.
func Apply(dna domain.TravelDNA, ev Event, act *domain.Activity) (domain.TravelDNA, []Change) {
	out := dna
	if ev.Kind == "pace" { // feedback: the trip felt too slow (+1) or too fast (−1)
		i := paceIndex(dna.Pace)
		j := max(0, min(len(paces)-1, i+sign(ev.Value)))
		if i == j {
			return dna, nil
		}
		out.Pace = paces[j]
		out = engine.DescribeDNA(out.Traits, out.Pace, out.Rhythm)
		return out, []Change{{Dimension: "pace", Old: i, New: j, Reason: reason(ev, act)}}
	}
	s := strength(ev)
	if s == 0 {
		return dna, nil
	}
	dims := map[string]float64{}
	switch {
	case ev.Dimension != "":
		dims[ev.Dimension] = 1
	case act != nil:
		dims = Affinity(*act)
	}
	keys := make([]string, 0, len(dims))
	for k := range dims {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var changes []Change
	for _, k := range keys {
		p := traitPtr(&out.Traits, k)
		if p == nil {
			continue
		}
		v := *p
		raw := s * dims[k]
		// Diminishing returns near the edges: strong profiles move slowly further out.
		if raw > 0 {
			raw *= float64(MaxTrait-v) / float64(MaxTrait-MinTrait) * 1.5
		} else {
			raw *= float64(v-MinTrait) / float64(MaxTrait-MinTrait) * 1.5
		}
		d := int(math.Round(raw))
		if d == 0 && raw != 0 {
			d = int(math.Copysign(1, raw)) // repeated small signals still add up
		}
		d = max(-MaxStep, min(MaxStep, d))
		nv := max(MinTrait, min(MaxTrait, v+d))
		if nv == v {
			continue
		}
		*p = nv
		changes = append(changes, Change{Dimension: k, Old: v, New: nv, Reason: fmt.Sprintf("%+d %s", nv-v, reason(ev, act))})
	}
	if len(changes) == 0 {
		return dna, nil
	}
	return engine.DescribeDNA(out.Traits, out.Pace, out.Rhythm), changes
}

func reason(ev Event, act *domain.Activity) string {
	what := ev.Detail
	if what == "" && act != nil {
		what = act.Title
	}
	switch ev.Kind {
	case "hearted":
		return fmt.Sprintf("made “%s” a Must-Do", what)
	case "unhearted":
		return fmt.Sprintf("un-hearted “%s”", what)
	case "added":
		return fmt.Sprintf("added “%s” to the plan", what)
	case "removed":
		return fmt.Sprintf("removed “%s”", what)
	case "swap_chosen":
		return fmt.Sprintf("chose “%s” as a swap", what)
	case "swap_replaced":
		return fmt.Sprintf("swapped out “%s”", what)
	case "rated":
		if ev.Value >= 4 {
			return fmt.Sprintf("loved “%s”", what)
		}
		return fmt.Sprintf("didn't enjoy “%s”", what)
	case "more":
		return "feedback: wanted more " + ev.Dimension
	case "less":
		return "feedback: wanted less " + ev.Dimension
	case "note":
		return "feedback note: " + what
	case "pace":
		if ev.Value > 0 {
			return "feedback: the trip felt too slow"
		}
		return "feedback: the trip felt too tiring"
	}
	return ev.Kind
}

// Feedback is the end-of-trip questionnaire.
type Feedback struct {
	Loved    []string `json:"loved"`    // trip item ids enjoyed most
	Disliked []string `json:"disliked"` // trip item ids enjoyed least
	Pace     string   `json:"pace"`     // too_slow | right | too_fast
	More     []string `json:"more"`     // dimensions wanted more of
	Less     []string `json:"less"`     // dimensions wanted less of
	Again    *bool    `json:"again,omitempty"`
	Note     string   `json:"note"` // "what would you change next time?"
}

func validDim(d string) bool {
	for _, x := range Dimensions {
		if x == d {
			return true
		}
	}
	return false
}

// Clean drops anything that doesn't belong to this trip or the known dimensions.
func (f Feedback) Clean(t *domain.Trip) Feedback {
	items := func(ids []string) []string {
		out := []string{}
		for _, id := range ids {
			if it := t.Item(id); it != nil && it.Kind == "activity" && it.RefID != "" && len(out) < 10 {
				out = append(out, id)
			}
		}
		return out
	}
	dims := func(list []string) []string {
		out := []string{}
		for _, d := range list {
			if validDim(d) && len(out) < 6 {
				out = append(out, d)
			}
		}
		return out
	}
	c := Feedback{Loved: items(f.Loved), Disliked: items(f.Disliked), More: dims(f.More), Less: dims(f.Less), Again: f.Again}
	if f.Pace == "too_slow" || f.Pace == "right" || f.Pace == "too_fast" {
		c.Pace = f.Pace
	}
	if len(f.Note) > 500 {
		f.Note = f.Note[:500]
	}
	c.Note = f.Note
	return c
}

// FeedbackEvents turns structured answers into learning signals (the note is classified separately).
func FeedbackEvents(t *domain.Trip, f Feedback) []Event {
	var evs []Event
	for _, id := range f.Loved {
		it := t.Item(id)
		evs = append(evs, Event{Kind: "rated", TripID: t.ID, ItemID: id, ActivityID: it.RefID, Value: 5, Detail: it.Title})
	}
	for _, id := range f.Disliked {
		it := t.Item(id)
		evs = append(evs, Event{Kind: "rated", TripID: t.ID, ItemID: id, ActivityID: it.RefID, Value: 1, Detail: it.Title})
	}
	for _, d := range f.More {
		evs = append(evs, Event{Kind: "more", TripID: t.ID, Dimension: d})
	}
	for _, d := range f.Less {
		evs = append(evs, Event{Kind: "less", TripID: t.ID, Dimension: d})
	}
	switch f.Pace {
	case "too_slow":
		evs = append(evs, Event{Kind: "pace", TripID: t.ID, Value: 1})
	case "too_fast":
		evs = append(evs, Event{Kind: "pace", TripID: t.ID, Value: -1})
	}
	return evs
}
