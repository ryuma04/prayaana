package learning_test

import (
	"testing"
	"time"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/learning"
	"trizpyy/internal/seed"
)

func setup(t *testing.T) (*engine.Engine, domain.TravelDNA) {
	t.Helper()
	data, err := seed.Catalog()
	if err != nil {
		t.Fatal(err)
	}
	eng := engine.New(catalog.New(data), func() string { return "2026-10-01" })
	dna := engine.DescribeDNA(domain.DNATraits{Adventure: 70, Nature: 60, Culture: 50, Food: 50, Luxury: 30, Social: 40}, "balanced", "early-bird")
	return eng, dna
}

func TestLearningUpdatesAreSignedBoundedAndCumulative(t *testing.T) {
	eng, dna := setup(t)
	trek := eng.Cat.Activity("man-jogini") // nature + adventure, strenuous
	food := eng.Cat.Activity("man-oldmanali-walk")
	orig := dna

	up, ch := learning.Apply(dna, learning.Event{Kind: "hearted"}, food)
	if up.Traits.Food <= dna.Traits.Food || len(ch) == 0 || ch[0].Reason == "" {
		t.Fatalf("positive behaviour didn't raise food: %+v", ch)
	}
	down, _ := learning.Apply(dna, learning.Event{Kind: "removed"}, trek)
	if down.Traits.Adventure >= dna.Traits.Adventure || down.Traits.Nature >= dna.Traits.Nature {
		t.Fatal("removing a trek didn't lower adventure and nature")
	}
	if dna != orig {
		t.Fatal("Apply modified its input")
	}

	// One strong event can't swing a dimension by more than MaxStep.
	strong, _ := learning.Apply(dna, learning.Event{Kind: "rated", Value: 1}, trek)
	if d := dna.Traits.Adventure - strong.Traits.Adventure; d <= 0 || d > learning.MaxStep {
		t.Fatalf("1-star moved adventure by %d", d)
	}

	// Repeated behaviour accumulates, and never leaves the bounds.
	cur := dna
	for i := 0; i < 60; i++ {
		cur, _ = learning.Apply(cur, learning.Event{Kind: "swap_chosen"}, food)
	}
	if cur.Traits.Food <= up.Traits.Food || cur.Traits.Food > learning.MaxTrait {
		t.Fatalf("repeated choices: food %d", cur.Traits.Food)
	}
	for i := 0; i < 60; i++ {
		cur, _ = learning.Apply(cur, learning.Event{Kind: "less", Dimension: "social"}, nil)
	}
	if cur.Traits.Social != learning.MinTrait {
		t.Fatalf("social should bottom out at %d, got %d", learning.MinTrait, cur.Traits.Social)
	}
}

func TestFeedbackChangesTheRightDimensions(t *testing.T) {
	eng, dna := setup(t)
	p := domain.TripPreferences{DestinationID: "manali", StartDate: "2026-10-12", Nights: 3, Adults: 2, BudgetPerPerson: 40000,
		StayType: "boutique", Transport: "bus", Interests: []string{"food", "culture"}, Pace: "balanced", Rhythm: "early-bird"}
	trip, err := eng.BuildTrip(p, engine.BuildOptions{ID: "t", Code: "T", CustomerName: "A B", Now: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	var act domain.TripItem
	for _, it := range trip.Items {
		if it.Kind == "activity" {
			act = it
			break
		}
	}
	fb := learning.Feedback{Loved: []string{act.ID, "not-in-trip"}, Pace: "too_fast", More: []string{"food", "bogus"}}.Clean(trip)
	if len(fb.Loved) != 1 || len(fb.More) != 1 {
		t.Fatalf("feedback not cleaned: %+v", fb)
	}
	cur := dna
	var all []learning.Change
	for _, ev := range learning.FeedbackEvents(trip, fb) {
		var ch []learning.Change
		cur, ch = learning.Apply(cur, ev, eng.Cat.Activity(ev.ActivityID))
		all = append(all, ch...)
	}
	if cur.Traits.Food <= dna.Traits.Food || cur.Pace != "relaxed" {
		t.Fatalf("feedback: food %d→%d, pace %s", dna.Traits.Food, cur.Traits.Food, cur.Pace)
	}
	for _, c := range all {
		if c.Reason == "" || c.Old == c.New {
			t.Fatalf("history entry without a reason or change: %+v", c)
		}
	}
}

// Recommendations follow the DNA as it learns.
func TestRecommendationsUseUpdatedDNA(t *testing.T) {
	eng, dna := setup(t)
	before := eng.Recommend("manali", dna, nil, nil, 3)
	cur := dna
	for i := 0; i < 40; i++ {
		cur, _ = learning.Apply(cur, learning.Event{Kind: "more", Dimension: "culture"}, nil)
		cur, _ = learning.Apply(cur, learning.Event{Kind: "less", Dimension: "adventure"}, nil)
	}
	after := eng.Recommend("manali", cur, nil, nil, 3)
	if before[0].Activity.ID == after[0].Activity.ID {
		t.Fatalf("top pick unchanged after the DNA moved to culture: %s", after[0].Activity.Title)
	}
	for _, r := range after {
		if r.Because == "" {
			t.Fatal("recommendation without an explanation")
		}
	}
}
