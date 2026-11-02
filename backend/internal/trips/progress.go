package trips

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

// RunProgress keeps trip statuses in step with the calendar: booked trips go live on
// their first day. Completing a trip is the operator's call (see Complete).
func (s *Service) RunProgress(ctx context.Context) {
	tick := time.NewTicker(5 * time.Minute)
	defer tick.Stop()
	for {
		if err := s.Progress(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("trip progress", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (s *Service) Progress(ctx context.Context) error {
	today := s.Today()
	list, err := s.Store.ListTrips(ctx, store.TripFilter{Statuses: []string{domain.TripBooked, domain.TripLive}})
	if err != nil {
		return err
	}
	for _, t := range list {
		if progressed(t, today) == nil {
			continue
		}
		owner, err := s.Store.TripOwner(ctx, t.ID)
		if err != nil {
			return err
		}
		err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
			locked, err := st.LockTrip(ctx, t.ID)
			if err != nil {
				return err
			}
			next := progressed(locked, today)
			if next == nil {
				return nil
			}
			if err := st.SaveTrip(ctx, next); err != nil {
				return err
			}
			ev.Add(app.TripEvent("trip.updated", t.ID, owner, map[string]string{"reason": "progress"}))
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// progressed returns the trip with today's status applied, or nil when nothing changes.
func progressed(t *domain.Trip, today string) *domain.Trip {
	if engine.DaysBetween(t.Prefs.StartDate, today) < 0 {
		return nil
	}
	// After the last day the trip stays live on its last day until the operator completes it.
	day := min(engine.CurrentDayOf(t, today), t.Prefs.Days())
	if t.Status == domain.TripLive && t.CurrentDay != nil && *t.CurrentDay == day {
		return nil
	}
	c := t.Clone()
	c.Status, c.CurrentDay = domain.TripLive, &day
	for i := range c.Items {
		it := &c.Items[i]
		switch {
		case it.Status == domain.ItemCancelled:
		case it.Day < day:
			it.Status = domain.ItemDone
		case it.Status == domain.ItemPlanned:
			it.Status = domain.ItemConfirmed
		}
	}
	return c
}

// Complete is the operator closing a trip. The traveler is then asked for end-of-trip feedback.
func (s *Service) Complete(ctx context.Context, tripID string) (View, error) {
	var out View
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if errors.Is(err, store.ErrNotFound) {
			return httpx.NotFound("We couldn't find that trip.")
		}
		if err != nil {
			return err
		}
		if t.Status != domain.TripBooked && t.Status != domain.TripLive {
			return httpx.Conflict("Only a booked or live trip can be completed.")
		}
		c := t.Clone()
		c.Status, c.CurrentDay = domain.TripCompleted, nil
		for i := range c.Items {
			if c.Items[i].Status != domain.ItemCancelled {
				c.Items[i].Status = domain.ItemDone
			}
		}
		if err := st.SaveTrip(ctx, c); err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, tripID)
		if err != nil {
			return err
		}
		if owner != "" {
			if err := s.NotifyTraveler(ctx, st, ev, owner, "trip", c.Title+" is complete",
				"How did it go? Share your feedback, it tunes your Travel DNA for the next trip.", "/review"); err != nil {
				return err
			}
			if err := s.MessageTraveler(ctx, st, ev, c, owner, fmt.Sprintf("%s is complete. Thank you for travelling with us! Tell us how it went: rate your experiences on the Review page.", c.Code), nil); err != nil {
				return err
			}
		}
		out = s.view(c)
		ev.Add(app.TripEvent("trip.updated", tripID, owner, map[string]string{"reason": "completed"}))
		return nil
	})
	return out, err
}
