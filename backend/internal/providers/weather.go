package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"trizpyy/internal/domain"
)

const SourceOpenMeteo = "open-meteo"

// Point is a destination the weather job keeps a forecast for.
type Point struct {
	ID       string
	Lat, Lng float64
}

// Weather keeps a 16-day Open-Meteo forecast for every destination in memory.
// One request covers all destinations; it refreshes every 30 minutes (Open-Meteo
// allows 10,000 calls a day for non-commercial use, with attribution). Lookups are
// synchronous so the pure trip engine can read them without doing I/O.
type Weather struct {
	base     string
	timezone string
	points   []Point
	client   *http.Client

	mu      sync.RWMutex
	days    map[string]map[string]domain.DayForecast // destination -> ISO date -> forecast
	updated time.Time
	lastErr string
}

func NewWeather(base, timezone string, points []Point, timeout time.Duration) *Weather {
	return &Weather{base: strings.TrimRight(base, "/"), timezone: timezone, points: points,
		client: &http.Client{Timeout: timeout}, days: map[string]map[string]domain.DayForecast{}}
}

type meteoDaily struct {
	Time       []string   `json:"time"`
	Code       []*float64 `json:"weather_code"`
	TempMax    []*float64 `json:"temperature_2m_max"`
	RainChance []*float64 `json:"precipitation_probability_max"`
}

type meteoResult struct {
	Daily meteoDaily `json:"daily"`
}

// Refresh fetches the forecast for every destination in one call.
func (w *Weather) Refresh(ctx context.Context) error {
	if len(w.points) == 0 {
		return nil
	}
	lats := make([]string, len(w.points))
	lngs := make([]string, len(w.points))
	for i, p := range w.points {
		lats[i] = fmt.Sprintf("%.4f", p.Lat)
		lngs[i] = fmt.Sprintf("%.4f", p.Lng)
	}
	q := url.Values{}
	q.Set("latitude", strings.Join(lats, ","))
	q.Set("longitude", strings.Join(lngs, ","))
	q.Set("daily", "weather_code,temperature_2m_max,precipitation_probability_max")
	q.Set("timezone", w.timezone)
	q.Set("forecast_days", "16")
	endpoint := w.base + "/forecast?" + q.Encode()

	var raw json.RawMessage
	err := doJSON(ctx, w.client, func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	}, &raw)
	if err == nil {
		var results []meteoResult
		// Several coordinates return an array; a single one returns an object.
		if len(raw) > 0 && raw[0] == '[' {
			err = json.Unmarshal(raw, &results)
		} else {
			var one meteoResult
			err = json.Unmarshal(raw, &one)
			results = []meteoResult{one}
		}
		if err == nil && len(results) != len(w.points) {
			err = fmt.Errorf("expected %d locations, got %d", len(w.points), len(results))
		}
		if err == nil {
			next := make(map[string]map[string]domain.DayForecast, len(results))
			for i, r := range results {
				next[w.points[i].ID] = parseDaily(r.Daily)
			}
			w.mu.Lock()
			w.days, w.updated, w.lastErr = next, time.Now().UTC(), ""
			w.mu.Unlock()
			return nil
		}
	}
	w.mu.Lock()
	w.lastErr = err.Error()
	w.mu.Unlock()
	return err
}

func parseDaily(d meteoDaily) map[string]domain.DayForecast {
	out := make(map[string]domain.DayForecast, len(d.Time))
	for i, iso := range d.Time {
		code, temp, rain := at(d.Code, i), at(d.TempMax, i), at(d.RainChance, i)
		if code == nil || temp == nil {
			continue // a malformed day falls back to the climate model
		}
		chance := -1
		if rain != nil {
			chance = int(math.Round(*rain))
		}
		cond, chance := condition(int(*code), chance)
		out[iso] = domain.DayForecast{TempC: int(math.Round(*temp)), Condition: cond, RainChance: chance, Source: SourceOpenMeteo}
	}
	return out
}

