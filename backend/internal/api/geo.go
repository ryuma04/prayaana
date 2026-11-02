package api

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/providers"
)

// Geo holds the outside data providers (weather, routes, flights, places).
type Geo struct {
	Weather *providers.Weather
	Router  *providers.Router
	Flights *providers.Flights
	Places  *providers.Places
}

type datedForecast struct {
	Date string `json:"date"`
	domain.DayForecast
}

type weatherView struct {
	providers.WeatherStatus
	Attribution  string                     `json:"attribution"`
	Destinations map[string][]datedForecast `json:"destinations"`
}

const meteoAttribution = "Weather data by Open-Meteo.com (CC BY 4.0)"

// GET /weather — 16-day forecast for destinations or specific coordinates.
func (a *API) weather(w http.ResponseWriter, r *http.Request) {
	days := httpx.QueryInt(r, "days", 16, 1, 16)
	today := a.Core.Today()

	// If coordinates are provided, return live forecast for those coordinates.
	if latStr, lngStr := r.URL.Query().Get("lat"), r.URL.Query().Get("lng"); latStr != "" && lngStr != "" {
		if lat, err1 := strconv.ParseFloat(latStr, 64); err1 == nil {
			if lng, err2 := strconv.ParseFloat(lngStr, 64); err2 == nil {
				ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
				defer cancel()
				if live, err := a.Geo.Weather.LookupCoords(ctx, lat, lng, days); err == nil && len(live) > 0 {
					var list []datedForecast
					for i := 0; i < days; i++ {
						iso := engine.AddDays(today, i)
						if f, ok := live[iso]; ok {
							list = append(list, datedForecast{Date: iso, DayForecast: f})
						}
					}
					httpx.OK(w, map[string]any{
						"source":      providers.SourceOpenMeteo,
						"attribution": meteoAttribution,
						"forecast":    list,
					})
					return
				}
			}
		}
	}

	out := weatherView{WeatherStatus: a.Geo.Weather.Status(), Attribution: meteoAttribution, Destinations: map[string][]datedForecast{}}
	for _, d := range a.Core.Eng.Cat.Destinations {
		list := make([]datedForecast, days)
		for i := range list {
			iso := engine.AddDays(today, i)
			list[i] = datedForecast{Date: iso, DayForecast: a.Core.Eng.Forecast(d.ID, iso)}
		}
		out.Destinations[d.ID] = list
	}
	httpx.OK(w, out)
}

type routeView struct {
	providers.Route
	Day   int      `json:"day"`
	Stops []string `json:"stops"`
}

// GET /trips/{id}/route?day=N — the real road route through that day's stops (OSRM).
func (a *API) tripRoute(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), tripID(r))
	if err != nil {
		fail(w, r, err)
		return
	}
	t := v.Trip
	day := httpx.QueryInt(r, "day", 1, 1, t.Prefs.Days())
	items := make([]domain.TripItem, 0, len(t.Items))
	for _, it := range t.Items {
		if it.Day == day && it.Status != domain.ItemCancelled && it.HasPoint() {
			items = append(items, it)
		}
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].StartMin < items[j].StartMin })
	pts := make([]providers.LatLng, 0, len(items))
	stops := make([]string, 0, len(items))
	for _, it := range items {
		// Consecutive stops at the same spot add nothing to a route.
		if n := len(pts); n > 0 && math.Abs(pts[n-1].Lat-*it.Lat) < 1e-5 && math.Abs(pts[n-1].Lng-*it.Lng) < 1e-5 {
			continue
		}
		pts = append(pts, providers.LatLng{Lat: *it.Lat, Lng: *it.Lng})
		stops = append(stops, it.ID)
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	route := a.Geo.Router.Route(ctx, pts)
	httpx.OK(w, routeView{Route: route, Day: day, Stops: stops})
}

type flightLeg struct {
	ItemID string `json:"itemId"`
	Leg    string `json:"leg"` // outbound or return
	providers.FlightStatus
}

