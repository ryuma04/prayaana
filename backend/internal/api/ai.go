package api

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/ai"
	"trizpyy/internal/aisvc"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
)

// Endpoints backed by the Python AI service. Each answers with its own rules (or says the
// capability is unavailable) when the service is off, slow or returns something invalid.

type activityHit struct {
	Activity domain.Activity `json:"activity"`
	Score    float64         `json:"score"`
}

// searchActivities is search by feeling ("quiet places with great food") over the catalog.
func (a *API) searchActivities(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	dest := r.URL.Query().Get("destinationId")
	if len(q) < 2 || len(q) > 300 {
		fail(w, r, httpx.BadRequest("Describe what you feel like in 2 to 300 characters."))
		return
	}
	limit := httpx.QueryInt(r, "limit", 8, 1, 30)
	cat := a.Core.Eng.Cat
	hits := []activityHit{}
	matches, err := a.Core.AISvc.Search(r.Context(), q, dest, limit)
	if err == nil {
		for _, m := range matches {
			if act := cat.Activity(m.ID); act != nil {
				hits = append(hits, activityHit{Activity: cat.LiveActivity(*act), Score: math.Round(m.Score*1000) / 1000})
			}
		}
		httpx.OK(w, map[string]any{"results": hits, "engine": "semantic"})
		return
	}
	// Fallback: the planner's own reading of the words (wish rules) scored against each activity.
	wishes := engine.ParseWishes(q)
	words := strings.Fields(strings.ToLower(q))
	for _, act := range cat.Activities {
		if dest != "" && act.DestinationID != dest {
			continue
		}
		score := 0.0
		for _, wsh := range wishes {
			for _, b := range wsh.Boosts {
				for _, in := range act.Interests {
					if in == b {
						score += 1
					}
				}
			}
			if wsh.LowWalking && act.Walking == "high" {
				score -= 2
			}
		}
		text := strings.ToLower(act.Title + " " + act.Description)
		for _, wd := range words {
			if len(wd) > 3 && strings.Contains(text, wd) {
				score += 0.5
			}
		}
		if score > 0 {
			hits = append(hits, activityHit{Activity: cat.LiveActivity(act), Score: score})
		}
	}
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].Score > hits[j].Score })
	if len(hits) > limit {
		hits = hits[:limit]
	}
	httpx.OK(w, map[string]any{"results": hits, "engine": "keywords", "note": unavailableNote(err)})
}

func unavailableNote(err error) string {
	switch {
	case errors.Is(err, aisvc.ErrUnavailable):
		return "AI service unavailable, ranked with keyword rules."
	case err != nil:
		return "AI service answered unexpectedly, ranked with keyword rules."
	}
	return ""
}

