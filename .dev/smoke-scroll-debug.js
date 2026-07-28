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

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__codingplanCatalogReady === true, null, { timeout: 45000 });

  const logs = await page.evaluate(() => {
    const hits = [];
    const origScrollTo = window.scrollTo.bind(window);
    const origScroll = window.scroll.bind(window);
    window.scrollTo = function (...args) {
      hits.push({ type: 'scrollTo', args: args.map(String), y: window.scrollY, stack: new Error().stack.split('\n').slice(1, 6).join(' | ') });
      return origScrollTo(...args);
    };
    window.scroll = function (...args) {
      hits.push({ type: 'scroll', args: args.map(String), y: window.scrollY, stack: new Error().stack.split('\n').slice(1, 6).join(' | ') });
      return origScroll(...args);
    };
    const proto = Element.prototype;
    const origSIV = proto.scrollIntoView;
    proto.scrollIntoView = function (...args) {
      hits.push({
        type: 'scrollIntoView',
        tag: this.tagName,
        id: this.id,
        cls: String(this.className || '').slice(0, 80),
        y: window.scrollY,
        stack: new Error().stack.split('\n').slice(1, 8).join(' | ')
      });
      return origSIV.apply(this, args);
    };
    window.__scrollHits = hits;
    return true;
  });

  await page.evaluate(() => {
    const tabs = document.getElementById('mainViewTabs');
    const y = Math.max(200, Math.floor(tabs.getBoundingClientRect().top + window.scrollY - 80));
    window.scrollTo(0, y);
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__scrollHits.length = 0;
  });

  const before = await page.evaluate(() => window.scrollY);
  await page.click('[data-main-view="plans"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ y: window.scrollY, hits: window.__scrollHits }));

  console.log(JSON.stringify({ before, afterY: after.y, hits: after.hits }, null, 2));
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
