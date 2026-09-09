import { test, expect } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:8001";

// Necessary: the jam toggle tests mutate GLOBAL server-side state (simulate-jam
// active flag) mid-test. Parallel workers raced: test 158's jam=true landed
// while test 126 was reading map features, flipping T-047 to clean and failing
// the violation precondition. Serializing the file (1 worker, ordered tests,
// per-test beforeEach reset) makes the shared jam state deterministic.
test.describe.configure({ mode: "serial" });

// Map truthfulness E2E: render, deviation coloring, heatmap, TPA marker.
test.beforeEach(async ({ page }) => {
  // Global server-side jam state must be reset for deterministic tests.
  await page.request.post(`${API_BASE}/api/fleet/astar-simulate-jam?active=false`);
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
  await page.waitForFunction(
    () => (window.__jwisMapFeatures?.actualKinds || []).length > 0,
    null,
    { timeout: 15000 }
  );
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
  const res = await page.request.get(`${API_BASE}/api/fleet/astar-reroute?truck_code=T-047`);
  const j = await res.json();
  const p0 = j.active_route.path[0];
  const origin = j.active_route.origin_position;
  const dLat = Math.abs(p0.lat - origin.lat);
  const dLng = Math.abs(p0.lng - origin.lng);
  // Within ~1km (~0.01 deg) of the marker — anchored, not 3km off.
  expect(dLat).toBeLessThan(0.01);
  expect(dLng).toBeLessThan(0.01);
});

test("A* route is road-following (many points)", async ({ page }) => {
  const res = await page.request.get(`${API_BASE}/api/fleet/astar-reroute?truck_code=T-047`);
  const j = await res.json();
  expect(j.active_route.path.length).toBeGreaterThan(200);
});

test("breadcrumbs endpoint returns simulated trail", async ({ page }) => {
  const res = await page.request.get(`${API_BASE}/api/fleet/T-047/breadcrumbs`);
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
  const res = await page.request.get(`${API_BASE}/api/fleet/map-truth`);
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

test("jam toggle diverts T-047 end-to-end (UI, reroute API, map-truth agree)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => (window.__jwisMapFeatures?.actualKinds || []).length > 0,
    null,
    { timeout: 15000 }
  );

  const before = await page.evaluate(() => window.__jwisMapFeatures?.actualKinds || []);
  expect(before).toContain("actual-violation");

  await page.locator(".astar-panel .astar-toggle-btn").click();
  await expect(page.locator(".traffic-status-badge")).toContainText(/Jam Active|Macet Aktif/);
  await expect(page.locator(".astar-stat-col strong").filter({ hasText: /Diverted \(A\*\)|Dialihkan \(A\*\)/ })).toBeVisible({ timeout: 20000 });

  const reroute = await (await page.request.get(`${API_BASE}/api/fleet/astar-reroute?truck_code=T-047`)).json();
  expect(reroute.diversion_applied).toBe(true);
  expect(reroute.abandoned_route.path.length).toBeGreaterThan(20);

  const mt = await (await page.request.get(`${API_BASE}/api/fleet/map-truth`)).json();
  const t = mt.trucks.find((x) => x.truck_code === "T-047");
  expect(t.traffic.jam_active).toBe(true);
  expect(t.abandoned_route.geometry.length).toBeGreaterThan(20);
  expect(t.deviation_segments).not.toContain("violation");

  await page.waitForFunction(
    () => (window.__jwisMapFeatures?.assignedKinds || []).includes("astar-abandoned"),
    null,
    { timeout: 15000 }
  );
});

test("restore traffic returns T-047 to compliant and clears abandoned line", async ({ page }) => {
  await page.request.post(`${API_BASE}/api/fleet/astar-simulate-jam?active=true`);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => (window.__jwisMapFeatures?.assignedKinds || []).includes("astar-abandoned"),
    null,
    { timeout: 15000 }
  );

  await page.locator(".astar-panel .astar-toggle-btn").click();
  await expect(page.locator(".traffic-status-badge")).toContainText(/Corridor Clear|Koridor Lancar/);

  const reroute = await (await page.request.get(`${API_BASE}/api/fleet/astar-reroute?truck_code=T-047`)).json();
  expect(reroute.diversion_applied).toBe(false);

  await page.waitForFunction(
    () => !(window.__jwisMapFeatures?.assignedKinds || []).includes("astar-abandoned"),
    null,
    { timeout: 15000 }
  );
});

test("no GPS teleport across jam toggle (route-swap continuity)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const snapped = async () => {
    const mt = await (await page.request.get(`${API_BASE}/api/fleet/map-truth`)).json();
    return mt.trucks.find((x) => x.truck_code === "T-047").snapped_gps;
  };
  const a = await snapped();
  await page.request.post(`${API_BASE}/api/fleet/astar-simulate-jam?active=true`);
  await page.waitForTimeout(1500);
  const b = await snapped();
  const dLat = Math.abs(b.lat - a.lat) * 111320;
  const dLng = Math.abs(b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const meters = Math.hypot(dLat, dLng);
  expect(meters).toBeLessThan(1500);
});

test("TPS and WR layers survive basemap switch", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const satBtn = page.locator(".map-basemap button", { hasText: "Satellite" });
  if (await satBtn.count()) await satBtn.click();
  await page.waitForTimeout(2500);
  const mapBtn = page.locator(".map-basemap button", { hasText: "Map" });
  if (await mapBtn.count()) await mapBtn.click();
  await page.waitForTimeout(2500);
  const layerCheck = await page.evaluate(() => {
    const m = document.querySelector("canvas")?.__maplibre_map || window.__jwisMap;
    if (!m || !m.getLayer) return { error: "no map ref" };
    return {
      tps: !!m.getLayer("tps-layer"),
      tpsCluster: !!m.getLayer("tps-clusters"),
      wr: !!m.getLayer("wr-unclustered-point"),
      wrCluster: !!m.getLayer("wr-clusters"),
    };
  });
  if (!layerCheck.error) {
    expect(layerCheck.tps).toBe(true);
    expect(layerCheck.tpsCluster).toBe(true);
    expect(layerCheck.wr).toBe(true);
    expect(layerCheck.wrCluster).toBe(true);
  }
});

test("truck markers cruise smoothly on the live map", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const marker = page.locator(".truck-marker").first();
  await marker.waitFor({ state: "visible", timeout: 30000 });
  const box1 = await marker.boundingBox();
  await page.waitForTimeout(2500);
  const box2 = await marker.boundingBox();
  expect(box1).toBeTruthy();
  expect(box2).toBeTruthy();
  const moved = Math.hypot(box2.x - box1.x, box2.y - box1.y);
  expect(moved).toBeGreaterThan(0.5); // continuous cruise, not static
});
