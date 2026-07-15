# Task 6 Report: Professionalize Login, Field App, and Responsive Behavior

## Status

PASS. Task 6 is implemented on base `99aff5c6740849afc5ef7c26f7dee61add9f9a3b`.

The login, field app, dashboard shell, and responsive behavior now use the supplied professional admin visual target: a flat white 248px navigation rail, 72px white topbar, thin neutral dividers, compact controls and typography, connected metric strips, dense tables, lavender/indigo active and primary states, 6-8px radii, and minimal shadows. Green is reserved for semantic success/compliance states.

## Field Defect Root Cause

The defect was in frontend selection, not the backend contract.

1. `GET /api/dispatch/{truck_code}` returns pending dispatches ordered by `created_at ASC`.
2. Each response item includes an ISO `created_at`, `id`, `instruction`, and `field_status`.
3. `FieldApp` rendered `dispatches[0]`, so it always chose the oldest pending record. A newly posted E2E instruction could therefore be hidden behind an older optimizer instruction.
4. `FieldApp` now filters for valid `PENDING` records with a non-empty instruction and parseable `created_at`, selects the greatest timestamp, and breaks timestamp ties by `id` for deterministic behavior.

No backend file or contract was changed.

## TDD Evidence

### Baseline Reproduction

Command:

```powershell
npx playwright test e2e/field-workflow.spec.js --workers=1 -g "manager dispatch"
```

Result: `1 failed`.

The test posted `E2E: collect at Cengkareng`, but the UI rendered the older optimizer instruction `Collect 18t at cengkareng (plan PLAN-7e8f2ada)`.

### RED: Responsive, Focus, and Touch Contract

Command:

```powershell
npx playwright test e2e/dashboard-shell.spec.js e2e/field-workflow.spec.js --workers=1 -g "mobile shell|visible focus|minimum touch"
```

Result: `1 failed, 2 passed`.

- RED: mobile navigation trigger was absent.
- Existing focus and 44px field-control checks passed at baseline.

### RED: Newest Dispatch Regression

Command:

```powershell
npx playwright test e2e/field-workflow.spec.js --workers=1 -g "newest manager dispatch"
```

Result: `1 failed`.

The test posted an older and then a newer instruction and verified that the backend response exposed parseable `created_at` metadata. The UI still displayed the older optimizer instruction instead of the newly posted instruction.

### GREEN: Targeted Contracts

Responsive/focus/touch command:

```powershell
npx playwright test e2e/dashboard-shell.spec.js e2e/field-workflow.spec.js --workers=1 -g "mobile shell|visible focus|minimum touch"
```

Final result: `3 passed`.

The first implementation run produced `1 failed, 2 passed` because a flat icon-button rule overrode the shared focus shadow. A scoped `:focus-visible` override restored keyboard focus without adding default elevation.

Dispatch-ordering command:

```powershell
npx playwright test e2e/field-workflow.spec.js --workers=1 -g "newest manager dispatch"
```

Final result: `1 passed`.

## Full Verification

Required single-worker workflow suite:

```powershell
npx playwright test e2e/dashboard-shell.spec.js e2e/field-workflow.spec.js e2e/map-workflow.spec.js --workers=1
```

Result: `19 passed (26.9s)`.

Production build:

```powershell
npm run build
```

Result: PASS. Vite transformed `1593` modules and completed in `13.70s`.

Build output retained the non-failing advisory that the `html2pdf` and main JavaScript chunks exceed 500 kB after minification.

## Files

- `frontend/src/main.jsx`: restructured the login into a compact two-column JWIS access surface while preserving authentication storage, credentials, request handling, and errors.
- `frontend/src/field/FieldApp.jsx`: added deterministic newest-valid-pending selection and restyled the field workflow while preserving every test ID and confirmation/outbox flow.
- `frontend/src/layout/AppShell.jsx`: added stateful mobile navigation, `aria-expanded`, `aria-controls`, inert closed navigation, Escape handling, and close behavior.
- `frontend/src/styles/components.css`: added the flat white/indigo admin visual system for shell, login, field app, metrics, controls, and dense tables.
- `frontend/src/styles/responsive.css`: added off-canvas navigation, mobile workspace padding, 2-up metrics, stacked planning/field controls, 440px map height, and collapsible legend treatment.
- `frontend/e2e/dashboard-shell.spec.js`: added mobile navigation and computed focus visibility coverage.
- `frontend/e2e/field-workflow.spec.js`: added deterministic newest-dispatch, mobile overflow, and 44px touch-target coverage.

`AppShell` was extracted to `frontend/src/layout/AppShell.jsx` during Tasks 1-5, although the older Task 6 file list names `main.jsx` for the shell work. The Task 6 requirement explicitly calls for `mobileNavOpen` in `AppShell`; changing the extracted component was the smallest correct implementation.

## Preservation Checks

- Authentication localStorage keys and login request flow are unchanged.
- Demo roles and `<role>-demo-pass` credentials remain visible and functional.
- All existing FieldApp `data-testid` values are preserved.
- Offline outbox enqueue, automatic online sync, manual sync, and queue count behavior are unchanged.
- Dispatch READY/ISSUE request endpoints, payloads, notes, and status messaging are unchanged.
- Production service-worker registration and development unregister behavior are unchanged.
- Map provenance, labels, workflow behavior, and the dirty `LiveFleetMap.jsx` changes were not edited.
- Dirty backend files were not edited.
- No browser UI was used.

## Self-Review

- Accessibility: mobile navigation has a semantic button, stable accessible name, `aria-expanded`, `aria-controls`, inert/hidden closed state, backdrop close, and Escape close with focus restoration.
- Responsiveness: dashboard and field app have no document-level overflow at 375px; FieldApp action controls render at least 44px high; the map stage remains at least 440px high on narrow screens.
- Visual consistency: primary interaction and active navigation use indigo; green remains limited to semantic success/compliance; surfaces are white/light with `#e8eaf0` dividers and almost no shadows.
- Scope: only the seven implementation/test files above are intended for the Task 6 commit. Backend files, `LiveFleetMap.jsx`, generated cache data, and unrelated docs remain unstaged.
- Diff hygiene: scoped `git diff --check` passed. Repository-wide `git diff --check` still reports pre-existing trailing whitespace in dirty backend files, which this task does not own.

## Concerns

1. The production bundle passes but Vite reports large chunks (`html2pdf` about 985 kB and the main bundle about 1.35 MB before gzip). Code splitting is outside Task 6.
2. `frontend/src/layout/AppShell.jsx` is an implementation-path addition relative to the stale brief file list, required because Tasks 1-5 extracted `AppShell` from `main.jsx`.
3. Visual verification was limited to the required headless Playwright workflow assertions because the user explicitly prohibited browser UI use.
