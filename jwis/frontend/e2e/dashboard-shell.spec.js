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
