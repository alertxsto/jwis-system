# JWIS Professional Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete JWIS frontend as a coherent, professional light operations dashboard using the supplied SaaSAble references for layout discipline while preserving every existing JWIS workflow.

**Architecture:** Keep React, Vite, MapLibre, Lucide, existing API contracts, and existing stateful feature functions. Introduce a shared CSS design system, a reusable app shell, and three presentational workspace components that receive existing panels as explicit slots; this lowers migration risk while removing the current single-page composition. Tests remain Playwright-based because the repository has no component-test runner.

**Tech Stack:** React 19, Vite 6, MapLibre GL 5, Lucide React, native CSS, Playwright 1.61.

## Global Constraints

- Preserve all current backend endpoints, request payloads, map behavior, dispatch behavior, offline field behavior, and provenance labels.
- Do not replace React, Vite, MapLibre, or Lucide and do not add a second component library.
- Use the supplied screenshots for app-shell structure, density, spacing, borders, tabs, tables, charts, and control treatment; do not copy SaaSAble branding, logo, content, people, or source code.
- JWIS green is the primary-action color; light indigo/lavender is limited to selection, tabs, focus, and selected rows.
- Target WCAG 2.2 AA, visible keyboard focus, text/icon status reinforcement, and reduced-motion support.
- Use 6-8px radii for framed controls and surfaces, restrained shadows, zero letter spacing, and no decorative gradients, glass effects, nested cards, or ornamental animation.
- Do not use the in-app browser. Run Playwright headless with `--workers=1`, trace off, and no video.
- The working tree already contains user changes in backend and frontend files. Never revert them, and stage only files named by the active task.

## Target File Structure

```text
frontend/src/
  api.js                         API base URL and JSON request helper
  layout/AppShell.jsx            sidebar, topbar, workspace navigation
  ui/MetricStrip.jsx             connected metric cells
  ui/SegmentedControl.jsx        workspace-local mode switch
  ui/StatusBadge.jsx             semantic status/provenance badge
  workspaces/FleetOperations.jsx map-led Case 1 composition
  workspaces/WasteForecast.jsx   chart-led Case 2 composition
  workspaces/IntegratedPlanning.jsx constraint-to-dispatch composition
  styles.css                     CSS import manifest
  styles/tokens.css              color, type, spacing, radius, z-index tokens
  styles/base.css                reset, typography, focus, page canvas
  styles/shell.css               sidebar, topbar, navigation, metric strip
  styles/components.css          buttons, badges, tabs, tables, form controls
  styles/workspaces.css          three workspace layouts and map inspector
  styles/responsive.css          laptop, tablet, and mobile adaptations
  styles/legacy.css              existing feature-specific rules during migration
frontend/e2e/
  dashboard-shell.spec.js        shell, navigation, accessibility, responsive contract
  workspace-layouts.spec.js      Case 1, Case 2, optimizer workflow contract
```

---

### Task 1: Lock The Existing Behavior And Establish The Design Tokens

**Files:**
- Create: `frontend/e2e/dashboard-shell.spec.js`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/base.css`
- Create: `frontend/src/styles/legacy.css`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: current authenticated dashboard at `/` and existing `.dashboard-frame`, `.side-rail`, `.topbar`, `.primary-button` elements.
- Produces: CSS tokens `--ui-accent`, `--ui-primary`, `--ui-canvas`, `--ui-surface`, `--ui-border`, `--ui-ink`, `--ui-muted`, `--ui-danger`, `--ui-warning`, `--ui-success`, `--ui-radius`, and a stable CSS import order.

- [ ] **Step 1: Write failing token and baseline tests**

```js
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("dashboard exposes the professional design token contract", async ({ page }) => {
  const tokens = await page.locator("html").evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      primary: css.getPropertyValue("--ui-primary").trim(),
      accent: css.getPropertyValue("--ui-accent").trim(),
      radius: css.getPropertyValue("--ui-radius").trim(),
    };
  });
  expect(tokens).toEqual({ primary: "#176b54", accent: "#6366e8", radius: "8px" });
});

test("desktop and mobile have no document-level horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  }
});
```

- [ ] **Step 2: Run the token test and verify RED**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "design token"`

Expected: FAIL because `--ui-primary`, `--ui-accent`, and `--ui-radius` do not exist.

- [ ] **Step 3: Preserve legacy CSS and create the import manifest**

