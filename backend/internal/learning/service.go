package learning

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"trizpyy/internal/app"
	"trizpyy/internal/decision"
	"trizpyy/internal/domain"
	"trizpyy/internal/store"
)

type Service struct{ *app.Core }

func New(c *app.Core) *Service { return &Service{Core: c} }

// Record stores behaviour events and learns from them in their own transaction. It is best
// effort: a failure is logged and never breaks the action the traveler just took.
func (s *Service) Record(ctx context.Context, userID string, evs ...Event) {
	if s == nil || userID == "" || len(evs) == 0 {
		return
	}
	ctx = context.WithoutCancel(ctx)
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		_, err := s.Learn(ctx, st, userID, "behaviour", evs)
		return err
	})
	if err != nil {
		slog.Warn("travel dna learning failed", "user", userID, "err", err)
	}
}

// Learn records the events and updates the Travel DNA inside the caller's transaction.
// Without a quiz baseline the events are kept and nothing is learned yet.
func (s *Service) Learn(ctx context.Context, st *store.Store, userID, source string, evs []Event) ([]Change, error) {
	dna, err := st.LockProfileDNA(ctx, userID)
	if errors.Is(err, store.ErrNotFound) {
		dna, err = nil, nil
	}
	if err != nil {
		return nil, err
	}
	before := ""
	if dna != nil {
		before = dna.Name
	}
	now := s.Now().UTC()
	var all []Change
	for _, e := range evs {
		id := s.ID("evt")
		if err := st.InsertTravelerEvent(ctx, store.TravelerEvent{ID: id, UserID: userID, TripID: e.TripID, Kind: e.Kind,
			ActivityID: e.ActivityID, ItemID: e.ItemID, Value: e.Value, Detail: firstNonEmpty(e.Detail, e.Dimension), CreatedAt: now}); err != nil {
			return nil, err
		}
		if dna == nil {
			continue
		}
		var act *domain.Activity
		if e.ActivityID != "" {
			act = s.Eng.Cat.Activity(e.ActivityID)
		}
		next, changes := Apply(*dna, e, act)
		for _, c := range changes {
			if err := st.InsertDNAChange(ctx, userID, store.DNAChange{ID: s.ID("dna"), Dimension: c.Dimension, Old: c.Old, New: c.New,
				Reason: c.Reason, Source: source, EventID: id, CreatedAt: now}); err != nil {
				return nil, err
			}
		}
		dna = &next
		all = append(all, changes...)
	}
	if dna == nil || len(all) == 0 {
		return all, nil
	}
	if err := st.SetProfileDNA(ctx, userID, *dna); err != nil {
		return nil, err
	}
	if dna.Name != before {
		if err := st.SetCustomerDNA(ctx, userID, dna.Name); err != nil {
			return nil, err
		}
	}
	return all, nil
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// NoteEvents classifies the free-text feedback note with the decision layer (Jev → LLM →
// rules): is it positive, negative or neutral, and which dimension is it about?
func (s *Service) NoteEvents(ctx context.Context, tripID, note string) []Event {
	note = strings.TrimSpace(note)
	if len(note) < 4 {
		return nil
	}
	dims := append(append([]string{}, Dimensions...), "none")
	sent := s.Decisions.Decide(ctx, decision.Question{Task: "feedback.sentiment", Kind: decision.Choice,
		Prompt:  "A traveler wrote this about their finished trip. Is it positive, negative or neutral about the kind of experiences they had? Note: " + quote(note),
		Options: []string{"positive", "negative", "neutral"}}, SentimentRules(note))
	dim := s.Decisions.Decide(ctx, decision.Question{Task: "feedback.dimension", Kind: decision.Choice,
		Prompt:  "Which travel preference is this trip note mostly about? Note: " + quote(note),
		Options: dims}, DimensionRules(note))
	if sent.Answer == "neutral" || dim.Answer == "none" {
		return nil
	}
	v := 1
	if sent.Answer == "negative" {
		v = -1
	}
	short := note
	if len(short) > 60 {
		short = short[:57] + "…"
	}
	return []Event{{Kind: "note", TripID: tripID, Dimension: dim.Answer, Value: v, Detail: "“" + short + "”"}}
}

func quote(s string) string { return "\"" + strings.ReplaceAll(s, "\"", "'") + "\"" }

var (
	positiveWords  = []string{"loved", "love", "great", "amazing", "enjoyed", "best", "wonderful", "more", "fantastic", "awesome"}
	negativeWords  = []string{"boring", "tiring", "tired", "hated", "bad", "less", "too much", "crowded", "exhausting", "didn't like", "not enjoy", "skip"}
	dimensionWords = map[string][]string{
		"food":      {"food", "eat", "cuisine", "cafe", "café", "restaurant", "dhaba", "thali", "cooking"},
		"culture":   {"temple", "museum", "history", "heritage", "culture", "monastery", "fort", "art"},
		"adventure": {"trek", "paraglid", "raft", "adventure", "thrill", "hike", "climb", "dive"},
		"nature":    {"nature", "mountain", "lake", "forest", "view", "waterfall", "river", "beach"},
		"luxury":    {"spa", "relax", "comfort", "rest", "slow", "calm", "luxury", "pamper"},
		"social":    {"people", "party", "nightlife", "friends", "music", "locals", "bonfire"},
	}
)

// SentimentRules is the deterministic fallback for the sentiment decision.
func SentimentRules(note string) func(decision.Question) decision.Decision {
	return func(decision.Question) decision.Decision {
		n := strings.ToLower(note)
		pos, neg := 0, 0
		for _, w := range positiveWords {
			if strings.Contains(n, w) {
				pos++
			}
		}
		for _, w := range negativeWords {
			if strings.Contains(n, w) {
				neg++
			}
		}
		switch {
		case pos > neg:
			return decision.Decision{Answer: "positive", Confidence: 0.6}
		case neg > pos:
			return decision.Decision{Answer: "negative", Confidence: 0.6}
		}
		return decision.Decision{Answer: "neutral", Confidence: 0.5}
	}
}

// DimensionRules is the deterministic fallback for the dimension decision.
func DimensionRules(note string) func(decision.Question) decision.Decision {
	return func(decision.Question) decision.Decision {
		n := strings.ToLower(note)
		best, hits := "none", 0
		for _, d := range Dimensions {
			c := 0
			for _, w := range dimensionWords[d] {
				if strings.Contains(n, w) {
					c++
				}
			}
			if c > hits {
				best, hits = d, c
			}
		}
		return decision.Decision{Answer: best, Confidence: 0.55}
	}
}

// History is the traveler's Travel DNA evolution, newest first.
func (s *Service) History(ctx context.Context, userID string, limit int) ([]store.DNAChange, error) {
	return s.Store.ListDNAHistory(ctx, userID, limit)
}
