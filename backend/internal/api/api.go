// Package api maps HTTP routes to services. Handlers only decode, call and respond.
package api

import (
	"errors"
	"net/http"

	"trizpyy/internal/admin"
	"trizpyy/internal/agent"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/booking"
	"trizpyy/internal/documents"
	"trizpyy/internal/incidents"
	"trizpyy/internal/learning"
	"trizpyy/internal/ops"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/profile"
	"trizpyy/internal/store"
	"trizpyy/internal/trips"
	"trizpyy/internal/vendorlink"
)

type API struct {
	Core      *app.Core
	Auth      *auth.Service
	Trips     *trips.Service
	Booking   *booking.Service
	Incidents *incidents.Service
	Agent     *agent.Service
	Documents *documents.Service
	Ops       *ops.Service
	Profile   *profile.Service
	Learning  *learning.Service
	Vendors   *vendorlink.Service
	Geo       Geo
	Admin     *admin.Service
}

func principal(r *http.Request) auth.Principal {
	p, _ := auth.From(r.Context())
	return p
}

// fail maps repository sentinel errors to friendly HTTP errors.
func fail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		err = httpx.NotFound("We couldn't find that.")
	case errors.Is(err, store.ErrConflict):
		err = httpx.Conflict("This was just changed elsewhere. Refresh and try again.")
	}
	httpx.Fail(w, r, err)
}

func respond(w http.ResponseWriter, r *http.Request, v any, err error) {
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.OK(w, v)
}

func decode[T any](w http.ResponseWriter, r *http.Request) (T, bool) {
	var v T
	if err := httpx.Decode(r, &v); err != nil {
		fail(w, r, err)
		return v, false
	}
	return v, true
}

func decodeOptional[T any](w http.ResponseWriter, r *http.Request) (T, bool) {
	var v T
	if err := httpx.DecodeOptional(r, &v); err != nil {
		fail(w, r, err)
		return v, false
	}
	return v, true
}
