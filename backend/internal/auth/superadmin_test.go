package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"trizpyy/internal/app"
	"trizpyy/internal/config"
	"trizpyy/internal/domain"
)

func testService() *Service {
	c := &app.Core{Cfg: config.Config{JWTSecret: "test-secret-that-is-long-enough-000000", JWTTTL: time.Hour}, Now: time.Now}
	return New(c, nil)
}

func TestParseAcceptsSuperAdminRole(t *testing.T) {
	s := testService()
	tok, _, err := s.Issue(domain.User{ID: "usr_admin", Role: domain.RoleSuperAdmin, Name: "Super Admin"})
	if err != nil {
		t.Fatal(err)
	}
	p, err := s.Parse(tok)
	if err != nil {
		t.Fatalf("super admin token rejected: %v", err)
	}
	if !p.SuperAdmin() || p.Operator() {
		t.Fatalf("principal %+v should be super admin only", p)
	}
}

func TestParseRejectsUnknownAndForgedRoles(t *testing.T) {
	s := testService()
	for _, role := range []string{"admin", "SUPER_ADMIN", "superadmin", ""} {
		tok, _, _ := s.Issue(domain.User{ID: "usr_x", Role: role})
		if _, err := s.Parse(tok); err == nil {
			t.Errorf("role %q should be rejected", role)
		}
	}
	// A client that signs its own super_admin token without the server secret gets nowhere.
	forged := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{Role: domain.RoleSuperAdmin,
		RegisteredClaims: jwt.RegisteredClaims{Subject: "usr_x", Issuer: "trizpyy", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}})
	signed, _ := forged.SignedString([]byte("attacker-secret"))
	if _, err := s.Parse(signed); err == nil {
		t.Error("token signed with another secret must be rejected")
	}
}

func TestSuperAdminOnly(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
	cases := []struct {
		name string
		p    *Principal
		want int
	}{
		{"anonymous", nil, http.StatusUnauthorized},
		{"traveler", &Principal{UserID: "u1", Role: domain.RoleTraveler}, http.StatusForbidden},
		{"operator", &Principal{UserID: "u2", Role: domain.RoleOperator}, http.StatusForbidden},
		{"super admin", &Principal{UserID: "u3", Role: domain.RoleSuperAdmin}, http.StatusTeapot},
	}
	for _, c := range cases {
		r := httptest.NewRequest(http.MethodGet, "/admin/overview", nil)
		if c.p != nil {
			r = r.WithContext(With(r.Context(), *c.p))
		}
		w := httptest.NewRecorder()
		SuperAdminOnly(ok).ServeHTTP(w, r)
		if w.Code != c.want {
			t.Errorf("%s: got %d, want %d", c.name, w.Code, c.want)
		}
	}
}

func TestOperatorOnlyStillRejectsSuperAdmin(t *testing.T) {
	// The Super Admin does not silently gain the operator console.
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
	r := httptest.NewRequest(http.MethodGet, "/ops/overview", nil)
	r = r.WithContext(With(r.Context(), Principal{UserID: "u3", Role: domain.RoleSuperAdmin}))
	w := httptest.NewRecorder()
	OperatorOnly(ok).ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d, want 403", w.Code)
	}
}
