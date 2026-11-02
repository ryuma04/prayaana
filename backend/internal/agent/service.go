// Package agent runs the Trip Fixer Agent (allaboutourproject.md §12.7): detect → impact →
// 3 plans → safety checks → ask vendors → commit or undo → tell the traveler.
package agent

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"trizpyy/internal/ai"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/confirm"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/learning"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

type Service struct {
	*app.Core
	Learn   *learning.Service // a traveler-chosen activity swap is a learning signal (nil in tests)
	confirm *confirm.Service
	mu      sync.Mutex
	cancels map[string]context.CancelFunc
	wg      sync.WaitGroup
}

func New(c *app.Core, cf *confirm.Service) *Service {
	return &Service{Core: c, confirm: cf, cancels: map[string]context.CancelFunc{}}
}

type StartInput struct {
	Scope    string `json:"scope"`
	Strategy string `json:"strategy"`
	// PlanID picks an adaptive swap (day, route or activity) from the incident's swap options.
	PlanID string `json:"planId"`
}

// pickSwap finds the swap the traveler chose. Route swaps change the order of the trip, so
// only the traveler can accept one; the agent never picks a swap on its own.
func pickSwap(r engine.SwapReport, planID string, operator bool) (*engine.SwapCandidate, error) {
	c := r.Find(planID)
	if c == nil {
		return nil, httpx.Conflict("That swap is no longer possible, refresh to see the current options.")
	}
	if c.Type == engine.SwapRoute && operator {
		return nil, httpx.Forbidden("Only the traveler can accept a route change.")
	}
	return c, nil
}

// Start launches (or returns the already running) agent for an incident.
func (s *Service) Start(ctx context.Context, p auth.Principal, incidentID string, in StartInput) (domain.AgentRun, error) {
	inc, err := s.Store.GetIncident(ctx, incidentID)
	if errors.Is(err, store.ErrNotFound) {
		return domain.AgentRun{}, httpx.NotFound("We couldn't find that problem.")
	}
	if err != nil {
		return domain.AgentRun{}, err
	}
	owner, err := s.Store.TripOwner(ctx, inc.TripID)
	if err != nil {
		return domain.AgentRun{}, err
	}
	if !p.Operator() && owner != p.UserID {
		return domain.AgentRun{}, httpx.NotFound("We couldn't find that problem.")
	}
	if in.Strategy != "" && in.Strategy != domain.StrategyCheapest && in.Strategy != domain.StrategyFastest && in.Strategy != domain.StrategyFavourites {
		return domain.AgentRun{}, httpx.BadRequest("strategy must be cheapest, fastest or favourites.")
	}
	if in.PlanID != "" {
		trip, err := s.Store.GetTrip(ctx, inc.TripID)
		if err != nil {
			return domain.AgentRun{}, err
		}
		report := s.Eng.AdaptiveSwaps(trip, &inc, s.Eng.AnalyzeImpact(trip, &inc), s.TravelerDNA(ctx, owner))
		if _, err := pickSwap(report, in.PlanID, p.Operator()); err != nil {
			return domain.AgentRun{}, err
		}
	}
	scope := "operator"
	if !p.Operator() || in.Scope == "traveler" {
		scope = "traveler"
	}
	// Vendors always answer for real (reply link, email, or the operator after a call).
	mode := "manual"
	run := domain.AgentRun{ID: s.ID("run"), IncidentID: inc.ID, TripID: inc.TripID, Status: domain.RunRunning, StartedAt: s.Now().UTC(),
		Steps: []domain.AgentStep{}, Attempt: 1, Mode: mode, ExcludedVendors: []string{}, Scope: scope}
	existing := ""
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		locked, err := st.LockIncident(ctx, inc.ID)
		if err != nil {
			return err
		}
		if id, err := st.ActiveRunForIncident(ctx, inc.ID); err == nil {
			existing = id
			return nil
		} else if !errors.Is(err, store.ErrNotFound) {
			return err
		}
		if locked.Status == domain.IncResolved {
			return httpx.Conflict("This problem is already fixed.")
		}
		if err := st.InsertRun(ctx, run); err != nil {
			return err
		}
		status := domain.IncAnalyzing
		if err := st.UpdateIncident(ctx, inc.ID, store.IncidentPatch{Status: &status, AgentRunID: &run.ID}); err != nil {
			return err
		}
		ev.Add(app.TripEvent("incident.updated", inc.TripID, owner, map[string]string{"incidentId": inc.ID, "status": status, "agentRunId": run.ID}))
		return nil
	})
	if err != nil {
		return domain.AgentRun{}, err
	}
	if existing != "" {
		return s.Store.GetRun(ctx, existing)
	}
	runCtx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	s.mu.Lock()
	s.cancels[run.ID] = cancel
	s.mu.Unlock()
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			cancel()
			s.mu.Lock()
			delete(s.cancels, run.ID)
			s.mu.Unlock()
		}()
		s.execute(runCtx, run, inc, owner, in)
	}()
	return run, nil
}

