package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"trizpyy/internal/admin"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/config"
	"trizpyy/internal/domain"
)

func adminTestAPI(t *testing.T) (*API, *auth.Service) {
	t.Helper()
	core := &app.Core{Cfg: config.Config{JWTSecret: "test-secret-that-is-long-enough-000000", JWTTTL: time.Hour}, Now: time.Now}
	a := auth.New(core, nil)
	ad := admin.New(core)
	return &API{Core: core, Auth: a, Admin: ad}, a
}

func issueToken(t *testing.T, a *auth.Service, id, role string) string {
	t.Helper()
	tok, _, err := a.Issue(domain.User{ID: id, Role: role, Name: "Test"})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

var adminRoutes = []struct{ method, path, body string }{
	{"GET", "/admin/overview", ""},
	{"GET", "/admin/guides", ""},
	{"GET", "/admin/guides?status=pending", ""},
	{"GET", "/admin/guides/tm-priya", ""},
	{"POST", "/admin/guides/tm-priya/verification", `{"status":"verified"}`},
	{"GET", "/admin/accounts", ""},
	{"GET", "/admin/accounts/usr_someone", ""},
	{"POST", "/admin/accounts/usr_someone/status", `{"status":"suspended"}`},
	// A payload that claims a role changes nothing: the role only comes from the signed token.
	{"POST", "/admin/accounts/usr_someone/status", `{"status":"suspended","role":"super_admin"}`},
}

func TestAdminRoutesRefuseNonSuperAdmins(t *testing.T) {
	api, a := adminTestAPI(t)
	h := api.Router()
	callers := []struct {
		name  string
		token string
		want  int
	}{
		{"anonymous", "", http.StatusUnauthorized},
		{"garbage token", "not-a-jwt", http.StatusUnauthorized},
		{"traveler", issueToken(t, a, "usr_trav", domain.RoleTraveler), http.StatusForbidden},
		{"operator", issueToken(t, a, "usr_op", domain.RoleOperator), http.StatusForbidden},
	}
	for _, c := range callers {
		for _, rt := range adminRoutes {
			r := httptest.NewRequest(rt.method, rt.path, strings.NewReader(rt.body))
			r.Header.Set("Content-Type", "application/json")
			if c.token != "" {
				r.Header.Set("Authorization", "Bearer "+c.token)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != c.want {
				t.Errorf("%s %s %s: got %d, want %d", c.name, rt.method, rt.path, w.Code, c.want)
			}
		}
	}
}
