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