// Wait blocks until running agents finish (used on shutdown).
func (s *Service) Wait(timeout time.Duration) {
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(timeout):
		s.mu.Lock()
		for _, c := range s.cancels {
			c()
		}
		s.mu.Unlock()
	}
}

func (s *Service) Get(ctx context.Context, p auth.Principal, runID string) (domain.AgentRun, error) {
	r, err := s.Store.GetRun(ctx, runID)
	if errors.Is(err, store.ErrNotFound) {
		return r, httpx.NotFound("We couldn't find that agent run.")
	}
	if err != nil {
		return r, err
	}
	if !p.Operator() {
		owner, err := s.Store.TripOwner(ctx, r.TripID)
		if err != nil || owner != p.UserID {
			return domain.AgentRun{}, httpx.NotFound("We couldn't find that agent run.")
		}
	}
	return r, nil
}

func (s *Service) Requests(ctx context.Context, p auth.Principal, runID string) ([]domain.VendorRequest, error) {
	if _, err := s.Get(ctx, p, runID); err != nil {
		return nil, err
	}
	return s.Store.RequestsForRun(ctx, runID)
}

// TakeOver stops the agent; nothing already confirmed is applied without every vendor's yes.
func (s *Service) TakeOver(ctx context.Context, runID string) (domain.AgentRun, error) {
	r, err := s.Store.GetRun(ctx, runID)
	if errors.Is(err, store.ErrNotFound) {
		return r, httpx.NotFound("We couldn't find that agent run.")
	}
	if err != nil {
		return r, err
	}
	if r.Status != domain.RunRunning && r.Status != domain.RunWaiting {
		return r, httpx.Conflict("The agent has already finished.")
	}
	status := domain.RunNeedsHuman
	summary := "Operator took over."
	if err := s.Store.UpdateRun(ctx, runID, store.RunPatch{Status: &status, Summary: &summary, Finished: true}); err != nil {
		return r, err
	}
	s.mu.Lock()
	if c := s.cancels[runID]; c != nil {
		c()
	}
	s.mu.Unlock()
	return s.Store.GetRun(ctx, runID)
}

var kindLabel = map[string]string{
	domain.IncWeather: "Weather issue", domain.IncFlightDelay: "Flight delay", domain.IncVendorUnavailable: "Vendor unavailable",
	domain.IncTravelerRequest: "Traveler request", domain.IncClosure: "Place closed", domain.IncRunningLate: "Group running late",
	domain.IncCrowdReport: "Crowd report", domain.IncHealth: "Traveler not feeling well",
}

func (s *Service) execute(ctx context.Context, run domain.AgentRun, inc domain.Incident, owner string, in StartInput) {
	tl := &timeline{core: s.Core, runID: run.ID, tripID: inc.TripID, owner: owner, delay: s.Cfg.AgentStepDelay}
	err := s.loop(ctx, tl, run, &inc, owner, in)
	bg := context.Background()
	switch {
	case err == nil:
	case errors.Is(err, errTakenOver) || ctx.Err() != nil:
		s.withdraw(bg, run.ID)
		tl.note(bg, domain.AgentStep{Tool: "escalate", Label: "Operator took over", Status: domain.StepWarning,
			Result: "The agent stopped; nothing was changed without every vendor's yes."})
		s.escalate(bg, run.ID, &inc, owner, "Operator took over.", false)
	default:
		slog.Error("agent run failed", "run", run.ID, "err", err)
		tl.note(bg, domain.AgentStep{Tool: "error", Label: "Agent stopped safely", Status: domain.StepFailed,
			Result: "Something went wrong, so the trip was left unchanged. A coordinator has been alerted."})
		s.escalate(bg, run.ID, &inc, owner, "The agent hit an error; the trip is unchanged.", true)
	}
}

