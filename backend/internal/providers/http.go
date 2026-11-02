// Package providers talks to the free outside services (allaboutourproject.md §20):
// Open-Meteo weather, OSRM routes, Aviationstack flights and Google Places.
// Every call has a timeout, bounded retries on 429/5xx, a cache and a fallback,
// so a slow or missing provider never breaks a screen. Keys stay on the server.
package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// ErrUnavailable means the provider could not answer; callers fall back.
var ErrUnavailable = errors.New("provider unavailable")

// StatusError carries a non-2xx answer so callers can tell quota from outage.
type StatusError struct {
	Status int
	Body   string
}

func (e *StatusError) Error() string { return fmt.Sprintf("status %d: %s", e.Status, e.Body) }

func retryable(status int) bool { return status == http.StatusTooManyRequests || status >= 500 }

// doJSON sends req (rebuilt by build for each attempt) and decodes a JSON answer into out.
// It retries at most twice on network errors, 429 and 5xx, honouring a short Retry-After.
func doJSON(ctx context.Context, client *http.Client, build func(context.Context) (*http.Request, error), out any) error {
	var last error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			wait := time.Duration(attempt*attempt) * 300 * time.Millisecond
			var se *StatusError
			if errors.As(last, &se) && se.Status == http.StatusTooManyRequests {
				wait = 1200 * time.Millisecond
			}
			select {
			case <-time.After(wait):
			case <-ctx.Done():
				return errors.Join(ErrUnavailable, ctx.Err())
			}
		}
		req, err := build(ctx)
		if err != nil {
			return err
		}
		resp, err := client.Do(req)
		if err != nil {
			last = err
			if ctx.Err() != nil {
				break
			}
			continue
		}
		raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if err != nil {
			last = err
			continue
		}
		if resp.StatusCode >= 300 {
			last = &StatusError{Status: resp.StatusCode, Body: trimBody(raw)}
			if retryable(resp.StatusCode) {
				if ra, _ := strconv.Atoi(resp.Header.Get("Retry-After")); ra > 2 {
					break // the provider asked for a long pause: fall back instead of waiting
				}
				continue
			}
			return errors.Join(ErrUnavailable, last)
		}
		if err := json.Unmarshal(raw, out); err != nil {
			return errors.Join(ErrUnavailable, fmt.Errorf("malformed response: %w", err))
		}
		return nil
	}
	return errors.Join(ErrUnavailable, last)
}

func trimBody(b []byte) string {
	if len(b) > 300 {
		b = b[:300]
	}
	return string(b)
}

// cache is a small TTL cache with a size bound (oldest entries are dropped first).
type cache[V any] struct {
	mu    sync.Mutex
	ttl   time.Duration
	max   int
	items map[string]cacheEntry[V]
	now   func() time.Time
}

type cacheEntry[V any] struct {
	val     V
	expires time.Time
	added   time.Time
}

func newCache[V any](ttl time.Duration, max int) *cache[V] {
	return &cache[V]{ttl: ttl, max: max, items: map[string]cacheEntry[V]{}, now: time.Now}
}

func (c *cache[V]) get(key string) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.items[key]
	if !ok || c.now().After(e.expires) {
		var zero V
		return zero, false
	}
	return e.val, true
}

func (c *cache[V]) put(key string, v V, ttl time.Duration) {
	if ttl <= 0 {
		ttl = c.ttl
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if len(c.items) >= c.max {
		var oldest string
		var at time.Time
		for k, e := range c.items {
			if now.After(e.expires) {
				delete(c.items, k)
				continue
			}
			if oldest == "" || e.added.Before(at) {
				oldest, at = k, e.added
			}
		}
		if len(c.items) >= c.max && oldest != "" {
			delete(c.items, oldest)
		}
	}
	c.items[key] = cacheEntry[V]{val: v, expires: now.Add(ttl), added: now}
}

// budget caps calls to a quota-limited provider per calendar day.
type budget struct {
	mu    sync.Mutex
	limit int
	day   string
	used  int
	now   func() time.Time
}

func (b *budget) take() bool {
	if b.limit <= 0 {
		return false
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	today := b.now().UTC().Format("2006-01-02")
	if b.day != today {
		b.day, b.used = today, 0
	}
	if b.used >= b.limit {
		return false
	}
	b.used++
	return true
}

func (b *budget) remaining() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.day != b.now().UTC().Format("2006-01-02") {
		return b.limit
	}
	return max(0, b.limit-b.used)
}
