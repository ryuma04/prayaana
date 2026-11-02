package ops

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"slices"
	"sort"
	"strings"

	"trizpyy/internal/aisvc"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/incidents"
	"trizpyy/internal/platform/httpx"
)

// The operator AI assistant. Code collects the facts (and runs a real What-If simulation when the
// question asks "what if"), the AI only reads them and answers. The answer comes from the Python AI
// agent when AI_SERVICE_URL is set, else from the backend's own LLM gateway, else from rules, so the
// console never depends on either AI being up. The assistant changes nothing: its suggestions are
// links to the pages where the operator acts.

type AskTurn struct {
	From string `json:"from"`
	Text string `json:"text"`
}

type AskInput struct {
	Question string `json:"question"`
	// IncidentID focuses the answer on one problem (its impact map, fix plans and agent steps).
	IncidentID string    `json:"incidentId"`
	History    []AskTurn `json:"history"`
}

type Answer struct {
	Answer     string               `json:"answer"`
	Source     string               `json:"source"` // ai-service | gateway | rules
	Engine     string               `json:"engine"`
	Tools      []string             `json:"tools"`
	Actions    []aisvc.Action       `json:"actions"`
	Simulation *engine.WhatIfResult `json:"simulation,omitempty"`
	Note       string               `json:"note,omitempty"`
}

func (s *Service) Ask(ctx context.Context, p auth.Principal, in AskInput) (Answer, error) {
	q := strings.TrimSpace(in.Question)
	if n := len([]rune(q)); n < 3 || n > 500 {
		return Answer{}, httpx.BadRequest("Ask a question of 3 to 500 characters.")
	}
	facts, sim, err := s.opsFacts(ctx, p, q, in.IncidentID)
	if err != nil {
		return Answer{}, err
	}
	ans := Answer{Tools: []string{}, Actions: baseActions(facts, sim, in.IncidentID), Simulation: sim}

	history := []aisvc.Turn{}
	for _, t := range in.History[max(0, len(in.History)-6):] {
		if t.From == "operator" || t.From == "assistant" {
			history = append(history, aisvc.Turn{From: t.From, Text: clip(t.Text, 400)})
		}
	}
	r, err := s.AISvc.AskOps(ctx, q, history, facts)
	if err == nil {
		ans.Answer, ans.Source, ans.Engine = clip(strings.TrimSpace(r.Answer), 2000), "ai-service", r.Engine
		if r.Tools != nil {
			ans.Tools = r.Tools
		}
		ans.Actions = mergeActions(ans.Actions, r.Actions)
		return ans, nil
	}
	if s.AISvc != nil {
		slog.Warn("ai service ask failed, answering in the backend", "err", err)
		ans.Note = "The Python AI service didn't answer, so the backend answered instead."
	}
	raw, _ := json.Marshal(facts)
	if text, eng, err := s.AI.OpsAnswer(ctx, clip(string(raw), 14000), q); err == nil {
		ans.Answer, ans.Source, ans.Engine = text, "gateway", eng
		return ans, nil
	}
	ans.Answer, ans.Source, ans.Engine = rulesAnswer(q, facts), "rules", "rules"
	return ans, nil
}

// Insight is the explanation shown under a What-If result.
type Insight struct {
	aisvc.WhatIfInsight
	Source string `json:"source"` // ai-service | rules
}

// WhatIfInsight re-runs the deterministic simulation (never trusting a client-sent result) and asks
// the AI agent to explain it. Without the agent it answers with rules; the simulator itself never waits on AI.
func (s *Service) WhatIfInsight(ctx context.Context, in incidents.ScenarioInput) (Insight, error) {
	res, err := s.incidents.Simulate(ctx, in)
	if err != nil {
		return Insight{}, err
	}
	sim := simFact(res)
	if r, err := s.AISvc.InterpretWhatIf(ctx, sim); err == nil {
		return Insight{WhatIfInsight: cleanInsight(r, res), Source: "ai-service"}, nil
	} else if s.AISvc != nil {
		slog.Warn("ai service what-if insight failed, using rules", "err", err)
	}
	return Insight{WhatIfInsight: RulesInsight(res), Source: "rules"}, nil
}

// ── Facts ──

