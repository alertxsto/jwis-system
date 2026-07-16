# JWIS Winning System (Jakarta Waste Intelligence System)

AI command center prototype for the AI Open Innovation Challenge 2026 DLH waste case (Case 1 & Case 2).

## What This Replaces

This version replaces the legacy Streamlit code with a high-performance React/Vite command center, a Python FastAPI backend, and a lightweight Node.js WhatsApp Gateway (Baileys).
The interface is designed with a premium, professional SaaSAble layout, following the `impeccable` visual hierarchy and `taste-skill` typography standards.

## Project Architecture

- **Frontend:** React + Vite, MapLibre GL, and CSS variables for a clean SaaSAble dashboard (Inter & Plus Jakarta Sans).
- **Backend:** FastAPI, OR-Tools CP-SAT (Integrated Planning optimizer), Prophet + XGBoost (Waste Forecast models), and an OpenAI Assistant route configured to stream via 9Router.
- **WhatsApp Gateway:** A standalone Express + `@whiskeysockets/baileys` gateway running on port 2785 for direct WhatsApp alert dispatching (no Puppeteer/headless browser overhead).

## Complete Demo Flow

1. **Sign In:** Enter username `dispatcher` and password `dispatcher-demo-pass`.
2. **Fleet Operations (Case 1):**
   - View the full-width Live Fleet Map with real-time GPS coordinates.
   - Observe that `T-047` is off-corridor (marked in yellow).
   - Click the **A* Simulate Jam** button. Watch `T-047` dynamically calculate a new road-following route to TPA Bantargebang.
   - Look at the TPA Queue and staggered dispatch slots.
   - Click **Send Alert** in the Action Queue to dispatch the reroute instruction.
   - Open `/field` in another tab, log in as `driver`, and confirm the dispatch instruction.
   - Back in Fleet Operations, the confirmation is synced instantly.
3. **Waste Forecast & AI Assistant (Case 2):**
   - Navigate to **Waste Forecast**.
   - Browse/filter the 42 Kecamatan map/list. Click a Kecamatan to expand its 3-column resource optimization dashboard (predicted waste tonnage, fuel consumption, carbon emissions, crew, and fleet mix).
   - Use the **Operational AI Assistant** at the bottom: type a question, and it will respond via the 9Router gateway using custom domain knowledge.
4. **Integrated Planning:**
   - Review constraints and approve the weekly staggered queue plan.
5. **Data & ML Audit:**
   - Audit the Prophet/XGBoost models' accuracy metrics (WAPE, MAE), training limits, and data provenance.

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

# Create a .env file inside jwis/backend/ with the following:
# OPENAI_API_KEY=your-9router-api-key
# OPENAI_BASE_URL=http://100.67.31.81:20128/v1
# OPENAI_MODEL=graphify
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
npx playwright test --workers 1
```
*(All 42 tests will pass successfully in headless mode).*
