# JWIS Runtime & UX Audit — 2026-09-22

Scope: run every service on Linux, exercise every API and screen, check the
Case 1 fleet loop end-to-end, and assess usability for older/non-technical
DLH operators. Companion to `2026-07-13-project-readiness-audit.md`; items
from that audit that are still open are referenced, not repeated.

> **Status 2026-09-22 (later): every finding below is FIXED on branch
> `fix/audit-2026-09-22` → merged toward `main`.** 372/372 backend tests pass.
> Fix mapping: pyarrow+map-crash (Slice 0) · #4 SW, #11.4 error boundary, #9
> assistant fallback, #6 exec-summary+queue, #5 RBAC (all POSTs protected,
> 12 h tokens, auth-matrix tests) · #10 e2e determinism · #11 UX (tokens,
> login, ActionCard, nav 9→5, Indonesian FieldApp, `/pengawas`, main.jsx
> split 4469→502 lines) · #12 run-dev.sh, env template, dead-file cleanup.
> Screenshots of the new UX: `screenshots/`.

## Total UX redesign — 2026-09-23

The earlier pass improved font size and touch targets but retained the same
card-heavy information architecture. Operator feedback correctly rejected it
as enlargement rather than redesign. The command center has now been rebuilt
around task priority:

- New dark command rail and compact context bar replace the generic white
  dashboard shell.
- Armada uses a map/decision split: operational map on the left, exactly one
  priority action on the right, evidence below.
- Prediksi uses a demand-intelligence layout: district demand is primary;
  weather and events are supporting context.
- Rencana is a visible three-step flow: scenario, allocation, approval.
- Sopir combines a scan-first table with one coaching-priority inspector.
- Audit combines a provenance registry with model and fleet evidence rails.
- Login, `/field`, `/driver`, and `/pengawas` now share the same product
  identity and mobile interaction language.
- Desktop, tablet, and mobile layouts were visually checked. Mobile command
  navigation is a purpose-built bottom bar rather than a compressed sidebar.

Current visual evidence:
`01-login.png`, `02-fleet-actioncard-nav5.png`, `03-forecast.png`,
`04-field-indonesian.png`, `05-pengawas-mobile.png`, `06-planning.png`,
`07-drivers.png`, and `08-audit.png` in `screenshots/`.

## Armada command-deck redesign — 2026-09-23 (impeccable, direction A)

The map/decision split still treated the map and its controls as separate
boxes: a map panel, a static decision rail that did not know which truck was
selected, a detached `<details>` drawer holding the map's own layer controls,
and eight evidence tabs mixing three different jobs into one row. The Armada
workspace is now rebuilt as a single command deck — the map is the desk:

- **Full-bleed deck.** The map fills the remaining viewport height edge to
  edge; the workspace heading, metric strip, and a new problem strip sit in a
  compact head band so the deck always fits one screen.
- **Decision overlay.** One instrument panel floats over the map's right edge.
  Clicking any truck marker, table row, or the problem strip retargets it via
  `ActionCard`'s new `targetTruck` prop; trucks without an active alert show
  an informational state instead of a wrong action. The send/confirmed flow
  resets on every retarget so state never bleeds across trucks.
- **Problem strip.** Triage chips (deviasi rute, perawatan/kerusakan, antrean
  TPA) are derived from the same snapshot the map renders; clicking one
  focuses the map on the worst offender or jumps to the matching evidence tab.
- **Layers inside the map.** Layer toggles, route replay, legend, alert queue,
  and the A* traffic monitor moved from a detached drawer into a pinned
  overlay panel on the deck. The `.fleet-tools-drawer` is deleted.
- **Evidence regrouped.** Eight tabs became four operational tabs (Kondisi
  Armada, Riwayat, Antrean TPA, Bukti Rute) plus four document links (SPJ,
  Kerusakan, Kolektor Liar, Jejak Karbon) in the records heading.
- **Mobile.** The decision overlay collapses into a draggable bottom sheet;
  the deck shrinks to a working map window. Keyboard tabs follow the
  roving-tabindex pattern (selection and focus move together).

