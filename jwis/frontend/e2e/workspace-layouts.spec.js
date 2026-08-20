import { test, expect } from "@playwright/test";

async function installFetchTracker(page) {
  await page.addInitScript(() => {
    if (window.__jwisFetchTrackerInstalled) return;
    window.__jwisFetchTrackerInstalled = true;
    window.__jwisPendingFetches = 0;
    window.__jwisLastFetchSettledAt = Date.now();
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      window.__jwisPendingFetches += 1;
      try {
        return await nativeFetch(...args);
      } finally {
        window.__jwisPendingFetches -= 1;
        window.__jwisLastFetchSettledAt = Date.now();
      }
    };
  });
}

async function waitForFetchesToSettle(page) {
  await page.waitForFunction(() => {
    const pending = window.__jwisPendingFetches || 0;
    const lastSettledAt = window.__jwisLastFetchSettledAt || 0;
    return pending === 0 && Date.now() - lastSettledAt > 250;
  }, null, { timeout: 15000 });
}

async function waitForForecastLayoutReady(page) {
  await waitForFetchesToSettle(page);
  await page.waitForFunction(() => {
    const workspace = document.querySelector("[data-testid='forecast-workspace']");
    if (!workspace) return false;
    const rows = workspace.querySelectorAll(".kec-list .kec-row").length;
    const weatherDays = workspace.querySelectorAll(".weather-strip .weather-day").length;
    const eventCards = workspace.querySelectorAll(".events-list .event-item-card").length;
    const text = workspace.textContent || "";
    const totalResolved = !text.includes("Total forecast: ...");
    const notLoading = !/Calculating|Analyzing|Loading/i.test(text);
    return rows >= 8 && weatherDays >= 2 && eventCards >= 1 && totalResolved && notLoading;
  }, null, { timeout: 15000 });
}

