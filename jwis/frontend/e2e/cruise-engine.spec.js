import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const engineSrc = readFileSync(join(here, "../src/cruiseEngine.js"), "utf-8");

async function loadEngine(page) {
  await page.goto("about:blank");
  // Strip the export keyword so we can eval in page context.
  const src = engineSrc.replace("export function createCruiseEngine", "function createCruiseEngine");
  await page.evaluate(`${src}; window.__engine = createCruiseEngine();`);
}

const ROUTE = [
  [106.8, -6.2],
  [106.81, -6.2],
  [106.81, -6.21],
];

test("registerTruck + tick menghasilkan posisi on-polyline", async ({ page }) => {
  await loadEngine(page);
  const res = await page.evaluate(
    ([route]) => {
      const e = window.__engine;
      const ok = e.registerTruck("T-001", route, { speedKmh: 36, startFraction: 0 });
      const out0 = e.tick(1000);
      const out1 = e.tick(2000); // 1s at 10 m/s
      return { ok, out0, out1 };
    },
    [ROUTE],
  );
  expect(res.ok).toBe(true);
  expect(res.out0.length).toBe(1);
  expect(res.out1[0][0]).toBe("T-001");
  // moved ~10m east along first segment (lng increases, lat ~same)
  expect(res.out1[0][1][0]).toBeGreaterThan(ROUTE[0][0]);
  expect(Math.abs(res.out1[0][1][1] - ROUTE[0][1])).toBeLessThan(0.0005);
});

test("ping-pong di ujung rute membalik arah, tidak keluar polyline", async ({ page }) => {
  await loadEngine(page);
  const res = await page.evaluate(
    ([route]) => {
      const e = window.__engine;
      e.registerTruck("T-002", route, { speedKmh: 720, startFraction: 0.95 });
      let t = 1000;
      const positions = [];
      for (let i = 0; i < 40; i += 1) {
        t += 250;
        positions.push(e.tick(t)[0][1]);
      }
      return positions;
    },
    [ROUTE],
  );
  // route spans lng 106.80-106.81, lat -6.20 to -6.21; positions must stay in bbox
  for (const [lng, lat] of res) {
    expect(lng).toBeGreaterThanOrEqual(106.7999);
    expect(lng).toBeLessThanOrEqual(106.8101);
    expect(lat).toBeLessThanOrEqual(-6.1999);
    expect(lat).toBeGreaterThanOrEqual(-6.2101);
  }
});

test("softCorrect converge ke target tanpa snap > blend", async ({ page }) => {
  await loadEngine(page);
  const res = await page.evaluate(
    ([route]) => {
      const e = window.__engine;
      e.registerTruck("T-003", route, { speedKmh: 0, startFraction: 0 });
      e.tick(1000);
      const target = [106.805, -6.205];
      const before = e.tick(1000)[0][1];
      e.softCorrect("T-003", target, 0.2);
      const after1 = e.tick(1100)[0][1];
      const step = Math.hypot(after1[0] - before[0], after1[1] - before[1]);
      const fullDist = Math.hypot(target[0] - before[0], target[1] - before[1]);
      for (let i = 0; i < 20; i += 1) e.softCorrect("T-003", target, 0.2);
      const final = e.tick(2000)[0][1];
      return { step, fullDist, final, target };
    },
    [ROUTE],
  );
  // each correction moves at most ~blend * remaining distance (never a full snap)
  expect(res.step).toBeLessThanOrEqual(res.fullDist * 0.25);
  // converges close to target after many corrections
  const d = Math.hypot(res.final[0] - res.target[0], res.final[1] - res.target[1]);
  expect(d).toBeLessThan(0.0005);
});

test("pause/resume menghentikan dan melanjutkan gerakan; removeTruck membersihkan", async ({ page }) => {
  await loadEngine(page);
  const res = await page.evaluate(
    ([route]) => {
      const e = window.__engine;
      e.registerTruck("T-004", route, { speedKmh: 36, startFraction: 0.2 });
      e.tick(1000);
      const p1 = e.tick(2000)[0][1];
      e.pauseTruck("T-004");
      const p2 = e.tick(3000)[0][1];
      const movedWhilePaused = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      e.resumeTruck("T-004");
      const p3 = e.tick(4000)[0][1];
      const movedAfterResume = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      e.removeTruck("T-004");
      const afterRemove = e.tick(5000).length;
      return { movedWhilePaused, movedAfterResume, afterRemove, has: e.has("T-004") };
    },
    [ROUTE],
  );
  expect(res.movedWhilePaused).toBe(0);
  expect(res.movedAfterResume).toBeGreaterThan(0);
  expect(res.afterRemove).toBe(0);
  expect(res.has).toBe(false);
});
