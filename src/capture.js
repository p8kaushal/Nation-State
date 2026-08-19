import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIRS = [
  '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591',
  '/Users/parthkaushal/.gemini/antigravity/brain/2189a140-61b9-46d2-bb1d-772f486c47af',
];

for (const dir of ARTIFACT_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveScreenshots(page, filename) {
  for (const dir of ARTIFACT_DIRS) {
    const fullPath = path.join(dir, filename);
    try {
      await page.screenshot({ path: fullPath });
      console.log(`Saved screenshot: ${fullPath}`);
    } catch (e) {
      console.warn(`Failed to write to ${fullPath}:`, e.message);
    }
  }
}

(async () => {
  const server = await createServer({
    server: { port: 5173 }
  });
  await server.listen();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // -------------------------------------------------------------
  // Part 1: Mobile 375px Viewport (iPhone SE / Standard Mobile)
  // -------------------------------------------------------------
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 500));

  // Enter game from Title screen
  await page.click('#home-new-game-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-start-presidency-btn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // 1. Capture 375px Main Game Screen (Desk view)
  await saveScreenshots(page, 'mobile_375_desk.png');
  console.log('✓ Captured mobile_375_desk.png');

  // 2. Click Stats / Cabinet tab & capture
  await page.click('#mobile-tab-stats');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_stats.png');
  console.log('✓ Captured mobile_375_stats.png');

  // 3. Click Briefings tab & capture
  await page.click('#mobile-tab-briefing');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_log.png');
  console.log('✓ Captured mobile_375_log.png');

  // 4. Click Past Runs button (from top-bar) & capture modal
  await page.click('#mobile-tab-desk');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#past-runs-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_past_runs.png');
  console.log('✓ Captured mobile_375_past_runs.png');

  // Close past runs modal
  await page.click('#close-history-btn');
  await new Promise(resolve => setTimeout(resolve, 300));

  // -------------------------------------------------------------
  // Part 2: Mobile 428px Viewport (iPhone 13/14 Pro Max)
  // -------------------------------------------------------------
  await page.setViewport({ width: 428, height: 926 });
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_428_desk.png');
  console.log('✓ Captured mobile_428_desk.png');

  // -------------------------------------------------------------
  // Part 3: Tablet 768px Viewport (iPad / Tablet portrait)
  // -------------------------------------------------------------
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'tablet_768_view.png');
  console.log('✓ Captured tablet_768_view.png');

  // Desktop captures
  await page.setViewport({ width: 1200, height: 800 });
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'real_app_screenshot.png');
  await saveScreenshots(page, 'nation_health_board_screenshot.png');

  console.log('All responsive mobile and desktop screenshots captured successfully!');

  await browser.close();
  await server.close();
})();
