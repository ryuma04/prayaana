// Package realtime fans server events out to WebSocket clients.
// Operators receive every operator event; travelers only events for trips they own.
package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Event names follow allaboutourproject.md §16.6.
type Event struct {
	Type   string `json:"type"`
	TripID string `json:"tripId,omitempty"`
	Data   any    `json:"data,omitempty"`
	At     string `json:"at"`

	ownerID  string
	audience string
}

// For marks who may see an event: the trip owner (traveler user id) and/or operators.
func (e Event) For(ownerUserID string, audience string) Event {
	e.ownerID = ownerUserID
	e.audience = audience
	return e
}

const (
	AudienceAll      = ""
	AudienceOperator = "operator"
	AudienceTraveler = "traveler"
)

type client struct {
	userID string
	role   string
	send   chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*client]struct{}
	origins []string
}

func NewHub(origins []string) *Hub {
	return &Hub{clients: map[*client]struct{}{}, origins: origins}
}

func (h *Hub) Publish(ev Event) {
	if ev.At == "" {
		ev.At = time.Now().UTC().Format(time.RFC3339Nano)
	}
	payload, err := json.Marshal(ev)
	if err != nil {
		slog.Error("realtime marshal", "type", ev.Type, "err", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if !visible(ev, c) {
			continue
		}
		select {
		case c.send <- payload:
		default:
		}
	}
}

func visible(ev Event, c *client) bool {
	if c.role == "operator" {
		return ev.audience != AudienceTraveler
	}
	if ev.audience == AudienceOperator {
		return false
	}
	return ev.ownerID != "" && ev.ownerID == c.userID
}

// Serve upgrades an authenticated request to a WebSocket and streams events.
func (h *Hub) Serve(w http.ResponseWriter, r *http.Request, userID, role string) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: patterns(h.origins)})
	if err != nil {
		return
	}
	c := &client{userID: userID, role: role, send: make(chan []byte, 64)}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
		conn.CloseNow()
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go func() {
		defer cancel()
		for {
			if _, _, err := conn.Read(ctx); err != nil {
				return
			}
		}
	}()
	hello, _ := json.Marshal(Event{Type: "hello", At: time.Now().UTC().Format(time.RFC3339Nano), Data: map[string]string{"role": role}})
	c.send <- hello
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			conn.Close(websocket.StatusNormalClosure, "")
			return
		case msg := <-c.send:
			wctx, wcancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Write(wctx, websocket.MessageText, msg)
			wcancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, pcancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Ping(pctx)
			pcancel()
			if err != nil {
				return
			}
		}
	}
}

func patterns(origins []string) []string {
	out := []string{"*.vercel.app", "localhost:*", "127.0.0.1:*"}
	for _, o := range origins {
		for _, p := range []string{"http://", "https://"} {
			if len(o) > len(p) && o[:len(p)] == p {
				o = o[len(p):]
			}
		}
		out = append(out, o)
	}
	return out
}

func (h *Hub) Clients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
