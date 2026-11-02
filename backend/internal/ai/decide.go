package ai

import (
	"context"
	"time"
)

// Decide answers one bounded question with one of the given options and a confidence
// (the LLM backup of the decision layer). The schema's enum keeps the model inside the options.
func (s *Service) Decide(ctx context.Context, task, question string, options []string) (string, float64, string, error) {
	if !s.Enabled() || len(options) == 0 {
		return "", 0, "", ErrUnavailable
	}
	start := time.Now()
	var out struct {
		Answer     string  `json:"answer"`
		Confidence float64 `json:"confidence"`
	}
	system := "You make one bounded decision for Prayaana Karnataka travel itineraries. Pick exactly one of the allowed answers and give your " +
		"confidence between 0 and 1. If unsure, pick the most neutral answer with low confidence." + guard
	schema := obj(map[string]any{"answer": enum(options...), "confidence": numT}, "answer", "confidence")
	engine, err := s.structured(ctx, "decide."+task, system, question, schema, &out)
	if err != nil {
		return "", 0, "", err
	}
	out.Confidence = clamp01(out.Confidence)
	s.logDecision(ctx, engine, task+": "+question, options, out.Answer, out.Confidence, time.Since(start))
	return out.Answer, out.Confidence, engine, nil
}