func (s *Service) opsFacts(ctx context.Context, p auth.Principal, question, incidentID string) (aisvc.OpsFacts, *engine.WhatIfResult, error) {
	facts := aisvc.OpsFacts{Today: s.Eng.Today(), Trips: []aisvc.TripFact{}, Incidents: []aisvc.IncidentFact{}, Pending: []aisvc.PendingFact{}, Runs: []aisvc.RunFact{}}
	snap, err := s.load(ctx)
	if err != nil {
		return facts, nil, err
	}
	runs, err := s.Store.ListRuns(ctx, 60)
	if err != nil {
		return facts, nil, err
	}
	pending, err := s.Store.PendingRequests(ctx)
	if err != nil {
		return facts, nil, err
	}
	code := map[string]string{}
	for _, t := range snap.trips {
		code[t.ID] = t.Code
	}
	runStatus := map[string]string{}
	for _, r := range runs {
		runStatus[r.ID] = r.Status
	}

	rows := s.rows(snap)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Risk > rows[j].Risk })
	for _, r := range rows {
		if r.Status == "completed" || r.Status == "planning" || len(facts.Trips) >= 40 {
			continue
		}
		cur := 0
		if r.Trip.CurrentDay != nil {
			cur = *r.Trip.CurrentDay
		}
		facts.Trips = append(facts.Trips, aisvc.TripFact{ID: r.Trip.ID, Code: r.Trip.Code, Group: r.Trip.GroupName, Destination: s.destName(r.Trip.DestinationID),
			Status: r.Status, Risk: r.Risk, RiskReasons: r.RiskReasons, Travelers: r.Travelers, StartDate: r.Trip.Prefs.StartDate, EndDate: r.EndDate,
			CurrentDay: cur, PendingVendors: r.PendingVendors})
	}
	for _, i := range snap.incidents {
		if i.Status == domain.IncResolved || len(facts.Incidents) >= 30 {
			continue
		}
		facts.Incidents = append(facts.Incidents, incidentFact(i, code[i.TripID], runStatus[i.AgentRunID]))
	}
	now := s.Now()
	for _, r := range pending {
		if len(facts.Pending) >= 40 {
			break
		}
		facts.Pending = append(facts.Pending, aisvc.PendingFact{Vendor: s.Eng.Cat.VendorName(r.VendorID), TripCode: code[r.TripID], Item: r.ItemTitle,
			Proposed: clip(strings.Split(r.Proposed, "\n")[0], 160), Kind: r.Kind, AgeMin: int(now.Sub(r.CreatedAt).Minutes())})
	}
	for _, r := range runs {
		if r.Status != domain.RunRunning && r.Status != domain.RunWaiting && r.Status != domain.RunNeedsHuman {
			continue
		}
		if len(facts.Runs) >= 15 {
			break
		}
		rf := aisvc.RunFact{ID: r.ID, IncidentID: r.IncidentID, TripCode: code[r.TripID], Status: r.Status, Attempt: r.Attempt, Summary: r.Summary}
		if n := len(r.Steps); n > 0 {
			rf.LastStep = clip(r.Steps[n-1].Label+": "+r.Steps[n-1].Result, 200)
		}
		facts.Runs = append(facts.Runs, rf)
	}

	if incidentID != "" {
		d, err := s.incidents.Get(ctx, p, incidentID)
		if err != nil {
			return facts, nil, err
		}
		facts.Focus = s.focusFact(d, runStatus)
	}

	var sim *engine.WhatIfResult
	if sc := s.scenarioFromQuestion(question); sc != nil {
		res, err := s.incidents.Simulate(ctx, incidents.ScenarioInput{Custom: sc})
		if err != nil {
			slog.Info("assistant: question looked like a what-if but didn't simulate", "err", err)
		} else {
			sim = &res
			f := simFact(res)
			facts.Simulation = &f
		}
	}
	return facts, sim, nil
}

func incidentFact(i domain.Incident, tripCode, runStatus string) aisvc.IncidentFact {
	return aisvc.IncidentFact{ID: i.ID, TripCode: tripCode, Title: i.Title, Detail: clip(i.Detail, 240), Kind: i.Kind, Status: i.Status,
		Severity: i.Severity, Day: i.Day, RunStatus: runStatus}
}

