package config

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/joho/godotenv"
)

type Config struct {
	Env         string
	Port        string
	DatabaseURL string
	DBMaxConns  int32
	JWTSecret   string
	JWTTTL      time.Duration
	CORSOrigins []string
	Location    *time.Location
	PublicWeb   string
	PublicAPI   string

	// The operator's staff login, created on first start if it does not exist.
	OperatorName     string
	OperatorEmail    string
	OperatorPassword string

	// The platform Super Admin login (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD). Server-side only;
	// with either unset there is no Super Admin and any earlier one is disabled.
	SuperAdminEmail    string
	SuperAdminPassword string

	RequireEmailVerification bool
	EmailFrom                string
	ResendKey                string
	SMTPHost                 string
	SMTPPort                 string
	SMTPUser                 string
	SMTPPass                 string

	AgentStepDelay time.Duration
	ConfirmTimeout time.Duration

	AITimeout        time.Duration
	GroqKeys         []string
	GroqBaseURL      string
	GroqFastModel    string
	GroqAgentModel   string
	GroqWhisperModel string
	GeminiKeys       []string
	GeminiBaseURL    string
	GeminiModel      string

	GooglePlacesKey  string
	AviationstackKey string

	// Outside data services (§20). LiveProviders=false keeps everything on the
	// built-in climate model, straight-line routes and the timetable (offline demos, tests).
	LiveProviders      bool
	ProviderTimeout    time.Duration
	OpenMeteoURL       string
	WeatherRefresh     time.Duration
	OSRMURL            string
	GooglePlacesURL    string
	AviationstackURL   string
	AviationstackDaily int
	AviationstackTTL   time.Duration

	// Nugen serves Trizpyy's domain model (aligned on the Trizpyy corpus, see services/nugen).
	NugenAPIKey  string
	NugenModelID string
	NugenBaseURL string
	// NugenAlignmentID is the alignment project behind the model (shown to operators).
	NugenAlignmentID string

	// AIServiceURL is the Python AI service (services/ai); empty turns it off and Go uses its rules.
	AIServiceURL     string
	AIServiceTimeout time.Duration

	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string

	// Telegram Bot API (@TrizpyyBot) provides customer-facing
	// delivery: a linked traveler gets the booking confirmation and trip PDFs.
	// TELEGRAM_MODE=mock logs sends instead of calling the real API.
	TelegramBotToken      string
	TelegramBotUsername   string
	TelegramAPIBaseURL    string
	TelegramMode          string
	TelegramWebhookSecret string
	TelegramDefaultChatID int64

	// Background jobs.
	WarningInterval time.Duration // weather early-warning scan of booked and live trips
	RatingsEnabled  bool          // look up real Google Maps ratings for the catalog
}

func (c Config) Production() bool { return c.Env == "production" }

