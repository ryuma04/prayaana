package domain

import "time"

const (
	IncWeather           = "weather"
	IncFlightDelay       = "flight_delay"
	IncVendorUnavailable = "vendor_unavailable"
	IncTravelerRequest   = "traveler_request"
	IncClosure           = "closure"
	IncRunningLate       = "running_late"
	IncCrowdReport       = "crowd_report"
	IncHealth            = "health"

	IncOpen            = "open"
	IncAnalyzing       = "analyzing"
	IncPlansReady      = "plans_ready"
	IncAwaitingVendors = "awaiting_vendors"
	IncResolved        = "resolved"
	IncEscalated       = "escalated"

	LevelSafe         = "safe"
	LevelMoves        = "moves"
	LevelAtRisk       = "at_risk"
	LevelCannotHappen = "cannot_happen"

	StrategyCheapest   = "cheapest"
	StrategyFastest    = "fastest"
	StrategyFavourites = "favourites"
)

var IncidentKinds = []string{IncWeather, IncFlightDelay, IncVendorUnavailable, IncTravelerRequest, IncClosure, IncRunningLate, IncCrowdReport, IncHealth}

var IncidentSources = []string{"weather-job", "flight-job", "chat", "operator", "crowd", "traveler", "simulator", "vendor"}

type Incident struct {
	ID             string    `json:"id"`
	TripID         string    `json:"tripId"`
	Kind           string    `json:"kind"`
	Title          string    `json:"title"`
	Detail         string    `json:"detail"`
	Day            int       `json:"day"`
	Severity       int       `json:"severity"`
	Source         string    `json:"source"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
	DelayMin       *int      `json:"delayMin,omitempty"`
	VendorID       string    `json:"vendorId,omitempty"`
	Place          string    `json:"place,omitempty"`
	Mood           string    `json:"mood,omitempty"`
	SelectedPlanID string    `json:"selectedPlanId,omitempty"`
	AgentRunID     string    `json:"agentRunId,omitempty"`
	ReceiptID      string    `json:"receiptId,omitempty"`
}

type ImpactItem struct {
	ItemID      string `json:"itemId"`
	Level       string `json:"level"`
	Reason      string `json:"reason"`
	CostAtRisk  int    `json:"costAtRisk"`
	NewStartMin *int   `json:"newStartMin,omitempty"`
	Order       int    `json:"order"`
	CauseID     string `json:"causeId,omitempty"`
}

type ImpactSummary struct {
	Items          []ImpactItem `json:"items"`
	MoneyAtRisk    int          `json:"moneyAtRisk"`
	MinutesLost    int          `json:"minutesLost"`
	HeartsAtRisk   int          `json:"heartsAtRisk"`
	VendorsTouched []string     `json:"vendorsTouched"`
	Root           string       `json:"root"`
}

type FixAction struct {
	Type        string `json:"type"`
	ItemID      string `json:"itemId"`
	Label       string `json:"label"`
	FromLabel   string `json:"fromLabel"`
	ToLabel     string `json:"toLabel"`
	ToRefID     string `json:"toRefId,omitempty"`
	ToDay       *int   `json:"toDay,omitempty"`
	ToStartMin  *int   `json:"toStartMin,omitempty"`
	CostDelta   int    `json:"costDelta"`
	VendorID    string `json:"vendorId,omitempty"`
	NewVendorID string `json:"newVendorId,omitempty"`
}

// Vendor is the partner who must confirm this action (the new one for swaps and rebooks).
func (a FixAction) Vendor() string {
	if a.NewVendorID != "" {
		return a.NewVendorID
	}
	return a.VendorID
}

type PlanScore struct {
	Cost      int `json:"cost"`
	Time      int `json:"time"`
	Happiness int `json:"happiness"`
}

type FixPlan struct {
	ID           string      `json:"id"`
	IncidentID   string      `json:"incidentId"`
	Strategy     string      `json:"strategy"`
	Title        string      `json:"title"`
	Tagline      string      `json:"tagline"`
	CostDelta    int         `json:"costDelta"`
	TimeDeltaMin int         `json:"timeDeltaMin"`
	HeartsKept   int         `json:"heartsKept"`
	HeartsTotal  int         `json:"heartsTotal"`
	Swaps        int         `json:"swaps"`
	Actions      []FixAction `json:"actions"`
	Vendors      []string    `json:"vendors"`
	Confidence   int         `json:"confidence"`
	WeatherOK    bool        `json:"weatherOk"`
	Score        PlanScore   `json:"score"`
	Recommended  bool        `json:"recommended,omitempty"`
}

type SafetyCheck struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Engine string `json:"engine"`
	Passed bool   `json:"passed"`
	TookMs int    `json:"tookMs"`
	Detail string `json:"detail"`
}

const (
	RunRunning    = "running"
	RunWaiting    = "waiting"
	RunSucceeded  = "succeeded"
	RunFailed     = "failed"
	RunNeedsHuman = "needs_human"

	StepPending = "pending"
	StepRunning = "running"
	StepDone    = "done"
	StepFailed  = "failed"
	StepWarning = "warning"
	StepWaiting = "waiting"
)

type AgentStep struct {
	ID     string    `json:"id"`
	Tool   string    `json:"tool"`
	Label  string    `json:"label"`
	Status string    `json:"status"`
	Result string    `json:"result,omitempty"`
	Detail []string  `json:"detail,omitempty"`
	TS     time.Time `json:"ts"`
	TookMs *int      `json:"tookMs,omitempty"`
	Kind   string    `json:"kind,omitempty"`
}

type AgentRun struct {
	ID              string         `json:"id"`
	IncidentID      string         `json:"incidentId"`
	TripID          string         `json:"tripId"`
	Status          string         `json:"status"`
	StartedAt       time.Time      `json:"startedAt"`
	FinishedAt      *time.Time     `json:"finishedAt,omitempty"`
	Steps           []AgentStep    `json:"steps"`
	Attempt         int            `json:"attempt"`
	PlanID          string         `json:"planId,omitempty"`
	Mode            string         `json:"mode"`
	ExcludedVendors []string       `json:"excludedVendors"`
	Scope           string         `json:"scope"`
	Plans           []FixPlan      `json:"plans,omitempty"`
	Impact          *ImpactSummary `json:"impact,omitempty"`
	Summary         string         `json:"summary,omitempty"`
}

const (
	AnswerPending   = "pending"
	AnswerYes       = "yes"
	AnswerNo        = "no"
	AnswerOtherTime = "other_time"
	AnswerTimeout   = "timeout"
	AnswerCancelled = "cancelled"
)

type VoiceInterpretation struct {
	AudioLabel  string  `json:"audioLabel"`
	DurationSec int     `json:"durationSec"`
	Transcript  string  `json:"transcript"`
	Translation string  `json:"translation,omitempty"`
	Decision    string  `json:"decision"`
	Time        string  `json:"time,omitempty"`
	Confidence  float64 `json:"confidence"`
	Language    string  `json:"language"`
}

type VendorRequest struct {
	Token          string               `json:"token"`
	ConfirmationID string               `json:"confirmationId,omitempty"`
	RunID          string               `json:"runId,omitempty"`
	IncidentID     string               `json:"incidentId,omitempty"`
	TripID         string               `json:"tripId"`
	VendorID       string               `json:"vendorId"`
	TravelerName   string               `json:"travelerName"`
	DateLabel      string               `json:"dateLabel"`
	Original       string               `json:"original"`
	Proposed       string               `json:"proposed"`
	ItemTitle      string               `json:"itemTitle"`
	Status         string               `json:"status"`
	Channel        string               `json:"channel,omitempty"`
	RespondedAt    *time.Time           `json:"respondedAt,omitempty"`
	AltTime        string               `json:"altTime,omitempty"`
	Voice          *VoiceInterpretation `json:"voice,omitempty"`
	CreatedAt      time.Time            `json:"createdAt"`
	Kind           string               `json:"kind"`
}
