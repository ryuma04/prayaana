package aisvc

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// The AI agent (services/ai/app/agents) reasons over facts Go sends it and answers with a
// structured result. It never reads or changes trips itself: Go stays the source of truth,
// and every change still goes through the Trip Fixer, safety checks and vendor confirmation.

const defaultAgentTimeout = 15 * time.Second

// ── Facts (Go → agent) ──

type TripFact struct {
	ID             string   `json:"id"`
	Code           string   `json:"code"`
	Group          string   `json:"group"`
	Destination    string   `json:"destination"`
	Status         string   `json:"status"`
	Risk           int      `json:"risk"`
	RiskReasons    []string `json:"risk_reasons"`
	Travelers      int      `json:"travelers"`
	StartDate      string   `json:"start_date"`
	EndDate        string   `json:"end_date"`
	CurrentDay     int      `json:"current_day"`
	PendingVendors int      `json:"pending_vendors"`
}

type IncidentFact struct {
	ID        string `json:"id"`
	TripCode  string `json:"trip_code"`
	Title     string `json:"title"`
	Detail    string `json:"detail"`
	Kind      string `json:"kind"`
	Status    string `json:"status"`
	Severity  int    `json:"severity"`
	Day       int    `json:"day"`
	RunStatus string `json:"run_status,omitempty"`
}

type PendingFact struct {
	Vendor   string `json:"vendor"`
	TripCode string `json:"trip_code"`
	Item     string `json:"item"`
	Proposed string `json:"proposed"`
	Kind     string `json:"kind"`
	AgeMin   int    `json:"age_min"`
}

type RunFact struct {
	ID         string `json:"id"`
	IncidentID string `json:"incident_id"`
	TripCode   string `json:"trip_code"`
	Status     string `json:"status"`
	Attempt    int    `json:"attempt"`
	Summary    string `json:"summary,omitempty"`
	LastStep   string `json:"last_step,omitempty"`
}

type ImpactFact struct {
	Title      string `json:"title"`
	Day        int    `json:"day"`
	StartMin   int    `json:"start_min"`
	Level      string `json:"level"`
	Reason     string `json:"reason"`
	CostAtRisk int    `json:"cost_at_risk"`
}

type PlanFact struct {
	Strategy     string   `json:"strategy"`
	Title        string   `json:"title"`
	CostDelta    int      `json:"cost_delta"`
	TimeDeltaMin int      `json:"time_delta_min"`
	HeartsKept   int      `json:"hearts_kept"`
	HeartsTotal  int      `json:"hearts_total"`
	Swaps        int      `json:"swaps"`
	Confidence   int      `json:"confidence"`
	Recommended  bool     `json:"recommended"`
	Actions      []string `json:"actions"`
}

type StepFact struct {
	Tool   string `json:"tool"`
	Label  string `json:"label"`
	Status string `json:"status"`
	Result string `json:"result,omitempty"`
}

// FocusFact is one incident in depth: its Change Impact Map, the 3 fix plans and the agent's steps.
type FocusFact struct {
	Incident    IncidentFact `json:"incident"`
	Impact      []ImpactFact `json:"impact"`
	MoneyAtRisk int          `json:"money_at_risk"`
	MinutesLost int          `json:"minutes_lost"`
	Plans       []PlanFact   `json:"plans"`
	Steps       []StepFact   `json:"steps"`
	RunSummary  string       `json:"run_summary,omitempty"`
}

type SimTourFact struct {
	TripCode     string       `json:"trip_code"`
	Group        string       `json:"group"`
	Day          int          `json:"day"`
	Travelers    int          `json:"travelers"`
	MoneyAtRisk  int          `json:"money_at_risk"`
	MinutesLost  int          `json:"minutes_lost"`
	Safe         int          `json:"safe"`
	Moves        int          `json:"moves"`
	AtRisk       int          `json:"at_risk"`
	CannotHappen int          `json:"cannot_happen"`
	HeartsAtRisk int          `json:"hearts_at_risk"`
	BestPlan     string       `json:"best_plan"`
	BestStrategy string       `json:"best_strategy"`
	FixCost      int          `json:"fix_cost"`
	FixTimeMin   int          `json:"fix_time_min"`
	AutoFixable  bool         `json:"auto_fixable"`
	Items        []ImpactFact `json:"items"`
}