func (s *Service) focusFact(d incidents.Detail, runStatus map[string]string) *aisvc.FocusFact {
	f := &aisvc.FocusFact{Incident: incidentFact(d.Incident, d.Trip.Code, runStatus[d.Incident.AgentRunID]), Impact: []aisvc.ImpactFact{},
		MoneyAtRisk: d.Impact.MoneyAtRisk, MinutesLost: d.Impact.MinutesLost, Plans: []aisvc.PlanFact{}, Steps: []aisvc.StepFact{}}
	for _, i := range d.Impact.Items {
		f.Impact = append(f.Impact, impactFact(d.Trip, i))
	}
	for _, p := range d.Plans {
		pf := aisvc.PlanFact{Strategy: p.Strategy, Title: p.Title, CostDelta: p.CostDelta, TimeDeltaMin: p.TimeDeltaMin, HeartsKept: p.HeartsKept,
			HeartsTotal: p.HeartsTotal, Swaps: p.Swaps, Confidence: p.Confidence, Recommended: p.Recommended, Actions: []string{}}
		for _, a := range p.Actions {
			pf.Actions = append(pf.Actions, clip(a.Label, 160))
		}
		f.Plans = append(f.Plans, pf)
	}
	if d.Run != nil {
		f.RunSummary = d.Run.Summary
		for _, st := range d.Run.Steps {
			f.Steps = append(f.Steps, aisvc.StepFact{Tool: st.Tool, Label: st.Label, Status: st.Status, Result: clip(st.Result, 240)})
		}
	}
	return f
}

func impactFact(t *domain.Trip, i domain.ImpactItem) aisvc.ImpactFact {
	f := aisvc.ImpactFact{Level: i.Level, Reason: i.Reason, CostAtRisk: i.CostAtRisk}
	if it := t.Item(i.ItemID); it != nil {
		f.Title, f.Day, f.StartMin = it.Title, it.Day, it.StartMin
	}
	return f
}

func simFact(res engine.WhatIfResult) aisvc.SimFact {
	sc := res.Scenario
	f := aisvc.SimFact{Title: sc.Title, Question: sc.Question, Destination: sc.DestinationID, Kind: sc.Kind, When: sc.When, Tours: []aisvc.SimTourFact{},
		Totals: aisvc.SimTotals{Tours: res.Totals.Tours, Travelers: res.Totals.Travelers, MoneyAtRisk: res.Totals.MoneyAtRisk, MinutesLost: res.Totals.MinutesLost,
			AutoFixable: res.Totals.AutoFixable, Safe: res.Totals.Levels.Safe, Moves: res.Totals.Levels.Moves, AtRisk: res.Totals.Levels.AtRisk,
			CannotHappen: res.Totals.Levels.CannotHappen, FixCost: res.Totals.FixCost}}
	for _, t := range res.Tours {
		tf := aisvc.SimTourFact{TripCode: t.Trip.Code, Group: t.Trip.GroupName, Day: t.Day, Travelers: t.Travelers, MoneyAtRisk: t.MoneyAtRisk,
			MinutesLost: t.MinutesLost, Safe: t.Levels.Safe, Moves: t.Levels.Moves, AtRisk: t.Levels.AtRisk, CannotHappen: t.Levels.CannotHappen,
			HeartsAtRisk: t.HeartsAtRisk, BestPlan: t.BestPlan, BestStrategy: t.BestStrategy, FixCost: t.FixCost, FixTimeMin: t.FixTimeMin,
			AutoFixable: t.AutoFixable, Items: []aisvc.ImpactFact{}}
		for _, i := range t.Items {
			if i.Level != domain.LevelSafe {
				tf.Items = append(tf.Items, aisvc.ImpactFact{Title: i.Title, Day: i.Day, StartMin: i.StartMin, Level: i.Level, Reason: i.Reason, CostAtRisk: i.CostAtRisk})
			}
		}
		f.Tours = append(f.Tours, tf)
	}
	return f
}

func (s *Service) destName(id string) string {
	if d := s.Eng.Cat.Destination(id); d != nil {
		return d.Name
	}
	return id
}

// ── "What if …" questions become a real simulation ──

var (
	whatIfRe  = regexp.MustCompile(`(?i)\b(what if|what happens|what would happen|simulate|suppose)\b`)
	weatherRe = regexp.MustCompile(`(?i)\b(rain|rains|raining|monsoon|storm|flood|floods|snow|cyclone|downpour|weather)\b`)
	flightRe  = regexp.MustCompile(`(?i)\b(flight|flights|plane|planes|landing|lands)\b`)
	closedRe  = regexp.MustCompile(`(?i)\b(?:if|when)\s+(?:the\s+)?(.{3,60}?)\s+(?:is\s+|gets\s+|are\s+)?(?:closed|closes|close|shut|shuts|shuts down)\b`)
	delayRe   = regexp.MustCompile(`(?i)(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\b`)
)

