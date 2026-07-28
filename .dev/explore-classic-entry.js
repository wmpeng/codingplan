const { chromium } = require('playwright');
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8765';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const failedReqs = [];

  try {
    // ===== Classic: visible 体验新版 on every nav page =====
    const classicPages = [
      'index.html',
      'plan-usage.html',
      'coding-agents.html',
      'relays.html',
      'relay-detect.html',
    ];

    for (const p of classicPages) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        // Keep classic while browsing root pages; do not clobber after jumping to v2.
        if (!String(location.pathname || '').includes('/v2')) {
          localStorage.setItem('codingplanSiteEdition', 'classic');
        }
      });
      page.on('response', (res) => {
        if (res.status() >= 400 && /\.(js|css|json)(\?|$)/.test(res.url()) && !res.url().includes('/v2/')) {
          failedReqs.push({ page: p, status: res.status(), url: res.url() });
        }
      });
      await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      assert(!page.url().includes('/v2/'), `${p}: should stay on classic, got ${page.url()}`);
      await page.waitForSelector('#gotoNewEditionLink', { timeout: 15000 });
      const visible = await page.isVisible('#gotoNewEditionLink');
      assert(visible, `${p}: 体验新版 should be visible`);
      results.push(`PASS classic visible entry on ${p}`);

      // click through other nav tabs first
      const hrefs = await page.$$eval('.page-nav a.page-tab:not(.page-tab-new-edition)', (as) =>
        as.map((a) => a.getAttribute('href')).filter(Boolean)
      );
      for (const href of hrefs) {
        if (!href || href === p || href === `./${p}`) continue;
        await page.click(`.page-nav a[href="${href}"]`);
        await page.waitForTimeout(700);
        await page.waitForSelector('#gotoNewEditionLink', { timeout: 10000 });
        assert(await page.isVisible('#gotoNewEditionLink'), `after ${href} 体验新版 visible`);
      }
      // return to this page under classic
      await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await page.waitForSelector('#gotoNewEditionLink');

      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#gotoNewEditionLink'),
      ]);
      const ed = await page.evaluate(() => localStorage.getItem('codingplanSiteEdition'));
      assert(ed === 'v2', `${p}: 体验新版 should set edition=v2, got ${ed}`);
      assert(page.url().includes('/v2/'), `${p}: should land on v2`);
      results.push(`PASS classic ${p} -> v2 via 体验新版`);
      await ctx.close();
    }

    // ===== Classic index: also settings 新版 =====
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        if (!String(location.pathname || '').includes('/v2')) {
          localStorage.setItem('codingplanSiteEdition', 'classic');
        }
      });
      await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#settingsBtn');
      await page.click('#settingsBtn');
      await page.waitForSelector('#siteEditionV2Btn', { state: 'visible' });
      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionV2Btn', { force: true }),
      ]);
      assert((await page.evaluate(() => localStorage.getItem('codingplanSiteEdition'))) === 'v2');
      results.push('PASS classic settings 新版 -> v2');
      await ctx.close();
    }

    // ===== V2: click around extensively =====
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const v2Fail = [];
      page.on('response', (res) => {
        if (res.status() === 404 && res.url().includes('/v2/') && /\.(js|css|json)(\?|$)/.test(res.url())) {
          v2Fail.push(res.url());
        }
      });
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await page.goto(`${BASE}/v2/index.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-main-view]', { timeout: 20000 });

      for (const key of ['platforms', 'plans', 'payg', 'monitor', 'platforms']) {
        await page.click(`[data-main-view="${key}"]`);
        await page.waitForTimeout(900);
        const sel = await page.getAttribute(`[data-main-view="${key}"]`, 'aria-selected');
        assert(sel === 'true', `v2 tab ${key}`);
        // panel visible
        const panelHidden = await page.getAttribute(`[data-main-view-panel="${key}"]`, 'hidden');
        assert(panelHidden === null || panelHidden === '', `panel ${key} should show (hidden=${panelHidden})`);
      }
      results.push('PASS v2 four tabs round-trip');

      // open settings, toggle ultra-wide, switch classic, back
      await page.click('#settingsBtn');
      await page.waitForSelector('#settingsPanel:not([hidden])');
      await page.locator('#ultraWideToggle').evaluate((el) => {
        el.checked = !el.checked;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(200);
      const ultra = await page.evaluate(() => document.body.classList.contains('ultra-wide'));
      results.push(`PASS v2 ultra-wide toggled (on=${ultra})`);

      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionClassicBtn', { force: true }),
      ]);
      assert((await page.evaluate(() => localStorage.getItem('codingplanSiteEdition'))) === 'classic');
      results.push('PASS v2 settings -> classic');

      await page.waitForSelector('#gotoNewEditionLink');
      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#gotoNewEditionLink'),
      ]);
      results.push('PASS classic 体验新版 back to v2');

      // deep links
      for (const view of ['plans', 'payg', 'monitor']) {
        await page.goto(`${BASE}/v2/index.html?view=${view}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        const sel = await page.getAttribute(`[data-main-view="${view}"]`, 'aria-selected');
        assert(sel === 'true', `deep link view=${view}`);
      }
      results.push('PASS v2 deep links plans/payg/monitor');

      // click a few platform filters / chips if present
      const chips = page.locator('.preset-tag-filters button, .filter-chip, [data-filter]');
      const chipCount = await chips.count();
      for (let i = 0; i < Math.min(chipCount, 4); i++) {
        await chips.nth(i).click().catch(() => {});
        await page.waitForTimeout(250);
      }
      results.push(`PASS v2 clicked ${Math.min(chipCount, 4)} filter controls (found ${chipCount})`);

      assert(v2Fail.length === 0, `v2 404s: ${v2Fail.slice(0, 5).join(', ')}`);
      results.push('PASS v2 no js/css/json 404');
      if (pageErrors.length) {
        console.warn('WARN pageerrors', pageErrors.slice(0, 5));
      }
      await ctx.close();
    }

    // ===== Root default redirect =====
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      assert(page.url().includes('/v2/'), 'default / -> v2');
      results.push('PASS default / -> v2');
      await ctx.close();
    }

    const classicAssetFails = failedReqs.filter((f) => f.status === 404);
    assert(classicAssetFails.length === 0, `classic 404: ${JSON.stringify(classicAssetFails.slice(0, 5))}`);
    results.push('PASS classic no critical 404 during crawl');

    console.log(results.join('\n'));
    console.log(`\nALL INTERACTIVE CHECKS PASSED (${results.length})`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
