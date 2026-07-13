# JWIS Project Readiness Audit

Date: 2026-07-13
Scope: project quality only. Proposal and video production are excluded.

## Verdict

JWIS is a functional and technically substantial semifinal prototype, but it is
not yet winner-grade. It covers most visible surfaces requested by both DLH
cases, yet several critical requirements are implemented as disconnected demo
elements, static scenarios, or claims that conflict with other runtime values.

The highest-value work is not adding more features. It is making one coherent,
auditable decision loop:

`public/live input -> forecast -> operational plan -> approval -> driver action -> measured outcome`

## Authoritative competition sources

- Local case statement: `D:/ai open presu lomba/Waste - DLH.pdf`, pages 2-3.
- Official case link: https://drive.google.com/file/d/1vA3u118YrhmUJAo0xplHftXDAsV1sWQR/view
- Official AI Open page: https://ai-open.president.ac.id/
- Official Terms: https://ai-open.president.ac.id/assets/Terms_and_Conditions_upd.pdf
- Semifinal announcement: `C:/Users/HP/Downloads/Semifinalist Announcement 2026.pdf`, pages 5-6.

The official site asks for functional prototypes that address operational
inefficiency and demonstrate scalable, impactful outcomes. Terms explicitly
allow a participant to solve more than one case from the same provider. The
semifinal announcement lists JWIS Team in the DLH University & Public category,
with six other teams in that category.

## Fresh verification evidence

| Check | Result |
|---|---|
| Backend unit/API tests | 70/70 passed in 13.327 s |
| Frontend production build | Passed; 1,586 modules transformed |
| Frontend dependency audit | 0 known vulnerabilities |
| Playwright field workflow | 2/2 passed |
| Backend/frontend live health | HTTP 200 / HTTP 200 |
| Detailed health | DB up; 42 Prophet + 42 XGBoost; 13 source files |
| Heatmap | 267 kelurahan features |
| Open-Meteo | Live response received |
| OSRM | Live response: 5.1 km, 6 min, 192 path points |
| Desktop visual check | No horizontal overflow or console errors |
| Mobile 390x844 check | No horizontal overflow or console errors; page height 11,344 px |
| PDF export | Downloaded valid one-page A4 PDF and visually rendered |
| Prediction API latency | 3.858 s, 3.945 s, 4.818 s across three warm requests |
| Python environment | App tests pass; global `pip check` has unrelated Torch/SymPy conflict |

Passing tests prove implementation stability only. They do not eliminate the
case-coverage and truthfulness gaps below.

## Case 1 crosswalk

| Official requirement | Status | Implemented evidence | Gap |
|---|---|---|---|
| Monitor fleet position/activity in real time | Partial | MapLibre map, five trucks, 8 s dashboard polling | Positions are static server fixtures; no GPS/AVL ingest, WebSocket, or changing telemetry. `Live 30s` is misleading. |
| Detect route deviations or illegal activity | Partial | Point-to-polyline rules plus Isolation Forest | Isolation model receives default 30 km/h during fixture construction, not displayed actual speed. No unlicensed-collector or vehicle-license check. |
| Reporting directly followed up by managers/government | Mostly implemented | Action queue, persistent dispatch, history, field confirmation, WhatsApp adapter | OpenWA is unconfigured; most mutation endpoints are not authorization-protected. |
| Live tracking over a basemap | Implemented as demo | OpenFreeMap/MapLibre, assigned and actual paths, markers | Needs explicit `simulated telemetry` label until a real feed is connected. |
| Show damage, trip history, and real-time TPA queue | Partial | Damage state, trip table, TPA panel | Trip data and scale logs are fixtures. Command KPI says 47 trucks/116 min while TPA panel says 14 trucks/0.1 min. |
| Schedule using ETA, damage, landfill queue, other data | Partial | OSRM, queue simulation, damage state, CP-SAT optimizer exist | These factors are not combined in one optimization objective. CP-SAT uses capacity/availability/permit only. |
| Alternative routes account for traffic regulations/permits | Partial | OSRM evidence, A* demo, hardcoded `permit_compliant` routes | Permit/traffic/flood values are fixtures; OSRM and A* do not consume official permit corridors or live Jakarta traffic. |
| Simulator: scheduling, travel time, alternative routes | Partial | Three separate panels demonstrate these functions | They do not form one scenario with one consistent before/after result. |
| Executive summary optimizes schedule/reduces queues | Unsafe | Export works and PDF renders correctly | Export still states 42 mm rain and 116-minute critical queue regardless of live weather/TPA panel. |

