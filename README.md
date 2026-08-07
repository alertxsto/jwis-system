# JWIS — Jakarta Waste Intelligence System

**AI Command Center for Smart Waste Management** — solution built for the **AI Open Innovation Challenge 2026**, with the Jakarta Environmental Agency (DLH DKI Jakarta) as Case Provider.

JWIS (Jakarta Waste Intelligence System) is an end-to-end AI command center prototype that addresses **both cases** issued by DLH Jakarta in a single, integrated platform:

- **Case 1 — AI-Based Waste Transportation Monitoring & Supervision System:** real-time fleet tracking, violation detection, and route/schedule optimization.
- **Case 2 — Waste Volume Prediction System Based on Historical Data & Events**: predictive (not reactive) estimation of waste generation and required resources in crowded areas.

---

## Table of Contents

- [The Two Cases](#the-two-cases)
- [Solution Overview](#solution-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Demo Accounts](#demo-accounts)
- [End-to-End Demo Flow](#end-to-end-demo-flow)
- [Testing](#testing)
- [Security & Credentials](#security--credentials)

---

## The Two Cases

### Case 1 — AI-Based Waste Transportation Monitoring & Supervision System

**Background.** Waste collection activities in Jakarta face several challenges: unmonitored fleets, sub-optimal routes, and the presence of unlicensed collectors. Oversight today relies heavily on manual reports and reactive field inspections.

**Main challenge.** How can the entire waste collection process be carried out lawfully, transparently, and monitored in real time — while making the on-field work of officers easier?

**Scope & deliverables required by the case provider:**
- Live-tracking visuals overlaid on a base map.
- Transport scheduling optimized by estimated travel time, fleet condition, and landfill (TPA) queue status.
- Alternative-route recommendations that respect traffic regulations and permits.
- **Deliverables:** Model · Dashboard (live routes, fleet status, trip history, real-time TPA queue) · Simulator (scheduling, ETA, alternative routes) · Executive summary (optimized schedule, fewer landfill queues).

### Case 2 — Waste Volume Prediction System Based on Historical Data & Events

**Background case:** Waste volume spikes are common during the rainy season, major holidays, and special events — yet handling has always been **reactive**, waiting for the problem to appear instead of acting on measurable predictions.

**Expected outcome.** Shift waste management from reactive to **predictive**: estimate volume and location of waste **temporally and spatially**, and recommend fleet & facility readiness based on crowd-permit data.

**Scope & deliverables:**
- Estimation mapped temporally and spatially in each crowded area.
- Recommended facility needs (disposal & transport) per busy area, grounded on crowd-permit data.
- **Deliverables:** Dashboard (location/volume estimates, man–hour requirements) · Simulator (crowd location, waste generation, facility & fleet needs) · Executive summary (optimized facilities, operating hours, and collection schedules).

---

## Solution Overview

JWIS is one integrated command center covering both cases — from live operations through AI forecasting to actionable alerts:

| Layer | Stack | Purpose |
|---|---|---|
| **Command Center** | React + Vite · MapLibre GL · CSS variables | Real-time interactive dashboards: fleet, routes, landfill queue, forecast per sub-district |
| **AI / Backend** | Python FastAPI · OR-Tools CP-SAT · Prophet · XGBoost · A\* | Route optimization, staggered scheduling, waste forecasting, RAG assistant |
| **Field Alerting** | Node.js Express · WhatsApp (Baileys) | Sends reroute instructions & alerts straight to officers' phones |

Every workflow is an auditable loop — `detect → dispatch → acknowledge → confirmed` — suitable for follow-up by managers or the government.

---

## Key Features

### Fleet Operations (Fleet Case 1)
- **Live Fleet Map** (full-width) — real-time GPS positions with on-/off-corridor status (e.g. `T-047` off-corridor, highlighted amber).
- **A\* Reroute Simulator** — simulates a traffic jam, then computes a new street-following route for `T-047` to TPA Bantargebang dynamically.
- **TPA Queue & Staggered Dispatch** — live landfill queue status with staggered dispatch slots.
- **WhatsApp Alerts** — dispatch reroute instructions via the Baileys gateway straight to driver WhatsApp.
- **Field App** (`/field`) — driver view to confirm instructions; confirmations sync to the dashboard in real time.
- **Historical Trips & Reporting** — trip history and route evidence for officer/management follow-up.

### Pr Forecasting & AI (Case 2)
- **42-Subdistrict Forecast** — map/list of 42 Kecamatan; select one to expand a 3-column resource dashboard (predicted tonnage, fuel, carbon emissions, crew, fleet mix).
- **Operational AI Assistant (RAG)** — ask domain questions; answers retrieved from the custom knowledge base via an OpenAI-compatible gateway.
- **Integrated Planning** — constraint-aware weekly plan (OR-Tools CP-SAT) with an approve/deny flow.

### Data & ML Audit
- **WAPE / MAE accuracy** — model metrics, training limits, and data provenance reviewable straight from the dashboard.

---

## Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│ FRONTEND — React + Vite + MapLibre GL            (5175)       │
│                                                               │
│   Fleet Ops                Waste Forecast / AI Ops            │
│   Field App (/field)       Planning · Data & ML Audit         │
└────────────────────────────┬──────────────────────────────────┘
                             │  HTTP / JSON
┌────────────────────────────▼──────────────────────────────────┐
│ BACKEND — Python FastAPI                          (8001)      │
│   • OR-Tools CP-SAT    · staggered dispatch & planning        │
│   • Prophet + XGBoost  · 42-Kecamatan waste forecast          │
│   • A* routing         · road-following reroute on jams       │
│   • RAG assistant      · domain Q&A via OpenAI gateway        │
└────────────────────────────┬──────────────────────────────────┘
                             │  HTTP / JSON
┌────────────────────────────▼──────────────────────────────────┐
│ WHATSAPP GATEWAY — Node.js + Baileys            (2785)        │
│   QR pairing → dispatch alerts & reroute instructions         │
└───────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
jwis-system/
├── README.md
├── START_JWIS.bat            # One-click launcher (Windows)
├── TASK_retrain_models.md    # Model retraining notes
└── jwis/
    ├── backend/
    │   ├── app/              # FastAPI routes (routing, RAG, forecast, WA)
    │   ├── wa-gateway/       # WhatsApp Baileys gateway (Express)
    │   ├── data/             # Datasets, models, provenance
    │   └── tests/            # Backend test-suite
    ├── frontend/
    │   ├── src/              # React component code & workspaces
    │   └── e2e/              # Playwright end-to-end tests
    ├── PRODUCT.md            # Product specification
    └── .env.example          # Environment template (no real secrets)
```

---

## Getting Started

> Prerequisites: Python 3.10+, Node.js 18+, npm.

### 1. Backend API (FastAPI)

```powershell
cd "jwis/backend"
pip install -r requirements.txt

# Copy the template (then fill in your real values)
Copy-Item ..\.env.example .env

python -m uvicorn app.main:app --port 8001
```

> On startup the backend warms every Prophet + XGBoost forecast cache (± 20–25 s) so dashboard responses are instant.

### 2. WhatsApp Gateway (Baileys)

```powershell
cd "jwis/backend/wa-gateway"
npm install
node server.js
```

> A QR code is printed in the terminal; scan it with a driver's WhatsApp (e.g. `6289675877496`). Session files under `baileys_auth_info/` are regenerated at runtime and **never committed** (see Security below).

### 3. Frontend Web App

```powershell
cd "jwis/frontend"
npm install
npm run build
npm run preview -- --port 5175
```

Open **http://localhost:5175** — or use `START_JWIS.bat` at the repo root to launch everything at once.

---

## Demo Accounts

| Role | Username | Password |
|---|---|---|
| Dispatcher (command center) | `dispatcher` | `dispatcher-demo-pass` |
| Driver (field app) | `driver` | — |

---

## End-to-End Demo Flow

1. **Sign in** with `dispatcher` on the dashboard.
2. **Fleet Operations (Case 1):** open the live fleet map and notice `T-047` off-corridor; click **A\* Simulate Jam** → watch it recompute a street-following route to TPA Bantargebang; inspect the TPA queue & staggered dispatch slots; click **Send Alert**; open `/field` in another tab, log in as `driver`, and confirm the instruction — the dashboard syncs instantly.
3. **Waste Forecast & AI Assistant (Case 2):** browse the 42-Kecamatan list, select one, expand the resource-optimization view (tonnage, fuel, emission, crew, fleet mix), then ask the **Operational AI Assistant** a domain question and get a RAG-grounded answer.
4. **Integrated Planning:** review the constraints, then approve the next weekly staggered-dispatch plan.
5. **Data & ML Audit:** review WAPE / MAE accuracy, training limits, and data provenance of the forecasting models.

---

## Testing

```powershell
cd "jwis/frontend"
npx playwright test --workers 1
```

E2E suite: **42 tests**, headless, zero regressions.

---

## Security & Credentials

The repository is **public** — handle sensitive material with care:

- **`.env` files are `gitignore`d and must never be committed.** Use `.env.example` as the template; values live only on the runne machine.
- **WhatsApp session store** (`jwis/backend/wa-gateway/baileys_auth_info/`) contains real session credentials — it is ignored/untracked and regenerated on every QR scan.
- **Runtime logs** (`*.log`) are ignored & untracked.
- ⚠️ **If a secret was ever pushed to public history, rotate it at the provider immediately.** History rewrites require force push and should be avoided in forked repos.

---

## Built For

- **Competition:** AI Open Innovation Challenge 2026 — [ai-open.president.ac.id](https://ai-open.president.ac.id)
- **Case Provider:** DLH DKI Jakarta
- **Team:** JWIS