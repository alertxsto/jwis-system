### Task 7: Remove Legacy Slop And Run The Full Quality Gate

**Files:**
- Modify: `frontend/src/styles/base.css`
- Modify: `frontend/src/styles/shell.css`
- Modify: `frontend/src/styles/legacy.css`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/styles/workspaces.css`
- Modify: `frontend/src/styles/responsive.css`
- Modify: `frontend/e2e/dashboard-shell.spec.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: every component and workspace established by Tasks 1-6.
- Produces: no conflicting legacy shell rules, no inline workspace layout styles, and documented verification commands.

**Binding visual target from the user's SaaSAble references:**
- Match the reference's information architecture and visual density while retaining JWIS branding, labels, operational data, and workflows.
- Desktop sidebar is a fixed white approximately 248px rail; topbar is a flat white approximately 72px band; the workspace canvas is white or very light neutral.
- Use thin neutral dividers, compact typography and controls, 6-8px radii, and almost no shadows. Do not use glass, gradients, decorative side bars, nested cards, or oversized headings.
- Indigo/lavender is the navigation, selection, focus, and primary-action accent. Green is reserved for semantic success, compliance, and healthy state.
- KPI summaries should read as a connected metric strip. Tables use dense rows and a faint lavender header. Charts use restrained indigo/lavender series and neutral grid lines.
- Apply this consistently to Fleet Operations, Waste Forecast, Integrated Planning, login, and Field App; do not merely restyle one screenshot viewport.

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

test("desktop shell and operational surfaces match the professional reference system", async ({ page }) => {
  // Assert computed sidebar/topbar dimensions, white/light surfaces, thin borders,
  // indigo active navigation, restrained radii/shadows, connected metrics, and dense table headers.
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
