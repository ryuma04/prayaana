package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
	"trizpyy/internal/mail"
	"trizpyy/internal/platform/db"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

const (
	verifyTTL      = 24 * time.Hour
	resendCooldown = 60 * time.Second
	maxCodeTries   = 5
	maxLoginFails  = 5
	lockDuration   = 15 * time.Minute
)

type Session struct {
	Token     string      `json:"token"`
	ExpiresAt time.Time   `json:"expiresAt"`
	User      domain.User `json:"user"`
}

// SignupResult either logs the user in or asks them to confirm their email first.
// The code itself is only ever delivered by email, never in an API response.
type SignupResult struct {
	Session              *Session `json:"session,omitempty"`
	VerificationRequired bool     `json:"verificationRequired"`
	Email                string   `json:"email"`
	EmailSent            bool     `json:"emailSent"`
}

// verifying reports whether new accounts must confirm their email. Without a real
// mailer (Resend or SMTP) nobody could receive the code, so accounts are active at once.
func (s *Service) verifying() bool {
	return s.Cfg.RequireEmailVerification && s.mailer.Delivers()
}

type SignupInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
}

// Signup creates a traveler account. Operator accounts are provisioned by the operator.
func (s *Service) Signup(ctx context.Context, in SignupInput) (SignupResult, error) {
	fields := map[string]string{}
	name, msg := validateName(in.Name)
	if msg != "" {
		fields["name"] = msg
	}
	email := normalizeEmail(in.Email)
	if email == "" {
		fields["email"] = "Enter a valid email address, like you@example.com."
	}
	if msg := validatePassword(in.Password, email, name); msg != "" {
		fields["password"] = msg
	}
	phone, ok := normalizePhone(in.Phone)
	if !ok {
		fields["phone"] = "Enter a valid mobile number, like +91 98765 43210."
	}
	if len(fields) > 0 {
		return SignupResult{}, httpx.Invalid(fields)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return SignupResult{}, err
	}
	verify := s.verifying()
	u := domain.User{ID: s.ID("usr"), Name: name, Email: email, Role: domain.RoleTraveler, Phone: phone, AvatarTone: "sky",
		EmailVerified: !verify, CreatedAt: s.Now().UTC()}
	var ticket verifyTicket
	err = s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		if err := st.CreateUser(ctx, u, string(hash)); err != nil {
			return err
		}
		if err := st.EnsureProfile(ctx, u.ID); err != nil {
			return err
		}
		if err := s.linkCustomer(ctx, st, u); err != nil {
			return err
		}
		if verify {
			ticket, err = s.newTicket(ctx, st, u.ID)
		}
		return err
	})
	if db.IsUniqueViolation(err) {
		return SignupResult{}, &httpx.Error{Status: 409, Code: "email_taken", Message: "An account with this email already exists. Try signing in.",
			Fields: map[string]string{"email": "This email is already registered."}}
	}
	if err != nil {
		return SignupResult{}, err
	}
	if !verify {
		sess, err := s.session(u)
		return SignupResult{Session: &sess, Email: email}, err
	}
	return s.deliver(ctx, u, ticket), nil
}

type verifyTicket struct {
	token, code string
}

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func sha(parts ...string) string {
	h := sha256.Sum256([]byte(strings.Join(parts, ":")))
	return hex.EncodeToString(h[:])
}

func (s *Service) newTicket(ctx context.Context, st *store.Store, userID string) (verifyTicket, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return verifyTicket{}, err
	}
	code, err := randomCode()
	if err != nil {
		return verifyTicket{}, err
	}
	t := verifyTicket{token: base64.RawURLEncoding.EncodeToString(raw), code: code}
	err = st.InsertVerification(ctx, store.Verification{ID: s.ID("ev"), UserID: userID, CodeHash: sha(userID, code),
		ExpiresAt: s.Now().UTC().Add(verifyTTL)}, sha(t.token))
	return t, err
}

// deliver sends the verification email.
func (s *Service) deliver(ctx context.Context, u domain.User, t verifyTicket) SignupResult {
	link := s.Cfg.PublicAPI + "/auth/verify-email?token=" + url.QueryEscape(t.token)
	first := strings.Fields(u.Name)[0]
	res := SignupResult{VerificationRequired: true, Email: u.Email}
	msg, err := mail.VerifyEmail(u.Email, mail.VerifyData{Name: first, Code: t.code, Link: link, ExpiresIn: "24 hours", Year: s.Now().Year()})
	if err != nil {
		slog.Error("render verification email", "err", err)
		return res
	}
	sendCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancel()
	if err := s.mailer.Send(sendCtx, msg); err != nil {
		slog.Error("send verification email", "to", u.Email, "err", err)
	} else {
		res.EmailSent = true
	}
	return res
}

