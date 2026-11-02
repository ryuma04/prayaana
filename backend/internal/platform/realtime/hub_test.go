package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestVisibility(t *testing.T) {
	op := &client{userID: "u-op", role: "operator"}
	me := &client{userID: "u-1", role: "traveler"}
	other := &client{userID: "u-2", role: "traveler"}
	tripEvent := Event{Type: "trip.updated"}.For("u-1", AudienceAll)
	opOnly := Event{Type: "notice.new"}.For("", AudienceOperator)
	travelerNote := Event{Type: "notice.new"}.For("u-1", AudienceTraveler)

	checks := []struct {
		ev   Event
		c    *client
		want bool
	}{
		{tripEvent, op, true}, {tripEvent, me, true}, {tripEvent, other, false},
		{opOnly, op, true}, {opOnly, me, false},
		{travelerNote, op, false}, {travelerNote, me, true}, {travelerNote, other, false},
	}
	for i, c := range checks {
		if got := visible(c.ev, c.c); got != c.want {
			t.Errorf("case %d: visible=%v want %v", i, got, c.want)
		}
	}
}

func TestServeStreamsEvents(t *testing.T) {
	hub := NewHub([]string{"*"})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub.Serve(w, r, r.URL.Query().Get("u"), r.URL.Query().Get("role"))
	}))
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.Dial(ctx, url+"?u=u-1&role=traveler", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()

	read := func() Event {
		_, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var ev Event
		_ = json.Unmarshal(data, &ev)
		return ev
	}
	if ev := read(); ev.Type != "hello" {
		t.Fatalf("first frame = %s", ev.Type)
	}
	for hub.Clients() == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	hub.Publish(Event{Type: "trip.updated", TripID: "trp-x"}.For("u-2", AudienceAll))
	hub.Publish(Event{Type: "trip.updated", TripID: "trp-mine"}.For("u-1", AudienceAll))
	if ev := read(); ev.TripID != "trp-mine" {
		t.Fatalf("traveler received someone else's event: %+v", ev)
	}
}