Run: `Move-Item -LiteralPath frontend/src/styles.css -Destination frontend/src/styles/legacy.css`

Create `frontend/src/styles.css`:

```css
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/legacy.css";
@import "./styles/shell.css";
@import "./styles/components.css";
@import "./styles/workspaces.css";
@import "./styles/responsive.css";
```

Create `frontend/src/styles/tokens.css`:

```css
:root {
  --ui-primary: #176b54;
  --ui-primary-hover: #125743;
  --ui-accent: #6366e8;
  --ui-accent-soft: #eef0ff;
  --ui-canvas: #f7f8fb;
  --ui-surface: #ffffff;
  --ui-surface-muted: #f3f5f8;
  --ui-border: #e3e7ee;
  --ui-border-strong: #cbd3df;
  --ui-ink: #17202a;
  --ui-muted: #657180;
  --ui-success: #177a57;
  --ui-warning: #a46108;
  --ui-danger: #bd2c2c;
  --ui-info: #117f9b;
  --ui-radius: 8px;
  --ui-radius-control: 6px;
  --ui-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  --ui-sidebar-width: 248px;
  --ui-topbar-height: 72px;
  --ui-focus: 0 0 0 3px rgba(99, 102, 232, 0.24);
  --z-dropdown: 20;
  --z-sticky: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-toast: 60;
  --z-tooltip: 70;
}
```

Create `frontend/src/styles/base.css`:

```css
* { box-sizing: border-box; }
html { color: var(--ui-ink); background: var(--ui-canvas); font-family: Geist, Inter, "Segoe UI", sans-serif; letter-spacing: 0; }
body { margin: 0; min-width: 320px; background: var(--ui-canvas); color: var(--ui-ink); }
button, input, select, textarea { font: inherit; letter-spacing: 0; }
button, a, input, select, textarea { outline: none; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  box-shadow: var(--ui-focus);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Create empty import targets containing only a file-purpose comment: `shell.css`, `components.css`, `workspaces.css`, and `responsive.css`.

- [ ] **Step 4: Run tests and build to verify GREEN**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "design token"; npm run build`

Expected: token test PASS and Vite build PASS.

- [ ] **Step 5: Commit only the foundation files**

```powershell
git add frontend/e2e/dashboard-shell.spec.js frontend/src/styles.css frontend/src/styles/tokens.css frontend/src/styles/base.css frontend/src/styles/legacy.css frontend/src/styles/shell.css frontend/src/styles/components.css frontend/src/styles/workspaces.css frontend/src/styles/responsive.css
git commit -m "feat(ui): establish JWIS professional design foundation"
```

---

### Task 2: Build The Professional App Shell

**Files:**
- Create: `frontend/src/layout/AppShell.jsx`
- Create: `frontend/src/ui/StatusBadge.jsx`
- Create: `frontend/src/ui/MetricStrip.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles/shell.css`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/e2e/dashboard-shell.spec.js`

**Interfaces:**
- Consumes: `activeWorkspace: "fleet" | "forecast" | "planning"`, `onWorkspaceChange(id)`, `online`, `onRefresh`, `onLogout`, and React children.
- Produces: `AppShell`, `StatusBadge`, and `MetricStrip` components with stable `data-testid` attributes.

- [ ] **Step 1: Add failing shell navigation test**

```js
test("app shell provides three operational workspaces", async ({ page }) => {
  const nav = page.getByTestId("workspace-navigation");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Fleet Operations" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Waste Forecast" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Integrated Planning" })).toBeVisible();
});
```

- [ ] **Step 2: Run shell test and verify RED**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "three operational"`

Expected: FAIL because `workspace-navigation` is absent.

- [ ] **Step 3: Implement the shell components**

Create `frontend/src/layout/AppShell.jsx` with this public shape:

