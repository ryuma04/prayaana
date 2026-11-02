package providers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestWeatherRefreshParsesEveryLocation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("latitude"); got != "32.2432,15.4909" {
			t.Errorf("latitude = %q", got)
		}
		io.WriteString(w, `[
		  {"daily":{"time":["2026-09-26","2026-09-27"],"weather_code":[0,63],"temperature_2m_max":[21.6,18.2],"precipitation_probability_max":[5,88]}},
		  {"daily":{"time":["2026-09-26"],"weather_code":[95],"temperature_2m_max":[30.4],"precipitation_probability_max":[null]}}
		]`)
	}))
	defer srv.Close()
	w := NewWeather(srv.URL, "Asia/Kolkata", []Point{{"manali", 32.2432, 77.1892}, {"goa", 15.4909, 73.8278}}, time.Second)
	if err := w.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if f, ok := w.Lookup("manali", "2026-09-26"); !ok || f.Condition != "clear" || f.TempC != 22 || f.Source != SourceOpenMeteo {
		t.Fatalf("manali day 1 = %+v %v", f, ok)
	}
	if f, _ := w.Lookup("manali", "2026-09-27"); f.Condition != "rain" || f.RainChance != 88 {
		t.Fatalf("manali day 2 = %+v", f)
	}
	if f, _ := w.Lookup("goa", "2026-09-26"); f.Condition != "storm" {
		t.Fatalf("goa = %+v", f)
	}
	if _, ok := w.Lookup("goa", "2026-10-30"); ok {
		t.Fatal("dates beyond the forecast must fall back to the climate model")
	}
	if w.Status().Source != SourceOpenMeteo {
		t.Fatal("status should report open-meteo")
	}
}

func TestWeatherKeepsOldDataOnMalformedResponse(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			io.WriteString(w, `{"daily":{"time":["2026-09-26"],"weather_code":[2],"temperature_2m_max":[20],"precipitation_probability_max":[10]}}`)
			return
		}
		io.WriteString(w, `{"daily": "nope"`)
	}))
	defer srv.Close()
	w := NewWeather(srv.URL, "UTC", []Point{{"manali", 1, 2}}, time.Second)
	if err := w.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := w.Refresh(context.Background()); err == nil {
		t.Fatal("malformed JSON must be an error")
	}
	if f, ok := w.Lookup("manali", "2026-09-26"); !ok || f.Condition != "sunny" {
		t.Fatalf("previous forecast should survive a bad refresh, got %+v %v", f, ok)
	}
}

func TestConditionThresholds(t *testing.T) {
	cases := []struct {
		code, chance int
		want         string
	}{{51, 20, "cloudy"}, {53, 80, "rain"}, {61, 30, "cloudy"}, {81, 60, "rain"}, {73, 50, "snow"}, {3, 0, "cloudy"}, {1, 0, "sunny"}}
	for _, c := range cases {
		if got, _ := condition(c.code, c.chance); got != c.want {
			t.Errorf("condition(%d,%d) = %s, want %s", c.code, c.chance, got, c.want)
		}
	}
}

func TestRouterUsesOSRMAndCaches(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if !strings.Contains(r.URL.Path, "/route/v1/driving/77.18920,32.24320;77.20000,32.25000") {
			t.Errorf("path = %s", r.URL.Path)
		}
		io.WriteString(w, `{"code":"Ok","routes":[{"distance":4200,"duration":660,"geometry":{"coordinates":[[77.1892,32.2432],[77.19,32.24],[77.2,32.25]]},"legs":[{"distance":4200,"duration":660}]}]}`)
	}))
	defer srv.Close()
	r := NewRouter(srv.URL, time.Second)
	pts := []LatLng{{32.2432, 77.1892}, {32.25, 77.2}}
	got := r.Route(context.Background(), pts)
	if got.Source != SourceOSRM || got.DistanceKm != 4.2 || got.DurationMin != 11 || len(got.Geometry) != 3 || len(got.Legs) != 1 {
		t.Fatalf("route = %+v", got)
	}
	r.Route(context.Background(), pts)
	if calls.Load() != 1 {
		t.Fatalf("second call should hit the cache, calls = %d", calls.Load())
	}
}

