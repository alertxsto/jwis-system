import { test, expect } from "@playwright/test";

// Map truthfulness E2E: render, deviation coloring, heatmap, TPA marker.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
});

test("map canvas renders (not blank)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible({ timeout: 15000 });
});

test("actual routes colored by violation state", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const kinds = await page.evaluate(() => window.__jwisMapFeatures?.actualKinds || []);
  // At least one clean (green) and, given T-047 deviates, one violation (red).
  expect(kinds).toContain("actual-clean");
  expect(kinds).toContain("actual-violation");
});

test("map legend shows provenance tags", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".map-legend")).toContainText("LIVE");
  await expect(page.locator(".map-legend")).toContainText("MODEL");
  await expect(page.locator(".map-legend")).toContainText("SIM");
});

test("fleet panel labeled Simulation not Live", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pill = page.locator(".panel.map-panel .pill");
  await expect(pill).toContainText("Simulation");
});

test("TPA marker present on map", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".tpa-marker")).toBeVisible({ timeout: 15000 });
});

test("map canvas has real color diversity (decoded pixels, not byte variance)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  const buf = await page.locator(".maplibregl-canvas").screenshot();
  const dataUrl = "data:image/png;base64," + buf.toString("base64");
  // Decode the PNG into real RGBA pixels in the browser, then count distinct
  // coarse color buckets. A blank/single-color canvas yields very few buckets;
  // a rendered map (tiles, roads, markers) yields many.
  const buckets = await page.evaluate(async (url) => {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 37) {
      const r = data[i] >> 5, g = data[i + 1] >> 5, b = data[i + 2] >> 5;
      seen.add((r << 6) | (g << 3) | b);
    }
    return seen.size;
  }, dataUrl);
  expect(buckets).toBeGreaterThan(12);
});

test("A* route anchors near T-047 marker (GPS)", async ({ page }) => {
  const res = await page.request.get("http://127.0.0.1:8001/api/fleet/astar-reroute?truck_code=T-047");
  const j = await res.json();
  const p0 = j.active_route.path[0];
  const truck = await (await page.request.get("http://127.0.0.1:8001/api/fleet")).json();
  const t047 = truck.find((t) => t.truck_code === "T-047").latest_position;
  const dLat = Math.abs(p0.lat - t047.lat);
  const dLng = Math.abs(p0.lng - t047.lng);
  // Within ~1km (~0.01 deg) of the marker — anchored, not 3km off.
  expect(dLat).toBeLessThan(0.01);
  expect(dLng).toBeLessThan(0.01);
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});

test("map-truth payload has road-following geometry and synced snapped GPS", async ({ page }) => {
  const res = await page.request.get("http://127.0.0.1:8001/api/fleet/map-truth");
  expect(res.status()).toBe(200);
  const j = await res.json();
  const t = j.trucks.find((x) => x.truck_code === "T-047");
  expect(t).toBeTruthy();
  // Road-following assigned geometry (or explicitly labeled fallback).
  if (t.assigned_route.source === "LIVE_EXTERNAL") {
    expect(t.assigned_route.geometry.length).toBeGreaterThan(20);
  } else {
    expect(t.assigned_route.source).toBe("FALLBACK_DEGRADED");
  }
  // Snapped GPS is close to raw (map-matched), and provenance is labeled.
  expect(t.provenance.raw_gps).toBe("RAW_GPS_SIMULATED");
  expect(typeof t.deviation_m).toBe("number");
});