```jsx
import { Activity, BarChart3, LogOut, RefreshCcw, Route, Truck, Workflow } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const items = [
  { id: "fleet", label: "Fleet Operations", icon: Truck },
  { id: "forecast", label: "Waste Forecast", icon: BarChart3 },
  { id: "planning", label: "Integrated Planning", icon: Workflow },
];

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, children }) {
  const current = items.find((item) => item.id === activeWorkspace) || items[0];
  return <div className="dashboard-frame professional-shell">
    <aside className="side-rail" aria-label="JWIS navigation">
      <div className="side-brand"><span className="brand-mark"><Route size={19} /></span><div><strong>JWIS</strong><small>DLH Command</small></div></div>
      <p className="nav-section-label">Operations</p>
      <nav className="side-nav" data-testid="workspace-navigation">
        {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`} aria-current={activeWorkspace === id ? "page" : undefined} onClick={() => onWorkspaceChange(id)}><Icon size={17} />{label}</button>)}
      </nav>
      <div className="side-system-state"><Activity size={15} /><span>System status</span><StatusBadge tone={online ? "success" : "warning"}>{online ? "Connected" : "Demo fallback"}</StatusBadge></div>
      <button className="side-logout" type="button" onClick={onLogout}><LogOut size={17} />Logout</button>
    </aside>
    <main className="app-shell" id="overview">
      <header className="topbar">
        <div className="breadcrumb"><span>JWIS</span><span>/</span><strong>{current.label}</strong></div>
        <div className="top-actions"><StatusBadge tone={online ? "success" : "warning"}>{online ? "API connected" : "Offline demo"}</StatusBadge><a className="ghost-button" href="/field"><Truck size={16} />Field app</a><button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh command center"><RefreshCcw size={17} /></button></div>
      </header>
      <div className="workspace-canvas">{children}</div>
    </main>
  </div>;
}
```

Create `StatusBadge.jsx` as `<span className={`status-badge status-${tone}`}>{children}</span>`. Create `MetricStrip.jsx` to render a `<section className="metric-strip">` containing connected `<article className="metric-cell">` elements from `{ label, value, helper, tone }[]`.

Replace the current sidebar/topbar wrappers in `CommandCenter` with `AppShell`; rename state values `case1`, `case2`, and `integrated` to `fleet`, `forecast`, and `planning` without changing panel behavior.

Add shell CSS with a 248px fixed grid column, 72px topbar, white surfaces, 1px borders, 6-8px radii, indigo selected navigation, and green primary actions. Remove the old `.topbar`, `.side-rail`, `.nav-tab-btn`, `.app-shell`, and `.kpi-grid` declarations from `legacy.css` after their replacements exist.

- [ ] **Step 4: Verify shell, existing map, and build**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js e2e/map-workflow.spec.js --workers=1; npm run build`

Expected: shell tests PASS, all existing map tests PASS, build PASS.

- [ ] **Step 5: Commit the shell**

```powershell
git add frontend/src/layout/AppShell.jsx frontend/src/ui/StatusBadge.jsx frontend/src/ui/MetricStrip.jsx frontend/src/main.jsx frontend/src/styles/shell.css frontend/src/styles/components.css frontend/src/styles/legacy.css frontend/e2e/dashboard-shell.spec.js
git commit -m "feat(ui): add professional JWIS app shell"
```

---

### Task 3: Recompose Fleet Operations Around The Live Map

**Files:**
- Create: `frontend/src/workspaces/FleetOperations.jsx`
- Create: `frontend/e2e/workspace-layouts.spec.js`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles/workspaces.css`
- Modify: `frontend/src/styles/responsive.css`

**Interfaces:**
- Consumes: slot props `metrics`, `map`, `alerts`, `routeEvidence`, `rerouting`, `queue`, `fleetTable`, `history`, and `carbon`.
- Produces: a map-led layout with `data-testid="fleet-workspace"`, `data-testid="fleet-map-stage"`, and tabs `fleet`, `history`, `queue`, `evidence`, `impact`.

- [ ] **Step 1: Write failing Fleet Operations layout tests**

```js
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("Fleet Operations is the default map-led workspace", async ({ page }) => {
  await expect(page.getByTestId("fleet-workspace")).toBeVisible();
  await expect(page.getByTestId("fleet-map-stage")).toBeVisible();
  const mapBox = await page.getByTestId("fleet-map-stage").evaluate((el) => el.getBoundingClientRect());
  expect(mapBox.width).toBeGreaterThan(650);
  expect(mapBox.height).toBeGreaterThan(460);
});

test("fleet detail tabs reveal one operational surface at a time", async ({ page }) => {
  const history = page.getByRole("tab", { name: "Trip history" });
  await history.click();
  await expect(page.getByTestId("fleet-history-surface")).toBeVisible();
  await expect(page.getByTestId("fleet-table-surface")).toBeHidden();
});
```

- [ ] **Step 2: Run Fleet Operations tests and verify RED**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "Fleet Operations|fleet detail"`

