const { chromium } = require(require('path').join(process.env.TEMP, 'cp-pw-smoke2', 'node_modules', 'playwright-core'));
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__codingplanCatalogReady === true, null, { timeout: 45000 });

  // Scroll down so tabs are near top but page is not at 0
  await page.evaluate(() => {
    const tabs = document.getElementById('mainViewTabs');
    const y = Math.max(200, Math.floor(tabs.getBoundingClientRect().top + window.scrollY - 80));
    window.scrollTo(0, y);
  });
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  assert(before > 50, `expected scrolled page, got ${before}`);

  await page.click('[data-main-view="plans"]');
  await page.waitForTimeout(250);
  const afterPlans = await page.evaluate(() => window.scrollY);
  assert(Math.abs(afterPlans - before) < 5, `scroll jumped on plans: ${before} -> ${afterPlans}`);
  assert(await page.locator('#view-plans').isVisible(), 'plans visible');

  await page.click('[data-main-view="monitor"]');
  await page.waitForTimeout(800);
  const afterMonitor = await page.evaluate(() => window.scrollY);
  assert(Math.abs(afterMonitor - before) < 5, `scroll jumped on monitor: ${before} -> ${afterMonitor}`);

  await page.click('[data-main-view="platforms"]');
  await page.waitForTimeout(250);
  const afterPlatforms = await page.evaluate(() => window.scrollY);
  assert(Math.abs(afterPlatforms - before) < 5, `scroll jumped on platforms: ${before} -> ${afterPlatforms}`);

  console.log(`SCROLL_OK before=${before} plans=${afterPlans} monitor=${afterMonitor} platforms=${afterPlatforms}`);
  await browser.close();
  server.close();
})().catch((err) => {
  console.error('SCROLL_FAIL', err);
  process.exit(1);
});