Direction was chosen through impeccable (`concept-seed` 9d49c75c, user locked
the map-led command deck). Mechanical detector is clean over the changed
targets. Review captures: `frontend/.impeccable/review/deck-*.png`.

## Runtime evidence

| Component | Result |
|---|---|
| Backend `uvicorn app.main:app` (Py 3.12 venv) | Up on :8001, warm-up 60 s |
| Backend pytest | 321 passed in 69 s |
| WA gateway `node server.js` (Node 22) | Up on :2785, Baileys connected, waiting for QR pairing |
| Frontend `vite build` + `preview` | Up on :5175, 2 chunks > 1 MB (`LiveFleetMap` 1.10 MB, `html2pdf` 0.98 MB) |
| 49 GET endpoints probed | All 200; slowest `/fleet/route-alternatives` 2.7 s |
| Fleet motion | 59/59 trucks change `raw_gps` between two `/fleet/map-truth` reads 9 s apart |
| Case 1 loop | Setujui & Kirim → `/api/dispatch` PENDING → `/field` Ready → PENDING list empty → dashboard syncs. Works. |

### Playwright e2e: 40 passed, 25 failed, 4 skipped (21.8 min)

README claims "42 tests, zero regressions". Failure classes:

- **21 fail on language.** Tests query English labels ("Fleet Operations",
  "Integrated Planning", "Generate Dispatch Plan (CP-SAT)") and one test
  literally asserts "visible dashboard copy is English-only". The app
  defaults to `jwis_lang = "id"`. The suite was last green on a machine whose
  browser profile had `EN` persisted in localStorage; it has never set the
  language itself. The suite is environment-dependent, not the app.
- **1 fails on a race.** `map-workflow › jam toggle`: `map-truth` for T-047
  returns `abandoned_route: null` for a window after the jam is toggled
  (4 s map-truth TTL vs `astar-reroute` computed fresh), so the test reads
  `.geometry` of `null`. The test already polls `astar-reroute`; it must
  poll `map-truth` too. Real product symptom: for up to 4 s the map and the
  A* panel disagree about whether a diversion is active.
- **3 fail on layout pixel assertions** (compact rows, card hierarchy) that
  differ at the Linux headless font metrics; brittle, not user-facing.

The July audit recorded "Playwright field workflow 2/2"; nobody has run the
full suite on a clean machine since.

## Defects fixed during this audit

### 1. Every district forecast was the flat 150 t fallback (fixed)

`/api/predictions/kecamatan` returned `predicted_tons: 150.0` and
`model_available: false` for all 42 kecamatan. Cause: `prophet_*.joblib`
were pickled with pandas 3 and need `pyarrow`, which was not in
`requirements.txt`. `engine._load_hybrid` swallowed the `ModuleNotFoundError`
with `except: pass`, and `/api/health/detailed` only counted files on disk, so
the system reported `healthy` while the entire Case 2 model layer was dead.

Fix: `pyarrow>=17` in `requirements.txt`; loader now logs the exception;
health check now attempts a real unpickle (`models.loadable`). After the fix:
42 distinct predictions (Cengkareng 475 t … Makasar 6 t delta) and a
40 mm / 80 k-attendance scenario at Senayan raises Palmerah/Tanah Abang/
Setiabudi by ~105 t while distant districts move < 10 t.

### 2. "Prediksi Timbulan Sampah" rendered a blank white page (fixed)

Switching workspaces after the map mounted threw
`TypeError: Cannot read properties of undefined (reading 'getLayer')` and
React unmounted the whole tree (`#root` empty, no error boundary). The map
mount effect's cleanup calls `map.remove()` before the SPJ-layer effect's
cleanup calls `map.getLayer`. Fix: `removeSpjLayers` returns early when
`map.style` is gone. Verified: 0 page errors across four workspace switches.

### 3. AI engine off by default (documented, not changed)