func (s *Service) setRun(ctx context.Context, id string, p store.RunPatch) error {
	return s.Store.UpdateRun(context.WithoutCancel(ctx), id, p)
}

func (s *Service) setIncident(ctx context.Context, inc *domain.Incident, owner, status string, planID string) error {
	patch := store.IncidentPatch{Status: &status}
	if planID != "" {
		patch.SelectedPlanID = &planID
	}
	if err := s.Store.UpdateIncident(context.WithoutCancel(ctx), inc.ID, patch); err != nil {
		return err
	}
	inc.Status = status
	s.Hub.Publish(app.TripEvent("incident.updated", inc.TripID, owner, map[string]string{"incidentId": inc.ID, "status": status}))
	return nil
}

func (s *Service) loop(ctx context.Context, tl *timeline, run domain.AgentRun, inc *domain.Incident, owner string, in StartInput) error {
	trip, err := s.Store.GetTrip(ctx, inc.TripID)
	if err != nil {
		return err
	}
	if err := tl.step(ctx, "detect_problem", "Detecting problem", "normal", func() (stepResult, error) {
		return stepResult{Result: kindLabel[inc.Kind] + " detected, " + inc.Title,
			Detail: []string{inc.Detail, "Source: " + inc.Source, "Trip " + trip.Code + " · " + trip.GroupName}}, nil
	}); err != nil {
		return err
	}
	if err := tl.step(ctx, "decide.severity", "Classifying severity", "normal", func() (stepResult, error) {
		return stepResult{Result: fmt.Sprintf("Severity %d/5 · %s", inc.Severity, strings.ReplaceAll(inc.Kind, "_", " ")),
			Detail: []string{"Rules: " + kindLabel[inc.Kind], fmt.Sprintf("Seriousness %d/5", inc.Severity)}}, nil
	}); err != nil {
		return err
	}

	impact := s.Eng.AnalyzeImpact(trip, inc)
	if err := s.setRun(ctx, run.ID, store.RunPatch{Impact: &impact}); err != nil {
		return err
	}
	byID := map[string]domain.TripItem{}
	for _, it := range trip.Items {
		byID[it.ID] = it
	}
	if err := tl.step(ctx, "analyze_impact", "Analyzing impact", "normal", func() (stepResult, error) {
		broken, moves := 0, 0
		var detail []string
		for _, i := range impact.Items {
			switch i.Level {
			case domain.LevelCannotHappen, domain.LevelAtRisk:
				broken++
			case domain.LevelMoves:
				moves++
			default:
				continue
			}
			detail = append(detail, fmt.Sprintf("%s → %s (%s)", byID[i.ItemID].Title, strings.ReplaceAll(i.Level, "_", " "), i.Reason))
		}
		return stepResult{Result: fmt.Sprintf("%d activities affected · %d items move · %s at risk", broken, moves, engine.Rupees(impact.MoneyAtRisk)), Detail: detail}, nil
	}); err != nil {
		return err
	}

	plans := s.Eng.MakeFixPlans(trip, inc, impact)
	if err := s.setRun(ctx, run.ID, store.RunPatch{Plans: plans}); err != nil {
		return err
	}
	if err := s.setIncident(ctx, inc, owner, domain.IncPlansReady, ""); err != nil {
		return err
	}
	if err := tl.step(ctx, "make_fix_plans", "Creating fix plans", "normal", func() (stepResult, error) {
		var detail []string
		for _, p := range plans {
			detail = append(detail, fmt.Sprintf("%s: %s · %d swaps · %d/%d Must-Dos kept", p.Title, engine.RupeesSigned(p.CostDelta), p.Swaps, p.HeartsKept, p.HeartsTotal))
		}
		return stepResult{Result: "3 plans generated", Detail: detail}, nil
	}); err != nil {
		return err
	}

	var plan *domain.FixPlan
	var why string
	if in.PlanID != "" {
		// Adaptive swap chosen by the traveler: re-validated on the latest trip, then it goes
		// through the same safety checks, vendor confirmation and commit/undo as any plan.
		report := s.Eng.AdaptiveSwaps(trip, inc, impact, s.TravelerDNA(ctx, owner))
		cand, perr := pickSwap(report, in.PlanID, run.Scope == "operator")
		if err := tl.step(ctx, "adaptive_swap", "Validating the chosen swap", "normal", func() (stepResult, error) {
			if perr != nil {
				return stepResult{Status: domain.StepFailed, Result: perr.Error()}, nil
			}
			detail := []string{cand.Comparison.Original + "  →  " + cand.Comparison.Proposed}
			for _, c := range cand.HardChecks {
				detail = append(detail, "✓ "+c.Label)
			}
			return stepResult{Result: cand.Title + " · " + engine.RupeesSigned(cand.Plan.CostDelta), Detail: detail}, nil
		}); err != nil {
			return err
		}
		if perr != nil {
			s.escalate(context.WithoutCancel(ctx), run.ID, inc, owner, "The chosen swap is no longer valid; the trip is unchanged.", false)
			return nil
		}
		plan, why = &cand.Plan, "Chosen by you"
		if err := s.setRun(ctx, run.ID, store.RunPatch{Plans: append(append([]domain.FixPlan{}, plans...), cand.Plan)}); err != nil {
			return err
		}
	} else {
		plan, why, err = s.choose(ctx, trip.ID, plans, impact, in.Strategy)
		if err != nil {
			return err
		}
	}
	if plan == nil {
		var detail []string
		for _, p := range plans {
			detail = append(detail, fmt.Sprintf("%s: %s", p.Title, engine.RupeesSigned(p.CostDelta)))
		}
		_ = tl.step(ctx, "request_approval", "Needs human approval", "normal", func() (stepResult, error) {
			return stepResult{Status: domain.StepWarning, Result: "Every plan is outside the traveler's rules, waiting for one-tap approval", Detail: detail}, nil
		})
		s.escalate(context.WithoutCancel(ctx), run.ID, inc, owner, "Every plan needs approval.", true)
		return nil
	}
	if err := tl.step(ctx, "choose_plan", "Picking the best plan", "normal", func() (stepResult, error) {
		return stepResult{Result: plan.Title + ", " + why}, nil
	}); err != nil {
		return err
	}

	current := *plan
	excluded := []string{}
	tried := 0
	for attempt := 1; attempt <= 2; attempt++ {
		tried = attempt
		trip, err = s.Store.GetTrip(ctx, inc.TripID)
		if err != nil {
			return err
		}
		if err := s.safety(ctx, tl, trip, current); err != nil {
			return err
		}
		var round confirm.Round
		err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
			var err error
			round, err = s.confirm.Open(ctx, st, ev, trip, inc, current, run.ID, attempt, s.timeoutFor(run.Mode))
			return err
		})
		if err != nil {
			return err
		}
		waiting := domain.RunWaiting
		if err := s.setRun(ctx, run.ID, store.RunPatch{Status: &waiting, Attempt: &attempt, PlanID: &current.ID}); err != nil {
			return err
		}
		if err := s.setIncident(ctx, inc, owner, domain.IncAwaitingVendors, current.ID); err != nil {
			return err
		}
		if len(round.Requests) == 0 {
			return s.commit(ctx, tl, run, inc, owner, current, round, nil, attempt)
		}
		if err := tl.step(ctx, "ask_vendors", fmt.Sprintf("Contacting %s", engine.Plural(len(round.Requests), "vendor")), "normal", func() (stepResult, error) {
			var detail []string
			for _, r := range round.Requests {
				detail = append(detail, fmt.Sprintf("%s: %s  ·  /v/%s", s.Eng.Cat.VendorName(r.VendorID), strings.Split(r.Proposed, "\n")[0], r.Token))
			}
			channel := "reply links in the operator inbox"
			if s.Mailer != nil && s.Mailer.Delivers() {
				channel = "reply links (emailed to vendors with an address on file)"
			}
			return stepResult{Result: fmt.Sprintf("Sent %d change requests · %s", len(round.Requests), channel), Detail: detail}, nil
		}); err != nil {
			return err
		}
		waitNote := fmt.Sprintf("All-or-nothing: applied only if every vendor says yes within %s. Vendors answer on their link; the operator can record an answer after a call.",
			s.timeoutFor(run.Mode).Round(time.Second))
		waitStep := tl.note(ctx, domain.AgentStep{Tool: "yesflow.wait", Label: "Waiting for every vendor to say yes", Status: domain.StepWaiting, Result: waitNote})
		results, err := s.confirm.Await(ctx, round, func(r domain.VendorRequest) { s.noteReply(ctx, tl, r) })
		if err != nil {
			if ctx.Err() != nil {
				return errTakenOver
			}
			return err
		}
		var failed []domain.VendorRequest
		for _, r := range results {
			if r.Status != domain.AnswerYes {
				failed = append(failed, r)
			}
		}
		waitStep.Status, waitStep.Result = domain.StepDone, fmt.Sprintf("All %d vendors confirmed", len(results))
		if len(failed) > 0 {
			waitStep.Status, waitStep.Result = domain.StepFailed, fmt.Sprintf("%d of %d vendors could not confirm", len(failed), len(results))
		}
		tl.patch(ctx, waitStep)

		if len(failed) == 0 {
			return s.commit(ctx, tl, run, inc, owner, current, round, results, attempt)
		}
		if err := tl.step(ctx, "commit_or_undo", "Rolling back", "rollback", func() (stepResult, error) {
			yes := 0
			for _, r := range results {
				if r.Status == domain.AnswerYes {
					yes++
				}
			}
			var detail []string
			for _, f := range failed {
				excluded = append(excluded, f.VendorID)
				detail = append(detail, "Excluded "+s.Eng.Cat.VendorName(f.VendorID))
			}
			detail = append(detail, "Nothing was half-updated, the trip is exactly as before")
			err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
				if err := s.confirm.Undo(ctx, st, ev, trip, round, results); err != nil {
					return err
				}
				ev.Add(app.TripEvent("confirm.undone", trip.ID, owner, map[string]string{"runId": run.ID}))
				return nil
			})
			if err != nil {
				return stepResult{}, err
			}
			if err := s.setRun(ctx, run.ID, store.RunPatch{ExcludedVendors: excluded}); err != nil {
				return stepResult{}, err
			}
			return stepResult{Status: domain.StepWarning, Result: fmt.Sprintf("Previous plan restored · “request cancelled” sent to %s", engine.Plural(yes, "vendor")), Detail: detail}, nil
		}); err != nil {
			return err
		}
		if attempt == 2 {
			break
		}
		var next *domain.FixPlan
		retry := &current
		for _, f := range failed {
			if retry == nil {
				break
			}
			retry = s.Eng.ReplaceVendorInPlan(*retry, trip, f.VendorID)
		}
		label := ""
		if retry != nil {
			next = retry
			newVendor := ""
			for _, v := range retry.Vendors {
				if !contains(current.Vendors, v) {
					newVendor = s.Eng.Cat.VendorName(v)
					break
				}
			}
			if newVendor == "" {
				newVendor = "a new vendor"
			}
			label = fmt.Sprintf("Trying %s with %s", current.Title, newVendor)
		} else {
			for i := range plans {
				if plans[i].Strategy != current.Strategy && !overlaps(plans[i].Vendors, excluded) {
					next = &plans[i]
					break
				}
			}
			if next != nil {
				label = "Trying Plan: " + next.Title
			}
		}
		if next == nil {
			break
		}
		chosen := *next
		if err := tl.step(ctx, "make_fix_plans", label, "normal", func() (stepResult, error) {
			var detail []string
			for _, a := range chosen.Actions {
				detail = append(detail, a.Label)
			}
			return stepResult{Result: fmt.Sprintf("%s · %s", chosen.Title, engine.RupeesSigned(chosen.CostDelta)), Detail: detail}, nil
		}); err != nil {
			return err
		}
		current = chosen
	}

	coord := trip.CoordinatorID
	why, summary := "2 attempts failed", "The agent tried 2 plans. Please call the vendors."
	if tried < 2 {
		why, summary = "No other plan avoids the vendor who said no", "A vendor declined and no other plan avoids them. Please call the vendors."
	}
	_ = tl.step(ctx, "escalate", "Calling a human coordinator", "normal", func() (stepResult, error) {
		return stepResult{Status: domain.StepWarning, Result: why + ", coordinator alerted with a “Call now” button",
			Detail: []string{"Coordinator: " + coord, "Trip left unchanged (safe)"}}, nil
	})
	s.escalate(context.WithoutCancel(ctx), run.ID, inc, owner, summary, true)
	return nil
}

