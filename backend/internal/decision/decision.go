// Package decision is the bounded decision layer ("Jev"): it answers typed questions — pick one
// of our options, or a score in our range — with a confidence. It is not memory, not the Travel
// DNA store and not a chatbot; callers own the data and only ask for a decision.
//
// Providers are tried in order (Jev first, then the LLM backup); an answer outside the allowed
// options, a malformed confidence or a low-confidence answer is rejected and the next provider
// is asked. The caller's deterministic rules always produce the final fallback, so nothing
// depends on any provider being reachable.
package decision

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
)

type Kind string

const (
	Choice Kind = "choice" // Answer is one of Options
	Score  Kind = "score"  // Answer is an integer in [Min, Max]
)

type Question struct {
	Task    string   // short id, e.g. "feedback.sentiment"
	Kind    Kind     //
	Prompt  string   // the question; never shown to travelers
	Options []string // Choice only
	Min     int      // Score only
	Max     int      // Score only
}

type Decision struct {
	Answer     string         `json:"answer"`
	Confidence float64        `json:"confidence"`
	Provider   string         `json:"provider"`
	Meta       map[string]any `json:"meta,omitempty"`
}

// Int is the answer of a Score question.
func (d Decision) Int() int { n, _ := strconv.Atoi(d.Answer); return n }

type Provider interface {
	Name() string
	Decide(ctx context.Context, q Question) (Decision, error)
}

var ErrInvalid = errors.New("decision outside the allowed answers")

// Validate rejects anything a provider isn't allowed to answer.
func Validate(q Question, d Decision) error {
	if d.Confidence < 0 || d.Confidence > 1 {
		return fmt.Errorf("%w: confidence %v", ErrInvalid, d.Confidence)
	}
	switch q.Kind {
	case Choice:
		for _, o := range q.Options {
			if d.Answer == o {
				return nil
			}
		}
		return fmt.Errorf("%w: %q not in options", ErrInvalid, d.Answer)
	case Score:
		n, err := strconv.Atoi(d.Answer)
		if err != nil || n < q.Min || n > q.Max {
			return fmt.Errorf("%w: score %q outside %d to %d", ErrInvalid, d.Answer, q.Min, q.Max)
		}
		return nil
	}
	return fmt.Errorf("%w: unknown kind %q", ErrInvalid, q.Kind)
}

type Service struct {
	Providers     []Provider
	MinConfidence float64
}

func New(min float64, providers ...Provider) *Service {
	var list []Provider
	for _, p := range providers {
		if p != nil {
			list = append(list, p)
		}
	}
	return &Service{Providers: list, MinConfidence: min}
}

// Decide returns the first valid, confident provider answer, or the rules answer.
func (s *Service) Decide(ctx context.Context, q Question, rules func(Question) Decision) Decision {
	var tried []string
	if s != nil {
		for _, p := range s.Providers {
			d, err := p.Decide(ctx, q)
			if err == nil {
				err = Validate(q, d)
			}
			if err == nil && d.Confidence < s.MinConfidence {
				err = fmt.Errorf("low confidence %.2f", d.Confidence)
			}
			if err != nil {
				if !errors.Is(err, ErrNotConnected) {
					slog.Debug("decision provider skipped", "provider", p.Name(), "task", q.Task, "err", err)
				}
				tried = append(tried, p.Name()+": "+err.Error())
				continue
			}
			if d.Provider == "" {
				d.Provider = p.Name()
			}
			return d
		}
	}
	d := rules(q)
	if Validate(q, d) != nil { // a rules bug must never leak an invalid answer
		if q.Kind == Choice && len(q.Options) > 0 {
			d.Answer = q.Options[len(q.Options)-1]
		} else {
			d.Answer = strconv.Itoa(q.Min)
		}
		d.Confidence = 0
	}
	d.Provider = "rules"
	if len(tried) > 0 {
		d.Meta = map[string]any{"fallbackFrom": tried}
	}
	return d
}
