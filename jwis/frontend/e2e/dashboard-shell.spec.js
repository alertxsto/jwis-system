import { test, expect } from "@playwright/test";

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

/**
 * Reads a design token off the document root.
 *
 * Assertions in this file compare rendered values against the tokens rather
 * than against literals. A literal pin means the palette cannot change without
 * editing the test, which turns the suite into a change detector instead of a
 * contract. Comparing to the token still catches a component that ignores the
 * system, which is the failure that actually matters.
 */
async function readToken(page, name) {
  return page.evaluate((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), name);
}

/**
 * WCAG 2.2 relative-luminance contrast ratio.
 *
 * Accepts either `#rrggbb` (how tokens are declared) or `rgb()`/`rgba()` (how
 * the browser reports computed styles), because the two callers differ: token
 * assertions read the declaration, rendered assertions read the result.
 */
async function contrastRatio(page, foreground, background) {
  return page.evaluate(([fg, bg]) => {
    const parse = (value) => {
      const text = String(value).trim();
      const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
        return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
      }
      const rgb = text.match(/\d+(\.\d+)?/g);
      if (!rgb) throw new Error(`Unparseable colour: ${text}`);
      return rgb.slice(0, 3).map(Number);
    };
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (value) => {
      const [r, g, b] = parse(value).map(channel);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminance(fg);
    const b = luminance(bg);
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
  }, [foreground, background]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("app shell provides three operational workspaces", async ({ page }) => {
  const nav = page.getByTestId("workspace-navigation");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Fleet Operations" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Waste Forecast" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Integrated Planning" })).toBeVisible();

  for (const label of ["Waste Forecast", "Integrated Planning", "Fleet Operations"]) {
    const workspace = nav.getByRole("button", { name: label });
    await workspace.click();
    await expect(workspace).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".app-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh command center" })).toBeVisible();
  }
});

test("weighbridge logs workspace renders weighing records", async ({ page }) => {
  await page.getByRole("button", { name: "Weighbridge Logs" }).click();

  await expect(page.getByRole("heading", { name: "Weighing records" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Net Weight" })).toBeVisible();
  await expect(page.getByText("T-001", { exact: true })).toBeVisible();
});

test("status colours meet WCAG AA against the surfaces they are drawn on", async ({ page }) => {
  const surface = await readToken(page, "--ui-surface");
  const canvas = await readToken(page, "--ui-canvas");

  for (const token of ["--ui-danger", "--ui-warning", "--ui-success", "--ui-info"]) {
    const value = await readToken(page, token);
    expect(value, `${token} must be defined`).not.toBe("");

    // Status is rendered as text on a panel and as a label on its own soft
    // tint, so both pairings have to clear 4.5:1.
    expect(await contrastRatio(page, value, surface), `${token} on panel surface`).toBeGreaterThanOrEqual(4.5);

    const soft = await readToken(page, token.replace("--ui-", "--ui-") + "-soft");
    if (soft) {
      expect(await contrastRatio(page, value, soft), `${token} on its soft tint`).toBeGreaterThanOrEqual(4.5);
    }
  }

  expect(await contrastRatio(page, await readToken(page, "--ui-ink"), surface)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(page, await readToken(page, "--ui-ink-2"), surface)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(page, await readToken(page, "--ui-muted"), surface)).toBeGreaterThanOrEqual(4.5);

  // Muted-soft is for decorative marks and large type only; it must still be
  // distinguishable from the surface rather than lost in it.
  expect(await contrastRatio(page, await readToken(page, "--ui-muted-soft"), canvas)).toBeGreaterThanOrEqual(2.5);
});

test("the accent is a single identity colour used for both action and selection", async ({ page }) => {
  expect(await readToken(page, "--ui-primary")).toBe(await readToken(page, "--ui-accent"));

  const primary = await page.locator(".primary-button").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const primaryToken = await readToken(page, "--ui-primary");
  const [r, g, b] = primaryToken.match(/\w\w/g).map((h) => Number.parseInt(h, 16));
  expect(primary).toBe(`rgb(${r}, ${g}, ${b})`);

  // The primary button label must clear AA against its own fill.
  const label = await page.locator(".primary-button").first().evaluate((el) => getComputedStyle(el).color);
  expect(await contrastRatio(page, label, primary)).toBeGreaterThanOrEqual(4.5);
});

test("desktop and mobile have no document-level horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  }
});

test("mobile shell collapses navigation and preserves workspace access", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const trigger = page.getByRole("button", { name: "Open workspace navigation" });
  const toggle = page.locator(".mobile-nav-trigger");

  await expect(trigger).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("workspace-navigation")).toBeVisible();
});