Expected: FAIL because fleet workspace and tab contracts are absent.

- [ ] **Step 3: Implement the map-led composition**

Create `FleetOperations.jsx` with internal `detailTab` state, a `MetricStrip` at the top, a two-column `.fleet-stage` containing `.fleet-map-stage` and `.fleet-inspector`, and a tablist below. Render only the active lower surface. Use these exact tab IDs and labels: `fleet/Fleet`, `history/Trip history`, `queue/TPA queue`, `evidence/Route evidence`, `impact/Carbon impact`.

In `CommandCenter`, construct metrics from `snapshot.kpis` and pass existing panel instances as slots. Put `AlertQueue` and `AStarReroutingPanel` in the inspector; keep `MapPanel` as the only map stage. Remove Case 1 inline grid-column styles.

CSS contract:

```css
.fleet-stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 560px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-surface); }
.fleet-map-stage { position: relative; min-width: 0; min-height: 560px; border-right: 1px solid var(--ui-border); }
.fleet-map-stage .maplibre-shell, .fleet-map-stage .maplibre-container { height: 100%; min-height: 560px; border-radius: 0; }
.fleet-inspector { min-width: 0; overflow: auto; background: var(--ui-surface); }
.workspace-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--ui-border); }
.workspace-tab[aria-selected="true"] { color: var(--ui-accent); border-bottom-color: var(--ui-accent); }
```

