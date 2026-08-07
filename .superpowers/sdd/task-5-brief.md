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