func (s *Service) scenarioFromQuestion(q string) *engine.Scenario {
	if !whatIfRe.MatchString(q) {
		return nil
	}
	lower := strings.ToLower(q)
	var dest *domain.Destination
	for i := range s.Eng.Cat.Destinations {
		d := &s.Eng.Cat.Destinations[i]
		// The name ("Leh Ladakh") or the id as a word ("leh", "pondicherry").
		if strings.Contains(lower, strings.ToLower(d.Name)) || regexp.MustCompile(`\b`+regexp.QuoteMeta(d.ID)+`\b`).MatchString(lower) {
			dest = d
			break
		}
	}
	if dest == nil {
		return nil
	}
	sc := engine.Scenario{DestinationID: dest.ID, When: "tomorrow", Question: clip(q, 160), Emoji: "❓"}
	if strings.Contains(lower, "today") {
		sc.When = "today"
	}
	for _, v := range s.Eng.Cat.Vendors {
		if v.DestinationID == dest.ID && v.Name != "" && strings.Contains(lower, strings.ToLower(v.Name)) {
			sc.Kind, sc.VendorID, sc.Title = domain.IncVendorUnavailable, v.ID, v.Name+" unavailable"
		}
	}
	switch {
	case sc.Kind != "":
	case weatherRe.MatchString(q):
		sc.Kind, sc.Title = domain.IncWeather, "Heavy rain in "+dest.Name
	case flightRe.MatchString(q):
		sc.Kind, sc.Title = domain.IncFlightDelay, dest.Name+" flights delayed"
		if m := delayRe.FindStringSubmatch(q); m != nil {
			var h int
			fmt.Sscanf(m[1], "%d", &h)
			if h >= 1 && h <= 24 {
				d := h * 60
				sc.DelayMin = &d
			}
		}
	default:
		m := closedRe.FindStringSubmatch(q)
		if m == nil {
			return nil
		}
		place := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(m[1]), " in "+strings.ToLower(dest.Name)))
		place = strings.TrimSpace(strings.TrimSuffix(place, " in "+dest.Name))
		if place == "" {
			return nil
		}
		sc.Kind, sc.Place, sc.Title = domain.IncClosure, clip(place, 80), clip(place+" closed", 80)
	}
	sc.Title = clip(sc.Title, 80)
	return &sc
}

// ── Actions: links only, computed by code ──

func baseActions(f aisvc.OpsFacts, sim *engine.WhatIfResult, incidentID string) []aisvc.Action {
	out := []aisvc.Action{}
	if sim != nil {
		sc := sim.Scenario
		href := fmt.Sprintf("/ops/what-if?destination=%s&kind=%s&when=%s", sc.DestinationID, sc.Kind, sc.When)
		if sc.Place != "" {
			href += "&place=" + url.QueryEscape(sc.Place)
		}
		if sc.VendorID != "" {
			href += "&vendor=" + url.QueryEscape(sc.VendorID)
		}
		if sc.DelayMin != nil {
			href += fmt.Sprintf("&delay=%d", *sc.DelayMin)
		}
		out = append(out, aisvc.Action{Kind: "simulate", Label: "Open in the What-If simulator", Href: href})
	}
	if incidentID != "" {
		out = append(out, aisvc.Action{Kind: "open", Label: "Open this problem", Href: "/ops/incidents/" + incidentID})
	}
	if len(f.Pending) > 0 {
		out = append(out, aisvc.Action{Kind: "open", Label: "Pending vendor confirmations", Href: "/ops/bookings?status=requested"})
	}
	if len(f.Runs) > 0 {
		out = append(out, aisvc.Action{Kind: "open", Label: "Trip Fixer runs", Href: "/ops/agent"})
	}
	return out
}

var actionKinds = []string{"open", "simulate"}

