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
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const navs = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navs.push(f.url());
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__codingplanCatalogReady === true, null, { timeout: 45000 });

  await page.evaluate(() => {
    history.scrollRestoration = 'manual';
    const tabs = document.getElementById('mainViewTabs');
    const y = Math.max(200, Math.floor(tabs.getBoundingClientRect().top + window.scrollY - 80));
    window.scrollTo(0, y);
  });
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => ({
    y: window.scrollY,
    url: location.href,
    ready: window.__codingplanCatalogReady,
    view: window.__mainViewsController && window.__mainViewsController.getView()
  }));

  // Use DOM click without Playwright auto-scroll
  await page.evaluate(() => {
    document.querySelector('[data-main-view="plans"]').click();
  });
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    y: window.scrollY,
    url: location.href,
    ready: window.__codingplanCatalogReady,
    view: window.__mainViewsController && window.__mainViewsController.getView(),
    plansHidden: document.getElementById('view-plans').hidden,
    platformsHidden: document.getElementById('view-platforms').hidden
  }));

  console.log(JSON.stringify({ before, after, navs }, null, 2));
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
