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
    await page.getByRole("tab", { name: "Surat Perintah Jalan" }).click();
    await expect(page.getByText(spj.spj_number).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(spj.spj_number).first().click();
    await page.getByRole("button", { name: "Rubah ke Aktif" }).click();
    await expect(page.getByText("aktif").first()).toBeVisible({ timeout: 10000 });
  } finally {
    await page.request.post(`${API}/spj/${spj.spj_id}/cancel`, { headers });
  }
});
