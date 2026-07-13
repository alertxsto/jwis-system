# JWIS Map Truthfulness & Case 1 Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the JWIS fleet map geospatially honest and functionally complete for DLH Case 1, so every line, color, and label reflects real data or is clearly marked as simulation.

**Architecture:** Fix the four subsystems that currently disagree (fleet fixture, OSRM evidence, route recommendation, A*) by making the map render real OSRM road geometry, color actual paths by violation state (not blanket red), fix the heatmap property contract, honestly label data provenance per layer, and add the missing Case 1 spatial features (TPA marker, follow-truck, popup actions). Deep A* rebuild against live OSRM graph is explicitly OUT of scope for this plan (documented as accepted debt).

**Tech Stack:** React 19, Vite, MapLibre GL, FastAPI, Playwright.

## Global Constraints

- Do not present simulated data as observed reality — every map layer carries a provenance label: `PUBLIC DATA`, `LIVE EXTERNAL`, `MODEL OUTPUT`, or `SIMULATION`.
- Do not fabricate permit attendance — events without official numbers show `unknown`.
- All backend changes keep the 70-test suite green; all frontend changes keep `npm run build` passing.
- No new hardcoded route geometry — road-following lines come from OSRM.
- Preserve honest labels already established (calibrated-synthetic, proxy, etc.).

---

### Task 1: Color actual routes by violation state (not blanket red)

**Files:**
- Modify: `jwis/frontend/src/LiveFleetMap.jsx:107-200`
- Modify: `jwis/backend/app/data.py` (ensure each truck exposes `deviation.violated`)
- Test: `jwis/frontend/e2e/map-workflow.spec.js` (create)

**Interfaces:**
- Consumes: `truck.deviation.violated` (bool), `truck.deviation.distance_meters` (float) — already produced by `engine.detect_route_deviation`.
- Produces: actual-route features tagged `kind: "actual-clean"` (green) or `kind: "actual-violation"` (red).

- [ ] **Step 1:** In `LiveFleetMap.jsx`, where `actualFeatures.push(routeFeature(... "actual" ...))` is built (~line 123), set the feature `kind` from the truck's deviation: `truck.deviation?.violated ? "actual-violation" : "actual-clean"`.
- [ ] **Step 2:** Update the `actual-routes-line` paint `line-color` case (line 192-196): `actual-violation` → `#b42318`, `actual-clean` → `#176b54`, default green.
- [ ] **Step 3:** Build production bundle: `npm run build`. Expected: exit 0.
- [ ] **Step 4:** Add Playwright test asserting T-001 (clean) actual line is green and T-047 (violated) is red — verify via `map.getPaintProperty` or feature inspection through a test hook exposing `window.__jwisMapFeatures`.
- [ ] **Step 5:** Commit `fix(map): color actual routes by violation state`.

### Task 2: Fix heatmap property contract (predicted_tons vs spike_percent)

**Files:**
- Modify: `jwis/frontend/src/LiveFleetMap.jsx:390-400`
- Test: `jwis/backend/tests/test_real_data.py` (extend)

**Interfaces:**
- Consumes: heatmap feature `properties.predicted_tons` (float | null) from `load_kelurahan_heatmap`.
- Produces: fill-color interpolation keyed on `predicted_tons`; null values render a neutral "no-data" gray, never silently 0.

- [ ] **Step 1:** Add a backend test asserting every heatmap feature has a `predicted_tons` key and null features are counted (not dropped).
- [ ] **Step 2:** Run `python -m unittest tests.test_real_data` — confirm current behavior (some null) documented.
- [ ] **Step 3:** In `LiveFleetMap.jsx:395`, change `["get", "spike_percent"]` to `["get", "predicted_tons"]`; wrap in `["coalesce", ["get","predicted_tons"], -1]` and map `-1` to a neutral gray so null kelurahan are visibly "no data", not colored as low.
- [ ] **Step 4:** `npm run build`. Expected: exit 0.
- [ ] **Step 5:** Commit `fix(map): heatmap reads predicted_tons with explicit no-data state`.

