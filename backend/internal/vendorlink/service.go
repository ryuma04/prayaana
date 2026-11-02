// Package vendorlink handles vendor replies: the public reply link (buttons, a typed reply or a
// voice note, no login) and answers the operator records after calling the vendor.
package vendorlink

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"trizpyy/internal/app"
	"trizpyy/internal/booking"
	"trizpyy/internal/confirm"
	"trizpyy/internal/domain"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

type Service struct {
	*app.Core
	confirm *confirm.Service
	booking *booking.Service
}

func New(c *app.Core, cf *confirm.Service, b *booking.Service) *Service {
	return &Service{Core: c, confirm: cf, booking: b}
}

type Page struct {
	Request domain.VendorRequest `json:"req"`
	Vendor  *domain.Vendor       `json:"vendor"`
	Open    bool                 `json:"open"`
}

var errLink = httpx.NotFound("This link has expired or is not valid.")

func (s *Service) Get(ctx context.Context, token string) (Page, error) {
	req, err := s.Store.GetRequest(ctx, strings.TrimSpace(token))
	if errors.Is(err, store.ErrNotFound) {
		return Page{}, errLink
	}
	if err != nil {
		return Page{}, err
	}
	return Page{Request: req, Vendor: s.Eng.Cat.Vendor(req.VendorID), Open: req.Status == domain.AnswerPending}, nil
}

type ReplyInput struct {
	Answer  string `json:"answer"`
	AltTime string `json:"altTime"`
}

func (s *Service) Reply(ctx context.Context, token string, in ReplyInput, channel string) (Page, error) {
	if in.Answer != domain.AnswerYes && in.Answer != domain.AnswerNo && in.Answer != domain.AnswerOtherTime {
		return Page{}, httpx.BadRequest("answer must be yes, no or other_time.")
	}
	if len(in.AltTime) > 40 {
		return Page{}, httpx.BadRequest("Suggested time is too long.")
	}
	page, err := s.Get(ctx, token)
	if err != nil {
		return Page{}, err
	}
	if !page.Open {
		return page, httpx.Conflict("This request was already answered. Thank you!")
	}
	if err := s.apply(ctx, page.Request, in.Answer, channel, strings.TrimSpace(in.AltTime), nil); err != nil {
		return Page{}, err
	}
	return s.Get(ctx, token)
}

func (s *Service) apply(ctx context.Context, req domain.VendorRequest, answer, channel, altTime string, voice *domain.VoiceInterpretation) error {
	if req.Kind == "booking" {
		return s.booking.AnswerBooking(ctx, req, answer, channel, altTime, voice)
	}
	_, err := s.confirm.Reply(ctx, req, answer, channel, altTime, voice)
	return err
}

type VoiceInput struct {
	Audio      []byte
	Filename   string
	Mime       string
	Transcript string
}

type VoiceResult struct {
	Page
	Voice   domain.VoiceInterpretation `json:"voice"`
	Applied bool                       `json:"applied"`
}

// Voice transcribes a voice note (or takes a typed transcript), decides what it means and applies it.
func (s *Service) Voice(ctx context.Context, token string, in VoiceInput) (VoiceResult, error) {
	page, err := s.Get(ctx, token)
	if err != nil {
		return VoiceResult{}, err
	}
	if !page.Open {
		return VoiceResult{Page: page}, httpx.Conflict("This request was already answered. Thank you!")
	}
	v, err := s.interpret(ctx, page.Request, in)
	if err != nil {
		return VoiceResult{}, err
	}
	if v.Decision == "needs_call" {
		if err := s.flagCall(ctx, page.Request, v); err != nil {
			return VoiceResult{}, err
		}
		return VoiceResult{Page: page, Voice: v}, nil
	}
	if err := s.apply(ctx, page.Request, confirm.AnswerFor(v.Decision), "voice", v.Time, &v); err != nil {
		return VoiceResult{}, err
	}
	next, err := s.Get(ctx, token)
	return VoiceResult{Page: next, Voice: v, Applied: true}, err
}

func (s *Service) interpret(ctx context.Context, req domain.VendorRequest, in VoiceInput) (domain.VoiceInterpretation, error) {
	text, lang := strings.TrimSpace(in.Transcript), ""
	label := "Typed reply"
	if len(in.Audio) > 0 {
		t, _, err := s.AI.Transcribe(ctx, in.Audio, orDefault(in.Filename, "voice.ogg"), in.Mime)
		if err != nil {
			return domain.VoiceInterpretation{}, httpx.Unavailable("We couldn't understand the voice note. Please tap a button instead.")
		}
		text, lang, label = t.Text, t.Language, "Voice note"
	}
	if text == "" {
		return domain.VoiceInterpretation{}, httpx.BadRequest("Send a voice note or type your reply.")
	}
	if len(text) > 1000 {
		text = text[:1000]
	}
	r := s.AI.ReadReply(ctx, text, req.Proposed)
	if r.Language == "" || r.Language == "Unknown" {
		r.Language = orDefault(capitalize(lang), "Unknown")
	}
	return domain.VoiceInterpretation{AudioLabel: label, DurationSec: 0, Transcript: text, Translation: r.Translation,
		Decision: r.Decision, Time: r.Time, Confidence: r.Confidence, Language: r.Language}, nil
}

// flagCall keeps the request open and asks a human to call the vendor.
func (s *Service) flagCall(ctx context.Context, req domain.VendorRequest, v domain.VoiceInterpretation) error {
	return s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		thread, err := s.VendorThread(ctx, st, req.VendorID)
		if err != nil {
			return err
		}
		conf := v.Confidence
		if err := st.AddMessage(ctx, thread, domain.InboxMessage{ID: s.ID("m"), From: "them", Type: "voice", Body: v.AudioLabel,
			Transcript: v.Transcript, Decision: "Needs a call", Confidence: &conf, At: s.Now().UTC()}, true); err != nil {
			return err
		}
		return s.NotifyOperators(ctx, st, ev, "vendor", s.Eng.Cat.VendorName(req.VendorID)+" wants a call",
			fmt.Sprintf("“%s” · about %s", v.Transcript, req.ItemTitle), "/ops/inbox")
	})
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

// Record is the operator entering a vendor's answer after a phone call. It goes through the
// same path as a reply on the link, so the booking or all-or-nothing round updates the same way.
func (s *Service) Record(ctx context.Context, token string, in ReplyInput) (Page, error) {
	return s.Reply(ctx, token, in, "phone")
}

// Pending lists every open vendor request (booking and change) for the operator's queue.
func (s *Service) Pending(ctx context.Context) ([]PendingRequest, error) {
	list, err := s.Store.PendingRequests(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PendingRequest, 0, len(list))
	for _, r := range list {
		p := PendingRequest{Request: r, Link: s.Cfg.PublicWeb + "/v/" + r.Token}
		if v := s.Eng.Cat.Vendor(r.VendorID); v != nil {
			p.VendorName, p.VendorKind = v.Name, v.Kind
		}
		if c, err := s.Store.VendorContactOf(ctx, r.VendorID); err == nil {
			p.ContactName, p.Phone, p.Email = c.ContactName, c.Phone, c.Email
		}
		out = append(out, p)
	}
	return out, nil
}

type PendingRequest struct {
	Request     domain.VendorRequest `json:"request"`
	Link        string               `json:"link"`
	VendorName  string               `json:"vendorName"`
	VendorKind  string               `json:"vendorKind"`
	ContactName string               `json:"contactName"`
	Phone       string               `json:"phone"`
	Email       string               `json:"email"`
}
