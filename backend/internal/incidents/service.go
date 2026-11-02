// Package incidents records trip problems and turns them into impact maps and fix plans.
package incidents

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"trizpyy/internal/agent"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
	"trizpyy/internal/trips"
)

type Service struct {
	*app.Core
	trips *trips.Service
	agent *agent.Service
}

func New(c *app.Core, t *trips.Service, a *agent.Service) *Service {
	return &Service{Core: c, trips: t, agent: a}
}

type CreateInput struct {
	Kind     string `json:"kind"`
	Day      int    `json:"day"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Severity int    `json:"severity"`
	Source   string `json:"source"`
	DelayMin *int   `json:"delayMin"`
	VendorID string `json:"vendorId"`
	Place    string `json:"place"`
}

func notifyKind(kind string) string {
	switch kind {
	case domain.IncWeather:
		return "weather"
	case domain.IncFlightDelay:
		return "flight"
	}
	return "risk"
}

func oneOf(v string, list []string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// Create records a problem on a trip (from the traveler, operator, simulator or a job).
func (s *Service) Create(ctx context.Context, p auth.Principal, tripID string, in CreateInput) (domain.Incident, error) {
	owner, err := s.trips.Authorize(ctx, p, tripID)
	if err != nil {
		return domain.Incident{}, err
	}
	if !oneOf(in.Kind, domain.IncidentKinds) {
		return domain.Incident{}, httpx.BadRequest("kind must be one of: " + strings.Join(domain.IncidentKinds, ", ") + ".")
	}
	if !p.Operator() {
		in.Source = "traveler"
	} else if in.Source == "" {
		in.Source = "operator"
	} else if !oneOf(in.Source, domain.IncidentSources) {
		return domain.Incident{}, httpx.BadRequest("Unknown incident source.")
	}
	if in.DelayMin != nil && (*in.DelayMin < 5 || *in.DelayMin > 24*60) {
		return domain.Incident{}, httpx.BadRequest("Delay must be between 5 minutes and 24 hours.")
	}
	if in.Severity != 0 && (in.Severity < 1 || in.Severity > 5) {
		return domain.Incident{}, httpx.BadRequest("Severity must be 1 to 5.")
	}
	if in.VendorID != "" && s.Eng.Cat.Vendor(in.VendorID) == nil {
		return domain.Incident{}, httpx.BadRequest("Unknown vendor.")
	}
	if len(in.Title) > 140 || len(in.Detail) > 600 || len(in.Place) > 80 {
		return domain.Incident{}, httpx.BadRequest("Title, detail or place is too long.")
	}
	var inc domain.Incident
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if t.Status == domain.TripDraft || t.Status == domain.TripCompleted {
			return httpx.Conflict("Problems can only be raised on booked or live trips.")
		}
		inc, err = s.record(ctx, st, ev, t, owner, in)
		return err
	})
	return inc, err
}

func (s *Service) record(ctx context.Context, st *store.Store, ev *app.Events, t *domain.Trip, owner string, in CreateInput) (domain.Incident, error) {
	if in.Kind == domain.IncVendorUnavailable && in.VendorID == "" {
		for _, it := range t.Items {
			if it.Kind == "activity" && it.VendorID != "" && engine.IsActive(it) && it.Status != domain.ItemDone {
				in.VendorID = it.VendorID
				break
			}
		}
	}
	day := in.Day
	if day == 0 {
		day = engine.DefaultDisruptionDay(t, in.Kind)
	}
	if day < 1 || day > t.Prefs.Days() {
		return domain.Incident{}, httpx.BadRequest("That day is not part of this trip.")
	}
	delay := in.DelayMin
	if delay == nil {
		delay = engine.DefaultDelay(in.Kind)
	}
	preset := s.Eng.IncidentPreset(t, in.Kind, day, delay, in.Place)
	inc := domain.Incident{ID: s.ID("inc"), TripID: t.ID, Kind: in.Kind, Title: preset.Title, Detail: preset.Detail, Day: day,
		Severity: preset.Severity, Source: in.Source, Status: domain.IncOpen, CreatedAt: s.Now().UTC(), DelayMin: delay,
		VendorID: in.VendorID, Place: strings.TrimSpace(in.Place)}
	if in.Title != "" {
		inc.Title = strings.TrimSpace(in.Title)
	}
	if in.Detail != "" {
		inc.Detail = strings.TrimSpace(in.Detail)
	}
	if in.Severity != 0 {
		inc.Severity = in.Severity
	}
	if err := st.InsertIncident(ctx, inc); err != nil {
		return inc, err
	}
	if inc.Kind == domain.IncWeather {
		c := t.Clone()
		if c.WeatherOverrides == nil {
			c.WeatherOverrides = map[int]string{}
		}
		c.WeatherOverrides[day] = "rain"
		if err := st.SaveTrip(ctx, c); err != nil {
			return inc, err
		}
		t = c
	}
	impact := s.Eng.AnalyzeImpact(t, &inc)
	affected := 0
	for _, i := range impact.Items {
		if i.Level != domain.LevelSafe {
			affected++
		}
	}
	if err := s.NotifyOperators(ctx, st, ev, notifyKind(inc.Kind), fmt.Sprintf("%s at risk · %s", t.Code, inc.Title),
		fmt.Sprintf("%d items affected · %s at risk", affected, engine.Rupees(impact.MoneyAtRisk)), "/ops/incidents/"+inc.ID); err != nil {
		return inc, err
	}
	if err := s.NotifyTraveler(ctx, st, ev, owner, notifyKind(inc.Kind), fmt.Sprintf("%s · Day %d", inc.Title, day),
		"Some plans are affected. Tap to see 3 fix plans, or let us handle it.", "/my-trip/adapt"); err != nil {
		return inc, err
	}
	if t.Status != domain.TripDraft {
		if err := s.MessageTraveler(ctx, st, ev, t, owner, fmt.Sprintf("Heads up for %s · Day %d: %s. %d plan item(s) are affected. We're lining up fixes and will confirm every change with the partners before anything moves.",
			t.Code, day, inc.Title, affected), nil); err != nil {
			return inc, err
		}
	}
	ev.Add(app.TripEvent("incident.created", t.ID, owner, inc))
	return inc, nil
}

type Detail struct {
	Incident domain.Incident      `json:"incident"`
	Trip     *domain.Trip         `json:"trip"`
	Impact   domain.ImpactSummary `json:"impact"`
	Plans    []domain.FixPlan     `json:"plans"`
	Swaps    engine.SwapReport    `json:"swaps"`
	Run      *domain.AgentRun     `json:"run,omitempty"`
}

var errNoIncident = httpx.NotFound("We couldn't find that problem.")

// Get returns the Change Impact Map and the 3 fix plans, computed on the latest trip.
func (s *Service) Get(ctx context.Context, p auth.Principal, id string) (Detail, error) {
	inc, err := s.Store.GetIncident(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return Detail{}, errNoIncident
	}
	if err != nil {
		return Detail{}, err
	}
	v, err := s.trips.Get(ctx, p, inc.TripID)
	if err != nil {
		return Detail{}, errNoIncident
	}
	impact := s.Eng.AnalyzeImpact(v.Trip, &inc)
	owner, _ := s.Store.TripOwner(ctx, inc.TripID)
	d := Detail{Incident: inc, Trip: v.Trip, Impact: impact, Plans: s.Eng.MakeFixPlans(v.Trip, &inc, impact),
		Swaps: s.Eng.AdaptiveSwaps(v.Trip, &inc, impact, s.TravelerDNA(ctx, owner))}
	if inc.AgentRunID != "" {
		if r, err := s.Store.GetRun(ctx, inc.AgentRunID); err == nil {
			d.Run = &r
		}
	}
	return d, nil
}

func (s *Service) ForTrip(ctx context.Context, p auth.Principal, tripID string) ([]domain.Incident, error) {
	if _, err := s.trips.Authorize(ctx, p, tripID); err != nil {
		return nil, err
	}
	return s.Store.ListIncidents(ctx, tripID, false)
}

// Resolve closes a problem the operator handled by hand (for example on a phone call).
func (s *Service) Resolve(ctx context.Context, id string) (domain.Incident, error) {
	var inc domain.Incident
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		locked, err := st.LockIncident(ctx, id)
		if err != nil {
			return err
		}
		if active, err := st.ActiveRunForIncident(ctx, id); err == nil && active != "" {
			return httpx.Conflict("The agent is still working on this. Take over first.")
		}
		status := domain.IncResolved
		if err := st.UpdateIncident(ctx, id, store.IncidentPatch{Status: &status}); err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, locked.TripID)
		if err != nil {
			return err
		}
		locked.Status = status
		inc = locked
		ev.Add(app.TripEvent("incident.updated", locked.TripID, owner, map[string]string{"incidentId": id, "status": status}))
		return nil
	})
	if errors.Is(err, store.ErrNotFound) {
		return inc, errNoIncident
	}
	return inc, err
}

func (s *Service) All(ctx context.Context, openOnly bool) ([]domain.Incident, error) {
	return s.Store.ListIncidents(ctx, "", openOnly)
}

func (s *Service) activeTrips(ctx context.Context) ([]*domain.Trip, error) {
	return s.Store.ListTrips(ctx, store.TripFilter{Statuses: []string{domain.TripBooked, domain.TripLive}})
}

// Simulate runs a What-If scenario over every matching tour without touching real data.
// ScenarioInput names a preset scenario or describes a custom one ("What if heavy rain hits Goa today?").
type ScenarioInput struct {
	ScenarioID string           `json:"scenarioId"`
	Custom     *engine.Scenario `json:"scenario"`
}

var customKinds = []string{domain.IncWeather, domain.IncClosure, domain.IncFlightDelay, domain.IncVendorUnavailable}

func (s *Service) scenario(in ScenarioInput) (engine.Scenario, error) {
	if in.Custom == nil {
		sc := engine.FindScenario(in.ScenarioID)
		if sc == nil {
			return engine.Scenario{}, httpx.NotFound("Unknown scenario.")
		}
		return *sc, nil
	}
	c := *in.Custom
	c.Title, c.Question, c.Place = strings.TrimSpace(c.Title), strings.TrimSpace(c.Question), strings.TrimSpace(c.Place)
	switch {
	case s.Eng.Cat.Destination(c.DestinationID) == nil:
		return c, httpx.BadRequest("Pick a destination for the scenario.")
	case !oneOf(c.Kind, customKinds):
		return c, httpx.BadRequest("kind must be weather, closure, flight_delay or vendor_unavailable.")
	case c.When != "today" && c.When != "tomorrow":
		return c, httpx.BadRequest("when must be today or tomorrow.")
	case c.VendorID != "" && s.Eng.Cat.Vendor(c.VendorID) == nil:
		return c, httpx.BadRequest("Unknown vendor.")
	case c.Title == "" || len(c.Title) > 80 || len(c.Question) > 160 || len(c.Place) > 80:
		return c, httpx.BadRequest("Give the scenario a short title.")
	case c.Kind == domain.IncClosure && c.Place == "":
		return c, httpx.BadRequest("Name the place that closes.")
	case c.Kind == domain.IncVendorUnavailable && c.VendorID == "":
		return c, httpx.BadRequest("Pick the vendor that is unavailable.")
	case c.DelayMin != nil && (*c.DelayMin < 5 || *c.DelayMin > 24*60):
		return c, httpx.BadRequest("Delay must be between 5 minutes and 24 hours.")
	}
	// Simulate with the same default delay a real problem gets, so "Fix all" matches the preview.
	if c.DelayMin == nil {
		c.DelayMin = engine.DefaultDelay(c.Kind)
	}
	c.ID = "custom"
	return c, nil
}

func (s *Service) Simulate(ctx context.Context, in ScenarioInput) (engine.WhatIfResult, error) {
	sc, err := s.scenario(in)
	if err != nil {
		return engine.WhatIfResult{}, err
	}
	list, err := s.activeTrips(ctx)
	if err != nil {
		return engine.WhatIfResult{}, err
	}
	return s.Eng.WhatIf(sc, list), nil
}

type Launched struct {
	TripID     string `json:"tripId"`
	TripCode   string `json:"tripCode"`
	IncidentID string `json:"incidentId"`
	RunID      string `json:"runId"`
}

// FixAll turns a scenario into real problems on every affected tour and lets the agent fix each.
func (s *Service) FixAll(ctx context.Context, p auth.Principal, in ScenarioInput) ([]Launched, error) {
	res, err := s.Simulate(ctx, in)
	if err != nil {
		return nil, err
	}
	out := []Launched{}
	for _, tour := range res.Tours {
		in := CreateInput{Kind: res.Scenario.Kind, Day: tour.Day, Title: res.Scenario.Title, Source: "simulator",
			DelayMin: res.Scenario.DelayMin, VendorID: res.Scenario.VendorID, Place: res.Scenario.Place}
		inc, err := s.Create(ctx, p, tour.Trip.ID, in)
		if err != nil {
			return out, err
		}
		run, err := s.agent.Start(ctx, p, inc.ID, agent.StartInput{Scope: "operator"})
		if err != nil {
			return out, err
		}
		out = append(out, Launched{TripID: tour.Trip.ID, TripCode: tour.Trip.Code, IncidentID: inc.ID, RunID: run.ID})
	}
	return out, nil
}

// VendorPaused raises a problem on every booked or live trip that still depends on the vendor.
func (s *Service) VendorPaused(ctx context.Context, p auth.Principal, vendorID string) ([]domain.Incident, error) {
	list, err := s.activeTrips(ctx)
	if err != nil {
		return nil, err
	}
	name := s.Eng.Cat.VendorName(vendorID)
	out := []domain.Incident{}
	for _, t := range list {
		day := 0
		for _, it := range t.Items {
			if it.VendorID == vendorID && engine.IsActive(it) && it.Status != domain.ItemDone {
				day = it.Day
				break
			}
		}
		if day == 0 {
			continue
		}
		inc, err := s.Create(ctx, p, t.ID, CreateInput{Kind: domain.IncVendorUnavailable, Day: day, VendorID: vendorID, Source: "operator",
			Severity: 4, Title: name + " unavailable", Detail: name + " was paused by the operator. Every booking with them needs a new partner."})
		if err != nil {
			return out, err
		}
		out = append(out, inc)
	}
	return out, nil
}
