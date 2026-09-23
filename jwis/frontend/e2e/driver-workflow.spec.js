import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
const PHOTO = "e2e/fixtures/test-photo.png";
const TEST_TRUCK = "T-220";

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
  return { Authorization: `Bearer ${principal.token}` };
}

async function cancelLeftoverSpj(page, headers) {
  const resp = await page.request.get(`${API}/spj?status=aktif`);
  for (const s of (await resp.json()).spj || []) {
    if (s.truck_code === TEST_TRUCK) {
      await page.request.post(`${API}/spj/${s.spj_id}/cancel`, { headers });
    }
  }
}

test("driver runs full SPJ flow: pretrip, stop evidence, receipt", async ({ page, context }) => {
  const headers = await signIn(page);
  await cancelLeftoverSpj(page, headers);

  const fleet = await (await page.request.get(`${API}/fleet`)).json();
  const trucks = Array.isArray(fleet) ? fleet : fleet.trucks;
  const t220 = trucks.find((t) => t.truck_code === TEST_TRUCK);

  const create = await page.request.post(`${API}/spj`, {
    headers,
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
    headers,
    data: {
      name: "TPS E2E",
      kecamatan: "Cilandak",
      address: "Jl. E2E",
      lat: -6.29,
      lng: 106.79,
    },
  });
  expect(stop.ok()).toBeTruthy();

  const activate = await page.request.post(`${API}/spj/${spj.spj_id}/activate`, { headers });
  expect(activate.ok()).toBeTruthy();

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -6.29, longitude: 106.79 });

  // ── Gate: pick driver (Slamet Riyadi drives multiple trucks — target T-220) ──
  await page.goto("/driver");
  const pretripLoaded = page.waitForResponse((response) => response.url().includes(`/pretrip/today/${TEST_TRUCK}`));
  await page.locator('[data-testid="pick-T-220"]').click();
  await pretripLoaded;
  await expect(page.getByText(TEST_TRUCK, { exact: true }).first()).toBeVisible();

  // ── Pre-trip (form on fresh day, SELESAI state on re-run) ──
  // The form flips to SELESAI when /pretrip/today resolves — never hold a locator across that async boundary.
  const doneBadge = page.getByTestId("pretrip-done");
  const markRemaining = page.getByRole("button", { name: "Tandai Sisanya Baik" });
  await expect(doneBadge.or(markRemaining)).toBeVisible({ timeout: 15000 });
  if (await markRemaining.isVisible()) {
    await markRemaining.click();
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

  // ── Receipt: OCR may be unavailable; confirmed manual weight remains usable ──
  await page.locator('[data-testid="receipt-input"]').setInputFiles(PHOTO);
  const sendReceipt = page.getByRole("button", { name: "Kirim Struk" });
  await expect(sendReceipt).toBeDisabled();
  await page.getByLabel("Berat truk bermuatan (kg)").fill("12450");
  await expect(sendReceipt).toBeDisabled();
  await page.getByLabel("Saya sudah mencocokkan berat dengan struk foto.").check();
  await sendReceipt.click();
  await expect(page.getByText("Tugas selesai")).toBeVisible({ timeout: 10000 });
  const receipt = (await (await page.request.get(`${API}/spj/${spj.spj_id}`)).json()).receipt;
  expect(receipt.total_weight_kg).toBe(12450);
  expect(receipt.weight_source).toBe("manual");
  expect(receipt.has_photo).toBe(true);
  expect(receipt.photo_b64).toBeUndefined();
  const photo = await page.request.get(`${API}/spj/${spj.spj_id}/receipt/photo`,
                                       { headers });
  expect(photo.ok()).toBeTruthy();
  expect((await photo.json()).photo_b64).toContain("data:image/");
});

