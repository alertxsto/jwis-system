import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
const TEST_TRUCK = "T-210";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("admin sees SPJ in panel, expands it, activates it", async ({ page }) => {
  // Cleanup leftovers from prior runs so activation is not blocked (one active SPJ per truck).
  const existing = await page.request.get(`${API}/spj`);
  for (const s of (await existing.json()).spj || []) {
    if (s.truck_code === TEST_TRUCK && ["draft", "aktif"].includes(s.status)) {
      await page.request.post(`${API}/spj/${s.spj_id}/cancel`);
    }
  }

  // Setup via API: create draft SPJ + one stop (activation requires >= 1 stop).
  const create = await page.request.post(`${API}/spj`, {
    data: {
      driver_name: "E2E Driver",
      truck_code: TEST_TRUCK,
      destination: "TPST Bantargebang",
      weigh_on_site: false,
      priority: "normal",
      note: "e2e",
    },
  });
  expect(create.status()).toBe(201);
  const spj = await create.json();

  const stop = await page.request.post(`${API}/spj/${spj.spj_id}/stops`, {
    data: {
      name: "TPS E2E",
      kecamatan: "Cilandak",
      address: "Jl. E2E 1",
      lat: -6.29,
      lng: 106.79,
    },
  });
  expect(stop.ok()).toBeTruthy();

  try {
    // UI flow: open SPJ tab, find the SPJ, expand, activate via button.
    await page.getByText("Surat Perintah Jalan").first().click();
    await expect(page.getByText(spj.spj_number).first()).toBeVisible({ timeout: 15000 });

    await page.getByText(spj.spj_number).first().click();
    await page.getByRole("button", { name: "Rubah ke Aktif" }).click();
    await expect(page.getByText("aktif").first()).toBeVisible({ timeout: 10000 });
  } finally {
    await page.request.post(`${API}/spj/${spj.spj_id}/cancel`);
  }
});
