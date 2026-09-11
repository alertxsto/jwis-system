import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("A* panel shows AI Traffic Monitor without simulate button", async ({ page }) => {
  await expect(page.getByText("AI Traffic Monitor")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".astar-toggle-btn")).toHaveCount(0);
});

test("TPA queue panel shows live AI gauge by default", async ({ page }) => {
  await page.getByRole("tab", { name: "Antrean TPA & Optimasi" }).click();
  await expect(page.getByText("Prediksi Antrian TPA")).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator(".tpa-live-gauge, .ai-feed-empty").first()
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "What-if" })).toBeVisible();
});

test("planning flow shows AI 7-day outlook panel", async ({ page }) => {
  await page.getByRole("button", { name: "Perencanaan Terpadu" }).click();
  await expect(page.getByText("AI 7-Day Outlook")).toBeVisible({ timeout: 15000 });
});

test("carbon panel shows live stats or honest placeholder", async ({ page }) => {
  await page.getByRole("tab", { name: "Jejak Karbon" }).click();
  await expect(
    page.getByText(/Reference factors|Menunggu engine AI/)
  ).toBeVisible({ timeout: 15000 });
});

test("unlicensed panel reads ai flags endpoint", async ({ page }) => {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/ai/unlicensed-flags"),
    { timeout: 20000 }
  );
  await page.getByRole("tab", { name: "Kolektor Liar" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
});
