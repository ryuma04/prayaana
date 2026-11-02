package ai

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

type Groq struct {
	keys                 *keyring
	base                 string
	fast, agent, whisper string
	client               *http.Client
	skipReasoning        atomic.Bool
}

func NewGroq(keys []string, base, fast, agent, whisper string) *Groq {
	return &Groq{keys: newKeyring(keys), base: base, fast: fast, agent: agent, whisper: whisper, client: &http.Client{Timeout: 60 * time.Second}}
}

func (g *Groq) Name() string { return "groq" }

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (g *Groq) chat(ctx context.Context, model string, messages []chatMessage, format any, maxTokens int) (string, error) {
	body := map[string]any{
		"model":                 model,
		"messages":              messages,
		"temperature":           0.2,
		"max_completion_tokens": maxTokens,
	}
	if format != nil {
		body["response_format"] = format
		body["temperature"] = 0
	}
	if strings.Contains(model, "gpt-oss") && !g.skipReasoning.Load() {
		body["reasoning_effort"] = "low"
	}
	var resp chatResponse
	err := g.keys.do(func(key string) error {
		headers := map[string]string{"Authorization": "Bearer " + key}
		err := postJSON(ctx, g.client, g.base+"/chat/completions", headers, body, &resp)
		var he *httpError
		if errors.As(err, &he) && he.Status == 400 && strings.Contains(he.Body, "reasoning_effort") {
			g.skipReasoning.Store(true)
			delete(body, "reasoning_effort")
			err = postJSON(ctx, g.client, g.base+"/chat/completions", headers, body, &resp)
		}
		return err
	})
	if err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 || strings.TrimSpace(resp.Choices[0].Message.Content) == "" {
		return "", errors.New("groq returned an empty answer")
	}
	return resp.Choices[0].Message.Content, nil
}

func (g *Groq) JSON(ctx context.Context, system, user string, schema Schema, out any) error {
	format := map[string]any{
		"type":        "json_schema",
		"json_schema": map[string]any{"name": "answer", "strict": true, "schema": schema},
	}
	text, err := g.chat(ctx, g.fast, []chatMessage{{"system", system}, {"user", user}}, format, 1200)
	if err != nil {
		return err
	}
	return decodeLoose(text, out)
}

func (g *Groq) Text(ctx context.Context, system, user string) (string, error) {
	text, err := g.chat(ctx, g.agent, []chatMessage{{"system", system}, {"user", user}}, nil, 600)
	return strings.TrimSpace(text), err
}

func (g *Groq) Transcribe(ctx context.Context, audio []byte, filename, _ string) (Transcript, error) {
	var out Transcript
	err := g.keys.do(func(key string) error {
		var err error
		out, err = g.transcribe(ctx, key, audio, filename)
		return err
	})
	return out, err
}

func (g *Groq) transcribe(ctx context.Context, key string, audio []byte, filename string) (Transcript, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return Transcript{}, err
	}
	if _, err := part.Write(audio); err != nil {
		return Transcript{}, err
	}
	_ = w.WriteField("model", g.whisper)
	_ = w.WriteField("response_format", "verbose_json")
	_ = w.WriteField("temperature", "0")
	if err := w.Close(); err != nil {
		return Transcript{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.base+"/audio/transcriptions", &buf)
	if err != nil {
		return Transcript{}, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", w.FormDataContentType())
	var out Transcript
	if err := do(g.client, req, &out); err != nil {
		return Transcript{}, err
	}
	out.Text = strings.TrimSpace(out.Text)
	if out.Text == "" {
		return out, errors.New("empty transcript")
	}
	return out, nil
}
