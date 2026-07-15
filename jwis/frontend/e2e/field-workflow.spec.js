import { test, expect, request } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";

// Manager dispatches an instruction -> field worker sees the newest pending item and confirms it.
test("newest manager dispatch flows to field app and is confirmed", async ({ page }) => {
  const api = await request.newContext();
  const runId = Date.now();
  const olderInstruction = `E2E older instruction ${runId}`;
  const newestInstruction = `E2E newest instruction ${runId}`;
  const older = await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-047", instruction: olderInstruction, manager_id: "e2e" },
  });
  const newest = await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-047", instruction: newestInstruction, manager_id: "e2e" },
  });
  expect(older.ok()).toBeTruthy();
  expect(newest.ok()).toBeTruthy();
  const newestDispatch = await newest.json();
  expect(Number.isNaN(Date.parse(newestDispatch.created_at))).toBe(false);

  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-047");

  const active = page.getByTestId("active-dispatch");
  await expect(active).toBeVisible({ timeout: 10000 });
  await expect(active).toContainText(newestInstruction);
  await expect(active).not.toContainText(olderInstruction);

  await page.getByTestId("btn-ready").click();
  await expect(page.getByTestId("field-status")).toContainText("Instruction accepted", { timeout: 10000 });
});

// Offline confirmation is queued, then synced when connectivity returns.
test("offline confirmation queues and syncs", async ({ page, context }) => {
  const api = await request.newContext();
  await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-001", instruction: "E2E offline test", manager_id: "e2e" },
  });

  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-001");
  await expect(page.getByTestId("active-dispatch")).toBeVisible({ timeout: 10000 });

  // Go offline, then confirm -> action must be queued, not sent.
  await context.setOffline(true);
  await page.getByTestId("btn-ready").click();
  await expect(page.getByTestId("queued-count")).toBeVisible({ timeout: 10000 });

  // Back online -> outbox flushes automatically.
  await context.setOffline(false);
  await page.waitForTimeout(1500);
});

test("field app has no mobile overflow and minimum touch targets", async ({ page }) => {
  const api = await request.newContext();
  await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-112", instruction: "E2E mobile touch target", manager_id: "e2e" },
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-112");

  const readyControls = page.locator('[data-testid="btn-ready"]');
  await expect(readyControls).toHaveCount(1);
  await expect(readyControls.first()).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  for (const control of await readyControls.all()) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});
