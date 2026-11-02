package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/platform/httpx"
)

// Super Admin endpoints. Every route here sits behind auth.SuperAdminOnly (see routes.go).

func (a *API) adminOverview(w http.ResponseWriter, r *http.Request) {
	v, err := a.Admin.Overview(r.Context())
	respond(w, r, v, err)
}

func (a *API) adminGuides(w http.ResponseWriter, r *http.Request) {
	v, err := a.Admin.Guides(r.Context(), r.URL.Query().Get("status"))
	respond(w, r, v, err)
}

func (a *API) adminGuide(w http.ResponseWriter, r *http.Request) {
	v, err := a.Admin.Guide(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) adminGuideVerification(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}](w, r)
	if !ok {
		return
	}
	v, err := a.Admin.SetGuideVerification(r.Context(), principal(r), chi.URLParam(r, "id"), in.Status, in.Note)
	respond(w, r, v, err)
}

func (a *API) adminAccounts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	v, err := a.Admin.Accounts(r.Context(), q.Get("role"), q.Get("q"), httpx.QueryInt(r, "limit", 100, 1, 200))
	respond(w, r, v, err)
}

func (a *API) adminAccount(w http.ResponseWriter, r *http.Request) {
	v, err := a.Admin.Account(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) adminAccountStatus(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Status string `json:"status"`
	}](w, r)
	if !ok {
		return
	}
	v, err := a.Admin.SetAccountStatus(r.Context(), principal(r), chi.URLParam(r, "id"), in.Status)
	respond(w, r, v, err)
}

// verifiedGuides is public: only guides whose current status is Tripzyy Verified.
func (a *API) verifiedGuides(w http.ResponseWriter, r *http.Request) {
	v, err := a.Admin.VerifiedGuides(r.Context())
	respond(w, r, v, err)
}
