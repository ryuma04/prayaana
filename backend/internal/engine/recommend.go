package engine

import (
	"fmt"
	"sort"

	"trizpyy/internal/domain"
)

// Recommendation is one experience picked for a traveler, with why.
type Recommendation struct {
	Activity domain.Activity `json:"activity"`
	Fit      int             `json:"fit"`   // Travel DNA fit, 0–100
	Score    int             `json:"score"` // final rank score, 0–100
	Because  string          `json:"because"`
}

// Recommend ranks a destination's experiences for a Travel DNA. Hard constraints come first and
// are plain code (partner taking bookings, already planned, kids, walking); the DNA only ranks.
// prefs may be nil (no trip yet).
func (e *Engine) Recommend(destID string, dna domain.TravelDNA, prefs *domain.TripPreferences, exclude map[string]bool, limit int) []Recommendation {
	var out []Recommendation
	for _, a := range e.Cat.ActivitiesFor(destID) {
		if exclude[a.ID] || !e.Cat.Available(a.VendorID) {
			continue
		}
		if prefs != nil {
			if prefs.Kids > 0 && !a.KidFriendly {
				continue
			}
			if contains(prefs.Special, "Limited mobility") && a.Walking == "high" {
				continue
			}
		}
		a = e.Cat.LiveActivity(a)
		fit := DNAFit(a, dna)
		because := "A good all-round pick"
		if d := dnaDrivers(a, dna); d != "" {
			because = fmt.Sprintf("Strong match for your %s preferences", d)
		}
		score := clamp(Round(float64(fit)*0.9+(rated(a.Rating)-4.3)*20), 0, 100)
		out = append(out, Recommendation{Activity: a, Fit: fit, Score: score, Because: because})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}
