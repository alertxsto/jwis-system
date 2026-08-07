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

