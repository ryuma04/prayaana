package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"trizpyy/internal/admin"
	"trizpyy/internal/agent"
	"trizpyy/internal/ai"
	"trizpyy/internal/aisvc"
	"trizpyy/internal/api"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/booking"
	"trizpyy/internal/catalog"
	"trizpyy/internal/config"
	"trizpyy/internal/confirm"
	"trizpyy/internal/decision"
	"trizpyy/internal/documents"
	"trizpyy/internal/engine"
	"trizpyy/internal/incidents"
	"trizpyy/internal/jobs"
	"trizpyy/internal/learning"
	"trizpyy/internal/mail"
	"trizpyy/internal/ops"
	"trizpyy/internal/platform/db"
	"trizpyy/internal/platform/realtime"
	"trizpyy/internal/profile"
	"trizpyy/internal/providers"
	"trizpyy/internal/seed"
	"trizpyy/internal/store"
	"trizpyy/internal/telegram"
	"trizpyy/internal/trips"
	"trizpyy/internal/vendorlink"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	if err := run(cmd); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(cmd string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}
	if cmd == "migrate" {
		slog.Info("migrations applied")
		return nil
	}

	st := store.New(pool)
	data, err := seed.Catalog()
	if err != nil {
		return err
	}
	var providers []ai.Provider
	// Trizpyy's Nugen-aligned domain model answers travelers first; Groq and Gemini back it up.
	if n := ai.NewNugen(cfg.NugenAPIKey, cfg.NugenModelID, cfg.NugenBaseURL); n != nil {
		providers = append(providers, n)
	}
	if len(cfg.GroqKeys) > 0 {
		providers = append(providers, ai.NewGroq(cfg.GroqKeys, cfg.GroqBaseURL, cfg.GroqFastModel, cfg.GroqAgentModel, cfg.GroqWhisperModel))
	}
	if len(cfg.GeminiKeys) > 0 {
		providers = append(providers, ai.NewGemini(cfg.GeminiKeys, cfg.GeminiBaseURL, cfg.GeminiModel))
	}
	mailer := mail.New(mail.Config{From: cfg.EmailFrom, ResendKey: cfg.ResendKey, SMTPHost: cfg.SMTPHost, SMTPPort: cfg.SMTPPort,
		SMTPUser: cfg.SMTPUser, SMTPPass: cfg.SMTPPass})
	core := &app.Core{Cfg: cfg, Pool: pool, Store: st, Hub: realtime.NewHub(cfg.CORSOrigins), Mailer: mailer, Now: time.Now}
	core.Telegram = telegram.New(telegram.Config{Token: cfg.TelegramBotToken, Username: cfg.TelegramBotUsername,
		BaseURL: cfg.TelegramAPIBaseURL, Mode: cfg.TelegramMode})
	core.AI = ai.NewService(providers, cfg.AITimeout, st, engine.RandomID)
	core.AISvc = aisvc.New(cfg.AIServiceURL, cfg.AIServiceTimeout)
	core.NugenSearch = ai.NewNugenSearch(cfg.NugenAPIKey, cfg.NugenBaseURL)
	// Jev is not connected (its runtime API is unverified), so decisions go to the LLM, then rules.
	core.Decisions = decision.New(0.6, &decision.JevProvider{}, &decision.LLMProvider{AI: core.AI})

	seeder := seed.NewSeeder(core, data)
	if err := seeder.Catalog(ctx); err != nil {
		return fmt.Errorf("seed catalog: %w", err)
	}
	cat, err := st.LoadCatalog(ctx, data.Quiz)
	if err != nil {
		return fmt.Errorf("load catalog: %w", err)
	}
	core.Eng = engine.New(cat, core.Today)
	geo := newGeo(cfg, cat, core.Today)
	core.Eng.Live = geo.Weather.Lookup

	if err := seeder.OperatorAccount(ctx, cfg.OperatorName, cfg.OperatorEmail, cfg.OperatorPassword); err != nil {
		return fmt.Errorf("operator login: %w", err)
	}
	if err := seeder.TravelerAccount(ctx, "Rahul Sharma", "rahul@trizpyy.demo", "demo1234", "+919876543210"); err != nil {
		return fmt.Errorf("traveler login: %w", err)
	}
	adminSvc := admin.New(core)
	if err := adminSvc.EnsureAccount(ctx); err != nil {
		return fmt.Errorf("super admin login: %w", err)
	}
	switch cmd {
	case "seed":
		return nil
	case "demo":
		// go run ./cmd/api demo          adds 3 demo trips with open problems
		// go run ./cmd/api demo remove   deletes them again
		if len(os.Args) > 2 && os.Args[2] == "remove" {
			return seeder.RemoveDemo(ctx)
		}
		return seeder.Demo(ctx)
	case "telegram":
		if len(os.Args) < 3 {
			return fmt.Errorf("usage: go run ./cmd/api telegram <chat_id_or_phone_or_email> [message]")
		}
		target := os.Args[2]
		msg := "👋 Test message from Trizpyy CLI"
		if len(os.Args) > 3 {
			msg = strings.Join(os.Args[3:], " ")
		}
		if !core.Telegram.Enabled() {
			return fmt.Errorf("telegram client is not enabled: check TELEGRAM_BOT_TOKEN in .env")
		}
		var chatID int64
		if id, err := strconv.ParseInt(target, 10, 64); err == nil && id != 0 {
			chatID = id
		} else {
			conn, err := st.TelegramConnectionByPhoneOrEmail(ctx, target)
			if err != nil {
				return fmt.Errorf("no linked Telegram chat found for %q: %w", target, err)
			}
			chatID = conn.ChatID
		}
		slog.Info("sending telegram message", "chatId", chatID, "text", msg)
		if err := core.Telegram.SendMessage(ctx, chatID, msg); err != nil {
			return fmt.Errorf("telegram send failed: %w", err)
		}
		slog.Info("telegram message successfully delivered", "chatId", chatID)
		return nil
	case "serve":
	default:
		return fmt.Errorf("unknown command %q (use serve, migrate, seed or telegram)", cmd)
	}
	if runs, err := st.FailInterruptedRuns(ctx); err != nil {
		return err
	} else if len(runs) > 0 {
		slog.Warn("closed agent runs interrupted by restart", "count", len(runs))
		for _, r := range runs {
			status := "escalated"
			_ = st.UpdateIncident(ctx, r.IncidentID, store.IncidentPatch{Status: &status})
		}
	}
	if err := st.CloseStaleRounds(ctx); err != nil {
		return err
	}

	docSvc := documents.New(core)
	core.Docs = docSvc
	authSvc := auth.New(core, mailer)
	learnSvc := learning.New(core)
	tripSvc := trips.New(core)
	tripSvc.Learn = learnSvc
	confirmSvc := confirm.New(core)
	agentSvc := agent.New(core, confirmSvc)
	agentSvc.Learn = learnSvc
	bookingSvc := booking.New(core, tripSvc)
	incidentSvc := incidents.New(core, tripSvc, agentSvc)
	apiService := &api.API{
		Core: core, Auth: authSvc, Trips: tripSvc, Booking: bookingSvc, Incidents: incidentSvc, Agent: agentSvc, Documents: docSvc,
		Ops: ops.New(core, incidentSvc, agentSvc), Profile: profile.New(core), Learning: learnSvc, Vendors: vendorlink.New(core, confirmSvc, bookingSvc),
		Geo: geo, Admin: adminSvc,
	}
	handler := apiService.Router()

	workers, cancelWorkers := context.WithCancel(context.Background())
	defer cancelWorkers()
	go confirmSvc.RunSweeper(workers)
	go adminSvc.Run(workers)
	go tripSvc.RunProgress(workers)
	go jobs.Trust(workers, core)
	go jobs.Semantic(workers, core)
	if cfg.LiveProviders {
		go geo.Weather.Run(workers, cfg.WeatherRefresh)
		if cfg.RatingsEnabled {
			go jobs.Ratings(workers, core, geo.Places)
		}
	}
	if core.Telegram.Enabled() && !core.Telegram.Mock() {
		if strings.HasPrefix(strings.ToLower(cfg.PublicAPI), "https://") {
			webhookURL := strings.TrimRight(cfg.PublicAPI, "/") + "/api/telegram/webhook"
			regCtx, cancel := context.WithTimeout(workers, 15*time.Second)
			if err := core.Telegram.SetWebhook(regCtx, webhookURL, cfg.TelegramWebhookSecret); err != nil {
				slog.Error("failed to register telegram webhook", "url", webhookURL, "err", err)
			} else {
				slog.Info("telegram webhook registered", "url", webhookURL)
			}
			cancel()
		} else {
			// In local development (HTTP), clear any conflicting webhook and run the background poller.
			delCtx, cancel := context.WithTimeout(workers, 15*time.Second)
			if err := core.Telegram.DeleteWebhook(delCtx, false); err != nil {
				slog.Warn("failed to clear telegram webhook for local polling", "err", err)
			}
			cancel()
			go apiService.RunTelegramPoller(workers)
		}
	}

	srv := &http.Server{
		Addr: ":" + cfg.Port, Handler: handler, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 60 * time.Second,
		IdleTimeout: 120 * time.Second, MaxHeaderBytes: 1 << 20,
	}
	errc := make(chan error, 1)
	go func() {
		slog.Info("trizpyy api listening", "addr", srv.Addr, "env", cfg.Env, "ai", core.AI.Engines(), "email", mailer.Delivers(), "verifyEmail", cfg.RequireEmailVerification && mailer.Delivers(),
			"payments", map[bool]string{true: "razorpay", false: "not configured"}[cfg.RazorpayKeyID != ""],
			"telegram", core.Telegram.Enabled(),
			"liveData", cfg.LiveProviders, "flights", geo.Flights.Provider(), "places", geo.Places.Enabled())
		errc <- srv.ListenAndServe()
	}()
	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
	agentSvc.Wait(10 * time.Second)
	cancelWorkers()
	return nil
}

