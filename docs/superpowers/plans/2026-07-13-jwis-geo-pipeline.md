# JWIS Geospatial Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the JWIS map a defensible Google-Maps-grade geospatial system: pins on roads, road-following lines, marker-trail sync, admissible A*, meter-based deviation, and one backend source of truth — every layer labeled by provenance.

**Architecture:** A single backend map payload (`/api/fleet/map-truth`) provides, per truck: raw GPS, OSRM-snapped GPS, road-following assigned + actual + alternative geometry, meter-based deviation, traffic, permit, provenance, timestamp. Frontend only renders that payload. A* heuristic drops to zero (Dijkstra-equivalent, provably optimal on the small graph). All simulated data stays labeled.

**Tech Stack:** FastAPI, MapLibre GL, OSRM (route + match), Playwright.

## Global Constraints
- Never present simulated data as live — every layer/coordinate set carries provenance (`RAW_GPS_SIMULATED`, `SNAPPED_OSRM`, `MODEL`, `LIVE_EXTERNAL`, `FALLBACK_DEGRADED`).
- Road geometry comes from OSRM, never raw waypoint LineStrings.
- Backend keeps full suite green; frontend keeps build + e2e green.
- No framework swaps.

---

### Task 1: OSRM map-matching + road-following geometry helpers (backend)
**Files:** Modify `jwis/backend/app/osrm.py`; Test `jwis/backend/tests/test_osrm.py`
**Interfaces:** Produces `snap_to_road(lat,lng) -> {raw, snapped, source}` and `road_route(coords) -> {geometry, distance_km, duration_min, source}` (OSRM `/route` through ordered points; haversine fallback labeled `FALLBACK_DEGRADED`).
- [ ] Test: `snap_to_road` returns snapped point within 60m of a near-road input, source `SNAPPED_OSRM` (skip if OSRM down).
- [ ] Test: `road_route` over 2+ waypoints returns >20 geometry points or labeled fallback.
- [ ] Run tests, confirm fail (functions missing).
- [ ] Implement `snap_to_road` (OSRM `/nearest`) + `road_route` (OSRM `/route` full geometry) with labeled fallbacks.
- [ ] Run backend suite green.
- [ ] Commit `feat(geo): OSRM snap-to-road and road-following route helpers`.

### Task 2: Single map-truth payload (backend)
**Files:** Create `jwis/backend/app/map_truth.py`; Modify `jwis/backend/app/main.py`; Test `jwis/backend/tests/test_map_truth.py`
**Interfaces:** Produces `build_map_truth(truck) -> {truck_code, raw_gps, snapped_gps, assigned_route(road), actual_route(road), deviation_m, deviation_segments, recommendation, traffic, permit, provenance, timestamp}` and `GET /api/fleet/map-truth`.
- [ ] Test: payload has all keys; snapped_gps within 60m of raw; assigned/actual routes are road-following (>20 pts) or fallback-labeled.
- [ ] Test: deviation is a meter float; violation only when > threshold.
- [ ] Run tests, confirm fail.
- [ ] Implement `build_map_truth` (uses Task 1 helpers + engine point-to-segment) + endpoint returning all trucks.
- [ ] Run backend suite green.
- [ ] Commit `feat(geo): single map-truth payload as one source of geospatial truth`.

### Task 3: A* admissible heuristic (backend)
**Files:** Modify `jwis/backend/app/astar_routing.py`; Test `jwis/backend/tests/test_astar_routing.py`
**Interfaces:** A* heuristic = 0 (Dijkstra-equivalent) so the objective is provably optimal on the graph.
- [ ] Test: across a set of jam/permit scenarios, A* `optimization_cost` equals a directed-Dijkstra reference cost (no scenario worse).
- [ ] Run test, confirm fail against the current `/45` heuristic.
- [ ] Set heuristic to 0 (documented: admissible-by-construction on this small graph).
- [ ] Run backend suite green.
- [ ] Commit `fix(astar): zero heuristic guarantees Dijkstra-optimal cost`.

### Task 4: Frontend renders only map-truth; marker-trail sync (frontend)
**Files:** Modify `jwis/frontend/src/LiveFleetMap.jsx`; Test `jwis/frontend/e2e/map-workflow.spec.js`
**Interfaces:** Consumes `/api/fleet/map-truth`. Marker uses snapped_gps = actual-route endpoint. Assigned dashed-blue, actual green, deviation red-only-segment, alternative cyan, raw GPS small dots.
- [ ] Fetch map-truth; draw assigned/actual/alternative from road geometry; place marker at snapped endpoint.
- [ ] Add raw-GPS breadcrumb dots distinct from snapped marker.
- [ ] e2e: marker coordinate equals actual-route last point (sync); assigned line has >20 points.
- [ ] Build + e2e green.
- [ ] Commit `feat(map): render backend map-truth with marker-trail sync`.

### Task 5: Map UX — heatmap default off, auto-fit, collapsible mobile legend, provenance popup (frontend)
**Files:** Modify `jwis/frontend/src/LiveFleetMap.jsx`, `styles.css`; Test e2e
**Interfaces:** Heatmap default off; `fitBounds` to active fleet + TPA; legend collapsible on mobile; popup shows raw vs snapped, data age, source.
- [ ] Heatmap off by default (toggle on); auto-fit bounds on load.
- [ ] Collapsible legend under 640px; controls don't overlap markers.
- [ ] Popup: raw vs snapped coord, data age (s), provenance.
- [ ] e2e: mobile (375) no full-width legend overlap; heatmap layer hidden initially.
- [ ] Build + e2e green.
- [ ] Commit `feat(map): operational-first UX, provenance popups, mobile legend`.

### Task 6: Honest visual QA test (frontend)
**Files:** Modify `jwis/frontend/e2e/map-workflow.spec.js`
**Interfaces:** A real color-diversity check (distinct dominant colors on the map canvas), not compressed-PNG byte variance.
- [ ] Replace byte-variance with a decoded-pixel color-bucket count (a blank canvas fails; a rendered map with tiles+routes passes).
- [ ] e2e green.
- [ ] Commit `test(map): color-diversity visual check replaces byte-variance`.

## Self-Review
- Coverage: audit #1/#3→T1+T2, #2→T4, #4→T3, #5/#6→provenance labels across T2/T5, #7→T5, #8→T5, #9→T6. Traffic/GPS remain simulated but labeled (global constraint).
- Types consistent: `snap_to_road`, `road_route`, `build_map_truth`, `/api/fleet/map-truth` used across tasks.
- Honest scope: real traffic feed + real AVL GPS remain pilot dependencies; everything labeled, never called live.
