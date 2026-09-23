import { test, expect, request } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";

async function authenticatedApi() {
  const bootstrap = await request.newContext();
  const login = await bootstrap.post(`${API}/auth/login`, {
    data: { username: "dispatcher", password: "dispatcher-demo-pass" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  await bootstrap.dispose();
  const api = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  return { api, token };
}

async function openAuthorizedField(page, token) {
  await page.goto("/field");
  await page.evaluate((value) => localStorage.setItem("jwis_token", value), token);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

// Manager dispatches an instruction -> field worker sees the newest pending item and confirms it.
test("newest manager dispatch flows to field app and is confirmed", async ({ page }) => {
  const { api, token } = await authenticatedApi();
  const runId = Date.now();
  const olderInstruction = `E2E older instruction ${runId}`;
  const newestInstruction = `E2E newest instruction ${runId}`;
  const older = await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-047", instruction: olderInstruction, manager_id: "e2e" },
  });
  const newest = await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-047", instruction: newestInstruction, manager_id: "e2e" },
  });
  expect(older.ok()).toBeTruthy();
  expect(newest.ok()).toBeTruthy();
  const newestDispatch = await newest.json();
  expect(Number.isNaN(Date.parse(newestDispatch.created_at))).toBe(false);

  await openAuthorizedField(page, token);
  await page.getByTestId("truck-select").selectOption("T-047");

  const active = page.getByTestId("active-dispatch");
  await expect(active).toBeVisible({ timeout: 10000 });
  await expect(active).toContainText(newestInstruction);
  await expect(active).not.toContainText(olderInstruction);

  await page.getByTestId("btn-ready").click();
  await expect(page.getByTestId("field-status")).toContainText("Instruksi diterima", { timeout: 10000 });
});

test("same-millisecond dispatches preserve ISO microsecond ordering", async ({ page }) => {
  await page.route("**/api/dispatch/T-047", async (route) => {
    await route.fulfill({
      json: [
        {
          id: "z-older",
          truck_code: "T-047",
          instruction: "Older microsecond instruction",
          field_status: "PENDING",
          created_at: "2026-07-15T10:00:00.123456+00:00",
        },
        {
          id: "a-newer",
          truck_code: "T-047",
          instruction: "Newest microsecond instruction",
          field_status: "PENDING",
          created_at: "2026-07-15T10:00:00.123789+00:00",
        },
      ],
    });
  });

  await page.goto("/field");
  const active = page.getByTestId("active-dispatch");
  await expect(active).toContainText("Newest microsecond instruction");
  await expect(active).not.toContainText("Older microsecond instruction");
});

// Offline startup, failed sync, and recovery preserve the chosen Field language.
test("offline confirmation queues, reports sync failure, and recovers in ID and EN", async ({ page, context }) => {
  const { api, token } = await authenticatedApi();
  await openAuthorizedField(page, token);
  for (const [lang, copy] of [
    ["id", { queued: "aksi menunggu sinkronisasi", failed: "Aksi belum tersinkron", synced: "Aksi antrean tersinkron" }],
    ["en", { queued: "action awaiting sync", failed: "Actions did not sync", synced: "Queued actions synced" }],
  ]) {
    const instruction = `E2E ${lang} offline ${Date.now()}`;
    const create = await api.post(`${API}/dispatch`, {
      data: { truck_code: "T-001", instruction, manager_id: "e2e" },
    });
    expect(create.ok()).toBeTruthy();
    await page.getByTestId(`field-lang-${lang}`).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await page.getByTestId("truck-select").selectOption("T-001");
    await expect(page.getByTestId("active-dispatch")).toContainText(instruction, { timeout: 10000 });

    await context.setOffline(true);
    await page.getByTestId("btn-ready").click();
    await expect(page.getByTestId("queued-count")).toContainText(copy.queued);
    await page.evaluate(() => localStorage.setItem("jwis_token", "invalid"));
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("field-status")).toContainText(copy.failed, { timeout: 10000 });
    await expect(page.getByTestId("queued-count")).toBeVisible();

    await page.evaluate((value) => localStorage.setItem("jwis_token", value), token);
    await page.getByRole("button", { name: lang === "id" ? "Sinkronkan sekarang" : "Sync now" }).click();
    await expect(page.getByTestId("field-status")).toContainText(copy.synced, { timeout: 10000 });
    await expect(page.getByTestId("queued-count")).toBeHidden();
  }
  await api.dispose();
});

test("field app has no mobile overflow and all workflow controls meet minimum touch targets", async ({ page }) => {
  const { api } = await authenticatedApi();
  await api.post(`${API}/dispatch`, {
    data: { truck_code: "T-112", instruction: "E2E mobile touch target", manager_id: "e2e" },
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/field");
  await page.getByTestId("truck-select").selectOption("T-112");

  const ready = page.getByTestId("btn-ready");
  await expect(ready).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  for (const control of [
    page.getByTestId("truck-select"),
    page.getByTestId("incident-reason"),
    ready,
    page.getByTestId("btn-issue"),
    page.locator(".field-brand"),
    page.locator(".back-link"),
  ]) {
    await expectMinimumTouchTarget(control);
  }
});

test("field brand remains a minimum touch target at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/field");
  await expectMinimumTouchTarget(page.locator(".field-brand"));
});