func TestRouterFallsBackOnOutage(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()
	r := NewRouter(srv.URL, time.Second)
	got := r.Route(context.Background(), []LatLng{{32.2432, 77.1892}, {32.3, 77.25}})
	if got.Source != SourceEstimate || got.DurationMin <= 0 || len(got.Geometry) != 2 {
		t.Fatalf("fallback = %+v", got)
	}
	if calls.Load() != 3 {
		t.Fatalf("5xx should be retried twice, calls = %d", calls.Load())
	}
}

func TestRouterTimeoutFallsBack(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
	}))
	defer srv.Close()
	r := NewRouter(srv.URL, 50*time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if got := r.Route(ctx, []LatLng{{1, 1}, {1.1, 1.1}}); got.Source != SourceEstimate {
		t.Fatalf("timeout should fall back, got %s", got.Source)
	}
}

func TestParseFlightLabel(t *testing.T) {
	airline, code, from, to := ParseFlightLabel("IndiGo 6E-5392 · BOM → GOX")
	if airline != "IndiGo" || code != "6E5392" || from != "BOM" || to != "GOX" {
		t.Fatalf("got %q %q %q %q", airline, code, from, to)
	}
	if _, code, from, to := ParseFlightLabel("Return · Alliance Air 9I-821 · KUU → DEL"); code != "9I821" || from != "KUU" || to != "DEL" {
		t.Fatalf("return leg: %q %q %q", code, from, to)
	}
}

