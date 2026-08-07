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