// mergeActions keeps the agent's suggestions only when they are plain links inside the console.
func mergeActions(base, extra []aisvc.Action) []aisvc.Action {
	seen := map[string]bool{}
	for _, a := range base {
		seen[a.Href] = true
	}
	for _, a := range extra {
		if len(base) >= 6 {
			break
		}
		a.Label, a.Href = clip(strings.TrimSpace(a.Label), 60), strings.TrimSpace(a.Href)
		if !slices.Contains(actionKinds, a.Kind) || a.Label == "" || !strings.HasPrefix(a.Href, "/ops") || strings.Contains(a.Href, "//") || seen[a.Href] {
			continue
		}
		seen[a.Href] = true
		base = append(base, a)
	}
	return base
}

// ── Rules (no AI available) ──

func rulesAnswer(q string, f aisvc.OpsFacts) string {
	lower := strings.ToLower(q)
	has := func(words ...string) bool {
		for _, w := range words {
			if strings.Contains(lower, w) {
				return true
			}
		}
		return false
	}
	var b strings.Builder
	switch {
	case f.Simulation != nil:
		t := f.Simulation.Totals
		if t.Tours == 0 {
			return fmt.Sprintf("Simulated “%s”: no booked or live trip would be affected.", f.Simulation.Title)
		}
		fmt.Fprintf(&b, "Simulated “%s”: %s affected, %d travelers, %s at risk. %d cannot happen, %d at risk, %d move. %d of %d can be fixed by the agent inside the traveler's rules.",
			f.Simulation.Title, engine.Plural(t.Tours, "trip"), t.Travelers, engine.Rupees(t.MoneyAtRisk), t.CannotHappen, t.AtRisk, t.Moves, t.AutoFixable, t.Tours)
	case f.Focus != nil && has("cheap"):
		for _, p := range f.Focus.Plans {
			if p.Strategy == domain.StrategyCheapest {
				fmt.Fprintf(&b, "Cheapest fix for %s: %s, %s, %d swaps, keeps %d of %d Must-Dos.", f.Focus.Incident.Title, p.Title, engine.RupeesSigned(p.CostDelta), p.Swaps, p.HeartsKept, p.HeartsTotal)
			}
		}
	case f.Focus != nil:
		fmt.Fprintf(&b, "%s (%s, Day %d, status %s). ", f.Focus.Incident.Title, f.Focus.Incident.TripCode, f.Focus.Incident.Day, strings.ReplaceAll(f.Focus.Incident.Status, "_", " "))
		for _, i := range f.Focus.Impact {
			if i.Level == domain.LevelCannotHappen || i.Level == domain.LevelAtRisk {
				fmt.Fprintf(&b, "%s is %s: %s. ", i.Title, strings.ReplaceAll(i.Level, "_", " "), i.Reason)
			}
		}
		for _, p := range f.Focus.Plans {
			if p.Recommended {
				fmt.Fprintf(&b, "Recommended: %s (%s).", p.Title, engine.RupeesSigned(p.CostDelta))
			}
		}
		if f.Focus.RunSummary != "" {
			b.WriteString(" Agent: " + f.Focus.RunSummary)
		}
	case has("vendor", "partner", "confirm"):
		if len(f.Pending) == 0 {
			return "No vendor confirmations are pending."
		}
		fmt.Fprintf(&b, "%s waiting for a vendor answer: ", engine.Plural(len(f.Pending), "request"))
		for i, p := range f.Pending[:min(5, len(f.Pending))] {
			if i > 0 {
				b.WriteString("; ")
			}
			fmt.Fprintf(&b, "%s for %s (%s)", p.Vendor, p.TripCode, p.Item)
		}
		b.WriteString(".")
	default:
		var risky []string
		for _, t := range f.Trips {
			if t.Status == "at_risk" || t.Risk >= 40 {
				risky = append(risky, fmt.Sprintf("%s %s (risk %d: %s)", t.Code, t.Group, t.Risk, strings.Join(t.RiskReasons, "; ")))
			}
		}
		fmt.Fprintf(&b, "%s open. ", engine.Plural(len(f.Incidents), "problem"))
		for _, i := range f.Incidents[:min(5, len(f.Incidents))] {
			fmt.Fprintf(&b, "%s: %s (%s). ", i.TripCode, i.Title, strings.ReplaceAll(i.Status, "_", " "))
		}
		if len(risky) == 0 {
			b.WriteString("No trip is at risk.")
		} else {
			b.WriteString("At risk: " + strings.Join(risky[:min(5, len(risky))], "; ") + ".")
		}
	}
	if b.Len() == 0 {
		return "I couldn't find that in the current trips and problems."
	}
	return b.String()
}

