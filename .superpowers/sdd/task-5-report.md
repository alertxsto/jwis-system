# Task 5 Report: Integrated Planning Decision Flow

## Status

COMPLETE

- Base: `5ea859fcdd0b20ea4af381c97ab42cf7cff1c9b2`
- Commit: `548fcea` (`feat(ui): structure Integrated Planning decision flow`)
- Commit contents: exactly four Task 5 files

## Files

- Created `frontend/src/workspaces/IntegratedPlanning.jsx`
- Modified `frontend/src/main.jsx`
- Modified `frontend/src/styles/workspaces.css`
- Modified `frontend/e2e/workspace-layouts.spec.js`

## Implementation

- Added an un-nested, responsive three-stage planning workspace with explicit Scenario inputs, Recommended plan, and Evidence and approval regions.
- Kept `PlanningDecisionFlow` as the single owner of prediction, optimizer, approval, error, and success state.
- Made `ScenarioPanel` modes view-only; no second optimizer state owner or duplicate optimizer effect/API call is mounted.
- Preserved the existing attendance/rainfall sliders, scenario execution, prediction and optimizer request parameters, `event_lat`/`event_lng`, plan generation, assignment evidence, unmet-reason rendering, role/token handling, approval request, dispatch success state, and executive summary.
- Approval is rendered only for a proposed plan with zero `unmet_reasons`; unmet plans retain their warnings and show approval as unavailable.
- Added deterministic prediction and carbon endpoint fixtures to the layout test harness; production backend and Fleet code were not changed.

## TDD Evidence

### RED

Command:

`cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ordered decision"`

Result: exit 1, `1 failed`. The expected failure was at `workspace-layouts.spec.js:124`: `getByTestId('planning-workspace')` was not found.

### GREEN

Focused ordered flow:

`npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ordered decision"`

Result: exit 0, `1 passed (2.0s)`.

Focused unmet gate:

`npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "constraints are unmet"`

Result: exit 0, `1 passed (2.0s)`.

Focused ready plan and single optimizer request:

`npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ready plan"`

Result: exit 0, `1 passed (1.8s)`.

Final focused verification, including the previously failing Fleet layout case:

`npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "Queue, Route evidence|Integrated Planning"`

Result: exit 0, `4 passed (4.6s)`.

The earlier full one-worker workspace run produced `9 passed, 1 failed`; the only failure was the pre-existing Carbon impact tab waiting on a hanging live `/api/fleet/carbon` request. A focused rerun reproduced it. The owned Playwright harness now stubs that endpoint with `CarbonPanel`'s existing fallback values, and the failed test plus all Task 5 tests pass together. Per the instruction to avoid further broad runs, the full suite was not repeated after that deterministic fixture change.

## Build Evidence

Final command:

`cd frontend; npm run build`

Result: exit 0. Vite transformed 1,593 modules and completed in 12.08s.

## Self-Review

- Confirmed a single stateful planning owner and view-only `ScenarioPanel` modes.
- Confirmed optimizer generation remains user-triggered and the ready-plan test observes exactly one optimizer request.
- Confirmed unmet reasons control approval availability without backend changes.
- Confirmed original request parameter and approval payload construction remain unchanged.
- Confirmed stage sections are siblings, executive summary styling is flattened in stage 3, and responsive constraints prevent narrow-column overflow.
- Confirmed `git diff --cached --check` passed before commit.
- Confirmed the staged/committed paths were only the four Task 5 files; dirty backend files and `frontend/src/LiveFleetMap.jsx` remained unstaged and unmodified by Task 5.
- No in-app browser was used.

## Concerns

- Vite still reports the existing warning for chunks larger than 500 kB; the production build succeeds.
- The focused review follow-up supersedes the earlier suite caveat in the initial verification section: the required full workspace suite now passes all 10 tests with one worker.

## Focused Review Fix

- Review commit: `99aff5c` (`fix(ui): address planning flow review`)

### Findings Addressed

- Changed the 12px stage-marker foreground to white. The computed contrast for `#ffffff` on `--ui-accent` (`#6366e8`) is 4.569:1, and Playwright now computes and enforces a minimum of 4.5:1.
- Removed the planning workspace frame (border, radius, background, and shadow).
- Flattened `.optimizer-plan-card` into a transparent, borderless content group. The plan header is now a divider-backed background band; repeated assignment items remain cards.
- Standardized `.plan-status-badge` to the 6px control radius and kept planning panel/band radii within the 6-8px system.
- Moved the `/api/fleet/carbon` fixture out of global `beforeEach`; only the Carbon-impact test installs it and reloads the page.
- Removed the stage-2 role badge. The Decision authority region is the single visible role output; the original `role` and token authorization behavior is unchanged.
- Strengthened the ordered-flow test to require exactly one heading per stage, verify their actual DOM order, reject nested `.panel .panel` structures, and require one Decision authority/role output.

### Review RED Evidence

Command:

`cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ordered decision|ready plan"`

Result: exit 1, `2 failed`.

- Ordered decision failed because `.role-badge` had count 2 instead of 1 at `workspace-layouts.spec.js:169`.
- Ready plan failed because `.optimizer-plan-card` computed as `rgb(248, 250, 252)`, `1px` border, and `8px` radius instead of a transparent, borderless, 0px-radius content group at `workspace-layouts.spec.js:265`.

### Review GREEN Evidence

Focused command:

`cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ordered decision|ready plan"`

Result: exit 0, `2 passed (2.4s)`.

Required full workspace command:

`cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1`

Result: exit 0, `10 passed (8.5s)`.

### Review Build Evidence

Command:

`cd frontend; npm run build`

Result: exit 0. Vite transformed 1,593 modules and completed in 12.47s. The existing warning for chunks larger than 500 kB remains.

### Review Self-Review

- The planning workspace and optimizer result are unframed; only assignment items remain repeated cards.
- The planning DOM contains no `.panel .panel` nesting.
- Stage headings are unique and ordered Input, Recommendation, Approval in the DOM.
- Marker contrast and status radius are verified from computed browser styles.
- Carbon stubbing is isolated to the Carbon-impact test and cannot mask planning behavior.
- Role output is singular while approval authorization still uses the unchanged `role` and bearer token.
