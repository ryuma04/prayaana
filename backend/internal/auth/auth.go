package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
	"trizpyy/internal/mail"
	"trizpyy/internal/platform/httpx"
)

type Principal struct {
	UserID string
	Role   string
	Name   string
}

func (p Principal) Operator() bool { return p.Role == domain.RoleOperator }

func (p Principal) SuperAdmin() bool { return p.Role == domain.RoleSuperAdmin }

type ctxKey struct{}

func From(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}

func With(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, ctxKey{}, p)
}

type claims struct {
	Role string `json:"role"`
	Name string `json:"name"`
	jwt.RegisteredClaims
}

type Service struct {
	*app.Core
	secret []byte
	mailer mail.Mailer
}

func New(c *app.Core, m mail.Mailer) *Service {
	return &Service{Core: c, secret: []byte(c.Cfg.JWTSecret), mailer: m}
}

func (s *Service) Issue(u domain.User) (string, time.Time, error) {
	exp := s.Now().Add(s.Cfg.JWTTTL)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Role: u.Role, Name: u.Name,
		RegisteredClaims: jwt.RegisteredClaims{Subject: u.ID, IssuedAt: jwt.NewNumericDate(s.Now()), ExpiresAt: jwt.NewNumericDate(exp), Issuer: "trizpyy"},
	})
	signed, err := tok.SignedString(s.secret)
	return signed, exp, err
}

func (s *Service) Parse(token string) (Principal, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("trizpyy"), jwt.WithExpirationRequired())
	if err != nil || c.Subject == "" {
		return Principal{}, errors.New("invalid token")
	}
	if c.Role != domain.RoleTraveler && c.Role != domain.RoleOperator && c.Role != domain.RoleSuperAdmin {
		return Principal{}, errors.New("invalid role")
	}
	return Principal{UserID: c.Subject, Role: c.Role, Name: c.Name}, nil
}

func bearer(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return strings.TrimSpace(r.URL.Query().Get("token"))
}

// Optional attaches the caller when a valid token is present.
func (s *Service) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if tok := bearer(r); tok != "" {
			if p, err := s.Parse(tok); err == nil {
				r = r.WithContext(With(r.Context(), p))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func Required(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := From(r.Context()); !ok {
			httpx.Fail(w, r, httpx.Unauthorized("Please sign in to continue."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func OperatorOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := From(r.Context())
		if !ok {
			httpx.Fail(w, r, httpx.Unauthorized("Please sign in to continue."))
			return
		}
		if !p.Operator() {
			httpx.Fail(w, r, httpx.Forbidden("This area is for tour operators."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// SuperAdminOnly guards platform administration. The role comes from the signed token,
// never from the request body or the client.
func SuperAdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := From(r.Context())
		if !ok {
			httpx.Fail(w, r, httpx.Unauthorized("Please sign in to continue."))
			return
		}
		if !p.SuperAdmin() {
			httpx.Fail(w, r, httpx.Forbidden("This area is for the Tripzyy platform admin."))
			return
		}
		next.ServeHTTP(w, r)
	})
}