test("mobile navigation traps focus, blocks background focus, and restores the trigger", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const trigger = page.getByRole("button", { name: "Open workspace navigation" });
  const nav = page.getByTestId("workspace-navigation");
  const firstWorkspace = nav.getByRole("button", { name: "Fleet Operations" });
  const logout = page.getByRole("button", { name: "Logout" });
  const refresh = page.getByRole("button", { name: "Refresh command center" });

  await trigger.click();
  await expect(firstWorkspace).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(logout).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstWorkspace).toBeFocused();

  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await refresh.evaluate((element) => element.focus());
  await expect(refresh).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Dismiss workspace navigation" }).click({ position: { x: 340, y: 100 } });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await nav.getByRole("button", { name: "Waste Forecast" }).click();
  await expect(trigger).toBeFocused();
});

test("mobile menu toggle remains operable while the drawer is open", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const toggle = page.locator(".mobile-nav-trigger");

  await expect(page.getByRole("button", { name: "Open workspace navigation" })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(await toggle.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(false);
  await expect(toggle).toHaveAttribute("aria-label", "Close workspace navigation");

  await toggle.click({ timeout: 3000 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Open workspace navigation");
  await expect(toggle).toBeFocused();
});

test("mobile drawer exposes modal and closed-state accessibility semantics", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const drawer = page.locator(".side-rail");
  const toggle = page.locator(".mobile-nav-trigger");

  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(drawer).toHaveAttribute("inert", "");
  await expect(drawer).not.toHaveAttribute("role", "dialog");
  await expect(drawer).not.toHaveAttribute("aria-modal", "true");

  await toggle.click();
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(drawer).not.toHaveAttribute("aria-hidden", "true");
  await expect(drawer).not.toHaveAttribute("inert", "");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(drawer).toHaveAttribute("inert", "");
});

test("mobile shell controls meet minimum touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const trigger = page.getByRole("button", { name: "Open workspace navigation" });

  await expectMinimumTouchTarget(trigger);
  await expectMinimumTouchTarget(page.getByRole("link", { name: "Field app" }));
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Refresh command center" }));
  await trigger.click();

  for (const control of await page.getByTestId("workspace-navigation").getByRole("button").all()) {
    await expectMinimumTouchTarget(control);
  }
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Logout" }));
});

test("focus is drawn with the accent ring and never with a legacy outline", async ({ page }) => {
  const refresh = page.getByRole("button", { name: "Refresh command center" });
  await refresh.focus();
  const focusStyle = await refresh.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      shadow: style.boxShadow,
    };
  });
  expect(focusStyle.outlineStyle).toBe("none");
  expect(focusStyle.outlineWidth).toBe("0px");

  const [r, g, b] = (await readToken(page, "--ui-primary")).match(/\w\w/g).map((h) => Number.parseInt(h, 16));
  expect(focusStyle.shadow).toContain(`${r}, ${g}, ${b}`);
});

test("workspace search filters the navigation and navigates on Enter", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Search workspaces" });
  await expect(input).toBeVisible();

  await input.fill("forecast");
  const results = page.getByRole("listbox");
  await expect(results).toBeVisible();
  await expect(results.getByRole("option")).toHaveCount(1);

  await input.press("Enter");
  await expect(page.getByTestId("workspace-navigation").getByRole("button", { name: "Waste Forecast" })).toHaveAttribute("aria-current", "page");

  await input.fill("zzzz");
  await expect(page.getByText(/No workspace matches/)).toBeVisible();
});

