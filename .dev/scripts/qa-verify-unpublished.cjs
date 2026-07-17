const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.platform-card');

  const cards = await page.locator('.platform-card').all();
  let clicked = false;
  for (const c of cards) {
    const t = await c.innerText();
    if (t.includes('OpenCode')) {
      await c.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) throw new Error('no OpenCode card');

  await page.waitForSelector('.platform-detail-section, [role=dialog]');
  await page.waitForTimeout(400);

  const hasPlans = await page.locator('[data-section=plans]').count();
  const quotas = await page.locator('.platform-detail-plan-quota').evaluateAll((els) =>
    els.map((e) => e.textContent.trim())
  );
  const bodyText = await page.locator('[role=dialog], .platform-detail-dialog').first().innerText();
  const script = await page.locator('script[src*="platform-detail"]').getAttribute('src');

  await page.screenshot({ path: '.dev/qa-shots/opencode-no-unpublished.png' });

  const result = {
    hasPlans,
    quotas,
    hasWeigongkai: bodyText.includes('未公开'),
    hasGoPlanCard: bodyText.includes('\nGo\n') || /套餐[\s\S]*\bGo\b/.test(bodyText),
    script
  };
  console.log(JSON.stringify(result, null, 2));

  if (result.hasWeigongkai) throw new Error('未公开 still in overlay');
  if (hasPlans > 0 && quotas.includes('未公开')) throw new Error('still showing 未公开 quota');
  console.log('LAYOUT OK');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