func elapsed(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%d ms", max(1, d.Milliseconds()))
	}
	return fmt.Sprintf("%.1f s", d.Seconds())
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func overlaps(a, b []string) bool {
	for _, x := range a {
		if contains(b, x) {
			return true
		}
	}
	return false
}

func (s *Service) timeoutFor(string) time.Duration { return s.Cfg.ConfirmTimeout }

// choose picks a plan inside the traveler's auto-approve rules (or the one they chose).
func (s *Service) choose(ctx context.Context, tripID string, plans []domain.FixPlan, impact domain.ImpactSummary, strategy string) (*domain.FixPlan, string, error) {
	find := func(st string) *domain.FixPlan {
		for i := range plans {
			if plans[i].Strategy == st {
				return &plans[i]
			}
		}
		return nil
	}
	if strategy != "" {
		return find(strategy), "Chosen by you", nil
	}
	limit, err := s.Store.AutoApproveLimitForTrip(ctx, tripID)
	if err != nil {
		return nil, "", err
	}
	fav, fast := find(domain.StrategyFavourites), find(domain.StrategyFastest)
	if impact.HeartsAtRisk > 0 && fav.CostDelta <= limit {
		return fav, fmt.Sprintf("%s is inside the %s auto-approve limit and keeps every Must-Do", engine.RupeesSigned(fav.CostDelta), engine.Rupees(limit)), nil
	}
	if fast.CostDelta <= limit && fast.HeartsKept == fast.HeartsTotal {
		return fast, fmt.Sprintf("Fewest changes, %s, no Must-Do lost", engine.RupeesSigned(fast.CostDelta)), nil
	}
	return nil, "", nil
}

