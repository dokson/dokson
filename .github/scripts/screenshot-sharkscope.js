const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'https://www.sharkscope.com/#Player-Statistics//networks/PokerStars.it/players/dOkSsOn';
const OUTPUT_PATH = path.join(process.cwd(), 'assets', 'sharkscope-graph.png');

// Selectors to try in order — SharkScope uses Highcharts
const CHART_SELECTORS = [
  '.highcharts-container',
  '[id*="highcharts"]',
  'svg.highcharts-root',
  '.chart-container',
  '#chart',
  'canvas',
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  console.log('Navigating to SharkScope...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for network to settle after SPA routing
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
    console.log('networkidle timeout — proceeding anyway');
  });

  // Extra wait for chart rendering (Highcharts is async)
  await page.waitForTimeout(5000);

  // Try to find and screenshot the chart element
  let chartEl = null;
  for (const selector of CHART_SELECTORS) {
    const els = await page.$$(selector);
    if (els.length > 0) {
      // Pick the largest element (main profit chart)
      let largest = null;
      let largestArea = 0;
      for (const el of els) {
        const box = await el.boundingBox();
        if (box && box.width * box.height > largestArea) {
          largest = el;
          largestArea = box.width * box.height;
        }
      }
      chartEl = largest;
      console.log(`Chart found with selector: ${selector} (${Math.round(largestArea)} px²)`);
      break;
    }
  }

  if (!chartEl) {
    console.error('No chart element found — SharkScope may be blocking the request or the daily search limit has been reached.');
    await browser.close();
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  await chartEl.screenshot({ path: OUTPUT_PATH });
  console.log(`Screenshot saved to ${OUTPUT_PATH}`);

  await browser.close();
})();
