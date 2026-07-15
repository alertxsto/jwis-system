# JWIS Winning System

AI command center prototype for the AI Open Innovation Challenge 2026 DLH waste case.

## What This Replaces

This version removes Streamlit and replaces it with a React/Vite command center plus a FastAPI backend.
The live-tracking surface uses MapLibre GL, following the same technical direction as `mapcn`, but implemented directly because this project does not use Tailwind CSS or shadcn/ui. The basemap uses OpenFreeMap/OpenStreetMap-compatible tiles instead of mapcn's default CARTO basemap to avoid commercial-use ambiguity during competition demos.

## Demo Flow

1. Open the command center.
2. Show the KPI row: active fleet, operational issues, TPA queue, and predicted waste spike.
3. Explain the live fleet map: `T-047` is outside its assigned corridor.
4. Open the action queue and dispatch the recommended route.
5. Open `/field`, select `T-047`, and confirm the instruction.
6. Return to the command center and show that the system is a closed loop: detect, recommend, dispatch, confirm, audit.

## Run Locally

Backend:

```powershell
cd ".\backend"
C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --reload --port 8001
```

Frontend:

```powershell
cd ".\frontend"
$env:VITE_API_URL="http://127.0.0.1:8001/api"
npm run dev -- --port 5175
```

URLs:

- Command Center: http://localhost:5175
- Field App: http://localhost:5175/field
- API Docs: http://localhost:8001/docs

Offline demo resilience:

- The frontend registers a service worker at `/sw.js`.
- App shell routes `/` and `/field` are cached.
- GET `/api/*` responses are cached after successful fetches and reused if the network is unavailable.

Optional OpenAI assistant:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-4.1-mini"
```

Without `OPENAI_API_KEY`, the assistant endpoint uses a local deterministic fallback so the demo remains reliable.

Optional OpenWA WhatsApp alert:

```powershell
$env:OPENWA_BASE_URL="http://localhost:2785/api"
$env:OPENWA_API_KEY="your-openwa-api-key"
$env:OPENWA_SESSION_ID="your-session-id"
$env:OPENWA_DEFAULT_CHAT_ID="628123456789@c.us"
```

OpenWA reference: https://github.com/rmyndharis/OpenWA

## Data Acquisition

```powershell
cd "."
C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe scripts\acquire_data.py
```

This downloads or records:

- Open-Meteo Jakarta 2-year historical daily weather
- Indonesian 2026 public holidays
- GADM Jakarta admin-2 GeoJSON subset
- Jakarta waste dataset metadata from DATA.GO.ID/Satu Data Jakarta
- Kelurahan heatmap GeoJSON fallback if the preferred raw source is unavailable
- Jakarta waste forecast seed CSV fallback if no direct Satu Data CSV is reachable
- Dummy event calendar for CFD, concerts, Lebaran flow, Jakarta Fair, and local festivals

Scrape official source evidence with Scrapling:

```powershell
cd "."
C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe scripts\scrape_research_sources.py
```

Generate EDA and research assets:

```powershell
cd "."
C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe scripts\generate_research_assets.py
```

Report export:

- Dashboard button exports `jwis-executive-summary.pdf` using `html2pdf.js`.
- If PDF generation fails in the browser, it falls back to a text download.

## Verification

Backend tests:

```powershell
cd ".\backend"
$env:PYTHONPATH='.'
python -m unittest discover -s tests -v
```

Frontend build and complete headless UI suite:

```powershell
cd ".\frontend"
npm run build
npx playwright test --workers=1
```
