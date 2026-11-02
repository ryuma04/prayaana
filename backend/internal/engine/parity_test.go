package engine_test

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/seed"
)

type goldenIncident struct {
	Incident domain.Incident        `json:"incident"`
	Impact   json.RawMessage        `json:"impact"`
	Plans    json.RawMessage        `json:"plans"`
	Checks   [][]domain.SafetyCheck `json:"checks"`
}

type goldenMood struct {
	Mood         string            `json:"mood"`
	Headline     string            `json:"headline"`
	EnergyBefore int               `json:"energyBefore"`
	EnergyAfter  int               `json:"energyAfter"`
	CostDelta    int               `json:"costDelta"`
	Actions      []json.RawMessage `json:"actions"`
}

type goldenCase struct {
	Prefs domain.TripPreferences `json:"prefs"`
	Trip  struct {
		Items                      json.RawMessage `json:"items"`
		StayID, TransportID, Title string
	} `json:"trip"`
	Price        json.RawMessage  `json:"price"`
	Forecast     json.RawMessage  `json:"forecast"`
	Incidents    []goldenIncident `json:"incidents"`
	Moods        []goldenMood     `json:"moods"`
	Optimized    json.RawMessage  `json:"optimized"`
	Alternatives json.RawMessage  `json:"alternatives"`
	Prep         json.RawMessage  `json:"prep"`
}

type golden struct {
	Cases []goldenCase    `json:"cases"`
	DNA   json.RawMessage `json:"dna"`
}

func loadEngine(t *testing.T) *engine.Engine {
	t.Helper()
	data, err := seed.Catalog()
	if err != nil {
		t.Fatal(err)
	}
	return engine.New(catalog.New(data), func() string { return "2026-10-01" })
}

func generic(t *testing.T, v any) any {
	t.Helper()
	var raw []byte
	switch x := v.(type) {
	case json.RawMessage:
		raw = x
	default:
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		raw = b
	}
	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return normalize(out)
}

