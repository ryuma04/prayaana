package engine_test

import (
	"strings"
	"testing"
	"time"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
)

func manaliTrip(t *testing.T, eng *engine.Engine) *domain.Trip {
	t.Helper()
	p := domain.TripPreferences{DestinationID: "manali", StartDate: "2026-10-12", Nights: 4, Adults: 2, BudgetPerPerson: 60000,
		StayType: "boutique", Transport: "bus", Interests: []string{"adventure", "nature"}, Pace: "balanced", Rhythm: "early-bird"}
	trip, err := eng.BuildTrip(p, engine.BuildOptions{ID: "t1", Code: "TRZ-T1", CustomerName: "Test Traveler", Status: domain.TripBooked, Now: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	trip.WeatherOverrides = map[int]string{}
	for d := 1; d <= trip.Prefs.Days(); d++ {
		trip.WeatherOverrides[d] = "sunny"
	}
	return trip
}

// rainOn returns a weather incident on the first middle day that has an outdoor experience.
func rainOn(t *testing.T, trip *domain.Trip) (*domain.Incident, domain.TripItem) {
	t.Helper()
	for d := 2; d < trip.Prefs.Days(); d++ {
		for _, it := range engine.DayItems(trip.Items, d) {
			if it.Kind == "activity" && it.Outdoor {
				trip.WeatherOverrides[d] = "rain"
				return &domain.Incident{ID: "inc1", TripID: trip.ID, Kind: domain.IncWeather, Day: d, Severity: 4, Title: "Heavy rain"}, it
			}
		}
	}
	t.Fatal("no outdoor experience on a middle day")
	return nil, domain.TripItem{}
}

func swaps(eng *engine.Engine, trip *domain.Trip, inc *domain.Incident, dna *domain.TravelDNA) engine.SwapReport {
	return eng.AdaptiveSwaps(trip, inc, eng.AnalyzeImpact(trip, inc), dna)
}

func TestDaySwapIsValidAndWeatherAware(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	inc, x := rainOn(t, trip)
	r := swaps(eng, trip, inc, nil)
	if len(r.Day) == 0 {
		t.Fatalf("no day swap for %q; rejected: %+v", x.Title, r.Rejected)
	}
	for _, c := range r.Day {
		after := eng.Simulate(trip, c.Plan.Actions)
		moved := after.Item(c.ForItemID)
		if moved.Day == inc.Day || moved.Status == domain.ItemCancelled {
			t.Errorf("%s: blocked item not moved off the rainy day", c.ID)
		}
		for _, it := range after.Items {
			if it.Kind == "activity" && it.Outdoor && engine.IsActive(it) && it.Day == inc.Day && it.Status == domain.ItemChanged {
				t.Errorf("%s: moved outdoor %q onto the rainy day", c.ID, it.Title)
			}
		}
		for _, h := range c.HardChecks {
			if !h.Passed {
				t.Errorf("%s: proposed with failed hard check %s", c.ID, h.ID)
			}
		}
	}

	// Every other day wet → no valid day swap, and the reason is recorded.
	for d := 1; d <= trip.Prefs.Days(); d++ {
		trip.WeatherOverrides[d] = "rain"
	}
	r = swaps(eng, trip, inc, nil)
	if len(r.Day) != 0 {
		t.Fatalf("day swap proposed although every day is rainy: %s", r.Day[0].ID)
	}
	if !rejectedFor(r, engine.SwapDay, "rain") {
		t.Error("weather rejection not recorded")
	}
}

func TestSwapHardConstraints(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	inc, x := rainOn(t, trip)

	// Vendor availability: the blocked item's partner pauses → it can't be re-dated.
	eng.Cat.SetAvailable(x.VendorID, false)
	r := swaps(eng, trip, inc, nil)
	eng.Cat.SetAvailable(x.VendorID, true)
	for _, c := range r.Day {
		if c.ForItemID == x.ID {
			t.Fatalf("day swap re-dates a paused vendor: %s", c.ID)
		}
	}
	if !rejectedFor(r, engine.SwapDay, "paused") {
		t.Error("paused-vendor rejection not recorded")
	}

	// Booking conflict: experiences already done on other days never move.
	done := trip.Clone()
	for i := range done.Items {
		if done.Items[i].Day != inc.Day && done.Items[i].Kind == "activity" {
			done.Items[i].Status = domain.ItemDone
		}
	}
	if r := swaps(eng, done, inc, nil); len(r.Day) != 0 {
		t.Fatalf("day swap moves a finished experience: %s", r.Day[0].ID)
	}
}

func TestRouteSwap(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	// Rain can't be dodged by re-ordering here (every other day has outdoor plans), so every
	// route option is rejected with a weather reason.
	inc, _ := rainOn(t, trip)
	if r := swaps(eng, trip, inc, nil); len(r.Route) != 0 || !rejectedFor(r, engine.SwapRoute, "rain") {
		t.Fatalf("route swap should be rejected for rain: %d proposed", len(r.Route))
	}
	delete(trip.WeatherOverrides, inc.Day)
	trip.WeatherOverrides[inc.Day] = "sunny"
	// Feeling unwell on the paragliding day: when another day is easy, it can come first.
	for i := range trip.Items {
		if trip.Items[i].Day != inc.Day {
			trip.Items[i].Energy = min(trip.Items[i].Energy, 2)
		}
	}
	inc = &domain.Incident{ID: "inc3", TripID: trip.ID, Kind: domain.IncHealth, Day: inc.Day, Severity: 3, Title: "Unwell"}
	r := swaps(eng, trip, inc, nil)
	if len(r.Route) == 0 {
		var why []string
		for _, x := range r.Rejected {
			if x.Type == engine.SwapRoute {
				why = append(why, x.Label+": "+strings.Join(x.Reasons, "; "))
			}
		}
		t.Fatalf("no route swap; route rejections: %v", why)
	}
	c := r.Route[0]
	if !c.RequiresAcceptance || c.Route == nil || c.Route.Hotel == "" || c.Comparison.Original == c.Comparison.Proposed {
		t.Fatalf("route swap missing acceptance/impact: %+v", c)
	}
	for _, a := range c.Plan.Actions {
		if it := trip.Item(a.ItemID); it != nil && (engine.IsTransport(*it) || it.Kind == "checkin" || it.Kind == "checkout") {
			t.Errorf("route swap moves a travel leg or hotel check-in/out: %s", it.Title)
		}
	}
	// Hotel dependency: the arrival day is tied to check-in and never re-ordered.
	trip.WeatherOverrides[1] = "rain"
	arrival := &domain.Incident{ID: "inc2", TripID: trip.ID, Kind: domain.IncWeather, Day: 1, Severity: 4, Title: "Heavy rain"}
	r = swaps(eng, trip, arrival, nil)
	if len(r.Route) != 0 || !strings.Contains(strings.Join(r.Notes, " "), "check-in") {
		t.Fatalf("arrival day re-ordered or no note: %+v", r.Notes)
	}
}

func TestActivitySwapUsesDNAWithoutChangingIt(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	inc, x := rainOn(t, trip)
	culture := &domain.TravelDNA{Traits: domain.DNATraits{Adventure: 20, Nature: 30, Culture: 95, Food: 40, Luxury: 30, Social: 20}}
	relax := &domain.TravelDNA{Traits: domain.DNATraits{Adventure: 20, Nature: 30, Culture: 20, Food: 40, Luxury: 95, Social: 20}}
	before := *culture

	top := func(dna *domain.TravelDNA) engine.SwapCandidate {
		r := swaps(eng, trip, inc, dna)
		if r.DNASource != "travel-dna" {
			t.Fatal("travel DNA not used")
		}
		var list []engine.SwapCandidate
		for _, c := range r.Activity {
			if c.ForItemID == x.ID {
				list = append(list, c)
			}
		}
		if len(list) == 0 {
			t.Fatalf("no activity swap for %q", x.Title)
		}
		for _, c := range list {
			alt := eng.Cat.Activity(c.Plan.Actions[0].ToRefID)
			if alt.Outdoor {
				t.Errorf("outdoor replacement %q proposed on a rainy day", alt.Title)
			}
			if c.Comparison.PriceDelta > 0 != c.NeedsApproval {
				t.Errorf("%s: extra cost %d but needsApproval=%v", c.ID, c.Comparison.PriceDelta, c.NeedsApproval)
			}
		}
		return list[0]
	}
	a, b := top(culture), top(relax)
	if a.Plan.Actions[0].ToRefID == b.Plan.Actions[0].ToRefID && a.Comparison.DNAMatchAfter == b.Comparison.DNAMatchAfter {
		t.Error("Travel DNA made no difference to the ranking")
	}
	if *culture != before {
		t.Error("adaptive swapping changed the Travel DNA")
	}
	if !rejectedFor(swaps(eng, trip, inc, culture), engine.SwapActivity, "rainy") {
		t.Error("outdoor replacements were not filtered with a reason")
	}
}

// Swaps are extra options: the three existing fix plans are unchanged and a swap plan runs
// through the existing safety checks and apply step.
func TestSwapsKeepTheTripFixerFlow(t *testing.T) {
	eng := loadEngine(t)
	trip := manaliTrip(t, eng)
	inc, _ := rainOn(t, trip)
	impact := eng.AnalyzeImpact(trip, inc)
	plans := eng.MakeFixPlans(trip, inc, impact)
	if len(plans) != 3 {
		t.Fatalf("%d fix plans", len(plans))
	}
	r := eng.AdaptiveSwaps(trip, inc, impact, nil)
	c := r.Day[0]
	if r.Find(c.ID) == nil || len(eng.SafetyChecks(trip, c.Plan)) != 10 {
		t.Fatal("swap plan not usable by the existing flow")
	}
	after := eng.Simulate(trip, c.Plan.Actions)
	if after == trip || trip.Item(c.ForItemID).Day != inc.Day {
		t.Fatal("simulate mutated the original trip")
	}
}

func rejectedFor(r engine.SwapReport, kind, word string) bool {
	for _, x := range r.Rejected {
		if x.Type == kind && strings.Contains(strings.ToLower(strings.Join(x.Reasons, " ")), word) {
			return true
		}
	}
	return false
}
