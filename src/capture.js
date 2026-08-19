import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIRS = [
  '/Users/parthkaushal/.gemini/antigravity/brain/3cb3cfe0-a2fe-40db-8458-6c5ab2c2d883',
  '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591',
  '/Users/parthkaushal/.gemini/antigravity/brain/2189a140-61b9-46d2-bb1d-772f486c47af',
  '/Users/parthkaushal/.gemini/antigravity/brain/cbdf3b0e-1508-4957-83a5-b45f3bb749b4',
  '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7',
  '/Users/parthkaushal/.gemini/antigravity/brain/34b8014b-ac7f-4df1-83b6-03e844a4617b',
  '/Users/parthkaushal/.gemini/antigravity/brain/3702b51d-84c6-4eaf-9198-14d8976b36b1',
  '/Users/parthkaushal/.gemini/antigravity/brain/1484e71a-d794-4e73-b103-b245d218b3e2',
];

for (const dir of ARTIFACT_DIRS) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // ignore
  }
}

async function saveScreenshots(page, filename) {
  for (const dir of ARTIFACT_DIRS) {
    const fullPath = path.join(dir, filename);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await page.screenshot({ path: fullPath });
      console.log(`Saved screenshot: ${filename} -> ${dir}`);
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
  // Part 1: Desktop Viewport (1200x800)
  // -------------------------------------------------------------
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 500));

  // 1. Home Screen
  await saveScreenshots(page, 'home_screen.png');

  // 2. Start a New Game
  await page.click('#home-new-game-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-start-presidency-btn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Desktop Turn 1 with 2D Status Board in Desk view
  await saveScreenshots(page, 'real_app_screenshot.png');
  await saveScreenshots(page, 'nation_view_turn1.png');
  await saveScreenshots(page, 'nation_health_board_screenshot.png');

  // 4. Play a turn
  const optionBtn = await page.$('.executive-option-btn');
  if (optionBtn) {
    await optionBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    await saveScreenshots(page, 'nation_view_turn2.png');
  }

  // 5. Switch to Post-War scenario
  await page.select('#scenario-select', 'post_war');
  await new Promise(resolve => setTimeout(resolve, 500));
  await saveScreenshots(page, 'nation_view_post_war.png');

  // -------------------------------------------------------------
  // Part 2: Mobile 375px Viewport (iPhone SE / Standard Mobile)
  // -------------------------------------------------------------
  await page.setViewport({ width: 375, height: 667 });
  await new Promise(resolve => setTimeout(resolve, 400));

  // 1. Capture 375px Main Game Screen (Desk view - status board hidden)
  await page.click('#mobile-tab-desk');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_desk.png');

  // 1b. Test & Capture Mobile Actions Drawer
  await page.click('#mobile-actions-toggle-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_actions_drawer.png');
  await page.click('#mobile-actions-toggle-btn');
  await new Promise(resolve => setTimeout(resolve, 300));

  // 2. Click Stats / Cabinet tab & capture (status board prepended to Left Panel)
  await page.click('#mobile-tab-stats');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_stats.png');

  // 3. Click Briefings tab & capture
  await page.click('#mobile-tab-briefing');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_log.png');

  // 4. Click Past Runs button & capture modal (accessed via Home Menu overlay on mobile)
  await page.click('#menu-home-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-past-runs-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'mobile_375_past_runs.png');

  // Close past runs modal (returns to Home overlay)
  await page.click('#close-history-btn');
  await new Promise(resolve => setTimeout(resolve, 300));

  // 5. Test Tutorial Walkthrough with mobile spotlight tab switching
  await page.click('#home-start-tour-btn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 1: Highlights #decision-container on Desk tab
  await saveScreenshots(page, 'tutorial_step1_screenshot.png');
  await saveScreenshots(page, 'mobile_tutorial_step1.png');

  // Step 2: Auto-switches to Stats tab and highlights #trust-stats-list
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 500));
  await saveScreenshots(page, 'tutorial_step2_screenshot.png');
  await saveScreenshots(page, 'mobile_tutorial_step2.png');

  // Step 3: Highlights .side-panel on Stats tab
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 500));
  await saveScreenshots(page, 'tutorial_step3_screenshot.png');
  await saveScreenshots(page, 'mobile_tutorial_step3.png');

  // Finish tour
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'tutorial_completed_screenshot.png');

  // -------------------------------------------------------------
  // Part 3: Mobile 428px Viewport (iPhone 13/14 Pro Max)
  // -------------------------------------------------------------
  await page.setViewport({ width: 428, height: 926 });
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.click('#mobile-tab-desk');
  await new Promise(resolve => setTimeout(resolve, 300));
  await saveScreenshots(page, 'mobile_428_desk.png');

  await page.click('#mobile-tab-stats');
  await new Promise(resolve => setTimeout(resolve, 300));
  await saveScreenshots(page, 'mobile_428_stats.png');

  // -------------------------------------------------------------
  // Part 4: Tablet 768px Viewport (iPad Portrait)
  // -------------------------------------------------------------
  await page.setViewport({ width: 768, height: 1024 });
  await page.click('#mobile-tab-desk');
  await new Promise(resolve => setTimeout(resolve, 400));
  await saveScreenshots(page, 'tablet_768_view.png');

  await browser.close();
  await server.close();
  console.log('All responsive mobile and desktop screenshots captured successfully!');
})();
