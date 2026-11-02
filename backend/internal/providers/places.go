package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	SourceGooglePlaces = "google-places"
	SourceCatalog      = "catalog"
)

// Place is a normalized point of interest.
type Place struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Rating   float64 `json:"rating,omitempty"`
	Reviews  int     `json:"reviews,omitempty"`
	Type     string  `json:"type,omitempty"`
	OpenNow  *bool   `json:"openNow,omitempty"`
	MapsURL  string  `json:"mapsUrl,omitempty"`
	Distance float64 `json:"distanceKm,omitempty"`
}

type PlaceQuery struct {
	Text     string
	Center   LatLng
	RadiusM  int
	MaxCount int
}

// Places searches Google Places (API New, Text Search). The key never leaves the server.
type Places struct {
	base, key string
	client    *http.Client
	cache     *cache[[]Place]
	hubCache  *cache[[]TransportHub]
	revCache  *cache[*ReverseResult]
}

func NewPlaces(base, key string, timeout time.Duration) *Places {
	return &Places{base: strings.TrimRight(base, "/"), key: key, client: &http.Client{Timeout: timeout}, cache: newCache[[]Place](24*time.Hour, 1000),
		hubCache: newCache[[]TransportHub](7*24*time.Hour, 2000), revCache: newCache[*ReverseResult](7*24*time.Hour, 2000)}
}

func (p *Places) Enabled() bool { return p != nil && p.key != "" }

const placesFieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.rating," +
	"places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri,places.currentOpeningHours.openNow"

type gPlace struct {
	ID          string `json:"id"`
	DisplayName struct {
		Text string `json:"text"`
	} `json:"displayName"`
	FormattedAddress string `json:"formattedAddress"`
	Location         struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
	Rating                 float64 `json:"rating"`
	UserRatingCount        int     `json:"userRatingCount"`
	PrimaryTypeDisplayName struct {
		Text string `json:"text"`
	} `json:"primaryTypeDisplayName"`
	GoogleMapsURI       string `json:"googleMapsUri"`
	CurrentOpeningHours *struct {
		OpenNow bool `json:"openNow"`
	} `json:"currentOpeningHours"`
}

// Search returns places for the query near the center. Results are cached for a day.
func (p *Places) Search(ctx context.Context, q PlaceQuery) ([]Place, error) {
	if !p.Enabled() {
		return nil, ErrUnavailable
	}
	if q.MaxCount <= 0 || q.MaxCount > 20 {
		q.MaxCount = 8
	}
	if q.RadiusM <= 0 {
		q.RadiusM = 20000
	}
	key := fmt.Sprintf("%s|%.3f,%.3f|%d|%d", strings.ToLower(q.Text), q.Center.Lat, q.Center.Lng, q.RadiusM, q.MaxCount)
	if hit, ok := p.cache.get(key); ok {
		return hit, nil
	}
	body, _ := json.Marshal(map[string]any{
		"textQuery": q.Text, "maxResultCount": q.MaxCount, "languageCode": "en", "regionCode": "IN",
		"locationBias": map[string]any{"circle": map[string]any{
			"center": map[string]float64{"latitude": q.Center.Lat, "longitude": q.Center.Lng}, "radius": float64(q.RadiusM)}},
	})
	var res struct {
		Places []gPlace `json:"places"`
	}
	err := doJSON(ctx, p.client, func(ctx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.base+"/places:searchText", bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Goog-Api-Key", p.key)
		req.Header.Set("X-Goog-FieldMask", placesFieldMask)
		return req, nil
	}, &res)
	if err != nil {
		return nil, err
	}
	out := make([]Place, 0, len(res.Places))
	for _, g := range res.Places {
		if g.DisplayName.Text == "" {
			continue
		}
		pl := Place{ID: g.ID, Name: g.DisplayName.Text, Address: g.FormattedAddress, Lat: g.Location.Latitude, Lng: g.Location.Longitude,
			Rating: g.Rating, Reviews: g.UserRatingCount, Type: g.PrimaryTypeDisplayName.Text, MapsURL: g.GoogleMapsURI}
		if g.CurrentOpeningHours != nil {
			open := g.CurrentOpeningHours.OpenNow
			pl.OpenNow = &open
		}
		out = append(out, pl)
	}
	p.cache.put(key, out, 0)
	return out, nil
}

