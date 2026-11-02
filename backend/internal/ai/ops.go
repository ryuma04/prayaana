package ai

import (
	"context"
	"strings"
	"time"
)

// OpsAnswer answers an operator's question in the console from the facts Go collected (trips,
// problems, vendor confirmations, agent runs, a What-If result). It is the backend's own answer
// when the Python AI service is off; callers fall back to rules when this returns an error.
func (s *Service) OpsAnswer(ctx context.Context, facts, question string) (string, string, error) {
	if !s.Enabled() || strings.TrimSpace(question) == "" {
		return "", "", ErrUnavailable
	}
	start := time.Now()
	system := "You are the operations assistant inside a tour operator's console. Answer the operator's question ONLY from the " +
		"JSON facts given (trips, open problems, vendor confirmations, agent runs, a focused problem, a What-If simulation). " +
		"Never invent trips, prices, times or vendor answers; if the facts don't say, say so. Name trips by their code. " +
		"Prices are Indian rupees. You cannot change anything: to act, tell the operator which page to open (Problems, " +
		"Trip Fixer, What-If, Bookings). Keep it under 120 words, plain words, no markdown tables." + guard
	user := "FACTS\n" + facts + "\n\nOPERATOR QUESTION: " + question
	out, engine, err := s.text(ctx, system, user)
	if err != nil {
		return "", "", err
	}
	out = trimRunes(strings.TrimSpace(out), 1500)
	s.logDecision(ctx, engine, "ops question: "+question, nil, trimRunes(out, 120), 0.7, time.Since(start))
	return out, engine, nil
}