func at(v []*float64, i int) *float64 {
	if i < len(v) {
		return v[i]
	}
	return nil
}

// condition maps a WMO weather code (and the day's rain probability) to our labels.
// Drizzle or a shower with a low probability is reported as cloudy, not rain.
func condition(code, chance int) (string, int) {
	known := chance >= 0
	if !known {
		chance = 0
	}
	switch {
	case code == 0:
		return "clear", chance
	case code <= 2:
		return "sunny", chance
	case code == 3 || code == 45 || code == 48:
		return "cloudy", chance
	case code >= 51 && code <= 57:
		if !known {
			chance = 40
		}
		if chance >= 70 {
			return "rain", chance
		}
		return "cloudy", chance
	case code >= 61 && code <= 67 || code >= 80 && code <= 82:
		if !known {
			chance = 75
		}
		if chance >= 50 {
			return "rain", chance
		}
		return "cloudy", chance
	case code >= 71 && code <= 77 || code == 85 || code == 86:
		return "snow", chance
	case code >= 95:
		if !known {
			chance = 80
		}
		if chance >= 40 {
			return "storm", chance
		}
		return "cloudy", chance
	}
	return "cloudy", chance
}

// Lookup returns the live forecast for a destination on a date, if Open-Meteo has one.
func (w *Weather) Lookup(destID, iso string) (domain.DayForecast, bool) {
	if w == nil {
		return domain.DayForecast{}, false
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	f, ok := w.days[destID][iso]
	return f, ok
}

// LookupCoords fetches or returns a cached live Open-Meteo forecast for specific coordinates.
func (w *Weather) LookupCoords(ctx context.Context, lat, lng float64, days int) (map[string]domain.DayForecast, error) {
	if w == nil {
		return nil, ErrUnavailable
	}
	key := fmt.Sprintf("%.4f,%.4f", lat, lng)
	w.mu.RLock()
	if cached, ok := w.days[key]; ok && len(cached) > 0 {
		w.mu.RUnlock()
		return cached, nil
	}
	w.mu.RUnlock()

	if days <= 0 || days > 16 {
		days = 16
	}
	q := url.Values{}
	q.Set("latitude", fmt.Sprintf("%.4f", lat))
	q.Set("longitude", fmt.Sprintf("%.4f", lng))
	q.Set("daily", "weather_code,temperature_2m_max,precipitation_probability_max")
	q.Set("timezone", w.timezone)
	q.Set("forecast_days", fmt.Sprintf("%d", days))
	endpoint := w.base + "/forecast?" + q.Encode()

	var one meteoResult
	err := doJSON(ctx, w.client, func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	}, &one)
	if err != nil {
		return nil, err
	}
	parsed := parseDaily(one.Daily)
	w.mu.Lock()
	w.days[key] = parsed
	w.mu.Unlock()
	return parsed, nil
}

type WeatherStatus struct {
	Source    string     `json:"source"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
	Error     string     `json:"error,omitempty"`
}

func (w *Weather) Status() WeatherStatus {
	if w == nil {
		return WeatherStatus{Source: "climate"}
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	st := WeatherStatus{Source: "climate", Error: w.lastErr}
	if !w.updated.IsZero() {
		u := w.updated
		st.Source, st.UpdatedAt = SourceOpenMeteo, &u
	}
	return st
}

// Run refreshes now and then on a timer; failures retry sooner. Stale data is
// dropped after 6 hours so the planner never trusts an old forecast.
func (w *Weather) Run(ctx context.Context, every time.Duration) {
	next := time.Duration(0)
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(next):
		}
		rctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		err := w.Refresh(rctx)
		cancel()
		next = every
		if err != nil {
			slog.Warn("open-meteo refresh failed; using the climate model", "err", err)
			next = min(every, 5*time.Minute)
			w.mu.Lock()
			if !w.updated.IsZero() && time.Since(w.updated) > 6*time.Hour {
				w.days, w.updated = map[string]map[string]domain.DayForecast{}, time.Time{}
			}
			w.mu.Unlock()
		}
	}
}
