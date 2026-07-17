const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const outDir = path.join(__dirname, '../qa-shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8000/index.html?v=' + Date.now(), { waitUntil: 'networkidle' });
  await page.locator('#platformCardGrid .platform-card[data-platform-id="minimax"]').click();
  await page.waitForSelector('.platform-detail-overlay.is-open');
  await page.waitForTimeout(400);
  await page.locator('.platform-detail-dialog').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, 'minimax-cards.png') });

  const info = await page.evaluate(() => {
    const dialog = document.querySelector('.platform-detail-dialog');
    const list = document.querySelector('.platform-detail-plans-list');
    const items = [...document.querySelectorAll('.platform-detail-plan-item')].map((el) => {
      const box = el.getBoundingClientRect();
      const price = el.querySelector('.platform-detail-plan-price').getBoundingClientRect();
      return {
        name: el.querySelector('.platform-detail-plan-name').textContent.trim(),
        type: el.querySelector('.platform-detail-plan-type-badge').textContent.trim(),
        quota: el.querySelector('.platform-detail-plan-quota').textContent.trim(),
        price: el.querySelector('.platform-detail-plan-price').innerText.replace(/\s+/g, ' ').trim(),
        priceInside: price.right <= box.right + 1
      };
    });
    return {
      items,
      noHScroll: !(dialog.scrollWidth > dialog.clientWidth + 1),
      listFits: list.scrollWidth <= list.clientWidth + 2,
      script: [...document.scripts].map((s) => s.src).find((s) => s.includes('platform-detail'))
    };
  });
  console.log(JSON.stringify(info, null, 2));
  const ok =
    info.noHScroll &&
    info.listFits &&
    info.items.length === 3 &&
    info.items.every((i) => i.priceInside && i.price.includes('¥') && i.quota);
  if (!ok) {
    console.error('LAYOUT FAIL');
    process.exit(2);
  }
  console.log('LAYOUT OK');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
