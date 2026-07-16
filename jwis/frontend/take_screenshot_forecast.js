const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set auth state
  await page.goto('http://127.0.0.1:5175');
  await page.evaluate(() => localStorage.setItem("jwis_auth", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
  
  // Go to Waste Forecast
  await page.getByRole("button", { name: "Waste Forecast" }).click();
  
  // Wait for kecamatan list to load
  await page.waitForSelector('.kec-row');
  
  // Click on the first kecamatan (Cakung)
  await page.locator('.kec-row').first().click();
  
  // Wait a bit for state update
  await page.waitForTimeout(500);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshot_forecast.png', fullPage: true });
  
  await browser.close();
  console.log("Screenshot taken successfully!");
})();
