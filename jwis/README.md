# JWIS Winning System (Jakarta Waste Intelligence System)

AI command center prototype for the AI Open Innovation Challenge 2026 DLH waste case (Case 1 & Case 2).

## What This Replaces

This version replaces the legacy Streamlit code with a high-performance React/Vite command center, a Python FastAPI backend, and a lightweight Node.js WhatsApp Gateway (Baileys).
The interface is a task-first operations product: a persistent command rail,
single-action decision surfaces, and dedicated desktop/mobile workflows built
with the repository's `taste-redesign` and `taste-default` constraints.

## Project Architecture

- **Frontend:** React + Vite, MapLibre GL, and a responsive command-center design system based on Geist Sans/Mono.
- **Backend:** FastAPI, OR-Tools CP-SAT (Integrated Planning optimizer), Prophet + XGBoost (Waste Forecast models), and an optional OpenAI-compatible Ana assistant gateway. Without an assistant key, Ana gives labelled local answers from relevant JWIS tools instead of inventing data.
- **WhatsApp Gateway:** A standalone Express + `@whiskeysockets/baileys` gateway running on port 2785 for direct WhatsApp alert dispatching (no Puppeteer/headless browser overhead).

### Driver analytics data contract

`GET /api/fleet/driver-analytics` returns one current assignment per truck from
the cached `/api/command-center` fleet snapshot. The response includes
`sampled_at` (UTC ISO timestamp), `source: "command-center.trucks"`, bilingual
`provenance.id`/`provenance.en`, and `drivers` with truck code, driver name,
assigned zone, current status, damage flag, and current route-deviation flag
and distance. The interface refreshes every 15 seconds, marks snapshots older
than 30 seconds or failed refreshes as stale, and keeps the last snapshot visible
on refresh failure. Rows and KPIs describe current assignments, **not**
historical trips, fuel efficiency, or driver performance scores. Pilot telemetry
and assignments are simulated; fleet composition uses the DKI 2023 truck census.

## Interface

| Entry | Preview |
|---|---|
| Operator login | ![JWIS operator login](docs/audit/screenshots/01-login.png) |
| Fleet command | ![Fleet map and priority action](docs/audit/screenshots/02-fleet-actioncard-nav5.png) |
| Waste forecast | ![District demand intelligence](docs/audit/screenshots/03-forecast.png) |
| Integrated planning | ![Three-stage operations plan](docs/audit/screenshots/06-planning.png) |
| Driver performance | ![Driver coaching workspace](docs/audit/screenshots/07-drivers.png) |
| Data and model audit | ![Data provenance registry](docs/audit/screenshots/08-audit.png) |
| Field operator | ![Field mobile application](docs/audit/screenshots/04-field-indonesian.png) |
| Supervisor | ![Supervisor mobile priority view](docs/audit/screenshots/05-pengawas-mobile.png) |

## Complete Demo Flow

1. **Sign In:** Enter username `dispatcher` and password `dispatcher-demo-pass`.
2. **Fleet Operations (Case 1):**
   - View simulated fleet positions and route deviations on the Live Fleet Map; positions are not live GPS.
   - Observe that `T-047` is off-corridor (marked in yellow).
   - Click the **A* Simulate Jam** button. Watch `T-047` dynamically calculate a new road-following route to TPA Bantargebang.
   - Look at the TPA Queue and staggered dispatch slots.
   - Click **Send Alert** in the Action Queue to dispatch the reroute instruction.
   - Open `/field` in another tab, log in as `driver`, and confirm the dispatch instruction.
   - Back in Fleet Operations, the confirmation is synced instantly.
3. **Waste Forecast & AI Assistant (Case 2):**
   - Navigate to **Waste Forecast**.
   - Browse/filter the 42 Kecamatan map/list. Click a Kecamatan to expand its 3-column resource optimization dashboard (predicted waste tonnage, fuel consumption, carbon emissions, crew, and fleet mix).
   - Use **Ana** to ask a specific operational question. It selects relevant read-only tools rather than injecting a prediction into every answer; image/PDF analysis requires a configured assistant gateway.
4. **Integrated Planning:**
   - Review constraints and approve the weekly staggered queue plan.
5. **Data & ML Audit:**
   - Audit the Prophet/XGBoost models' accuracy metrics (WAPE, MAE), training limits, and data provenance.


### Driver weighbridge receipt

After completing all SPJ stops, the driver uploads a photo of the loaded truck's
weighbridge receipt. GutsAI vision suggests the gross weight in kilograms when
configured; the driver must check it against the receipt before submission.
If OCR is unavailable or unreadable, the same photo can be submitted with a
confirmed manually entered weight. The SPJ detail retains the receipt photo,
weight, and whether the submitted value came from OCR or manual entry; the SPJ
list omits the photo bytes.

## Installation & Running Locally

### 1. WhatsApp Gateway (Baileys)
Make sure Node.js is installed. Run the gateway server:
```powershell
cd "jwis/backend/wa-gateway"
npm install
node server.js
```
*Note: A QR code will display in the terminal. Scan it with your WhatsApp app (authenticated as `6289675877496` or any driver phone).*

### 2. Backend API
Make sure Python (3.10+) is installed. Install dependencies and run the API:
```powershell
cd "jwis/backend"
pip install -r requirements.txt

# Copy jwis/.env.example to jwis/.env and fill only the providers you use:
# OPENAI_API_KEY=             (optional Ana gateway; blank uses local tools)
# OPENAI_BASE_URL=            (optional OpenAI-compatible endpoint)
# OPENAI_MODEL=               (optional compatible model)
# GUTS_API_KEY=               (optional receipt OCR; leave blank for manual entry)
# GUTS_BASE_URL=https://api.gutsai.id/v1
# GUTS_VISION_MODEL=gemini-3.8-flash
# OPENWA_BASE_URL=http://localhost:2785/api
# OPENWA_API_KEY=your-wa-api-key
# OPENWA_SESSION_ID=default

python -m uvicorn app.main:app --port 8001
```
*Note: The backend will warm all Prophet + XGBoost prediction caches on startup (~20-25 seconds) to ensure instant responses.*

### 3. Frontend Web App
Run the production build preview (optimized layout):
```powershell
cd "jwis/frontend"
npm install
npm run build
npm run preview -- --port 5175
```
Access the app at: **http://localhost:5175**

## Testing & Verification

Run the full end-to-end Playwright tests to verify zero regressions:
```powershell
cd "jwis/frontend"
npm run build   # required: the preview server serves dist/ — a stale dist causes false e2e failures
npx playwright test --workers 1
```
*(The suite covers the current end-to-end workflows.)*
