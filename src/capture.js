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
  
  // Wait a small buffer for SVG and stats to render fully
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Take screenshot
  await page.screenshot({
    path: '/Users/parthkaushal/.gemini/antigravity/brain/39142f08-3903-426a-8605-545acaf72591/real_app_screenshot.png'
  });
  
  console.log('Screenshot captured successfully!');
  await browser.close();
  await server.close();
})();

