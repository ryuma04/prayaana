package ai

import (
	"context"
	"errors"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// NugenSearch finds the Trizpyy experiences that best match what a traveler means, using Nugen's
// embedding model (qwen3-embedding-8b). The catalog is embedded once and kept in memory.
type NugenSearch struct {
	key, base string
	client    *http.Client
	mu        sync.Mutex
	ids       []string
	vecs      [][]float32
	built     time.Time
}

type SearchItem struct {
	ID   string
	Text string
}

type SearchHit struct {
	ID    string
	Score float64
}

func NewNugenSearch(key, base string) *NugenSearch {
	if key == "" {
		return nil
	}
	if base == "" {
		base = "https://api.nugen.in"
	}
	return &NugenSearch{key: key, base: strings.TrimRight(base, "/"), client: &http.Client{Timeout: 60 * time.Second}}
}

func (n *NugenSearch) embed(ctx context.Context, texts []string) ([][]float32, error) {
	var resp struct {
		Data []struct {
			Index     int       `json:"index"`
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	body := map[string]any{"model": "qwen3-embedding-8b", "input": texts}
	if err := postJSON(ctx, n.client, n.base+"/api/v3/inference/embeddings", map[string]string{"Authorization": "Bearer " + n.key}, body, &resp); err != nil {
		return nil, err
	}
	if len(resp.Data) != len(texts) {
		return nil, errors.New("nugen returned the wrong number of embeddings")
	}
	out := make([][]float32, len(texts))
	for i, d := range resp.Data {
		idx := d.Index
		if idx < 0 || idx >= len(out) {
			idx = i
		}
		out[idx] = d.Embedding
	}
	return out, nil
}

// index embeds the catalog once (in batches); a failed build is retried on a later call.
func (n *NugenSearch) index(ctx context.Context, items []SearchItem) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.ids) == len(items) && len(n.ids) > 0 {
		return nil
	}
	var ids []string
	var vecs [][]float32
	for i := 0; i < len(items); i += 32 {
		batch := items[i:min(i+32, len(items))]
		texts := make([]string, len(batch))
		for j, it := range batch {
			texts[j] = it.Text
			ids = append(ids, it.ID)
		}
		v, err := n.embed(ctx, texts)
		if err != nil {
			return err
		}
		vecs = append(vecs, v...)
	}
	n.ids, n.vecs, n.built = ids, vecs, time.Now()
	return nil
}

func cosine(a, b []float32) float64 {
	var dot, na, nb float64
	for i := range a {
		if i >= len(b) {
			break
		}
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

// Search returns the k catalog items closest in meaning to the query.
func (n *NugenSearch) Search(ctx context.Context, items []SearchItem, query string, k int) ([]SearchHit, error) {
	if n == nil {
		return nil, ErrUnavailable
	}
	if err := n.index(ctx, items); err != nil {
		return nil, err
	}
	q, err := n.embed(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	n.mu.Lock()
	hits := make([]SearchHit, len(n.ids))
	for i, v := range n.vecs {
		hits[i] = SearchHit{ID: n.ids[i], Score: cosine(q[0], v)}
	}
	n.mu.Unlock()
	sort.Slice(hits, func(a, b int) bool { return hits[a].Score > hits[b].Score })
	if len(hits) > k {
		hits = hits[:k]
	}
	return hits, nil
}

// Ready reports whether the catalog index has been built.
func (n *NugenSearch) Ready() bool {
	if n == nil {
		return false
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	return len(n.ids) > 0
}
