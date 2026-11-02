package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestReadReplyRules(t *testing.T) {
	cases := []struct {
		text, decision, time string
	}{
		{"Haan, kal subah 9 baje aa jaunga.", "confirmed", "9:00 AM"},
		{"9 nahi ho payega, saadhe das baje chalega?", "other_time", ""},
		{"Kal gaadi service mein hai, nahi ho payega.", "declined", ""},
		{"Ek baar phone kar lo, baat karte hain.", "needs_call", ""},
		{"ok", "confirmed", ""},
		{"Yes confirmed, 5:30 pm works", "confirmed", "5:30 PM"},
		{"Sorry, fully booked that day", "declined", ""},
	}
	for _, c := range cases {
		r := ReadReplyRules(c.text)
		if r.Decision != c.decision {
			t.Errorf("%q: decision %s, want %s", c.text, r.Decision, c.decision)
		}
		if c.time != "" && r.Time != c.time {
			t.Errorf("%q: time %q, want %q", c.text, r.Time, c.time)
		}
	}
}

func TestClassifyMessageRules(t *testing.T) {
	cases := map[string]string{
		"We are stuck in traffic":         "late",
		"My father is not feeling well":   "unwell",
		"So tired after the trek":         "tired",
		"Where can we eat something good": "hungry",
		"This is getting too expensive":   "money",
		"What a view!":                    "other",
	}
	for text, kind := range cases {
		if got := ClassifyMessageRules(text).Kind; got != kind {
			t.Errorf("%q: %s, want %s", text, got, kind)
		}
	}
}

func TestGeminiSchemaConversion(t *testing.T) {
	s := obj(map[string]any{"decision": enum("a", "b"), "n": numT}, "decision", "n")
	out := toGeminiSchema(map[string]any(s)).(map[string]any)
	if out["type"] != "OBJECT" {
		t.Fatalf("type = %v", out["type"])
	}
	if _, ok := out["additionalProperties"]; ok {
		t.Fatal("additionalProperties must be dropped for Gemini")
	}
	props := out["properties"].(map[string]any)
	if props["decision"].(map[string]any)["type"] != "STRING" || props["n"].(map[string]any)["type"] != "NUMBER" {
		t.Fatalf("nested types not converted: %v", props)
	}
}

func groqServer(t *testing.T, content string, status int, hits *int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(hits, 1)
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			t.Errorf("missing bearer token")
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if status != 200 {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":{"message":"rate limited"}}`))
			return
		}
		if body["response_format"] == nil {
			t.Errorf("expected strict json schema response_format")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": content}}}})
	}))
}

func geminiServer(t *testing.T, content string, hits *int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(hits, 1)
		if r.Header.Get("x-goog-api-key") == "" {
			t.Errorf("missing gemini key header")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{"content": map[string]any{"parts": []any{map[string]any{"text": content}}}}}})
	}))
}

func TestProviderChainAndBreaker(t *testing.T) {
	var groqHits, geminiHits int32
	groq := groqServer(t, "", 429, &groqHits)
	defer groq.Close()
	gem := geminiServer(t, `{"decision":"confirmed","time":"9:00 AM","translation":"Yes, 9 AM","language":"Hindi","confidence":0.93}`, &geminiHits)
	defer gem.Close()

	svc := NewService([]Provider{
		NewGroq([]string{"k"}, groq.URL, "fast", "agent", "whisper"),
		NewGemini([]string{"k"}, gem.URL, "model"),
	}, 5*time.Second, nil, nil)

	r := svc.ReadReply(context.Background(), "Haan ji 9 baje", "Pickup 9:00 AM")
	if r.Engine != "gemini" || r.Decision != "confirmed" || r.Time != "9:00 AM" {
		t.Fatalf("fallback to gemini failed: %+v", r)
	}
	svc.ReadReply(context.Background(), "Haan", "Pickup 10:00 AM")
	if groqHits != 1 {
		t.Fatalf("groq should be skipped while its breaker is open, hits=%d", groqHits)
	}
	if geminiHits != 2 {
		t.Fatalf("gemini hits = %d", geminiHits)
	}
}

func TestRulesWhenModelsFailOrLie(t *testing.T) {
	var hits int32
	bad := groqServer(t, `{"decision":"maybe","time":"","translation":"","language":"","confidence":2}`, 200, &hits)
	defer bad.Close()
	svc := NewService([]Provider{NewGroq([]string{"k"}, bad.URL, "f", "a", "w")}, 5*time.Second, nil, nil)
	r := svc.ReadReply(context.Background(), "nahi ho payega", "x")
	if r.Engine != "rules" || r.Decision != "declined" {
		t.Fatalf("invalid model output must fall back to rules: %+v", r)
	}
	none := NewService(nil, time.Second, nil, nil)
	if got := none.ClassifyMessage(context.Background(), "stuck in traffic"); got.Engine != "rules" || got.Kind != "late" {
		t.Fatalf("no providers: %+v", got)
	}
	if text, eng := none.Explain(context.Background(), "facts", "fallback"); text != "fallback" || eng != "template" {
		t.Fatalf("explain fallback: %q %q", text, eng)
	}
}

func TestExtractWishesSanitizes(t *testing.T) {
	var hits int32
	srv := groqServer(t, `{"wishes":[{"text":" Easy walking ","boosts":["relax","spaceflight"],"lowWalking":true,"kids":false},{"text":"","boosts":[],"lowWalking":false,"kids":false}]}`, 200, &hits)
	defer srv.Close()
	svc := NewService([]Provider{NewGroq([]string{"k"}, srv.URL, "f", "a", "w")}, 5*time.Second, nil, nil)
	wishes, eng, ok := svc.ExtractWishes(context.Background(), "dad can't walk much")
	if !ok || eng != "groq" || len(wishes) != 1 {
		t.Fatalf("wishes: %+v %s %v", wishes, eng, ok)
	}
	if wishes[0].Text != "Easy walking" || len(wishes[0].Boosts) != 1 || !wishes[0].LowWalking {
		t.Fatalf("not sanitized: %+v", wishes[0])
	}
}

func TestKeyRotation(t *testing.T) {
	var badHits, goodHits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer bad" {
			atomic.AddInt32(&badHits, 1)
			w.WriteHeader(429)
			return
		}
		atomic.AddInt32(&goodHits, 1)
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": `{"kind":"late","seriousness":2,"confidence":0.9,"reply":"On it"}`}}}})
	}))
	defer srv.Close()
	svc := NewService([]Provider{NewGroq([]string{"bad", "good", "good"}, srv.URL, "f", "a", "w")}, 5*time.Second, nil, nil)
	for i := 0; i < 3; i++ {
		if m := svc.ClassifyMessage(context.Background(), fmt.Sprintf("stuck in traffic %d", i)); m.Engine != "groq" {
			t.Fatalf("call %d: engine %s", i, m.Engine)
		}
	}
	if badHits != 1 {
		t.Fatalf("rate-limited key should rest after one 429, hits=%d", badHits)
	}
	if goodHits != 3 {
		t.Fatalf("good key hits = %d", goodHits)
	}
}