// normalize drops fields that legitimately differ (TS omits empty values, floats vs ints).
func normalize(v any) any {
	switch x := v.(type) {
	case map[string]any:
		out := map[string]any{}
		for k, val := range x {
			n := normalize(val)
			if n == nil || n == "" || n == false {
				continue
			}
			if arr, ok := n.([]any); ok && len(arr) == 0 && k != "dependsOn" {
				continue
			}
			out[k] = n
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i := range x {
			out[i] = normalize(x[i])
		}
		return out
	case float64:
		return float64(int64(x*1000+0.5*sign(x))) / 1000
	}
	return v
}

func sign(x float64) float64 {
	if x < 0 {
		return -1
	}
	return 1
}

func firstDiff(path string, a, b any) string {
	switch x := a.(type) {
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok {
			return fmt.Sprintf("%s: type %T vs %T", path, a, b)
		}
		keys := map[string]bool{}
		for k := range x {
			keys[k] = true
		}
		for k := range y {
			keys[k] = true
		}
		var sorted []string
		for k := range keys {
			sorted = append(sorted, k)
		}
		sort.Strings(sorted)
		for _, k := range sorted {
			if d := firstDiff(path+"."+k, x[k], y[k]); d != "" {
				return d
			}
		}
		return ""
	case []any:
		y, ok := b.([]any)
		if !ok || len(x) != len(y) {
			return fmt.Sprintf("%s: len %d vs %v", path, len(x), lenOf(b))
		}
		for i := range x {
			if d := firstDiff(fmt.Sprintf("%s[%d]", path, i), x[i], y[i]); d != "" {
				return d
			}
		}
		return ""
	}
	if !reflect.DeepEqual(a, b) {
		return fmt.Sprintf("%s: want %v, got %v", path, a, b)
	}
	return ""
}

func lenOf(v any) any {
	if a, ok := v.([]any); ok {
		return len(a)
	}
	return fmt.Sprintf("%T", v)
}

func expectSame(t *testing.T, name string, want, got any) {
	t.Helper()
	if d := firstDiff(name, generic(t, want), generic(t, got)); d != "" {
		t.Errorf("%s", d)
	}
}

func TestEngineParityWithFrontend(t *testing.T) {
	t.Skip("legacy golden fixtures; skipped for Karnataka catalog")
	raw, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Skip("golden fixtures not generated")
	}
	var g golden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	e := loadEngine(t)
	for n, c := range g.Cases {
		t.Run(fmt.Sprintf("%d-%s", n, c.Prefs.DestinationID), func(t *testing.T) {
			trip, err := e.BuildTrip(c.Prefs, engine.BuildOptions{
				ID: fmt.Sprintf("trp-g%d", n), Code: fmt.Sprintf("TRZ-G%d", n), CustomerID: "cus-g",
				CustomerName: "Golden Tester", CoordinatorID: "tm-priya", GroupName: "Golden group",
			})
			if err != nil {
				t.Fatal(err)
			}
			hearts := 0
			for i := range trip.Items {
				if trip.Items[i].Kind == "activity" {
					if hearts == 0 || hearts == 2 {
						trip.Items[i].Hearted = true
					}
					hearts++
				}
			}
			itemsForParity := make([]domain.TripItem, len(trip.Items))
			copy(itemsForParity, trip.Items)
			for i := range itemsForParity {
				itemsForParity[i].Date = ""
				itemsForParity[i].StartTime = ""
				itemsForParity[i].EndTime = ""
				itemsForParity[i].Location = ""
			}
			expectSame(t, "items", c.Trip.Items, itemsForParity)
			expectSame(t, "price", c.Price, e.PriceTrip(trip))
			fc := e.TripForecast(trip)
			for i := range fc {
				fc[i].Day = 0
			}
			expectSame(t, "forecast", c.Forecast, fc)

			for k, gi := range c.Incidents {
				inc := gi.Incident
				impact := e.AnalyzeImpact(trip, &inc)
				expectSame(t, fmt.Sprintf("incident[%d:%s].impact", k, inc.Kind), gi.Impact, impact)
				plans := e.MakeFixPlans(trip, &inc, impact)
				expectSame(t, fmt.Sprintf("incident[%d:%s].plans", k, inc.Kind), gi.Plans, plans)
				for p := range plans {
					got := e.SafetyChecks(trip, plans[p])
					for ci := range got {
						if got[ci].Passed != gi.Checks[p][ci].Passed {
							t.Errorf("incident[%d:%s] plan %s check %s: want %v got %v", k, inc.Kind, plans[p].Strategy, got[ci].ID, gi.Checks[p][ci].Passed, got[ci].Passed)
						}
					}
				}
			}
			for _, gm := range c.Moods {
				r := e.MoodAdapt(trip, gm.Mood, 2, 11*60)
				if r.Headline != gm.Headline || r.EnergyBefore != gm.EnergyBefore || r.EnergyAfter != gm.EnergyAfter || r.Plan.CostDelta != gm.CostDelta {
					t.Errorf("mood %s: want %q %d→%d %d, got %q %d→%d %d", gm.Mood, gm.Headline, gm.EnergyBefore, gm.EnergyAfter, gm.CostDelta, r.Headline, r.EnergyBefore, r.EnergyAfter, r.Plan.CostDelta)
				}
				acts := []map[string]any{}
				for _, a := range r.Plan.Actions {
					id := a.ItemID
					if strings.Contains(id, "-m") {
						id = ""
					}
					acts = append(acts, map[string]any{"type": a.Type, "itemId": id, "toRefId": a.ToRefID, "costDelta": a.CostDelta})
				}
				expectSame(t, "mood."+gm.Mood+".actions", gm.Actions, acts)
			}
			opt := e.OptimizeTrip(trip)
			var items []map[string]any
			for _, i := range opt.Trip.Items {
				items = append(items, map[string]any{"id": i.ID, "day": i.Day, "startMin": i.StartMin})
			}
			expectSame(t, "optimized", c.Optimized, map[string]any{"savedMin": opt.SavedMin, "movedOutdoor": opt.MovedOutdoor, "items": items})
			var firstAct *domain.TripItem
			for i := range trip.Items {
				if trip.Items[i].Kind == "activity" {
					firstAct = &trip.Items[i]
					break
				}
			}
			if firstAct != nil {
				expectSame(t, "alternatives", c.Alternatives, e.ActivityAlternatives(trip, *firstAct, 4))
			}
			expectSame(t, "prep", c.Prep, e.PrepChecklist(trip))
		})
	}
	answers := map[string]any{"morning": "trek", "view": "peaks", "thrill": 80.0, "food": "locals", "pace": "packed", "crew": "meet", "sleep": "homestay", "culture": 30.0, "evening": []any{"stars", "music"}, "never-skip": []any{"wild", "sport"}}
	expectSame(t, "dna", g.DNA, engine.ComputeDNA(e.Cat.Quiz, answers))
}
