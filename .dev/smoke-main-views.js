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
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found ' + urlPath);
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: edge,
    headless: true
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__codingplanCatalogReady === true, null, { timeout: 45000 });

  assert((await page.locator('#mainViewTabs').count()) > 0, 'tabs missing');
  assert((await page.locator('.page-nav').count()) === 0, 'site page-nav should be hidden on homepage');
  assert(await page.locator('#view-platforms').isVisible(), 'platforms visible');
  assert(!(await page.locator('#view-plans').isVisible()), 'plans hidden by default');

  await page.click('[data-main-view="plans"]');
  await page.waitForTimeout(300);
  assert(page.url().includes('view=plans'), 'url plans');
  assert(await page.locator('#view-plans').isVisible(), 'plans visible');
  assert((await page.locator('#plansTableToggle').count()) === 0, 'toggle gone');
  assert(await page.locator('#plansTable').isVisible(), 'table visible');

  await page.click('[data-main-view="usage"]');
  await page.waitForSelector('.usage-data-table tbody tr', { timeout: 25000 });
  assert(page.url().includes('view=usage'), 'url usage');
  assert(await page.locator('#view-usage').isVisible(), 'usage visible');
  assert((await page.locator('.usage-data-table tbody tr').count()) > 0, 'usage rows');

  await page.click('[data-main-view="monitor"]');
  await page.waitForTimeout(2000);
  assert(page.url().includes('view=monitor'), 'url monitor');
  assert(await page.locator('#view-monitor').isVisible(), 'monitor visible');
  const monitorHasUi =
    (await page.locator('#view-monitor .monitor-toolbar').count()) > 0 ||
    (await page.locator('#view-monitor').innerHTML()).length > 50;
  assert(monitorHasUi, 'monitor ui mounted');

  await page.goto(`${base}/index.html?view=usage`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__mainViewsController && window.__mainViewsController.getView() === 'usage',
    null,
    { timeout: 25000 }
  );
  assert(await page.locator('#view-usage').isVisible(), 'deep link usage');

  await page.goto(`${base}/monitor/index.html`, { waitUntil: 'domcontentloaded' });
  assert(page.url().includes('monitor/'), 'standalone monitor no redirect');
  assert(!page.url().includes('view=monitor'), 'monitor not redirected to homepage');

  await browser.close();
  server.close();
  if (errors.length) console.log('pageerrors:', errors.slice(0, 8).join('\n'));
  console.log('SMOKE_OK');
})().catch(async (err) => {
  console.error('SMOKE_FAIL', err);
  process.exit(1);
});