// Load reads .env (if present) then the environment. Several aliases are accepted
// for each secret so keys pasted from provider dashboards work as-is.
func Load() (Config, error) {
	_ = godotenv.Load()
	c := Config{
		Env:                      strings.ToLower(first("development", "APP_ENV", "ENV", "GO_ENV")),
		Port:                     first("8080", "PORT"),
		DatabaseURL:              unquote(first("", "DATABASE_URL", "NEON_DATABASE_URL", "NEONDB_URL", "NEON_URL", "POSTGRES_URL", "PG_URL")),
		DBMaxConns:               int32(intOf(first("10", "DB_MAX_CONNS"), 10)),
		JWTSecret:                first("", "JWT_SECRET", "AUTH_SECRET"),
		JWTTTL:                   durOf(first("168h", "JWT_TTL"), 168*time.Hour),
		CORSOrigins:              list(first("http://localhost:3000,http://127.0.0.1:3000", "CORS_ORIGINS", "FRONTEND_URL")),
		PublicWeb:                strings.TrimRight(first("http://localhost:3000", "PUBLIC_WEB_URL", "FRONTEND_URL"), "/"),
		PublicAPI:                strings.TrimRight(first("", "PUBLIC_API_URL"), "/"),
		OperatorName:             first("Ananya Rao", "OPERATOR_NAME"),
		OperatorEmail:            first("ops@saffrontrails.demo", "OPERATOR_EMAIL"),
		OperatorPassword:         first("demo1234", "OPERATOR_PASSWORD", "DEMO_PASSWORD"),
		SuperAdminEmail:          first("", "SUPER_ADMIN_EMAIL"),
		SuperAdminPassword:       os.Getenv("SUPER_ADMIN_PASSWORD"),
		RequireEmailVerification: boolOf(first("true", "REQUIRE_EMAIL_VERIFICATION")),
		EmailFrom:                first("Trizpyy <onboarding@resend.dev>", "EMAIL_FROM"),
		ResendKey:                unquote(first("", "RESEND_API_KEY")),
		SMTPHost:                 first("", "SMTP_HOST"),
		SMTPPort:                 first("587", "SMTP_PORT"),
		SMTPUser:                 first("", "SMTP_USER", "SMTP_USERNAME"),
		SMTPPass:                 unquote(first("", "SMTP_PASS", "SMTP_PASSWORD")),
		AgentStepDelay:           durOf(first("700ms", "AGENT_STEP_DELAY"), 700*time.Millisecond),
		ConfirmTimeout:           durOf(first("10m", "CONFIRM_TIMEOUT"), 10*time.Minute),
		AITimeout:                durOf(first("12s", "AI_TIMEOUT"), 12*time.Second),
		GroqBaseURL:              strings.TrimRight(first("https://api.groq.com/openai/v1", "GROQ_BASE_URL", "GROQ_URL"), "/"),
		GroqFastModel:            first("openai/gpt-oss-20b", "GROQ_FAST_MODEL"),
		GroqAgentModel:           first("openai/gpt-oss-120b", "GROQ_AGENT_MODEL", "GROQ_MODEL"),
		GroqWhisperModel:         first("whisper-large-v3-turbo", "GROQ_WHISPER_MODEL"),
		GeminiBaseURL:            strings.TrimRight(first("https://generativelanguage.googleapis.com/v1beta", "GEMINI_BASE_URL", "GEMINI_URL"), "/"),
		GeminiModel:              first("gemini-3.8-flash", "GEMINI_MODEL"),
		NugenAPIKey:              first("", "NUGEN_API_KEY"),
		NugenModelID:             first("", "NUGEN_MODEL_ID"),
		NugenBaseURL:             first("https://api.nugen.in", "NUGEN_BASE_URL"),
		NugenAlignmentID:         first("", "NUGEN_ALIGNMENT_ID"),
		AIServiceURL:             first("", "AI_SERVICE_URL"),
		AIServiceTimeout:         durOf(first("4s", "AI_SERVICE_TIMEOUT"), 4*time.Second),
		RazorpayKeyID:            first("", "RAZORPAY_KEY_ID"),
		RazorpayKeySecret:        first("", "RAZORPAY_KEY_SECRET"),
		RazorpayWebhookSecret:    first("", "RAZORPAY_WEBHOOK_SECRET"),
		TelegramBotToken:         unquote(first("", "TELEGRAM_BOT_TOKEN")),
		TelegramBotUsername:      strings.TrimPrefix(first("TrizpyyBot", "TELEGRAM_BOT_USERNAME"), "@"),
		TelegramAPIBaseURL:       strings.TrimRight(first("https://api.telegram.org", "TELEGRAM_API_BASE_URL"), "/"),
		TelegramMode:             strings.ToLower(first("telegram", "TELEGRAM_MODE")),
		TelegramWebhookSecret:    unquote(first("", "TELEGRAM_WEBHOOK_SECRET")),
		TelegramDefaultChatID:    int64Of(first("5481196704", "DEFAULT_TELEGRAM_CHAT_ID", "TELEGRAM_DEFAULT_CHAT_ID"), 5481196704),
		WarningInterval:          durOf(first("30m", "WARNING_INTERVAL"), 30*time.Minute),
		RatingsEnabled:           boolOf(first("true", "GOOGLE_RATINGS")),
	}
	c.GooglePlacesKey = unquote(first("", "GOOGLE_PLACES_API_KEY", "GOOGLE_PLACES_API", "GOOGLE_MAPS_API_KEY"))
	c.AviationstackKey = unquote(first("", "AVIATIONSTACK_API_KEY", "AVIATIONSTACK_KEY"))
	c.LiveProviders = boolOf(first("true", "LIVE_PROVIDERS"))
	c.ProviderTimeout = durOf(first("8s", "PROVIDER_TIMEOUT"), 8*time.Second)
	c.OpenMeteoURL = strings.TrimRight(first("https://api.open-meteo.com/v1", "OPEN_METEO_URL"), "/")
	c.WeatherRefresh = durOf(first("30m", "WEATHER_REFRESH"), 30*time.Minute)
	c.OSRMURL = strings.TrimRight(first("https://router.project-osrm.org", "OSRM_URL"), "/")
	c.GooglePlacesURL = strings.TrimRight(first("https://places.googleapis.com/v1", "GOOGLE_PLACES_URL"), "/")
	// The Aviationstack free plan only serves plain HTTP; paid plans can use https://.
	c.AviationstackURL = strings.TrimRight(first("http://api.aviationstack.com/v1", "AVIATIONSTACK_URL"), "/")
	c.AviationstackDaily = intOf(first("15", "AVIATIONSTACK_DAILY_LIMIT"), 15)
	c.AviationstackTTL = durOf(first("3h", "AVIATIONSTACK_CACHE_TTL"), 3*time.Hour)
	c.GroqKeys = keys("GROQ_API_KEY", "GROQ_KEY")
	c.GeminiKeys = keys("GEMINI_API_KEY", "GEMINI_KEY", "GOOGLE_API_KEY")
	tz := first("Asia/Kolkata", "TIMEZONE", "TZ")
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return c, fmt.Errorf("TIMEZONE %q: %w", tz, err)
	}
	c.Location = loc
	if err := c.Validate(); err != nil {
		return c, err
	}
	return c, nil
}

