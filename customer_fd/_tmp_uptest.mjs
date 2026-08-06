import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:\Program Files\Google\Chrome\Application\chrome.exe" });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto(process.argv[2], { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Jump straight to Features first
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(900);
console.log("at features:", await page.evaluate(() => window.scrollY));

// Now scroll up with many small nudges, like a real wheel/trackpad
for (let i = 1; i <= 15; i++) {
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(900);
console.log("after small nudges up:", await page.evaluate(() => window.scrollY));

await page.screenshot({ path: process.argv[3] });
await browser.close();
