package app

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/store"
)

// SendBookingConfirmationTelegram schedules the confirmed-booking message and
// the trip PDFs for the traveler's linked Telegram chat, only after the payment
// transaction commits. It replaces the customer-facing WhatsApp delivery.
// A Telegram failure never rolls back a confirmed booking: the in-app message
// and the email remain the durable customer record.
func (c *Core) SendBookingConfirmationTelegram(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, docs []domain.Document) {
	if c.Telegram == nil || !c.Telegram.Enabled() {
		return
	}
	var conn store.TelegramConnection
	var found bool

	owner, _ := s.TripOwner(ctx, t.ID)
	if owner != "" {
		if c, err := s.TelegramConnection(ctx, owner); err == nil && c.Status == "connected" {
			conn = c
			found = true
		}
	}
	if !found {
		contact, _ := s.TripContact(ctx, t.ID)
		if contact.Phone != "" {
			if c, err := s.TelegramConnectionByPhoneOrEmail(ctx, contact.Phone); err == nil && c.Status == "connected" {
				conn = c
				found = true
			}
		}
		if !found && contact.Email != "" {
			if c, err := s.TelegramConnectionByPhoneOrEmail(ctx, contact.Email); err == nil && c.Status == "connected" {
				conn = c
				found = true
			}
		}
	}
	if !found {
		if c.Cfg.TelegramDefaultChatID != 0 {
			conn = store.TelegramConnection{
				ChatID: c.Cfg.TelegramDefaultChatID,
				Status: "connected",
			}
			found = true
		} else {
			slog.Debug("telegram: no linked chat found for trip traveler", "trip", t.Code)
			return
		}
	}

	dest := t.DestinationID
	if d := c.Eng.Cat.Destination(t.DestinationID); d != nil {
		dest = d.Name
	}
	text := fmt.Sprintf("🎉 Trizpyy Booking Confirmed!\n\nBooking ID: %s\n\n📅 %s → %s\n📍 %s\n\nYour travel documents are attached below.",
		t.Code, engine.DayDate(t.Prefs.StartDate, 1), engine.DayDate(t.Prefs.StartDate, t.Prefs.Nights+1), dest)
	tripID, code := t.ID, t.Code
	ev.After(func() {
		sendCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		defer cancel()
		if err := c.Telegram.SendMessage(sendCtx, conn.ChatID, text); err != nil {
			slog.Warn("telegram booking confirmation failed", "trip", code, "err", err)
			return
		}
		// Deliver all confirmed PDF documents directly to the traveler's Telegram.
		for _, d := range docs {
			doc, content, err := c.Store.DocumentContent(sendCtx, tripID, d.ID)
			if err != nil {
				slog.Warn("telegram document read failed", "trip", code, "doc", d.ID, "err", err)
				continue
			}
			if err := c.Telegram.SendDocument(sendCtx, conn.ChatID, doc.FileName, content, doc.Title); err != nil {
				slog.Warn("telegram document delivery failed", "trip", code, "doc", doc.FileName, "err", err)
			}
		}
		if conn.UserID != "" {
			_ = c.Store.TouchTelegramVerified(context.Background(), conn.UserID)
		}
	})
}