// RulesInsight explains a What-If result without AI.
func RulesInsight(res engine.WhatIfResult) aisvc.WhatIfInsight {
	t := res.Totals
	in := aisvc.WhatIfInsight{Engine: "rules", Confidence: 1, Consequences: []string{}, Priorities: []aisvc.Priority{}}
	if t.Tours == 0 {
		in.Headline = "No booked or live trip is affected"
		in.Summary = "Nothing in the current plans depends on this. No action needed."
		in.Recommendation = aisvc.Recommendation{Action: "no_action", Reason: "No trip is affected."}
		return in
	}
	in.Headline = fmt.Sprintf("%s, %d travelers, %s at risk", engine.Plural(t.Tours, "trip"), t.Travelers, engine.Rupees(t.MoneyAtRisk))
	in.Summary = fmt.Sprintf("%d plan items cannot happen, %d are at risk and %d move. The recommended fixes change the price by %s in total.",
		t.Levels.CannotHappen, t.Levels.AtRisk, t.Levels.Moves, engine.RupeesSigned(t.FixCost))
	if t.Levels.CannotHappen > 0 {
		in.Consequences = append(in.Consequences, fmt.Sprintf("%s would be lost without a fix", engine.Plural(t.Levels.CannotHappen, "booked item")))
	}
	if t.MinutesLost > 0 {
		in.Consequences = append(in.Consequences, fmt.Sprintf("%s of planned time lost", engine.Duration(t.MinutesLost)))
	}
	hearts := 0
	tours := append([]engine.WhatIfTour{}, res.Tours...)
	sort.SliceStable(tours, func(i, j int) bool { return tours[i].MoneyAtRisk > tours[j].MoneyAtRisk })
	for _, x := range tours {
		hearts += x.HeartsAtRisk
		if len(in.Priorities) < 3 {
			in.Priorities = append(in.Priorities, aisvc.Priority{TripCode: x.Trip.Code,
				Reason: fmt.Sprintf("%s at risk, %d cannot happen", engine.Rupees(x.MoneyAtRisk), x.Levels.CannotHappen)})
		}
	}
	if hearts > 0 {
		in.Consequences = append(in.Consequences, fmt.Sprintf("%s at risk", engine.Plural(hearts, "Must-Do")))
	}
	switch {
	case t.AutoFixable == t.Tours:
		in.Recommendation = aisvc.Recommendation{Action: "fix_all", Reason: "Every affected trip has a fix inside the traveler's rules; the agent still asks every vendor before changing anything."}
	case t.AutoFixable > 0:
		in.Recommendation = aisvc.Recommendation{Action: "fix_some", Reason: fmt.Sprintf("%d of %d trips can be fixed inside the traveler's rules; the rest will need your approval.", t.AutoFixable, t.Tours)}
	default:
		in.Recommendation = aisvc.Recommendation{Action: "monitor", Reason: "Every fix costs more than the auto-approve limit or loses a Must-Do; review the trips before fixing."}
	}
	return in
}

// cleanInsight keeps only what the agent may say: a known recommendation and priorities on trips that are really affected.
func cleanInsight(r aisvc.WhatIfInsight, res engine.WhatIfResult) aisvc.WhatIfInsight {
	fallback := RulesInsight(res)
	if !slices.Contains(aisvc.Recommendations, r.Recommendation.Action) {
		r.Recommendation = fallback.Recommendation
	}
	if res.Totals.Tours == 0 {
		r.Recommendation = fallback.Recommendation
	}
	codes := map[string]bool{}
	for _, t := range res.Tours {
		codes[t.Trip.Code] = true
	}
	prio := []aisvc.Priority{}
	for _, p := range r.Priorities {
		if codes[p.TripCode] && len(prio) < 5 {
			p.Reason = clip(p.Reason, 200)
			prio = append(prio, p)
		}
	}
	r.Priorities = prio
	cons := []string{}
	for _, c := range r.Consequences {
		if c = clip(strings.TrimSpace(c), 200); c != "" && len(cons) < 6 {
			cons = append(cons, c)
		}
	}
	r.Consequences = cons
	r.Headline, r.Summary = clip(r.Headline, 140), clip(r.Summary, 800)
	r.Recommendation.Reason = clip(r.Recommendation.Reason, 300)
	r.Confidence = max(0, min(1, r.Confidence))
	return r
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
