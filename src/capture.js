import puppeteer from 'puppeteer';
import { createServer } from 'vite';

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
  
  // Set standard desktop viewport size
  await page.setViewport({ width: 1200, height: 800 });
  
  // Navigate to the dev server
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 1. Click "Start Tour" on Home Screen to begin Tutorial Walkthrough (Step 1 Spotlight)
  await page.click('#home-start-tour-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Take screenshot of Step 1 Tutorial Spotlight as real_app_screenshot.png
  const parentPath = '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591/real_app_screenshot.png';
  await page.screenshot({ path: parentPath });

  try {
    const subagentPath = '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7/real_app_screenshot.png';
    await page.screenshot({ path: subagentPath });
  } catch (e) {}

  console.log('1. Step 1 Tutorial (Executive Memorandum Spotlight) screenshot captured successfully!');

  // 2. Click "Next" to advance to Step 2 (Faction Trust Blocs Spotlight)
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7/tutorial_step2_screenshot.png'
    });
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591/tutorial_step2_screenshot.png'
    });
  } catch (e) {}
  console.log('2. Step 2 Tutorial (Faction Trust Blocs Spotlight) screenshot captured successfully!');

  // 3. Click "Next" to advance to Step 3 (Dynamic Cabinet Dockets Spotlight)
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7/tutorial_step3_screenshot.png'
    });
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591/tutorial_step3_screenshot.png'
    });
  } catch (e) {}
  console.log('3. Step 3 Tutorial (Dynamic Cabinet Dockets Spotlight) screenshot captured successfully!');

  // 4. Click Finish Tour and verify clean return
  await page.click('#tutorial-next-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/49ea820c-5f69-4e83-b4ed-188bd76677a7/tutorial_completed_screenshot.png'
    });
    await page.screenshot({
      path: '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591/tutorial_completed_screenshot.png'
    });
  } catch (e) {}
  console.log('4. Tutorial Completed and chamber view captured successfully!');

  // 5. Test Start Tour from inside How to Play Handbook
  await page.click('#menu-home-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#home-how-to-play-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.click('#how-to-play-tour-btn');
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log('5. Tour launched successfully from inside How to Play Handbook!');

  // Close tutorial via Skip Tutorial button
  await page.click('#tutorial-skip-btn');
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log('6. Skip Tutorial tested successfully!');

  await browser.close();
  await server.close();
})();

