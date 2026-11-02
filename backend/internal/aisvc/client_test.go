package aisvc

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientFailuresFallBack(t *testing.T) {
	ctx := context.Background()
	var nilClient *Client
	if _, err := nilClient.Search(ctx, "quiet", "", 3); !errors.Is(err, ErrUnavailable) || nilClient.Status() != "off" {
		t.Fatalf("unconfigured client: %v", err)
	}

	cases := map[string]struct {
		h    http.HandlerFunc
		want error
	}{
		"down":      {func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }, ErrUnavailable},
		"crash":     {func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(500) }, ErrUnavailable},
		"slow":      {func(w http.ResponseWriter, r *http.Request) { time.Sleep(300 * time.Millisecond) }, ErrUnavailable},
		"malformed": {func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("<html>")) }, ErrInvalidResponse},
		"short": {func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"risks":[],"metadata":{}}`))
		}, ErrInvalidResponse},
	}
	for name, tc := range cases {
		srv := httptest.NewServer(tc.h)
		c := New(srv.URL, 100*time.Millisecond)
		_, _, err := c.DelayRisk(ctx, []Transfer{{TransferID: "x", Mode: "bus"}})
		if !errors.Is(err, tc.want) {
			t.Errorf("%s: got %v, want %v", name, err, tc.want)
		}
		srv.Close()
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(422)
		w.Write([]byte(`{"error":{"code":"validation","message":"The request is not valid."}}`))
	}))
	defer srv.Close()
	var e *Error
	if _, err := New(srv.URL, time.Second).OptimizeDay(ctx, OptimizeRequest{}); !errors.As(err, &e) || e.Code != "validation" {
		t.Fatalf("validation error not surfaced: %v", err)
	}
}
