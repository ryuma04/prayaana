// Package confirm implements the all-or-nothing vendor confirmation (allaboutourproject.md §12.6):
// a change is saved only when every affected vendor says yes before the deadline.
package confirm

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
	"trizpyy/internal/store"
)

type Service struct {
	*app.Core
	mu      sync.Mutex
	waiters map[string][]chan struct{}
}

func New(c *app.Core) *Service { return &Service{Core: c, waiters: map[string][]chan struct{}{}} }

type Round struct {
	ID       string
	Requests []domain.VendorRequest
	Deadline time.Time
}

// Open creates a confirmation round and sends every vendor a change request. Call inside a transaction.
func (s *Service) Open(ctx context.Context, st *store.Store, ev *app.Events, t *domain.Trip, inc *domain.Incident, plan domain.FixPlan, runID string, attempt int, timeout time.Duration) (Round, error) {
	now := s.Now().UTC()
	r := Round{ID: s.ID("cnf"), Deadline: now.Add(timeout)}
	if err := st.InsertConfirmation(ctx, store.Confirmation{ID: r.ID, IncidentID: inc.ID, RunID: runID, TripID: t.ID, Plan: plan,
		Attempt: attempt, Phase: "asking", DeadlineAt: r.Deadline}); err != nil {
		return r, err
	}
	for _, d := range s.Eng.VendorRequests(t, plan) {
		r.Requests = append(r.Requests, domain.VendorRequest{
			Token: s.ID("vr"), ConfirmationID: r.ID, RunID: runID, IncidentID: inc.ID, TripID: t.ID, VendorID: d.VendorID,
			TravelerName: t.CustomerName, DateLabel: d.DateLabel, Original: d.Original, Proposed: d.Proposed, ItemTitle: d.ItemTitle,
			Status: domain.AnswerPending, CreatedAt: now, Kind: "change",
		})
	}
	if len(r.Requests) == 0 {
		return r, nil
	}
	if err := st.InsertRequests(ctx, r.Requests); err != nil {
		return r, err
	}
	for _, req := range r.Requests {
		link := fmt.Sprintf("%s/v/%s", s.Cfg.PublicWeb, req.Token)
		body := fmt.Sprintf("Change request · %s · %s\nPlease answer by %s: %s", t.Code, strings.ReplaceAll(req.Proposed, "\n", " · "),
			r.Deadline.In(s.Cfg.Location).Format("3:04 PM"), link)
		if err := s.SendToVendor(ctx, st, ev, req.VendorID, domain.InboxMessage{From: "us", Type: "template", Body: body}, link); err != nil {
			return r, err
		}
	}
	return r, nil
}

// Reply records a vendor's answer (button, voice or web link). It is a no-op if already answered.
func (s *Service) Reply(ctx context.Context, req domain.VendorRequest, answer, channel, altTime string, voice *domain.VoiceInterpretation) (bool, error) {
	var applied bool
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		ok, err := st.AnswerRequest(ctx, req.Token, answer, channel, altTime, voice)
		if err != nil || !ok {
			return err
		}
		applied = true
		thread, err := s.VendorThread(ctx, st, req.VendorID)
		if err != nil {
			return err
		}
		labels := map[string]string{domain.AnswerYes: "Yes", domain.AnswerNo: "No", domain.AnswerOtherTime: "Other time"}
		msg := domain.InboxMessage{ID: s.ID("m"), From: "them", Type: "button", Body: labels[answer], At: s.Now().UTC()}
		switch channel {
		case "web":
			msg.Type, msg.Body = "text", labels[answer]+" (reply link)"
		case "phone":
			msg.Type, msg.Body = "text", labels[answer]+" (recorded by operator after a call)"
		}
		if altTime != "" {
			msg.Body += " · " + altTime
		}
		if voice != nil {
			msg.Type, msg.Body, msg.Transcript = "voice", voice.AudioLabel, voice.Transcript
			msg.Decision = fmt.Sprintf("%s%s", voice.Decision, suffix(voice.Time))
			msg.Confidence = &voice.Confidence
		}
		if err := st.AddMessage(ctx, thread, msg, answer != domain.AnswerYes); err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, req.TripID)
		if err != nil {
			return err
		}
		ev.Add(app.TripEvent("confirm.progress", req.TripID, owner, map[string]any{"runId": req.RunID, "token": req.Token,
			"vendorId": req.VendorID, "answer": answer, "channel": channel, "altTime": altTime, "voice": voice}))
		return nil
	})
	if applied {
		s.signal(req.ConfirmationID)
	}
	return applied, err
}

