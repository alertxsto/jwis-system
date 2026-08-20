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
    await expect(page.getByRole("button", { name: "AI Assistant" })).toBeVisible();
  }
});

test("weighbridge logs workspace renders weighing records", async ({ page }) => {
  await page.getByRole("button", { name: "Weighbridge Logs" }).click();

  await expect(page.getByRole("heading", { name: "Weighbridge Weighing Records" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Net Weight" })).toBeVisible();
  await expect(page.getByText("T-001", { exact: true })).toBeVisible();
});

test("dashboard exposes the professional design token contract", async ({ page }) => {
  const tokens = await page.locator("html").evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      primary: css.getPropertyValue("--ui-primary").trim(),
      accent: css.getPropertyValue("--ui-accent").trim(),
      canvas: css.getPropertyValue("--ui-canvas").trim(),
      surfaceMuted: css.getPropertyValue("--ui-surface-muted").trim(),
      ink: css.getPropertyValue("--ui-ink").trim(),
      radius: css.getPropertyValue("--ui-radius").trim(),
      cardRadius: css.getPropertyValue("--ui-radius-card").trim(),
    };
  });
  expect(tokens).toEqual({
    primary: "#121212",
    accent: "#d97757",
    canvas: "#f8f8f6",
    surfaceMuted: "#efeeeb",
    ink: "#121212",
    radius: "8px",
    cardRadius: "16px",
  });
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
  const backgroundControl = page.getByRole("button", { name: "AI Assistant" });

  await trigger.click();
  await expect(firstWorkspace).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(logout).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstWorkspace).toBeFocused();

  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await backgroundControl.evaluate((element) => element.focus());
  await expect(backgroundControl).not.toBeFocused();

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
  await expectMinimumTouchTarget(page.getByRole("button", { name: "AI Assistant" }));
  await trigger.click();

  for (const control of await page.getByTestId("workspace-navigation").getByRole("button").all()) {
    await expectMinimumTouchTarget(control);
  }
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Logout" }));
});

test("AI assistant opens from the topbar instead of rendering as a forecast card", async ({ page }) => {
  await page.route("**/api/assistant/query", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "openai",
        answer: "**T-047 critical route deviation** — 9.3 km off corridor.\nSeverity: `critical`, confidence 0.8, flags: `off_corridor`, `far_off_corridor`\nSecondary risk: T-112 damaged (`is_damaged: true`).\n\nTindakan immediate:\n1. Contact driver now.\n2. Dispatch Route B recovery.\n3. Keep backup capacity ready.",
      }),
    });
  });
  await page.getByRole("button", { name: "Waste Forecast" }).click();

  const assistantButton = page.getByRole("button", { name: "AI Assistant" });
  const profile = page.locator(".profile-widget");
  await expect(assistantButton).toBeVisible();
  await expect(profile).toBeVisible();

  const [assistantLeft, profileLeft] = await Promise.all([
    assistantButton.evaluate((element) => element.getBoundingClientRect().left),
    profile.evaluate((element) => element.getBoundingClientRect().left),
  ]);
  expect(assistantLeft).toBeLessThan(profileLeft);
  await expect(page.locator(".forecast-assistant-row")).toHaveCount(0);

  await assistantButton.click();
  const dialog = page.getByRole("dialog", { name: "Operational AI Assistant" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".assistant-chat-shell")).toBeVisible();
  await expect(dialog.locator(".assistant-message.assistant")).toHaveCount(1);
  await expect(dialog.locator(".assistant-quick-prompts button")).toHaveCount(2);
  await expect(dialog.getByRole("heading", { name: "Ana" })).toBeVisible();
  await expect(dialog.getByText("online")).toHaveCount(0);
  await expect(dialog.getByText("ready")).toHaveCount(0);
  await expect(dialog.getByPlaceholder("Ask Ana anything...")).toBeVisible();
  await dialog.getByPlaceholder("Ask Ana anything...").fill("What is the highest operational risk today?");
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(dialog.getByText("openai")).toHaveCount(0);
  await expect(dialog.getByText("is_damaged")).toHaveCount(0);
  await expect(dialog.getByText("flags:")).toHaveCount(0);
  await expect(dialog.getByText("truck damage confirmed")).toBeVisible();
  await expect(dialog.getByText("far_off_corridor")).toHaveCount(0);
  await expect(dialog.locator(".assistant-bubble strong").first()).toBeVisible();
  await expect(dialog.locator(".assistant-bubble ol li")).toHaveCount(3);
  const avatarSizes = await dialog.locator(".assistant-message-avatar").evaluateAll((avatars) => (
    avatars.map((avatar) => {
      const box = avatar.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    })
  ));
  expect(new Set(avatarSizes.map((size) => `${size.width}x${size.height}`)).size).toBe(1);
  await dialog.getByRole("button", { name: "Close AI assistant" }).click();
  await expect(dialog).toBeHidden();
});