func TestAviationstackPicksDateAndRoute(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("flight_iata") != "6E5392" || r.URL.Query().Get("access_key") != "k" {
			t.Errorf("query = %s", r.URL.RawQuery)
		}
		json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{
			{"flight_date": "2026-09-26", "flight_status": "scheduled", "departure": map[string]any{"iata": "GOX"}, "arrival": map[string]any{"iata": "BOM"}},
			{"flight_date": "2026-09-26", "flight_status": "active", "airline": map[string]any{"name": "IndiGo"},
				"departure": map[string]any{"iata": "BOM", "airport": "Mumbai", "delay": 42, "scheduled": "2026-09-26T06:40:00+00:00", "estimated": "2026-09-26T07:22:00+00:00"},
				"arrival":   map[string]any{"iata": "GOX", "scheduled": "2026-09-26T07:55:00+00:00"}},
		}})
	}))
	defer srv.Close()
	a := NewAviationstack(srv.URL, "k", time.Second)
	got, err := a.Status(context.Background(), FlightQuery{Flight: "6E5392", Date: "2026-09-26", From: "BOM", To: "GOX"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "delayed" || got.DelayMin != 42 || got.Departure.Estimated != "2026-09-26T07:22" || !got.Live {
		t.Fatalf("status = %+v", got)
	}
}

func TestAviationstackErrorNeverLeaksKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"error":{"code":"usage_limit_reached","message":"Your monthly usage limit has been reached."}}`)
	}))
	defer srv.Close()
	_, err := NewAviationstack(srv.URL, "secret-key-123", time.Second).Status(context.Background(), FlightQuery{Flight: "AI1837"})
	if err == nil || strings.Contains(err.Error(), "secret-key-123") {
		t.Fatalf("err = %v", err)
	}
}

type countingFlights struct {
	calls atomic.Int32
	err   error
}

func (c *countingFlights) Name() string { return "fake" }
func (c *countingFlights) Status(_ context.Context, q FlightQuery) (FlightStatus, error) {
	c.calls.Add(1)
	return FlightStatus{Flight: q.Flight, Status: "landed", Source: "fake", Live: true}, c.err
}

func TestFlightsSpendQuotaOnlyNearDeparture(t *testing.T) {
	live := &countingFlights{}
	f := NewFlights(live, time.Hour, 2, func() string { return "2026-09-26" })
	far := f.Status(context.Background(), FlightQuery{Flight: "6E1", Date: "2026-10-10", Departs: "07:00", DurationMin: 60})
	if far.Source != SourceTimetable || far.Departure.Scheduled != "2026-10-10T07:00" || far.Arrival.Scheduled != "2026-10-10T08:00" {
		t.Fatalf("far flight = %+v", far)
	}
	near := f.Status(context.Background(), FlightQuery{Flight: "6E1", Date: "2026-09-26"})
	f.Status(context.Background(), FlightQuery{Flight: "6E1", Date: "2026-09-26"}) // cached
	if near.Status != "landed" || live.calls.Load() != 1 {
		t.Fatalf("near = %+v calls = %d", near, live.calls.Load())
	}
	f.Status(context.Background(), FlightQuery{Flight: "6E2", Date: "2026-09-26"})
	capped := f.Status(context.Background(), FlightQuery{Flight: "6E3", Date: "2026-09-26"})
	if live.calls.Load() != 2 || capped.Source != SourceTimetable {
		t.Fatalf("daily cap not enforced: calls = %d, source = %s", live.calls.Load(), capped.Source)
	}
}

func TestFlightsFallBackOnProviderError(t *testing.T) {
	live := &countingFlights{err: ErrUnavailable}
	f := NewFlights(live, time.Hour, 5, func() string { return "2026-09-26" })
	got := f.Status(context.Background(), FlightQuery{Flight: "6E1", Date: "2026-09-27"})
	if got.Source != SourceTimetable || got.Note == "" {
		t.Fatalf("fallback = %+v", got)
	}
}

func TestPlacesSendsKeyInHeaderOnly(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Goog-Api-Key") != "gk" || r.URL.RawQuery != "" || r.Header.Get("X-Goog-FieldMask") == "" {
			t.Errorf("bad request: key=%q query=%q", r.Header.Get("X-Goog-Api-Key"), r.URL.RawQuery)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["textQuery"] != "cafes in Manali" {
			t.Errorf("body = %v", body)
		}
		io.WriteString(w, `{"places":[{"id":"p1","displayName":{"text":"Café 1947"},"formattedAddress":"Old Manali","location":{"latitude":32.25,"longitude":77.18},"rating":4.5,"userRatingCount":1200,"currentOpeningHours":{"openNow":true}},{"id":"p2","displayName":{"text":""}}]}`)
	}))
	defer srv.Close()
	p := NewPlaces(srv.URL, "gk", time.Second)
	got, err := p.Search(context.Background(), PlaceQuery{Text: "cafes in Manali", Center: LatLng{32.24, 77.19}})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "Café 1947" || got[0].OpenNow == nil || !*got[0].OpenNow {
		t.Fatalf("places = %+v", got)
	}
	if _, err := NewPlaces(srv.URL, "", time.Second).Search(context.Background(), PlaceQuery{Text: "x"}); err == nil {
		t.Fatal("no key must report unavailable so the caller falls back")
	}
}

func TestDoJSONRetriesRateLimitThenSucceeds(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		io.WriteString(w, `{"ok":true}`)
	}))
	defer srv.Close()
	var out struct{ OK bool }
	err := doJSON(context.Background(), srv.Client(), func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	}, &out)
	if err != nil || !out.OK || calls.Load() != 2 {
		t.Fatalf("err=%v ok=%v calls=%d", err, out.OK, calls.Load())
	}
}

func TestCacheExpiresAndBounds(t *testing.T) {
	c := newCache[int](time.Minute, 2)
	now := time.Unix(0, 0)
	c.now = func() time.Time { return now }
	c.put("a", 1, 0)
	now = now.Add(time.Second)
	c.put("b", 2, 0)
	now = now.Add(time.Second)
	c.put("c", 3, 0)
	if _, ok := c.get("a"); ok {
		t.Fatal("oldest entry should be evicted")
	}
	now = now.Add(2 * time.Minute)
	if _, ok := c.get("c"); ok {
		t.Fatal("entry should expire")
	}
}
