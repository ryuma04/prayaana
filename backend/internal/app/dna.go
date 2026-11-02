package app

import (
	"context"

	"trizpyy/internal/domain"
)

// TravelerDNA is the traveler's current Travel DNA, or nil if they haven't taken the quiz.
// Callers only read it (adaptive swaps rank with it); nothing here changes it.
func (c *Core) TravelerDNA(ctx context.Context, userID string) *domain.TravelDNA {
	if userID == "" {
		return nil
	}
	p, err := c.Store.GetProfile(ctx, userID)
	if err != nil {
		return nil
	}
	return p.DNA
}
