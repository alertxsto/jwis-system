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

