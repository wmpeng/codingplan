const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('response', (r) => {
    if (r.url().includes('monitor')) logs.push('RESP ' + r.status() + ' ' + r.url());
  });

  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.platform-card');

  const cards = await page.locator('.platform-card').all();
  for (const c of cards) {
    const t = await c.innerText();
    if (t.includes('MiniMax')) {
      await c.click();
      break;
    }
  }

  await page.waitForTimeout(3000);
  const dialog = page.locator('[role=dialog], .platform-detail-dialog').first();
  const html = (await dialog.count()) ? await dialog.innerHTML() : 'none';
  const hasAvail = await page.locator('[data-section=availability]').count();
  const script = await page.locator('script[src*="platform-detail"]').getAttribute('src');
  const sections = await page.locator('.platform-detail-section-title').allTextContents();

  await page.screenshot({ path: '.dev/qa-shots/avail-debug.png' });
  console.log(
    JSON.stringify(
      {
        hasAvail,
        script,
        sections,
        logs,
        hasHoursClass: html.includes('platform-detail-hours'),
        hasAvailClass: html.includes('platform-detail-avail')
      },
      null,
      2
    )
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
