# Trizpyy — What We Built (Project Guide)

> **Read this to understand and explain Trizpyy.** It describes only what is really in the code today,
> in very simple words. Our full vision and plan is in `allaboutourproject.md`; this file says which parts
> of that plan are **built**, which are **partly built**, and which are **planned for Phase 2**.
>
> **Keep it updated:** every time a phase or a big feature is finished, update the tables and the
> "Change log" at the bottom.

**Last updated:** 26 September 2026 · **Phase 1 status:** see [Section 13](#13-phase-1-checklist-and-honest-status)

---

## Contents

1. [Trizpyy in one minute](#1-trizpyy-in-one-minute)
2. [How to run it](#2-how-to-run-it)
3. [The big picture (how the parts talk)](#3-the-big-picture-how-the-parts-talk)
4. [What the traveler can do](#4-what-the-traveler-can-do)
5. [What the operator can do](#5-what-the-operator-can-do)
6. [What the vendor can do](#6-what-the-vendor-can-do)
7. [How the smart parts work (simple words)](#7-how-the-smart-parts-work-simple-words)
8. [Where AI is used (and where it is not)](#8-where-ai-is-used-and-where-it-is-not)
9. [Outside services: real, fallback or not used](#9-outside-services-real-fallback-or-not-used)
10. [Documents (PDFs) and WhatsApp messages](#10-documents-pdfs-and-whatsapp-messages)
11. [Live updates (WebSockets)](#11-live-updates-websockets)
12. [The database in simple words](#12-the-database-in-simple-words)
13. [Phase 1 checklist and honest status](#13-phase-1-checklist-and-honest-status)
14. [What is NOT built yet (Phase 2)](#14-what-is-not-built-yet-phase-2)
15. [How we tested it](#15-how-we-tested-it)
16. [Safety, security and reliability](#16-safety-security-and-reliability)
17. [Judge questions: honest, confident answers](#17-judge-questions-honest-confident-answers)
18. [Folder map](#18-folder-map)
19. [Change log](#19-change-log)

---

## 1. Trizpyy in one minute

Trizpyy is **one app with two sides**:

- **Travelers** build their own trip (not a fixed package), change anything, see the price change live,
  pay, get their documents, and get help during the trip.
- **Tour operators** see every trip in one place, get told what needs attention, and let our
  **Trip Fixer** repair a broken trip.

**Our USP:** *a broken trip fixes itself.* When something goes wrong (rain, a closed road, a vendor who
can't come), Trizpyy finds what breaks, makes 3 fix plans, asks every affected vendor, and changes the trip
**only when every vendor says yes**. The traveler gets a plain-words message, a Change Receipt and
updated PDFs.

---

## 2. How to run it

You need: Go (1.26+), Node.js 22, and a Postgres database (we use **Neon**, free).

```bash
# 1. Backend (Go API) — http://localhost:8080
cd backend
cp .env.example .env        # paste DATABASE_URL and the keys you have
go run ./cmd/api            # creates the tables, loads demo data, starts the server

# 2. Frontend (Next.js) — http://localhost:3000
cd frontend
npm ci
npm run dev
```

Or run everything with Docker: `docker compose up --build` (from the project root).

**Demo logins** (password `demo1234`):

| Who | Email |
|---|---|
| Traveler | `rahul@trizpyy.demo` |
| Tour operator | `ops@saffrontrails.demo` (use the **Tour operator** tab on the login page) |

**No keys?** Everything still works. Each outside service has a built-in fallback (see Section 9).

---

## 3. The big picture (how the parts talk)

```
   Traveler app            Operator console          Vendor reply page
   (Next.js, phone-first)  (Next.js, same look)      (/v/{token}, no login)
            \                     |                        /
             \______  HTTPS (REST) + WebSocket (live) ____/
                                  |
                    +-----------------------------+
                    |      Go backend (one API)   |
                    |  auth · trips · pricing ·   |
                    |  booking · payments ·       |
                    |  impact · fix plans ·       |
                    |  confirmation · agent ·     |
                    |  documents · WhatsApp ·     |
                    |  weather · routes · flights |
                    |  · places · live events     |
                    +-----------------------------+
                      |            |            |
               PostgreSQL     AI (Groq,     Outside data
               (Neon)         Gemini)       (Open-Meteo, OSRM,
                                            Aviationstack, Google Places,
                                            OpenFreeMap map tiles, Razorpay)
```

**Simple rule we follow:** *Code decides. AI helps. Humans (and vendors) approve.*
Prices, times and confirmations are always calculated by our own code, so they are reliable.

**Where the data lives:** every trip, booking, payment, problem, agent step, message and document is saved
in the Postgres database. The frontend never keeps "fake" trip data; it always loads it from the Go API.
(The list of destinations, activities and hotels is also kept as a read-only copy in the frontend so screens
open fast; it is the same catalog the backend loads into the database.)

---

## 4. What the traveler can do

Each row is a real screen connected to the Go API.

| Step | Screen | What it does | Real or demo? |
|---|---|---|---|
| Sign up | `/signup` | Name, email, strong password. We send a 6-digit code by email (or show it in dev mode). | Real |
| Verify email | `/verify` | Enter the code; 5 tries, 24 h, one-time use. | Real |
| Log in | `/login` | JWT login; 5 wrong passwords lock the account for 15 minutes. | Real |
| Discover | `/discover` | 8 Indian destinations, match score, **live weather**, "search by feeling". | Real |
| Destination | `/discover/[id]` | Details, 5-day **live forecast**, **nearby places from Google Places**, sample plan. | Real |
| Taste quiz | `/quiz`, `/onboarding` | Builds your **Travel DNA** (6 traits). Your own words are read by AI. | Real |
| Plan | `/plan/generate`, `/plan` | Full day-by-day plan in seconds; map with the **real road route (OSRM)**. | Real |
| Change anything | `/plan`, `/plan/edit`, `/compare` | Swap, add, remove, move, change time and quantity; compare options; **5 Must-Do Hearts**. | Real |
| Price | price panel | Live total, promo codes, budget meter, per-person price. | Real |
| Checkout | `/checkout` | Lead traveler contact + "updates on WhatsApp" switch (saved on the server), pay. | Real (payment is **test mode**) |
| Booked | `/booking-success` | Payment result, vendors confirming live, **PDF documents**, **WhatsApp view**. | Real |
| My Trip | `/my-trip/[id]` | Itinerary, bookings, stay, Change Receipts, **Documents** tab, **WhatsApp** tab, flight status. | Real |
| Prepare | `/prepare` | Smart checklist from weather and activities. | Real |
| Live trip | `/my-trip/live` | Today's plan, map with road route, "leave in N min" from **real road time**, nearby help, mood buttons, report a problem, voice note. | Real (the group's moving dot is simulated; see Section 14) |
| Adapt | `/my-trip/adapt` | See the problem, 3 fix plans, safety checks, watch vendors confirm. | Real |
| Review | `/review` | Stars and comments; completes the trip. | Real |
| Offline | any page after one visit | The trip is saved on the phone and the app works offline (**Offline Trip Pass**). | Real |

---

## 5. What the operator can do

The operator console now uses **the same look as the traveler app** (soft clay cards, pill menu,
bottom bar on phones) and only **5 sections**:

| Section | Pages inside | What it is for |
|---|---|---|
| **Today** | `/ops` | **"Needs you now"**: one list of everything that needs a person, each with one button: *Let the agent fix it*, *Nudge on WhatsApp*, *Hand to agent*, or open the message. Plus trips on the road, today's schedule and money in/out. |
| **Trips** | Trips · Bookings · Travelers · Guides · Money | Every trip with status and risk; open a trip to see its plan, vendors, payments, problems, travelers and **documents**. Assign guides (saved on the server). See the money ledger. |
| **Problems** | Problems · Trip Fixer · Alerts · What if… | Open problems with the Change Impact Map and 3 fix plans; the agent's live timeline; crowd reports and early warnings; the **What-If simulator** ("What if heavy rain hits Coorg tomorrow?"). |
| **Partners** | Vendors | Every vendor with trust score, reply speed, and an **Available** switch (pausing a vendor creates problems for affected trips). |
| **Inbox** | WhatsApp inbox | All vendor **and traveler** conversations. Replies to a traveler appear in that traveler's WhatsApp view. PDFs sent to travelers can be opened. |

What we removed or fixed because it was fake or not useful:

- "Resend request" buttons only showed a message → they now **really re-send** the WhatsApp request with a fresh reply link.
- The team list was typed into the frontend → it now comes from the database (`/ops/team`), and changing a guide is **saved**.
- Crowd-report map pins were placed at random spots → they now sit on the **real place**.
- A fake "attach Voucher.pdf" button in the inbox → removed; real PDFs are attached automatically.
- Labels that credited "Jev" (not built yet) → now say what really happens (AI or code rules).
- 13 menu items → 5 sections with simple sub-tabs.

---

## 6. What the vendor can do

Vendors (hotels, drivers, activity partners) **never log in**.

- They get a request (WhatsApp buttons when Meta keys are set, and always a web link `/v/{token}`).
- They answer **Yes / No / Other time**, or with a **voice note** (turned into text by Whisper and read by AI).
- Their answer updates the booking, the trip and every open screen instantly.

---

## 7. How the smart parts work (simple words)

All of these are in `backend/internal/engine` (pure Go logic, no database, easy to test). The same logic
also exists in TypeScript in `frontend/lib/engine` for instant screen updates, and a test checks both give
the **same answers** (`parity_test.go`).

| Part | How it works |
|---|---|
| **Plan builder** | Picks the hotel that fits your type and budget, picks transport, scores every activity (your interests, your own words, rating, price, energy vs. your pace, kid-friendly), fills each day (arrival day light, middle days 2–4 things, last day check-out), avoids outdoor plans on rainy days, and sets times with travel time in between. |
| **Price calculator** | Stay + travel + local cabs + activities, minus promo and team-up discount, plus 3% service fee (capped) and 5% GST. Shows per-person price and a budget meter. |
| **Optimizer** | Groups nearby places on the same day and orders them to cut travel time; moves outdoor items off rainy days. (Phase 1 uses our own rules; OR-Tools is Phase 2.) |
| **Change Impact Map** | Every trip item knows what it depends on (flight → pickup → check-in → activity). When something breaks, we follow those links and label each item **Moves**, **At risk** or **Cannot happen**, and add up the money and time at risk. |
| **3 Fix Plans** | **Cheapest** (most money back), **Fastest** (fewest changes), **Keep My Favourites** (protects hearted items). Options tried: backup activity, another day with good weather, a similar activity nearby, a later time, another hotel, or cancel with refund. |
| **Safety checks** | 10 checks in code before anything is sent: budget rule, no time clashes, opening hours, energy, rain, walking level, kids, food, vendor trust, hearts kept. |
| **All-or-Nothing confirmation** | The change is saved **only if every vendor says yes**, in **one database transaction** with the Change Receipt, ledger entry and booking updates. Any "no" or timeout → everything is undone and the next plan is tried. |
| **Trip Fixer Agent** | A step-by-step runner in Go: detect → classify → impact → 3 plans → pick the best plan inside the traveler's rules → safety checks → ask vendors → wait → commit or undo → tell the traveler. Every step is saved and shown live. After 2 failed tries it hands over to a human. |
| **Mood buttons** | Tired / Hungry / Raining / Running late / Over budget / Bored re-plans the rest of today (e.g. Tired swaps a trek for a café and adds a rest). |
| **Must-Do Hearts** | 5 hearts per trip; every fix plan protects hearted items first. |
| **What-If simulator** | Runs a problem on a copy of every tour ("heavy rain in Coorg tomorrow") and shows which tours break and the money at risk, without touching real data until you press "Fix all". |
| **Crowd reports** | A report counts after 2 separate reports within 2 hours, or 1 from a trusted guide. Then every tour going there gets a warning. |

---

## 8. Where AI is used (and where it is not)

AI runs **only on the server**. We use **Groq** first; if Groq is busy we switch to **Gemini**; if both are
down we fall back to **rules in code**, so every feature still works with **no AI keys at all**. Several keys
rotate automatically when one hits its limit. Answers are cached.

| Where | What AI does |
|---|---|
| Your own words ("quiet places, my dad can't walk much") | Turns them into wishes the planner can use |
| Traveler messages and voice notes ("we're stuck in traffic") | Understands the need (late / tired / unwell / money …) and writes a friendly reply |
| Vendor replies and voice notes ("Haan, 9 baje aa jaunga") | Understands yes / no / other time / needs a call |
| Voice notes | Groq **Whisper** turns speech into text |
| Safety checks | Answers meaning questions (walking, kids, food) to support the code checks |
| Crowd reports | "Is this a real problem report?" |
| After a fix | Writes the plain-words message to the traveler |

**AI never decides prices, times or whether a change is saved.** Code and vendors do.

---

## 9. Outside services: real, fallback or not used

All outside services are called **from the Go backend only**. Keys never reach the browser. Every call has a
timeout, a limited number of retries (for "too many requests" and server errors), a cache and a fallback.

| Service | Used for | Status today | If it fails |
|---|---|---|---|
| **Open-Meteo** | 16-day weather for all 8 destinations (one request, refreshed every 30 min) | **Real** | Built-in climate model |
| **OSRM** | Real road route, distance and drive time for each trip day | **Real** | Straight-line estimate |
| **Aviationstack** | Live flight status for the trip's flights | **Real** (key set). Only checked within a day of departure, cached 3 h, max 15 calls/day (free plan is tiny) | Airline timetable |
| **Google Places** | "Around here" / "Nearby right now" (food, cafés, sights, medical, ATMs) | **Real** (key set) | Our own experiences list |
| **MapLibre + OpenFreeMap** | Map tiles and markers | **Real** (free, no key) | A soft drawn map |
| **Razorpay** | Payments | **Test-mode ready**; today **simulated checkout** because no Razorpay keys are set | Simulated checkout (clearly labelled) |
| **WhatsApp Cloud API** | Messages to vendors and travelers | **Mock mode** (no Meta keys set): every message is saved and shown in the app and the operator inbox | Web reply link `/v/{token}` |
| **Resend / SMTP** | Verification emails | Works when a key is set; in development the code is shown on screen | Code shown in dev only |
| Groq / Gemini | AI (Section 8) | **Real** (keys set) | Rules in code |

To check live: open `GET /providers` on the API.

---

## 10. Documents (PDFs) and WhatsApp messages

**Documents (real PDFs made by the Go backend):**

| Document | What's inside |
|---|---|
| Booking confirmation | Trip, dates, travelers, stay, transport, lead traveler, payment, every vendor booking and its status, coordinator and emergency numbers |
| Invoice | Every charge (stay, travel, cabs, activities, discounts, service fee, GST), total, per person, payment reference, and later refunds/extra charges |
| Trip itinerary | Day by day with times, places, partners, hearts, weather (live when available) and Change Receipts |
| Tickets & vouchers | One voucher per vendor booking with booking ID, partner contact, time and guests |

When they are made: at payment (all 4) → when every vendor confirms (confirmation + vouchers) → after
every confirmed change by the agent or a mood button (itinerary + vouchers + invoice). Each is a **new
version**; old versions are kept. They are saved in the database and can only be opened by the trip's
traveler or the operator.

**WhatsApp to travelers (mock mode today):** the traveler receives, in the trip's WhatsApp thread:
booking confirmed (with the 4 PDFs), all partners confirmed (with vouchers), a heads-up when a problem hits,
and the plain-words fix message with updated PDFs. The traveler can reply; the AI trip assistant answers,
and the operator sees the whole conversation in the Inbox and can reply too. With Meta keys set, the same
messages also go to the traveler's real WhatsApp (only if they switched on WhatsApp updates).

---

## 11. Live updates (WebSockets)

The Go server pushes events on `GET /ws`; open screens update within a second, without refresh.

| Event | What updates |
|---|---|
| `trip.updated` | Trip, price, bookings |
| `booking.status` | Vendor confirmations |
| `incident.created`, `incident.updated` | Problems list and badges |
| `agent.step` | The agent's live timeline |
| `confirm.progress`, `confirm.saved`, `confirm.undone` | Vendor answers and the final result |
| `notice.new` | Notifications + toast |
| `inbox.message` | Operator inbox |
| `whatsapp.message` | Traveler's WhatsApp view |
| `documents.updated` | Documents list |
| `alert.new`, `alert.verified`, `vendor.updated` | Alerts and vendors |

Travelers only receive events about their own trips; operators receive everything.

---

## 12. The database in simple words

Postgres on Neon. Tables are created automatically at start (`backend/internal/platform/db/migrations`).

| Group | Tables | Meaning |
|---|---|---|
| People | `users`, `email_verifications`, `traveler_profiles`, `customers`, `operators`, `team_members` | Logins, quiz results, travelers, the company and its guides |
| Catalog | `destinations`, `activities`, `stays`, `transport_options`, `vendors` | Places, things to do, hotels, transport and partners |
| Trips | `trips`, `trip_items`, `trip_reviews`, `change_receipts` | Each custom trip, every step of it, reviews and the record of every change |
| Money | `payments`, `ledger_entries`, `bookings` | Payments, refunds, payouts and one booking per vendor per item |
| Changes | `incidents`, `agent_runs`, `agent_steps`, `confirmations`, `vendor_requests`, `decisions` | Problems, the agent's work, and every vendor question and answer |
| Messages | `inbox_threads`, `inbox_messages`, `notifications` | WhatsApp conversations and in-app notices |
| Alerts | `crowd_reports`, `early_warnings` | Live reports from the field |
| Documents | `documents` | Every PDF version |
| Speed | `ai_cache` | Saved AI answers |

Safety: trips are saved under a **row lock** with a **version number**, so two people can't overwrite each
other; all multi-step changes run in **one transaction**.

---

## 13. Phase 1 checklist and honest status

Legend: ✅ done and tested · 🟡 partly (works, with a noted limit) · ⏳ Phase 2

| Area | Status | Notes |
|---|---|---|
| Sign up, email verification, login, lockout, roles | ✅ | |
| Discover, destinations, search by feeling | ✅ | |
| Travel DNA quiz + own words (AI) | ✅ | |
| Plan builder, edit anything, compare, hearts | ✅ | |
| Live price, promos, budget meter | ✅ | |
| Optimizer | 🟡 | Our own rules; OR-Tools is Phase 2 |
| Checkout + payment | 🟡 | Test-mode flow complete; runs **simulated** until Razorpay test keys are added |
| Vendor booking requests + web reply + voice | ✅ | |
| PDF documents (4 kinds, versioned) | ✅ | New in this phase |
| Traveler WhatsApp (mock) + operator inbox | ✅ | Real WhatsApp needs Meta keys |
| Live trip, mood buttons, voice help | ✅ | Group position is simulated (no GPS app yet) |
| Change Impact Map + 3 fix plans + safety checks | ✅ | |
| All-or-nothing vendor confirmation with undo | ✅ | |
| Trip Fixer Agent (rules-driven, live timeline, hand-over) | ✅ | LLM tool-calling version is Phase 2 |
| What-If simulator, crowd reports | ✅ | |
| Early warning | 🟡 | Warnings can be handed to the agent; the automatic background job that creates them is Phase 2 |
| Live weather (Open-Meteo) | ✅ | New in this phase |
| Road routes (OSRM) + maps | ✅ | New in this phase |
| Flight status (Aviationstack) | ✅ | New in this phase; quota-protected |
| Nearby places (Google Places) | ✅ | New in this phase |
| Operator console (5 sections, same look as traveler) | ✅ | Redesigned in this phase |
| Offline Trip Pass (PWA) | ✅ | Service worker added in this phase (production build) |
| Docker + Docker Compose | 🟡 | Files written and `docker compose config` passes; images not built on our laptop (Docker Desktop was off) — CI builds them |
| CI (GitHub Actions) | 🟡 | Workflow written (Go, frontend, smoke test on Postgres, Docker); runs on the first push |

---

## 14. What is NOT built yet (Phase 2)

These are in our plan (`allaboutourproject.md`) but **not in the code yet**. Say this honestly if asked:
*"That's our next step, and our design already supports it."*

| Planned item | What we have instead today | Why the design is ready |
|---|---|---|
| **Jev** (fast typed-decision model) | Groq → Gemini → rules give the same typed answers (yes/no, pick one, confidence) | All decisions go through one AI service in Go; Jev can be added as the first engine |
| **Python AI service** (FastAPI, OR-Tools, ML) | Optimizer and trust scores in Go rules | The optimizer is one function we can swap for an HTTP call |
| **LLM tool-calling agent** | Rules-driven agent with the same steps and tools | Each step is already a separate Go function (get trip, impact, plans, checks, ask vendors, commit) |
| **MCP server** | — | Marked P2 in our plan; the same Go functions would be its tools |
| **pgvector / embeddings** | Keyword + AI "search by feeling" | Part of the Phase 2 Python service |
| **River job queue** | Go background loops (confirmation timers, trip progress, weather refresh) that recover safely after a restart | Timers are stored in the database already |
| **Automatic early-warning job** (GPS + OSRM) | Seeded warnings + hand to agent | OSRM routing is now built and can feed it |
| **Real WhatsApp / Razorpay live** | Mock WhatsApp + simulated checkout | Only keys are missing; the code paths exist |
| **npm package `tripfix`, `yesflow`** | Engine code exists in TS and Go | Needs packaging and publishing |
| **Fair group voting, family safety link, team-up price UI, trip story/XP badges** | Some parts exist (XP, badges, team-up in pricing) | Extra features from Section 10 of the plan |
| **AeroDataBox / OpenTripMap / Nominatim** (named in the plan) | We use **Aviationstack** and **Google Places** instead | Behind one provider interface each, easy to switch |

---

## 15. How we tested it

| Test | Command | Last result |
|---|---|---|
| Go unit tests (engine parity, AI fallbacks, realtime, auth, email, **providers**, **PDFs**) | `cd backend && go test ./...` | All pass |
| Go format + vet | `gofmt -l .` and `go vet ./...` | Clean |
| End-to-end API smoke test (**105 checks**: auth, trips, pricing, booking, payment, documents, WhatsApp, weather, routes, flights, places, incidents, agent, vendors, operator, security) | `python backend/scripts/smoke_test.py http://localhost:8080` | **105/105 passed** with live providers |
| Frontend type check | `cd frontend && npx tsc --noEmit` | Pass |
| Frontend production build | `npm run build` | Pass (36 routes) |
| Manual check in the browser | Operator "Let the agent fix it" → agent ran → escalated correctly | Pass |

The smoke test resets the demo world first, so it can be run again and again.

---

## 16. Safety, security and reliability

- Passwords hashed (bcrypt); JWT sessions; operator-only routes checked on the server.
- Travelers can only see their own trips, documents and messages (tested).
- Secrets live only in `backend/.env` (never committed, never sent to the browser, never logged).
  The Aviationstack key is removed from error messages before logging.
- Every outside call has a timeout, limited retries and a fallback; slow providers never block a screen.
- WhatsApp messages are sent **only after** the database change is saved (no message about a change that
  was rolled back).
- If the server restarts in the middle of an agent run, the run is closed safely and a human is asked to help.
- Payments are verified (Razorpay signature) and booking happens exactly once.

---

## 17. Judge questions: honest, confident answers

**"Is the weather/route/flight data real?"** — Yes. Weather is live from Open-Meteo, road routes from OSRM,
flight status from Aviationstack and nearby places from Google Places, all through our Go backend. If any of
them is down, the app switches to a safe fallback and tells you which one it's using.

**"Is the payment real?"** — The full checkout flow is built for Razorpay test mode and verifies signatures.
In this demo it runs as a clearly-labelled simulated checkout because we haven't added Razorpay keys.

**"Do vendors really get WhatsApp messages?"** — Every message is created and stored exactly as it would be sent.
With Meta's free test number and keys it goes to real phones; in this demo vendors answer on the web link,
and travelers see their messages in the in-app WhatsApp view.

**"Is the agent really AI?"** — The agent is a safe, step-by-step engine in Go: code decides, AI understands
messages and writes explanations, and vendors must approve. A fully LLM-driven tool-calling agent is our
Phase 2 step, and every tool it would call already exists as a Go function.

**"What is Jev?"** — It's the fast decision model in our plan. Today the same decisions are made by Groq/Gemini
with rules as backup, behind one decision service, so plugging Jev in is a small change.

---

## 18. Folder map

```
SIH_INDIGO/
  allaboutourproject.md      the full vision and plan
  PROJECT_GUIDE.md           this file: what is really built
  docker-compose.yml         runs web + api (+ optional local Postgres)
  .github/workflows/ci.yml   automatic checks on every push
  backend/                   Go API
    cmd/api/main.go          starts everything
    internal/engine/         trip logic (planner, pricing, impact, fixes, mood)
    internal/providers/      Open-Meteo, OSRM, Aviationstack, Google Places
    internal/documents/      PDF documents
    internal/app/            shared pieces, notifications, WhatsApp
    internal/agent/          Trip Fixer Agent
    internal/confirm/        all-or-nothing confirmation
    internal/booking/        orders, payments, bookings, resend
    internal/trips/          trips, edits, mood, traveler WhatsApp
    internal/store/          database queries
    internal/platform/db/migrations/  database tables
    scripts/smoke_test.py    end-to-end test
  frontend/                  Next.js app
    app/(traveler)/          traveler screens
    app/ops/                 operator console
    app/v/[token]/           vendor reply page
    components/              UI parts (traveler, ops, map, adapt …)
    lib/api/                 the only place that talks to the Go API
    lib/realtime/socket.ts   live updates
    stores/                  app state
    public/sw.js             offline support
```

---

## 19. Change log

### 26 Sep 2026 — Phase 1 closure pass

- **Frontend build fixed**: dependencies installed from the lockfile; type check and production build pass.
- **Real outside data**: Open-Meteo weather (planner, forecasts, prep list use it), OSRM road routes on maps
  and live-trip timing, Aviationstack flight status, Google Places nearby places. All server-side with
  timeouts, retries, caching and fallbacks. New `GET /weather`, `/providers`, `/places`,
  `/trips/{id}/route`, `/trips/{id}/flights`.
- **PDF documents**: confirmation, invoice, itinerary, vouchers; versioned and stored; issued at payment,
  after all vendors confirm, and after every confirmed change. New `documents` table.
- **Traveler WhatsApp (mock)**: booking, documents, problem heads-ups and fix messages; traveler can chat with
  the AI assistant; operator sees and replies from the Inbox.
- **Checkout** now saves the lead traveler's phone, email and WhatsApp choice.
- **Operator console redesign**: same look as the traveler app; 5 sections; "Needs you now" with one-tap actions;
  fake buttons and hard-coded data removed; guide changes now saved.
- **Honest labels**: removed claims about Jev where it isn't used.
- **Offline**: service worker for the Offline Trip Pass.
- **Docker, Docker Compose, CI** added.
- **Reliability**: WhatsApp sends now happen only after the database commit; two missing indexes added.
- **Tests**: provider and PDF unit tests; smoke test grew from 86 to 105 checks.