test("field brand and workflow controls meet minimum touch targets at the 860px boundary", async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 1024 });
  await page.goto("/field");

  for (const control of [
    page.locator(".field-brand"),
    page.getByTestId("truck-select"),
    page.getByTestId("incident-reason"),
    page.getByTestId("btn-ready"),
    page.getByTestId("btn-issue"),
    page.locator(".back-link"),
  ]) {
    await expectMinimumTouchTarget(control);
  }
});

test("secondary alert action authenticates and persists one dispatch despite a double tap", async ({ page }) => {
  const { api, token } = await authenticatedApi();
  const key = `e2e-secondary-${Date.now()}`;
  const alert = {
    id: key,
    truck_code: "T-210",
    title: key,
    description: `Follow up ${key}`,
    severity: "warning",
    recommended_routes: [],
  };
  await page.route("**/api/command-center", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    await route.fulfill({ response, json: { ...snapshot, alerts: [alert, ...snapshot.alerts] } });
  });
  await page.goto("/");
  await page.evaluate((value) => {
    localStorage.setItem("jwis_token", value);
    localStorage.setItem("jwis_auth", "true");
    localStorage.setItem("jwis_role", "dispatcher");
  }, token);
  await page.reload();
  await page.getByRole("button", { name: "Lapisan & kontrol" }).click();
  await page.locator(".alert-queue-collapsible summary").click();
  const item = page.locator(".alert-item").filter({ hasText: key });
  await expect(item).toBeVisible();
  await page.evaluate((value) => {
    const item = [...document.querySelectorAll(".alert-item")].find((node) => node.textContent.includes(value));
    const button = item.querySelector(".primary-button");
    button.click();
    button.click();
  }, key);
  let created;
  try {
    await expect.poll(async () => {
      const response = await api.get(`${API}/dispatch/T-210`);
      expect(response.ok()).toBeTruthy();
      const matches = (await response.json()).filter((dispatch) => dispatch.instruction.includes(key));
      created = matches[0];
      return matches.length;
    }, { timeout: 15000 }).toBe(1);
    await expect(item).toContainText("DIKIRIM");
    expect(created.manager_id).toBe("dispatcher");
  } finally {
    if (created) await api.post(`${API}/dispatch/${created.id}/confirm`, { data: { status: "READY", note: "E2E cleanup" } });
    await api.dispose();
  }
});

test("command-center action distinguishes field READY from ISSUE and shows the field note", async ({ page }) => {
  test.setTimeout(100000);
  const { api, token } = await authenticatedApi();
  await page.goto("/");
  await page.evaluate((value) => {
    localStorage.setItem("jwis_token", value);
    localStorage.setItem("jwis_auth", "true");
    localStorage.setItem("jwis_role", "dispatcher");
    localStorage.setItem("jwis_lang", "id");
  }, token);
  const created = [];
  try {
    for (const status of ["READY", "ISSUE"]) {
      await page.reload();
      // Pin the explicit truck: live priority rankings may change while the
      // acknowledgement is pending, but this card must keep its target.
      await page.locator('.truck-marker[aria-label^="T-047"]').first().evaluate((marker) => marker.click());
      const card = page.getByTestId("action-card");
      await expect(card.getByRole("button", { name: "Kirim rute ke sopir" })).toBeVisible({ timeout: 15000 });
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/dispatch") && response.request().method() === "POST",
      );
      await card.getByRole("button", { name: "Kirim rute ke sopir" }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const dispatch = await response.json();
      created.push(dispatch.id);
      await expect(card.getByTestId("action-card-sent")).toBeVisible();
      const note = `E2E field ${status} ${Date.now()}`;
      const confirm = await api.post(`${API}/dispatch/${dispatch.id}/confirm`, { data: { status, note } });
      expect(confirm.ok()).toBeTruthy();
      if (status === "READY") {
        await expect(card.getByTestId("action-card-confirmed")).toBeVisible({ timeout: 25000 });
        await expect(card.getByTestId("action-card-escalated")).toHaveCount(0);
      } else {
        await expect(card.getByTestId("action-card-escalated")).toContainText(note, { timeout: 25000 });
        await expect(card.getByTestId("action-card-confirmed")).toHaveCount(0);
      }
    }
  } finally {
    for (const id of created) {
      const response = await api.get(`${API}/dispatch/${id}/status`);
      if (response.ok() && (await response.json()).field_status === "PENDING") {
        await api.post(`${API}/dispatch/${id}/confirm`, { data: { status: "READY", note: "E2E cleanup" } });
      }
    }
    await api.dispose();
  }
});