`/api/ai/events|tpa-queue-live|carbon-live|unlicensed-flags` are empty
unless `JWIS_AI_ENGINE=on`. `run-dev.ps1` and `launch_backend.bat` set it;
the README's `python -m uvicorn` instructions do not. Anyone following the
README gets an "AI-first" dashboard with an empty AI feed.

## Open defects (ordered by severity)

### Critical

**C1. Service worker serves stale bundles forever.** `public/sw.js` is
cache-first for every non-`/api` GET and never revalidates. After a rebuild,
`index.html` still references the old hashed chunk from cache. Fix #2 above
appeared not to work until the SW was unregistered by hand. In production
every operator keeps running the previous release until they clear site data.
Use network-first for navigations/HTML, or version the cache per build.

**C2. Authentication is decorative.** Login stores
`localStorage.jwis_auth = "true"`; `App` trusts it. Unauthenticated
`POST /api/dispatch`, `POST /api/whatsapp/contacts`, `POST /api/operations/plan`
all return 200. Only `/operations/{id}/approve` checks a token. `/field` has
no login at all and lets any phone pick any truck and confirm its orders.
`/driver` identifies drivers by tapping a name.

**C3. Contradictory numbers on one screen.** `executive_summary()` in
`main.py:648-651` defaults to "41 %, Jakarta Barat, 28 trucks, 14 crews" and
that is what ships (`/api/reports/executive-summary` says 41 % while
`/api/command-center` KPI says +4 %). `/api/fleet/route-decision` reports a
117-minute TPA queue while the TPA panel next to it says 15 minutes. Same
finding as July audit item 1; still open.

### High

**H1. Four workspaces are static JSX.** Pengawasan Gerbang ANPR, Analisis
Kinerja Driver (`88.75 %`, `main.jsx:3028`), Log Jembatan Timbang
(`main.jsx:3101`), Sensor TPS IoT (`main.jsx:3621`) render hardcoded arrays.
No API call, no loading state, no "simulated" label. They read as live.

**H2. Assistant returns a raw 500.** Without `OPENAI_API_KEY`,
`POST /api/assistant/query` → `{"detail":"AI gateway error: OPENAI_API_KEY is
not configured"}`. `.env.example` says "falls back to local responder"; it
does not.

**H3. Fleet alerts are not actionable.** 8 of 9 alerts are "reports
compactor issue" with `recommended_routes: []`; the only route-bearing
alert is the hardcoded T-047 → "Route B - Daan Mogot Recovery"
(`data.py:377`). The A* "Simulasikan Macet Koridor" button exists in
`i18n.jsx` but is not rendered anywhere in `main.jsx` — the July demo flow in
the README ("click A* Simulate Jam") cannot be performed from the UI.

