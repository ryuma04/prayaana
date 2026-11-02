// Package aisvc calls the Python AI service (services/ai): OR-Tools day optimizer, semantic
// search over the catalog, the demo delay-risk model and vendor reliability estimates.
// Every call is optional: callers fall back to the Go rules when it returns an error.
package aisvc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

var (
	// ErrUnavailable: not configured, unreachable, timed out, or the model isn't loaded.
	ErrUnavailable = errors.New("ai service unavailable")
	// ErrInvalidResponse: the service answered with something we can't use.
	ErrInvalidResponse = errors.New("ai service returned an invalid response")
)

// Error is a structured error the service returned (4xx: our request was wrong).
type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("ai service %d %s: %s", e.Status, e.Code, e.Message)
}

type Client struct {
	base   string
	http   *http.Client
	agent  *http.Client // AI agent calls wait on an LLM, so they get a longer timeout
	status atomic.Value // last health status, for /healthz
}

// New returns nil when no URL is configured; a nil client answers ErrUnavailable.
func New(base string, timeout time.Duration) *Client {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		return nil
	}
	c := &Client{base: base, http: &http.Client{Timeout: timeout}, agent: &http.Client{Timeout: max(timeout, defaultAgentTimeout)}}
	c.status.Store("unknown")
	return c
}

func (c *Client) Status() string {
	if c == nil {
		return "off"
	}
	return c.status.Load().(string)
}

func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	if c == nil {
		return ErrUnavailable
	}
	return c.send(ctx, c.http, method, path, in, out)
}

func (c *Client) send(ctx context.Context, hc *http.Client, method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if id := middleware.GetReqID(ctx); id != "" {
		req.Header.Set("X-Request-ID", id)
	}
	resp, err := hc.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	if resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode >= 500 {
		return fmt.Errorf("%w: status %d", ErrUnavailable, resp.StatusCode)
	}
	if resp.StatusCode >= 300 {
		var e struct {
			Error struct{ Code, Message string } `json:"error"`
		}
		_ = json.Unmarshal(raw, &e)
		return &Error{Status: resp.StatusCode, Code: e.Error.Code, Message: e.Error.Message}
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	return nil
}

// ── Health ──

type Health struct {
	Status   string `json:"status"`
	Semantic struct {
		Status string `json:"status"`
		Store  string `json:"store"`
	} `json:"semantic"`
	Agent struct {
		Status string   `json:"status"`
		LLM    []string `json:"llm"`
	} `json:"agent"`
}

func (c *Client) Health(ctx context.Context) (Health, error) {
	var h Health
	err := c.do(ctx, http.MethodGet, "/health", nil, &h)
	if c != nil {
		switch {
		case err != nil:
			c.status.Store("down")
		case h.Semantic.Status != "ready":
			c.status.Store("up (semantic " + h.Semantic.Status + ")")
		default:
			c.status.Store("up")
		}
	}
	return h, err
}

// ── Optimizer ──

type Point struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
}

type Stop struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Lat         *float64 `json:"lat,omitempty"`
	Lng         *float64 `json:"lng,omitempty"`
	DurationMin int      `json:"duration_min"`
	OpenMin     int      `json:"open_min"`
	CloseMin    int      `json:"close_min"`
	Required    bool     `json:"required"`
	WeatherOK   bool     `json:"weather_ok"`
	Energy      int      `json:"energy"`
}

type Precedence struct {
	Before string `json:"before"`
	After  string `json:"after"`
}

type OptimizeRequest struct {
	Day           int          `json:"day"`
	Start         *Point       `json:"start,omitempty"`
	DayStartMin   int          `json:"day_start_min"`
	DayEndMin     int          `json:"day_end_min"`
	Stops         []Stop       `json:"stops"`
	TravelMinutes [][]int      `json:"travel_minutes,omitempty"`
	ReturnToStart bool         `json:"return_to_start"`
	MaxEnergy     *int         `json:"max_energy,omitempty"`
	Precedence    []Precedence `json:"precedence"`
}

type Visit struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StartMin  int    `json:"start_min"`
	EndMin    int    `json:"end_min"`
	TravelMin int    `json:"travel_min"`
}