- [ ] **Step 4: Verify Fleet Operations and map regressions**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js e2e/map-workflow.spec.js --workers=1; npm run build`

Expected: Fleet tests PASS, map tests PASS, build PASS.

- [ ] **Step 5: Commit Fleet Operations**

```powershell
git add frontend/src/workspaces/FleetOperations.jsx frontend/src/main.jsx frontend/src/styles/workspaces.css frontend/src/styles/responsive.css frontend/e2e/workspace-layouts.spec.js
git commit -m "feat(ui): make Fleet Operations map-led"
```

---

### Task 4: Build The Waste Forecast Workspace

**Files:**
- Create: `frontend/src/ui/SegmentedControl.jsx`
- Create: `frontend/src/workspaces/WasteForecast.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/styles/workspaces.css`
- Modify: `frontend/e2e/workspace-layouts.spec.js`

**Interfaces:**
- Consumes: `metrics`, `forecast`, `weather`, `events`, `districts`, `assistant`, `voice`, and `reportActions` slots.
- Produces: chart-led `data-testid="forecast-workspace"` and synchronized display controls using `SegmentedControl({ value, options, onChange, label })`.

- [ ] **Step 1: Add failing forecast hierarchy test**

```js
test("Waste Forecast uses one dominant analysis surface", async ({ page }) => {
  await page.getByRole("button", { name: "Waste Forecast" }).click();
  await expect(page.getByTestId("forecast-workspace")).toBeVisible();
  await expect(page.getByTestId("forecast-primary-analysis")).toBeVisible();
  await expect(page.getByTestId("forecast-driver-rail")).toBeVisible();
  await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run forecast test and verify RED**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "Waste Forecast"`

Expected: FAIL because `forecast-workspace` is absent.

- [ ] **Step 3: Implement forecast composition**

Create `SegmentedControl.jsx`:

```jsx
export function SegmentedControl({ label, value, options, onChange }) {
  return <div className="segmented-control" role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
```

Create `WasteForecast.jsx` with local `horizon = "7d"`, options `7 days`, `14 days`, `30 days`, a `MetricStrip`, `.forecast-analysis-grid` containing the forecast slot as the primary analysis and weather/events as the driver rail, then a full-width districts slot. Place assistant, voice, and report actions in one `.forecast-tools` toolbar below the operational data; do not render them as three equal cards.

In `CommandCenter`, replace Case 2 inline grid-column wrappers with `WasteForecast` and preserve the existing event-to-planning callback.

- [ ] **Step 4: Verify forecast, shell, and build**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js e2e/dashboard-shell.spec.js --workers=1; npm run build`

Expected: forecast and shell tests PASS, build PASS.

- [ ] **Step 5: Commit Waste Forecast**

```powershell
git add frontend/src/ui/SegmentedControl.jsx frontend/src/workspaces/WasteForecast.jsx frontend/src/main.jsx frontend/src/styles/components.css frontend/src/styles/workspaces.css frontend/e2e/workspace-layouts.spec.js
git commit -m "feat(ui): build chart-led Waste Forecast workspace"
```

---

### Task 5: Build The Integrated Planning Decision Flow

**Files:**
- Create: `frontend/src/workspaces/IntegratedPlanning.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles/workspaces.css`
- Modify: `frontend/e2e/workspace-layouts.spec.js`

**Interfaces:**
- Consumes: `summary`, `scenario`, and `evidence` React slots plus `unmetCount: number`.
- Produces: three-stage `data-testid="planning-workspace"` with explicit Input, Recommendation, and Approval regions.

- [ ] **Step 1: Add failing planning-flow test**

```js
test("Integrated Planning presents an ordered decision flow", async ({ page }) => {
  await page.getByRole("button", { name: "Integrated Planning" }).click();
  const workspace = page.getByTestId("planning-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Scenario inputs" })).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Recommended plan" })).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Evidence and approval" })).toBeVisible();
});
```

- [ ] **Step 2: Run planning test and verify RED**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1 -g "ordered decision"`

Expected: FAIL because the ordered flow is absent.

- [ ] **Step 3: Implement Integrated Planning**

Create a three-column `IntegratedPlanning` component. Each column is an un-nested `.decision-stage` section with a numbered circular marker used only because this is a true ordered sequence. Render scenario controls in stage 1, optimizer recommendation in stage 2, and summary/evidence in stage 3. Display `<StatusBadge tone="danger">{unmetCount} constraints unmet</StatusBadge>` when `unmetCount > 0`; otherwise display `<StatusBadge tone="success">Ready for approval</StatusBadge>`.

Modify `ScenarioPanel` to accept `mode="inputs" | "recommendation"` so existing controls and generated-plan output can be placed into their correct stages without duplicating API calls. Keep optimizer approval logic and payload unchanged.

- [ ] **Step 4: Verify planning and production build**

Run: `cd frontend; npx playwright test e2e/workspace-layouts.spec.js --workers=1; npm run build`

Expected: all workspace tests PASS and build PASS.

- [ ] **Step 5: Commit Integrated Planning**

```powershell
git add frontend/src/workspaces/IntegratedPlanning.jsx frontend/src/main.jsx frontend/src/styles/workspaces.css frontend/e2e/workspace-layouts.spec.js
git commit -m "feat(ui): structure Integrated Planning decision flow"
```

---

### Task 6: Professionalize Login, Field App, And Responsive Behavior

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/field/FieldApp.jsx`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/styles/responsive.css`
- Modify: `frontend/e2e/dashboard-shell.spec.js`
- Modify: `frontend/e2e/field-workflow.spec.js`

**Interfaces:**
- Consumes: existing authentication local-storage contract and existing field-app test IDs.
- Produces: consistent JWIS controls and responsive shell without changing authentication or offline dispatch behavior.

- [ ] **Step 1: Add failing responsive and accessibility tests**

```js
test("mobile shell collapses navigation and preserves workspace access", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const trigger = page.getByRole("button", { name: "Open workspace navigation" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId("workspace-navigation")).toBeVisible();
});

test("primary controls expose visible focus", async ({ page }) => {
  const refresh = page.getByRole("button", { name: "Refresh command center" });
  await refresh.focus();
  const shadow = await refresh.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
});
```

Extend `field-workflow.spec.js` with a 375px viewport assertion that `documentElement.scrollWidth <= innerWidth + 2` and that all `[data-testid="btn-ready"]` controls have a minimum 44px rendered height.

- [ ] **Step 2: Run responsive tests and verify RED**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js e2e/field-workflow.spec.js --workers=1 -g "mobile shell|visible focus|minimum touch"`

Expected: mobile navigation test FAIL because no mobile trigger exists.

- [ ] **Step 3: Implement responsive shell and consistent auth/field styling**

Add `mobileNavOpen` to `AppShell`, an icon button labelled `Open workspace navigation`, and `aria-expanded`. At `max-width: 860px`, collapse the sidebar to an off-canvas navigation panel; at `max-width: 560px`, stack metric cells two per row, set workspace padding to 12px, stack decision stages, keep `.fleet-map-stage` at least 440px high, and make map legend collapsible.

Restyle `LoginPage` as a compact two-column command-access surface using the shared control tokens. Keep the demo credentials and error behavior. Restyle `FieldApp` with the same header, status badges, 44px touch controls, and spacing while preserving every existing `data-testid` and offline outbox action.

- [ ] **Step 4: Verify field workflows, mobile map, and build**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js e2e/field-workflow.spec.js e2e/map-workflow.spec.js --workers=1; npm run build`

Expected: dashboard, field, and map tests PASS; build PASS.

- [ ] **Step 5: Commit responsive and field polish**

```powershell
git add frontend/src/main.jsx frontend/src/field/FieldApp.jsx frontend/src/styles/components.css frontend/src/styles/responsive.css frontend/e2e/dashboard-shell.spec.js frontend/e2e/field-workflow.spec.js
git commit -m "feat(ui): harden JWIS responsive and field interfaces"
```

---

### Task 7: Remove Legacy Slop And Run The Full Quality Gate

**Files:**
- Modify: `frontend/src/styles/legacy.css`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/styles/workspaces.css`
- Modify: `frontend/e2e/dashboard-shell.spec.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: every component and workspace established by Tasks 1-6.
- Produces: no conflicting legacy shell rules, no inline workspace layout styles, and documented verification commands.

- [ ] **Step 1: Add failing anti-slop and console tests**

```js
test("dashboard has no nested operational panels or inline grid composition", async ({ page }) => {
  expect(await page.locator(".panel .panel").count()).toBe(0);
  expect(await page.locator('[style*="gridColumn"]').count()).toBe(0);
});

test("dashboard emits no runtime errors during workspace navigation", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const name of ["Waste Forecast", "Integrated Planning", "Fleet Operations"]) {
    await page.getByRole("button", { name }).click();
  }
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run anti-slop tests and verify RED**

Run: `cd frontend; npx playwright test e2e/dashboard-shell.spec.js --workers=1 -g "nested operational|runtime errors"`

Expected: FAIL until remaining nested panels and inline grid styles are removed.

- [ ] **Step 3: Remove replaced legacy declarations and inline layout styles**

Delete from `legacy.css` only selectors now owned by `base.css`, `shell.css`, `components.css`, `workspaces.css`, or `responsive.css`. Keep feature-specific map, prediction, optimizer, field, report, assistant, and voice rules that have no replacement. Replace remaining layout `style={{...}}` props in `main.jsx` with named classes. Run `rg -n "gridColumn|linear-gradient|backdrop-filter|border-left:\s*[2-9]|letter-spacing:\s*-" frontend/src` and remove each UI-slop hit while preserving data-driven inline colors used for facility readiness.

Update README verification commands:

```powershell
cd frontend
npm run build
npx playwright test --workers=1
```

- [ ] **Step 4: Run the complete frontend and backend quality gate**

Run frontend sequentially:

```powershell
cd frontend
npm run build
npx playwright test --workers=1
```

Run backend sequentially:

```powershell
cd backend
$env:PYTHONPATH='.'
python -m unittest discover -s tests -v
```

Expected: Vite build PASS, all Playwright tests PASS, all backend unittest tests PASS, and no processes left running by the test commands.

- [ ] **Step 5: Perform final non-browser static checks**

Run:

```powershell
rg -n "style=\{\{|linear-gradient|backdrop-filter|border-left:\s*[2-9]|letter-spacing:\s*-" frontend/src
git diff --check
git status --short
```

Expected: only justified data-driven inline style hits, no prohibited decoration hits, no whitespace errors, and only intended redesign files staged or modified.

- [ ] **Step 6: Commit final hardening**

```powershell
git add frontend/src/styles/legacy.css frontend/src/styles/components.css frontend/src/styles/workspaces.css frontend/e2e/dashboard-shell.spec.js README.md
git commit -m "refactor(ui): remove legacy dashboard slop"
```

## Plan Self-Review

- Spec coverage: app shell, visual system, Fleet Operations, Waste Forecast, Integrated Planning, login, field app, responsive behavior, accessibility, state semantics, and staged verification are covered.
- Scope: frontend-only; backend commands are regression verification only.
- Type consistency: workspace IDs are `fleet`, `forecast`, and `planning`; all tasks use the same values.
- Dependency consistency: no new npm dependency or test runner is introduced.
- Working-tree safety: every commit stages explicit files and never stages backend/user changes.
