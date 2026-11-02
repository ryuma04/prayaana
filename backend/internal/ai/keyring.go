package ai

import (
	"errors"
	"sync"
	"time"
)

var errKeysCooling = errors.New("every API key is cooling down")

// keyring rotates API keys round-robin and rests a key after rate limits, auth errors or outages.
type keyring struct {
	mu    sync.Mutex
	keys  []string
	until []time.Time
	next  int
}

func newKeyring(keys []string) *keyring {
	var clean []string
	seen := map[string]bool{}
	for _, k := range keys {
		if k != "" && !seen[k] {
			seen[k] = true
			clean = append(clean, k)
		}
	}
	return &keyring{keys: clean, until: make([]time.Time, len(clean))}
}

func (k *keyring) size() int { return len(k.keys) }

func (k *keyring) pick(skip map[int]bool) (int, string, bool) {
	k.mu.Lock()
	defer k.mu.Unlock()
	now := time.Now()
	for i := 0; i < len(k.keys); i++ {
		idx := (k.next + i) % len(k.keys)
		if skip[idx] || now.Before(k.until[idx]) {
			continue
		}
		k.next = (idx + 1) % len(k.keys)
		return idx, k.keys[idx], true
	}
	return 0, "", false
}

func (k *keyring) rest(idx int, d time.Duration) {
	k.mu.Lock()
	k.until[idx] = time.Now().Add(d)
	k.mu.Unlock()
}

// keyProblem reports whether another key might succeed where this one failed.
func keyProblem(err error) bool {
	var he *httpError
	if errors.As(err, &he) {
		return he.Status == 429 || he.Status == 401 || he.Status == 403 || he.Status >= 500
	}
	return true
}

// do runs fn with each available key until one succeeds or the failure is not key-related.
func (k *keyring) do(fn func(key string) error) error {
	tried := map[int]bool{}
	var last error
	for len(tried) < len(k.keys) {
		idx, key, ok := k.pick(tried)
		if !ok {
			break
		}
		tried[idx] = true
		err := fn(key)
		if err == nil {
			return nil
		}
		if d := cooldownFor(err); d > 0 {
			k.rest(idx, d)
		}
		if !keyProblem(err) {
			return err
		}
		last = err
	}
	if last == nil {
		return errKeysCooling
	}
	return last
}