// linkCustomer connects a traveler account to the operator's customer record (creating one if new).
func (s *Service) linkCustomer(ctx context.Context, st *store.Store, u domain.User) error {
	if c, err := st.CustomerByEmail(ctx, u.Email); err == nil {
		if c.UserID == "" {
			return st.LinkCustomerUser(ctx, c.ID, u.ID)
		}
		if c.UserID == u.ID {
			return nil
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		return err
	}
	op, err := st.DefaultOperator(ctx)
	if err != nil {
		return err
	}
	return st.CreateCustomer(ctx, op, domain.Customer{ID: s.ID("cus"), UserID: u.ID, Name: u.Name, Email: u.Email, Phone: u.Phone, Tone: "sky", Tags: []string{"New"}})
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// Portal is the login tab the user chose ("traveler" or "operator"); the account must match it.
	Portal string `json:"portal"`
}

var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-safe-placeholder"), bcrypt.DefaultCost)

var errBadLogin = httpx.Unauthorized("Email or password is incorrect.")

var errSuspended = httpx.E(403, "account_suspended", "This account is suspended. Contact Tripzyy support.")

func (s *Service) Login(ctx context.Context, in LoginInput) (Session, error) {
	email := normalizeEmail(in.Email)
	if email == "" || in.Password == "" || len(in.Password) > 200 {
		return Session{}, httpx.Invalid(map[string]string{"email": "Enter your email and password."})
	}
	c, err := s.Store.CredentialsByEmail(ctx, email)
	if errors.Is(err, store.ErrNotFound) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(in.Password))
		return Session{}, errBadLogin
	}
	if err != nil {
		return Session{}, err
	}
	if c.LockedUntil != nil && c.LockedUntil.After(s.Now()) {
		mins := int(time.Until(*c.LockedUntil).Minutes()) + 1
		return Session{}, httpx.E(429, "locked", fmt.Sprintf("Too many wrong attempts. Try again in %d minutes.", mins))
	}
	if bcrypt.CompareHashAndPassword([]byte(c.Hash), []byte(in.Password)) != nil {
		if err := s.Store.RecordLoginFailure(ctx, c.User.ID, maxLoginFails, lockDuration); err != nil {
			return Session{}, err
		}
		return Session{}, errBadLogin
	}
	if err := s.Store.ResetLoginFailures(ctx, c.User.ID); err != nil {
		return Session{}, err
	}
	if !c.User.EmailVerified && s.verifying() {
		return Session{}, &httpx.Error{Status: 403, Code: "email_not_verified",
			Message: "Please confirm your email first. We sent a 6-digit code to " + c.User.Email + "."}
	}
	if status, err := s.Store.AccountStatus(ctx, c.User.ID); err != nil {
		return Session{}, err
	} else if status == store.AccountSuspended {
		return Session{}, errSuspended
	}
	// Checked only after the password, so the portal never reveals which emails exist.
	// The Super Admin has no tab of its own and may sign in from either.
	if in.Portal != "" && in.Portal != c.User.Role && c.User.Role != domain.RoleSuperAdmin {
		if c.User.Role == domain.RoleOperator {
			return Session{}, httpx.E(403, "wrong_portal", "This is a tour operator account. Use the Tour operator tab to log in.")
		}
		return Session{}, httpx.E(403, "wrong_portal", "This is a traveler account. Use the Traveler tab to log in.")
	}
	return s.session(c.User)
}

type VerifyInput struct {
	Token string `json:"token"`
	Email string `json:"email"`
	Code  string `json:"code"`
}

var errBadCode = &httpx.Error{Status: 400, Code: "invalid_code", Message: "That code is wrong or has expired. Request a new one.",
	Fields: map[string]string{"code": "That code is wrong or has expired."}}

