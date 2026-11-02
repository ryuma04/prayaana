package app

import (
	"context"
	"log/slog"
	"time"

	"trizpyy/internal/domain"
	"trizpyy/internal/mail"
	"trizpyy/internal/store"
)

// NotifyOperators stores an operator notice and queues its realtime event.
func (c *Core) NotifyOperators(ctx context.Context, s *store.Store, ev *Events, kind, title, body, href string) error {
	n := domain.Notification{ID: c.ID("n"), Kind: kind, Title: title, Body: body, Href: href, Audience: "operator", CreatedAt: c.Now().UTC()}
	if err := s.InsertNotification(ctx, "", n); err != nil {
		return err
	}
	ev.Add(OperatorEvent("notice.new", n))
	return nil
}

// NotifyTraveler stores a notice for one traveler (skipped for walk-in customers without an account).
func (c *Core) NotifyTraveler(ctx context.Context, s *store.Store, ev *Events, userID, kind, title, body, href string) error {
	if userID == "" {
		return nil
	}
	n := domain.Notification{ID: c.ID("n"), Kind: kind, Title: title, Body: body, Href: href, Audience: "traveler", CreatedAt: c.Now().UTC()}
	if err := s.InsertNotification(ctx, userID, n); err != nil {
		return err
	}
	ev.Add(TripEvent("notice.new", "", userID, n).For(userID, "traveler"))
	return nil
}

// VendorThread makes sure the operator inbox has a conversation for this vendor.
func (c *Core) VendorThread(ctx context.Context, s *store.Store, vendorID string) (string, error) {
	id := "th-" + vendorID
	v := c.Eng.Cat.Vendor(vendorID)
	name, sub := vendorID, ""
	if v != nil {
		name = v.Name
		sub = v.DestinationID + " · " + v.Kind
	}
	return id, s.UpsertThread(ctx, domain.InboxThread{ID: id, Party: "vendor", Name: name, Subtitle: sub, VendorID: vendorID, Tone: "cream"})
}

// SendToVendor records an outbound request in the vendor's conversation and, when the vendor has
// an email on file and a mail provider is configured, emails it with the reply link. Vendors
// always answer on the link (no login); the operator can also record an answer after a call.
func (c *Core) SendToVendor(ctx context.Context, s *store.Store, ev *Events, vendorID string, msg domain.InboxMessage, link string) error {
	thread, err := c.VendorThread(ctx, s, vendorID)
	if err != nil {
		return err
	}
	if msg.ID == "" {
		msg.ID = c.ID("m")
	}
	msg.At = c.Now().UTC()
	msg.Status = "sent"
	if err := s.AddMessage(ctx, thread, msg, false); err != nil {
		return err
	}
	ev.Add(OperatorEvent("inbox.message", map[string]any{"threadId": thread, "message": msg}))
	if c.Mailer == nil || !c.Mailer.Delivers() {
		return nil
	}
	to, err := s.VendorEmail(ctx, vendorID)
	if err != nil || to == "" {
		return nil
	}
	subject := firstLine(msg.Body)
	ev.After(func() { c.email(mail.Notice(to, subject, msg.Body, link, "Answer this request")) })
	return nil
}

func (c *Core) email(m mail.Message, err error) {
	if err != nil {
		slog.Warn("render email", "err", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := c.Mailer.Send(ctx, m); err != nil {
		slog.Warn("email send failed", "to", m.To, "err", err)
	}
}

func firstLine(s string) string {
	for i, r := range s {
		if r == '\n' || i > 90 {
			return s[:i]
		}
	}
	return s
}