// Validate checks that required secrets and URLs are present and consistent.
func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required (your Neon connection string)")
	}
	if c.JWTSecret == "" {
		if c.Production() {
			return errors.New("JWT_SECRET is required in production")
		}
		c.JWTSecret = randomSecret()
		slog.Warn("JWT_SECRET not set; using a random one, so sessions reset on restart")
	}
	if c.Production() && len(c.JWTSecret) < 32 {
		return errors.New("JWT_SECRET must be at least 32 characters in production")
	}
	if c.Production() && c.OperatorPassword == "demo1234" {
		return errors.New("set OPERATOR_PASSWORD in production")
	}
	if c.TelegramMode == "telegram" && c.TelegramBotToken != "" && c.TelegramWebhookSecret == "" {
		return errors.New("TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_MODE is 'telegram'")
	}
	if c.PublicAPI == "" {
		c.PublicAPI = "http://localhost:" + c.Port
	}
	return nil
}

// keys gathers NAME, NAME_1..NAME_9 and a comma-separated NAMES for key rotation.
func keys(names ...string) []string {
	var out []string
	add := func(v string) {
		for _, k := range strings.Split(v, ",") {
			if k = unquote(k); k != "" {
				out = append(out, k)
			}
		}
	}
	for _, n := range names {
		add(os.Getenv(n))
		add(os.Getenv(n + "S"))
		for i := 1; i <= 9; i++ {
			add(os.Getenv(fmt.Sprintf("%s_%d", n, i)))
		}
	}
	return out
}

func first(def string, keys ...string) string {
	for _, k := range keys {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
	}
	return def
}

// unquote tolerates values pasted with surrounding quotes or a "psql " prefix.
func unquote(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "psql ")
	return strings.Trim(v, `"'`)
}

func list(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimRight(strings.TrimSpace(p), "/"); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func intOf(v string, def int) int {
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func int64Of(v string, def int64) int64 {
	n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func durOf(v string, def time.Duration) time.Duration {
	d, err := time.ParseDuration(v)
	if err != nil || d < 0 {
		return def
	}
	return d
}

func boolOf(v string) bool {
	b, err := strconv.ParseBool(v)
	return err == nil && b
}

func randomSecret() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
