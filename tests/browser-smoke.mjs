import assert from 'node:assert/strict';
import { createReadStream, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer';

const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const file = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!file.startsWith(`${root}${path.sep}`) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: process.env.CI ? ['--no-sandbox'] : [],
  });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport(viewport);
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
    await page.click('#home-new-game-btn');
    await page.click('#home-start-presidency-btn');
    await page.click('#next-turn-btn');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('nationstate_active_save_default') || '{}').state?.turn === 2);
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('#home-continue-btn', button => !button.disabled), true);
    await page.click('#home-new-game-btn');
    page.once('dialog', dialog => dialog.dismiss());
    await page.click('#home-start-presidency-btn');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('nationstate_active_save_default') || '{}').state?.turn), 2);
    await page.click('#home-back-btn');
    await page.click('#home-continue-btn');
    assert.match(await page.$eval('#turn-display', element => element.textContent), /Turn 2/);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Guest save and overwrite protection passed at ${viewport.width}x${viewport.height}.`);
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
