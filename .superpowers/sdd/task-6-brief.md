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