## Case 2 crosswalk

| Official requirement | Status | Implemented evidence | Gap |
|---|---|---|---|
| Predict waste volume and location | Partial | 42-kecamatan hybrid model and 267-kelurahan heatmap | Daily district target is calibrated-synthetic and correctly marked unsupported; UI still emphasizes daily point values. |
| Integrate historical, weather, and event data | Critical partial | SILIKA/SIPSN/Bantargebang, Open-Meteo, holiday/event features | At 85,000 attendees, 28/42 models changed by exactly 0 tons. Cengkareng showed 0-ton event effect while UI claimed a spike. |
| Fleet and facility readiness recommendations | Partial | Truck, crew, man-hour and bin formulas; TPS proxy capacity | Recommendations are capacity formulas/proxies, not a validated operational standard. |
| Temporal and spatial mapping | Partial | Kecamatan map, heatmap, target-date API | Main scenario has no location/date selector and applies one attendance value to all 42 kecamatan. |
| Prediction based on crowd permits | Weak | Three permit cards and event markers | Permit numbers/events are hardcoded and disconnected from the official-event feed and forecast location. |
| Dashboard: crowded-area volume and man-hours | Implemented as scenario | Scenario panel and event cards | Event cards contain fixed outputs rather than model results. |
| Simulator: crowd, waste, facilities, fleet | Partial | Sliders and resource totals | No crowd location input; output is city-wide rather than localized to a permitted event. |
| Executive summary: optimize facilities, hours, schedule | Missing from UI | Backend CP-SAT plan/approve endpoints exist | Frontend never calls operations plan/approve; judges cannot see Case 2 become an approved Case 1 dispatch. |

## Critical findings

1. **One screen presents mutually contradictory operational truth.** The top KPI
   and exported summary say 47 trucks and 116 minutes; the TPA panel says 14
   trucks and 0.1 minutes with `NORMAL` status. Weather is +3%, while the summary
   says extreme 42 mm rain and +41% spike.

2. **The event requirement is not spatially integrated.** Event attendance has
   nonzero importance in only part of the city models. The UI applies one crowd
   value to every district, while hardcoded event permits carry locations but do
   not drive the model for those locations.

3. **`Live` is a simulation without a clear label.** Fleet positions, trip logs,
   weighbridge logs, and queue arrivals are fixtures. Polling static data is not
   real-time monitoring.

4. **The integrated winning story exists only in backend code.** CP-SAT can turn
   hotspots into assignments and approval into dispatches, but there is no UI
   for plan evidence, unmet demand, human approval, or field handoff.

5. **Unsupported impact claims remain visible.** Carbon panel reports 17.6 kg
   saved and a tree equivalence. Executive documents still claim 47 -> 19 trucks,
   527 kg/month, and response time below 12 hours. These conflict with the honest
   `/api/impact` contract.

6. **Operational security is incomplete.** Approval checks RBAC, but dispatch
   creation/confirmation, operations-plan creation, WhatsApp alerting, and
   history are unprotected. Frontend stores a token but does not use it for these
   requests. Tokens and plans are in process memory.

## Important findings

- Negative `active_trucks` is accepted by the stagger endpoint and clamped to 0;
  the current negative-input test only covers the inner simulation function.
- Queue simulation is reproducible but uncalibrated. Its 0.1-0.6 minute waits do
  not support the separate 116-minute narrative.
