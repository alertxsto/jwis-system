# JWIS Frontend — Documentation Index

Summary of the frontend redesign and the records produced while it was done.

## Current state

- `src/main.jsx` — application shell wiring and the workspace composition root.
  The 2,556-line monolith was decomposed; what remains is state, data loading,
  and the panels that belong to no workspace.
- `src/layout/AppShell.jsx` — navigation rail, command bar, mobile drawer.
- `src/workspaces/` — `FleetOperations`, `WasteForecast`, `IntegratedPlanning`.
- `src/components/` — operational panels (alert queue, fleet table, trip
  history, TPA queue, route evidence, carbon, weather, assistant, audit).
- `src/ui/` — design-system primitives (`MetricStrip`, `SegmentedControl`,
  `StatusPill`, `WorkspaceHeader`).
- `src/field/` — driver field app (offline-capable).
- `src/map/palette.js` — resolves design tokens into MapLibre paint values.
- `src/styles/` — `tokens` → `base` → `components` → `shell` → feature sheets →
  `responsive`.

`DESIGN.md` documents the visual system. `src/styles/tokens.css` is the single
source of truth for its values.

## Documents in `docs/`

| File | Purpose |
|---|---|
| [docs/frontend_audit.md](./docs/frontend_audit.md) | Findings from auditing the original frontend against the design-taste rules. |
| [docs/implementation_plan.md](./docs/implementation_plan.md) | The four-phase plan that structured the work. |
| [docs/task.md](./docs/task.md) | Task tracker for that plan. |
| [docs/walkthrough.md](./docs/walkthrough.md) | Record of the component extraction and CSS restructuring phases. |

## What changed

**Visual system.** One accent (DLH green) replaces the indigo default. Status
colours moved to AA-compliant steps: the previous `#ef4444` (4.0:1) and
`#f59e0b` (1.9:1) both failed contrast on white. Type, space, radius, and
control heights became fixed scales, so the console no longer changes its own
density with the viewport. Geist is bundled locally instead of loaded from a
CDN.

**Layout.** The rail is 216px and the command bar 48px, down from 248px and
72px, which returns vertical space to the map. Fleet Operations now puts the map
and its inspector side by side, so an alert and the corridor it describes are on
screen together — previously they were stacked and the operator scrolled away
from the map to read an alert about it. Map layer switches became a map overlay
instead of a card below the fold. Each workspace opens with the same header
component.

**Integrity.** Panels that presented fixture data as live operations were
relabelled: the weighbridge table, driver scores, and bin sensors now state that
they are simulated or sample data. The `116 menit` / `-59.6%` / `17.58 kg CO2`
figures that the backend already declares removed are no longer surfaced in the
UI copy.

**Dead weight.** Removed the duplicated `KpiCard` (one of two definitions was
never imported), the twin `StatusBadge` primitive, two Windows-only `patch_*.py`
scripts that no-op on Linux, a duplicate `.map-legend` block, a fully-overridden
`.optimizer-plan-card` rule, an unused voice-assistant CSS block, and the
`.audit-table` class that duplicated the base table styles. The legend swatches
moved from inline JSX styles to CSS.

**Tests.** `e2e/dashboard-shell.spec.js` no longer pins the palette: assertions
compare rendered values against the tokens, plus real WCAG contrast checks. The
suite also covers the workspace search, the map/inspector layout, and the
runtime-error-free navigation contract. `playwright.config.js` enables
SwiftShader so MapLibre can create a WebGL context in headless Chromium — without
it, every map assertion failed for reasons unrelated to the code.

## Verification

```bash
cd jwis/frontend
npm install
npm run build          # production build
npx playwright test    # 44 e2e tests, requires the API on :8001 and preview on :5175
```

```bash
cd jwis/backend
PYTHONPATH=. python -m unittest discover -s tests
```
