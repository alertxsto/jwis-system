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