test("driver is offered the newest receipt-pending SPJ, not the oldest", async ({ page, context }) => {
  const headers = await signIn(page);
  await cancelLeftoverSpj(page, headers);

  // Two completed SPJs for one truck: the older one already has its receipt,
  // the newer one is still pending. Position must come from server state.
  async function completedSpj(truck) {
    const created = await page.request.post(`${API}/spj`, {
      headers,
      data: { driver_name: "E2E Receipt", truck_code: truck,
              destination: "TPST Bantargebang", weigh_on_site: true,
              priority: "normal", note: "e2e receipt order" },
    });
    const spj = await created.json();
    await page.request.post(`${API}/spj/${spj.spj_id}/stops`, {
      headers,
      data: { name: "TPS Receipt", kecamatan: "Cilandak", address: "Jl. Receipt",
              lat: -6.29, lng: 106.79 },
    });
    await page.request.post(`${API}/spj/${spj.spj_id}/activate`, { headers });
    await page.request.post(`${API}/spj/${spj.spj_id}/stops/0/complete`, {
      headers,
      data: { evidence: {
        arrival: { photo_name: "a.jpg", lat: -6.29, lng: 106.79,
                   at: "2026-09-14T09:00:00" },
        weighing: [{ fraction: "Residu", weight_kg: 40.0, photo_name: "t.jpg" }],
        officer: { photo_name: "p.jpg", name: "Dicky" },
      } },
    });
    return spj;
  }

  const older = await completedSpj(TEST_TRUCK);
  await page.request.post(`${API}/spj/${older.spj_id}/receipt`, {
    headers,
    data: { photo_name: "struk-lama.jpg", photo_b64: "data:image/jpeg;base64,AA",
            total_weight_kg: 100, weight_source: "manual" },
  });
  const newer = await completedSpj(TEST_TRUCK);

  await page.goto("/driver");
  await page.locator(`[data-testid="pick-${TEST_TRUCK}"]`).click();
  const card = page.getByTestId("delivery-card");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).toHaveAttribute("data-spj-id", newer.spj_id);
  const history = await (await page.request.get(`${API}/spj?status=selesai`)).json();
  const mine = history.spj.filter((s) => s.truck_code === TEST_TRUCK);
  expect(mine[0].spj_id).toBe(newer.spj_id);
  expect(mine[0].receipt).toBeNull();
});

test("pretrip with a TIDAK item auto-creates a damage report", async ({ page, context }) => {
  await signIn(page);
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

test("admin sees damage report and resolves it", async ({ page }) => {
  const headers = await signIn(page);
  const create = await page.request.post(`${API}/damage-reports`, {
    headers,
    data: {
      truck_code: "T-230", driver_name: "E2E Admin", component: "rem",
      severity: "berat", note: "e2e admin panel note",
    },
  });
  expect(create.status()).toBe(201);
  const rep = await create.json();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Laporan Kerusakan" }).click();
  await expect(page.getByText("e2e admin panel note").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("NON-OPERASIONAL").first()).toBeVisible();

  await page.request.post(`${API}/damage-reports/${rep.report_id}/resolve`, { headers });
});

test("admin sees spj evidence summary after driver flow", async ({ page }) => {
  const headers = await signIn(page);
  const create = await page.request.post(`${API}/spj`, {
    headers,
    data: {
      driver_name: "E2E Evidence", truck_code: "T-231",
      destination: "TPST Bantargebang", weigh_on_site: true,
      priority: "normal", note: "e2e evidence",
    },
  });
  const spj = await create.json();
  await page.request.post(`${API}/spj/${spj.spj_id}/stops`, {
    headers,
    data: { name: "TPS Evidence", kecamatan: "Cilandak", address: "Jl. Bukti", lat: -6.29, lng: 106.79 },
  });
  await page.request.post(`${API}/spj/${spj.spj_id}/activate`, { headers });
  await page.request.post(`${API}/spj/${spj.spj_id}/stops/0/complete`, {
    headers,
    data: {
      evidence: {
        arrival: { photo_name: "a.jpg", lat: -6.29, lng: 106.79, at: "2026-09-14T09:00:00" },
        weighing: [{ fraction: "Residu", weight_kg: 40.0, photo_name: "t.jpg" }],
        officer: { photo_name: "p.jpg", name: "Dicky" },
      },
    },
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Surat Perintah Jalan" }).click();
  await page.getByText(spj.spj_number).first().click();
  await expect(page.getByText(/Petugas: Dicky/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/40(\.0)? kg/)).toBeVisible();
});
