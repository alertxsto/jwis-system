# JWIS SaaSAble Frontend Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the JWIS frontend match the provided SaaSAble-style professional dashboard references while keeping all backend, API, map, and optimization logic unchanged.

**Architecture:** This is a design-system pass over the existing React/Vite app. The shell and shared CSS tokens become the source of truth, while workspace components keep their current data flow and behavior.

**Tech Stack:** React 19, Vite, plain CSS modules under `src/styles`, lucide-react icons already present, Playwright e2e.

## Global Constraints

- Frontend-only: do not touch backend, data, APIs, map logic, or algorithms.
- Reference language: white sidebar, flat white topbar, lavender selected nav, thin neutral borders, 8px radius, minimal/no shadows, compact typography, dense table/chart surfaces.
- Keep the app usable for demo: no in-app browser testing; use terminal Playwright with `--workers=1`.
- Preserve route/workspace IDs and existing visible operational content.
- Remove inline layout styles where they affect the app shell and dashboard contract.

---

### Task 1: Lock the SaaSAble Visual Contract

**Files:**
- Modify: `jwis/frontend/e2e/dashboard-shell.spec.js`
- Modify: `jwis/frontend/e2e/workspace-layouts.spec.js`

**Interfaces:**
- Consumes: rendered CSS variables and class names from the existing app.
- Produces: failing tests for shell tokens, no inline layout composition, and basic workspace render safety.

- [ ] **Step 1: Write failing tests**

Add assertions that the dashboard uses primary `#6366e8`, 8px radius, no panel shadow, no shell inline layout styles, visible search, profile, and nav active state.

- [ ] **Step 2: Run tests to verify red**

Run: `npx playwright test dashboard-shell --workers=1`
Expected: FAIL where current CSS or inline shell markup diverges.

### Task 2: Normalize Shell and Tokens

**Files:**
- Modify: `jwis/frontend/src/styles/tokens.css`
- Modify: `jwis/frontend/src/styles/shell.css`
- Modify: `jwis/frontend/src/layout/AppShell.jsx`

**Interfaces:**
- Consumes: existing `AppShell` props.
- Produces: same app shell behavior with reference-aligned markup and CSS classes.

- [ ] **Step 1: Remove shell inline styles**

Move breadcrumb, chevron, top-actions, and icon color inline declarations into semantic classes.

- [ ] **Step 2: Normalize shell CSS**

Set sidebar width, topbar height, active nav lavender, search box, profile widget, and action buttons to the reference system.

- [ ] **Step 3: Run shell tests**

Run: `npx playwright test dashboard-shell --workers=1`
Expected: shell contract failures reduced to component/workspace issues only.

### Task 3: Normalize Shared Components

**Files:**
- Modify: `jwis/frontend/src/styles/components.css`
- Modify: `jwis/frontend/src/styles/base.css`
- Modify: `jwis/frontend/src/styles/responsive.css`

**Interfaces:**
- Consumes: existing `.panel`, `.metric-strip`, `.table-wrap`, `.segmented-control`, `.status-badge`, button classes.
- Produces: shared surfaces that match the SaaSAble density and visual system.

- [ ] **Step 1: Flatten panels and metric strips**

Use 8px radius, `#e8eaf0` borders, no decorative shadows, compact padding, and Lavender table headers.

- [ ] **Step 2: Normalize buttons and focus**

Use `#6366e8` primary, `#4f46e5` hover, indigo focus ring, white icon/ghost buttons with neutral borders.

- [ ] **Step 3: Run component tests**

Run: `npx playwright test dashboard-shell workspace-layouts --workers=1`
Expected: PASS or only workspace-specific layout failures.

### Task 4: Workspace Polish Without Behavior Changes

**Files:**
- Modify: `jwis/frontend/src/styles/workspaces.css`
- Modify: `jwis/frontend/src/styles/legacy.css`
- Modify only if needed: `jwis/frontend/src/main.jsx`, `jwis/frontend/src/workspaces/*.jsx`

**Interfaces:**
- Consumes: current workspace React structure and API state.
- Produces: denser, more professional Fleet, Forecast, Planning, Driver, Weighbridge, WA, and IoT surfaces.

- [ ] **Step 1: Remove layout hacks**

Replace helper utility classes and remaining inline styles used for layout with named classes only where needed.

- [ ] **Step 2: Harmonize workspace surfaces**

Tables, cards, forecast rail, planning stages, map panels, and operational panels use the same border/radius/type scale.

- [ ] **Step 3: Run workspace tests**

Run: `npx playwright test workspace-layouts map-workflow dashboard-shell --workers=1`
Expected: PASS.

### Task 5: Final Verification

**Files:**
- No production edits unless verification exposes a frontend regression.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 2: Full frontend e2e**

Run: `npx playwright test --workers=1`
Expected: all frontend e2e tests pass, or report unrelated failures clearly.

- [ ] **Step 3: Report**

Summarize exact files changed, verification commands, and any remaining design/test gaps.
