import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  await page.getByRole("button", { name: "Surat Perintah Jalan" }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }, { width: 320, height: 720 }]) {
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

test("document language follows the stored locale across routes and reloads", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await page.getByTestId("lang-switch-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  for (const route of ["/field", "/driver", "/pengawas"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  }
  await page.evaluate(() => localStorage.removeItem("jwis_auth"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Forecast has one main landmark and named analysis regions", async ({ page }) => {
  await page.getByTestId("workspace-navigation").getByRole("button", { name: "Prediksi" }).click();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Peta kebutuhan layanan" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Rincian prediksi" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Faktor pemicu prediksi" })).toBeVisible();
});

test("core workspaces meet text contrast requirements", async ({ page }) => {
  test.setTimeout(120000);
  const scan = async (surface) => {
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(results.violations, `${surface}: ${JSON.stringify(results.violations.map(({ nodes }) => nodes.map(({ target }) => target)))}`).toEqual([]);
  };

  await page.evaluate(() => localStorage.removeItem("jwis_auth"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Masuk ke pusat kendali" })).toBeVisible();
  await scan("login");
  await signIn(page);
  for (const [workspace, heading] of [
    [null, "Operasi armada hari ini"],
    ["Prediksi", "Prediksi timbulan sampah"],
    ["Rencana", "Rencana operasi terpadu"],
    ["Audit Data & Model ML", "Audit data & model"],
  ]) {
    if (workspace) await page.getByTestId("workspace-navigation").getByRole("button", { name: workspace }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await scan(workspace || "Fleet");
  }
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
