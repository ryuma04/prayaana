// Package app holds the dependencies shared by every service.
package app

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"trizpyy/internal/ai"
	"trizpyy/internal/aisvc"
	"trizpyy/internal/config"
	"trizpyy/internal/decision"
	"trizpyy/internal/engine"
	"trizpyy/internal/mail"
	"trizpyy/internal/platform/db"
	"trizpyy/internal/platform/realtime"
	"trizpyy/internal/store"
	"trizpyy/internal/telegram"
)

type Core struct {
	Cfg   config.Config
	Pool  *pgxpool.Pool
	Store *store.Store
	Eng   *engine.Engine
	AI    *ai.Service
	AISvc *aisvc.Client // Python AI service; nil when AI_SERVICE_URL is unset
	// NugenSearch matches traveler questions to catalog experiences with Nugen embeddings.
	NugenSearch *ai.NugenSearch
	// Decisions is the bounded decision layer (Jev → LLM → rules).
	Decisions *decision.Service
	Hub       *realtime.Hub
	Mailer    mail.Mailer     // emails vendors their requests and travelers their updates (when a provider is configured)
	Telegram  telegram.Sender // customer-facing booking confirmation + document delivery
	Docs      DocIssuer
	Now       func() time.Time
}

// Today is the operator's local date (Asia/Kolkata by default).
func (c *Core) Today() string { return c.Now().In(c.Cfg.Location).Format("2006-01-02") }

// NowMin is minutes since local midnight.
func (c *Core) NowMin() int {
	t := c.Now().In(c.Cfg.Location)
	return t.Hour()*60 + t.Minute()
}

func (c *Core) ID(prefix string) string { return engine.RandomID(prefix) }

// Tx runs fn atomically and publishes the collected events only after commit.
func (c *Core) Tx(ctx context.Context, fn func(s *store.Store, ev *Events) error) error {
	var ev Events
	err := db.Tx(ctx, c.Pool, func(tx pgx.Tx) error {
		ev = Events{}
		return fn(c.Store.With(tx), &ev)
	})
	if err != nil {
		return err
	}
	for _, e := range ev.list {
		c.Hub.Publish(e)
	}
	for _, fn := range ev.after {
		go fn()
	}
	return nil
}

// Events collects what to publish once the transaction commits.
type Events struct {
	list  []realtime.Event
	after []func()
}

func (e *Events) Add(ev realtime.Event) { e.list = append(e.list, ev) }

// After runs fn (in its own goroutine) only if the transaction commits, e.g. an email.
func (e *Events) After(fn func()) { e.after = append(e.after, fn) }

// TripEvent builds an event visible to operators and the trip's traveler.
func TripEvent(kind, tripID, ownerID string, data any) realtime.Event {
	return realtime.Event{Type: kind, TripID: tripID, Data: data}.For(ownerID, realtime.AudienceAll)
}

func OperatorEvent(kind string, data any) realtime.Event {
	return realtime.Event{Type: kind, Data: data}.For("", realtime.AudienceOperator)
}