test("primary controls use clay focus without a legacy outline", async ({ page }) => {
  const control = page.getByRole("button", { name: "AI Assistant" });
  await control.focus();
  const focusStyle = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      shadow: style.boxShadow,
    };
  });
  expect(focusStyle.outlineStyle).toBe("none");
  expect(focusStyle.outlineWidth).toBe("0px");
  expect(focusStyle.shadow).toContain("217, 119, 87");
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
  expect(shell.sidebar.background).toBe("rgb(248, 248, 246)");
  expect(shell.topbar.height).toBeCloseTo(72, 0);
  expect(shell.topbar.background).toBe("rgb(248, 248, 246)");
  expect(shell.topbar.borderWidth).toBe("1px");
  expect(shell.canvas.background).toBe("rgb(248, 248, 246)");
  expect(shell.panel.radius).toBe(16);
  expect(shell.panel.shadow).not.toBe("none");
  expect(shell.activeNav).toBe("rgb(244, 228, 220)");
  expect(shell.primary).toBe("rgb(217, 119, 87)");

  const metricGeometry = await page.locator(".metric-strip").evaluate((strip) => {
    const cells = [...strip.querySelectorAll(":scope > .metric-cell")];
    const first = cells[0].getBoundingClientRect();
    const second = cells[1].getBoundingClientRect();
    const cellStyle = getComputedStyle(cells[0]);
    return {
      gap: second.left - first.right,
      radius: Number.parseFloat(cellStyle.borderRadius),
      shadow: cellStyle.boxShadow,
    };
  });
  expect(metricGeometry.gap).toBeCloseTo(12, 0);
  expect(metricGeometry.radius).toBe(16);
  expect(metricGeometry.shadow).not.toBe("none");

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
  expect(headerStyle.background).toBe("rgb(239, 238, 235)");
  expect(headerStyle.height).toBeLessThanOrEqual(42);
  expect(headerStyle.fontSize).toBe("12px");
});

test("visible dashboard copy is English-only for the recording path", async ({ page }) => {
  for (const workspace of ["Waste Forecast", "Integrated Planning"]) {
    await page.getByRole("button", { name: workspace }).click();
    await expect(page.getByText(/Prediksi|Menghitung|Curah hujan|pengunjung|Tampilkan|Skenario|Peta Timbulan/i)).toHaveCount(0);
  }
});

test("cards and typography keep a clean product hierarchy", async ({ page }) => {
  const panelHeading = page.locator(".panel-title h2").first();
  const panelHeadingStyle = await panelHeading.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      size: Number.parseFloat(style.fontSize),
      weight: style.fontWeight,
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(panelHeadingStyle.size).toBe(20);
  expect(Number(panelHeadingStyle.weight)).toBeGreaterThanOrEqual(600);
  expect(Number(panelHeadingStyle.weight)).toBeLessThanOrEqual(650);
  expect(panelHeadingStyle.lineHeight).toBeGreaterThanOrEqual(22);

  await page.getByRole("button", { name: "Waste Forecast" }).click();
  const forecastPanelRadius = await page.locator(".forecast-primary-analysis > .panel").first().evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).borderRadius)
  ));
  expect(forecastPanelRadius).toBe(16);

  await page.getByRole("button", { name: "Integrated Planning" }).click();
  const planningSurface = await page.locator(".planning-workspace").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      radius: Number.parseFloat(style.borderRadius),
      border: style.borderTopWidth,
      background: style.backgroundColor,
      overflow: style.overflow,
    };
  });
  expect(planningSurface).toEqual({
    radius: 24,
    border: "1px",
    background: "rgb(255, 255, 255)",
    overflow: "hidden",
  });
});

test("login and field surfaces share the Refero paper visual system", async ({ page }) => {
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
  expect(login).toEqual({ radius: 24, shadow: login.shadow, buttonBackground: "rgb(217, 119, 87)" });
  expect(login.shadow).not.toBe("none");

  await page.goto("/field");
  const field = await page.locator(".field-card").evaluate((card) => {
    const style = getComputedStyle(card);
    return {
      radius: Number.parseFloat(style.borderRadius),
      shadow: style.boxShadow,
      background: style.backgroundColor,
    };
  });
  expect(field).toEqual({ radius: 16, shadow: field.shadow, background: "rgb(255, 255, 255)" });
  expect(field.shadow).not.toBe("none");
});
