package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
)

// Transport hubs and reverse geocoding use Places API (New) Nearby Search, whose quota is
// separate from Text Search. Nothing here is hardcoded: every hub and locality is what Google
// (or OpenStreetMap for reverse geocoding) returns for the exact coordinates given.

// TransportHub is a real airport, railway station or bus stand near a point.
type TransportHub struct {
	Type       string  `json:"type"` // "airport", "railway", "bus"
	PlaceID    string  `json:"placeId"`
	Name       string  `json:"name"`
	DistanceKm float64 `json:"distanceKm"`
	Address    string  `json:"address,omitempty"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	Reviews    int     `json:"reviews,omitempty"`
	MapsURL    string  `json:"mapsUrl,omitempty"`
	Source     string  `json:"source"`
}

// ReverseResult is where a coordinate actually is. It never substitutes another place.
type ReverseResult struct {
	PlaceID          string  `json:"placeId,omitempty"`
	City             string  `json:"city"`
	State            string  `json:"state,omitempty"`
	Country          string  `json:"country,omitempty"`
	FormattedAddress string  `json:"formattedAddress,omitempty"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
	Source           string  `json:"source"`
}

type nearbyReq struct {
	IncludedTypes []string
	Rank          string
	Lat, Lng      float64
	RadiusM       float64
	Max           int
}

type gNearbyPlace struct {
	gPlace
	PrimaryType       string `json:"primaryType"`
	AddressComponents []struct {
		LongText string   `json:"longText"`
		Types    []string `json:"types"`
	} `json:"addressComponents"`
}

func (p *Places) nearbyRaw(ctx context.Context, q nearbyReq) ([]gNearbyPlace, error) {
	if !p.Enabled() {
		return nil, ErrUnavailable
	}
	body, _ := json.Marshal(map[string]any{
		"includedTypes": q.IncludedTypes, "maxResultCount": q.Max, "rankPreference": q.Rank, "languageCode": "en", "regionCode": "IN",
		"locationRestriction": map[string]any{"circle": map[string]any{
			"center": map[string]float64{"latitude": q.Lat, "longitude": q.Lng}, "radius": q.RadiusM}},
	})
	var res struct {
		Places []gNearbyPlace `json:"places"`
	}
	err := doJSON(ctx, p.client, func(ctx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.base+"/places:searchNearby", bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Goog-Api-Key", p.key)
		req.Header.Set("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.location,"+
			"places.userRatingCount,places.primaryType,places.googleMapsUri,places.addressComponents")
		return req, nil
	}, &res)
	return res.Places, err
}

// hubSpecs: which Google types count as each hub, and noise filters (heliports, cargo gates,
// bus stops named after railway stations). minRevs drops unlabelled/irrelevant pins.
var hubSpecs = map[string]struct {
	types   []string
	minRevs int
	accept  func(g gNearbyPlace) bool
}{
	"airport": {types: []string{"airport", "international_airport"}, minRevs: 50, accept: func(g gNearbyPlace) bool {
		n := strings.ToLower(g.DisplayName.Text)
		return (g.PrimaryType == "airport" || g.PrimaryType == "international_airport") &&
			!strings.Contains(n, "cargo") && !strings.Contains(n, "helipad") && !strings.Contains(n, "departure point")
	}},
	"railway": {types: []string{"train_station"}, minRevs: 20, accept: func(g gNearbyPlace) bool {
		return g.PrimaryType == "train_station"
	}},
	"bus": {types: []string{"bus_station"}, minRevs: 20, accept: func(g gNearbyPlace) bool {
		return g.PrimaryType == "bus_station" && !strings.Contains(strings.ToLower(g.DisplayName.Text), "railway")
	}},
}

func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Sin(dLng/2)*math.Sin(dLng/2)*math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)
	return r * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// NearbyHubs finds real hubs of one type ("airport", "railway", "bus") around a point, most