func suffix(t string) string {
	if t == "" {
		return ""
	}
	return " · " + t
}

func (s *Service) subscribe(id string) (chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	s.mu.Lock()
	s.waiters[id] = append(s.waiters[id], ch)
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		list := s.waiters[id]
		for i, c := range list {
			if c == ch {
				s.waiters[id] = append(list[:i], list[i+1:]...)
				break
			}
		}
		if len(s.waiters[id]) == 0 {
			delete(s.waiters, id)
		}
	}
}

func (s *Service) signal(id string) {
	if id == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, ch := range s.waiters[id] {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

// Await blocks until every vendor in the round has answered or the deadline passes.
// onAnswer is called once per newly answered request, in arrival order.
func (s *Service) Await(ctx context.Context, r Round, onAnswer func(domain.VendorRequest)) ([]domain.VendorRequest, error) {
	ch, done := s.subscribe(r.ID)
	defer done()
	seen := map[string]bool{}
	poll := time.NewTicker(2 * time.Second)
	defer poll.Stop()
	for {
		list, err := s.Store.RequestsForConfirmation(ctx, r.ID)
		if err != nil {
			return nil, err
		}
		pending := 0
		for _, q := range list {
			if q.Status == domain.AnswerPending {
				pending++
			} else if !seen[q.Token] {
				seen[q.Token] = true
				if onAnswer != nil {
					onAnswer(q)
				}
			}
		}
		if pending == 0 {
			return list, nil
		}
		if s.Now().After(r.Deadline) {
			if _, err := s.Store.ExpireConfirmations(ctx, s.Now().UTC()); err != nil {
				return nil, err
			}
			continue
		}
		wait := time.Until(r.Deadline) + 50*time.Millisecond
		timer := time.NewTimer(max(wait, 10*time.Millisecond))
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-ch:
		case <-poll.C:
		case <-timer.C:
		}
		timer.Stop()
	}
}

// Undo cancels the round: vendors who said yes are told the request is withdrawn.
func (s *Service) Undo(ctx context.Context, st *store.Store, ev *app.Events, t *domain.Trip, r Round, results []domain.VendorRequest) error {
	var yes []string
	for _, q := range results {
		if q.Status == domain.AnswerYes {
			yes = append(yes, q.Token)
		}
	}
	if err := st.CancelRequests(ctx, yes); err != nil {
		return err
	}
	for _, q := range results {
		if q.Status != domain.AnswerYes {
			continue
		}
		if err := s.SendToVendor(ctx, st, ev, q.VendorID, domain.InboxMessage{From: "us", Type: "text",
			Body: fmt.Sprintf("Request cancelled · %s · no change needed, the original booking stands. Thank you!", t.Code)}, ""); err != nil {
			return err
		}
	}
	return st.SetConfirmationPhase(ctx, r.ID, "undone")
}

// RunSweeper times out rounds whose deadline passed and wakes their waiters.
func (s *Service) RunSweeper(ctx context.Context) {
	tick := time.NewTicker(3 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			ids, err := s.Store.ExpireConfirmations(ctx, s.Now().UTC())
			if err != nil {
				if ctx.Err() == nil {
					slog.Warn("confirmation sweeper", "err", err)
				}
				continue
			}
			for _, id := range ids {
				s.signal(id)
			}
		}
	}
}

// AnswerFor maps a decision-service reading to a confirmation answer.
func AnswerFor(decision string) string {
	switch decision {
	case "confirmed":
		return domain.AnswerYes
	case "other_time":
		return domain.AnswerOtherTime
	}
	return domain.AnswerNo
}
