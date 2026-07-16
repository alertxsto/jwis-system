import { test, expect } from "@playwright/test";

async function stubPlanningPrediction(page) {
  await page.route("**/api/predictions/kecamatan?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        total_predicted_tons: 24,
        kecamatan_count: 42,
        top_hotspots: [],
      }),
    });
  });
}

async function stubFleetCarbon(page) {
  await page.route("**/api/fleet/carbon", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        total_fleet_distance_km: 216.9,
        total_co2_emitted_kg: 206.06,
        carbon_saved_today_kg: 17.58,
        fuel_saved_equivalent_liters: 6.5,
        compliance_rate_percent: 86,
      }),
    });
  });
}

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

test("dispatching a truck opens filtered Trip history", async ({ page }) => {
  await page.getByRole("button", { name: "View T-047 trip history" }).click();

  const historyTab = page.getByRole("tab", { name: "Trip history" });
  await expect(historyTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("fleet-history-surface")).toBeVisible();
  await expect(page.getByLabel("Truck")).toHaveValue("T-047");
});

test("fleet detail tabs reveal Queue, Route evidence, and Carbon impact surfaces", async ({ page }) => {
  await stubFleetCarbon(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  for (const [label, surface] of [
    ["TPA queue", "fleet-queue-surface"],
    ["Route evidence", "fleet-evidence-surface"],
    ["Carbon impact", "fleet-impact-surface"],
  ]) {
    const tab = page.getByRole("tab", { name: label });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId(surface)).toBeVisible();
    await expect(page.getByTestId(surface)).toHaveAttribute("aria-labelledby", await tab.getAttribute("id"));
  }
});

test("fleet detail tabs use roving focus with automatic keyboard selection", async ({ page }) => {
  const fleet = page.getByRole("tab", { name: "Fleet" });
  const history = page.getByRole("tab", { name: "Trip history" });
  const impact = page.getByRole("tab", { name: "Carbon impact" });

  await expect(fleet).toHaveAttribute("tabindex", "0");
  await expect(history).toHaveAttribute("tabindex", "-1");
  await expect(page.getByTestId("fleet-table-surface")).toHaveAttribute("aria-labelledby", "fleet");

  await fleet.focus();
  await page.keyboard.press("End");
  await expect(impact).toBeFocused();
  await expect(impact).toHaveAttribute("aria-selected", "true");
  await expect(impact).toHaveAttribute("tabindex", "0");
  await expect(fleet).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("Home");
  await expect(fleet).toBeFocused();
  await expect(fleet).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");
  await expect(history).toBeFocused();
  await expect(history).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(fleet).toBeFocused();
  await expect(fleet).toHaveAttribute("aria-selected", "true");
});

