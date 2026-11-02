// Package admin is the Super Admin layer: the platform overview, Tripzyy's own guide
// verification, and suspending or reactivating traveler and operator accounts.
package admin

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

const (
	minPasswordLen = 12
	maxNoteLen     = 500
	refreshEvery   = 30 * time.Second
)

type Service struct {
	*app.Core

	mu        sync.RWMutex
	suspended map[string]bool
}

func New(c *app.Core) *Service { return &Service{Core: c, suspended: map[string]bool{}} }

// EnsureAccount provisions the Super Admin login from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
// The password is stored only as a bcrypt hash and login goes through the normal /auth/login.
// Misconfiguration never stops the server: the Super Admin is simply disabled.
func (s *Service) EnsureAccount(ctx context.Context) error {
	email := strings.ToLower(strings.TrimSpace(s.Cfg.SuperAdminEmail))
	password := s.Cfg.SuperAdminPassword
	disable := func(reason string) error {
		n, err := s.Store.DisableSuperAdminsExcept(ctx, "")
		if err != nil {
			return err
		}
		if reason != "" {
			slog.Warn("super admin disabled", "reason", reason, "accounts", n)
		}
		return s.Refresh(ctx)
	}
	if email == "" || password == "" {
		return disable("")
	}
	if !strings.Contains(email, "@") {
		return disable("SUPER_ADMIN_EMAIL is not an email address")
	}
	if utf8.RuneCountInString(password) < minPasswordLen || len(password) > 72 {
		return disable("SUPER_ADMIN_PASSWORD must be 12 to 72 characters")
	}
	// A changed email revokes the old Super Admin login.
	if _, err := s.Store.DisableSuperAdminsExcept(ctx, email); err != nil {
		return err
	}
	c, err := s.Store.CredentialsByEmail(ctx, email)
	switch {
	case errors.Is(err, store.ErrNotFound):
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		u := domain.User{ID: s.ID("usr"), Name: "Super Admin", Email: email, Role: domain.RoleSuperAdmin, AvatarTone: "coral", EmailVerified: true}
		if err := s.Store.CreateUser(ctx, u, string(hash)); err != nil {
			return err
		}
		slog.Info("created super admin login", "email", email)
	case err != nil:
		return err
	case c.User.Role != domain.RoleSuperAdmin:
		// Never promote an existing traveler or operator account.
		return disable("SUPER_ADMIN_EMAIL belongs to an existing " + c.User.Role + " account; use another email")
	default:
		hash := c.Hash
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
			b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			hash = string(b)
			slog.Info("super admin password updated from environment", "email", email)
		}
		if err := s.Store.ActivateSuperAdmin(ctx, c.User.ID, hash); err != nil {
			return err
		}
	}
	return s.Refresh(ctx)
}

// Suspension gate

// Refresh reloads the suspended accounts from the database.
func (s *Service) Refresh(ctx context.Context) error {
	ids, err := s.Store.SuspendedUserIDs(ctx)
	if err != nil {
		return err
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	s.mu.Lock()
	s.suspended = set
	s.mu.Unlock()
	return nil
}

// Run keeps the suspended list fresh (so every API instance catches up within refreshEvery).
func (s *Service) Run(ctx context.Context) {
	t := time.NewTicker(refreshEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.Refresh(ctx); err != nil && ctx.Err() == nil {
				slog.Warn("refresh suspended accounts", "err", err)
			}
		}
	}
}

func (s *Service) isSuspended(userID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.suspended[userID]
}

