package admin

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
)

func TestGateRefusesSuspendedSessions(t *testing.T) {
	s := New(nil)
	s.suspended = map[string]bool{"usr_bad": true}
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
	cases := []struct {
		name string
		p    *auth.Principal
		want int
	}{
		{"anonymous", nil, http.StatusTeapot},
		{"active traveler", &auth.Principal{UserID: "usr_ok", Role: domain.RoleTraveler}, http.StatusTeapot},
		{"suspended operator", &auth.Principal{UserID: "usr_bad", Role: domain.RoleOperator}, http.StatusUnauthorized},
	}
	for _, c := range cases {
		r := httptest.NewRequest(http.MethodGet, "/ops/overview", nil)
		if c.p != nil {
			r = r.WithContext(auth.With(r.Context(), *c.p))
		}
		w := httptest.NewRecorder()
		s.Gate(ok).ServeHTTP(w, r)
		if w.Code != c.want {
			t.Errorf("%s: got %d, want %d", c.name, w.Code, c.want)
		}
	}
}

func TestNilGatePassesThrough(t *testing.T) {
	var s *Service
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
	w := httptest.NewRecorder()
	s.Gate(ok).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	if w.Code != http.StatusTeapot {
		t.Fatalf("got %d", w.Code)
	}
}
