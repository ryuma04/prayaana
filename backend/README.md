# Prayaana API (Go)

The high-performance core backend for Prayaana: Karnataka itinerary planning, pricing parity engine, booking orchestration, the Change Impact DAG engine, remedy plan generation, and all-or-nothing vendor confirmation protocol.

## Run

```bash
cd backend
cp .env.example .env        # Set DATABASE_URL (PostgreSQL/Neon), JWT_SECRET, GROQ_API_KEY, GEMINI_API_KEY
go run ./cmd/api            # Automatically migrates, seeds the Karnataka demo world, serves on :8080
```

Other commands:
- `go run ./cmd/api migrate`: Run database migrations
- `go run ./cmd/api seed`: Seed Karnataka catalog and demo trips
- `go run ./cmd/api reset`: Rebuild the demo world around today's date

Demo accounts (password `demo1234`):
- Traveler: `rahul@prayaana.demo`
- Operator: `ops@saffrontrails.demo`

Tests:
```bash
go test ./...
```

## Architecture & Layout

```
cmd/api            Entry point, routing, graceful shutdown, restart recovery
internal/domain    Core domain types matching frontend/types/index.ts
internal/engine    Pure trip calculation logic, ported 1:1 with frontend parity tests
internal/catalog   In-memory Karnataka destinations, activities, stays, transports, vendors
internal/store     PostgreSQL pgx store with transaction support
internal/ai        Groq + Gemini multi-provider interface, circuit breaker, rule fallbacks
internal/auth      Signup/login, email verification, lockout, JWT, role middleware
internal/mail      Resend/SMTP mailer with responsive HTML templates
internal/trips     Create, edit, price, promo, schedule optimization, mood filtering
internal/booking   Orders, simulated/Razorpay payments, bookings, financial ledger
internal/incidents Problems, Change Impact graph, 3 fix plans, What-If simulator
internal/confirm   All-or-nothing vendor confirmation rounds with undo capability
internal/agent     Trip Fixer Agent with live persisted incident timeline
internal/vendorlink Out-of-band vendor communication: web links, interactive buttons, WhatsApp
internal/ops       Operator console analytics and incident overview
internal/seed      Karnataka catalog (16 destinations, 58 activities, 28 stays, 22 transports, 69 vendors)
internal/platform  Database, HTTP helpers, WebSocket hub for real-time sync
```

## Vendor Protocol

Vendors (drivers, homestays, coracle pilots, guides) do not need to download an app or create an account. When an itinerary change is needed, they receive an interactive single-use link or WhatsApp message with `[Yes]` `[No]` `[Other Time]` buttons. When everyone confirms, Prayaana executes an atomic commit. If any key vendor declines, the system safely rolls back and evaluates Plan B.
