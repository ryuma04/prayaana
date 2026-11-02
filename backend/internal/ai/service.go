package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

type Cache interface {
	CacheGet(ctx context.Context, key string, v any) bool
	CachePut(ctx context.Context, key string, v any) error
	LogDecision(ctx context.Context, id, engine, question string, options []string, answer string, confidence float64, tookMs int) error
}

type Service struct {
	providers []Provider
	breakers  map[string]*breaker
	timeout   time.Duration
	cache     Cache
	newID     func(string) string
}

func NewService(providers []Provider, timeout time.Duration, cache Cache, newID func(string) string) *Service {
	s := &Service{timeout: timeout, cache: cache, newID: newID, breakers: map[string]*breaker{}}
	for _, p := range providers {
		if p != nil {
			s.providers = append(s.providers, p)
			s.breakers[p.Name()] = &breaker{}
		}
	}
	return s
}

func (s *Service) Enabled() bool { return len(s.providers) > 0 }

func (s *Service) Engines() []string {
	out := []string{}
	for _, p := range s.providers {
		out = append(out, p.Name())
	}
	return out
}

func cacheKey(parts ...string) string {
	h := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return hex.EncodeToString(h[:16])
}

// structured asks each provider in turn for schema-shaped JSON. It returns the engine that answered.
func (s *Service) structured(ctx context.Context, task, system, user string, schema Schema, out any) (string, error) {
	key := cacheKey(task, system, user)
	if s.cache != nil && s.cache.CacheGet(ctx, key, out) {
		return "cache", nil
	}
	var errs []error
	for _, p := range s.providers {
		b := s.breakers[p.Name()]
		if b.open() {
			continue
		}
		cctx, cancel := context.WithTimeout(ctx, s.timeout)
		err := p.JSON(cctx, system, user, schema, out)
		cancel()
		if errors.Is(err, ErrUnsupported) {
			continue
		}
		if err == nil {
			if s.cache != nil {
				_ = s.cache.CachePut(context.WithoutCancel(ctx), key, out)
			}
			return p.Name(), nil
		}
		if d := cooldownFor(err); d > 0 {
			b.trip(d)
		}
		slog.Warn("ai provider failed", "provider", p.Name(), "task", task, "err", err)
		errs = append(errs, fmt.Errorf("%s: %w", p.Name(), err))
	}
	if len(errs) == 0 {
		return "", ErrUnavailable
	}
	return "", errors.Join(errs...)
}

func (s *Service) text(ctx context.Context, system, user string) (string, string, error) {
	for _, p := range s.providers {
		b := s.breakers[p.Name()]
		if b.open() {
			continue
		}
		cctx, cancel := context.WithTimeout(ctx, s.timeout)
		out, err := p.Text(cctx, system, user)
		cancel()
		if errors.Is(err, ErrUnsupported) {
			continue
		}
		if err == nil && out != "" {
			return out, p.Name(), nil
		}
		if err == nil {
			slog.Warn("ai provider returned no text", "provider", p.Name())
			continue
		}
		if d := cooldownFor(err); d > 0 {
			b.trip(d)
		}
		slog.Warn("ai provider failed", "provider", p.Name(), "task", "text", "err", err)
	}
	return "", "", ErrUnavailable
}

func (s *Service) logDecision(ctx context.Context, engine, question string, options []string, answer string, confidence float64, took time.Duration) {
	if s.cache == nil || s.newID == nil {
		return
	}
	if len(question) > 500 {
		question = question[:500]
	}
	_ = s.cache.LogDecision(context.WithoutCancel(ctx), s.newID("dec"), engine, question, options, answer, confidence, int(took.Milliseconds()))
}

// Transcribe turns a voice note into text (Groq Whisper first, Gemini audio as backup).
func (s *Service) Transcribe(ctx context.Context, audio []byte, filename, mime string) (Transcript, string, error) {
	if len(audio) == 0 {
		return Transcript{}, "", errors.New("empty audio")
	}
	for _, p := range s.providers {
		b := s.breakers[p.Name()]
		if b.open() {
			continue
		}
		cctx, cancel := context.WithTimeout(ctx, 2*s.timeout)
		t, err := p.Transcribe(cctx, audio, filename, mime)
		cancel()
		if err == nil {
			return t, p.Name(), nil
		}
		if d := cooldownFor(err); d > 0 {
			b.trip(d)
		}
		slog.Warn("transcription failed", "provider", p.Name(), "err", err)
	}
	return Transcript{}, "", ErrUnavailable
}

func obj(props map[string]any, required ...string) Schema {
	return Schema{"type": "object", "properties": props, "required": required, "additionalProperties": false}
}

func enum(values ...string) map[string]any { return map[string]any{"type": "string", "enum": values} }

var (
	strT  = map[string]any{"type": "string"}
	numT  = map[string]any{"type": "number"}
	intT  = map[string]any{"type": "integer"}
	boolT = map[string]any{"type": "boolean"}
)
