package agent

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/confirm"
	"trizpyy/internal/documents"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/learning"
	"trizpyy/internal/store"
)

func (s *Service) withdraw(ctx context.Context, runID string) {
	if err := s.Store.WithdrawRun(ctx, runID); err != nil {
		slog.Error("withdraw run requests", "run", runID, "err", err)
	}
}

func (s *Service) facts(t *domain.Trip, inc *domain.Incident, plan domain.FixPlan) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Trip: %s to %s. Problem: %s (Day %d). %s\nChanges:\n", t.Title, t.DestinationID, inc.Title, inc.Day, inc.Detail)
	for _, a := range plan.Actions {
		fmt.Fprintf(&b, "- %s\n", a.Label)
	}
	switch {
	case plan.CostDelta < 0:
		fmt.Fprintf(&b, "Money: traveler saves %s (refund).", engine.Rupees(-plan.CostDelta))
	case plan.CostDelta > 0:
		fmt.Fprintf(&b, "Money: costs %s extra.", engine.Rupees(plan.CostDelta))
	default:
		b.WriteString("Money: no extra cost.")
	}
	return b.String()
}

// commit applies a fully confirmed plan in one transaction and writes the Change Receipt.
func (s *Service) commit(ctx context.Context, tl *timeline, run domain.AgentRun, inc *domain.Incident, owner string, plan domain.FixPlan,
	round confirm.Round, results []domain.VendorRequest, attempt int) error {
	approved := make([]string, 0, len(results))
	for _, r := range results {
		approved = append(approved, s.Eng.Cat.VendorName(r.VendorID))
	}
	if len(approved) == 0 {
		approved = []string{"Trip Fixer Agent"}
	}
	var receipt domain.ChangeReceipt
	var trip *domain.Trip
	var docs []domain.Document
	err := tl.step(ctx, "commit_or_undo", "Applying the change", "success", func() (stepResult, error) {
		err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
			t, err := st.LockTrip(ctx, inc.TripID)
			if err != nil {
				return err
			}
			trip = t
			after := s.Eng.Simulate(t, plan.Actions)
			if inc.Kind == domain.IncWeather {
				if after.WeatherOverrides == nil {
					after.WeatherOverrides = map[int]string{}
				}
				after.WeatherOverrides[inc.Day] = "rain"
			}
			after.Version = t.Version
			if err := st.SaveTrip(ctx, after); err != nil {
				return err
			}
			receipt = s.Eng.BuildReceipt(t, inc, plan, approved, s.Now().UTC())
			if err := st.InsertReceipt(ctx, receipt); err != nil {
				return err
			}
			if err := s.syncBookings(ctx, st, t, after, plan); err != nil {
				return err
			}
			if plan.CostDelta != 0 {
				kind, status := "adjustment", "settled"
				if plan.CostDelta < 0 {
					kind, status = "refund", "pending"
				}
				if err := st.InsertLedger(ctx, domain.LedgerEntry{ID: s.ID("txn"), Kind: kind, Party: t.CustomerName, TripID: t.ID,
					Amount: plan.CostDelta, Status: status, Method: "UPI · Razorpay", Note: receipt.ID + " · " + plan.Title, Date: s.Now().UTC()}); err != nil {
					return err
				}
			}
			if round.ID != "" {
				if err := st.SetConfirmationPhase(ctx, round.ID, "saved"); err != nil {
					return err
				}
			}
			resolved := domain.IncResolved
			if err := st.UpdateIncident(ctx, inc.ID, store.IncidentPatch{Status: &resolved, ReceiptID: &receipt.ID, SelectedPlanID: &plan.ID}); err != nil {
				return err
			}
			inc.Status = resolved
			if s.Docs != nil {
				if docs, err = s.Docs.Issue(ctx, st, after, documents.AfterChange, "Change "+receipt.ID); err != nil {
					return err
				}
				ev.Add(app.TripEvent("documents.updated", t.ID, owner, map[string]any{"documents": docs}))
			}
			ev.Add(app.TripEvent("trip.updated", t.ID, owner, map[string]string{"reason": "agent-commit"}))
			ev.Add(app.TripEvent("confirm.saved", t.ID, owner, map[string]string{"runId": run.ID, "receiptId": receipt.ID}))
			ev.Add(app.TripEvent("incident.updated", t.ID, owner, map[string]string{"incidentId": inc.ID, "status": resolved}))
			return nil
		})
		if err != nil {
			return stepResult{}, err
		}
		detail := make([]string, 0, len(plan.Actions))
		for _, a := range plan.Actions {
			detail = append(detail, a.Label)
		}
		return stepResult{Result: "Saved in one transaction · Change Receipt " + receipt.ID, Detail: detail}, nil
	})
	if err != nil {
		return err
	}

	fallback := engine.ExplainPlan(inc, plan)
	var message string
	err = tl.step(ctx, "message_traveler", "Telling the traveler", "normal", func() (stepResult, error) {
		text, eng := s.AI.Explain(ctx, s.facts(trip, inc, plan), fallback)
		message = text
		err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
			if err := s.NotifyTraveler(ctx, st, ev, owner, "agent", "Your plan was updated", message, "/my-trip/"+trip.ID); err != nil {
				return err
			}
			if err := s.MessageTraveler(ctx, st, ev, trip, owner, fmt.Sprintf("%s · %s\n%s\nChange Receipt %s.", trip.Code, plan.Title, message, receipt.ID), docs); err != nil {
				return err
			}
			if err := s.NotifyOperators(ctx, st, ev, "agent", "Agent fixed "+trip.Code,
				fmt.Sprintf("%s · %d/%d vendors confirmed · %s", plan.Title, len(results), len(results), engine.RupeesSigned(plan.CostDelta)), "/ops/tours/"+trip.ID); err != nil {
				return err
			}
			if owner != "" {
				return st.AddXP(ctx, owner, 80, "fixed")
			}
			return nil
		})
		if err != nil {
			return stepResult{}, err
		}
		return stepResult{Result: "Trip chat update sent (" + eng + ")", Detail: []string{"“" + message + "”", fmt.Sprintf("%d updated documents attached", len(docs))}}, nil
	})
	if err != nil {
		return err
	}
	secs := int(time.Since(run.StartedAt).Seconds())
	prefix := ""
	if attempt > 1 {
		prefix = "2 attempts · "
	}
	tl.note(ctx, domain.AgentStep{Tool: "done", Label: "Trip successfully repaired", Status: domain.StepDone, Kind: "success",
		Result: fmt.Sprintf("%s%dm %ds end to end · %s", prefix, secs/60, secs%60, engine.RupeesSigned(plan.CostDelta))})
	// A traveler who picked a replacement experience told us something about their taste.
	// Adaptive swapping never edits the DNA itself; the Learning Engine does, from this event.
	if plan.Strategy == engine.SwapActivity && run.Scope == "traveler" {
		var evs []learning.Event
		for _, a := range plan.Actions {
			if a.Type != "swap" || a.ToRefID == "" {
				continue
			}
			if it := trip.Item(a.ItemID); it != nil {
				evs = append(evs, learning.Event{Kind: "swap_replaced", TripID: trip.ID, ItemID: it.ID, ActivityID: it.RefID, Detail: it.Title})
			}
			evs = append(evs, learning.Event{Kind: "swap_chosen", TripID: trip.ID, ItemID: a.ItemID, ActivityID: a.ToRefID, Detail: a.ToLabel})
		}
		s.Learn.Record(ctx, owner, evs...)
	}
	status := domain.RunSucceeded
	return s.setRun(ctx, run.ID, store.RunPatch{Status: &status, Summary: &message, Finished: true})
}

