package providers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	SourceAviationstack = "aviationstack"
	SourceTimetable     = "timetable"
)

// FlightPoint is one end of a flight. Times are local wall-clock "2006-01-02T15:04".
type FlightPoint struct {
	Airport   string `json:"airport"`
	IATA      string `json:"iata"`
	Scheduled string `json:"scheduled,omitempty"`
	Estimated string `json:"estimated,omitempty"`
	Actual    string `json:"actual,omitempty"`
	Terminal  string `json:"terminal,omitempty"`
	Gate      string `json:"gate,omitempty"`
	DelayMin  int    `json:"delayMin"`
}

// FlightStatus is the normalized answer the frontend shows.
type FlightStatus struct {
	Flight    string      `json:"flight"`
	Airline   string      `json:"airline"`
	Date      string      `json:"date"`
	Status    string      `json:"status"` // scheduled, active, landed, cancelled, delayed, diverted, incident, unknown
	DelayMin  int         `json:"delayMin"`
	Departure FlightPoint `json:"departure"`
	Arrival   FlightPoint `json:"arrival"`
	Source    string      `json:"source"`
	Live      bool        `json:"live"`
	FetchedAt time.Time   `json:"fetchedAt"`
	Note      string      `json:"note,omitempty"`
}

// FlightQuery is what we know about a trip's flight from the catalog.
type FlightQuery struct {
	Flight      string // IATA flight code, e.g. "6E5392"
	Airline     string
	Date        string // ISO date of departure
	From, To    string // IATA airport codes
	Departs     string // "07:10"
	DurationMin int
}

// FlightProvider looks up live flight status.
type FlightProvider interface {
	Name() string
	Status(ctx context.Context, q FlightQuery) (FlightStatus, error)
}

var flightCode = regexp.MustCompile(`\b([A-Z0-9]{2})[- ]?(\d{2,4})\b`)
var airportPair = regexp.MustCompile(`\b([A-Z]{3})\s*(?:→|->|-)\s*([A-Z]{3})\b`)

// ParseFlightLabel reads "IndiGo 6E-5392 · BOM → GOX" into airline, code and airports.
func ParseFlightLabel(label string) (airline, code, from, to string) {
	if m := flightCode.FindStringSubmatch(label); m != nil {
		code = m[1] + m[2]
		airline = strings.TrimSpace(label[:strings.Index(label, m[0])])
	}
	if m := airportPair.FindStringSubmatch(label); m != nil {
		from, to = m[1], m[2]
	}
	return
}

// Mock answers from the operator's timetable; it is the fallback when the live
// provider is not configured, out of quota, or the flight is not within a day.
type MockFlights struct{}

func (MockFlights) Name() string { return SourceTimetable }

func (MockFlights) Status(_ context.Context, q FlightQuery) (FlightStatus, error) {
	dep := q.Date + "T" + q.Departs
	arr := ""
	if t, err := time.Parse("2006-01-02T15:04", dep); err == nil {
		arr = t.Add(time.Duration(q.DurationMin) * time.Minute).Format("2006-01-02T15:04")
	}
	return FlightStatus{Flight: q.Flight, Airline: q.Airline, Date: q.Date, Status: "scheduled", Source: SourceTimetable,
		Departure: FlightPoint{IATA: q.From, Scheduled: dep}, Arrival: FlightPoint{IATA: q.To, Scheduled: arr}}, nil
}

// Aviationstack is the live provider. Its free plan has a tiny monthly quota,
// so Flights caches answers and caps calls per day.
type Aviationstack struct {
	base, key string
	client    *http.Client
}

func NewAviationstack(base, key string, timeout time.Duration) *Aviationstack {
	return &Aviationstack{base: strings.TrimRight(base, "/"), key: key, client: &http.Client{Timeout: timeout}}
}

func (a *Aviationstack) Name() string { return SourceAviationstack }

type avPoint struct {
	Airport   string  `json:"airport"`
	IATA      string  `json:"iata"`
	Terminal  *string `json:"terminal"`
	Gate      *string `json:"gate"`
	Delay     *int    `json:"delay"`
	Scheduled *string `json:"scheduled"`
	Estimated *string `json:"estimated"`
	Actual    *string `json:"actual"`
}

type avResponse struct {
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	Data []struct {
		FlightDate   string  `json:"flight_date"`
		FlightStatus string  `json:"flight_status"`
		Departure    avPoint `json:"departure"`
		Arrival      avPoint `json:"arrival"`
		Airline      struct {
			Name string `json:"name"`
		} `json:"airline"`
		Flight struct {
			IATA string `json:"iata"`
		} `json:"flight"`
	} `json:"data"`
}

// ErrFlightNotFound means the provider answered but has no such flight today.
var ErrFlightNotFound = errors.New("flight not found")

