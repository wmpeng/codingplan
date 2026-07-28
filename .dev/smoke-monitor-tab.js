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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:${port}/index.html?view=monitor`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__codingplanCatalogReady === true, null, { timeout: 45000 });
  await page.waitForTimeout(500);
  // wait for board content beyond loading
  await page.waitForFunction(() => {
    const root = document.getElementById('view-monitor');
    if (!root) return false;
    const loading = root.querySelector('.monitor-loading');
    const text = root.textContent || '';
    if (loading && text.includes('加载中')) return false;
    return root.querySelector('.monitor-bar, .monitor-platform, .monitor-section, .monitor-empty') != null ||
      (text.includes('可用') || text.includes('失败') || text.includes('平台'));
  }, null, { timeout: 30000 });

  const snapshot = await page.evaluate(() => {
    const root = document.getElementById('view-monitor');
    return {
      apiBase: window.MONITOR_CONFIG && window.MONITOR_CONFIG.apiBase,
      text: (root && root.textContent || '').slice(0, 200),
      hasBar: !!(root && root.querySelector('.monitor-bar')),
      hasLoading: !!(root && root.querySelector('.monitor-loading')),
      mounted: root && root.dataset.monitorMounted
    };
  });
  console.log(JSON.stringify({ snapshot, errors }, null, 2));
  if (snapshot.hasLoading) {
    throw new Error('still loading');
  }
  console.log('MONITOR_OK');
  await browser.close();
  server.close();
})().catch((e) => {
  console.error('MONITOR_FAIL', e);
  process.exit(1);
});