// VerifyEmail confirms an address with the link token or the 6-digit code, then signs the user in.
func (s *Service) VerifyEmail(ctx context.Context, in VerifyInput) (Session, error) {
	in.Token, in.Code = strings.TrimSpace(in.Token), strings.ReplaceAll(strings.TrimSpace(in.Code), " ", "")
	if in.Token == "" && (in.Code == "" || in.Email == "") {
		return Session{}, httpx.Invalid(map[string]string{"code": "Enter the 6-digit code from the email."})
	}
	var user domain.User
	var codeErr error
	err := s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		var v store.Verification
		var err error
		if in.Token != "" {
			if len(in.Token) > 100 {
				return errBadCode
			}
			v, err = st.VerificationByToken(ctx, sha(in.Token))
		} else {
			email := normalizeEmail(in.Email)
			if email == "" || len(in.Code) != 6 {
				return errBadCode
			}
			u, uerr := st.UserByEmail(ctx, email)
			if errors.Is(uerr, store.ErrNotFound) {
				return errBadCode
			}
			if uerr != nil {
				return uerr
			}
			v, err = st.LatestVerification(ctx, u.ID)
			wrong := subtle.ConstantTimeCompare([]byte(v.CodeHash), []byte(sha(u.ID, in.Code))) != 1
			if err == nil && v.UsedAt == nil && (v.Attempts >= maxCodeTries || wrong) {
				if err := st.CountVerificationAttempt(ctx, v.ID); err != nil {
					return err
				}
				codeErr = errBadCode
				if v.Attempts+1 >= maxCodeTries {
					codeErr = &httpx.Error{Status: 429, Code: "too_many_attempts", Message: "Too many wrong codes. Request a new email."}
				}
				return nil
			}
		}
		if errors.Is(err, store.ErrNotFound) {
			return errBadCode
		}
		if err != nil {
			return err
		}
		if v.UsedAt != nil || s.Now().After(v.ExpiresAt) {
			return errBadCode
		}
		if err := st.UseVerification(ctx, v.ID); err != nil {
			return err
		}
		if err := st.MarkEmailVerified(ctx, v.UserID); err != nil {
			return err
		}
		if err := st.ResetLoginFailures(ctx, v.UserID); err != nil {
			return err
		}
		user, err = st.UserByID(ctx, v.UserID)
		return err
	})
	if err != nil {
		return Session{}, err
	}
	if codeErr != nil {
		return Session{}, codeErr
	}
	if status, err := s.Store.AccountStatus(ctx, user.ID); err != nil {
		return Session{}, err
	} else if status == store.AccountSuspended {
		return Session{}, errSuspended
	}
	return s.session(user)
}

type ResendResult struct {
	Message string `json:"message"`
}

// Resend sends a fresh code. The answer is the same whether or not the email exists.
func (s *Service) Resend(ctx context.Context, rawEmail string) (ResendResult, error) {
	res := ResendResult{Message: "If that email has an unconfirmed account, a new code is on its way."}
	email := normalizeEmail(rawEmail)
	if email == "" {
		return res, httpx.Invalid(map[string]string{"email": "Enter a valid email address."})
	}
	u, err := s.Store.UserByEmail(ctx, email)
	if errors.Is(err, store.ErrNotFound) || err == nil && u.EmailVerified {
		return res, nil
	}
	if err != nil {
		return res, err
	}
	var ticket verifyTicket
	var tooSoon bool
	err = s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		if v, err := st.LatestVerification(ctx, u.ID); err == nil && s.Now().Sub(v.CreatedAt) < resendCooldown {
			tooSoon = true
			return nil
		} else if err != nil && !errors.Is(err, store.ErrNotFound) {
			return err
		}
		var err error
		ticket, err = s.newTicket(ctx, st, u.ID)
		return err
	})
	if err != nil {
		return res, err
	}
	if tooSoon {
		return res, httpx.E(429, "too_soon", "Please wait a minute before asking for another code.")
	}
	s.deliver(ctx, u, ticket)
	return res, nil
}

func (s *Service) session(u domain.User) (Session, error) {
	tok, exp, err := s.Issue(u)
	if err != nil {
		return Session{}, err
	}
	return Session{Token: tok, ExpiresAt: exp, User: u}, nil
}

func (s *Service) Me(ctx context.Context, p Principal) (domain.User, error) {
	u, err := s.Store.UserByID(ctx, p.UserID)
	if errors.Is(err, store.ErrNotFound) {
		return u, httpx.Unauthorized("Your account no longer exists. Please sign in again.")
	}
	return u, err
}
