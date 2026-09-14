import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
const PHOTO = "e2e/fixtures/test-photo.png";
const TEST_TRUCK = "T-220";

async function cancelLeftoverSpj(page) {
  const resp = await page.request.get(`${API}/spj?status=aktif`);
  for (const s of (await resp.json()).spj || []) {
    if (s.truck_code === TEST_TRUCK) {
      await page.request.post(`${API}/spj/${s.spj_id}/cancel`);
    }
  }
}

test("driver runs full SPJ flow: pretrip, stop evidence, receipt", async ({ page, context }) => {
  await cancelLeftoverSpj(page);

  const fleet = await (await page.request.get(`${API}/fleet`)).json();
  const trucks = Array.isArray(fleet) ? fleet : fleet.trucks;
  const t220 = trucks.find((t) => t.truck_code === TEST_TRUCK);

  const create = await page.request.post(`${API}/spj`, {
    data: {
      driver_name: t220.driver_name,
      truck_code: TEST_TRUCK,
      destination: "TPST Bantargebang",
      weigh_on_site: true,
      priority: "normal",
      note: "e2e driver",
    },
  });
  expect(create.status()).toBe(201);
  const spj = await create.json();

  const stop = await page.request.post(`${API}/spj/${spj.spj_id}/stops`, {
    data: {
      name: "TPS E2E",
      kecamatan: "Cilandak",
      address: "Jl. E2E",
      lat: -6.29,
      lng: 106.79,
    },
  });
  expect(stop.ok()).toBeTruthy();

  const activate = await page.request.post(`${API}/spj/${spj.spj_id}/activate`);
  expect(activate.ok()).toBeTruthy();

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -6.29, longitude: 106.79 });

  // ── Gate: pick driver (Slamet Riyadi drives multiple trucks — target T-220) ──
  await page.goto("/driver");
  await page.locator('[data-testid="pick-T-220"]').click();
  await expect(page.getByText(TEST_TRUCK, { exact: true }).first()).toBeVisible();

  // ── Pre-trip (form on fresh day, SELESAI state on re-run) ──
  // The form flips to SELESAI when /pretrip/today resolves — never hold a locator across that async boundary.
  const doneBadge = page.getByTestId("pretrip-done");
  const formVisible = await page
    .getByRole("button", { name: /Simpan Inspeksi/i })
    .isVisible()
    .catch(() => false);
  if (formVisible) {
    await page.getByRole("button", { name: "Tandai Sisanya Baik" }).click();
    await page.getByRole("button", { name: /Simpan Inspeksi/i }).click();
  }
  await expect(doneBadge).toBeVisible({ timeout: 15000 });

  // ── Stop evidence: arrival photo → weighing photo + weight → officer photo + name ──
  await page.getByRole("button", { name: "Mulai Titik Ini" }).first().click();

  await page.locator('[data-testid="arrival-input"]').setInputFiles(PHOTO);
  await expect(page.getByText("Kedatangan", { exact: true })).toBeVisible({ timeout: 10000 });

  await page.locator('[data-testid="weigh-input"]').setInputFiles(PHOTO);
  await page.getByLabel("Berat (kg)").fill("120");
  await page.getByRole("button", { name: "Tambah Timbangan" }).click();
  await expect(page.getByText("Timbang Residu", { exact: true })).toBeVisible({ timeout: 10000 });

  await page.locator('[data-testid="officer-input"]').setInputFiles(PHOTO);
  await page.getByLabel("Nama Petugas").fill("Budi Petugas");
  await page.getByRole("button", { name: "Selesaikan Titik" }).click();
  // Only stop in the SPJ → SPJ becomes "selesai" and receipt card replaces stop cards.
  await expect(page.locator('[data-testid="delivery-card"]')).toBeVisible({ timeout: 10000 });

  const afterStop = await (await page.request.get(`${API}/spj/${spj.spj_id}`)).json();
  expect(afterStop.stops[0].status).toBe("completed");

  // ── Receipt upload → done ──
  await page.locator('[data-testid="receipt-input"]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Kirim Struk" }).click();
  await expect(page.getByText("Tugas selesai")).toBeVisible({ timeout: 10000 });
});

test("pretrip with a TIDAK item auto-creates a damage report", async ({ page, context }) => {
  // First test already submitted pretrip for T-220 today; use another truck.
  const PRETTRIP_TRUCK = "T-221";
  const pretrip = await (await page.request.get(`${API}/pretrip/today/${PRETTRIP_TRUCK}`)).json();
  test.skip(Boolean(pretrip.done), "pretrip already submitted today for this truck");

  await context.grantPermissions(["geolocation"]);

  await page.goto("/driver");
  await page.evaluate(() => localStorage.removeItem("jwis_driver"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator(`[data-testid="pick-${PRETTRIP_TRUCK}"]`).click();

  // Mark "Ban dan roda" TIDAK (ban → severity berat), fill mandatory note.
  await page.getByRole("button", { name: "Tandai Sisanya Baik" }).click();
  await page.locator('[data-testid="tidak-ban"]').click();
  await page.getByLabel(/Catatan/i).fill("Ban belakang kanan bocor e2e");
  await page.getByRole("button", { name: /Simpan Inspeksi/i }).click();
  await expect(page.getByText("SELESAI").first()).toBeVisible({ timeout: 10000 });

  const reports = await (await page.request.get(`${API}/damage-reports?status=baru`)).json();
  const mine = (reports.reports || []).filter(
    (r) => r.truck_code === PRETTRIP_TRUCK && r.source === "pretrip" && r.component === "ban",
  );
  expect(mine.length).toBeGreaterThan(0);
  expect(mine[0].severity).toBe("berat");
});