// routePlan asks the OR-Tools optimizer for the best order and times of a day's experiences.
// It is a proposal only; nothing in the trip changes.
func (a *API) routePlan(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), chi.URLParam(r, "id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	t := v.Trip
	day, err := strconv.Atoi(chi.URLParam(r, "day"))
	if err != nil || day < 1 || day > t.Prefs.Days() {
		fail(w, r, httpx.BadRequest("That day is not part of this trip."))
		return
	}
	eng := a.Core.Eng
	var acts []domain.TripItem
	for _, it := range engine.DayItems(t.Items, day) {
		if it.Kind == "activity" && it.Status != domain.ItemDone {
			acts = append(acts, it)
		}
	}
	current := []map[string]any{}
	for _, it := range acts {
		current = append(current, map[string]any{"id": it.ID, "title": it.Title, "startMin": it.StartMin, "endMin": it.End()})
	}
	if len(acts) < 2 {
		httpx.OK(w, map[string]any{"engine": "none", "current": current, "note": "Fewer than two experiences that day, nothing to reorder."})
		return
	}
	wet := engine.IsWet(eng.TripDayWeather(t, day))
	req := aisvc.OptimizeRequest{Day: day, DayStartMin: 8 * 60, DayEndMin: 23 * 60, ReturnToStart: true, Precedence: []aisvc.Precedence{}}
	if st := eng.Cat.Stay(t.StayID); st != nil {
		req.Start = &aisvc.Point{ID: st.ID, Name: st.Name, Lat: st.Lat, Lng: st.Lng}
	}
	limit := engine.PaceLimit[t.Prefs.Pace] + 2
	req.MaxEnergy = &limit
	// Travel times come from the Go engine's own estimate (engine.TravelGap), not a second routing model.
	nodes := []domain.TripItem{{Lat: nil}}
	if req.Start != nil {
		nodes[0].Lat, nodes[0].Lng = &req.Start.Lat, &req.Start.Lng
	}
	for _, it := range acts {
		open, close, _ := eng.OpeningWindow(it)
		req.Stops = append(req.Stops, aisvc.Stop{ID: it.ID, Title: it.Title, Lat: it.Lat, Lng: it.Lng, DurationMin: it.DurationMin,
			OpenMin: open, CloseMin: close, Required: true, WeatherOK: !(wet && it.Outdoor), Energy: it.Energy})
		nodes = append(nodes, it)
	}
	req.TravelMinutes = make([][]int, len(nodes))
	for i := range nodes {
		req.TravelMinutes[i] = make([]int, len(nodes))
		for j := range nodes {
			if i != j {
				req.TravelMinutes[i][j] = engine.TravelGap(nodes[i], nodes[j])
			}
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()
	res, err := a.Core.AISvc.OptimizeDay(ctx, req)
	if err != nil {
		httpx.OK(w, map[string]any{"engine": "unavailable", "current": current, "note": unavailableNote(err) + " Your current order is kept."})
		return
	}
	httpx.OK(w, map[string]any{"engine": "ortools", "current": current, "proposal": res})
}

// delayRisk scores every transfer and travel leg of the trip with the demo delay model.
func (a *API) delayRisk(w http.ResponseWriter, r *http.Request) {
	v, err := a.Trips.Get(r.Context(), principal(r), chi.URLParam(r, "id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	t, eng := v.Trip, a.Core.Eng
	dest := eng.Cat.Destination(t.DestinationID)
	speed := map[string]float64{"flight": 600, "train": 60, "bus": 45, "car": 50, "transfer": 28}
	var list []aisvc.Transfer
	for _, it := range t.Items {
		if !engine.IsActive(it) || (it.Kind != "transfer" && !engine.IsTransport(it)) {
			continue
		}
		mode := it.Kind
		peak := false
		if dest != nil {
			for _, m := range dest.BestMonths {
				peak = peak || m == engine.MonthOf(engine.AddDays(t.Prefs.StartDate, it.Day-1))
			}
		}
		// Distances aren't stored for travel legs, so they are estimated from the scheduled duration.
		list = append(list, aisvc.Transfer{TransferID: it.ID, Mode: mode, DistanceKm: math.Round(float64(it.DurationMin)/60*speed[mode]*10) / 10,
			RainChance: eng.TripDayWeather(t, it.Day).RainChance, DepartMin: it.StartMin % (24 * 60), PeakSeason: peak, BufferMin: it.BufferMin})
	}
	if len(list) == 0 {
		httpx.OK(w, map[string]any{"available": true, "risks": []any{}})
		return
	}
	risks, meta, err := a.Core.AISvc.DelayRisk(r.Context(), list)
	if err != nil {
		httpx.OK(w, map[string]any{"available": false, "risks": []any{}, "note": unavailableNote(err)})
		return
	}
	httpx.OK(w, map[string]any{"available": true, "risks": risks, "model": meta})
}

// vendorReliability adds a failure-chance estimate with uncertainty next to the Go trust score.
func (a *API) vendorReliability(w http.ResponseWriter, r *http.Request) {
	list, err := a.Core.Store.ListVendors(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	id := chi.URLParam(r, "id")
	for _, vd := range list {
		if vd.ID != id {
			continue
		}
		total := vd.Requests
		answered := int(math.Round(float64(vd.ResponseRate) / 100 * float64(total)))
		failures := int(math.Round(vd.CancellationRate / 100 * float64(total)))
		expired := total - answered
		declined := max(0, min(answered, failures-expired))
		rel, err := a.Core.AISvc.Reliability(r.Context(), aisvc.VendorHistory{VendorID: id, Answered: answered, Declined: declined, Expired: expired, AvgReplyMin: float64(vd.AvgReplyMin)})
		if err != nil {
			httpx.OK(w, map[string]any{"available": false, "trustScore": vd.TrustScore, "note": unavailableNote(err)})
			return
		}
		httpx.OK(w, map[string]any{"available": true, "trustScore": vd.TrustScore, "reliability": rel})
		return
	}
	fail(w, r, httpx.NotFound("No such vendor."))
}

// aiModel shows the Nugen customization pipeline: base model → alignment → domain model → in use.
func (a *API) aiModel(w http.ResponseWriter, r *http.Request) {
	c := a.Core.Cfg
	httpx.OK(w, ai.NugenStatus(r.Context(), c.NugenAPIKey, c.NugenBaseURL, c.NugenAlignmentID, c.NugenModelID, a.Core.AI.DomainModelActive()))
}

// askModel lets an operator try the aligned model with a traveler-style question.
func (a *API) askModel(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Question string `json:"question"`
	}](w, r)
	if !ok {
		return
	}
	q := strings.TrimSpace(in.Question)
	if len(q) < 3 || len(q) > 400 {
		fail(w, r, httpx.BadRequest("Ask a question of 3 to 400 characters."))
		return
	}
	answer, err := a.Core.AI.AskDomain(r.Context(), q)
	if err != nil {
		fail(w, r, httpx.Unavailable(err.Error()))
		return
	}
	httpx.OK(w, map[string]string{"answer": answer, "model": a.Core.Cfg.NugenModelID})
}

// guideFacts are the catalog facts for the destination a question is about (or a short list of all).
func (a *API) guideFacts(city, question string) string {
	cat := a.Core.Eng.Cat
	text := strings.ToLower(city + " " + question)
	var b strings.Builder
	for _, d := range cat.Destinations {
		if !strings.Contains(text, strings.ToLower(d.Name)) {
			continue
		}
		fmt.Fprintf(&b, "%s, %s: %s Best months: %v. Rainy months: %v. Local cab about Rs %d a day.\n", d.Name, d.State, d.Description, d.BestMonths, d.RainyMonths, d.LocalCabPerDay)
		for _, c := range d.Clusters {
			fmt.Fprintf(&b, "Area %s, lunch at %s.\n", c.Name, c.Lunch.Name)
		}
		for _, act := range cat.ActivitiesFor(d.ID) {
			where := "outdoor"
			if !act.Outdoor {
				where = "indoor"
			}
			fmt.Fprintf(&b, "Experience: %s, %d min, Rs %d per person, %s, effort %d of 5, kids %v.\n", act.Title, act.DurationMin, act.Price, where, act.Energy, act.KidFriendly)
		}
		for _, e := range d.Emergency {
			fmt.Fprintf(&b, "Emergency: %s %s.\n", e.Label, e.Phone)
		}
		return b.String()
	}
	b.WriteString("Trizpyy destinations: ")
	for i, d := range cat.Destinations {
		if i > 0 {
			b.WriteString("; ")
		}
		fmt.Fprintf(&b, "%s (%s, best months %v)", d.Name, d.State, d.BestMonths)
	}
	return b.String()
}

// guide answers the Travel Guru chat with real AI, grounded in the Trizpyy catalog.
func (a *API) guide(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Question string `json:"question"`
		City     string `json:"city"`
	}](w, r)
	if !ok {
		return
	}
	q := strings.TrimSpace(in.Question)
	if len(q) < 2 || len(q) > 500 {
		fail(w, r, httpx.BadRequest("Ask a question of 2 to 500 characters."))
		return
	}
	facts, retrieval := a.guideFacts(in.City, q), "catalog"
	// Nugen embeddings pick the experiences that best match what the traveler means, across all destinations.
	if matched := a.nugenMatches(r.Context(), q); matched != "" {
		facts, retrieval = matched+"\n"+facts, "nugen"
	}
	answer, engine, err := a.Core.AI.Guide(r.Context(), facts, q)
	if err != nil {
		fail(w, r, httpx.Unavailable("The travel assistant is busy right now. Please try again in a minute."))
		return
	}
	httpx.OK(w, map[string]string{"answer": answer, "engine": engine, "retrieval": retrieval})
}

// nugenMatches lists the catalog experiences Nugen's embedding model finds closest to the question.
func (a *API) nugenMatches(ctx context.Context, question string) string {
	if a.Core.NugenSearch == nil {
		return ""
	}
	cat := a.Core.Eng.Cat
	destName := func(id string) string {
		if d := cat.Destination(id); d != nil {
			return d.Name
		}
		return id
	}
	items := make([]ai.SearchItem, 0, len(cat.Activities))
	for _, act := range cat.Activities {
		items = append(items, ai.SearchItem{ID: act.ID, Text: fmt.Sprintf("%s in %s. %s Themes: %s.", act.Title, destName(act.DestinationID), act.Description, strings.Join(act.Interests, ", "))})
	}
	sctx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	hits, err := a.Core.NugenSearch.Search(sctx, items, question, 8)
	if err != nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("EXPERIENCES THAT BEST MATCH THE QUESTION (picked by Nugen):\n")
	for _, h := range hits {
		if act := cat.Activity(h.ID); act != nil {
			fmt.Fprintf(&b, "- %s (%s): %d min, Rs %d per person, outdoor %v, effort %d of 5.\n", act.Title, destName(act.DestinationID), act.DurationMin, act.Price, act.Outdoor, act.Energy)
		}
	}
	return b.String()
}
