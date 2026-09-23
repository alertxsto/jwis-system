import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";

async function signIn(page) {
  await page.goto("/");
  const response = await page.request.post(`${API}/auth/login`, {
    data: { username: "dispatcher", password: "dispatcher-demo-pass" },
  });
  expect(response.ok()).toBeTruthy();
  const principal = await response.json();
  await page.evaluate(({ token, role }) => {
    localStorage.setItem("jwis_auth", "true");
    localStorage.setItem("jwis_lang", "id");
    localStorage.setItem("jwis_token", token);
    localStorage.setItem("jwis_role", role);
  }, principal);
  await page.reload({ waitUntil: "domcontentloaded" });
}

test.beforeEach(async ({ page }) => signIn(page));

test("assistant keeps keyboard focus inside and restores it after dismissal", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Asisten operasi" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Asisten operasi" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Ask Ana anything" })).toBeFocused();
  for (const selector of [".command-sidebar", ".command-topbar", ".command-canvas", ".command-mobile-nav"]) {
    await expect(page.locator(selector)).toHaveJSProperty("inert", true);
  }

  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole("button", { name: "Tutup asisten" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("textbox", { name: "Ask Ana anything" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Tutup asisten" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  for (const selector of [".command-sidebar", ".command-topbar", ".command-canvas", ".command-mobile-nav"]) {
    await expect(page.locator(selector)).toHaveJSProperty("inert", false);
  }
  await trigger.click();
  await page.getByRole("dialog", { name: "Asisten operasi" }).getByRole("button", { name: "Tutup asisten" }).click();
  await expect(trigger).toBeFocused();
});

test("mobile assistant trigger keeps an accessible name in both languages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.locator(".command-assistant");
  await expect(trigger).toHaveAccessibleName("Asisten operasi");
  await page.getByTestId("lang-switch-en").click();
  await expect(trigger).toHaveAccessibleName("Operations assistant");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Operations assistant" })).toBeVisible();
});
