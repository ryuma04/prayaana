package api

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/trips"
)

// GET /trips/{id}/documents — confirmation, invoice, itinerary and vouchers (every version).
func (a *API) listDocuments(w http.ResponseWriter, r *http.Request) {
	v, err := a.Documents.List(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

// POST /trips/{id}/documents — issue fresh versions of every document.
func (a *API) reissueDocuments(w http.ResponseWriter, r *http.Request) {
	v, err := a.Documents.Reissue(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

// GET /trips/{id}/documents/{docId} — the PDF itself (?download=1 to save instead of view).
func (a *API) documentFile(w http.ResponseWriter, r *http.Request) {
	d, pdf, err := a.Documents.Content(r.Context(), principal(r), tripID(r), chi.URLParam(r, "docId"))
	if err != nil {
		fail(w, r, err)
		return
	}
	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Length", strconv.Itoa(len(pdf)))
	w.Header().Set("Content-Disposition", fmt.Sprintf("%s; filename=%q", disposition, d.FileName))
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Header().Set("ETag", `"`+d.SHA256+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}

// GET /trips/{id}/chat — the trip's in-app conversation (updates, documents, assistant, operator).
func (a *API) tripChat(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Chat(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

// POST /trips/{id}/chat — the traveler writes to the AI trip assistant.
func (a *API) sendTripChat(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.ChatInput](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.SendChat(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

// POST /ops/bookings/{id}/resend — remind a vendor who has not answered yet.
func (a *API) resendBooking(w http.ResponseWriter, r *http.Request) {
	v, err := a.Booking.Resend(r.Context(), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}
