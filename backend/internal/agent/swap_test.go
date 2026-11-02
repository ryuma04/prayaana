package agent

import (
	"testing"

	"trizpyy/internal/engine"
)

func TestPickSwapAcceptance(t *testing.T) {
	r := engine.SwapReport{
		Route:    []engine.SwapCandidate{{ID: "r1", Type: engine.SwapRoute, RequiresAcceptance: true}},
		Activity: []engine.SwapCandidate{{ID: "a1", Type: engine.SwapActivity}},
	}
	if c, err := pickSwap(r, "r1", false); err != nil || c.ID != "r1" {
		t.Fatalf("traveler could not accept the route swap: %v", err)
	}
	if _, err := pickSwap(r, "r1", true); err == nil {
		t.Fatal("an operator accepted a route change for the traveler")
	}
	if _, err := pickSwap(r, "a1", true); err != nil {
		t.Fatalf("activity swap refused: %v", err)
	}
	if _, err := pickSwap(r, "gone", false); err == nil {
		t.Fatal("a stale swap id was accepted")
	}
}
