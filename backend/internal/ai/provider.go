// Package ai wraps the language models. Code decides, AI assists: every call has
// a strict output schema, a timeout, and a rule-based fallback in the caller.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var ErrUnavailable = errors.New("no AI provider available")

// Schema is a JSON Schema object (lowercase types, additionalProperties:false).
type Schema map[string]any

type Provider interface {
	Name() string
	JSON(ctx context.Context, system, user string, schema Schema, out any) error
	Text(ctx context.Context, system, user string) (string, error)
	Transcribe(ctx context.Context, audio []byte, filename, mime string) (Transcript, error)
}

type Transcript struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

// breaker skips a provider for a while after rate limits or outages.
type breaker struct {
	mu    sync.Mutex
	until time.Time
}

func (b *breaker) open() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return time.Now().Before(b.until)
}

func (b *breaker) trip(d time.Duration) {
	b.mu.Lock()
	b.until = time.Now().Add(d)
	b.mu.Unlock()
}

type httpError struct {
	Status int
	Body   string
}

func (e *httpError) Error() string { return fmt.Sprintf("status %d: %s", e.Status, e.Body) }

func cooldownFor(err error) time.Duration {
	var he *httpError
	if errors.As(err, &he) {
		switch {
		case he.Status == 429:
			return 60 * time.Second
		case he.Status == 401 || he.Status == 403:
			return 10 * time.Minute
		case he.Status >= 500:
			return 20 * time.Second
		}
		return 0
	}
	return 10 * time.Second
}

func postJSON(ctx context.Context, client *http.Client, url string, headers map[string]string, body any, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return do(client, req, out)
}

func do(client *http.Client, req *http.Request, out any) error {
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(raw))
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return &httpError{Status: resp.StatusCode, Body: msg}
	}
	return json.Unmarshal(raw, out)
}

// decodeLoose parses model output that should be JSON, tolerating code fences.
func decodeLoose(text string, out any) error {
	t := strings.TrimSpace(text)
	t = strings.TrimPrefix(t, "```json")
	t = strings.TrimPrefix(t, "```")
	t = strings.TrimSuffix(t, "```")
	t = strings.TrimSpace(t)
	if i := strings.IndexAny(t, "{["); i > 0 {
		t = t[i:]
	}
	if err := json.Unmarshal([]byte(t), out); err != nil {
		return fmt.Errorf("model returned invalid JSON: %w", err)
	}
	return nil
}