// GET /trips/{id}/flights — live status of the trip's flights (Aviationstack, cached).
func (a *API) tripFlights(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), tripID(r))
	if err != nil {
		fail(w, r, err)
		return
	}
	t := v.Trip
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	out := []flightLeg{}
	for _, it := range t.Items {
		if it.Kind != "flight" || it.Status == domain.ItemCancelled {
			continue
		}
		airline, code, from, to := providers.ParseFlightLabel(it.Title)
		if code == "" {
			continue
		}
		leg := "outbound"
		if strings.HasPrefix(it.Title, "Return") {
			leg = "return"
		}
		q := providers.FlightQuery{Flight: code, Airline: airline, Date: engine.AddDays(t.Prefs.StartDate, it.Day-1), From: from, To: to,
			Departs: fmt.Sprintf("%02d:%02d", it.StartMin/60%24, it.StartMin%60), DurationMin: it.DurationMin}
		out = append(out, flightLeg{ItemID: it.ID, Leg: leg, FlightStatus: a.Geo.Flights.Status(ctx, q)})
	}
	httpx.OK(w, map[string]any{"provider": a.Geo.Flights.Provider(), "flights": out})
}

var placeCategories = map[string]string{
	"food":    "restaurants",
	"cafe":    "cafes",
	"sights":  "tourist attractions",
	"medical": "hospitals and pharmacies",
	"atm":     "ATMs",
	"fuel":    "petrol pumps",
}

type placesView struct {
	Source string            `json:"source"`
	Query  string            `json:"query"`
	Places []providers.Place `json:"places"`
}

// GET /places?destination=&category=&q=&lat=&lng= — nearby places (Google Places, catalog fallback).
func (a *API) places(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	dest := a.Core.Eng.Cat.Destination(qs.Get("destination"))
	if dest == nil {
		fail(w, r, httpx.BadRequest("Pick a destination."))
		return
	}
	text := strings.TrimSpace(qs.Get("q"))
	if len(text) > 80 {
		text = text[:80]
	}
	cat := qs.Get("category")
	if text == "" {
		text = placeCategories[cat]
		if text == "" {
			text, cat = placeCategories["sights"], "sights"
		}
	}
	center, radius := providers.LatLng{Lat: dest.Lat, Lng: dest.Lng}, 25000
	if lat, err1 := strconv.ParseFloat(qs.Get("lat"), 64); err1 == nil {
		if lng, err2 := strconv.ParseFloat(qs.Get("lng"), 64); err2 == nil && math.Abs(lat) <= 90 && math.Abs(lng) <= 180 {
			center, radius = providers.LatLng{Lat: lat, Lng: lng}, 5000
		}
	}
	query := text + " in " + dest.Name + ", " + dest.State
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	list, err := a.Geo.Places.Search(ctx, providers.PlaceQuery{Text: query, Center: center, RadiusM: radius, MaxCount: 8})
	source := providers.SourceGooglePlaces
	if err != nil {
		list, source = a.catalogPlaces(dest.ID, text, cat), providers.SourceCatalog
	}
	for i := range list {
		list[i].Distance = math.Round(engine.HaversineKm(center.Lat, center.Lng, list[i].Lat, list[i].Lng)*10) / 10
	}
	httpx.OK(w, placesView{Source: source, Query: query, Places: list})
}

