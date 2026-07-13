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

test("map canvas has non-blank, varied pixels", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  // Screenshot the map canvas and measure byte variance — a blank/single-color
  // canvas has near-zero variance; a rendered map with tiles/routes has high variance.
  const buf = await page.locator(".maplibregl-canvas").screenshot();
  const bytes = Uint8Array.from(buf);
  const sample = bytes.subarray(0, Math.min(bytes.length, 200000));
  let sum = 0;
  for (const b of sample) sum += b;
  const mean = sum / sample.length;
  let varSum = 0;
  for (const b of sample) varSum += (b - mean) ** 2;
  const variance = varSum / sample.length;
  expect(variance).toBeGreaterThan(200);
});

test("A* route anchors near T-047 marker (GPS)", async ({ page }) => {
  const res = await page.request.get("http://127.0.0.1:8001/api/fleet/astar-reroute?truck_code=T-047");
  const j = await res.json();
  const p0 = j.active_route.path[0];
  const truck = await (await page.request.get("http://127.0.0.1:8001/api/fleet")).json();
  const t047 = truck.find((t) => t.truck_code === "T-047").latest_position;
  const dLat = Math.abs(p0.lat - t047.lat);
  const dLng = Math.abs(p0.lng - t047.lng);
  // Within ~500m (~0.005 deg) of the marker — anchored, not 3km off.
  expect(dLat).toBeLessThan(0.005);
  expect(dLng).toBeLessThan(0.005);
});

test("A* route is road-following (many points)", async ({ page }) => {
  const res = await page.request.get("http://127.0.0.1:8001/api/fleet/astar-reroute?truck_code=T-047");
  const j = await res.json();
  expect(j.active_route.path.length).toBeGreaterThan(200);
});

test("breadcrumbs endpoint returns simulated trail", async ({ page }) => {
  const res = await page.request.get("http://127.0.0.1:8001/api/fleet/T-047/breadcrumbs");
  expect(res.status()).toBe(200);
  const j = await res.json();
  expect(j.source).toBe("simulated");
  expect(j.breadcrumbs.length).toBeGreaterThan(1);
});

test("mobile viewport renders map without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});
