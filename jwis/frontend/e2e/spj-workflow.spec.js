import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
const TEST_TRUCK = "T-210";

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
  return { Authorization: `Bearer ${principal.token}` };
}

test("admin sees SPJ in panel, expands it, and activates it", async ({ page }) => {
  const headers = await signIn(page);
  const existing = await page.request.get(`${API}/spj`);
  for (const spj of (await existing.json()).spj || []) {
    if (spj.truck_code === TEST_TRUCK && ["draft", "aktif"].includes(spj.status)) {
      await page.request.post(`${API}/spj/${spj.spj_id}/cancel`, { headers });
    }
  }

  const create = await page.request.post(`${API}/spj`, {
    headers,
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
    headers,
    data: { name: "TPS E2E", kecamatan: "Cilandak", address: "Jl. E2E 1", lat: -6.29, lng: 106.79 },
  });
  expect(stop.ok()).toBeTruthy();

  try {
    await page.getByRole("button", { name: "Surat Perintah Jalan" }).click();
    await expect(page.getByText(spj.spj_number).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(spj.spj_number).first().click();
    await page.getByRole("button", { name: "Ubah ke aktif" }).click();
    await expect(page.getByText("Aktif", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  } finally {
    await page.request.post(`${API}/spj/${spj.spj_id}/cancel`, { headers });
  }
});

test("Fleet SPJ mutations and lifecycle labels follow authorization and ID/EN", async ({ page }) => {
  test.setTimeout(90000);
  const headers = await signIn(page);
  const dispatcherToken = headers.Authorization.slice(7);
  const driverLogin = await page.request.post(`${API}/auth/login`, {
    data: { username: "driver", password: "driver-demo-pass" },
  });
  expect(driverLogin.ok()).toBeTruthy();
  const { token: driverToken } = await driverLogin.json();
  const sites = await page.request.get(`${API}/geo/tps-coordinates`);
  expect(sites.ok()).toBeTruthy();
  const site = (await sites.json()).features[0].properties.name;
  const created = [];
  const panel = page.locator(".spj-panel");
  const row = (number) => panel.locator(".spj-row").filter({ hasText: number });
  const status = (number) => row(number).locator("td").last();
  async function addStop() {
    await panel.locator(".spj-form input[list='spj-sites']").fill(site);
    await panel.getByRole("button", { name: "Tambah titik" }).click();
  }
  async function createOrder() {
    await panel.locator(".spj-form select").first().selectOption("T-209");
    await addStop();
    await addStop();
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/spj") && response.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Simpan draf" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const spj = await response.json();
    created.push(spj.spj_id);
    await expect(row(spj.spj_number)).toBeVisible();
    return spj;
  }

  try {
    await page.getByRole("button", { name: "Surat Perintah Jalan" }).click();
    await expect(panel.getByRole("combobox", { name: "Kendaraan" })).toBeVisible();
    const first = await createOrder();
    await expect(status(first.spj_number)).toHaveText("Draf");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(status(first.spj_number)).toHaveText("Draft");
    await page.getByRole("button", { name: "ID", exact: true }).click();
    await row(first.spj_number).getByRole("button").click();
    await panel.getByRole("button", { name: "Ubah ke aktif" }).click();
    await expect(status(first.spj_number)).toHaveText("Aktif");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(status(first.spj_number)).toHaveText("Active");
    await panel.getByRole("button", { name: "Mark stop complete" }).first().click();
    await expect(row(first.spj_number)).toContainText("1/2");
    await panel.getByRole("button", { name: "Complete order" }).click();
    await expect(status(first.spj_number)).toHaveText("Completed");
    await page.getByRole("button", { name: "ID", exact: true }).click();
    await expect(status(first.spj_number)).toHaveText("Selesai");

    const second = await createOrder();
    await row(second.spj_number).getByRole("button").click();
    await page.evaluate(() => localStorage.removeItem("jwis_token"));
    await panel.getByRole("button", { name: "Batalkan SPJ" }).click();
    await expect(panel.getByRole("alert")).toContainText("Sesi berakhir");
    await expect(status(second.spj_number)).toHaveText("Draf");
    await page.evaluate((token) => localStorage.setItem("jwis_token", token), driverToken);
    await panel.getByRole("button", { name: "Batalkan SPJ" }).click();
    await expect(panel.getByRole("alert")).toContainText("tidak memiliki izin");
    await expect(status(second.spj_number)).toHaveText("Draf");
    await page.evaluate((token) => localStorage.setItem("jwis_token", token), dispatcherToken);
    await panel.getByRole("button", { name: "Batalkan SPJ" }).click();
    await expect(status(second.spj_number)).toHaveText("Dibatalkan");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(status(second.spj_number)).toHaveText("Canceled");
    await expect(panel.getByRole("heading", { name: "Dispatch orders" })).toBeVisible();
  } finally {
    for (const id of created) {
      const response = await page.request.get(`${API}/spj/${id}`);
      if (response.ok() && ["draft", "aktif"].includes((await response.json()).status)) {
        await page.request.post(`${API}/spj/${id}/cancel`, { headers });
      }
    }
  }
});