// catalogPlaces searches our own experiences and stays when Google Places is unavailable.
func (a *API) catalogPlaces(destID, text, category string) []providers.Place {
	words := strings.Fields(strings.ToLower(text))
	match := func(s string) bool {
		s = strings.ToLower(s)
		for _, w := range words {
			if len(w) > 3 && strings.Contains(s, strings.TrimSuffix(w, "s")) {
				return true
			}
		}
		return false
	}
	out := []providers.Place{}
	for _, act := range a.Core.Eng.Cat.ActivitiesFor(destID) {
		interests := strings.Join(act.Interests, " ")
		if category == "sights" || category == "" || match(act.Title+" "+act.Description) || category == "food" && strings.Contains(interests, "food") {
			out = append(out, providers.Place{ID: act.ID, Name: act.Title, Address: act.Cluster, Lat: act.Lat, Lng: act.Lng, Rating: act.Rating,
				Reviews: act.Reviews, Type: "Experience"})
		}
	}
	for _, s := range a.Core.Eng.Cat.StaysFor(destID) {
		if match(s.Name + " " + s.Type + " stay hotel") {
			out = append(out, providers.Place{ID: s.ID, Name: s.Name, Address: s.Area, Lat: s.Lat, Lng: s.Lng, Rating: s.Rating, Reviews: s.Reviews, Type: "Stay"})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Rating > out[j].Rating })
	if len(out) > 8 {
		out = out[:8]
	}
	return out
}

// GET /providers — which outside services are live (for the ops console and health checks).
func (a *API) providerStatus(w http.ResponseWriter, r *http.Request) {
	ws := a.Geo.Weather.Status()
	httpx.OK(w, map[string]any{
		"weather": ws,
		"routing": map[string]string{"source": map[bool]string{true: providers.SourceOSRM, false: providers.SourceEstimate}[a.Core.Cfg.LiveProviders]},
		"flights": map[string]any{"source": a.Geo.Flights.Provider(), "callsLeftToday": a.Geo.Flights.Remaining()},
		"places":  map[string]string{"source": map[bool]string{true: providers.SourceGooglePlaces, false: providers.SourceCatalog}[a.Geo.Places.Enabled()]},
		"maps":    map[string]string{"source": "openfreemap"},
	})
}

// GET /places/autocomplete?q= — autocomplete destinations and cities using Google Places API.
func (a *API) placesAutocomplete(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		q = strings.TrimSpace(r.URL.Query().Get("input"))
	}
	if len(q) < 2 {
		httpx.OK(w, map[string]any{"predictions": []providers.PlacePrediction{}})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	list, err := a.Geo.Places.Autocomplete(ctx, q)
	if err != nil || len(list) == 0 {
		// Fallback to searching catalog destinations
		qLower := strings.ToLower(q)
		var catalogPredictions []providers.PlacePrediction
		for _, d := range a.Core.Eng.Cat.Destinations {
			if strings.Contains(strings.ToLower(d.Name), qLower) || strings.Contains(strings.ToLower(d.State), qLower) {
				catalogPredictions = append(catalogPredictions, providers.PlacePrediction{
					ID:          d.ID,
					PlaceID:     d.ID,
					Description: fmt.Sprintf("%s, %s, India", d.Name, d.State),
					Name:        d.Name,
					MainText:    d.Name,
					Secondary:   fmt.Sprintf("%s, India", d.State),
				})
			}
		}
		httpx.OK(w, map[string]any{"predictions": catalogPredictions, "source": "catalog"})
		return
	}
	httpx.OK(w, map[string]any{"predictions": list, "source": "google-places"})
}

// GET /places/reverse?lat=&lng= — the real locality at a coordinate (Google Places, then OSM).
// It never substitutes a nearby catalog city: on failure the client shows the coordinates.
func (a *API) placesReverse(w http.ResponseWriter, r *http.Request) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, err2 := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	if err1 != nil || err2 != nil || math.Abs(lat) > 90 || math.Abs(lng) > 180 {
		fail(w, r, httpx.BadRequest("Valid lat and lng required."))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	res, err := a.Geo.Places.ReverseGeocode(ctx, lat, lng)
	if err != nil || res == nil {
		httpx.OK(w, map[string]any{"lat": lat, "lng": lng, "city": "", "resolved": false, "error": "Couldn't name this location."})
		return
	}
	httpx.OK(w, map[string]any{"lat": lat, "lng": lng, "city": res.City, "state": res.State, "country": res.Country,
		"placeId": res.PlaceID, "formattedAddress": res.FormattedAddress, "source": res.Source, "resolved": true})
}

