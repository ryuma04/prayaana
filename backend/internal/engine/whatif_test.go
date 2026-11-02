package engine_test

import (
	"encoding/json"
	"testing"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
)

// The What-If breakdown must come from the same impact analysis and fix plans the Trip Fixer
// uses, and simulating must never change the real trip.
func TestWhatIfBreakdownMatchesImpactAndLeavesTripAlone(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	inc, _ := rainOn(t, trip)
	trip.WeatherOverrides[inc.Day] = "sunny"
	// "Tomorrow" is the rainy day of the trip.
	eng.Today = func() string { return engine.AddDays(trip.Prefs.StartDate, inc.Day-2) }
	before, _ := json.Marshal(trip)

	res := eng.WhatIf(*engine.FindScenario("rain-coorg"), []*domain.Trip{trip})

	after, _ := json.Marshal(trip)
	if string(before) != string(after) {
		t.Fatal("simulation changed the real trip")
	}
	if len(res.Tours) != 1 {
		t.Fatalf("want 1 affected tour, got %d", len(res.Tours))
	}
	tour := res.Tours[0]
	if tour.Day != inc.Day {
		t.Fatalf("simulated day %d, want %d", tour.Day, inc.Day)
	}
	sim := &domain.Incident{ID: "sim-" + trip.ID, TripID: trip.ID, Kind: domain.IncWeather, Day: tour.Day, Severity: 4}
	impact := eng.AnalyzeImpact(trip, sim)
	lv := tour.Levels
	if lv.Safe+lv.Moves+lv.AtRisk+lv.CannotHappen != len(impact.Items) || len(tour.Items) != len(impact.Items) {
		t.Fatalf("levels %+v don't cover the %d impact items", lv, len(impact.Items))
	}
	if lv.CannotHappen == 0 || tour.AffectedItems != lv.Moves+lv.AtRisk+lv.CannotHappen {
		t.Fatalf("heavy rain should cancel the outdoor plan: %+v, affected %d", lv, tour.AffectedItems)
	}
	if tour.MoneyAtRisk != impact.MoneyAtRisk || tour.MinutesLost != impact.MinutesLost {
		t.Fatalf("money/time %d/%d, impact says %d/%d", tour.MoneyAtRisk, tour.MinutesLost, impact.MoneyAtRisk, impact.MinutesLost)
	}
	var best domain.FixPlan
	for _, p := range eng.MakeFixPlans(trip, sim, impact) {
		if p.Recommended {
			best = p
		}
	}
	if tour.BestStrategy != best.Strategy || tour.FixCost != best.CostDelta || tour.FixTimeMin != best.TimeDeltaMin {
		t.Fatalf("best plan %s %d %d, want %s %d %d", tour.BestStrategy, tour.FixCost, tour.FixTimeMin, best.Strategy, best.CostDelta, best.TimeDeltaMin)
	}
	for _, it := range tour.Items {
		if it.Title == "" || it.Level == "" {
			t.Fatalf("impact item without title/level: %+v", it)
		}
	}
	if res.Totals.Levels != lv || res.Totals.FixCost != tour.FixCost || res.Totals.MinutesLost != tour.MinutesLost {
		t.Fatalf("totals %+v don't add up", res.Totals)
	}

	// Another destination is untouched.
	if other := eng.WhatIf(*engine.FindScenario("rain-gokarna"), []*domain.Trip{trip}); len(other.Tours) != 0 {
		t.Fatal("a Gokarna scenario affected a Coorg trip")
	}
}