### Task 3: Honest per-layer provenance labels + fix "Live 30s"

**Files:**
- Modify: `jwis/frontend/src/main.jsx:324` (the "Live 30s" pill)
- Modify: `jwis/frontend/src/LiveFleetMap.jsx` (map legend)

**Interfaces:**
- Produces: a map legend listing each layer with a provenance tag; the fleet-position pill reads `SIMULATION` not `Live 30s`.

- [ ] **Step 1:** Replace the `Live 30s` StatusPill (main.jsx:324) with `Simulation` tone="warning" and helper text "positions are simulated, not live GPS".
- [ ] **Step 2:** In the map legend, tag layers: assigned corridor `SIMULATION`, actual path `SIMULATION`, OSRM route `LIVE EXTERNAL`, heatmap `MODEL OUTPUT`, kelurahan boundaries `PUBLIC DATA`.
- [ ] **Step 3:** `npm run build`. Expected: exit 0.
- [ ] **Step 4:** Commit `fix(map): label layer provenance and mark positions as simulation`.

### Task 4: Draw real OSRM road geometry for the recommended route

**Files:**
- Modify: `jwis/backend/app/main.py` (expose OSRM geometry on `/api/routes/osrm` if not already GeoJSON)
- Modify: `jwis/frontend/src/LiveFleetMap.jsx` (add an OSRM route layer)
- Test: `jwis/backend/tests/test_osrm.py` (extend)

**Interfaces:**
- Consumes: `/api/routes/osrm` returning `geometry` as GeoJSON LineString (road-following).
- Produces: a map layer `osrm-route-line` (cyan, `LIVE EXTERNAL`) drawn from the real geometry, endpoint within 50m of the T-047 marker.

- [ ] **Step 1:** Add a backend test asserting the OSRM route response contains a `geometry` with >50 coordinate pairs (road-following, not a 2-point straight line), skipping gracefully if OSRM is unreachable.
- [ ] **Step 2:** Run `python -m unittest tests.test_osrm` — confirm shape.
- [ ] **Step 3:** In `LiveFleetMap.jsx`, fetch `/api/routes/osrm`, add `osrm-route-line` layer (cyan `#0891b2`, width 4) from the returned geometry.
- [ ] **Step 4:** `npm run build`. Expected: exit 0.
- [ ] **Step 5:** Commit `feat(map): render real OSRM road geometry as live layer`.

### Task 5: Add TPA Bantargebang marker with spatial queue status

**Files:**
- Modify: `jwis/frontend/src/LiveFleetMap.jsx`
- Modify: `jwis/backend/app/main.py` (ensure `/api/tpa/queue-status` exposes lat/lng)

**Interfaces:**
- Consumes: `/api/tpa/queue-status` including `lat: -6.3728, lng: 107.0028` (Bantargebang) + `avg_wait_minutes`, `status_label`.
- Produces: a distinct landfill marker on the map with a popup showing live queue wait (from the discrete-event sim) tagged `MODEL OUTPUT`.

- [ ] **Step 1:** Add `lat`/`lng` for Bantargebang to the `/api/tpa/queue-status` response.
- [ ] **Step 2:** In `LiveFleetMap.jsx`, render a landfill marker (distinct icon) at that coordinate with a popup: queue units, wait minutes, weighbridge status.
- [ ] **Step 3:** `npm run build`. Expected: exit 0.
- [ ] **Step 4:** Commit `feat(map): add Bantargebang TPA marker with queue status`.

### Task 6: Follow/filter a single truck + popup action buttons

**Files:**
- Modify: `jwis/frontend/src/LiveFleetMap.jsx`
- Modify: `jwis/frontend/src/main.jsx` (wire selected-truck state)

