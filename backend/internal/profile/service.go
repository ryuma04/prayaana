// Package profile keeps the traveler's Travel DNA, onboarding answers, points and settings.
package profile

import (
	"context"
	"errors"
	"strings"

	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/db"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

type Service struct{ *app.Core }

func New(c *app.Core) *Service { return &Service{Core: c} }

func (s *Service) Get(ctx context.Context, p auth.Principal) (store.Profile, error) {
	if p.Operator() {
		return store.Profile{}, httpx.Forbidden("Profiles are for travelers.")
	}
	if err := s.Store.EnsureProfile(ctx, p.UserID); err != nil {
		if db.IsForeignKeyViolation(err) {
			return store.Profile{}, httpx.Unauthorized("Your account no longer exists. Please sign in again.")
		}
		return store.Profile{}, err
	}
	return s.Store.GetProfile(ctx, p.UserID)
}

type Patch struct {
	Onboarding       map[string]any `json:"onboarding"`
	SavedPlaces      []string       `json:"savedPlaces"`
	AutoApproveLimit *int           `json:"autoApproveLimit"`
	Language         string         `json:"language"`
}

func (s *Service) Update(ctx context.Context, p auth.Principal, in Patch) (store.Profile, error) {
	pr, err := s.Get(ctx, p)
	if err != nil {
		return pr, err
	}
	if in.Onboarding != nil {
		pr.Onboarding = in.Onboarding
	}
	if in.SavedPlaces != nil {
		var clean []string
		for _, id := range in.SavedPlaces {
			if s.Eng.Cat.Destination(id) != nil && !contains(clean, id) {
				clean = append(clean, id)
			}
		}
		pr.SavedPlaces = clean
	}
	if in.AutoApproveLimit != nil {
		if *in.AutoApproveLimit < 0 || *in.AutoApproveLimit > 100000 {
			return pr, httpx.BadRequest("Auto-approve limit must be ₹0 to ₹1,00,000.")
		}
		pr.AutoApproveLimit = *in.AutoApproveLimit
	}
	if l := strings.TrimSpace(in.Language); l != "" {
		if len(l) > 30 {
			return pr, httpx.BadRequest("Language name is too long.")
		}
		pr.Language = l
	}
	if err := s.Store.SaveProfile(ctx, p.UserID, pr); err != nil {
		return pr, err
	}
	return s.Store.GetProfile(ctx, p.UserID)
}

type QuizResult struct {
	DNA       domain.TravelDNA `json:"dna"`
	Interests []string         `json:"interests"`
	Profile   store.Profile    `json:"profile"`
}

// SubmitQuiz scores the Travel DNA quiz and saves it.
func (s *Service) SubmitQuiz(ctx context.Context, p auth.Principal, answers map[string]any) (QuizResult, error) {
	pr, err := s.Get(ctx, p)
	if err != nil {
		return QuizResult{}, err
	}
	if len(answers) == 0 {
		return QuizResult{}, httpx.BadRequest("Answer at least one question.")
	}
	valid := map[string]bool{}
	for _, q := range s.Eng.Cat.Quiz {
		valid[q.ID] = true
	}
	clean := map[string]any{}
	for k, v := range answers {
		if valid[k] {
			clean[k] = v
		}
	}
	dna := engine.ComputeDNA(s.Eng.Cat.Quiz, clean)
	pr.DNA, pr.QuizAnswers = &dna, clean
	err = s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		if err := st.SaveProfile(ctx, p.UserID, pr); err != nil {
			return err
		}
		if err := st.AddXP(ctx, p.UserID, 40, "dna"); err != nil {
			return err
		}
		return st.SetCustomerDNA(ctx, p.UserID, dna.Name)
	})
	if err != nil {
		return QuizResult{}, err
	}
	pr, err = s.Store.GetProfile(ctx, p.UserID)
	return QuizResult{DNA: dna, Interests: engine.DNAToInterests(dna), Profile: pr}, err
}

type PrepInput struct {
	TripID string `json:"tripId"`
	ItemID string `json:"itemId"`
}

// TogglePrep ticks or unticks a prep checklist item for one of the traveler's trips.
func (s *Service) TogglePrep(ctx context.Context, p auth.Principal, in PrepInput) (store.Profile, error) {
	owner, err := s.Store.TripOwner(ctx, in.TripID)
	if errors.Is(err, store.ErrNotFound) || owner != p.UserID {
		return store.Profile{}, httpx.NotFound("We couldn't find that trip.")
	}
	if err != nil {
		return store.Profile{}, err
	}
	if in.ItemID == "" || len(in.ItemID) > 40 {
		return store.Profile{}, httpx.BadRequest("itemId is required.")
	}
	pr, err := s.Get(ctx, p)
	if err != nil {
		return pr, err
	}
	cur := pr.PrepDone[in.TripID]
	if contains(cur, in.ItemID) {
		var next []string
		for _, x := range cur {
			if x != in.ItemID {
				next = append(next, x)
			}
		}
		cur = next
	} else {
		cur = append(cur, in.ItemID)
	}
	if cur == nil {
		cur = []string{}
	}
	pr.PrepDone[in.TripID] = cur
	if err := s.Store.SaveProfile(ctx, p.UserID, pr); err != nil {
		return pr, err
	}
	return s.Store.GetProfile(ctx, p.UserID)
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
