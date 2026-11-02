package api

import (
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/agent"
	"trizpyy/internal/booking"
	"trizpyy/internal/incidents"
	"trizpyy/internal/ops"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/trips"
)

func tripID(r *http.Request) string { return chi.URLParam(r, "id") }

func (a *API) myTrips(w http.ResponseWriter, r *http.Request) {
	list, err := a.Trips.Mine(r.Context(), principal(r))
	respond(w, r, list, err)
}

func (a *API) createTrip(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.CreateInput](w, r)
	if !ok {
		return
	}
	t, err := a.Trips.Create(r.Context(), principal(r), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.Created(w, t)
}

func (a *API) getTrip(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) patchTrip(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.TripPatch](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.Patch(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) deleteTrip(w http.ResponseWriter, r *http.Request) {
	respond(w, r, map[string]bool{"ok": true}, a.Trips.Delete(r.Context(), principal(r), tripID(r)))
}

func (a *API) addItem(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.AddInput](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.AddItem(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) patchItem(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.ItemPatch](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.PatchItem(r.Context(), principal(r), tripID(r), chi.URLParam(r, "itemId"), in)
	respond(w, r, v, err)
}

func (a *API) alternatives(w http.ResponseWriter, r *http.Request) {
	item := r.URL.Query().Get("item")
	if item == "" {
		fail(w, r, httpx.BadRequest("Pass ?item= with the plan item id."))
		return
	}
	v, err := a.Trips.Alternatives(r.Context(), principal(r), tripID(r), item)
	respond(w, r, v, err)
}

func (a *API) stayAlternatives(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.StayAlternatives(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) optimize(w http.ResponseWriter, r *http.Request) {
	v, res, err := a.Trips.Optimize(r.Context(), principal(r), tripID(r))
	respond(w, r, map[string]any{"trip": v.Trip, "price": v.Price, "savedMin": res.SavedMin, "movedOutdoor": res.MovedOutdoor}, err)
}

func (a *API) optimizeBudget(w http.ResponseWriter, r *http.Request) {
	v, opt, err := a.Trips.OptimizeBudget(r.Context(), principal(r), tripID(r))
	respond(w, r, map[string]any{
		"trip":    v.Trip,
		"price":   v.Price,
		"saved":   opt.Saved,
		"changes": opt.Changes,
	}, err)
}

func (a *API) price(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), tripID(r))
	respond(w, r, v.Price, err)
}

func (a *API) applyPromo(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Code string `json:"code"`
	}](w, r)
	if !ok {
		return
	}
	v, label, err := a.Trips.ApplyPromo(r.Context(), principal(r), tripID(r), in.Code)
	respond(w, r, map[string]any{"trip": v.Trip, "price": v.Price, "label": label}, err)
}

func (a *API) removePromo(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.RemovePromo(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) insights(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Insights(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) book(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeOptional[booking.Checkout](w, r)
	if !ok {
		return
	}
	o, err := a.Booking.CreateOrder(r.Context(), principal(r), tripID(r), in)
	respond(w, r, o, err)
}

func (a *API) verifyPayment(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[booking.VerifyInput](w, r)
	if !ok {
		return
	}
	v, err := a.Booking.Verify(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) tripBookings(w http.ResponseWriter, r *http.Request) {
	v, err := a.Booking.Bookings(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) proposeMood(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.MoodInput](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.ProposeMood(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) acceptMood(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.MoodInput](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.AcceptMood(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) message(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Text string `json:"text"`
	}](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.Classify(r.Context(), principal(r), tripID(r), in.Text)
	respond(w, r, v, err)
}

const maxAudio = 12 << 20

// readAudio accepts multipart "audio" or a raw audio body.
func readAudio(r *http.Request) ([]byte, string, string, error) {
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/form-data") {
		if err := r.ParseMultipartForm(maxAudio); err != nil {
			return nil, "", "", httpx.BadRequest("Upload the voice note as form field \"audio\" (max 12 MB).")
		}
		f, h, err := r.FormFile("audio")
		if err != nil {
			return nil, "", "", httpx.BadRequest("Upload the voice note as form field \"audio\".")
		}
		defer f.Close()
		data, err := io.ReadAll(io.LimitReader(f, maxAudio+1))
		if err != nil || len(data) > maxAudio {
			return nil, "", "", httpx.BadRequest("Voice note is too large (max 12 MB).")
		}
		return data, h.Filename, h.Header.Get("Content-Type"), nil
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, maxAudio+1))
	if err != nil || len(data) > maxAudio {
		return nil, "", "", httpx.BadRequest("Voice note is too large (max 12 MB).")
	}
	return data, "voice.webm", ct, nil
}

func (a *API) travelerVoice(w http.ResponseWriter, r *http.Request) {
	if _, err := a.Trips.Authorize(r.Context(), principal(r), tripID(r)); err != nil {
		fail(w, r, err)
		return
	}
	audio, name, mime, err := readAudio(r)
	if err != nil {
		fail(w, r, err)
		return
	}
	t, engine, err := a.Core.AI.Transcribe(r.Context(), audio, name, mime)
	if err != nil {
		fail(w, r, httpx.Unavailable("We couldn't understand the voice note. Please type it instead."))
		return
	}
	cls, err := a.Trips.Classify(r.Context(), principal(r), tripID(r), t.Text)
	respond(w, r, map[string]any{"transcript": t.Text, "language": t.Language, "transcribedBy": engine, "understood": cls}, err)
}

func (a *API) review(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[trips.ReviewInput](w, r)
	if !ok {
		return
	}
	v, err := a.Trips.Review(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) tripIncidents(w http.ResponseWriter, r *http.Request) {
	v, err := a.Incidents.ForTrip(r.Context(), principal(r), tripID(r))
	respond(w, r, v, err)
}

func (a *API) createIncident(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[incidents.CreateInput](w, r)
	if !ok {
		return
	}
	v, err := a.Incidents.Create(r.Context(), principal(r), tripID(r), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.Created(w, v)
}

func (a *API) crowdReport(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[ops.ReportInput](w, r)
	if !ok {
		return
	}
	v, err := a.Ops.Report(r.Context(), principal(r), tripID(r), in)
	respond(w, r, v, err)
}

func (a *API) incident(w http.ResponseWriter, r *http.Request) {
	v, err := a.Incidents.Get(r.Context(), principal(r), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) startAgent(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeOptional[agent.StartInput](w, r)
	if !ok {
		return
	}
	v, err := a.Agent.Start(r.Context(), principal(r), chi.URLParam(r, "id"), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusAccepted, v)
}

func (a *API) agentRun(w http.ResponseWriter, r *http.Request) {
	v, err := a.Agent.Get(r.Context(), principal(r), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}

func (a *API) agentRequests(w http.ResponseWriter, r *http.Request) {
	v, err := a.Agent.Requests(r.Context(), principal(r), chi.URLParam(r, "id"))
	respond(w, r, v, err)
}