// safety runs the 10 checks: code rules plus meaning-based questions answered by the AI when available.
func (s *Service) safety(ctx context.Context, tl *timeline, t *domain.Trip, plan domain.FixPlan) error {
	return tl.step(ctx, "run_safety_checks", "Running safety checks", "safety", func() (stepResult, error) {
		start := time.Now()
		checks := s.Eng.SafetyChecks(t, plan)
		var acts []ai.SafetyInput
		for _, a := range plan.Actions {
			if x := s.Eng.Cat.Activity(a.ToRefID); x != nil {
				acts = append(acts, ai.SafetyInput{ID: x.ID, Title: x.Title, Description: x.Description, Walking: x.Walking, KidFriendly: x.KidFriendly})
			}
		}
		engineName := "rules"
		if len(acts) > 0 {
			group := fmt.Sprintf("%d adults, %d kids. Special needs: %s. In their words: %q", t.Prefs.Adults, t.Prefs.Kids, strings.Join(t.Prefs.Special, ", "), t.Prefs.OwnWords)
			aiStart := time.Now()
			if answers, eng, err := s.AI.SafetyChecks(ctx, group, acts); err == nil {
				engineName = eng
				aiMs := max(1, int(time.Since(aiStart).Milliseconds()))
				for i := range checks {
					if checks[i].Engine == "rules" {
						checks[i].TookMs = aiMs
					}
				}
				for i := range checks {
					for _, a := range acts {
						ans, ok := answers[a.ID]
						if !ok {
							continue
						}
						switch checks[i].ID {
						case "walking":
							checks[i].Passed = checks[i].Passed && ans.WalkingOK
						case "kids":
							checks[i].Passed = checks[i].Passed && ans.KidsOK
						case "veg":
							checks[i].Passed = checks[i].Passed && ans.FoodOK
						}
					}
				}
			}
		}
		passed := 0
		var detail []string
		for i := range checks {
			if checks[i].Engine == "rules" {
				checks[i].Engine = engineName
			}
			mark := "✕"
			if checks[i].Passed {
				passed++
				mark = "✓"
			}
			detail = append(detail, fmt.Sprintf("%s %s · %s %d ms", mark, checks[i].Label, checks[i].Engine, checks[i].TookMs))
		}
		status := domain.StepDone
		if passed != len(checks) {
			status = domain.StepWarning
		}
		took := int(time.Since(start).Milliseconds())
		return stepResult{Status: status, Result: fmt.Sprintf("%d/%d passed in %s", passed, len(checks), elapsed(time.Since(start))), Detail: detail, TookMs: &took}, nil
	})
}

