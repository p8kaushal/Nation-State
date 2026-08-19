import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

<<<<<<< Updated upstream
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
=======
const BRAIN_DIRS = [
  '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591',
  '/Users/parthkaushal/.gemini/antigravity/brain/cbdf3b0e-1508-4957-83a5-b45f3bb749b4',
  '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7',
];

function saveScreenshot(page, filename) {
  return Promise.all(
    BRAIN_DIRS.map(async (dir) => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        await page.screenshot({ path: path.join(dir, filename) });
      } catch (e) {
        // ignore missing directory errors
      }
    })
  );
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

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
=======
  await page.setViewport({ width: 1200, height: 800 });
  
  // Navigate to dev server
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 1. Capture Home Screen
  await saveScreenshot(page, 'home_screen.png');
  console.log('1. Home screen captured.');

  // 2. Start a New Game from scenario selector (e.g. Default Golden Era)
  await page.click('#home-new-game-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-start-presidency-btn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Capture Cabinet Chamber with the 2D Nation View Board (Turn 1)
  await saveScreenshot(page, 'real_app_screenshot.png');
  await saveScreenshot(page, 'nation_view_turn1.png');
  console.log('2. Turn 1 Cabinet Chamber with Nation View Board captured as real_app_screenshot.png.');

  // 4. Play a turn to verify dynamic status board updates
  const optionBtn = await page.$('.executive-option-btn');
  if (optionBtn) {
    await optionBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    await saveScreenshot(page, 'nation_view_turn2.png');
    console.log('3. Turn 2 Nation View Board updated and captured.');
  }

  // 5. Switch to Post-War Reconstruction scenario to show critical tiles with flash warnings
  await page.select('#scenario-select', 'post_war');
  await new Promise(resolve => setTimeout(resolve, 500));
  await saveScreenshot(page, 'nation_view_post_war.png');
  console.log('4. Post-War Reconstruction scenario with critical flash tiles captured.');

  // 6. Test Tutorial Walkthrough
  await page.click('#menu-home-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-start-tour-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshot(page, 'tutorial_step1_screenshot.png');

  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshot(page, 'tutorial_step2_screenshot.png');

  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshot(page, 'tutorial_step3_screenshot.png');

  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshot(page, 'tutorial_completed_screenshot.png');
  console.log('5. Tutorial steps tested and captured successfully.');
>>>>>>> Stashed changes

  await browser.close();
  await server.close();
  console.log('All verification captures completed successfully!');
})();
