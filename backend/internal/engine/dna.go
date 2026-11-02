package engine

import (
	"sort"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
)

var traitKeys = []string{"adventure", "nature", "culture", "food", "luxury", "social"}

var traitLabel = map[string]string{
	"adventure": "adventure", "nature": "nature", "culture": "culture & history",
	"food": "food", "luxury": "comfort", "social": "meeting people",
}

var dnaNames = []struct {
	a, b, name, emoji string
}{
	{"adventure", "nature", "Summit Seeker", "🏔️"},
	{"culture", "food", "Heritage Foodie", "🍛"},
	{"food", "social", "Street Food Hunter", "🌶️"},
	{"luxury", "culture", "Palace Hopper", "👑"},
	{"nature", "culture", "Quiet Explorer", "🧭"},
	{"adventure", "social", "Thrill Tribe Leader", "🪂"},
	{"nature", "food", "Orchard Wanderer", "🍎"},
	{"luxury", "nature", "Slow Luxe Wanderer", "🛶"},
	{"adventure", "culture", "Trail Historian", "🗺️"},
	{"social", "culture", "Festival Chaser", "🪔"},
	{"luxury", "food", "Gourmet Nomad", "🍷"},
	{"adventure", "food", "Adrenaline Gourmand", "🔥"},
}

type traits map[string]int

func baseTraits() traits {
	return traits{"adventure": 30, "nature": 30, "culture": 30, "food": 30, "luxury": 20, "social": 25}
}

func toNumber(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	}
	return 0, false
}

// ComputeDNA scores quiz answers into a Travel DNA profile.
func ComputeDNA(quiz []catalog.QuizQuestion, answers map[string]any) domain.TravelDNA {
	t := baseTraits()
	pace, rhythm := "balanced", "early-bird"
	apply := func(delta map[string]any) {
		for _, k := range traitKeys {
			if v, ok := toNumber(delta[k]); ok {
				t[k] += int(v)
			}
		}
		if p, ok := delta["pace"].(string); ok && p != "" {
			pace = p
		}
		if r, ok := delta["rhythm"].(string); ok && r != "" {
			rhythm = r
		}
	}
	option := func(q catalog.QuizQuestion, id string) *catalog.QuizOption {
		for i := range q.Options {
			if q.Options[i].ID == id {
				return &q.Options[i]
			}
		}
		return nil
	}
	for _, q := range quiz {
		a, ok := answers[q.ID]
		if !ok || a == nil {
			continue
		}
		switch q.Kind {
		case "slider":
			if n, ok := toNumber(a); ok {
				t[q.Trait] += Round((n - 50) * 0.8)
			}
		case "single":
			if s, ok := a.(string); ok {
				if o := option(q, s); o != nil {
					apply(o.Delta)
				}
			}
		case "multi":
			if list, ok := a.([]any); ok {
				for _, x := range list {
					if s, ok := x.(string); ok {
						if o := option(q, s); o != nil {
							apply(o.Delta)
						}
					}
				}
			}
		}
	}
	for _, k := range traitKeys {
		t[k] = clamp(t[k], 5, 98)
	}
	return describeDNA(t, pace, rhythm)
}

func sortedTraits(t traits) []string {
	keys := append([]string(nil), traitKeys...)
	sort.SliceStable(keys, func(a, b int) bool { return t[keys[a]] > t[keys[b]] })
	return keys
}

func describeDNA(t traits, pace, rhythm string) domain.TravelDNA {
	s := sortedTraits(t)
	a, b := s[0], s[1]
	name, emoji := "Curious Nomad", "🧳"
	found := false
	for _, n := range dnaNames {
		if n.a == a && n.b == b || n.a == b && n.b == a {
			name, emoji, found = n.name, n.emoji, true
			break
		}
	}
	if !found {
		for _, n := range dnaNames {
			if n.a == a || n.b == a {
				name, emoji = n.name, n.emoji
				break
			}
		}
	}
	when := " that starts late and ends later"
	if rhythm == "early-bird" {
		when = " that starts early"
	}
	summary := "You travel for " + traitLabel[a] + " and " + traitLabel[b] + ", at a " + pace + " pace" + when +
		". We'll go easy on " + traitLabel[s[len(s)-1]] + " and fill your days with places that feel like you."
	return domain.TravelDNA{
		Traits: domain.DNATraits{Adventure: t["adventure"], Nature: t["nature"], Culture: t["culture"], Food: t["food"], Luxury: t["luxury"], Social: t["social"]},
		Name:   name, Emoji: emoji, Summary: summary, Pace: pace, Rhythm: rhythm,
	}
}

func traitsOf(d domain.DNATraits) traits {
	return traits{"adventure": d.Adventure, "nature": d.Nature, "culture": d.Culture, "food": d.Food, "luxury": d.Luxury, "social": d.Social}
}

func DNAToInterests(d domain.TravelDNA) []string {
	return sortedTraits(traitsOf(d.Traits))[:3]
}

func DNAFromInterests(interests []string, pace, rhythm string) domain.TravelDNA {
	t := baseTraits()
	bump := map[string]string{"adventure": "adventure", "nature": "nature", "culture": "culture", "food": "food", "luxury": "luxury", "social": "social", "relax": "luxury", "photo": "nature"}
	for i, in := range interests {
		if k, ok := bump[in]; ok {
			t[k] = min(95, t[k]+45-i*6)
		}
	}
	return describeDNA(t, pace, rhythm)
}

// DescribeDNA names and summarises a set of traits (used when learning moves the DNA).
func DescribeDNA(t domain.DNATraits, pace, rhythm string) domain.TravelDNA {
	return describeDNA(traitsOf(t), pace, rhythm)
}