type Dropped struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type OptimizeResponse struct {
	Feasible       bool           `json:"feasible"`
	Order          []Visit        `json:"order"`
	Dropped        []Dropped      `json:"dropped"`
	Conflicts      []string       `json:"conflicts"`
	TotalTravelMin int            `json:"total_travel_min"`
	Metadata       map[string]any `json:"metadata"`
}

func (c *Client) OptimizeDay(ctx context.Context, in OptimizeRequest) (OptimizeResponse, error) {
	var out OptimizeResponse
	err := c.do(ctx, http.MethodPost, "/optimize/day", in, &out)
	if err == nil && out.Feasible && len(out.Order) == 0 && len(in.Stops) > 0 && len(out.Dropped) == 0 {
		return out, ErrInvalidResponse
	}
	return out, err
}

// ── Semantic search ──

type Match struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	DestinationID string   `json:"destination_id"`
	Score         float64  `json:"score"`
	Interests     []string `json:"interests"`
}

func (c *Client) Search(ctx context.Context, query, destinationID string, k int) ([]Match, error) {
	var out struct {
		Results []Match `json:"results"`
	}
	in := map[string]any{"query": query, "k": k}
	if destinationID != "" {
		in["destination_id"] = destinationID
	}
	err := c.do(ctx, http.MethodPost, "/search", in, &out)
	return out.Results, err
}

// SimilarityMatrix is the cosine similarity of every activity pair inside each destination.
func (c *Client) SimilarityMatrix(ctx context.Context) (map[string]map[string]float64, error) {
	var out struct {
		Matrix map[string]map[string]float64 `json:"matrix"`
	}
	if err := c.do(ctx, http.MethodGet, "/similarity-matrix", nil, &out); err != nil {
		return nil, err
	}
	if out.Matrix == nil {
		return nil, ErrInvalidResponse
	}
	return out.Matrix, nil
}

// ── Delay risk (demo model) ──

type Transfer struct {
	TransferID string  `json:"transfer_id"`
	Mode       string  `json:"mode"`
	DistanceKm float64 `json:"distance_km"`
	RainChance int     `json:"rain_chance"`
	DepartMin  int     `json:"depart_min"`
	PeakSeason bool    `json:"peak_season"`
	BufferMin  int     `json:"buffer_min"`
}

type DelayRisk struct {
	TransferID string   `json:"transfer_id"`
	RiskScore  float64  `json:"risk_score"`
	RiskLevel  string   `json:"risk_level"`
	Factors    []string `json:"factors"`
}

func (c *Client) DelayRisk(ctx context.Context, transfers []Transfer) ([]DelayRisk, map[string]any, error) {
	var out struct {
		Risks    []DelayRisk    `json:"risks"`
		Metadata map[string]any `json:"metadata"`
	}
	err := c.do(ctx, http.MethodPost, "/risk/delay", map[string]any{"transfers": transfers}, &out)
	if err == nil && len(out.Risks) != len(transfers) {
		return nil, nil, ErrInvalidResponse
	}
	return out.Risks, out.Metadata, err
}

// ── Vendor reliability ──

type VendorHistory struct {
	VendorID    string  `json:"vendor_id"`
	Answered    int     `json:"answered"`
	Declined    int     `json:"declined"`
	Expired     int     `json:"expired"`
	AvgReplyMin float64 `json:"avg_reply_min"`
}

type Reliability struct {
	VendorID           string     `json:"vendor_id"`
	FailureProbability float64    `json:"failure_probability"`
	Interval90         [2]float64 `json:"interval_90"`
	Evidence           int        `json:"evidence"`
	NeedsBackup        bool       `json:"needs_backup"`
	Explanation        string     `json:"explanation"`
}

func (c *Client) Reliability(ctx context.Context, v VendorHistory) (Reliability, error) {
	var out struct {
		Vendors []Reliability `json:"vendors"`
	}
	if err := c.do(ctx, http.MethodPost, "/vendors/reliability", map[string]any{"vendors": []VendorHistory{v}}, &out); err != nil {
		return Reliability{}, err
	}
	if len(out.Vendors) != 1 {
		return Reliability{}, ErrInvalidResponse
	}
	return out.Vendors[0], nil
}