**H4. No React error boundary.** Any render/effect exception blanks the
entire app (see fix #2). For a command center that is worse than a broken
panel.

### Medium

- `main.py` prints a masked API key and base URL to stdout at import.
- WhatsApp gateway starts with an unpaired session; `/api/whatsapp/status`
  says `configured: true, connected: false`. Dashboard "Peringatan WA"
  button still succeeds visually. Users cannot tell the message did not go out
  without opening the Gateway page.
- `GET /api/geo/wr-coordinates` is 2.2 MB, `/geo/kelurahan-heatmap` 1.0 MB,
  `/fleet/map-truth` 218 KB polled every 8 s per client.
- Repo hygiene: `main.py.bak`, `engine.py.bak`, `patch_*.py`, `verify_*.py`,
  three PNG screenshots, `pdf_extract.txt` (0 B), `yolov8n.pt` 6 MB and a
  17 MB MP4 are tracked.
- All launchers are Windows-only with hardcoded `D:\…` and
  `C:\Users\HP\…` paths.

## UX audit — older / non-technical operators

Measured on the desktop dashboard at 1440×900 after login.

| Metric | Value | Target |
|---|---|---|
| Leaf text nodes ≤ 11 px | 58 (16 @ 11 px, 30 @ 11.5 px, 10 @ 9 px, 2 @ 10 px) | 0; body ≥ 16 px, captions ≥ 14 px |
| `--ui-muted` (#7b7974) contrast on white / on muted surface | 4.35 : 1 / 4.05 : 1 | ≥ 7 : 1 (AAA) for the primary reading audience |
| Interactive targets < 32 px | 43 of 112 (map markers 14 px, ID/EN 31×23) | 0; ≥ 44 px |
| Dashboard scroll height | 3 294 px desktop, 4 307 px mobile (Fleet); 4 150 px (Forecast) | one screen per decision |
| Top-level nav items | 9, in three groups | ≤ 5 |
| Tabs inside Fleet workspace | 8 | ≤ 4 |
| Language consistency | ID default, but `/field` is 100 % English; map panel title/subtitle English; 254 `lang === "id"` inline ternaries vs 63 `t()` calls in `main.jsx` | one i18n path |

Concrete observations:

1. **Login.** Username prefilled with `dispatcher`, password hint printed
   under the field, labels 11 px uppercase. An older user must guess that
   the grey text is the password. Use 16 px labels, "Tampilkan sandi", a
   single big "Masuk" button.
2. **First screen is a wall.** Four KPI cards, a full-height map with ~60
   markers and 4 map controls, an action queue with 9 alerts × 3 buttons
   each (27 buttons, identical labels), then 8 tabs. There is no "what do I
   do now" element. A supervisor needs one card: *T-047 keluar koridor —
   [Kirim rute B ke sopir]*.
3. **Identical buttons.** "Setujui & Kirim / Peringatan WA / Tandai Selesai"
   repeated 9 times with no visual difference between the one alert that has
   a route and the eight that do not.
4. **Jargon.** "A* Heuristic (OSRM Grid)", "WAPE / MAE", "CP-SAT", "Diverted
   (A*)", "p95" appear on operator screens. Move to the Audit workspace.
5. **State feedback.** After "Setujui & Kirim" nothing on screen says where
   the instruction went; after "Peringatan WA" nothing says the gateway is
   unpaired. Every action needs a plain-language toast: *"Dikirim ke Agus
   (T-047). Menunggu konfirmasi sopir."*
6. **Field app** (the one drivers hold): English, 14 px, a free-text
   "Incident reason" box, and a `select` for truck code that lets a driver
   switch to any truck. Should be: name + truck fixed at login, two
   full-width 56 px buttons (*SIAP* / *ADA MASALAH*), Indonesian only,
   voice/photo for the problem report.
7. **Driver PWA** is the best screen in the product: Indonesian, big
   OK/TIDAK toggles, clear progress "0/7". Use it as the pattern for
   everything else.
8. **Mobile dashboard** is 4 307 px tall with the map at 55 % of viewport
   width; unusable on a phone. Either hide the dashboard on phones and route
   supervisors to a simplified "Pengawas" view, or collapse everything below
   the action card.
9. **Language switch** is a 31×23 px "ID | EN" toggle in the header;
   it does not apply to `/field`.
10. **Stale data risk**: with the SW bug (C1) an operator may act on a
    dashboard build from weeks ago with no indication.

## Recommended order

1. C1 service worker, C2 auth on mutation endpoints + `/field` login,
   H4 error boundary — these are correctness, one day of work.
2. C3: derive the executive summary from the same snapshot the KPIs use;
   remove the 41/28/14 defaults; make route-decision and TPA panel read one
   queue model.
3. Operator UX pass: 16 px base, 44 px targets, one action card above the
   fold, ≤ 5 nav items (Armada · Prediksi · Rencana · Sopir · Audit), tabs
   collapsed into the map's truck detail, `t()` everywhere, Indonesian
   `/field`.
4. H1: either wire the four static workspaces to endpoints (the backend
   already has `/api/cv/surveillance-feed`, `/api/compliance/drivers`,
   `/api/spj/*/receipt`) or label them "Contoh tampilan (data statis)".
5. H2/H3: local assistant fallback; render the jam-simulation control or
   drop the README claim.
6. Hygiene: delete `.bak`/patch/verify scripts and screenshots, move media
   and weights to Git LFS or a download step, add a Linux/macOS launcher.
