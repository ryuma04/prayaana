package ai

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Turn is one earlier message in the trip chat.
type Turn struct {
	From string // "traveler", "assistant" or "operator"
	Text string
}

// Assist is the trip assistant's answer to a traveler message.
type Assist struct {
	Kind        string  `json:"kind"`
	Seriousness int     `json:"seriousness"`
	Confidence  float64 `json:"confidence"`
	Reply       string  `json:"reply"`
	// Suggest is a one-tap action the app offers under the reply (a mood re-plan, a problem report, or calling the coordinator).
	Suggest string `json:"suggest"`
	Engine  string `json:"engine"`
}

var Suggestions = []string{"none", "tired", "hungry", "raining", "late", "over_budget", "bored", "report_problem", "call_coordinator"}

var kindSuggest = map[string]string{"late": "late", "tired": "tired", "hungry": "hungry", "weather": "raining", "money": "over_budget", "unwell": "call_coordinator"}

var fallbackReply = map[string]string{
	"late":    "No problem. Tap “Running late” and I'll shift the rest of today and tell the partners.",
	"tired":   "Let's slow down. Tap “Tired” and I'll swap the hard plans for easy ones nearby and add a rest.",
	"hungry":  "Tap “Hungry” and I'll fit a good food stop into the next free slot near you.",
	"unwell":  "I'm sorry. Your coordinator has been alerted. If it's urgent, call 112 now.",
	"money":   "Tap “Over budget” and I'll show cheaper swaps for the rest of the trip.",
	"weather": "Tap “Raining” and I'll move outdoor plans indoors or to a drier day.",
	"other":   "Got it. Your coordinator can see this chat and will reply here shortly.",
}

// AssistRules answers without an AI provider: it sorts the message and offers the matching action.
func AssistRules(text string) Assist {
	m := ClassifyMessageRules(text)
	s := kindSuggest[m.Kind]
	if s == "" {
		s = "none"
	}
	return Assist{Kind: m.Kind, Seriousness: m.Seriousness, Confidence: m.Confidence, Reply: fallbackReply[m.Kind], Suggest: s, Engine: "rules"}
}

// TripAssistant answers a traveler in the trip chat using the real trip as context: the plan, today's
// schedule, the stay, the coordinator, live weather and emergency numbers. It may only use those facts.
func (s *Service) TripAssistant(ctx context.Context, tripFacts string, history []Turn, text string) Assist {
	start := time.Now()
	fallback := AssistRules(text)
	if !s.Enabled() || strings.TrimSpace(text) == "" {
		return fallback
	}
	var convo strings.Builder
	for _, t := range history {
		fmt.Fprintf(&convo, "%s: %q\n", t.From, trimRunes(t.Text, 300))
	}
	system := "You are the in-app trip assistant of an Indian tour operator, chatting with a traveler who is on or about to start " +
		"their trip. Answer ONLY from the trip facts given (times, places, stay, coordinator, weather, emergency numbers). If the " +
		"answer is not in the facts, say you'll ask the coordinator. Never invent bookings, prices or times. Keep the reply under 60 words, " +
		"warm and practical, in the traveler's language (English, Hindi or Hinglish). Also sort the message into a need, rate seriousness " +
		"1 (minor) to 5 (emergency), give confidence 0-1, and pick one suggested one-tap action: tired/hungry/raining/late/over_budget/bored " +
		"re-plan the rest of the day, report_problem files a closure or crowd report, call_coordinator for health or safety, none otherwise. " +
		"For any health emergency tell them to call 112 and pick call_coordinator." + guard
	user := fmt.Sprintf("TRIP FACTS\n%s\n\nEARLIER MESSAGES\n%s\nTRAVELER NOW: %q", tripFacts, convo.String(), text)
	schema := obj(map[string]any{
		"kind": enum(MessageKinds...), "seriousness": intT, "confidence": numT, "reply": strT, "suggest": enum(Suggestions...),
	}, "kind", "seriousness", "confidence", "reply", "suggest")
	var out Assist
	engine, err := s.structured(ctx, "assist", system, user, schema, &out)
	if err != nil || !valid(out.Kind, MessageKinds) || strings.TrimSpace(out.Reply) == "" {
		if reply, ok := s.domainReply(ctx, tripFacts, convo.String(), text); ok {
			fallback.Reply, fallback.Engine = reply, "nugen"
		}
		return fallback
	}
	// The Prayaana-aligned model (Nugen) writes the reply: it knows our destinations and rules.
	if reply, ok := s.domainReply(ctx, tripFacts, convo.String(), text); ok {
		out.Reply, engine = reply, "nugen"
	}
	if !valid(out.Suggest, Suggestions) {
		out.Suggest = "none"
	}
	// Keyword rules are precise when they fire; never let the model downgrade them to "other".
	if out.Kind == "other" && fallback.Kind != "other" {
		out.Kind = fallback.Kind
	}
	out.Engine = engine
	out.Seriousness = max(1, min(5, out.Seriousness))
	out.Confidence = clamp01(out.Confidence)
	out.Reply = trimRunes(strings.TrimSpace(out.Reply), 600)
	s.logDecision(ctx, engine, "trip chat: "+text, MessageKinds, out.Kind, out.Confidence, time.Since(start))
	return out
}

// domainReply asks the Prayaana-aligned Nugen model for the traveler-facing answer.
func (s *Service) domainReply(ctx context.Context, facts, convo, text string) (string, bool) {
	p := s.domainModel()
	if p == nil {
		return "", false
	}
	system := "You are Prayaana's trip assistant. Reply to the traveler in under 60 words, warm and practical, in plain words. " +
		"Use the trip facts and what you know about Prayaana destinations, experiences and trip rules. Never invent bookings, prices " +
		"or times that are not in the facts. For any health emergency tell them to call 112. No emojis."
	cctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	reply, err := p.Text(cctx, system, fmt.Sprintf("TRIP FACTS\n%s\n\nEARLIER MESSAGES\n%s\nTRAVELER NOW: %q", facts, convo, text))
	if err != nil {
		if d := cooldownFor(err); d > 0 {
			s.breakers[p.Name()].trip(d)
		}
		return "", false
	}
	reply = trimRunes(strings.TrimSpace(reply), 600)
	return reply, reply != ""
}

func trimRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