// syncBookings mirrors the committed plan in the vendor bookings table.
func (s *Service) syncBookings(ctx context.Context, st *store.Store, before, after *domain.Trip, plan domain.FixPlan) error {
	var fresh []domain.Booking
	now := s.Now().UTC()
	add := func(it domain.TripItem) {
		fresh = append(fresh, domain.Booking{ID: "BK-" + strings.TrimPrefix(before.Code, "TRZ-") + "-" + strings.ToUpper(s.ID("x")[2:7]),
			TripID: before.ID, ItemID: it.ID, ItemTitle: it.Title, VendorID: it.VendorID, CustomerName: before.CustomerName,
			Status: "confirmed", Amount: engine.ItemCost(it), Day: it.Day, Date: engine.AddDays(after.Prefs.StartDate, it.Day-1),
			Channel: "web", UpdatedAt: now})
	}
	for _, a := range plan.Actions {
		if strings.HasSuffix(a.ItemID, "__fill") {
			if it := after.Item(strings.TrimSuffix(a.ItemID, "__fill") + "-fill"); it != nil && it.VendorID != "" {
				add(*it)
			}
			continue
		}
		old := before.Item(a.ItemID)
		if old == nil {
			continue
		}
		switch a.Type {
		case "move":
			// Day and route swaps re-date bookings; keep the vendor's booking on the new day.
			if it := after.Item(a.ItemID); it != nil && it.Day != old.Day {
				if err := st.RescheduleBookingForItem(ctx, before.ID, a.ItemID, it.Day, engine.AddDays(after.Prefs.StartDate, it.Day-1)); err != nil {
					return err
				}
			}
		case "cancel":
			if err := st.SetBookingStatusForItem(ctx, before.ID, a.ItemID, "cancelled"); err != nil {
				return err
			}
		case "swap", "rebook":
			it := after.Item(a.ItemID)
			if it == nil || it.VendorID == "" {
				continue
			}
			if it.VendorID != old.VendorID {
				if err := st.SetBookingStatusForItem(ctx, before.ID, a.ItemID, "cancelled"); err != nil {
					return err
				}
				add(*it)
			}
		}
	}
	return st.InsertBookings(ctx, fresh)
}
