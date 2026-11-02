package providers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"trizpyy/internal/engine"
)

const (
	SourceOSRM     = "osrm"
	SourceEstimate = "estimate"
)

type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type Leg struct {
	DistanceKm  float64 `json:"distanceKm"`
	DurationMin int     `json:"durationMin"`
}

// Route is a road route through the given points, in order.
type Route struct {
	Source      string       `json:"source"`
	DistanceKm  float64      `json:"distanceKm"`
	DurationMin int          `json:"durationMin"`
	Geometry    [][2]float64 `json:"geometry"` // [lng, lat] pairs, ready for GeoJSON/MapLibre
	Legs        []Leg        `json:"legs"`
}

// Router asks OSRM (the free public server by default) for driving routes and
// caches them for a day. When OSRM is down it returns a straight-line estimate.
type Router struct {
	base   string
	client *http.Client
	cache  *cache[Route]
}

func NewRouter(base string, timeout time.Duration) *Router {
	return &Router{base: strings.TrimRight(base, "/"), client: &http.Client{Timeout: timeout}, cache: newCache[Route](24*time.Hour, 2000)}
}

type osrmResponse struct {
	Code   string `json:"code"`
	Routes []struct {
		Distance float64 `json:"distance"`
		Duration float64 `json:"duration"`
		Geometry struct {
			Coordinates [][2]float64 `json:"coordinates"`
		} `json:"geometry"`
		Legs []struct {
			Distance float64 `json:"distance"`
			Duration float64 `json:"duration"`
		} `json:"legs"`
	} `json:"routes"`
}

// Route never fails: on any provider problem it returns an estimate (Source "estimate").
func (r *Router) Route(ctx context.Context, pts []LatLng) Route {
	if len(pts) < 2 {
		return Estimate(pts)
	}
	coords := make([]string, len(pts))
	for i, p := range pts {
		coords[i] = fmt.Sprintf("%.5f,%.5f", p.Lng, p.Lat)
	}
	key := strings.Join(coords, ";")
	if hit, ok := r.cache.get(key); ok {
		return hit
	}
	if r.base == "" {
		return Estimate(pts)
	}
	endpoint := r.base + "/route/v1/driving/" + key + "?overview=full&geometries=geojson&steps=false"
	var res osrmResponse
	err := doJSON(ctx, r.client, func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	}, &res)
	if err != nil || res.Code != "Ok" || len(res.Routes) == 0 || len(res.Routes[0].Geometry.Coordinates) < 2 {
		est := Estimate(pts)
		r.cache.put(key, est, 10*time.Minute) // try OSRM again soon
		return est
	}
	best := res.Routes[0]
	out := Route{Source: SourceOSRM, DistanceKm: round1(best.Distance / 1000), DurationMin: int(math.Round(best.Duration / 60)),
		Geometry: best.Geometry.Coordinates, Legs: make([]Leg, 0, len(best.Legs))}
	for _, l := range best.Legs {
		out.Legs = append(out.Legs, Leg{DistanceKm: round1(l.Distance / 1000), DurationMin: int(math.Round(l.Duration / 60))})
	}
	r.cache.put(key, out, 0)
	return out
}

// Estimate is the straight-line fallback using the engine's road-time rule.
func Estimate(pts []LatLng) Route {
	out := Route{Source: SourceEstimate, Geometry: make([][2]float64, 0, len(pts)), Legs: []Leg{}}
	for i, p := range pts {
		out.Geometry = append(out.Geometry, [2]float64{p.Lng, p.Lat})
		if i == 0 {
			continue
		}
		km := engine.HaversineKm(pts[i-1].Lat, pts[i-1].Lng, p.Lat, p.Lng)
		leg := Leg{DistanceKm: round1(km * 1.3), DurationMin: engine.RoadMinutes(km)}
		out.Legs = append(out.Legs, leg)
		out.DistanceKm = round1(out.DistanceKm + leg.DistanceKm)
		out.DurationMin += leg.DurationMin
	}
	return out
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }
