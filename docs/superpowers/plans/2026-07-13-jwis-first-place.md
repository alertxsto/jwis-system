# JWIS First-Place Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn JWIS from a broad competition prototype into a defensible, measurable, pilot-ready operating system that fully satisfies both DLH waste cases.

**Architecture:** Keep React/Vite, FastAPI, MapLibre, SQLite, Prophet/XGBoost, OSRM, and Open-Meteo. Replace fixed demo outputs with tested domain engines, make synthetic/proxy/live status explicit, persist operational state, and connect Case 2 predictions to Case 1 dispatch decisions through one auditable planning contract.

**Tech Stack:** React 19, Vite, MapLibre GL, FastAPI, Pydantic, SQLite, scikit-learn, Prophet, XGBoost, OSRM, Open-Meteo, Playwright.

## Global Constraints

- Do not use Streamlit.
- Preserve honest labels for real, derived, calibrated-synthetic, simulated, fallback, and live data.
- Never present simulated impact as observed field impact.
- Every operational recommendation must expose evidence, confidence, source freshness, and audit status.
- All domain changes use test-driven development and must keep the complete backend suite and frontend build passing.
- Do not display educational institution identity during competition activities.

---

### Task 1: Repair Data Contracts and Provenance

**Files:**
- Modify: `jwis/data/real/manifest.json`
- Modify: `jwis/data/sources/DATA_RESEARCH_SUMMARY.md`
- Modify: `jwis/backend/app/real_data.py`
- Modify: `jwis/backend/app/main.py`
- Test: `jwis/backend/tests/test_real_data.py`

**Interfaces:**
- Produces: `DataSourceStatus` records with `source_url`, `as_of`, `granularity`, `classification`, `row_count`, `freshness`, and `limitations`.
- Produces: `GET /api/data/provenance` with no stale or missing manifest paths.

- [ ] Write tests that fail when a manifest path is missing, a proxy is labeled official capacity, or a loaded dataset has no source URL.
- [ ] Run `python -m unittest tests.test_real_data -v` and confirm failures.
- [ ] Rebuild the manifest from the files currently under `jwis/data/real/` and classify every derived field.
- [ ] Replace the 10-feature heatmap source with `kelurahan_dki_full_267.geojson` and join model risk by administrative key.
- [ ] Add provenance and freshness fields to relevant API responses.
- [ ] Run the complete backend suite and verify 267 heatmap features.
- [ ] Commit as `fix(data): make JWIS provenance complete and auditable`.

### Task 2: Correct Route-Deviation Detection

**Files:**
- Modify: `jwis/backend/app/engine.py`
- Modify: `jwis/backend/app/data.py`
- Test: `jwis/backend/tests/test_engine.py`

**Interfaces:**
- Produces: `distance_point_to_polyline_m(position, path) -> float`.
- Produces: route alerts containing `rule_flags`, `ml_score`, `distance_meters`, `duration_seconds`, and `confidence`.

- [ ] Add a regression test proving a point at the midpoint of a route segment is not 553 metres off-route.
- [ ] Add tests for GPS noise, sustained deviation, unauthorized stop, excessive dwell, and abnormal speed.
- [ ] Run the tests and confirm the midpoint test fails against the current waypoint-only implementation.
- [ ] Implement point-to-segment distance and require sustained breach before a route alert becomes critical.
- [ ] Keep Isolation Forest as supporting evidence, not the only decision rule.
- [ ] Run all backend tests and a labelled trip-fixture evaluation.
- [ ] Commit as `fix(fleet): detect deviations against route segments`.

### Task 3: Replace the Fixed Queue Simulator

**Files:**
- Create: `jwis/backend/app/queue_simulation.py`
- Modify: `jwis/backend/app/engine.py`
- Modify: `jwis/backend/app/main.py`
- Test: `jwis/backend/tests/test_queue_simulation.py`

**Interfaces:**
- Consumes: arrival rate, service-time distribution, active weighbridges, dumping capacity, breakdown state, and dispatch slots.
- Produces: mean wait, P95 wait, maximum queue, throughput, utilization, confidence interval, and recommended slots.

- [ ] Add validation tests for negative trucks and zero throughput.
- [ ] Add deterministic tests with a fixed random seed for low, normal, and peak demand.
- [ ] Implement a discrete-event simulation rather than fixed 116/48 values.
- [ ] Run at least 100 seeded replications for impact intervals.
- [ ] Remove contradictory queue sources and make command center consume one queue service.
- [ ] Verify changing fleet count and weighbridge state changes all queue outputs logically.
- [ ] Commit as `feat(queue): add reproducible Bantargebang simulation`.

### Task 4: Build the Integrated Operations Optimizer

**Files:**
- Create: `jwis/backend/app/operations_optimizer.py`
- Modify: `jwis/backend/app/main.py`
- Modify: `jwis/backend/app/data.py`
- Test: `jwis/backend/tests/test_operations_optimizer.py`

**Interfaces:**
- Consumes: forecast demand, TPS/facility capacity, available fleet, vehicle damage, route ETA, permits, shifts, and queue state.
- Produces: `OperationalPlan` with truck, origin, facility, departure slot, route, crew, expected impact, and constraint evidence.

- [ ] Add OR-Tools and write tests for vehicle capacity, unavailable vehicles, time windows, and permit compliance.
- [ ] Add a test where a forecast hotspot causes a feasible additional dispatch.
- [ ] Implement the smallest feasible optimizer satisfying the tests.
- [ ] Expose `POST /api/operations/plan` and `POST /api/operations/{plan_id}/approve`.
- [ ] Persist approved plans and send plan tasks through the existing dispatch contract.
- [ ] Verify the full `predict -> plan -> approve -> field confirm -> audit` flow.
- [ ] Commit as `feat(operations): connect forecasts to fleet dispatch`.

### Task 5: Make Case 2 Evaluation Scientifically Defensible

**Files:**
- Modify: `jwis/scripts/train_models.py`
- Modify: `jwis/data/processed/hybrid_forecaster_evaluation.md`
- Modify: `jwis/backend/app/engine.py`
- Test: `jwis/backend/tests/test_forecast_contract.py`

**Interfaces:**
- Produces: baseline comparison, WAPE, MAE, MASE, prediction intervals, and per-resolution suitability.
- Produces: automatic fallback to a baseline when ML does not beat it.

- [ ] Add seasonal-naive, moving-average, and persistence baselines.
- [ ] Add rolling-origin evaluation without pooling away weak district-level performance.
- [ ] Separate observed targets from calibrated-synthetic scenario targets in every report.
- [ ] Add P10/P50/P90 output and model-suitability labels: city-day, district-week, district-month, hotspot rank.
- [ ] Prevent unsupported exact daily-district accuracy claims in API metadata.
- [ ] Re-run training only after the evaluation contract is reviewed.
- [ ] Commit as `feat(ml): benchmark and calibrate forecast uncertainty`.

### Task 6: Persist and Validate Operational Workflows

**Files:**
- Modify: `jwis/backend/app/storage.py`
- Modify: `jwis/backend/app/engine.py`
- Modify: `jwis/backend/app/main.py`
- Test: `jwis/backend/tests/test_storage.py`
- Test: `jwis/backend/tests/test_main_api.py`

**Interfaces:**
- Produces: persisted dispatch, confirmation, incident, and plan state across backend restarts.

- [ ] Add Pydantic minimum lengths, enums, valid truck references, and non-negative numeric constraints.
- [ ] Add database tables for dispatches and confirmations with migrations.
- [ ] Add restart-persistence tests.
- [ ] Return honest `configured: false, sent: false` for unconfigured OpenWA; put demo simulation under a separate explicit endpoint.
- [ ] Fix `deviations_detected` versus `deviations_count` contract mismatch.
- [ ] Run all lifecycle and invalid-input tests.
- [ ] Commit as `fix(workflow): persist and validate dispatch operations`.

### Task 7: Upgrade Field Operations and Mobile UX

**Files:**
- Create: `jwis/frontend/src/field/FieldApp.jsx`
- Create: `jwis/frontend/src/field/OfflineOutbox.js`
- Modify: `jwis/frontend/src/main.jsx`
- Modify: `jwis/frontend/src/styles.css`
- Modify: `jwis/frontend/public/sw.js`
- Test: `jwis/frontend/e2e/field-workflow.spec.js`

**Interfaces:**
- Consumes: persisted dispatch and route/task APIs.
- Produces: acknowledge, start, arrive, complete, incident, GPS timestamp, evidence attachment metadata, and offline synchronization states.

- [ ] Add Playwright tests for manager dispatch through field completion.
- [ ] Add tests for offline confirmation queued and later synchronized.
- [ ] Split Field App from the 1,500-line main module.
- [ ] Add task route, status timeline, incident reason, and clear degraded/offline banner.
- [ ] Replace the tall mobile sidebar with a compact navigation pattern.
- [ ] Verify 390x844, 768x1024, 1366x768, and 1920x1080 without overlap or horizontal scroll.
- [ ] Commit as `feat(field): complete auditable mobile task workflow`.

### Task 8: Add Security, Reliability, and Observability

