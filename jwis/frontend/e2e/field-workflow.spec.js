import { test, expect, request } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";

// Manager dispatches an instruction -> field worker sees and confirms it.
test("manager dispatch flows to field app and is confirmed", async ({ page }) => {
  const api = await request.newContext();
  const created = await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-047", instruction: "E2E: collect at Cengkareng", manager_id: "e2e" },
  });
  expect(created.ok()).toBeTruthy();

  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-047");

  const active = page.getByTestId("active-dispatch");
  await expect(active).toBeVisible({ timeout: 10000 });
  await expect(active).toContainText("E2E: collect at Cengkareng");

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