// relevant first. It searches 50 km around the point, then a ring of four 50 km circles ~80 km
// out when nothing is close (Manali has no airport within 50 km of town). Cached for a week.
// An error means Google could not be asked; an empty list means Google found none.
func (p *Places) NearbyHubs(ctx context.Context, kind string, lat, lng float64, max int) ([]TransportHub, error) {
	spec, ok := hubSpecs[kind]
	if !ok {
		return nil, fmt.Errorf("unknown hub type %q", kind)
	}
	if !p.Enabled() {
		return nil, ErrUnavailable
	}
	key := fmt.Sprintf("hub|%s|%.3f,%.3f", kind, lat, lng)
	if hit, ok := p.hubCache.get(key); ok {
		return trimHubs(hit, max), nil
	}
	collect := func(centers [][2]float64) ([]TransportHub, error) {
		seen := map[string]bool{}
		out := []TransportHub{}
		var firstErr error
		for _, c := range centers {
			list, err := p.nearbyRaw(ctx, nearbyReq{IncludedTypes: spec.types, Rank: "POPULARITY", Lat: c[0], Lng: c[1], RadiusM: 50000, Max: 10})
			if err != nil {
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			for _, g := range list {
				if seen[g.ID] || !spec.accept(g) || g.UserRatingCount < spec.minRevs {
					continue
				}
				seen[g.ID] = true
				out = append(out, TransportHub{Type: kind, PlaceID: g.ID, Name: g.DisplayName.Text, Address: g.FormattedAddress,
					Lat: g.Location.Latitude, Lng: g.Location.Longitude, Reviews: g.UserRatingCount, MapsURL: g.GoogleMapsURI,
					DistanceKm: math.Round(haversineKm(lat, lng, g.Location.Latitude, g.Location.Longitude)*10) / 10, Source: SourceGooglePlaces})
			}
		}
		if len(out) == 0 && firstErr != nil {
			return nil, firstErr
		}
		return out, nil
	}
	out, err := collect([][2]float64{{lat, lng}})
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		const d = 0.72 // ~80 km of latitude
		dl := d / math.Max(0.2, math.Cos(lat*math.Pi/180))
		if out, err = collect([][2]float64{{lat + d, lng}, {lat - d, lng}, {lat, lng + dl}, {lat, lng - dl}}); err != nil {
			return nil, err
		}
	}
	// Busy and near wins; airports weigh traffic more (a big airport 40 km away beats an airstrip).
	per := 25.0
	if kind == "airport" {
		per = 60
	}
	score := func(h TransportHub) float64 { return math.Log1p(float64(h.Reviews)) - h.DistanceKm/per }
	sort.SliceStable(out, func(i, j int) bool { return score(out[i]) > score(out[j]) })
	p.hubCache.put(key, out, 0)
	return trimHubs(out, max), nil
}

func trimHubs(list []TransportHub, max int) []TransportHub {
	if max > 0 && len(list) > max {
		return list[:max]
	}
	return list
}

type nominatimResp struct {
	DisplayName string `json:"display_name"`
	Address     struct {
		Suburb   string `json:"suburb"`
		City     string `json:"city"`
		Town     string `json:"town"`
		Village  string `json:"village"`
		County   string `json:"county"`
		District string `json:"state_district"`
		State    string `json:"state"`
		Country  string `json:"country"`
	} `json:"address"`
}

// ReverseGeocode resolves a coordinate to its locality: the nearest Google locality first,
// then OpenStreetMap Nominatim. Both look up the given point; on failure it returns an error
// and the caller shows the coordinates instead of a guess.
func (p *Places) ReverseGeocode(ctx context.Context, lat, lng float64) (*ReverseResult, error) {
	key := fmt.Sprintf("rev|%.3f,%.3f", lat, lng)
	if hit, ok := p.revCache.get(key); ok {
		return hit, nil
	}
	if p.Enabled() {
		for _, radius := range []float64{15000, 50000} {
			list, err := p.nearbyRaw(ctx, nearbyReq{IncludedTypes: []string{"locality"}, Rank: "DISTANCE", Lat: lat, Lng: lng, RadiusM: radius, Max: 1})
			if err != nil {
				break
			}
			if len(list) == 0 {
				continue
			}
			g := list[0]
			out := &ReverseResult{PlaceID: g.ID, City: g.DisplayName.Text, FormattedAddress: g.FormattedAddress, Lat: lat, Lng: lng, Source: SourceGooglePlaces}
			for _, c := range g.AddressComponents {
				for _, t := range c.Types {
					switch t {
					case "administrative_area_level_1":
						out.State = c.LongText
					case "country":
						out.Country = c.LongText
					}
				}
			}
			p.revCache.put(key, out, 0)
			return out, nil
		}
	}
	url := fmt.Sprintf("https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=%f&lon=%f", lat, lng)
	var res nominatimResp
	err := doJSON(ctx, p.client, func(ctx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Trizpyy-Travel-Platform/1.0")
		return req, nil
	}, &res)
	if err != nil {
		return nil, err
	}
	city := ""
	for _, c := range []string{res.Address.City, res.Address.Town, res.Address.Village, res.Address.Suburb, res.Address.County, res.Address.District} {
		if c != "" {
			city = c
			break
		}
	}
	if city == "" {
		return nil, ErrUnavailable
	}
	out := &ReverseResult{City: city, State: res.Address.State, Country: res.Address.Country, FormattedAddress: res.DisplayName,
		Lat: lat, Lng: lng, Source: "openstreetmap"}
	p.revCache.put(key, out, 0)
	return out, nil
}
