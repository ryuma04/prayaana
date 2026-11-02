package ai

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
)

// ErrUnsupported: the provider can't do this kind of task (Nugen has no strict JSON mode).
var ErrUnsupported = errors.New("not supported by this provider")

// Nugen serves Trizpyy's domain model: a Nugen base model aligned on Trizpyy's own travel
// corpus (destination guides, experiences, stays, transport, trip rules and traveler Q&A;
// see services/nugen). It writes traveler-facing text; strict JSON tasks stay with Groq/Gemini.
// API: https://docs.nugen.in (POST /api/v3/inference/chat/completions).
type Nugen struct {
	key, model, base string
	client           *http.Client
}

func NewNugen(key, model, base string) *Nugen {
	if key == "" || model == "" {
		return nil
	}
	if base == "" {
		base = "https://api.nugen.in"
	}
	return &Nugen{key: key, model: model, base: strings.TrimRight(base, "/"), client: &http.Client{Timeout: 30 * time.Second}}
}

func (n *Nugen) Name() string { return "nugen" }

func (n *Nugen) JSON(context.Context, string, string, Schema, any) error { return ErrUnsupported }

func (n *Nugen) Transcribe(context.Context, []byte, string, string) (Transcript, error) {
	return Transcript{}, ErrUnsupported
}

func (n *Nugen) Text(ctx context.Context, system, user string) (string, error) {
	body := map[string]any{
		"model":       n.model,
		"messages":    []chatMessage{{"system", system}, {"user", user}},
		"temperature": 0.3,
		"max_tokens":  300,
		"stream":      false,
	}
	var resp chatResponse
	if err := postJSON(ctx, n.client, n.base+"/api/v3/inference/chat/completions", map[string]string{"Authorization": "Bearer " + n.key}, body, &resp); err != nil {
		return "", err // the AI service then uses Groq / Gemini instead
	}
	if len(resp.Choices) == 0 {
		return "", errors.New("nugen returned no answer")
	}
	return cleanReply(resp.Choices[0].Message.Content), nil
}

type embedResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
}

// Embed generates text embeddings using Nugen's qwen3-embedding-8b model.
func (n *Nugen) Embed(ctx context.Context, text string) ([]float32, error) {
	body := map[string]any{
		"input": text,
		"model": "qwen3-embedding-8b",
	}
	var resp embedResponse
	if err := postJSON(ctx, n.client, n.base+"/api/v3/inference/embeddings", map[string]string{"Authorization": "Bearer " + n.key}, body, &resp); err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, errors.New("nugen returned empty embedding")
	}
	return resp.Data[0].Embedding, nil
}

// cleanReply drops a reasoning model's thinking block and stray quotes.
func cleanReply(s string) string {
	if i := strings.LastIndex(s, "</think>"); i >= 0 {
		s = s[i+len("</think>"):]
	}
	return strings.Trim(strings.TrimSpace(s), `"`)
}

// domainModel is the aligned Nugen provider when configured and not cooling down.
func (s *Service) domainModel() Provider {
	for _, p := range s.providers {
		if p.Name() == "nugen" && !s.breakers[p.Name()].open() {
			return p
		}
	}
	return nil
}
