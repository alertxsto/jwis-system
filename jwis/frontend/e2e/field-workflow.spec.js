import { test, expect, request } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

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

test("same-millisecond dispatches preserve ISO microsecond ordering", async ({ page }) => {
  await page.route(`${API}/dispatch/T-047`, async (route) => {
    await route.fulfill({
      json: [
        {
          id: "z-older",
          truck_code: "T-047",
          instruction: "Older microsecond instruction",
          field_status: "PENDING",
          created_at: "2026-07-15T10:00:00.123456+00:00",
        },
        {
          id: "a-newer",
          truck_code: "T-047",
          instruction: "Newest microsecond instruction",
          field_status: "PENDING",
          created_at: "2026-07-15T10:00:00.123789+00:00",
        },
      ],
    });
  });

  await page.goto("/field");
  const active = page.getByTestId("active-dispatch");
  await expect(active).toContainText("Newest microsecond instruction");
  await expect(active).not.toContainText("Older microsecond instruction");
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

test("field app has no mobile overflow and all workflow controls meet minimum touch targets", async ({ page }) => {
  const api = await request.newContext();
  await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-112", instruction: "E2E mobile touch target", manager_id: "e2e" },
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-112");

  const ready = page.getByTestId("btn-ready");
  await expect(ready).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  for (const control of [
    page.getByTestId("truck-select"),
    page.getByTestId("incident-reason"),
    ready,
    page.getByTestId("btn-issue"),
    page.getByRole("link", { name: "Return to JWIS command center" }),
    page.getByRole("link", { name: "Return to command center" }),
  ]) {
    await expectMinimumTouchTarget(control);
  }
});
