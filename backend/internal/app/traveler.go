package app

import (
	"context"
	"fmt"

	"trizpyy/internal/domain"
	"trizpyy/internal/mail"
	"trizpyy/internal/platform/realtime"
	"trizpyy/internal/store"
)

// DocIssuer issues trip PDFs inside the caller's transaction (implemented by documents.Service).
type DocIssuer interface {
	Issue(ctx context.Context, st *store.Store, t *domain.Trip, kinds []string, reason string) ([]domain.Document, error)
}

// TravelerThreadID is the in-app chat for one trip (traveler ⇄ trip assistant ⇄ operator).
func TravelerThreadID(tripID string) string { return "th-trip-" + tripID }

// TravelerThread makes sure the trip has a traveler conversation in the operator inbox.
func (c *Core) TravelerThread(ctx context.Context, s *store.Store, t *domain.Trip) (string, error) {
	id := TravelerThreadID(t.ID)
	sub := t.Code
	if d := c.Eng.Cat.Destination(t.DestinationID); d != nil {
		sub += " · " + d.Name
	}
	return id, s.UpsertThread(ctx, domain.InboxThread{ID: id, Party: "traveler", Name: t.CustomerName, Subtitle: sub, TripID: t.ID, Tone: "mint"})
}

// travelerMessage stores one message in the trip chat and queues its events: operators see it
// in the inbox, the traveler sees it in the trip's Messages tab.
func (c *Core) travelerMessage(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, owner, thread string, msg domain.InboxMessage, unread bool) (domain.InboxMessage, error) {
	if msg.ID == "" {
		msg.ID = c.ID("m")
	}
	if msg.At.IsZero() {
		msg.At = c.Now().UTC()
	}
	if err := s.AddMessage(ctx, thread, msg, unread); err != nil {
		return msg, err
	}
	ev.Add(OperatorEvent("inbox.message", map[string]any{"threadId": thread, "message": msg}))
	if owner != "" {
		ev.Add(realtime.Event{Type: "chat.message", TripID: t.ID, Data: map[string]any{"threadId": thread, "message": msg}}.For(owner, realtime.AudienceTraveler))
	}
	return msg, nil
}

// MessageTraveler posts a trip update (with any documents attached) to the trip chat. When a mail
// provider is configured it is also emailed to the lead traveler with a link back to the trip.
func (c *Core) MessageTraveler(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, owner, body string, docs []domain.Document) error {
	thread, err := c.TravelerThread(ctx, s, t)
	if err != nil {
		return err
	}
	if _, err := c.travelerMessage(ctx, s, ev, t, owner, thread, domain.InboxMessage{From: "us", Type: "template", Body: body, Status: "delivered"}, false); err != nil {
		return err
	}
	text := body
	for _, d := range docs {
		att := &domain.Attachment{Name: d.FileName, Size: sizeLabel(d.SizeBytes), DocID: d.ID}
		if _, err := c.travelerMessage(ctx, s, ev, t, owner, thread, domain.InboxMessage{From: "us", Type: "attachment", Body: d.Title, Attachment: att, Status: "delivered"}, false); err != nil {
			return err
		}
		text += "\nDocument: " + d.Title
	}
	c.emailTraveler(ctx, s, ev, t, text, docs)
	return nil
}

func (c *Core) emailTraveler(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, text string, docs []domain.Document) {
	if c.Mailer == nil || !c.Mailer.Delivers() {
		return
	}
	contact, err := s.TripContact(ctx, t.ID)
	if err != nil || contact.Email == "" {
		return
	}
	link := fmt.Sprintf("%s/my-trip/%s", c.Cfg.PublicWeb, t.ID)
	// Tickets, receipts and vouchers go with the email as PDF files.
	var files []mail.Attachment
	for _, d := range docs {
		if _, content, err := s.DocumentContent(ctx, t.ID, d.ID); err == nil && len(content) > 0 {
			files = append(files, mail.Attachment{Name: d.FileName, ContentType: "application/pdf", Data: content})
		}
	}
	ev.After(func() {
		m, err := mail.Notice(contact.Email, firstLine(text), text, link, "Open my trip")
		m.Attachments = files
		c.email(m, err)
	})
}

// TravelerSays records a message the traveler sent from the trip chat.
func (c *Core) TravelerSays(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, owner string, msg domain.InboxMessage) (domain.InboxMessage, error) {
	thread, err := c.TravelerThread(ctx, s, t)
	if err != nil {
		return msg, err
	}
	msg.From = "them"
	return c.travelerMessage(ctx, s, ev, t, owner, thread, msg, true)
}

// ReplyToTraveler records an answer in the trip chat (the trip assistant or an operator).
func (c *Core) ReplyToTraveler(ctx context.Context, s *store.Store, ev *Events, t *domain.Trip, owner string, msg domain.InboxMessage) (domain.InboxMessage, error) {
	thread, err := c.TravelerThread(ctx, s, t)
	if err != nil {
		return msg, err
	}
	if msg.From == "" {
		msg.From = "us"
	}
	if msg.Status == "" {
		msg.Status = "delivered"
	}
	return c.travelerMessage(ctx, s, ev, t, owner, thread, msg, false)
}

func sizeLabel(n int) string {
	if n >= 1<<20 {
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	}
	return fmt.Sprintf("%d KB", max(1, (n+512)/1024))
}
