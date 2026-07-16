import { test, expect } from "@playwright/test";

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
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
  await page.getByRole("button", { name: "weighbridge Logs" }).click();

  await expect(page.getByRole("heading", { name: "weighbridge Weighing Records (Case 1)" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Net Weight" })).toBeVisible();
  await expect(page.getByText("T-001", { exact: true })).toBeVisible();
});

test("dashboard exposes the professional design token contract", async ({ page }) => {
  const tokens = await page.locator("html").evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      primary: css.getPropertyValue("--ui-primary").trim(),
      accent: css.getPropertyValue("--ui-accent").trim(),
      success: css.getPropertyValue("--ui-success").trim(),
      radius: css.getPropertyValue("--ui-radius").trim(),
    };
  });
  expect(tokens).toEqual({ primary: "#6366e8", accent: "#6366e8", success: "#177a57", radius: "8px" });
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

test("primary controls use indigo focus without a legacy outline", async ({ page }) => {
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
  expect(focusStyle.shadow).toContain("99, 102, 232");
});

test("legacy stylesheet contains no green focus source", async ({ page }) => {
  const legacyCss = await page.evaluate(async () => (await fetch("/src/styles/legacy.css")).text());
  expect(legacyCss).not.toContain(":focus-visible");
  expect(legacyCss).not.toContain("rgba(23, 107, 84, 0.25)");
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

test("desktop shell and operational surfaces match the professional reference system", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

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
      primary: getComputedStyle(document.querySelector(".professional-shell .primary-button")).backgroundColor,
    };
  });

  expect(shell.sidebar.width).toBeCloseTo(248, 0);
  expect(shell.sidebar.background).toBe("rgb(255, 255, 255)");
  expect(shell.topbar.height).toBeCloseTo(72, 0);
  expect(shell.topbar.background).toBe("rgb(255, 255, 255)");
  expect(shell.topbar.borderWidth).toBe("1px");
  expect(shell.canvas.background).toBe("rgb(255, 255, 255)");
  expect(shell.panel.radius).toBeLessThanOrEqual(8);
  expect(shell.panel.shadow).toBe("none");
  expect(shell.activeNav).toBe("rgb(229, 230, 255)");
  expect(shell.primary).toBe("rgb(99, 102, 232)");

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
  expect(metricGeometry).toEqual({ gap: 0, radius: 8, shadow: "none" });

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
  expect(headerStyle.background).toBe("rgb(245, 245, 255)");
  expect(headerStyle.height).toBeLessThanOrEqual(40);
  expect(headerStyle.fontSize).toBe("12px");
});

test("login and field surfaces share the indigo compact visual system", async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem("jwis_auth"));
  await page.goto("/");

  const login = await page.locator(".login-surface").evaluate((surface) => {
    const surfaceStyle = getComputedStyle(surface);
    const buttonStyle = getComputedStyle(surface.querySelector(".primary-button"));
    return {
      radius: Number.parseFloat(surfaceStyle.borderRadius),
      shadow: surfaceStyle.boxShadow,
      buttonBackground: buttonStyle.backgroundColor,
    };
  });
  expect(login).toEqual({ radius: 8, shadow: "none", buttonBackground: "rgb(99, 102, 232)" });

  await page.goto("/field");
  const field = await page.locator(".field-card").evaluate((card) => {
    const style = getComputedStyle(card);
    return {
      radius: Number.parseFloat(style.borderRadius),
      shadow: style.boxShadow,
      background: style.backgroundColor,
    };
  });
  expect(field).toEqual({ radius: 8, shadow: "none", background: "rgb(255, 255, 255)" });
});
