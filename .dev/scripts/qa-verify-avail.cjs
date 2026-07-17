const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.join(__dirname, '..', 'qa-shots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.platform-card');

  // Prefer vendors whose monitor display_name matches platforms.json exactly
  const prefer = ['OpenCode', '优云智算', '智谱', 'Kimi'];
  const cards = await page.locator('.platform-card').all();
  let clicked = false;
  for (const name of prefer) {
    for (const c of cards) {
      const t = await c.innerText();
      if (t.includes(name)) {
        await c.click();
        clicked = true;
        break;
      }
    }
    if (clicked) break;
  }
  if (!clicked) throw new Error('no card');

  await page.waitForSelector('[data-section=availability], .platform-detail-section');
  // wait for board fetch
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[data-section=availability]').count()) > 0) break;
    await page.waitForTimeout(250);
  }

  const avail = page.locator('[data-section=availability]');
  if ((await avail.count()) === 0) {
    console.log(JSON.stringify({ ok: false, reason: 'no availability section' }));
    await page.screenshot({ path: path.join(outDir, 'avail-missing.png') });
    await browser.close();
    process.exit(1);
  }

  const metrics = await avail.evaluate((section) => {
    const bar = section.querySelector('.platform-detail-hours');
    const cells = section.querySelectorAll('.platform-detail-hour-cell');
    const rate = section.querySelector('.platform-detail-avail-rate');
    const barRect = bar.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const first = cells[0] && cells[0].getBoundingClientRect();
    const last = cells[cells.length - 1] && cells[cells.length - 1].getBoundingClientRect();
    const styles = cells[0] ? getComputedStyle(cells[0]) : null;
    return {
      rateText: rate ? rate.textContent.trim() : null,
      cellCount: cells.length,
      barWidth: Math.round(barRect.width),
      sectionInnerWidth: Math.round(sectionRect.width),
      barFills: Math.abs(barRect.width - sectionRect.width) < 8,
      barHeight: Math.round(barRect.height),
      firstBg: styles && styles.backgroundColor,
      spanLeft: first && Math.round(first.left),
      spanRight: last && Math.round(last.right),
      script: document.querySelector('script[src*="platform-detail"]')?.getAttribute('src')
    };
  });

  await avail.screenshot({ path: path.join(outDir, 'avail-section.png') });
  await page.screenshot({ path: path.join(outDir, 'avail-overlay.png') });

  console.log(JSON.stringify(metrics, null, 2));
  if (!metrics.barFills) throw new Error('bar does not fill width');
  if (metrics.barHeight < 30) throw new Error('bar too short');
  if (!metrics.rateText || !metrics.rateText.includes('可用')) throw new Error('rate label wrong');
  console.log('LAYOUT OK');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