// PlacePrediction is an autocomplete prediction from Google Places API.
type PlacePrediction struct {
	ID          string `json:"id"`
	PlaceID     string `json:"placeId"`
	Description string `json:"description"`
	Name        string `json:"name"`
	MainText    string `json:"mainText"`
	Secondary   string `json:"secondaryText"`
}

type gAutocompleteResp struct {
	Suggestions []struct {
		PlacePrediction struct {
			Place   string `json:"place"`
			PlaceID string `json:"placeId"`
			Text    struct {
				Text string `json:"text"`
			} `json:"text"`
			StructuredFormat struct {
				MainText struct {
					Text string `json:"text"`
				} `json:"mainText"`
				SecondaryText struct {
					Text string `json:"text"`
				} `json:"secondaryText"`
			} `json:"structuredFormat"`
		} `json:"placePrediction"`
	} `json:"suggestions"`
}

// Autocomplete queries Google Places API New autocomplete endpoint for destinations and cities.
func (p *Places) Autocomplete(ctx context.Context, input string) ([]PlacePrediction, error) {
	if !p.Enabled() || strings.TrimSpace(input) == "" {
		return nil, ErrUnavailable
	}
	body, _ := json.Marshal(map[string]any{
		"input":               input,
		"includedRegionCodes": []string{"IN"},
	})
	var res gAutocompleteResp
	err := doJSON(ctx, p.client, func(ctx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.base+"/places:autocomplete", bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Goog-Api-Key", p.key)
		return req, nil
	}, &res)
	if err != nil {
		return nil, err
	}
	out := make([]PlacePrediction, 0, len(res.Suggestions))
	for _, s := range res.Suggestions {
		pred := s.PlacePrediction
		desc := pred.Text.Text
		name := pred.StructuredFormat.MainText.Text
		if name == "" {
			name = strings.Split(desc, ",")[0]
		}
		id := pred.PlaceID
		if id == "" {
			id = pred.Place
		}
		out = append(out, PlacePrediction{
			ID:          id,
			PlaceID:     id,
			Description: desc,
			Name:        name,
			MainText:    name,
			Secondary:   pred.StructuredFormat.SecondaryText.Text,
		})
	}
	return out, nil
}

type PlaceDetailsResult struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	FormattedAddress string  `json:"formattedAddress"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
	City             string  `json:"city,omitempty"`
	State            string  `json:"state,omitempty"`
	Country          string  `json:"country,omitempty"`
}

type gPlaceDetailsResp struct {
	ID               string `json:"id"`
	FormattedAddress string `json:"formattedAddress"`
	DisplayName      struct {
		Text string `json:"text"`
	} `json:"displayName"`
	Location struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
	AddressComponents []struct {
		LongText  string   `json:"longText"`
		ShortText string   `json:"shortText"`
		Types     []string `json:"types"`
	} `json:"addressComponents"`
}

// Details queries Google Places API New for place details (lat, lng, address components).
func (p *Places) Details(ctx context.Context, placeID string) (*PlaceDetailsResult, error) {
	if !p.Enabled() || strings.TrimSpace(placeID) == "" {
		return nil, ErrUnavailable
	}
	// Google Places API (New): GET https://places.googleapis.com/v1/places/{placeId}
	cleanID := strings.TrimPrefix(placeID, "places/")
	url := fmt.Sprintf("%s/places/%s?languageCode=en", p.base, cleanID)

	var res gPlaceDetailsResp
	err := doJSON(ctx, p.client, func(ctx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("X-Goog-Api-Key", p.key)
		req.Header.Set("X-Goog-FieldMask", "id,displayName,formattedAddress,location,addressComponents")
		return req, nil
	}, &res)
	if err != nil {
		return nil, err
	}

	out := &PlaceDetailsResult{
		ID:               res.ID,
		Name:             res.DisplayName.Text,
		FormattedAddress: res.FormattedAddress,
		Lat:              res.Location.Latitude,
		Lng:              res.Location.Longitude,
	}
	if out.Name == "" {
		out.Name = strings.Split(res.FormattedAddress, ",")[0]
	}

	for _, comp := range res.AddressComponents {
		for _, t := range comp.Types {
			switch t {
			case "locality", "sublocality_level_1", "administrative_area_level_2":
				if out.City == "" {
					out.City = comp.LongText
				}
			case "administrative_area_level_1":
				out.State = comp.LongText
			case "country":
				out.Country = comp.LongText
			}
		}
	}
	return out, nil
}