func (a *Aviationstack) Status(ctx context.Context, q FlightQuery) (FlightStatus, error) {
	params := url.Values{"access_key": {a.key}, "flight_iata": {q.Flight}, "limit": {"10"}}
	endpoint := a.base + "/flights?" + params.Encode()
	var res avResponse
	if err := doJSON(ctx, a.client, func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	}, &res); err != nil {
		return FlightStatus{}, redactKey(err, a.key)
	}
	if res.Error != nil {
		return FlightStatus{}, fmt.Errorf("%w: aviationstack %s: %s", ErrUnavailable, res.Error.Code, res.Error.Message)
	}
	// The free plan cannot filter by date: pick today's (or the closest) instance.
	best := -1
	for i, d := range res.Data {
		if q.From != "" && d.Departure.IATA != "" && !strings.EqualFold(d.Departure.IATA, q.From) {
			continue // same number, other direction or route
		}
		if d.FlightDate == q.Date {
			best = i
			break
		}
		if best < 0 || d.FlightDate > res.Data[best].FlightDate {
			best = i
		}
	}
	if best < 0 {
		return FlightStatus{}, ErrFlightNotFound
	}
	d := res.Data[best]
	out := FlightStatus{Flight: q.Flight, Airline: firstNonEmpty(d.Airline.Name, q.Airline), Date: d.FlightDate, Status: d.FlightStatus,
		Departure: point(d.Departure), Arrival: point(d.Arrival), Source: SourceAviationstack, Live: true}
	out.DelayMin = max(out.Departure.DelayMin, out.Arrival.DelayMin)
	if out.Status == "" {
		out.Status = "unknown"
	}
	if out.DelayMin >= 15 && (out.Status == "scheduled" || out.Status == "active") {
		out.Status = "delayed"
	}
	if d.FlightDate != q.Date {
		out.Note = "Showing the latest operated " + q.Flight + " (" + d.FlightDate + ")."
	}
	return out, nil
}

// Aviationstack reports local times with a misleading "+00:00"; keep the wall clock only.
func localTime(s *string) string {
	if s == nil || len(*s) < 16 {
		return ""
	}
	return (*s)[:16]
}

func point(p avPoint) FlightPoint {
	fp := FlightPoint{Airport: p.Airport, IATA: p.IATA, Scheduled: localTime(p.Scheduled), Estimated: localTime(p.Estimated), Actual: localTime(p.Actual)}
	if p.Terminal != nil {
		fp.Terminal = *p.Terminal
	}
	if p.Gate != nil {
		fp.Gate = *p.Gate
	}
	if p.Delay != nil {
		fp.DelayMin = *p.Delay
	}
	return fp
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}

// redactKey keeps the access key out of logs (net/http errors include the URL).
func redactKey(err error, key string) error {
	if err == nil || key == "" || !strings.Contains(err.Error(), key) {
		return err
	}
	return fmt.Errorf("%w: %s", ErrUnavailable, strings.ReplaceAll(err.Error(), key, "REDACTED"))
}

// Flights caches live answers, spends the daily budget only for flights departing
// within a day, and falls back to the timetable for everything else.
type Flights struct {
	live  FlightProvider
	mock  MockFlights
	cache *cache[FlightStatus]
	quota *budget
	today func() string

	mu      sync.Mutex
	lastErr string
}

func NewFlights(live FlightProvider, ttl time.Duration, dailyLimit int, today func() string) *Flights {
	return &Flights{live: live, cache: newCache[FlightStatus](ttl, 500), quota: &budget{limit: dailyLimit, now: time.Now}, today: today}
}

// Provider reports the configured live provider ("timetable" when none).
func (f *Flights) Provider() string {
	if f.live == nil {
		return SourceTimetable
	}
	return f.live.Name()
}

func (f *Flights) Status(ctx context.Context, q FlightQuery) FlightStatus {
	fallback, _ := f.mock.Status(ctx, q)
	fallback.FetchedAt = time.Now().UTC()
	if f.live == nil {
		fallback.Note = "Live flight status is not configured; showing the timetable."
		return fallback
	}
	days := daysApart(f.today(), q.Date)
	if days < -1 || days > 1 {
		fallback.Note = "Live status opens a day before departure; showing the timetable."
		return fallback
	}
	key := q.Flight + "|" + q.Date
	if hit, ok := f.cache.get(key); ok {
		return hit
	}
	if !f.quota.take() {
		fallback.Note = "Live flight checks are resting for today (free quota); showing the timetable."
		return fallback
	}
	res, err := f.live.Status(ctx, q)
	switch {
	case err == nil:
		res.FetchedAt = time.Now().UTC()
		f.cache.put(key, res, 0)
		return res
	case errors.Is(err, ErrFlightNotFound):
		fallback.Note = "The live provider has no data for this flight yet; showing the timetable."
		f.cache.put(key, fallback, 0)
		return fallback
	default:
		f.mu.Lock()
		f.lastErr = err.Error()
		f.mu.Unlock()
		slog.Warn("live flight status failed; using the timetable", "flight", q.Flight, "err", err)
		fallback.Note = "Live flight status is unavailable right now; showing the timetable."
		f.cache.put(key, fallback, 15*time.Minute)
		return fallback
	}
}

func (f *Flights) Remaining() int { return f.quota.remaining() }

func daysApart(a, b string) int {
	ta, err1 := time.Parse("2006-01-02", a)
	tb, err2 := time.Parse("2006-01-02", b)
	if err1 != nil || err2 != nil {
		return 99
	}
	return int(tb.Sub(ta).Hours() / 24)
}
