package api

import (
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/profile"
)

func (a *API) signup(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[auth.SignupInput](w, r)
	if !ok {
		return
	}
	s, err := a.Auth.Signup(r.Context(), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.Created(w, s)
}

func (a *API) verifyEmail(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[auth.VerifyInput](w, r)
	if !ok {
		return
	}
	s, err := a.Auth.VerifyEmail(r.Context(), in)
	respond(w, r, s, err)
}

// verifyEmailLink handles the button in the email, then sends the browser to the web app.
func (a *API) verifyEmailLink(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	if _, err := a.Auth.VerifyEmail(r.Context(), auth.VerifyInput{Token: r.URL.Query().Get("token")}); err != nil {
		status = "invalid"
	}
	http.Redirect(w, r, a.Core.Cfg.PublicWeb+"/login?verified="+status, http.StatusSeeOther)
}

func (a *API) resendVerification(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Email string `json:"email"`
	}](w, r)
	if !ok {
		return
	}
	res, err := a.Auth.Resend(r.Context(), in.Email)
	respond(w, r, res, err)
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[auth.LoginInput](w, r)
	if !ok {
		return
	}
	s, err := a.Auth.Login(r.Context(), in)
	respond(w, r, s, err)
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	u, err := a.Auth.Me(r.Context(), principal(r))
	respond(w, r, u, err)
}

type promoInfo struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

func (a *API) meta(w http.ResponseWriter, r *http.Request) {
	promos := make([]promoInfo, 0, len(engine.Promos))
	for _, p := range engine.Promos {
		promos = append(promos, promoInfo{Code: p.Code, Label: p.Label})
	}
	operator, _ := a.Core.Store.OperatorName(r.Context())
	httpx.OK(w, map[string]any{
		"operator": operator,
		"moods":    engine.Moods, "promos": promos, "heartsMax": engine.MaxHearts, "interests": []string{"nature", "adventure", "culture", "food", "luxury", "social", "relax", "photo"},
		"today": a.Core.Today(), "ai": a.Core.AI.Engines(), "email": a.Core.Mailer != nil && a.Core.Mailer.Delivers(),
		"payments": map[string]any{"provider": map[bool]string{true: "razorpay", false: "none"}[a.Core.Cfg.RazorpayKeyID != ""], "keyId": a.Core.Cfg.RazorpayKeyID},
	})
}

type estimateCache struct {
	mu   sync.Mutex
	day  string
	vals map[string]int
}

var estimates estimateCache

func (a *API) estimate(d domain.Destination) int {
	estimates.mu.Lock()
	defer estimates.mu.Unlock()
	today := a.Core.Today()
	if estimates.day != today {
		estimates.day, estimates.vals = today, map[string]int{}
	}
	if v, ok := estimates.vals[d.ID]; ok {
		return v
	}
	v := a.Core.Eng.EstimatedPerPerson(d)
	estimates.vals[d.ID] = v
	return v
}

// wants returns the interests used for match scores: the query, else the traveler's Travel DNA.
func (a *API) wants(r *http.Request) []string {
	if q := strings.TrimSpace(r.URL.Query().Get("interests")); q != "" {
		return strings.Split(q, ",")
	}
	p, ok := auth.From(r.Context())
	if !ok || p.Operator() {
		return nil
	}
	pr, err := a.Profile.Get(r.Context(), p)
	if err != nil || pr.DNA == nil {
		return nil
	}
	return engine.DNAToInterests(*pr.DNA)
}

type destinationCard struct {
	Destination       domain.Destination      `json:"destination"`
	Match             engine.DestinationMatch `json:"match"`
	EstimatePerPerson int                     `json:"estimatePerPerson"`
	Weather           domain.DayForecast      `json:"weather"`
	SearchScore       int                     `json:"searchScore,omitempty"`
}

func (a *API) card(d domain.Destination, wants []string, month time.Month) destinationCard {
	return destinationCard{Destination: d, Match: a.Core.Eng.DestinationMatch(d, wants, month), EstimatePerPerson: a.estimate(d),
		Weather: a.Core.Eng.Forecast(d.ID, a.Core.Today())}
}

func (a *API) destinations(w http.ResponseWriter, r *http.Request) {
	wants := a.wants(r)
	month := a.Core.Now().In(a.Core.Cfg.Location).Month()
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	out := []destinationCard{}
	for _, d := range a.Core.Eng.Cat.Destinations {
		d = a.Core.Eng.Cat.LiveDestination(d)
		c := a.card(d, wants, month)
		if q != "" {
			c.SearchScore = engine.ScoreByFeeling(d, q)
			if c.SearchScore == 0 {
				continue
			}
		}
		out = append(out, c)
	}
	if q != "" {
		sort.SliceStable(out, func(i, j int) bool { return out[i].SearchScore > out[j].SearchScore })
	}
	httpx.OK(w, out)
}

