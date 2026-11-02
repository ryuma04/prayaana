package api

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"trizpyy/internal/auth"
	"trizpyy/internal/platform/httpx"
)

func (a *API) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, httpx.Recover, httpx.Logger, httpx.SecurityHeaders, httpx.CORS(a.Core.Cfg.CORSOrigins))
	r.Use(a.Auth.Optional)
	// Refuses tokens of accounts a Super Admin has suspended.
	r.Use(a.Admin.Gate)

	r.Get("/healthz", a.health)
	r.Get("/ws", a.websocket)

	r.Group(func(r chi.Router) {
		r.Use(middleware.Timeout(45 * time.Second))

		r.With(httpx.RateLimit(20)).Post("/auth/signup", a.signup)
		r.With(httpx.RateLimit(30)).Post("/auth/login", a.login)
		r.With(httpx.RateLimit(30)).Post("/auth/verify-email", a.verifyEmail)
		r.With(httpx.RateLimit(30)).Get("/auth/verify-email", a.verifyEmailLink)
		r.With(httpx.RateLimit(10)).Post("/auth/resend-verification", a.resendVerification)
		r.With(auth.Required).Get("/auth/me", a.me)

		r.Get("/meta", a.meta)
		r.Get("/catalog", a.catalog)
		r.Get("/destinations", a.destinations)
		r.Get("/destinations/{id}", a.destination)
		r.Get("/activities", a.activities)
		r.With(httpx.RateLimit(30)).Get("/activities/search", a.searchActivities)
		r.Get("/quiz", a.quiz)
		r.Get("/weather", a.weather)
		r.Get("/providers", a.providerStatus)
		r.Get("/places/autocomplete", a.placesAutocomplete)
		r.Get("/places/details", a.placesDetails)
		r.Get("/places/reverse", a.placesReverse)
		r.Get("/transport/hubs", a.transportHubs)
		r.Get("/places/hubs", a.transportHubs)
		r.Get("/guides/verified", a.verifiedGuides)

		r.Route("/v/{token}", func(r chi.Router) {
			r.Use(httpx.RateLimit(60))
			r.Get("/", a.vendorPage)
			r.Post("/reply", a.vendorReply)
			r.Post("/voice", a.vendorVoice)
		})

		r.Post("/payments/webhook", a.paymentsWebhook)
		r.With(httpx.RateLimit(120)).Post("/telegram/webhook", a.telegramWebhook)
		r.With(httpx.RateLimit(120)).Post("/api/telegram/webhook", a.telegramWebhook)

		r.Group(func(r chi.Router) {
			r.Use(auth.Required)

			r.Get("/profile", a.getProfile)
			r.Patch("/profile", a.patchProfile)
			r.Post("/profile/quiz", a.submitQuiz)
			r.Post("/profile/prep", a.togglePrep)
			r.Get("/profile/dna/history", a.dnaHistory)
			r.With(httpx.RateLimit(30)).Post("/assistant/ask", a.guide)
			r.With(httpx.RateLimit(30)).Get("/profile/recommendations", a.recommendations)

			r.With(httpx.RateLimit(10)).Post("/telegram/connect", a.telegramConnect)
			r.With(httpx.RateLimit(10)).Post("/telegram/link", a.telegramLinkDirect)
			r.Get("/telegram/status", a.telegramStatusHandler)
			r.Post("/telegram/disconnect", a.telegramDisconnect)
			r.With(httpx.RateLimit(5)).Post("/telegram/test", a.telegramTest)

			r.Get("/notifications", a.notifications)
			r.Post("/notifications/read-all", a.readAllNotifications)
			r.Post("/notifications/{id}/read", a.readNotification)

			r.Get("/trips", a.myTrips)
			r.Post("/trips", a.createTrip)
			r.Route("/trips/{id}", func(r chi.Router) {
				r.Get("/", a.getTrip)
				r.Patch("/", a.patchTrip)
				r.Delete("/", a.deleteTrip)
				r.Post("/items", a.addItem)
				r.Patch("/items/{itemId}", a.patchItem)
				r.Get("/alternatives", a.alternatives)
				r.Get("/stays", a.stayAlternatives)
				r.Post("/optimize", a.optimize)
				r.Post("/optimize-budget", a.optimizeBudget)
				r.Get("/price", a.price)

				r.Post("/promo", a.applyPromo)
				r.Delete("/promo", a.removePromo)
				r.Get("/insights", a.insights)
				r.Post("/book", a.book)
				r.Post("/pay/verify", a.verifyPayment)
				r.Get("/bookings", a.tripBookings)
				r.Post("/mood", a.proposeMood)
				r.Post("/mood/accept", a.acceptMood)
				r.Post("/message", a.message)
				r.Post("/voice", a.travelerVoice)
				r.Post("/review", a.review)
				r.Get("/incidents", a.tripIncidents)
				r.Post("/incidents", a.createIncident)
				r.Post("/reports", a.crowdReport)
				r.Get("/route", a.tripRoute)
				r.With(httpx.RateLimit(20)).Get("/days/{day}/route-plan", a.routePlan)
				r.Get("/delay-risk", a.delayRisk)
				r.Get("/documents", a.listDocuments)
				r.With(httpx.RateLimit(10)).Post("/documents", a.reissueDocuments)
				r.Get("/documents/{docId}", a.documentFile)
				r.Get("/chat", a.tripChat)
				r.With(httpx.RateLimit(30)).Post("/chat", a.sendTripChat)
				r.With(httpx.RateLimit(30)).Get("/flights", a.tripFlights)
			})
			r.With(httpx.RateLimit(60)).Get("/places", a.places)

			r.Get("/incidents/{id}", a.incident)
			r.Post("/incidents/{id}/agent", a.startAgent)
			r.Get("/agent/runs/{id}", a.agentRun)
			r.Get("/agent/runs/{id}/requests", a.agentRequests)

			r.Route("/ops", func(r chi.Router) {
				r.Use(auth.OperatorOnly)
				r.Get("/overview", a.overview)
				r.Get("/tours", a.tours)
				r.Get("/tours/{id}", a.tour)
				r.Patch("/tours/{id}/coordinator", a.assignCoordinator)
				r.Post("/tours/{id}/complete", a.completeTour)
				r.Get("/bookings", a.bookings)
				r.Patch("/bookings/{id}", a.bookingStatus)
				r.With(httpx.RateLimit(30)).Post("/bookings/{id}/resend", a.resendBooking)
				r.Get("/ai/decisions", a.aiDecisions)
				r.Get("/ai/model", a.aiModel)
				r.With(httpx.RateLimit(20)).Post("/ai/model/ask", a.askModel)
				r.Get("/customers", a.customers)
				r.Get("/team", a.team)
				r.Get("/ledger", a.ledger)
				r.Get("/vendors", a.vendors)
				r.Get("/vendors/{id}", a.vendor)
				r.Get("/vendors/{id}/reliability", a.vendorReliability)
				r.Patch("/vendors/{id}", a.updateVendor)
				r.Get("/requests", a.pendingRequests)
				r.With(httpx.RateLimit(60)).Post("/requests/{token}/answer", a.recordAnswer)
				r.Patch("/vendors/{id}/availability", a.vendorAvailability)
				r.Get("/incidents", a.incidents)
				r.Post("/incidents/{id}/resolve", a.resolveIncident)
				r.Get("/agent/runs", a.agentRuns)
				r.Post("/agent/runs/{id}/takeover", a.takeOver)
				r.Get("/scenarios", a.scenarios)
				r.Post("/simulate", a.simulate)
				r.Post("/simulate/fix", a.fixAll)
				r.With(httpx.RateLimit(30)).Post("/simulate/insight", a.simulateInsight)
				r.With(httpx.RateLimit(20)).Post("/ai/ask", a.askOps)
				r.Get("/inbox", a.inbox)
				r.Post("/inbox/{id}/messages", a.sendMessage)
				r.Post("/inbox/{id}/read", a.readThread)
				r.Get("/alerts", a.alerts)
				r.Post("/alerts/reports", a.guideReport)
				r.Post("/alerts/reports/{id}/verify", a.verifyReport)
				r.Post("/alerts/warnings/{id}/handoff", a.handOff)
			})

			r.Route("/admin", func(r chi.Router) {
				r.Use(auth.SuperAdminOnly)
				r.Get("/overview", a.adminOverview)
				r.Get("/guides", a.adminGuides)
				r.Get("/guides/{id}", a.adminGuide)
				r.With(httpx.RateLimit(60)).Post("/guides/{id}/verification", a.adminGuideVerification)
				r.Get("/accounts", a.adminAccounts)
				r.Get("/accounts/{id}", a.adminAccount)
				r.With(httpx.RateLimit(60)).Post("/accounts/{id}/status", a.adminAccountStatus)
			})
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.NotFound("No such endpoint."))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.E(http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed."))
	})
	return r
}

func (a *API) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	status, code := "ok", http.StatusOK
	if err := a.Core.Pool.Ping(ctx); err != nil {
		status, code = "database unreachable", http.StatusServiceUnavailable
	}
	httpx.JSON(w, code, map[string]any{"status": status, "time": a.Core.Now().UTC(), "ai": a.Core.AI.Engines(), "aiService": a.Core.AISvc.Status(),
		"email": a.Core.Mailer != nil && a.Core.Mailer.Delivers(), "sockets": a.Core.Hub.Clients()})
}

func (a *API) websocket(w http.ResponseWriter, r *http.Request) {
	p, ok := auth.From(r.Context())
	if !ok {
		httpx.Fail(w, r, httpx.Unauthorized("Pass ?token= to open the live connection."))
		return
	}
	a.Core.Hub.Serve(w, r, p.UserID, p.Role)
}
