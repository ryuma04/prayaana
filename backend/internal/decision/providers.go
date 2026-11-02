package decision

import (
	"context"
	"errors"
	"strconv"

	"trizpyy/internal/ai"
)

// ErrNotConnected: the native Jev API is not wired (see JevProvider).
var ErrNotConnected = errors.New("jev: native API not connected")

// Transport is the one piece needed to connect Jev natively: send a typed question, get a typed
// answer with confidence. It is intentionally not implemented here — Jev's runtime API
// (endpoint, authentication, request schema) could not be verified during development, and the
// Playground is not an application API. Implement it against the official API once access is
// granted, then set JevProvider.Transport; nothing else in Trizpyy changes.
type Transport interface {
	Decide(ctx context.Context, q Question) (Decision, error)
}

// JevProvider is the primary decision engine when connected.
type JevProvider struct{ Transport Transport }

func (j *JevProvider) Name() string { return "jev" }

func (j *JevProvider) Decide(ctx context.Context, q Question) (Decision, error) {
	if j == nil || j.Transport == nil {
		return Decision{}, ErrNotConnected
	}
	d, err := j.Transport.Decide(ctx, q)
	d.Provider = "jev"
	return d, err
}

// LLMProvider is the backup: the existing Groq / Gemini structured-JSON path, constrained to
// the same options with an enum schema.
type LLMProvider struct{ AI *ai.Service }

func (l *LLMProvider) Name() string { return "llm" }

func (l *LLMProvider) Decide(ctx context.Context, q Question) (Decision, error) {
	if l == nil || l.AI == nil || !l.AI.Enabled() {
		return Decision{}, ai.ErrUnavailable
	}
	options := q.Options
	if q.Kind == Score {
		options = nil
		for n := q.Min; n <= q.Max; n++ {
			options = append(options, strconv.Itoa(n))
		}
	}
	answer, conf, engine, err := l.AI.Decide(ctx, q.Task, q.Prompt, options)
	if err != nil {
		return Decision{}, err
	}
	return Decision{Answer: answer, Confidence: conf, Provider: engine}, nil
}