func (a *API) destination(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d := a.Core.Eng.Cat.Destination(id)
	if d == nil {
		fail(w, r, httpx.NotFound("We couldn't find that destination."))
		return
	}
	month := a.Core.Now().In(a.Core.Cfg.Location).Month()
	reviews, err := a.Core.Store.DestinationReviews(r.Context(), id, 12)
	if err != nil {
		fail(w, r, err)
		return
	}
	httpx.OK(w, map[string]any{
		"card": a.card(*d, a.wants(r), month), "destination": d, "activities": a.Core.Eng.Cat.ActivitiesFor(id),
		"stays": a.Core.Eng.Cat.StaysFor(id), "transport": a.Core.Eng.Cat.TransportFor(id), "reviews": reviews,
	})
}

// GET /catalog — the operator's whole catalog (destinations, experiences, stays, routes, partners,
// quiz) with live ratings and trust scores. The web app loads it once and caches it for offline use.
func (a *API) catalog(w http.ResponseWriter, r *http.Request) {
	snap := a.Core.Eng.Cat.Snapshot()
	vendors := make([]map[string]any, 0, len(snap.Vendors))
	for _, v := range snap.Vendors {
		// Public view: partner contacts stay in the operator console.
		vendors = append(vendors, map[string]any{"id": v.ID, "name": v.Name, "kind": v.Kind, "destinationId": v.DestinationID,
			"language": v.Language, "available": v.Available, "trustScore": v.TrustScore})
	}
	team, err := a.Core.Store.ListTeam(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	operator, _ := a.Core.Store.OperatorName(r.Context())
	w.Header().Set("Cache-Control", "private, max-age=60")
	httpx.OK(w, map[string]any{
		"operator": operator, "destinations": snap.Destinations, "activities": snap.Activities, "stays": snap.Stays,
		"transport": snap.Transport, "vendors": vendors, "team": team, "coordinatorFor": snap.CoordinatorFor, "quiz": snap.Quiz,
	})
}

func (a *API) activities(w http.ResponseWriter, r *http.Request) {
	dest := r.URL.Query().Get("destination")
	var interests []string
	if q := strings.TrimSpace(r.URL.Query().Get("interests")); q != "" {
		interests = strings.Split(q, ",")
	}
	out := []domain.Activity{}
	for _, act := range a.Core.Eng.Cat.Activities {
		act = a.Core.Eng.Cat.LiveActivity(act)
		if dest != "" && act.DestinationID != dest {
			continue
		}
		if len(interests) > 0 {
			hit := false
			for _, i := range interests {
				for _, x := range act.Interests {
					hit = hit || x == i
				}
			}
			if !hit {
				continue
			}
		}
		out = append(out, act)
	}
	httpx.OK(w, out)
}

func (a *API) quiz(w http.ResponseWriter, r *http.Request) { httpx.OK(w, a.Core.Eng.Cat.Quiz) }

func (a *API) getProfile(w http.ResponseWriter, r *http.Request) {
	p, err := a.Profile.Get(r.Context(), principal(r))
	respond(w, r, p, err)
}

func (a *API) patchProfile(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[profile.Patch](w, r)
	if !ok {
		return
	}
	p, err := a.Profile.Update(r.Context(), principal(r), in)
	respond(w, r, p, err)
}

func (a *API) submitQuiz(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[struct {
		Answers map[string]any `json:"answers"`
	}](w, r)
	if !ok {
		return
	}
	res, err := a.Profile.SubmitQuiz(r.Context(), principal(r), in.Answers)
	respond(w, r, res, err)
}

func (a *API) togglePrep(w http.ResponseWriter, r *http.Request) {
	in, ok := decode[profile.PrepInput](w, r)
	if !ok {
		return
	}
	p, err := a.Profile.TogglePrep(r.Context(), principal(r), in)
	respond(w, r, p, err)
}

func (a *API) notifications(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	list, err := a.Core.Store.ListNotifications(r.Context(), p.Role, p.UserID, httpx.QueryInt(r, "limit", 80, 1, 200))
	respond(w, r, list, err)
}

func (a *API) readAllNotifications(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	respond(w, r, map[string]bool{"ok": true}, a.Core.Store.MarkNotifications(r.Context(), p.Role, p.UserID, ""))
}

func (a *API) readNotification(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	respond(w, r, map[string]bool{"ok": true}, a.Core.Store.MarkNotifications(r.Context(), p.Role, p.UserID, chi.URLParam(r, "id")))
}

func (a *API) dnaHistory(w http.ResponseWriter, r *http.Request) {
	list, err := a.Learning.History(r.Context(), principal(r).UserID, httpx.QueryInt(r, "limit", 50, 1, 200))
	respond(w, r, list, err)
}

func (a *API) recommendations(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	v, err := a.Profile.Recommend(r.Context(), principal(r), q.Get("destinationId"), q.Get("tripId"))
	respond(w, r, v, err)
}
