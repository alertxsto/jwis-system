# JWIS Competition Checklist Status

Scope note: semifinal video preparation is now active. Deployment remains deferred.

## Done

- FastAPI project structure
- React dashboard, no Streamlit
- Interactive MapLibre fleet tracking
- Fleet status panel
- Route deviation alert
- TPA queue simulation
- Waste prediction panel
- Open-Meteo forecast integration
- Open-Meteo historical weather acquisition script
- Indonesian holiday API acquisition script
- GADM Jakarta GeoJSON acquisition script
- Scrapling evidence files for Satu Data Open Data, waste detail page, Jakarta Satu, and Potensi Kelurahan dashboard
- Dummy 2026 event calendar with attendance and waste-impact assumptions
- EDA report for weather, holidays, geospatial, waste seed, and scraped-source inventory
- Dummy event/crowd scenario simulator
- Executive summary endpoint
- Natural-language assistant endpoint with OpenAI support and local fallback
- Optional OpenWA WhatsApp alert adapter and dashboard trigger
- OSRM public routing client, endpoint, and dashboard route evidence panel
- Kelurahan-style heatmap layer in MapLibre with fallback GeoJSON
- Realistic Jakarta waste forecast seed CSV fallback
- Service worker for app-shell and GET API response cache
- PDF executive summary export with text fallback
- SQLite history store
- Field worker mobile/PWA-like responsive view
- Export executive summary as downloadable text
- Backend endpoint tests
- Reproducible Prophet+XGBoost training pipeline (scripts/train_models.py) retrained on real government data (SILIKA DLH 2023, SIPSN, Bantargebang, Open-Meteo); 42/42 kecamatan models load with honest evaluation report
- Semifinal English narration script, storyboard, compliance checklist, and 16:9 identity cards
- Recording-state reset endpoint and recording preparation launcher

## Partial

- Jakarta waste open data: official source pages scraped and metadata captured; direct stable CSV/API resource still unavailable, so seed CSV is explicitly labeled synthetic.
- Kelurahan heatmap: Navigo raw path was not reachable quickly; fallback polygons are wired and can be replaced with real GeoJSON.
- Dashboard offline mode: service worker caches app shell and successful GET API responses.
- Carbon footprint tracker: not implemented yet.
- Digital twin animation: map has live markers/routes, but no trip animation layer yet.
- WhatsApp alert: adapter implemented; live sending requires OpenWA session, API key, and target chat id.
- Interview quotes: requires real user outreach outside code.

## Skipped For Now

- Computer vision YOLO for truck full/empty detection
- Railway/Vercel deployment
- Custom domain

## Next Highest-Impact Work

1. Add OSRM route API call and ETA scoring evidence.
2. Add kelurahan heatmap layer from a stronger boundary dataset.
3. Add real Jakarta waste CSV if a direct Satu Data resource URL is found.
4. Add service worker for offline demo resilience.
5. Improve PDF visual styling and include dashboard screenshots if needed.