// newGeo builds the outside data providers. With LIVE_PROVIDERS=false (or no keys)
// every screen still works on the climate model, straight-line routes and the timetable.
func newGeo(cfg config.Config, cat *catalog.Catalog, today func() string) api.Geo {
	points := make([]providers.Point, 0, len(cat.Destinations))
	for _, d := range cat.Destinations {
		points = append(points, providers.Point{ID: d.ID, Lat: d.Lat, Lng: d.Lng})
	}
	geo := api.Geo{
		Weather: providers.NewWeather(cfg.OpenMeteoURL, cfg.Location.String(), points, cfg.ProviderTimeout),
		Router:  providers.NewRouter("", cfg.ProviderTimeout),
		Places:  providers.NewPlaces(cfg.GooglePlacesURL, "", cfg.ProviderTimeout),
	}
	var live providers.FlightProvider
	if cfg.LiveProviders {
		geo.Router = providers.NewRouter(cfg.OSRMURL, cfg.ProviderTimeout)
		geo.Places = providers.NewPlaces(cfg.GooglePlacesURL, cfg.GooglePlacesKey, cfg.ProviderTimeout)
		if cfg.AviationstackKey != "" {
			live = providers.NewAviationstack(cfg.AviationstackURL, cfg.AviationstackKey, cfg.ProviderTimeout)
		}
	}
	geo.Flights = providers.NewFlights(live, cfg.AviationstackTTL, cfg.AviationstackDaily, today)
	return geo
}