// GET /places/details?id= — details of a place (Google Places API New, catalog fallback).
func (a *API) placesDetails(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		fail(w, r, httpx.BadRequest("id query parameter required."))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	res, err := a.Geo.Places.Details(ctx, id)
	if err != nil || res == nil {
		// Fallback to catalog destination if id matches
		cleanID := strings.ToLower(strings.TrimSpace(id))
		for _, d := range a.Core.Eng.Cat.Destinations {
			if strings.EqualFold(d.ID, cleanID) || strings.EqualFold(d.Name, cleanID) {
				httpx.OK(w, providers.PlaceDetailsResult{
					ID:               d.ID,
					Name:             d.Name,
					FormattedAddress: fmt.Sprintf("%s, %s, India", d.Name, d.State),
					Lat:              d.Lat,
					Lng:              d.Lng,
					City:             d.FromCity,
					State:            d.State,
					Country:          "India",
				})
				return
			}
		}
		fail(w, r, httpx.NotFound("Place details unavailable."))
		return
	}
	httpx.OK(w, res)
}

type hubSide struct {
	Lat   float64                  `json:"lat"`
	Lng   float64                  `json:"lng"`
	Hubs  []providers.TransportHub `json:"hubs"`
	Error string                   `json:"error,omitempty"`
}

// GET /transport/hubs?mode=flight|train|bus&fromLat=&fromLng=&toLat=&toLng=
// Real hubs (Google Places Nearby Search) near the origin and the destination for one mode.
// Legacy form ?lat=&lng= returns the nearest airport, railway and bus hub around one point.
func (a *API) transportHubs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	num := func(k string) (float64, bool) {
		v, err := strconv.ParseFloat(q.Get(k), 64)
		return v, err == nil && !math.IsNaN(v) && v != 0
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	side := func(kind string, lat, lng float64) hubSide {
		hs, err := a.Geo.Places.NearbyHubs(ctx, kind, lat, lng, 3)
		s := hubSide{Lat: lat, Lng: lng, Hubs: hs}
		if s.Hubs == nil {
			s.Hubs = []providers.TransportHub{}
		}
		if err != nil {
			s.Error = "Nearby transport locations unavailable."
		}
		return s
	}
	if mode := q.Get("mode"); mode != "" {
		kind := map[string]string{"flight": "airport", "train": "railway", "bus": "bus"}[mode]
		if kind == "" {
			fail(w, r, httpx.BadRequest("mode must be flight, train or bus."))
			return
		}
		fLat, ok1 := num("fromLat")
		fLng, ok2 := num("fromLng")
		tLat, ok3 := num("toLat")
		tLng, ok4 := num("toLng")
		if !(ok1 && ok2 && ok3 && ok4) {
			fail(w, r, httpx.BadRequest("Origin and destination coordinates required."))
			return
		}
		from, to := side(kind, fLat, fLng), side(kind, tLat, tLng)
		out := map[string]any{"mode": mode, "type": kind, "origin": from, "destination": to, "source": providers.SourceGooglePlaces,
			"straightLineKm": math.Round(engine.HaversineKm(fLat, fLng, tLat, tLng))}
		if len(from.Hubs) > 0 && len(to.Hubs) > 0 {
			out["hubDistanceKm"] = math.Round(engine.HaversineKm(from.Hubs[0].Lat, from.Hubs[0].Lng, to.Hubs[0].Lat, to.Hubs[0].Lng))
		}
		httpx.OK(w, out)
		return
	}
	lat, ok1 := num("lat")
	lng, ok2 := num("lng")
	if !ok1 || !ok2 {
		fail(w, r, httpx.BadRequest("lat and lng required."))
		return
	}
	first := func(kind string) *providers.TransportHub {
		if s := side(kind, lat, lng); len(s.Hubs) > 0 {
			return &s.Hubs[0]
		}
		return nil
	}
	httpx.OK(w, map[string]any{"airport": first("airport"), "railway": first("railway"), "bus": first("bus")})
}
