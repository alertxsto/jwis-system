import { chromium } from '@playwright/test';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('request', request => console.log('REQ >>', request.method(), request.url()));
  page.on('response', response => console.log('RES <<', response.status(), response.url()));
  try {
    await page.goto('http://127.0.0.1:5175', { waitUntil: 'networkidle', timeout: 10000 });
    // Fill credentials
    await page.fill('#username', 'dispatcher');
    await page.fill('#password', 'dispatcher-demo-pass');
    // Click sign in
    await page.click('button[type="submit"]');
    // Wait for navigation/dashboard content
    await page.waitForTimeout(3000);
    // Take screenshot of logged-in state
    await page.screenshot({ path: 'D:/screenshot_debug_logged_in.png', fullPage: true });
  } catch (e) {
    console.log("Error during login test:", e.message);
  }
  await browser.close();
})();
