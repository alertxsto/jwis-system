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

test("operations context exposes the AI traffic monitor without a simulate button", async ({ page }) => {
  await page.getByTestId("deck-tools-toggle").click();
  await expect(page.getByText("AI Traffic Monitor")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".astar-toggle-btn")).toHaveCount(0);
});

test("TPA queue shows its forecast gauge or honest empty state", async ({ page }) => {
  await page.getByRole("tab", { name: "Antrean TPA" }).click();
  await expect(page.getByText(/Prediksi Antrean TPA|Prediksi Antrian TPA/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".tpa-live-gauge, .ai-feed-empty").first()).toBeVisible();
});

test("planning flow exposes the seven-day outlook", async ({ page }) => {
  await page.getByRole("button", { name: "Rencana" }).click();
  await expect(page.getByText("Prediksi AI 7 hari")).toBeVisible({ timeout: 15000 });
});

test("carbon evidence shows data or an honest placeholder", async ({ page }) => {
  await page.locator(".records-doc-link", { hasText: "Jejak Karbon" }).click();
  await expect(page.getByText(/Reference factors|Menunggu engine AI/)).toBeVisible({ timeout: 15000 });
});

test("unlicensed collector surface reads the AI flags endpoint", async ({ page }) => {
  const responsePromise = page.waitForResponse((res) => res.url().includes("/api/ai/unlicensed-flags"), { timeout: 20000 });
  await page.locator(".records-doc-link", { hasText: "Kolektor Liar" }).click();
  expect((await responsePromise).ok()).toBeTruthy();
});
