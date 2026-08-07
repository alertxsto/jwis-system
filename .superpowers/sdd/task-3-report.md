# Task 3 Report: Recompose Fleet Operations Around The Live Map

## RED Evidence

Command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "Fleet Operations|fleet detail"
```

Result: exit code 1 after 42.6 seconds. Both tests failed as expected before implementation:

- `fleet-workspace` was not found.
- The `Trip history` tab was not found.

## GREEN Evidence

Command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "Fleet Operations|fleet detail"
```

Result: exit code 0, `2 passed (2.4s)`.

Required regression command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js e2e/map-workflow.spec.js --workers=1
```

Result: exit code 0, `13 passed (20.4s)`. This includes both Fleet workspace layout tests and all Map workflow tests, including A* route, provenance, canvas, and mobile overflow checks.

## Build Evidence

Command:

```powershell
cd frontend; npm run build
```

Result: exit code 0, Vite built 1,590 modules in 12.09 seconds.

## Task 3 Files

- Created `frontend/src/workspaces/FleetOperations.jsx`
- Created `frontend/e2e/workspace-layouts.spec.js`
- Modified `frontend/src/main.jsx`
- Modified `frontend/src/styles/workspaces.css`
- Modified `frontend/src/styles/responsive.css`

## Self-Review

- `FleetOperations` receives only presentational slots and owns the metric strip, map-led stage, inspector, and single-active-detail-tab behavior.
- `MapPanel` remains the sole map-stage slot and retains its existing `LiveFleetMap` props and truck-selection callback.
- Alert dispatch, WhatsApp, A* rerouting, TPA queue, stagger simulation, fleet table, history filtering, carbon fetch, provenance, and existing API calls remain in their original components.
- Fleet-specific inline Case 1 grid columns were removed. Forecast and planning layouts retain their independent existing grid styles.
- `LiveFleetMap.jsx` and backend files were not modified or staged.

## Concerns

- Vite reports its existing chunk-size warning for `html2pdf` and the main bundle, but the build succeeds. This task does not change bundling strategy.

## Review Fix Pass Evidence

### RED

Command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1
```

Final focused RED result: exit code 1 after 45.5 seconds, with `4 passed` and `2 failed`.

- `dispatching a truck opens filtered Trip history` failed because the visible `View T-047 trip history` production control was absent.
- `fleet detail tabs use roving focus with automatic keyboard selection` failed because the selected tab had no `tabindex="0"`.

The first version of the map-popup E2E interaction was not retained because MapLibre's continuously animated marker prevented headless Playwright from reliably opening the popup. The regression now uses a visible production Fleet-table action which routes through the same `CommandCenter` truck-selection callback used by the map popup.

### GREEN

Focused command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1
```

Result: exit code 0, `6 passed (9.5s)`. Coverage includes the dispatch-to-filtered-history flow, Queue, Route evidence, Carbon impact, roving keyboard navigation, ARIA selection/linkage, and 375px no-overflow/minimum-height behavior.

Required regression command:

```powershell
cd frontend; npx playwright test e2e/workspace-layouts.spec.js e2e/map-workflow.spec.js --workers=1
```

Result: exit code 0, `17 passed (27.6s)`.

Build command:

```powershell
cd frontend; npm run build
```

Result: exit code 0, Vite built 1,590 modules in 12.73 seconds.

### Review Fix Changes

- Lifted Fleet detail-tab state into `CommandCenter` and used a single truck-selection callback for the map and Fleet table.
- Opening truck history now selects the `history` detail tab before the post-render scroll to `#history-panel`, retaining the selected truck filter.
- Added an explicit visible Trip history action to each Fleet table row for reliable access to the same production flow.
- Added automatic-activation roving tabs: `ArrowLeft`, `ArrowRight`, `Home`, and `End` move focus and selection while maintaining `aria-controls` and `aria-labelledby` linkage.
