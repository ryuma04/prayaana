# Trizpyy API (Go)

The backend for Trizpyy: trip planning, pricing, booking, the Change Impact engine,
3 fix plans, all-or-nothing vendor confirmation and the Trip Fixer Agent.

## Run

```bash
cd backend
cp .env.example .env        # paste DATABASE_URL (Neon), JWT_SECRET, GROQ_API_KEY, GEMINI_API_KEY
go run ./cmd/api            # migrates, seeds the demo world, serves on :8080
```

Other commands: `go run ./cmd/api migrate` · `seed` · `reset` (rebuild the demo world around today).

Demo accounts (password `demo1234`): traveler `rahul@trizpyy.demo`, operator `ops@saffrontrails.demo`.

Tests: `go test ./...` (engine parity with the frontend, AI fallbacks, realtime) and
`python scripts/smoke_test.py http://localhost:8080` (86 end-to-end checks on a freshly seeded server).

## Roles

Only two logins: **traveler** and **operator**. Vendors never log in — they answer through
WhatsApp buttons/voice notes or the public `/v/{token}` link. Coordinators are team records
the operator assigns to tours.

## Layout

```
cmd/api            entry point, wiring, graceful shutdown, restart recovery
internal/domain    shared types (JSON matches frontend/types/index.ts)
internal/engine    pure trip logic, ported 1:1 from the frontend and parity-tested
internal/catalog   in-memory snapshot of destinations, experiences, stays, vendors
internal/store     Postgres repositories (pgx), usable inside transactions
internal/ai        Groq + Gemini behind one interface, strict JSON, cache, circuit breaker, rule fallbacks
internal/auth      signup/login, validation, email verification, lockout, JWT, role middleware
internal/mail      Resend/SMTP mailer and the branded HTML email templates
internal/trips     create, edit, price, promo, optimize, mood, review
internal/booking   orders, Razorpay/simulated payments, bookings, ledger, vendor booking requests
internal/incidents problems, impact map, fix plans, What-If simulator
internal/confirm   all-or-nothing confirmation rounds, timers, undo
internal/agent     Trip Fixer Agent runner with a live, persisted timeline
internal/vendorlink vendor replies: web link, buttons, voice notes, WhatsApp webhook
internal/ops       operator console data
internal/seed      catalog + demo world
internal/platform  db, http helpers, websocket hub
```

## Reliability

- Trips are saved as whole aggregates under a row lock with an optimistic `version`, so an
  agent commit never overwrites a traveler's edit.
- A plan is applied only after every vendor says yes, in one transaction with its Change
  Receipt, ledger entry and booking updates. Any no or timeout rolls the round back.
- Each AI call has a timeout and a strict schema, and falls back to rules, so every feature
  works with no keys at all. Multiple Groq/Gemini keys rotate round-robin; a key that is rate-limited
  or failing rests for a cooldown, and Gemini takes over if every Groq key is resting.
- On restart, agent runs and confirmation rounds that were in flight are closed safely and
  the incident is handed to a human.
- Payments are idempotent and verified (Razorpay HMAC) before a trip is booked.

## WhatsApp booking confirmation

At checkout the traveler can consent to WhatsApp updates. After a verified payment commits, Trizpyy always records the confirmation in the in-app trip thread and then sends an approved Meta utility template to the saved mobile number when WhatsApp is configured. Delivery failures are logged and never undo a paid booking.

Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`, then approve the utility template named by `WHATSAPP_BOOKING_TEMPLATE` (default: `trip_booking_confirmation`). Its body should use six variables in this order:

```
Hi {{1}}! 🎉 Your Trizpyy trip is booked.

Booking {{2}} · {{3}}
Departure: {{4}}
Paid: {{5}}

Our partners are confirming the details now. Your itinerary, vouchers and live updates are waiting here: {{6}}

We can't wait to help make this one unforgettable. ✨
```

## API

Auth: `POST /auth/signup` · `POST /auth/login` · `GET /auth/me` · `POST /auth/verify-email` (token or email+code) ·
`GET /auth/verify-email?token=` (email button; redirects to the web app) · `POST /auth/resend-verification`

Signup validates name, email, password strength (8–72 chars, letters and numbers, not common, not your name/email)
and optional phone, returning per-field errors. New travelers confirm their email with a 6-digit code or link
(24 h, 5 tries, single use, 60 s resend cooldown) before they can log in. Five wrong passwords lock the account
for 15 minutes.

Public: `GET /meta` · `GET /destinations?q=&interests=` · `GET /destinations/{id}` ·
`GET /activities?destination=` · `GET /quiz` · `GET /v/{token}` · `POST /v/{token}/reply` ·
`POST /v/{token}/voice` · `GET|POST /whatsapp/webhook` · `POST /payments/webhook` · `GET /healthz`

Traveler (own trips) and operator:
`GET|PATCH /profile` · `POST /profile/quiz` · `POST /profile/prep` · `GET /notifications` ·
`GET|POST /trips` · `GET|PATCH|DELETE /trips/{id}` · `POST /trips/{id}/items` ·
`PATCH /trips/{id}/items/{itemId}` (`op`: heart, remove, move, time, qty, swap) ·
`GET /trips/{id}/alternatives?item=` · `GET /trips/{id}/stays` · `POST /trips/{id}/optimize` ·
`GET /trips/{id}/price` · `POST|DELETE /trips/{id}/promo` · `GET /trips/{id}/insights` ·
`POST /trips/{id}/book` · `POST /trips/{id}/pay/verify` · `GET /trips/{id}/bookings` ·
`POST /trips/{id}/mood` · `POST /trips/{id}/mood/accept` · `POST /trips/{id}/message` ·
`POST /trips/{id}/voice` · `POST /trips/{id}/review` · `POST /trips/{id}/start` ·
`GET|POST /trips/{id}/incidents` · `POST /trips/{id}/reports` · `GET /incidents/{id}` ·
`POST /incidents/{id}/agent` · `GET /agent/runs/{id}` · `GET /agent/runs/{id}/requests`

Operator: `GET /ops/overview` · `/ops/tours` · `/ops/tours/{id}` · `PATCH /ops/tours/{id}/coordinator` ·
`/ops/bookings?status=` · `PATCH /ops/bookings/{id}` · `/ops/customers` · `/ops/team` · `/ops/ledger` · `/ops/vendors` ·
`/ops/vendors/{id}` · `PATCH /ops/vendors/{id}/availability` · `/ops/incidents` · `POST /ops/incidents/{id}/resolve` · `/ops/agent/runs` ·
`POST /ops/agent/runs/{id}/takeover` · `/ops/scenarios` · `POST /ops/simulate` · `POST /ops/simulate/fix` (preset `scenarioId` or a custom `scenario`) ·
`/ops/inbox` · `POST /ops/inbox/{id}/messages` · `POST /ops/inbox/{id}/read` · `/ops/alerts` ·
`POST /ops/alerts/reports/{id}/verify` · `POST /ops/alerts/warnings/{id}/handoff` · `POST /ops/demo/reset`

Realtime: `GET /ws?token=<jwt>` streams `trip.updated`, `booking.status`, `incident.created`,
`incident.updated`, `agent.step`, `confirm.progress`, `confirm.saved`, `confirm.undone`,
`notice.new`, `inbox.message`, `alert.new`, `alert.verified`, `vendor.updated`.
Errors are always `{"error": {"code": "...", "message": "..."}}` with a matching HTTP status.