**Interfaces:**
- Consumes: fleet list + selected truck code.
- Produces: clicking a truck marker flies to it, filters other layers dim, and the popup carries a "Dispatch" action button and shows `updated_seconds_ago` + data source.

- [ ] **Step 1:** Add selected-truck state; clicking a marker sets it and `map.flyTo` its position.
- [ ] **Step 2:** Popup shows timestamp (`updated_seconds_ago`), speed, deviation distance, source label `SIMULATION`, and a Dispatch button that opens the dispatch flow for that truck.
- [ ] **Step 3:** `npm run build`. Expected: exit 0.
- [ ] **Step 4:** Commit `feat(map): follow-truck, popup timestamps and dispatch action`.

### Task 7: Map E2E tests + visual QA

**Files:**
- Create: `jwis/frontend/e2e/map-workflow.spec.js`

**Interfaces:**
- Consumes: running backend (8001) + frontend (5175).
- Produces: E2E coverage for normal render, deviation coloring, heatmap non-blank, TPA marker present.

- [ ] **Step 1:** Write Playwright tests: (a) map canvas renders (not blank), (b) T-047 actual line red / T-001 green, (c) heatmap has >0 colored features, (d) TPA marker visible, (e) truck popup opens with timestamp.
- [ ] **Step 2:** Run `npx playwright test e2e/map-workflow.spec.js`. Expected: all pass.
- [ ] **Step 3:** Capture desktop + mobile screenshots proving map not blank, layers not overlapping, popups readable.
- [ ] **Step 4:** Commit `test(map): e2e coverage for render, deviation, heatmap, TPA`.

### Task 8: A* edges carry OSRM road geometry + permit/traffic metadata

**Files:**
- Modify: `jwis/backend/app/astar_routing.py`
- Test: `jwis/backend/tests/test_astar_routing.py` (create)

**Interfaces:**
- Consumes: `osrm.fetch_osrm_route(name, origin, destination)` per edge → road-following geometry, cached.
- Produces: each A* edge stores `distance_km`, `duration_min`, `traffic`, `permit_allowed`, `road_geometry` (list of {lat,lng} from OSRM); `find_astar_route` returns `path` built from concatenated OSRM edge geometry, not `build_detailed_path` straight-line interpolation. Separated fields: `optimization_cost`, `physical_distance_km`, `eta_minutes`.

- [ ] **Step 1:** Add a test asserting a routed path has >50 coordinate points (road-following) and that a permit-blocked edge is never selected (add one `permit_allowed: False` edge on the shortest corridor and assert the route avoids it).
- [ ] **Step 2:** Run `python -m unittest tests.test_astar_routing` — confirm it fails against the current straight-line `build_detailed_path`.
- [ ] **Step 3:** Add an `EDGE_META` table (permit_allowed, base traffic) and a cached `edge_geometry(u,v)` that calls OSRM once per edge (fallback to haversine line if OSRM down, labeled). Replace `build_detailed_path` output with concatenated edge geometry.
- [ ] **Step 4:** Split the returned cost fields: `optimization_cost` (weighted), `physical_distance_km` (raw sum), `eta_minutes` (from OSRM durations). Skip permit-blocked edges in the adjacency expansion.
- [ ] **Step 5:** Run tests + full backend suite `python -m unittest discover -s tests`. Expected: all pass.
- [ ] **Step 6:** Commit `feat(astar): OSRM road geometry + permit constraints on edges`.

### Task 9: A* anchors to selected truck GPS + jam only diverts if it hits the route

**Files:**
- Modify: `jwis/backend/app/astar_routing.py`
- Modify: `jwis/backend/app/main.py` (`/api/fleet/astar-reroute` accepts a truck code)
- Test: `jwis/backend/tests/test_astar_routing.py` (extend)

**Interfaces:**
- Consumes: selected truck `latest_position` (from `data.TRUCKS`).
- Produces: A* ORIGIN snapped to the truck's real coordinate (endpoint within 50m); a congestion segment that does NOT lie on the active route produces NO diversion.

