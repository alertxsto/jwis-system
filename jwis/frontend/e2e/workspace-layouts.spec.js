import { test, expect } from "@playwright/test";

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
  await expect(page.getByTestId("forecast-driver-rail")).toBeVisible();
  await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
});
