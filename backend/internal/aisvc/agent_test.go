package aisvc

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

func TestAgentCallsFallBackWhenTheServiceCannotAnswer(t *testing.T) {
	ctx := context.Background()
	var off *Client
	if _, err := off.AskOps(ctx, "q", nil, OpsFacts{}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("unconfigured AskOps: %v", err)
	}
	if _, err := off.InterpretWhatIf(ctx, SimFact{}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("unconfigured InterpretWhatIf: %v", err)
	}
	cases := map[string]struct {
		h    http.HandlerFunc
		want error
	}{
		"down":  {func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }, ErrUnavailable},
		"crash": {func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(500) }, ErrUnavailable},
		"empty": {func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"answer":" ","headline":""}`)) }, ErrInvalidResponse},
		"junk":  {func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("<html>")) }, ErrInvalidResponse},
	}
	for name, tc := range cases {
		srv := httptest.NewServer(tc.h)
		c := New(srv.URL, time.Second)
		if _, err := c.AskOps(ctx, "q", nil, OpsFacts{}); !errors.Is(err, tc.want) {
			t.Errorf("%s AskOps: got %v, want %v", name, err, tc.want)
		}
		if _, err := c.InterpretWhatIf(ctx, SimFact{}); !errors.Is(err, tc.want) {
			t.Errorf("%s InterpretWhatIf: got %v, want %v", name, err, tc.want)
		}
		srv.Close()
	}
}

func TestAgentContract(t *testing.T) {
	var gotPath, gotReqID string
	var body map[string]json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotReqID = r.URL.Path, r.Header.Get("X-Request-ID")
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch r.URL.Path {
		case "/v1/agent/ops/ask":
			w.Write([]byte(`{"answer":"TRZ-1 is at risk.","engine":"groq","tools":["find_at_risk_trips"],"actions":[{"kind":"open","label":"Open","href":"/ops/tours"}],"confidence":0.8}`))
		case "/v1/agent/whatif/interpret":
			w.Write([]byte(`{"headline":"2 trips affected","summary":"s","consequences":["c"],"recommendation":{"action":"fix_all","reason":"r"},"priorities":[{"trip_code":"TRZ-1","reason":"most money"}],"engine":"rules","confidence":1}`))
		}
	}))
	defer srv.Close()
	c := New(srv.URL, time.Second)
	ctx := context.WithValue(context.Background(), middleware.RequestIDKey, "req-42")

	ans, err := c.AskOps(ctx, "which trips are at risk?", []Turn{{From: "operator", Text: "hi"}}, OpsFacts{Today: "2026-10-01", Trips: []TripFact{{Code: "TRZ-1"}}})
	if err != nil || ans.Answer == "" || ans.Tools[0] != "find_at_risk_trips" || ans.Actions[0].Href != "/ops/tours" {
		t.Fatalf("AskOps: %+v %v", ans, err)
	}
	if gotPath != "/v1/agent/ops/ask" || gotReqID != "req-42" {
		t.Fatalf("path %q request id %q", gotPath, gotReqID)
	}
	for _, k := range []string{"question", "history", "facts"} {
		if _, ok := body[k]; !ok {
			t.Fatalf("request is missing %q", k)
		}
	}

	in, err := c.InterpretWhatIf(ctx, SimFact{Title: "Rain", Totals: SimTotals{Tours: 2}})
	if err != nil || in.Recommendation.Action != "fix_all" || in.Priorities[0].TripCode != "TRZ-1" {
		t.Fatalf("InterpretWhatIf: %+v %v", in, err)
	}
	if _, ok := body["simulation"]; !ok || gotPath != "/v1/agent/whatif/interpret" {
		t.Fatalf("what-if request: %s %v", gotPath, body)
	}
}

// Agent calls wait on an LLM, so they must not inherit the optimizer's short timeout.
func TestAgentUsesLongerTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		w.Write([]byte(`{"answer":"ok"}`))
	}))
	defer srv.Close()
	c := New(srv.URL, 50*time.Millisecond)
	if _, err := c.AskOps(context.Background(), "q", nil, OpsFacts{}); err != nil {
		t.Fatalf("agent call hit the short timeout: %v", err)
	}
}
