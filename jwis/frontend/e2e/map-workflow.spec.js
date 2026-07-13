import { test, expect } from "@playwright/test";

// Map truthfulness E2E: render, deviation coloring, heatmap, TPA marker.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
});

test("map canvas renders (not blank)", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible({ timeout: 15000 });
});

test("actual routes colored by violation state", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const kinds = await page.evaluate(() => window.__jwisMapFeatures?.actualKinds || []);
  // At least one clean (green) and, given T-047 deviates, one violation (red).
  expect(kinds).toContain("actual-clean");
  expect(kinds).toContain("actual-violation");
});

test("map legend shows provenance tags", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".map-legend")).toContainText("LIVE");
  await expect(page.locator(".map-legend")).toContainText("MODEL");
  await expect(page.locator(".map-legend")).toContainText("SIM");
});

test("fleet panel labeled Simulation not Live", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const pill = page.locator(".panel.map-panel .pill");
  await expect(pill).toContainText("Simulation");
});

test("TPA marker present on map", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".tpa-marker")).toBeVisible({ timeout: 15000 });
});
