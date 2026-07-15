import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("Fleet Operations is the default map-led workspace", async ({ page }) => {
  await expect(page.getByTestId("fleet-workspace")).toBeVisible();
  await expect(page.getByTestId("fleet-map-stage")).toBeVisible();
  const mapBox = await page.getByTestId("fleet-map-stage").evaluate((el) => el.getBoundingClientRect());
  expect(mapBox.width).toBeGreaterThan(650);
  expect(mapBox.height).toBeGreaterThan(460);
});

test("fleet detail tabs reveal one operational surface at a time", async ({ page }) => {
  const history = page.getByRole("tab", { name: "Trip history" });
  await history.click();
  await expect(page.getByTestId("fleet-history-surface")).toBeVisible();
  await expect(page.getByTestId("fleet-table-surface")).toBeHidden();
});
