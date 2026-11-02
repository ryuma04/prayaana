package api

import (
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/vendorlink"
)

func token(r *http.Request) string { return chi.URLParam(r, "token") }

func (a *API) vendorPage(w http.ResponseWriter, r *http.Request) {
	v, err := a.Vendors.Get(r.Context(), token(r))
	respond(w, r, v, err)
}

func (a *API) vendorReply(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[vendorlink.ReplyInput](w, r)
	if !ok {
		return
	}
	v, err := a.Vendors.Reply(r.Context(), token(r), in, "web")
	respond(w, r, v, err)
}

// vendorVoice takes a recorded voice note (multipart "audio") or JSON {"transcript": "..."}.
func (a *API) vendorVoice(w http.ResponseWriter, r *http.Request) {
	var in vendorlink.VoiceInput
	if strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		body, ok := decode[struct {
			Transcript string `json:"transcript"`
		}](w, r)
		if !ok {
			return
		}
		in.Transcript = body.Transcript
	} else {
		audio, name, mime, err := readAudio(r)
		if err != nil {
			fail(w, r, err)
			return
		}
		in = vendorlink.VoiceInput{Audio: audio, Filename: name, Mime: mime}
	}
	v, err := a.Vendors.Voice(r.Context(), token(r), in)
	respond(w, r, v, err)
}

// GET /ops/requests — every vendor request still waiting for an answer, with the reply link and contact.
func (a *API) pendingRequests(w http.ResponseWriter, r *http.Request) {
	v, err := a.Vendors.Pending(r.Context())
	respond(w, r, v, err)
}

// POST /ops/requests/{token}/answer — the operator records a vendor's answer after a phone call.
func (a *API) recordAnswer(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[vendorlink.ReplyInput](w, r)
	if !ok {
		return
	}
	v, err := a.Vendors.Record(r.Context(), token(r), in)
	respond(w, r, v, err)
}

func (a *API) paymentsWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		fail(w, r, httpx.BadRequest("Bad payload."))
		return
	}
	respond(w, r, map[string]bool{"ok": true}, a.Booking.Webhook(r.Context(), body, r.Header.Get("X-Razorpay-Signature")))
}