func (s *Service) noteReply(ctx context.Context, tl *timeline, r domain.VendorRequest) {
	name := s.Eng.Cat.VendorName(r.VendorID)
	v := s.Eng.Cat.Vendor(r.VendorID)
	if r.Channel == "voice" && r.Voice != nil {
		contact := "vendor"
		if v != nil {
			contact = v.ContactName
		}
		detail := []string{fmt.Sprintf("Transcript (%s): “%s”", r.Voice.Language, r.Voice.Transcript)}
		if r.Voice.Translation != "" {
			detail = append(detail, "Means: “"+r.Voice.Translation+"”")
		}
		detail = append(detail, fmt.Sprintf("Decision → %s%s (%d%%)", r.Voice.Decision, suffixTime(r.Voice.Time), int(r.Voice.Confidence*100)))
		tl.note(ctx, domain.AgentStep{Tool: "yesflow.voice_note", Label: fmt.Sprintf("Voice note from %s (%s)", contact, name), Status: statusFor(r.Status),
			Kind: "voice", Result: fmt.Sprintf("Interpreted as %s%s · confidence %d%%", r.Voice.Decision, suffixTime(r.Voice.Time), int(r.Voice.Confidence*100)), Detail: detail})
		return
	}
	var result string
	switch r.Status {
	case domain.AnswerYes:
		result = "Confirmed on the reply link"
		if r.Channel == "phone" {
			result = "Confirmed by phone (recorded by the operator)"
		}
	case domain.AnswerTimeout:
		result = "No reply before the timer ran out"
	case domain.AnswerOtherTime:
		result = "Asked for another time" + parenthesis(r.AltTime)
	default:
		result = "Declined"
		if r.Channel == "phone" {
			result = "Declined by phone (recorded by the operator)"
		}
	}
	tl.note(ctx, domain.AgentStep{Tool: "yesflow.read_reply", Label: name, Status: statusFor(r.Status), Kind: "vendor", Result: result,
		Detail: []string{"Request: " + strings.Split(r.Proposed, "\n")[0], "Reply read as " + r.Status}})
}

