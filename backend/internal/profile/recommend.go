package profile

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"trizpyy/internal/auth"
	"trizpyy/internal/decision"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
)

type Recommendations struct {
	DNA     *domain.TravelDNA       `json:"dna"`
	Items   []engine.Recommendation `json:"items"`
	Decider string                  `json:"decider"` // which decision engine scored the top picks
}

// Recommend: candidates → hard constraints (code) → Travel DNA fit → a bounded 1–5 match
// decision for the top picks (Jev → LLM → rules) → final ranking with a plain explanation.
func (s *Service) Recommend(ctx context.Context, p auth.Principal, destID, tripID string) (Recommendations, error) {
	pr, err := s.Store.GetProfile(ctx, p.UserID)
	if err != nil || pr.DNA == nil {
		return Recommendations{Items: []engine.Recommendation{}}, nil
	}
	var prefs *domain.TripPreferences
	// Don't bring back what the traveler just turned down.
	exclude, err := s.Store.RejectedActivities(ctx, p.UserID)
	if err != nil {
		return Recommendations{}, err
	}
	if tripID != "" {
		owner, err := s.Store.TripOwner(ctx, tripID)
		if err != nil || owner != p.UserID {
			return Recommendations{}, httpx.NotFound("We couldn't find that trip.")
		}
		t, err := s.Store.GetTrip(ctx, tripID)
		if err != nil {
			return Recommendations{}, err
		}
		destID, prefs = t.DestinationID, &t.Prefs
		for _, it := range t.Items {
			if engine.IsActive(it) && it.RefID != "" {
				exclude[it.RefID] = true
			}
		}
	}
	if s.Eng.Cat.Destination(destID) == nil {
		return Recommendations{}, httpx.BadRequest("Pick a destination.")
	}
	dna := *pr.DNA
	items := s.Eng.Recommend(destID, dna, prefs, exclude, 8)
	decider := "rules"
	// The match question runs for the top picks in parallel, with a hard time limit.
	dctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	var mu sync.Mutex
	for i := range items {
		if i >= 6 {
			break
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			a, fit := items[i].Activity, items[i].Fit
			q := decision.Question{Task: "recommend.match", Kind: decision.Score, Min: 1, Max: 5,
				Prompt: fmt.Sprintf("A traveler's preferences out of 100: food %d, culture %d, adventure %d, nature %d, comfort %d, social %d. "+
					"How well does this experience fit them, 1 (poor) to 5 (excellent)? Experience: %s, %s (tags: %v).",
					dna.Traits.Food, dna.Traits.Culture, dna.Traits.Adventure, dna.Traits.Nature, dna.Traits.Luxury, dna.Traits.Social,
					a.Title, a.Description, a.Interests)}
			d := s.Decisions.Decide(dctx, q, func(decision.Question) decision.Decision {
				return decision.Decision{Answer: fmt.Sprint(max(1, min(5, (fit+10)/20))), Confidence: 0.7}
			})
			mu.Lock()
			defer mu.Unlock()
			items[i].Score = engine.Round(float64(items[i].Score)*0.7 + float64(d.Int()*20)*0.3)
			if d.Provider != "rules" {
				decider = d.Provider
			}
		}(i)
	}
	wg.Wait()
	sort.SliceStable(items, func(i, j int) bool { return items[i].Score > items[j].Score })
	return Recommendations{DNA: pr.DNA, Items: items, Decider: decider}, nil
}
