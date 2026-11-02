package ops

import (
	"strings"
	"testing"

	"trizpyy/internal/aisvc"
	"trizpyy/internal/app"
	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/seed"
)

func testService(t *testing.T) *Service {
	t.Helper()
	data, err := seed.Catalog()
	if err != nil {
		t.Fatal(err)
	}
	return &Service{Core: &app.Core{Eng: engine.New(catalog.New(data), func() string { return "2026-10-01" })}}
}

func TestWhatIfQuestionsBecomeScenarios(t *testing.T) {
	s := testService(t)
	var cabs domain.Vendor
	for _, v := range s.Eng.Cat.Vendors {
		if v.ID == "v-coo-cabs" {
			cabs = v
		}
	}
	cases := []struct {
		q                string
		kind, dest, when string
		check            func(*engine.Scenario) bool
	}{
		{"What happens if heavy rain starts in Gokarna?", domain.IncWeather, "gokarna", "tomorrow", nil},
		{"what if it rains in Coorg today", domain.IncWeather, "coorg", "today", nil},
		{"What if Bengaluru flights land 4 hours late?", domain.IncFlightDelay, "bengaluru", "tomorrow", func(sc *engine.Scenario) bool { return sc.DelayMin != nil && *sc.DelayMin == 240 }},
		{"What if " + cabs.Name + " can't serve Coorg trips?", domain.IncVendorUnavailable, "coorg", "tomorrow", func(sc *engine.Scenario) bool { return sc.VendorID == cabs.ID }},
		{"What if Abbey Falls is closed in Coorg?", domain.IncClosure, "coorg", "tomorrow", func(sc *engine.Scenario) bool { return strings.EqualFold(sc.Place, "Abbey Falls") }},
	}
	for _, c := range cases {
		sc := s.scenarioFromQuestion(c.q)
		if sc == nil {
			t.Errorf("%q: no scenario", c.q)
			continue
		}
		if sc.Kind != c.kind || sc.DestinationID != c.dest || sc.When != c.when || sc.Title == "" || len(sc.Title) > 80 {
			t.Errorf("%q: got %+v", c.q, sc)
		}
		if c.check != nil && !c.check(sc) {
			t.Errorf("%q: details wrong: %+v", c.q, sc)
		}
	}
	for _, q := range []string{"Which trips are at risk?", "What if it rains?", "What if Karnataka is lovely?"} {
		if sc := s.scenarioFromQuestion(q); sc != nil {
			t.Errorf("%q should not simulate, got %+v", q, sc)
		}
	}
}

func TestRulesInsightAndCleaning(t *testing.T) {
	empty := RulesInsight(engine.WhatIfResult{})
	if empty.Recommendation.Action != "no_action" || empty.Engine != "rules" {
		t.Fatalf("empty result: %+v", empty)
	}
	trip := &domain.Trip{Code: "TRZ-1"}
	res := engine.WhatIfResult{
		Tours:  []engine.WhatIfTour{{Trip: trip, MoneyAtRisk: 5000, AutoFixable: true, Levels: engine.WhatIfLevels{CannotHappen: 2}}},
		Totals: engine.WhatIfTotals{Tours: 1, Travelers: 2, MoneyAtRisk: 5000, AutoFixable: 1, Levels: engine.WhatIfLevels{CannotHappen: 2}},
	}
	in := RulesInsight(res)
	if in.Recommendation.Action != "fix_all" || len(in.Priorities) != 1 || in.Priorities[0].TripCode != "TRZ-1" || len(in.Consequences) == 0 {
		t.Fatalf("rules insight: %+v", in)
	}
	// The agent may not invent trips or recommendations.
	got := cleanInsight(aisvc.WhatIfInsight{Headline: "h", Recommendation: aisvc.Recommendation{Action: "delete_everything"}, Confidence: 7,
		Priorities: []aisvc.Priority{{TripCode: "TRZ-404", Reason: "made up"}, {TripCode: "TRZ-1", Reason: "real"}}}, res)
	if got.Recommendation.Action != "fix_all" || len(got.Priorities) != 1 || got.Priorities[0].TripCode != "TRZ-1" || got.Confidence != 1 {
		t.Fatalf("clean insight: %+v", got)
	}
}

func TestAgentActionsAreConsoleLinksOnly(t *testing.T) {
	base := []aisvc.Action{{Kind: "open", Label: "Problem", Href: "/ops/incidents/inc1"}}
	got := mergeActions(base, []aisvc.Action{
		{Kind: "open", Label: "Tours", Href: "/ops/tours"},
		{Kind: "commit", Label: "Commit now", Href: "/ops/agent"},
		{Kind: "open", Label: "Evil", Href: "https://evil.example"},
		{Kind: "open", Label: "Proto", Href: "/ops//evil.example"},
		{Kind: "open", Label: "Dup", Href: "/ops/incidents/inc1"},
		{Kind: "simulate", Label: "", Href: "/ops/what-if"},
	})
	if len(got) != 2 || got[1].Href != "/ops/tours" {
		t.Fatalf("merged actions: %+v", got)
	}
}

func TestRulesAnswerUsesFacts(t *testing.T) {
	f := aisvc.OpsFacts{
		Trips:     []aisvc.TripFact{{Code: "TRZ-9", Group: "Sharma family", Status: "at_risk", Risk: 70, RiskReasons: []string{"Heavy rain"}}},
		Incidents: []aisvc.IncidentFact{{TripCode: "TRZ-9", Title: "Heavy rain forecast", Status: "open"}},
		Pending:   []aisvc.PendingFact{{Vendor: "Himalayan Cabs", TripCode: "TRZ-9", Item: "Pickup"}},
	}
	if a := rulesAnswer("Which trips are at risk?", f); !strings.Contains(a, "TRZ-9") || !strings.Contains(a, "Heavy rain") {
		t.Fatalf("at-risk answer: %q", a)
	}
	if a := rulesAnswer("Which vendors need confirmation?", f); !strings.Contains(a, "Himalayan Cabs") {
		t.Fatalf("vendor answer: %q", a)
	}
	f.Focus = &aisvc.FocusFact{Incident: aisvc.IncidentFact{Title: "Rain", TripCode: "TRZ-9", Day: 2, Status: "open"},
		Impact: []aisvc.ImpactFact{{Title: "Paragliding", Level: domain.LevelCannotHappen, Reason: "Outdoor activity · heavy rain"}},
		Plans:  []aisvc.PlanFact{{Strategy: domain.StrategyCheapest, Title: "Cheapest", CostDelta: -1200}, {Strategy: domain.StrategyFastest, Title: "Fastest", Recommended: true}}}
	if a := rulesAnswer("Why is paragliding marked cannot_happen?", f); !strings.Contains(a, "Paragliding") || !strings.Contains(a, "heavy rain") {
		t.Fatalf("explain answer: %q", a)
	}
	if a := rulesAnswer("Show me the cheapest fix", f); !strings.Contains(a, "Cheapest") {
		t.Fatalf("cheapest answer: %q", a)
	}
}
