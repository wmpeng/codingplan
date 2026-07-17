const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://127.0.0.1:8000/index.html?t=' + Date.now(), { waitUntil: 'networkidle' });
  await p.locator('#platformCardGrid .platform-card[data-platform-id="minimax"]').click();
  await p.waitForSelector('.platform-detail-overlay.is-open');
  const info = await p.evaluate(() => {
    const wrap = document.querySelector('.platform-detail-plans-wrap');
    const table = document.querySelector('.platform-detail-plans-table');
    const ths = [...table.querySelectorAll('th')].map((th) => ({
      text: th.textContent.trim(),
      w: Math.round(th.getBoundingClientRect().width),
      left: Math.round(th.getBoundingClientRect().left)
    }));
    const tds = [...table.querySelectorAll('tbody tr:first-child td')].map((td) => ({
      text: td.innerText.trim().slice(0, 48),
      w: Math.round(td.getBoundingClientRect().width),
      right: Math.round(td.getBoundingClientRect().right)
    }));
    const wrapR = wrap.getBoundingClientRect();
    return {
      wrapW: Math.round(wrapR.width),
      wrapRight: Math.round(wrapR.right),
      tableW: Math.round(table.getBoundingClientRect().width),
      tableSW: table.scrollWidth,
      wrapSW: wrap.scrollWidth,
      tableLayout: getComputedStyle(table).tableLayout,
      ths,
      tds
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