- The current fleet anomaly evaluation uses simulated pings. Its accuracy is not
  evidence of performance on real DLH telemetry.
- The daily per-kecamatan backtest is calibrated-synthetic; average individual
  kecamatan R2 is negative (-0.153). Use hotspot/weekly/city-level claims only.
- Prediction requests take about four seconds and multiple panels trigger similar
  model work. Models are reloaded from disk during inference.
- The desktop hierarchy is usable, but the single dashboard is 4,399 px tall;
  mobile reaches 11,344 px. It is difficult to tell a controlled judge story.
- Offline E2E proves queueing but does not assert the outbox becomes empty or the
  server receives the confirmation after reconnection.
- No frontend unit/component tests or accessibility audit are configured.
- `backend/app/main.py.bak` is tracked and stale, increasing review confusion.

## Competition compliance

| Rule | Audit result |
|---|---|
| More than one case from same provider | Allowed by official Terms |
| Original work | Project code is original-looking and dependencies are conventional; retain all third-party licenses/attribution |
| Institution branding prohibited | No educational institution branding was visible in the audited app |
| Fraud/unsupported claims | Current inconsistent `live` and impact language creates avoidable integrity risk |
| Team membership/age/attendance/payment | Cannot be verified from the repository; team leader must verify separately |

## Winner-grade execution order

### P0 - Truth and one source of state

1. Replace every 116/47/41/42 mm/carbon-saving fallback with scenario state or
   `unavailable`. Make command center, TPA, assistant, export, and impact consume
   the same queue/weather/forecast result.
2. Label every non-live source: `simulated telemetry`, `public data`, `proxy`,
   `modeled`, or `live external`.
3. Remove unsupported carbon, response-time, queue-reduction, and accuracy claims
   from all visible app and executive artifacts.

### P0 - Complete Case 2 data flow

4. Add event location/date/type/attendance input. Apply event impact only to the
   affected polygon and nearby areas.
5. Connect official events and public historical event outcomes to the scenario;
   mark fabricated permits as demo fixtures or remove their fake permit numbers.
6. Add contract tests proving rainfall, event attendance, holiday, and weekend
   produce explainable and directionally valid effects where applicable.

### P0 - Show the integrated decision

7. Expose `forecast -> CP-SAT plan -> supervisor approval -> field dispatch` in
   one judge-facing workflow with evidence and unmet-demand warnings.
8. Make optimizer inputs include ETA, queue slots, damage, capacity, and permit
   constraints, or narrow the claim to what it actually optimizes.

### P1 - Make Case 1 credible

9. Add a deterministic telemetry replay/ingest endpoint with timestamps and
   moving pings; clearly label it replay data. Pass actual speed into anomaly
   detection and test sustained deviations instead of one-point alerts.
10. Calibrate the queue simulator using the public three-shift/three-hour and
    308-to-190 disruption scenarios. Present assumptions and sensitivity, not a
    universal reduction percentage.
11. Protect all mutation/read-sensitive endpoints and use bearer tokens from the
    frontend. Persist approved plans and use expiring signed sessions.

### P1 - Judge experience

12. Replace the giant all-in-one scroll with three focused modes: `Case 1`,
    `Case 2`, and `Integrated Response`. Keep detailed evidence available but not
    in the primary narrative.
13. Cache loaded models and precompute the 42-area scenario so interactions feel
    immediate and remain stable if external services fail.
14. Extend Playwright to cover scenario change, plan approval, queue consistency,
    PDF contents, auth denial, and verified offline synchronization.

## Honest positioning

Use:

> JWIS is a functional decision-support prototype grounded in official public
> data. Live external weather and routing are combined with simulated fleet and
> queue telemetry. Forecast and impact limitations are explicitly disclosed.

Do not use:

- "validated/approved by DLH"
- "live DLH fleet/queue data"
- "real-world X% reduction"
- daily district accuracy based on calibrated-synthetic targets
- official crowd permits when the records are fixtures