async function waitForPlanningLayoutReady(page) {
  await waitForFetchesToSettle(page);
  await page.waitForFunction(() => {
    const workspace = document.querySelector("[data-testid='planning-workspace']");
    if (!workspace) return false;
    const text = workspace.textContent || "";
    const reqs = workspace.querySelectorAll(".scenario-reqs .req-chip").length;
    const hasResolvedForecast = /Total forecast [\d,.]+ tons\/day/.test(text) && !text.includes("Peak: ...");
    const notLoading = !/Calculating|Optimizing|Loading/i.test(text);
    return reqs === 4 && hasResolvedForecast && notLoading;
  }, null, { timeout: 15000 });
}

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
  await installFetchTracker(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("Fleet Operations is the default map-led workspace", async ({ page }) => {
  await expect(page.getByTestId("fleet-workspace")).toBeVisible();
  await expect(page.getByTestId("fleet-map-stage")).toBeVisible();
  const mapBox = await page.getByTestId("fleet-map-stage").evaluate((el) => el.getBoundingClientRect());
  expect(mapBox.width).toBeGreaterThan(650);
  expect(mapBox.height).toBeGreaterThanOrEqual(760);
  const detailBox = await page.getByTestId("fleet-table-surface").evaluate((el) => el.getBoundingClientRect());
  expect(detailBox.height).toBeGreaterThanOrEqual(390);
});

test("Fleet map controls, legend, and inspector panels use compact balanced rows", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "A* Dynamic Rerouting" })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const controlsCard = document.querySelector(".map-controls-card").getBoundingClientRect();
    const legendCard = document.querySelector(".map-legend-card").getBoundingClientRect();
    const labels = [...document.querySelectorAll(".map-controls-grid label")].map((label) => label.getBoundingClientRect());
    const select = document.querySelector(".playback-select-wrap").getBoundingClientRect();
    const inspectorCards = [...document.querySelectorAll(".map-footer-inspector-row > .inspector-col > .panel")].map((panel) => {
      const box = panel.getBoundingClientRect();
      return { top: box.top, height: box.height };
    });
    const actionPanel = document.querySelector(".map-footer-inspector-row > .inspector-col:first-child > .panel");
    const actionQueue = document.querySelector(".map-footer-inspector-row .alert-list");
    const alertItems = [...document.querySelectorAll(".map-footer-inspector-row .alert-item")].map((item) => item.getBoundingClientRect().height);
    const routeSlots = document.querySelectorAll(".map-footer-inspector-row .alert-item .route-rec").length;
    const actionPanelBox = actionPanel.getBoundingClientRect();
    const actionQueueBox = actionQueue.getBoundingClientRect();
    const actionQueueStyle = getComputedStyle(actionQueue);
    return {
      controlsHeight: controlsCard.height,
      legendHeight: legendCard.height,
      labelRowHeight: Math.max(...labels.map((box) => box.bottom)) - Math.min(...labels.map((box) => box.top)),
      labelTopSpread: Math.max(...labels.map((box) => Math.round(box.top))) - Math.min(...labels.map((box) => Math.round(box.top))),
      selectTop: select.top,
      firstLabelBottom: labels[0].bottom,
      inspectorCards,
      actionQueueBottomGap: actionPanelBox.bottom - actionQueueBox.bottom,
      actionQueueHorizontalOverflow: actionQueue.scrollWidth - actionQueue.clientWidth,
      actionQueueOverflowY: actionQueueStyle.overflowY,
      actionQueueScrollHeight: actionQueue.scrollHeight,
      actionQueueClientHeight: actionQueue.clientHeight,
      alertItems,
      routeSlots,
    };
  });

  expect(geometry.controlsHeight).toBeLessThanOrEqual(geometry.legendHeight + 36);
  expect(geometry.labelRowHeight).toBeLessThanOrEqual(32);
  expect(geometry.labelTopSpread).toBeLessThanOrEqual(4);
  expect(geometry.selectTop).toBeGreaterThan(geometry.firstLabelBottom);
  expect(geometry.inspectorCards).toHaveLength(3);
  expect(new Set(geometry.inspectorCards.map((card) => Math.round(card.top))).size).toBe(1);
  const tallest = Math.max(...geometry.inspectorCards.map((card) => card.height));
  const shortest = Math.min(...geometry.inspectorCards.map((card) => card.height));
  expect(shortest).toBeGreaterThanOrEqual(520);
  expect(tallest - shortest).toBeLessThanOrEqual(140);
  expect(geometry.actionQueueBottomGap).toBeLessThanOrEqual(24);
  expect(geometry.actionQueueHorizontalOverflow).toBeLessThanOrEqual(2);
  expect(geometry.actionQueueOverflowY).toBe("scroll");
  expect(geometry.routeSlots).toBe(geometry.alertItems.length);
  expect(Math.max(...geometry.alertItems) - Math.min(...geometry.alertItems)).toBeLessThanOrEqual(2);
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
  await waitForForecastLayoutReady(page);
  await expect(page.getByTestId("forecast-workspace")).toBeVisible();
  await expect(page.getByTestId("forecast-primary-analysis")).toBeVisible();
  await expect(page.locator(".forecast-tools")).toHaveAttribute("aria-label", "Forecast tools");
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
  await expect(sourceLimit).toHaveText("Live model series per day: weekday and national-holiday drivers vary by date; rainfall and event scenario inputs are held constant across the horizon.");
  await expect(sourceLimit).toBeVisible();
  await expect(page.getByRole("group", { name: "Forecast horizon" })).toHaveAttribute(
    "aria-describedby",
    "forecast-horizon-source-limit",
  );
  for (const label of ["14 days", "30 days"]) {
    const horizon = page.getByRole("button", { name: label });
    await expect(horizon).toBeEnabled();
    await horizon.click();
    await expect(horizon).toHaveAttribute("aria-pressed", "true");
  }
});