- [ ] **Step 1:** Add a test: origin coordinate for T-047 is within 50m of its `latest_position`; and a jam on an edge not in the active path leaves the route unchanged.
- [ ] **Step 2:** Run test — confirm fails (current ORIGIN is a fixed node 2.95km off).
- [ ] **Step 3:** Add `nearest_node(lat,lng)` snapping + inject a dynamic ORIGIN node from the truck GPS; only trigger diversion when a congested edge ∈ active route edges.
- [ ] **Step 4:** Wire `/api/fleet/astar-reroute?truck_code=` to pass the truck position.
- [ ] **Step 5:** Full backend suite. Expected: pass. Commit `feat(astar): anchor to truck GPS, divert only on route-relevant jams`.

### Task 10: GPS breadcrumb pipeline (simulated feed, pilot-ready contract)

**Files:**
- Create: `jwis/backend/app/gps_feed.py`
- Modify: `jwis/backend/app/data.py`
- Test: `jwis/backend/tests/test_gps_feed.py` (create)

**Interfaces:**
- Produces: `GpsBreadcrumb {truck_code, lat, lng, timestamp, speed_kmh, source}`; `latest_breadcrumbs(truck_code)` returns a timestamped trail labeled `source="simulated"`. Contract is identical to what a real DLH AVL feed would provide, so swapping in real GPS needs no downstream change.

- [ ] **Step 1:** Add a test asserting breadcrumbs are timestamped, ordered, `source="simulated"`, and that actual path = breadcrumb trail (not a hardcoded fixture).
- [ ] **Step 2:** Run test — confirm fails (no `gps_feed` module).
- [ ] **Step 3:** Implement a seeded breadcrumb generator that walks each truck along its assigned OSRM geometry over time, emitting timestamped points labeled `simulated`. Document: replace `latest_breadcrumbs` with the real AVL feed at pilot; contract unchanged.
- [ ] **Step 4:** Feed actual-path rendering from breadcrumbs; popup shows real timestamp + `source: SIMULATION`.
- [ ] **Step 5:** Full backend suite + `npm run build`. Commit `feat(gps): simulated breadcrumb pipeline with pilot-ready contract`.

## Honest scope note (not a capability limit)

- **A* rebuild (Tasks 8-9) and GPS pipeline (Task 10) ARE in scope and built here.** The A* engine gets real OSRM edge geometry, permit constraints, GPS-anchored origin, and route-relevant diversion.
- **The ONE thing not fabricated:** real DLH AVL/GPS truck telemetry does not exist in the repo or public sources. Task 10 builds the full ingestion pipeline and map-matching contract, fed by a **clearly-labeled simulated** breadcrumb stream. Swapping in the real AVL feed at pilot requires zero downstream code change — the contract is identical. We build the machine; we do not invent the government's live data.

## Self-Review

- Spec coverage: #2→Task1, #5→Task2, #6+#9→Task3, #4→Task4, #8(TPA)→Task5, #8(follow/popup)→Task6, DoD-E2E→Task7, #1(A* straight-line geometry)→Task8, #3(A* GPS anchor + route-relevant jam)→Task9, actual-path/GPS→Task10. Permit-marker fabrication (#7) handled by Task3 provenance labels + Task8 permit_allowed edges; hardcoded demo events stay labeled SIMULATION until real permit data exists.
- No placeholders: each task names exact files and concrete changes.
- Type consistency: `kind` (`actual-clean`/`actual-violation`), `predicted_tons`, `/api/tpa/queue-status` lat/lng, `edge_geometry`, `optimization_cost`/`physical_distance_km`/`eta_minutes`, `GpsBreadcrumb`/`latest_breadcrumbs` used consistently across tasks.
- Ordering note: Task 8 (OSRM edge geometry) is a prerequisite for Task 10 (breadcrumbs walk the OSRM geometry) and strengthens Task 4. Execute in number order.
