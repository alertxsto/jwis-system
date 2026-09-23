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

test("fleet opens as a map-led command deck with a decision overlay", async ({ page }) => {
  const map = page.getByTestId("fleet-map-stage");
  const overlay = page.getByTestId("decision-overlay");
  await expect(map).toBeVisible();
  await expect(overlay).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tindakan prioritas" })).toBeVisible();
  await expect(overlay.getByTestId("action-card")).toBeVisible();

  // The deck is one full-bleed canvas: the decision instrument floats over the
  // map's own right edge rather than competing in a separate rail column.
  const [mapBox, overlayBox] = await Promise.all([map.boundingBox(), overlay.boundingBox()]);
  expect(overlayBox.x).toBeGreaterThan(mapBox.x + mapBox.width * 0.5);
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 2);
});

test("problem strip focuses the worst deviation and opens evidence tabs", async ({ page }) => {
  const deviationChip = page.getByTestId("problem-chip-deviation");
  await expect(deviationChip).toBeVisible();
  await expect(deviationChip).toBeEnabled();
  await deviationChip.click();
  await expect(page.getByTestId("decision-overlay").getByTestId("action-card")).toBeVisible();

  const queueChip = page.getByTestId("problem-chip-queue");
  if (await queueChip.isEnabled()) {
    await queueChip.click();
    await expect(page.getByTestId("fleet-queue-surface")).toBeVisible();
  }
});

test("fleet evidence tabs reveal one surface and support keyboard selection", async ({ page }) => {
  const tablist = page.getByRole("tablist", { name: "Detail armada" });
  const fleet = tablist.getByRole("tab", { name: "Status Armada" });
  const history = tablist.getByRole("tab", { name: "Riwayat Perjalanan" });
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

test("document links open operational document surfaces", async ({ page }) => {
  await page.locator(".records-doc-link", { hasText: "Surat Perintah Jalan" }).click();
  await expect(page.getByTestId("fleet-spj-surface")).toBeVisible();
  await page.locator(".records-doc-link", { hasText: "Laporan Kerusakan" }).click();
  await expect(page.getByTestId("fleet-damage-surface")).toBeVisible();
});

test("mobile fleet collapses the decision into a bottom sheet without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sheet = page.getByTestId("deck-action-sheet");
  await expect(sheet).toBeVisible();
  const geometry = await page.evaluate(() => {
    const overlay = document.querySelector(".deck-decision-overlay");
    return {
      overlayHidden: overlay ? getComputedStyle(overlay).display === "none" : true,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.overlayHidden).toBe(true);
  expect(geometry.overflow).toBeLessThanOrEqual(2);

  await page.locator(".deck-sheet-handle").click();
  await expect(sheet.getByTestId("action-card")).toBeVisible();
});

test("map layers panel opens inside the deck and lists controls", async ({ page }) => {
  await page.getByTestId("deck-tools-toggle").click();
  const panel = page.getByTestId("deck-tools-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Lapisan", { exact: true })).toBeVisible();
  await expect(panel.locator(".map-controls-grid label").first()).toBeVisible();
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

test("audit workspace exposes provenance and model suitability evidence", async ({ page }) => {
  await page.getByRole("button", { name: "Audit Data & Model ML" }).click();
  await expect(page.getByRole("heading", { name: "Audit data & model" })).toBeVisible();
  await expect(page.locator(".audit-table tbody tr").first()).toBeVisible({ timeout: 15000 });
  expect(await page.locator(".audit-table tbody tr").count()).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Resolusi yang didukung" })).toBeVisible();
});