test("dashboard has no nested operational panels or inline layout composition", async ({ page }) => {
  for (const name of ["Fleet Operations", "Waste Forecast", "Integrated Planning"]) {
    await page.getByRole("button", { name }).click();
    expect(await page.locator(".panel .panel").count()).toBe(0);
    const inlineLayouts = await page.locator("[style]").evaluateAll((elements) => elements
      .filter((element) => ["gridColumn", "marginTop", "textAlign", "padding"].some((property) => element.style[property]))
      .map((element) => element.getAttribute("style")));
    expect(inlineLayouts).toEqual([]);
  }
});

test("dashboard emits no runtime errors during workspace navigation", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  for (const name of ["Waste Forecast", "Integrated Planning", "Fleet Operations"]) {
    await page.getByRole("button", { name }).click();
  }

  expect(errors).toEqual([]);
});

test("desktop shell dimensions and surfaces come from the token system", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const sidebarToken = Number.parseFloat(await readToken(page, "--ui-sidebar-width"));
  const topbarToken = Number.parseFloat(await readToken(page, "--ui-topbar-height"));
  const accentSoft = await readToken(page, "--ui-accent-soft");
  const [ar, ag, ab] = accentSoft.match(/\w\w/g).map((h) => Number.parseInt(h, 16));

  const shell = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        background: style.backgroundColor,
        borderWidth: style.borderBottomWidth,
        radius: Number.parseFloat(style.borderRadius),
        shadow: style.boxShadow,
      };
    };

    return {
      sidebar: read(".side-rail"),
      topbar: read(".topbar"),
      canvas: read(".workspace-canvas"),
      panel: read(".panel"),
      activeNav: getComputedStyle(document.querySelector('.nav-tab-btn[aria-current="page"]')).backgroundColor,
    };
  });

  expect(shell.sidebar.width).toBeCloseTo(sidebarToken, 0);
  expect(shell.sidebar.background).toBe("rgb(255, 255, 255)");
  expect(shell.topbar.height).toBeCloseTo(topbarToken, 0);
  expect(shell.topbar.background).toBe("rgb(255, 255, 255)");
  expect(shell.topbar.borderWidth).toBe("1px");
  expect(shell.panel.radius).toBeLessThanOrEqual(8);
  expect(shell.panel.shadow).toBe("none");
  expect(shell.activeNav).toBe(`rgb(${ar}, ${ag}, ${ab})`);

  // The rail is a navigation column, not a second content pane: it must stay
  // clearly narrower than the canvas it sits beside.
  const canvasWidth = shell.canvas.width;
  expect(shell.sidebar.width).toBeLessThan(canvasWidth / 3);

  const metricGeometry = await page.locator(".metric-strip").evaluate((strip) => {
    const cells = [...strip.querySelectorAll(":scope > .metric-cell")];
    const first = cells[0].getBoundingClientRect();
    const second = cells[1].getBoundingClientRect();
    const style = getComputedStyle(strip);
    return {
      gap: second.left - first.right,
      radius: Number.parseFloat(style.borderRadius),
      shadow: style.boxShadow,
    };
  });
  expect(metricGeometry.gap).toBe(0);
  expect(metricGeometry.radius).toBeLessThanOrEqual(8);
  expect(metricGeometry.shadow).toBe("none");

  await page.getByRole("tab", { name: "Trip history" }).click();
  const header = page.getByTestId("fleet-history-surface").locator("table thead th").first();
  await expect(header).toBeVisible();
  const headerStyle = await header.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      height: element.getBoundingClientRect().height,
      fontSize: style.fontSize,
    };
  });
  expect(headerStyle.background).toBe("rgb(238, 241, 244)");
  expect(headerStyle.height).toBeLessThanOrEqual(40);
  expect(Number.parseFloat(headerStyle.fontSize)).toBeLessThanOrEqual(12);
});

/**
 * Returns every visible text node whose colour/surface pair misses its WCAG AA
 * requirement. Runs in the page, so it sees computed values rather than tokens.
 */
