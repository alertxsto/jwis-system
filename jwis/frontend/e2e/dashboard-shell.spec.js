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

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

test.beforeEach(async ({ page }) => signIn(page));

test("command rail exposes five task workspaces and preserves active state", async ({ page }) => {
  const nav = page.getByTestId("workspace-navigation");
  await expect(nav).toBeVisible();
  const labels = ["Armada", "Prediksi", "Rencana", "Sopir", "Audit Data & Model ML"];
  await expect(nav.getByRole("button")).toHaveCount(labels.length);
  for (const label of labels) await expect(nav.getByRole("button", { name: label })).toBeVisible();

  for (const [label, heading] of [["Prediksi", "Prediksi timbulan sampah"], ["Rencana", "Rencana operasi terpadu"], ["Armada", "Operasi armada hari ini"]]) {
    const button = nav.getByRole("button", { name: label });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("desktop and mobile layouts never create document-level horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  }
});

test("mobile bottom navigation stays reachable and switches workspaces", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const nav = page.locator(".command-mobile-nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button")).toHaveCount(5);
  for (const button of await nav.getByRole("button").all()) await expectMinimumTouchTarget(button);

  const planning = nav.getByRole("button", { name: "Rencana" });
  await planning.click();
  await expect(planning).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Rencana operasi terpadu" })).toBeVisible();
});

test("assistant opens as a modal and closes without leaving the workspace", async ({ page }) => {
  await page.getByRole("button", { name: "Asisten operasi" }).click();
  const dialog = page.getByRole("dialog", { name: "Asisten operasi" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".assistant-chat-shell")).toBeVisible();
  await dialog.getByRole("button", { name: "Tutup asisten" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("fleet-workspace")).toBeVisible();
});

test("workspace navigation emits no runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const label of ["Prediksi", "Rencana", "Sopir", "Audit Data & Model ML", "Armada"]) {
    await page.getByTestId("workspace-navigation").getByRole("button", { name: label }).click();
  }
  expect(errors).toEqual([]);
});

test("login requires explicit credentials and exposes password visibility control", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem("jwis_auth");
    localStorage.removeItem("jwis_token");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Masuk ke pusat kendali" })).toBeVisible();
  await expect(page.getByPlaceholder("contoh: dispatcher")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Tampilkan kata sandi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
});