test("Waste Forecast keeps drivers compact and primary analysis dominant", async ({ page }) => {
  await page.getByRole("button", { name: "Waste Forecast" }).click();
  await waitForForecastLayoutReady(page);

  const geometry = await page.evaluate(() => {
    const primary = document.querySelector("[data-testid='forecast-primary-analysis']").getBoundingClientRect();
    const tools = document.querySelector(".forecast-tools").getBoundingClientRect();
    const toolPanels = [...document.querySelectorAll(".forecast-tools > .panel")].map((panel) => {
      const box = panel.getBoundingClientRect();
      return { top: box.top, left: box.left, width: box.width, height: box.height };
    });
    const districtPanel = document.querySelector(".forecast-primary-analysis > .panel").getBoundingClientRect();
    const predictive = [...document.querySelectorAll(".forecast-tools > .panel")]
      .find((panel) => panel.textContent.includes("Predictive Readiness"))
      .getBoundingClientRect();
    const weather = [...document.querySelectorAll(".forecast-tools > .panel")]
      .find((panel) => panel.textContent.includes("Open-Meteo Weather Risk"))
      .getBoundingClientRect();
    const events = [...document.querySelectorAll(".forecast-tools > .panel")]
      .find((panel) => panel.textContent.includes("Crowd Permit"))
      .getBoundingClientRect();
    const report = [...document.querySelectorAll(".forecast-tools > .panel")]
      .find((panel) => panel.textContent.includes("Report Export"))
      .getBoundingClientRect();
    const eventButton = [...document.querySelectorAll(".forecast-tools button")]
      .find((button) => button.textContent.includes("Simulate event"))
      .getBoundingClientRect();
    return {
      primaryWidth: primary.width,
      districtHeight: districtPanel.height,
      toolsWidth: tools.width,
      toolsTop: tools.top,
      primaryLeft: primary.left,
      primaryRight: primary.right,
      districtRight: districtPanel.right,
      viewportWidth: window.innerWidth,
      predictiveTop: predictive.top,
      predictiveLeft: predictive.left,
      predictiveWidth: predictive.width,
      predictiveBottom: predictive.bottom,
      weatherTop: weather.top,
      weatherLeft: weather.left,
      weatherWidth: weather.width,
      weatherBottom: weather.bottom,
      eventsTop: events.top,
      eventsLeft: events.left,
      eventsWidth: events.width,
      reportTop: report.top,
      reportLeft: report.left,
      reportWidth: report.width,
      eventButtonBottom: eventButton.bottom,
      eventsBottom: events.bottom,
      districtBottom: districtPanel.bottom,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      toolPanels,
      predictiveSummaryCards: document.querySelectorAll(".prediction-summary-grid > div").length,
    };
  });

  expect(geometry.primaryWidth).toBeGreaterThan(geometry.viewportWidth * 0.72);
  expect(geometry.districtRight).toBeGreaterThan(geometry.viewportWidth - 80);
  expect(geometry.toolsTop).toBeGreaterThan(geometry.districtBottom);
  expect(Math.abs(geometry.predictiveTop - geometry.weatherTop)).toBeLessThanOrEqual(8);
  expect(geometry.weatherLeft).toBeGreaterThan(geometry.predictiveLeft);
  expect(geometry.predictiveWidth).toBeGreaterThan(geometry.toolsWidth * 0.44);
  expect(geometry.weatherWidth).toBeGreaterThan(geometry.toolsWidth * 0.44);
  expect(geometry.eventsTop).toBeGreaterThan(geometry.predictiveBottom);
  expect(Math.abs(geometry.eventsTop - geometry.reportTop)).toBeLessThanOrEqual(8);
  expect(geometry.reportLeft).toBeGreaterThan(geometry.eventsLeft);
  expect(geometry.eventsWidth).toBeGreaterThan(geometry.toolsWidth * 0.44);
  expect(geometry.reportWidth).toBeGreaterThan(geometry.toolsWidth * 0.44);
  expect(geometry.eventButtonBottom).toBeLessThanOrEqual(geometry.eventsBottom);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(geometry.toolPanels).toHaveLength(4);
  expect(geometry.predictiveSummaryCards).toBe(3);

  const districtList = page.locator(".kec-list");
  await expect(districtList).toBeVisible();
  const districtRows = await districtList.locator(".kec-row").count();
  expect(districtRows).toBeGreaterThan(0);
  expect(districtRows).toBeLessThanOrEqual(8);
});