// Gate refuses every request that carries a suspended account's token, including sessions
// issued before the suspension.
func (s *Service) Gate(next http.Handler) http.Handler {
	if s == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if p, ok := auth.From(r.Context()); ok && s.isSuspended(p.UserID) {
			httpx.Fail(w, r, httpx.E(http.StatusUnauthorized, "account_suspended", "This account is suspended. Contact Tripzyy support."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Overview

type Overview struct {
	Stats       store.PlatformStats `json:"stats"`
	GeneratedAt time.Time           `json:"generatedAt"`
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	st, err := s.Store.PlatformStats(ctx)
	return Overview{Stats: st, GeneratedAt: s.Now().UTC()}, err
}

// Guides

var guideStatuses = map[string]bool{store.GuidePending: true, store.GuideVerified: true, store.GuideRejected: true, store.GuideSuspended: true}

func (s *Service) Guides(ctx context.Context, status string) ([]store.AdminGuide, error) {
	if status != "" && !guideStatuses[status] {
		return nil, httpx.BadRequest("status must be pending, verified, rejected or suspended.")
	}
	return s.Store.ListGuides(ctx, status)
}

func (s *Service) Guide(ctx context.Context, id string) (store.AdminGuide, error) {
	g, err := s.Store.GuideByID(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return g, httpx.NotFound("We couldn't find that guide.")
	}
	return g, err
}

func (s *Service) SetGuideVerification(ctx context.Context, actor auth.Principal, id, status, note string) (store.AdminGuide, error) {
	note = strings.TrimSpace(note)
	if !guideStatuses[status] {
		return store.AdminGuide{}, httpx.Invalid(map[string]string{"status": "Choose pending, verified, rejected or suspended."})
	}
	if utf8.RuneCountInString(note) > maxNoteLen {
		return store.AdminGuide{}, httpx.Invalid(map[string]string{"note": "Keep the note under 500 characters."})
	}
	before, err := s.Guide(ctx, id)
	if err != nil {
		return before, err
	}
	if err := s.Store.SetGuideVerification(ctx, id, status, note, actor.UserID); err != nil {
		return before, err
	}
	slog.Info("audit: guide verification changed", "guide", id, "from", before.Verification, "to", status, "by", actor.UserID)
	return s.Guide(ctx, id)
}

// VerifiedGuides is the public list: only guides Tripzyy has verified and not since suspended.
func (s *Service) VerifiedGuides(ctx context.Context) ([]store.PublicGuide, error) {
	return s.Store.VerifiedGuides(ctx)
}

// Accounts (travelers and operators)

func (s *Service) Accounts(ctx context.Context, role, q string, limit int) (map[string]any, error) {
	if role != "" && role != domain.RoleTraveler && role != domain.RoleOperator {
		return nil, httpx.BadRequest("role must be traveler or operator.")
	}
	q = strings.TrimSpace(q)
	if utf8.RuneCountInString(q) > 100 {
		q = string([]rune(q)[:100])
	}
	list, total, err := s.Store.ListAccounts(ctx, role, q, limit)
	if err != nil {
		return nil, err
	}
	return map[string]any{"accounts": list, "total": total}, nil
}

func (s *Service) Account(ctx context.Context, id string) (store.AdminAccount, error) {
	a, err := s.Store.AccountByID(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return a, httpx.NotFound("We couldn't find that account.")
	}
	return a, err
}

func (s *Service) SetAccountStatus(ctx context.Context, actor auth.Principal, id, status string) (store.AdminAccount, error) {
	if status != store.AccountActive && status != store.AccountSuspended {
		return store.AdminAccount{}, httpx.Invalid(map[string]string{"status": "Choose active or suspended."})
	}
	if id == actor.UserID {
		return store.AdminAccount{}, httpx.Forbidden("You can't change your own account.")
	}
	before, err := s.Account(ctx, id)
	if err != nil {
		return before, err
	}
	if err := s.Store.SetAccountStatus(ctx, id, status, actor.UserID); err != nil {
		return before, err
	}
	s.mu.Lock()
	if status == store.AccountSuspended {
		s.suspended[id] = true
	} else {
		delete(s.suspended, id)
	}
	s.mu.Unlock()
	slog.Info("audit: account status changed", "account", id, "role", before.Role, "from", before.Status, "to", status, "by", actor.UserID)
	return s.Account(ctx, id)
}
