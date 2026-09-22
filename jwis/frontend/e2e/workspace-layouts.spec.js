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

test("fleet opens as a map-led decision workspace", async ({ page }) => {
  const map = page.getByTestId("fleet-map-stage");
  const action = page.getByTestId("action-card");
  await expect(map).toBeVisible();
  await expect(action).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tindakan prioritas" })).toBeVisible();
  const [mapBox, railBox] = await Promise.all([
    map.boundingBox(),
    page.locator(".fleet-decision-rail").boundingBox(),
  ]);
  expect(mapBox.width).toBeGreaterThan(railBox.width);
  expect(mapBox.x).toBeLessThan(railBox.x);
});

test("fleet evidence tabs reveal one surface and support keyboard selection", async ({ page }) => {
  const fleet = page.getByRole("tab", { name: "Status Armada" });
  const history = page.getByRole("tab", { name: "Riwayat Perjalanan" });
  await expect(fleet).toHaveAttribute("aria-selected", "true");
  await history.click();
  await expect(history).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("fleet-history-surface")).toBeVisible();
  await expect(page.getByTestId("fleet-table-surface")).toBeHidden();

  await history.focus();
  await page.keyboard.press("Home");
  await expect(fleet).toBeFocused();
  await expect(fleet).toHaveAttribute("aria-selected", "true");
});

test("mobile fleet puts the urgent decision before the map without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => {
    const decision = document.querySelector(".fleet-decision-rail").getBoundingClientRect();
    const map = document.querySelector(".fleet-map-surface").getBoundingClientRect();
    return { decisionTop: decision.top, mapTop: map.top, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(geometry.decisionTop).toBeLessThan(geometry.mapTop);
  expect(geometry.overflow).toBeLessThanOrEqual(2);
});

test("forecast keeps district demand primary and horizon controls functional", async ({ page }) => {
  await page.getByRole("button", { name: "Prediksi" }).click();
  const primary = page.getByTestId("forecast-primary-analysis");
  const context = page.locator(".forecast-context-rail");
  await expect(primary).toBeVisible();
  await expect(context).toBeVisible();
  await expect(page.locator(".kec-list .kec-row").first()).toBeVisible({ timeout: 15000 });
  expect(await page.locator(".kec-list .kec-row").count()).toBeLessThanOrEqual(8);

  const selected = page.getByRole("button", { name: "7 hari" });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const next = page.getByRole("button", { name: "14 hari" });
  await next.click();
  await expect(next).toHaveAttribute("aria-pressed", "true");

  const [primaryBox, contextBox] = await Promise.all([primary.boundingBox(), context.boundingBox()]);
  expect(primaryBox.width).toBeGreaterThan(contextBox.width);
});

test("planning presents scenario, allocation, and approval as one flow", async ({ page }) => {
  await page.route("**/api/operations/plan?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        plan_id: "PLAN-E2E",
        status: "proposed",
        assignments: [{ truck_code: "T-001", area: "tebet", assigned_tons: 24, evidence: { capacity_tons: 24, permit_compliant: true } }],
        unmet_reasons: [],
        total_demand_tons: 24,
        total_assigned_tons: 24,
        scenario: { rainfall_mm: 42, event_attendance: 85000, is_weekend: true },
      }),
    });
  });

  await page.getByRole("button", { name: "Rencana" }).click();
  await expect(page.locator(".planning-progress li")).toHaveCount(3);
  for (const heading of ["Tetapkan skenario", "Susun alokasi", "Tinjau & setujui"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Susun Alokasi Armada" }).click();
  await expect(page.getByText("ID rencana: PLAN-E2E")).toBeVisible();
  await expect(page.getByText("Izin sesuai")).toBeVisible();
});

test("driver workspace pairs fleet scores with one coaching priority", async ({ page }) => {
  await page.getByTestId("workspace-navigation").getByRole("button", { name: "Sopir" }).click();
  await expect(page.getByRole("heading", { name: "Kinerja pengemudi" })).toBeVisible();
  await expect(page.locator(".driver-table tbody tr")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Agus Pratama" })).toBeVisible();
  await expect(page.getByText("Prioritas pembinaan")).toBeVisible();
});

test("audit workspace exposes provenance and model suitability evidence", async ({ page }) => {
  await page.getByRole("button", { name: "Audit Data & Model ML" }).click();
  await expect(page.getByRole("heading", { name: "Audit data & model" })).toBeVisible();
  await expect(page.locator(".audit-table tbody tr").first()).toBeVisible({ timeout: 15000 });
  expect(await page.locator(".audit-table tbody tr").count()).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Resolusi yang didukung" })).toBeVisible();
});
