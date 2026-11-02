package ai

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"
)

type Gemini struct {
	keys        *keyring
	base, model string
	client      *http.Client
}

func NewGemini(keys []string, base, model string) *Gemini {
	return &Gemini{keys: newKeyring(keys), base: base, model: model, client: &http.Client{Timeout: 60 * time.Second}}
}

func (g *Gemini) Name() string { return "gemini" }

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (g *Gemini) generate(ctx context.Context, system string, parts []map[string]any, config map[string]any) (string, error) {
	body := map[string]any{
		"contents":         []map[string]any{{"role": "user", "parts": parts}},
		"generationConfig": config,
	}
	if system != "" {
		body["systemInstruction"] = map[string]any{"parts": []map[string]any{{"text": system}}}
	}
	var resp geminiResponse
	url := g.base + "/models/" + g.model + ":generateContent"
	if err := g.keys.do(func(key string) error {
		return postJSON(ctx, g.client, url, map[string]string{"x-goog-api-key": key}, body, &resp)
	}); err != nil {
		return "", err
	}
	var sb strings.Builder
	for _, c := range resp.Candidates {
		for _, p := range c.Content.Parts {
			sb.WriteString(p.Text)
		}
		break
	}
	if strings.TrimSpace(sb.String()) == "" {
		return "", errors.New("gemini returned an empty answer")
	}
	return sb.String(), nil
}

func (g *Gemini) JSON(ctx context.Context, system, user string, schema Schema, out any) error {
	text, err := g.generate(ctx, system, []map[string]any{{"text": user}}, map[string]any{
		"temperature":      0,
		"responseMimeType": "application/json",
		"responseSchema":   toGeminiSchema(map[string]any(schema)),
	})
	if err != nil {
		return err
	}
	return decodeLoose(text, out)
}

func (g *Gemini) Text(ctx context.Context, system, user string) (string, error) {
	text, err := g.generate(ctx, system, []map[string]any{{"text": user}}, map[string]any{"temperature": 0.3, "maxOutputTokens": 400})
	return strings.TrimSpace(text), err
}

func (g *Gemini) Transcribe(ctx context.Context, audio []byte, _ string, mime string) (Transcript, error) {
	if mime == "" {
		mime = "audio/ogg"
	}
	var out Transcript
	schema := Schema{"type": "object", "properties": map[string]any{
		"text":     map[string]any{"type": "string"},
		"language": map[string]any{"type": "string"},
	}, "required": []string{"text", "language"}}
	text, err := g.generate(ctx, "Transcribe the voice note exactly as spoken, in its original language and script. Name the language in English.",
		[]map[string]any{{"inline_data": map[string]any{"mime_type": mime, "data": base64.StdEncoding.EncodeToString(audio)}}},
		map[string]any{"temperature": 0, "responseMimeType": "application/json", "responseSchema": toGeminiSchema(schema)})
	if err != nil {
		return out, err
	}
	if err := decodeLoose(text, &out); err != nil {
		return out, err
	}
	if strings.TrimSpace(out.Text) == "" {
		return out, errors.New("empty transcript")
	}
	return out, nil
}

// toGeminiSchema converts a JSON Schema into Gemini's OpenAPI subset.
func toGeminiSchema(v any) any {
	switch x := v.(type) {
	case map[string]any:
		out := map[string]any{}
		for k, val := range x {
			switch k {
			case "additionalProperties", "$schema":
				continue
			case "type":
				if s, ok := val.(string); ok {
					out[k] = strings.ToUpper(s)
					continue
				}
			}
			out[k] = toGeminiSchema(val)
		}
		return out
	case Schema:
		return toGeminiSchema(map[string]any(x))
	case []any:
		out := make([]any, len(x))
		for i := range x {
			out[i] = toGeminiSchema(x[i])
		}
		return out
	}
	return v
}