func statusFor(answer string) string {
	if answer == domain.AnswerYes {
		return domain.StepDone
	}
	return domain.StepFailed
}

func suffixTime(t string) string {
	if t == "" {
		return ""
	}
	return ", " + t
}

func parenthesis(s string) string {
	if s == "" {
		return ""
	}
	return " (" + s + ")"
}

// escalate hands the problem to a human coordinator.
func (s *Service) escalate(ctx context.Context, runID string, inc *domain.Incident, owner, summary string, notify bool) {
	status := domain.RunNeedsHuman
	if err := s.Store.UpdateRun(ctx, runID, store.RunPatch{Status: &status, Summary: &summary, Finished: true}); err != nil {
		slog.Error("escalate run", "run", runID, "err", err)
	}
	if err := s.Store.SettleOpenSteps(ctx, runID); err != nil {
		slog.Error("settle steps", "run", runID, "err", err)
	}
	_ = s.setIncident(ctx, inc, owner, domain.IncEscalated, "")
	if !notify {
		return
	}
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.GetTrip(ctx, inc.TripID)
		if err != nil {
			return err
		}
		return s.NotifyOperators(ctx, st, ev, "risk", "Needs you: "+t.Code, summary, "/ops/incidents/"+inc.ID)
	})
	if err != nil {
		slog.Error("escalate notify", "run", runID, "err", err)
	}
}