test("Waste Forecast exposes operational charts for district priority and weather trend", async ({ page }) => {
  await page.getByRole("button", { name: "Waste Forecast" }).click();
  await waitForForecastLayoutReady(page);

  await expect(page.getByRole("heading", { name: "District priority" })).toBeVisible();
  await expect(page.locator(".district-priority-chart .district-priority-row")).toHaveCount(1);
  await expect(page.locator(".district-priority-row").first()).toContainText("Jakarta Barat");
  await expect(page.locator(".district-priority-row").first()).toContainText("29 trucks");
  await expect(page.getByRole("heading", { name: "Waste load by district" })).toBeVisible();
  const verticalBars = page.locator(".district-vertical-chart .district-vertical-bar");
  await expect(verticalBars).toHaveCount(6);
  await expect(verticalBars.first()).toContainText(/\d+t/);

  await expect(page.getByRole("heading", { name: "Rainfall impact trend" })).toBeVisible();
  const trend = page.locator(".weather-trend-chart");
  const trendRows = await trend.locator(".weather-trend-row").count();
  expect(trendRows).toBeGreaterThanOrEqual(2);
  expect(trendRows).toBeLessThanOrEqual(7);
  await expect(trend.locator(".weather-trend-row").first()).toContainText(/\d+ mm/);
  await expect(trend.locator(".weather-trend-row").first()).toContainText(/\+\d+%/);
});

test("WhatsApp Gateway keeps configuration cards aligned in one row", async ({ page }) => {
  await page.getByRole("button", { name: "WhatsApp Gateway" }).click();

  const cards = await page.locator(".wa-config-stack > .panel").evaluateAll((panels) => panels.map((panel) => {
    const box = panel.getBoundingClientRect();
    return { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) };
  }));

  expect(cards).toHaveLength(2);
  expect(cards[0].top).toBe(cards[1].top);
  expect(cards[1].left).toBeGreaterThan(cards[0].left + cards[0].width);
  expect(Math.abs(cards[0].height - cards[1].height)).toBeLessThanOrEqual(1);
});

test("Integrated Planning presents an ordered decision flow", async ({ page }) => {
  await page.getByRole("button", { name: "Integrated Planning" }).click();
  await waitForPlanningLayoutReady(page);
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
    backgroundColor: "rgb(255, 255, 255)",
    borderTopWidth: "1px",
    borderRadius: "24px",
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

  const panelTitleSizes = await workspace.locator(".panel-title h2, .decision-stage-header h2").evaluateAll((elements) => (
    elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  ));
  expect(panelTitleSizes.every((size) => size >= 20)).toBe(true);
});

test("Integrated Planning uses a board layout and visible plan placeholder", async ({ page }) => {
  await page.getByRole("button", { name: "Integrated Planning" }).click();
  await waitForPlanningLayoutReady(page);

  const stages = await page.locator(".planning-workspace > .decision-stage").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: box.width,
      padding: style.paddingTop,
      borderLeft: style.borderLeftWidth,
    };
  }));

  expect(stages).toHaveLength(3);
  expect(stages[1].width).toBeGreaterThan(stages[0].width * 1.18);
  expect(stages[1].width).toBeGreaterThan(stages[2].width * 1.18);
  expect(stages.every((stage) => stage.padding === "24px")).toBe(true);

  const emptyPlan = page.locator(".optimizer-empty-state");
  await expect(emptyPlan).toBeVisible();
  await expect(emptyPlan.locator("strong")).toHaveText("No dispatch plan generated yet.");
  const buttonWidth = await page.getByRole("button", { name: "Generate Dispatch Plan (CP-SAT)" }).evaluate((button) => button.getBoundingClientRect().width);
  const stageWidth = await page.locator(".planning-workspace > .decision-stage").nth(1).evaluate((stage) => stage.getBoundingClientRect().width);
  expect(buttonWidth).toBeLessThan(stageWidth - 48);
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
