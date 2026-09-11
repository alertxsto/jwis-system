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