**Files:**
- Create: `jwis/backend/app/auth.py`
- Create: `jwis/backend/app/observability.py`
- Modify: `jwis/backend/app/main.py`
- Create: `jwis/.env.example`
- Modify: `jwis/frontend/package.json`
- Test: `jwis/backend/tests/test_auth.py`
- Test: `jwis/backend/tests/test_health.py`

**Interfaces:**
- Produces: role-aware authentication, dependency-aware health, request IDs, structured logs, and model/data freshness status.

- [ ] Add role tests for executive, dispatcher, supervisor, driver, auditor, and administrator.
- [ ] Replace frontend-only `admin/admin123` authentication.
- [ ] Restrict CORS to configured frontend origins.
- [ ] Add health checks for SQLite, 42 models, source files, weather, and OSRM with degraded states.
- [ ] Add request logging without leaking keys or personal data.
- [ ] Upgrade Vite and DOMPurify dependency chain, then run `npm audit --omit=dev` until no high vulnerability remains.
- [ ] Create an isolated Python virtual environment and run `pip check` inside it.
- [ ] Commit as `feat(platform): harden JWIS for pilot deployment`.

### Task 9: Create the Evidence and Impact Harness

**Files:**
- Create: `jwis/scripts/evaluate_system.py`
- Create: `jwis/data/processed/system_impact_evaluation.md`
- Modify: `jwis/backend/app/main.py`
- Test: `jwis/backend/tests/test_impact_report.py`

**Interfaces:**
- Produces: reproducible baseline-versus-JWIS metrics for queue, distance, fuel/CO2, missed hotspot demand, alert precision/recall, and response time.

- [ ] Define every metric, unit, source, baseline, sample size, and confidence interval.
- [ ] Remove fixed carbon/tree and 58.6% claims from leadership outputs.
- [ ] Generate impact only from evaluation artifacts or live pilot measurements.
- [ ] Add an evidence view linking each KPI to the exact experiment and data classification.
- [ ] Run the evaluation from a clean checkout and compare hashes/results.
- [ ] Commit as `feat(evidence): make JWIS impact reproducible`.

### Task 10: Validate With DLH Users and Package a Pilot

**Files:**
- Create: `jwis/docs/pilot/INTERVIEW_PROTOCOL.md`
- Create: `jwis/docs/pilot/PILOT_PLAN.md`
- Create: `jwis/docs/pilot/VALIDATION_LOG.md`

**Interfaces:**
- Consumes: real stakeholder interviews and permitted operational samples.
- Produces: an eight-week pilot plan with owner, data agreement, risks, and measurable acceptance criteria.

- [ ] Interview at least one DLH/UPST operator, one driver or fleet supervisor, and one waste-management expert.
- [ ] Record current workflow, approval authority, data availability, queue causes, false-alert tolerance, and target KPIs.
- [ ] Obtain written permission before storing names, quotes, GPS logs, or operational screenshots.
- [ ] Scope a pilot of approximately 30 trucks, three districts, and one facility interface.
- [ ] Define pilot acceptance: route-alert precision/recall, dispatch response time, queue P95, collection SLA, and operator task success.
- [ ] Record product changes made from each stakeholder finding.
- [ ] Commit as `docs(pilot): define DLH validation and rollout`.

## User Inputs Required

- Confirm all registered JWIS team members and assign product, ML/data, backend/integration, frontend/UX, and field-validation owners.
- Ask the committee for the semifinal/final judging rubric, exact EV prize allocation, final-round format, and whether both DLH sub-cases are scored jointly.
- Arrange access to one DLH/UPST operator, one fleet supervisor/driver, and one waste-domain expert.
- Request anonymized GPS/AVL samples, route assignments, trip timestamps, vehicle status, weighbridge arrival/service/departure logs, and event-permit samples.
- Request official definitions for TPS capacity, legal route/permit constraints, queue SLA, truck capacities, shift rules, and escalation workflow.
- Provide a deploy target and domain decision after the local evidence gates pass.
- Do not obtain or share personal/operational data without authorization and anonymization.

## Final Acceptance Gate

- [ ] Both case-statement requirement matrices show no unsupported “done” item.
- [ ] All backend, frontend, E2E, model, simulation, and security checks pass fresh.
- [ ] No hardcoded impact is presented as observed reality.
- [ ] 267 kelurahan boundaries and all 42 district models have traceable sources.
- [ ] One end-to-end operational plan survives restart and completes through Field App.
- [ ] Every external fallback is visibly labeled degraded or simulated.
- [ ] At least three relevant stakeholders validate the workflow.
- [ ] Pilot plan is costed, owned, measurable, and executable by DLH.
