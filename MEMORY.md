# Trizpyy Context Ledger & Architecture Notes

## 1. System Architecture
- **Backend**: Go service (`cmd/api/main.go`) with chi router, postgres / neon database, and in-memory engine.
- **Frontend**: Next.js 15 (App Router), React 19, Zustand stores (`incidentStore`, `tripStore`, `agentStore`, `authStore`), Tailwind CSS.
- **Trip Fixer Agent**: Pure Go deterministic state machine (`backend/internal/agent/service.go`) executing change impact analysis, vendor outreach, and automated itinerary re-planning.
- **Document Delivery**: Post-payment booking confirmation (Vouchers, Itineraries, Invoices, Receipts) delivered via Telegram (`SendBookingConfirmationTelegram`) and Email. Default demo Telegram chat ID configured: `5481196704` for instant delivery during presentations.

## 2. Recent UI Cleanups (Judge Demo Ready)
- **AI Chatbot Button**: Removed the bouncing text bubble (`Ask Travel Guru AI`), keeping only the clean circular compass button in `frontend/components/travel-guru/components/TravelGuruFloatingWidget.tsx`.
- **Top Navigation**: Removed `Travelers` and `Inbox` from `frontend/components/shell/OpsShell.tsx` to streamline the operator console navigation bar for presentations.
- **Problems & What-If Simulation Data**:
  - Injected 3 representative disruption scenarios into `frontend/data/demoIncidents.ts`:
    1. **Weather**: Heavy rain alert in Coorg / Western Ghats (Outdoor trekking & rafting impacted).
    2. **Flight Delay**: Indigo 6E-2432 into BLR delayed by 3.5 hrs (Sunset tour at risk).
    3. **Vendor Unavailable**: Rafting / guide closure with emergency alternative re-booking.
  - Linked fallback data in `useIncidentStore` and `useTripStore` so that the Incident Center (`/ops/incidents`), What-If simulator (`/ops/what-if`), and incident detail pages (`/ops/incidents/[id]`) display full impact analyses, travelers affected, cost-at-risk, and recommended fix plans even if the live database is clean.

## 3. Remote Tracking & Deployment
- Active branch: `main` on `https://github.com/ParthYendhe0679/hackpill.git`.
- **AI Service Deployment on Render**:
  - Live URL: `https://hackpill-1.onrender.com`
  - Health check: `https://hackpill-1.onrender.com/health` (verified active with OR-Tools, delay model, Groq & Gemini agent)
  - Root entrypoint `app/main.py` and `services/app/main.py` forward directly to `services.ai.app.main:app`.
  - Backend Environment Variable: Set `AI_SERVICE_URL=https://hackpill-1.onrender.com` on Render backend service `https://hackpill.onrender.com`.
- **Frontend Deployment on Vercel**:
  - Live URL: `https://hackpill.vercel.app`
  - Automated deployment triggers from `main` branch under owner account `parthyendhe0679`.

## 4. Super Admin Portal & Platform Management
- **Routes**: `/super-admin`, `/super-admin/guides`, `/super-admin/operators`, `/super-admin/users`.
- **Backend**: Protected by `auth.SuperAdminOnly` middleware (`backend/internal/api/admin.go`), dynamic account provisioning in `backend/internal/admin/service.go`.
- **Environment Configuration**: Provisioned via `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (min 12 characters).

## 5. Live Open-Meteo Weather Radar & Operator Demo Data
- **Demo Seed Coverage**: 6 live tours across Coorg, Hampi, Gokarna, and Dandeli with pre-staged open incidents in `backend/internal/seed/demo.go` for full What-If and Trip Fixer agent demoing.
- **Real-Time Meteorological Radar**: Integrated live Open-Meteo feed on Operator Dashboard (`/ops`) and What-If Simulator (`/ops/what-if`), displaying live temperature, rain probability, and one-click disruption simulation.

