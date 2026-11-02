package ai

import (
	"context"
	"strings"
)

// Guide answers one traveler question about Karnataka using the catalog facts as grounding.
func (s *Service) Guide(ctx context.Context, question, facts string) (string, string, error) {
	if !s.Enabled() {
		return "", "", ErrUnavailable
	}
	system := "You are Prayaana's Karnataka Travel Guru, the AI travel planning assistant specializing exclusively in Karnataka, " +
		"India. Answer in under 90 words, warm, knowledgeable and practical. You know Karnataka deeply: the Western Ghats " +
		"hill stations (Coorg, Chikmagalur, Sakleshpur), UNESCO World Heritage sites (Hampi, Pattadakal, Belur-Halebidu), " +
		"rock-cut caves (Badami), pristine Arabian beaches (Gokarna, Udupi, Murdeshwar, Mangalore), wildlife reserves (Kabini, " +
		"Bandipur, Dandeli), and vibrant cities (Bengaluru, Mysuru). Use the catalog facts given. Never invent prices or " +
		"bookings. For any emergency, give Karnataka Police: 112, Ambulance: 108, Tourist Helpline: 1363 first. No emojis."
	answer, engine, err := s.text(ctx, system, "KARNATAKA FACTS\n"+facts+"\n\nTRAVELER: "+question)
	if err != nil {
		return "", "", err
	}
	return trimRunes(strings.TrimSpace(answer), 900), engine, nil
}
