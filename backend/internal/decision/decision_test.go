package decision

import (
	"context"
	"testing"
)

type fakeJev struct{ d Decision }

func (f fakeJev) Decide(context.Context, Question) (Decision, error) { return f.d, nil }

var q = Question{Task: "t", Kind: Choice, Prompt: "?", Options: []string{"positive", "negative", "neutral"}}

func rules(Question) Decision { return Decision{Answer: "neutral", Confidence: 0.5} }

func TestDecisionProvidersAndFallback(t *testing.T) {
	ctx := context.Background()
	// Not connected (today): falls through to the rules, and says so.
	d := New(0.6, &JevProvider{}).Decide(ctx, q, rules)
	if d.Provider != "rules" || d.Answer != "neutral" || d.Meta["fallbackFrom"] == nil {
		t.Fatalf("unconnected jev: %+v", d)
	}
	// A substituted Jev transport is used as-is.
	d = New(0.6, &JevProvider{Transport: fakeJev{Decision{Answer: "positive", Confidence: 0.93}}}).Decide(ctx, q, rules)
	if d.Provider != "jev" || d.Answer != "positive" {
		t.Fatalf("substituted jev: %+v", d)
	}
	// Answers outside the options, or bad confidences, are rejected.
	for _, bad := range []Decision{{Answer: "ecstatic", Confidence: 0.99}, {Answer: "positive", Confidence: 1.7}} {
		if d := New(0.6, &JevProvider{Transport: fakeJev{bad}}).Decide(ctx, q, rules); d.Provider != "rules" {
			t.Fatalf("invalid answer accepted: %+v", d)
		}
	}
	// Low confidence is not trusted.
	if d := New(0.6, &JevProvider{Transport: fakeJev{Decision{Answer: "negative", Confidence: 0.3}}}).Decide(ctx, q, rules); d.Provider != "rules" {
		t.Fatalf("low-confidence answer accepted: %+v", d)
	}
	// Scores stay in range.
	sq := Question{Kind: Score, Min: 1, Max: 5}
	if d := New(0.6, &JevProvider{Transport: fakeJev{Decision{Answer: "9", Confidence: 0.9}}}).Decide(ctx, sq, func(Question) Decision {
		return Decision{Answer: "3", Confidence: 0.7}
	}); d.Int() != 3 {
		t.Fatalf("out-of-range score accepted: %+v", d)
	}
}