test("mobile Fleet map stage keeps its minimum height without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });

  const mapBox = await page.getByTestId("fleet-map-stage").evaluate((el) => el.getBoundingClientRect());
  expect(mapBox.height).toBeGreaterThanOrEqual(560);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Waste Forecast uses one dominant analysis surface", async ({ page }) => {
  await page.getByRole("button", { name: "Waste Forecast" }).click();
  await expect(page.getByTestId("forecast-workspace")).toBeVisible();
  await expect(page.getByTestId("forecast-primary-analysis")).toBeVisible();
  await expect(page.getByTestId("forecast-driver-rail")).toHaveAttribute("aria-label", "Forecast drivers");
  const selectedHorizon = page.getByRole("button", { name: "7 days" });
  await expect(selectedHorizon).toHaveAttribute("aria-pressed", "true");
  const selectedHorizonContrast = await selectedHorizon.evaluate((element) => {
    const luminance = (color) => {
      const channels = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map((channel) => Number(channel) / 255);
      const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
      return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
    };
    const styles = getComputedStyle(element);
    const foreground = luminance(styles.color);
    const background = luminance(styles.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(selectedHorizonContrast).toBeGreaterThanOrEqual(4.5);
  const sourceLimit = page.locator("#forecast-horizon-source-limit");
  await expect(sourceLimit).toHaveText("Source currently provides a 7-day forecast.");
  await expect(sourceLimit).toBeVisible();
  await expect(page.getByRole("group", { name: "Forecast horizon" })).toHaveAttribute(
    "aria-describedby",
    "forecast-horizon-source-limit",
  );
  for (const label of ["14 days", "30 days"]) {
    const horizon = page.getByRole("button", { name: label });
    await expect(horizon).toBeDisabled();
    await expect(horizon).toHaveAttribute("title", "Unavailable: source provides 7 days");
  }
});

test("Integrated Planning presents an ordered decision flow", async ({ page }) => {
  await page.getByRole("button", { name: "Integrated Planning" }).click();
  const workspace = page.getByTestId("planning-workspace");
  await expect(workspace).toBeVisible();
  for (const heading of ["Scenario inputs", "Recommended plan", "Evidence and approval"]) {
    await expect(workspace.getByRole("heading", { name: heading, exact: true })).toHaveCount(1);
  }

  const stageHeadings = workspace.locator(":scope > .decision-stage > .decision-stage-header h2");
  await expect(stageHeadings).toHaveCount(3);
  expect(await stageHeadings.allTextContents()).toEqual([
    "Scenario inputs",
    "Recommended plan",
    "Evidence and approval",
  ]);
  await expect(workspace.locator(".panel .panel")).toHaveCount(0);
  await expect(workspace.getByText("Decision authority", { exact: true })).toHaveCount(1);
  await expect(workspace.locator(".role-badge")).toHaveCount(1);
  await expect(workspace.getByText("No dispatch plan generated yet.", { exact: true })).toBeVisible();
  await expect(workspace.getByText("Generate a CP-SAT plan to fill this stage with assigned trucks, demand coverage, and permit compliance evidence.", { exact: true })).toBeVisible();

  const workspaceFrame = await workspace.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth,
      borderRadius: styles.borderRadius,
      boxShadow: styles.boxShadow,
    };
  });
  expect(workspaceFrame).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopWidth: "0px",
    borderRadius: "0px",
    boxShadow: "none",
  });

  const markerContrast = await workspace.locator(".decision-stage-marker").first().evaluate((element) => {
    const luminance = (color) => {
      const channels = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map((channel) => Number(channel) / 255);
      const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
      return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
    };
    const styles = getComputedStyle(element);
    const foreground = luminance(styles.color);
    const background = luminance(styles.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(markerContrast).toBeGreaterThanOrEqual(4.5);
});

test("Integrated Planning keeps approval unavailable when constraints are unmet", async ({ page }) => {
  await stubPlanningPrediction(page);
  await page.route("**/api/operations/plan?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        plan_id: "PLAN-BLOCKED",
        status: "proposed",
        assignments: [],
        unmet_reasons: ["insufficient_capacity:tebet"],
        total_demand_tons: 24,
        total_assigned_tons: 0,
        scenario: { rainfall_mm: 42, event_attendance: 85000, is_weekend: true },
      }),
    });
  });

  await page.getByRole("button", { name: "Integrated Planning" }).click();
  await page.getByRole("button", { name: "Generate Dispatch Plan (CP-SAT)" }).click();

  await expect(page.getByText("1 constraints unmet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve & Dispatch Plan" })).toHaveCount(0);
});

test("Integrated Planning exposes approval for a ready plan without duplicate optimizer requests", async ({ page }) => {
  await stubPlanningPrediction(page);
  let optimizerRequests = 0;
  await page.route("**/api/operations/plan?**", async (route) => {
    optimizerRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        plan_id: "PLAN-READY",
        status: "proposed",
        assignments: [{
          truck_code: "T-001",
          area: "tebet",
          assigned_tons: 24,
          evidence: { capacity_tons: 24, permit_compliant: true },
        }],
        unmet_reasons: [],
        total_demand_tons: 24,
        total_assigned_tons: 24,
        scenario: { rainfall_mm: 42, event_attendance: 85000, is_weekend: true },
      }),
    });
  });

  await page.getByRole("button", { name: "Integrated Planning" }).click();
  await page.getByRole("button", { name: "Generate Dispatch Plan (CP-SAT)" }).click();

  await expect(page.getByText("Ready for approval", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve & Dispatch Plan" })).toBeVisible();
  const planGroup = page.locator(".planning-workspace .optimizer-plan-card");
  await expect(planGroup).toBeVisible();
  const planGroupFrame = await planGroup.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth,
      borderRadius: styles.borderRadius,
      boxShadow: styles.boxShadow,
    };
  });
  expect(planGroupFrame).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopWidth: "0px",
    borderRadius: "0px",
    boxShadow: "none",
  });
  const statusRadius = await page.locator(".planning-workspace .plan-status-badge").evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).borderRadius)
  ));
  expect(statusRadius).toBeGreaterThanOrEqual(6);
  expect(statusRadius).toBeLessThanOrEqual(8);
  expect(optimizerRequests).toBe(1);
});
