package engine_test

import (
	"testing"
	"time"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/seed"
)

// Every destination in the catalog must plan, price and repair a trip for every stay type and transport mode.
func TestEveryDestinationPlans(t *testing.T) {
	data, err := seed.Catalog()
	if err != nil {
		t.Fatal(err)
	}
	eng := engine.New(catalog.New(data), func() string { return "2026-10-01" })
	for _, d := range data.Destinations {
		for _, stay := range []string{"hostel", "budget", "homestay", "boutique", "luxury"} {
			for _, mode := range []string{"flight", "train", "bus", "car"} {
				p := domain.TripPreferences{DestinationID: d.ID, StartDate: "2026-10-12", Nights: 3, Adults: 2, BudgetPerPerson: 30000,
					StayType: stay, Transport: mode, Interests: d.Interests[:2], Pace: "balanced", Rhythm: "early-bird", FromCity: d.FromCity}
				trip, err := eng.BuildTrip(p, engine.BuildOptions{ID: "t", Code: "TRZ-T", CustomerID: "c", CustomerName: "Test Traveler", Now: time.Now()})
				if err != nil {
					t.Fatalf("%s/%s/%s: %v", d.ID, stay, mode, err)
				}
				acts := 0
				for _, it := range trip.Items {
					if it.Kind == "activity" {
						acts++
					}
				}
				if acts < 2 {
					t.Errorf("%s/%s/%s: only %d experiences planned", d.ID, stay, mode, acts)
				}
				if eng.PriceTrip(trip).Total <= 0 {
					t.Errorf("%s: zero price", d.ID)
				}
				inc := &domain.Incident{ID: "i", TripID: trip.ID, Kind: domain.IncWeather, Day: 2, Severity: 3, Status: domain.IncOpen}
				if plans := eng.MakeFixPlans(trip, inc, eng.AnalyzeImpact(trip, inc)); len(plans) != 3 {
					t.Errorf("%s: %d fix plans", d.ID, len(plans))
				}
			}
		}
	}
}