async function contrastFailures(page) {
  return page.evaluate(() => {
    const luminance = (value) => {
      const text = String(value);
      const rgb = text.startsWith("color(")
        ? text.match(/[\d.]+/g).slice(0, 3).map((v) => Number(v) * 255)
        : text.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number);
      if (!rgb) return null;
      const [r, g, b] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // Walk up for the first painted background: a child inherits its surface.
    const background = (element) => {
      let node = element;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && !bg.startsWith("rgba(0, 0, 0, 0")) return bg;
        node = node.parentElement;
      }
      return "rgb(255, 255, 255)";
    };

    const bad = [];
    for (const element of document.querySelectorAll("main *")) {
      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent.trim().length > 1,
      );
      if (!hasOwnText) continue;

      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.9) continue;

      const fg = luminance(style.color);
      const bg = luminance(background(element));
      if (fg === null || bg === null) continue;

      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const isLarge = size >= 18.66 || (size >= 14 && Number(style.fontWeight) >= 700);
      const required = isLarge ? 3 : 4.5;

      if (ratio < required) {
        bad.push(`${element.textContent.trim().slice(0, 40)} @ ${Math.round(ratio * 100) / 100}:1 (need ${required})`);
      }
    }
    return [...new Set(bad)];
  });
}

test("no visible text falls below its WCAG AA contrast requirement", async ({ page }) => {
  // Every workspace, not just the one that happens to be active on load. A
  // token-level check cannot catch a component that pairs the right colour with
  // the wrong surface, and a sweep of only the default screen misses any panel
  // that sets its colour inline — which is how a set of sub-AA hex values in the
  // forecast list survived an earlier pass of this test.
  test.setTimeout(180000);

  const workspaces = [
    "Fleet Operations",
    "Waste Forecast",
    "Integrated Planning",
    "Driver Analytics",
    "Weighbridge Logs",
    "WhatsApp Gateway",
    "Bin Sensors",
    "Data & ML Audit",
  ];

  const problems = {};
  for (const name of workspaces) {
    // `workspace-navigation` only labels the Operations group; the remaining
    // workspaces live in sibling navs, so address the rail as a whole.
    await page.locator(".nav-tab-btn", { hasText: name }).first().click();
    await expect(page.locator(".workspace-header h1, .panel-title h2").first()).toBeVisible();
    const failures = await contrastFailures(page);
    if (failures.length > 0) problems[name] = failures;
  }

  expect(problems).toEqual({});
});

test("fleet workspace keeps the map and its inspector on screen together", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const stage = await page.getByTestId("fleet-map-stage").evaluate((mapStage) => {
    const map = mapStage.getBoundingClientRect();
    const inspector = document.querySelector(".fleet-inspector").getBoundingClientRect();
    return {
      mapHeight: map.height,
      mapRight: map.right,
      inspectorLeft: inspector.left,
      inspectorTop: inspector.top,
      inspectorHeight: inspector.height,
    };
  });

  // Side by side, not stacked: an alert and the corridor it describes must be
  // visible at the same time.
  expect(stage.mapRight).toBeLessThanOrEqual(stage.inspectorLeft + 1);
  expect(Math.abs(stage.inspectorTop - (stage.inspectorTop))).toBe(0);
  expect(stage.mapHeight).toBeGreaterThan(400);
  expect(stage.inspectorHeight).toBeGreaterThan(400);
});

test("login and field surfaces use the shared accent and surface tokens", async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem("jwis_auth"));
  await page.goto("/");

  const primaryToken = await readToken(page, "--ui-primary");
  const [r, g, b] = primaryToken.match(/\w\w/g).map((h) => Number.parseInt(h, 16));

  const login = await page.locator(".login-surface").evaluate((surface) => {
    const surfaceStyle = getComputedStyle(surface);
    const buttonStyle = getComputedStyle(surface.querySelector(".primary-button"));
    return {
      radius: Number.parseFloat(surfaceStyle.borderRadius),
      shadow: surfaceStyle.boxShadow,
      buttonBackground: buttonStyle.backgroundColor,
    };
  });
  expect(login.radius).toBeLessThanOrEqual(8);
  expect(login.shadow).toBe("none");
  expect(login.buttonBackground).toBe(`rgb(${r}, ${g}, ${b})`);

  await page.goto("/field");
  const field = await page.locator(".field-card").evaluate((card) => {
    const style = getComputedStyle(card);
    return {
      radius: Number.parseFloat(style.borderRadius),
      shadow: style.boxShadow,
      background: style.backgroundColor,
    };
  });
  expect(field.radius).toBeLessThanOrEqual(8);
  expect(field.shadow).toBe("none");
  expect(field.background).toBe("rgb(255, 255, 255)");
});
