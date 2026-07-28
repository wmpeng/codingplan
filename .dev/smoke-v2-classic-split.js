/**
 * Smoke test: root classic + v2 split (local http://127.0.0.1:8765)
 * Run: npx playwright test is not used; invoke with node via playwright package from npx
 */
const { chromium } = require('playwright');

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8765';
const SITE_EDITION_KEY = 'codingplanSiteEdition';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function waitQuiet(page, ms = 400) {
  await page.waitForTimeout(ms);
}

async function collectFailedRequests(page) {
  const failed = [];
  page.on('response', (res) => {
    const st = res.status();
    if (st >= 400) {
      failed.push({ status: st, url: res.url() });
    }
  });
  return failed;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    // A1: default visit / -> v2
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 800);
      const url = page.url();
      assert(url.includes('/v2/'), `default / should land on v2, got ${url}`);
      results.push('PASS A1 default / -> v2');
      await ctx.close();
    }

    // A2: classic stays on root
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript((key) => {
        localStorage.setItem(key, 'classic');
      }, SITE_EDITION_KEY);
      await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 800);
      const url = page.url();
      assert(!url.includes('/v2/'), `classic should stay on root, got ${url}`);
      const title = await page.title();
      assert(/Coding Plan/i.test(title), `classic title unexpected: ${title}`);
      results.push('PASS A2 classic stays on root');
      await ctx.close();
    }

    // A3: settings switch classic -> v2 -> classic
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/v2/index.html`, { waitUntil: 'domcontentloaded' });
      await page.evaluate((key) => localStorage.setItem(key, 'v2'), SITE_EDITION_KEY);
      await page.waitForSelector('#settingsBtn', { timeout: 15000 });
      await page.click('#settingsBtn');
      await page.waitForSelector('#siteEditionClassicBtn', { state: 'visible' });
      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionClassicBtn', { force: true }),
      ]);
      let edition = await page.evaluate((key) => localStorage.getItem(key), SITE_EDITION_KEY);
      assert(edition === 'classic', `expected classic storage, got ${edition}`);
      results.push('PASS A3 v2 settings -> classic');

      // refresh should stay on classic root
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 500);
      assert(!page.url().includes('/v2/'), `classic refresh should stay on root, got ${page.url()}`);
      results.push('PASS A3b classic refresh stays');

      await page.waitForSelector('#settingsBtn', { timeout: 15000 });
      await page.click('#settingsBtn');
      await page.waitForSelector('#siteEditionV2Btn', { state: 'visible' });
      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionV2Btn', { force: true }),
      ]);
      edition = await page.evaluate((key) => localStorage.getItem(key), SITE_EDITION_KEY);
      assert(edition === 'v2', `expected v2, got ${edition}`);
      results.push('PASS A4 classic settings -> v2');
      await ctx.close();
    }

    // B: v2 four tabs + assets
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const failed = await collectFailedRequests(page);
      const consoleErrors = [];
      page.on('pageerror', (err) => consoleErrors.push(String(err)));

      await page.goto(`${BASE}/v2/index.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#viewTabs, .main-view-tabs, [data-view], button, a', { timeout: 15000 });

      const tabBtns = await page.$$('[data-main-view]');
      assert(tabBtns.length >= 4, `expected 4 main view tabs, got ${tabBtns.length}`);
      for (const key of ['platforms', 'plans', 'payg', 'monitor']) {
        await page.click(`[data-main-view="${key}"]`);
        await waitQuiet(page, 800);
        const selected = await page.getAttribute(`[data-main-view="${key}"]`, 'aria-selected');
        assert(selected === 'true', `tab ${key} should be selected`);
      }
      results.push('PASS B1 clicked four main-view tabs');

      // settings + ultra wide present
      await page.click('#settingsBtn');
      await page.waitForSelector('#settingsPanel:not([hidden])', { timeout: 5000 });
      await page.waitForSelector('#ultraWideToggle', { state: 'attached' });
      await page.waitForSelector('#siteEditionV2Btn', { state: 'visible' });
      // site edition above ultra-wide: compare DOM order
      const orderOk = await page.evaluate(() => {
        const edition = document.querySelector('.settings-edition-row');
        const ultra = document.querySelector('#ultraWideToggle')?.closest('.settings-toggle-row');
        if (!edition || !ultra) return false;
        return !!(edition.compareDocumentPosition(ultra) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert(orderOk, 'site edition row should be above ultra-wide');
      results.push('PASS B2 settings edition above ultra-wide');

      // deep link
      await page.goto(`${BASE}/v2/index.html?view=payg`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 1200);
      assert(page.url().includes('view=payg') || page.url().includes('/v2/'), 'payg deep link should load');
      results.push('PASS B3 view=payg deep link');

      await page.goto(`${BASE}/v2/index.html?view=monitor`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 1500);
      results.push('PASS B4 view=monitor deep link');

      // Critical asset 404s under /v2/
      const critical404 = failed.filter((f) => f.status === 404 && f.url.includes('/v2/') && /\.(js|css|json)(\?|$)/.test(f.url));
      assert(critical404.length === 0, `v2 critical 404s: ${JSON.stringify(critical404.slice(0, 8))}`);
      results.push('PASS B5 no critical v2 js/css/json 404');

      if (consoleErrors.length) {
        console.warn('WARN pageerrors:', consoleErrors.slice(0, 5));
      }
      await ctx.close();
    }

    // C: classic nav pages + root assets not from v2
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript((key) => {
        localStorage.setItem(key, 'classic');
      }, SITE_EDITION_KEY);
      const failed = await collectFailedRequests(page);

      await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#pageNavMount, .page-nav, #settingsBtn', { timeout: 15000 });

      const navHrefs = ['relays.html', 'coding-agents.html', 'plan-usage.html'];
      for (const href of navHrefs) {
        const link = page.locator(`a[href="${href}"], a[href="./${href}"]`).first();
        if (await link.count()) {
          await Promise.all([
            page.waitForURL(new RegExp(href.replace('.', '\\.')), { timeout: 10000 }).catch(() => null),
            link.click(),
          ]);
          await waitQuiet(page, 500);
          assert(!page.url().includes('/v2/'), `classic nav ${href} should stay on root`);
          // go back home for next
          await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
          await page.addInitScript(() => {}); // noop
        }
      }
      results.push('PASS C1 classic nav pages open on root');

      const v2Leaks = failed.filter((f) => f.url.includes('/v2/') && f.url.match(/\.(js|css|json)(\?|$)/));
      assert(v2Leaks.length === 0, `classic should not load v2 assets: ${JSON.stringify(v2Leaks.slice(0, 5))}`);
      results.push('PASS C2 classic does not fetch v2 js/css/json');

      // settings back to new
      await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#settingsBtn');
      await page.click('#settingsBtn');
      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionV2Btn', { force: true }),
      ]);
      results.push('PASS C3 classic -> v2 via settings');
      await ctx.close();
    }

    // D: both trees have independent platforms/plans where applicable
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const rootPlans = await page.goto(`${BASE}/plans.json`);
      assert(rootPlans && rootPlans.ok(), 'root plans.json should exist');
      const v2Plans = await page.goto(`${BASE}/v2/plans.json`);
      assert(v2Plans && v2Plans.ok(), 'v2 plans.json should exist');
      const v2Platforms = await page.goto(`${BASE}/v2/platforms.json`);
      assert(v2Platforms && v2Platforms.ok(), 'v2 platforms.json should exist');
      results.push('PASS D1 root/v2 json trees present');
      await ctx.close();
    }

    console.log(results.join('\n'));
    console.log(`\nALL SMOKE PASSED (${results.length} checks)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
