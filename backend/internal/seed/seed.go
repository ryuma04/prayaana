package seed

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"trizpyy/internal/app"
	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
	"trizpyy/internal/store"
)

const OperatorID = "op-saffron"

// Seeder loads the operator's reference data. It never creates trips, customers or
// messages: those only come from real travelers and operators using the product.
type Seeder struct {
	core *app.Core
	data catalog.Data
}

func NewSeeder(c *app.Core, d catalog.Data) *Seeder { return &Seeder{core: c, data: d} }

// Catalog upserts destinations, experiences, stays, transport, partners and the team on every
// start, so new destinations appear without a reset and operator edits are kept.
func (sd *Seeder) Catalog(ctx context.Context) error {
	return sd.core.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		if err := st.EnsureOperator(ctx, OperatorID, sd.data.Operator); err != nil {
			return err
		}
		slog.Info("catalog", "destinations", len(sd.data.Destinations), "activities", len(sd.data.Activities), "stays", len(sd.data.Stays))
		return st.UpsertCatalog(ctx, OperatorID, sd.data)
	})
}

// OperatorAccount makes sure the operator's staff login exists (OPERATOR_EMAIL / OPERATOR_PASSWORD).
// An existing account is left untouched, so a changed password survives restarts.
func (sd *Seeder) OperatorAccount(ctx context.Context, name, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return nil
	}
	if _, err := sd.core.Store.UserByEmail(ctx, email); err == nil {
		return nil
	} else if !errors.Is(err, store.ErrNotFound) {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u := domain.User{ID: sd.core.ID("usr"), Name: name, Email: email, Role: domain.RoleOperator, OperatorID: OperatorID,
		AvatarTone: "lavender", EmailVerified: true}
	slog.Info("created operator login", "email", email)
	return sd.core.Store.CreateUser(ctx, u, string(hash))
}

// TravelerAccount makes sure the demo traveler login exists (e.g. rahul@trizpyy.demo).
func (sd *Seeder) TravelerAccount(ctx context.Context, name, email, password, phone string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return nil
	}
	var userID string
	if existing, err := sd.core.Store.UserByEmail(ctx, email); err == nil {
		userID = existing.ID
	} else if !errors.Is(err, store.ErrNotFound) {
		return err
	} else {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		u := domain.User{ID: sd.core.ID("usr"), Name: name, Email: email, Role: domain.RoleTraveler, Phone: phone,
			AvatarTone: "sky", EmailVerified: true, CreatedAt: sd.core.Now().UTC()}
		if err := sd.core.Store.CreateUser(ctx, u, string(hash)); err != nil {
			return err
		}
		if err := sd.core.Store.EnsureProfile(ctx, u.ID); err != nil {
			return err
		}
		slog.Info("created traveler login", "email", email)
		userID = u.ID
	}
	if sd.core.Cfg.TelegramDefaultChatID != 0 && userID != "" {
		_ = sd.core.Store.UpsertTelegramConnection(ctx, userID, sd.core.Cfg.TelegramDefaultChatID, "")
	}
	return nil
}
