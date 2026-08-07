# Task 2 Report: Professional App Shell

## Status

Implemented and committed from base commit `d085476` in `D:\ai open presu lomba\jwis system\jwis`.

Commit: `d24f7e7 feat(ui): add professional JWIS app shell`

## Files

- Created `frontend/src/layout/AppShell.jsx`
- Created `frontend/src/ui/StatusBadge.jsx`
- Created `frontend/src/ui/MetricStrip.jsx`
- Modified `frontend/src/main.jsx`
- Modified `frontend/src/styles/shell.css`
- Modified `frontend/src/styles/components.css`
- Modified `frontend/src/styles/legacy.css`
- Modified `frontend/e2e/dashboard-shell.spec.js`

## TDD Evidence

### RED

Command:

```powershell
cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "three operational"
```

Result: exit code 1. The new test failed as required because `getByTestId("workspace-navigation")` found no element. Playwright reported `Expected: visible` and `element(s) not found` at `dashboard-shell.spec.js:11`.

### GREEN

Command:

```powershell
cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "three operational"
```

Result: exit code 0. `1 passed (1.8s)`.

During implementation, the initial browser render exposed the project's classic JSX requirement in each new JSX module. Adding `import React from "react";` to `AppShell`, `StatusBadge`, and `MetricStrip` resolved the `React is not defined` page errors. The responsive regression then identified a 375px overflow from the mobile side rail's inherited `flex-basis: 360px` and invalid `min(100% - Npx, ...)` width syntax. The corrected constrained mobile grid and `calc()` widths passed both targeted overflow tests.

## Verification Evidence

Command:

```powershell
cd frontend; npx playwright test e2e/dashboard-shell.spec.js e2e/map-workflow.spec.js --workers=1
```

Result: exit code 0. `14 passed (20.4s)`: 3 dashboard-shell tests and all 11 map-workflow tests passed with one worker.

Command:

```powershell
cd frontend; npm run build
```

Result: exit code 0. Vite 6.4.3 transformed 1589 modules and built in 11.39 seconds.

## Self-Review

- Confirmed the AppShell exposes the three required workspaces, the active button has `aria-current="page"`, and `workspace-navigation`, `status-badge`, `metric-strip`, and `metric-cell` use stable test IDs.
- Confirmed `CommandCenter` uses only `fleet`, `forecast`, and `planning` state values; the event simulation callback transitions to `planning`.
- Confirmed the default `fleet` workspace retains map rendering, selection callbacks, dispatch, WhatsApp, and related panel behavior.
- Confirmed AppShell continues to receive the existing online, refresh, logout, authentication, service-worker, FieldApp, and child-body behavior without changing their implementations.
- Confirmed legacy shell selectors were removed after replacements were added to the Task 2 style files.
- Confirmed the scoped diff has no whitespace errors.

## Concerns

- The known field workflow test failure was not run because it is outside Task 2 ownership.
- Vite reports existing large output chunks over 500 kB. The production build succeeds; code splitting is outside this task's scope.
- Backend files and `frontend/src/LiveFleetMap.jsx` remain modified by other work and were not staged or changed for this task.

## Focused Review Fix Pass

### Changes

- Changed the `Largest Waste Spike` metric from the non-semantic `accent` tone to the existing semantic `warning` tone. Indigo remains reserved for selected navigation and focus treatment.
- Changed `.status-badge` from `border-radius: 999px` to `border-radius: var(--ui-radius-control)`.
- Extended the existing shell navigation test to click `Waste Forecast`, `Integrated Planning`, and `Fleet Operations`. After each click it verifies that the selected button receives `aria-current="page"`, the app shell remains visible, and the refresh control remains usable.
- Preserved the pre-existing `event_lat` and `event_lng` request parameters, event refresh behavior, and conditional workspace mounting unchanged.

### Navigation Coverage Evidence

Command:

```powershell
cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "three operational"
```

Result: exit code 0. `1 passed (2.1s)`. The new click assertions passed because workspace navigation was already working, so this is regression coverage added after the primary Task 2 TDD cycle rather than a new RED/GREEN production-fix cycle.

### Focused Verification Evidence

Command:

```powershell
cd frontend; npx playwright test e2e/dashboard-shell.spec.js e2e/map-workflow.spec.js --workers=1
```

Result: exit code 0. `14 passed (22.1s)`.

Command:

```powershell
cd frontend; npm run build
```

Result: exit code 0. Vite 6.4.3 transformed 1589 modules and built in 13.48 seconds. The pre-existing chunk-size warning remains.