type SimTotals struct {
	Tours        int `json:"tours"`
	Travelers    int `json:"travelers"`
	MoneyAtRisk  int `json:"money_at_risk"`
	MinutesLost  int `json:"minutes_lost"`
	AutoFixable  int `json:"auto_fixable"`
	Safe         int `json:"safe"`
	Moves        int `json:"moves"`
	AtRisk       int `json:"at_risk"`
	CannotHappen int `json:"cannot_happen"`
	FixCost      int `json:"fix_cost"`
}

// SimFact is a deterministic What-If result from the Go engine.
type SimFact struct {
	Title       string        `json:"title"`
	Question    string        `json:"question"`
	Destination string        `json:"destination"`
	Kind        string        `json:"kind"`
	When        string        `json:"when"`
	Tours       []SimTourFact `json:"tours"`
	Totals      SimTotals     `json:"totals"`
}

type OpsFacts struct {
	Today      string         `json:"today"`
	Trips      []TripFact     `json:"trips"`
	Incidents  []IncidentFact `json:"incidents"`
	Pending    []PendingFact  `json:"pending_confirmations"`
	Runs       []RunFact      `json:"agent_runs"`
	Focus      *FocusFact     `json:"focus,omitempty"`
	Simulation *SimFact       `json:"simulation,omitempty"`
}

type Turn struct {
	From string `json:"from"`
	Text string `json:"text"`
}

// ── Results (agent → Go) ──

// Action is a link the agent suggests; the operator acts on the page it opens.
type Action struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Href  string `json:"href"`
}

type OpsAnswer struct {
	Answer     string   `json:"answer"`
	Engine     string   `json:"engine"`
	Tools      []string `json:"tools"`
	Actions    []Action `json:"actions"`
	Confidence float64  `json:"confidence"`
}

type Recommendation struct {
	Action string `json:"action"` // fix_all | fix_some | monitor | no_action
	Reason string `json:"reason"`
}

type Priority struct {
	TripCode string `json:"trip_code"`
	Reason   string `json:"reason"`
}

type WhatIfInsight struct {
	Headline       string         `json:"headline"`
	Summary        string         `json:"summary"`
	Consequences   []string       `json:"consequences"`
	Recommendation Recommendation `json:"recommendation"`
	Priorities     []Priority     `json:"priorities"`
	Engine         string         `json:"engine"`
	Confidence     float64        `json:"confidence"`
}

var Recommendations = []string{"fix_all", "fix_some", "monitor", "no_action"}

// AskOps answers an operator question from the console facts.
func (c *Client) AskOps(ctx context.Context, question string, history []Turn, facts OpsFacts) (OpsAnswer, error) {
	var out OpsAnswer
	if c == nil {
		return out, ErrUnavailable
	}
	err := c.send(ctx, c.agent, http.MethodPost, "/v1/agent/ops/ask", map[string]any{"question": question, "history": history, "facts": facts}, &out)
	if err == nil && strings.TrimSpace(out.Answer) == "" {
		return out, ErrInvalidResponse
	}
	return out, err
}

// InterpretWhatIf explains a deterministic What-If result and recommends what to do.
func (c *Client) InterpretWhatIf(ctx context.Context, sim SimFact) (WhatIfInsight, error) {
	var out WhatIfInsight
	if c == nil {
		return out, ErrUnavailable
	}
	err := c.send(ctx, c.agent, http.MethodPost, "/v1/agent/whatif/interpret", map[string]any{"simulation": sim}, &out)
	if err == nil && strings.TrimSpace(out.Headline) == "" {
		return out, ErrInvalidResponse
	}
	return out, err
}
