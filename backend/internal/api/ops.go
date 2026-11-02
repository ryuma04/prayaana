package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/engine"
	"trizpyy/internal/incidents"
	"trizpyy/internal/ops"
	"trizpyy/internal/platform/httpx"
)

func (a *API) overview(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Overview(r.Context())
	respond(w, r, v, err)
}

func (a *API) tours(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Tours(r.Context(), r.URL.Query().Get("status"))
	respond(w, r, v, err)
}

func (a *API) tour(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Tour(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) completeTour(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Complete(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) assignCoordinator(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		MemberID string `json:"memberId"`
	}](w, r)
	if !ok {
		return
	}
	if err := a.Ops.AssignCoordinator(r.Context(), chi.URLParam(r, "id"), in.MemberID); err != nil {
		fail(w, r, err)
		return
	}
	v, err := a.Ops.Tour(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) bookings(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Bookings(r.Context(), r.URL.Query().Get("status"))
	respond(w, r, v, err)
}

func (a *API) bookingStatus(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Status string `json:"status"`
	}](w, r)
	if !ok {
		return
	}
	v, err := a.Booking.SetStatus(r.Context(), chi.URLParam(r, "id"), in.Status)
	respond(w, r, v, err)
}

func (a *API) customers(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Customers(r.Context())
	respond(w, r, v, err)
}

func (a *API) team(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Team(r.Context())
	respond(w, r, v, err)
}

func (a *API) ledger(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Ledger(r.Context())
	respond(w, r, v, err)
}

func (a *API) vendors(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Vendors(r.Context())
	respond(w, r, v, err)
}

func (a *API) vendor(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Vendor(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) vendorAvailability(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Available *bool `json:"available"`
	}](w, r)
	if !ok {
		return
	}
	if in.Available == nil {
		fail(w, r, httpx.BadRequest("available (true/false) is required."))
		return
	}
	v, err := a.Ops.SetAvailability(r.Context(), principal(r), chi.URLParam(r, "id"), *in.Available)
	respond(w, r, v, err)
}

func (a *API) incidents(w http.ResponseWriter, r *http.Request) {
	v, err := a.Incidents.All(r.Context(), r.URL.Query().Get("open") == "true")
	respond(w, r, v, err)
}

func (a *API) resolveIncident(w http.ResponseWriter, r *http.Request) {
	v, err := a.Incidents.Resolve(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) agentRuns(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Runs(r.Context())
	respond(w, r, v, err)
}

func (a *API) takeOver(w http.ResponseWriter, r *http.Request) {
	v, err := a.Agent.TakeOver(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) scenarios(w http.ResponseWriter, r *http.Request) { httpx.OK(w, engine.Scenarios) }

func (a *API) simulate(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[incidents.ScenarioInput](w, r)
	if !ok {
		return
	}
	v, err := a.Incidents.Simulate(r.Context(), in)
	respond(w, r, v, err)
}

func (a *API) fixAll(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[incidents.ScenarioInput](w, r)
	if !ok {
		return
	}
	v, err := a.Incidents.FixAll(r.Context(), principal(r), in)
	respond(w, r, v, err)
}

// POST /ops/simulate/insight — the AI's reading of a What-If result (rules when the AI service is off).
func (a *API) simulateInsight(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[incidents.ScenarioInput](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.WhatIfInsight(r.Context(), in)
	respond(w, r, v, err)
}

// POST /ops/ai/ask — the operator assistant. It answers from live data and never changes anything.
func (a *API) askOps(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[ops.AskInput](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.Ask(r.Context(), principal(r), in)
	respond(w, r, v, err)
}

func (a *API) inbox(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Inbox(r.Context())
	respond(w, r, v, err)
}

func (a *API) sendMessage(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Body string `json:"body"`
	}](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.SendMessage(r.Context(), chi.URLParam(r, "id"), in.Body)
	respond(w, r, v, err)
}

func (a *API) readThread(w http.ResponseWriter, r *http.Request) {
	respond(w, r, map[string]bool{"ok": true}, a.Ops.MarkThreadRead(r.Context(), chi.URLParam(r, "id")))
}

func (a *API) alerts(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Alerts(r.Context())
	respond(w, r, v, err)
}

func (a *API) guideReport(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[ops.ReportInput](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.GuideReport(r.Context(), principal(r), in)
	respond(w, r, v, err)
}

func (a *API) verifyReport(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.VerifyReport(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) handOff(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.HandOff(r.Context(), principal(r), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

// PATCH /ops/vendors/{id} — the operator keeps a partner's real contact details up to date.
func (a *API) updateVendor(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[ops.VendorContactInput](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.UpdateVendor(r.Context(), chi.URLParam(r, "id"), in)
	respond(w, r, v, err)
}

// GET /ops/ai/decisions — every AI decision with its engine, answer, confidence and time taken.
func (a *API) aiDecisions(w http.ResponseWriter, r *http.Request) {
	v, err := a.Ops.Decisions(r.Context(), httpx.QueryInt(r, "limit", 100, 1, 500))
	respond(w, r, v, err)
}
