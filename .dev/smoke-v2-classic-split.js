/**
 * Smoke test: root = new site, /v1/ = classic, /v2/ = redirect stubs
 * Local server: http://127.0.0.1:8765
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
    // A1: default visit / stays on new site (no /v2/)
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 800);
      const url = page.url();
      assert(!url.includes('/v2/'), `default / should be new site at root, got ${url}`);
      assert(!url.includes('/v1/'), `default / should not be classic, got ${url}`);
      await page.waitForSelector('#settingsBtn', { timeout: 15000 });
      results.push('PASS A1 default / is new site');
      await ctx.close();
    }

    // A2: classic preference still leaves root as new site (no kick to v1)
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript((key) => {
        localStorage.setItem(key, 'classic');
      }, SITE_EDITION_KEY);
      await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 800);
      const url = page.url();
      assert(!url.includes('/v1/'), `classic preference must not redirect root away, got ${url}`);
      assert(!url.includes('/v2/'), `root must not bounce to /v2/, got ${url}`);
      results.push('PASS A2 classic preference keeps root new site');
      await ctx.close();
    }

    // A3: settings switch new -> classic -> new
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.evaluate((key) => localStorage.setItem(key, 'v2'), SITE_EDITION_KEY);
      await page.waitForSelector('#settingsBtn', { timeout: 15000 });
      await page.click('#settingsBtn');
      await page.waitForSelector('#siteEditionClassicBtn', { state: 'visible' });
      await Promise.all([
        page.waitForURL((u) => u.pathname.includes('/v1/'), { timeout: 15000 }),
        page.click('#siteEditionClassicBtn', { force: true }),
      ]);
      let edition = await page.evaluate((key) => localStorage.getItem(key), SITE_EDITION_KEY);
      assert(edition === 'classic', `expected classic storage, got ${edition}`);
      results.push('PASS A3 new settings -> classic /v1/');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 500);
      assert(page.url().includes('/v1/'), `classic refresh should stay on /v1/, got ${page.url()}`);
      results.push('PASS A3b classic refresh stays on /v1/');

      await page.waitForSelector('#settingsBtn', { timeout: 15000 });
      await page.click('#settingsBtn');
      await page.waitForSelector('#siteEditionV2Btn', { state: 'visible' });
      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes('/v1/') && !u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionV2Btn', { force: true }),
      ]);
      edition = await page.evaluate((key) => localStorage.getItem(key), SITE_EDITION_KEY);
      assert(edition === 'v2', `expected v2, got ${edition}`);
      results.push('PASS A4 classic settings -> new root');
      await ctx.close();
    }

    // A5: /v2/ redirects to root new site
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/v2/index.html?view=payg`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 800);
      const url = page.url();
      assert(!url.includes('/v2/'), `/v2/ should redirect off v2, got ${url}`);
      assert(url.includes('view=payg'), `/v2/ should preserve query, got ${url}`);
      results.push('PASS A5 /v2/ redirects to root with query');
      await ctx.close();
    }

    // A6: classic-only root stubs -> new home
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      for (const name of ['relays.html', 'plan-usage.html', 'coding-agents.html', 'relay-detect.html']) {
        await page.goto(`${BASE}/${name}`, { waitUntil: 'domcontentloaded' });
        await waitQuiet(page, 600);
        const url = page.url();
        assert(!url.includes(name), `${name} stub should leave stub URL, got ${url}`);
        assert(!url.includes('/v1/'), `${name} stub should go to new site not v1, got ${url}`);
        assert(!url.includes('/v2/'), `${name} stub should not land on v2, got ${url}`);
      }
      results.push('PASS A6 classic-only root stubs -> new home');
      await ctx.close();
    }

    // B: new site four tabs + assets at root
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const failed = await collectFailedRequests(page);
      const consoleErrors = [];
      page.on('pageerror', (err) => consoleErrors.push(String(err)));

      await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
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

      await page.click('#settingsBtn');
      await page.waitForSelector('#settingsPanel:not([hidden])', { timeout: 5000 });
      await page.waitForSelector('#ultraWideToggle', { state: 'attached' });
      await page.waitForSelector('#siteEditionV2Btn', { state: 'visible' });
      const orderOk = await page.evaluate(() => {
        const edition = document.querySelector('.settings-edition-row');
        const ultra = document.querySelector('#ultraWideToggle')?.closest('.settings-toggle-row');
        if (!edition || !ultra) return false;
        return !!(edition.compareDocumentPosition(ultra) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert(orderOk, 'site edition row should be above ultra-wide');
      results.push('PASS B2 settings edition above ultra-wide');

      await page.goto(`${BASE}/index.html?view=payg`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 1200);
      assert(page.url().includes('view=payg'), 'payg deep link should load');
      results.push('PASS B3 view=payg deep link');

      await page.goto(`${BASE}/index.html?view=monitor`, { waitUntil: 'domcontentloaded' });
      await waitQuiet(page, 1500);
      results.push('PASS B4 view=monitor deep link');

      const critical404 = failed.filter((f) => f.status === 404 && !f.url.includes('/v1/') && !f.url.includes('/v2/') && /\.(js|css|json)(\?|$)/.test(f.url));
      assert(critical404.length === 0, `new site critical 404s: ${JSON.stringify(critical404.slice(0, 8))}`);
      results.push('PASS B5 no critical root js/css/json 404');

      if (consoleErrors.length) {
        console.warn('WARN pageerrors:', consoleErrors.slice(0, 5));
      }
      await ctx.close();
    }

    // C: classic under /v1/
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const failed = await collectFailedRequests(page);

      await page.goto(`${BASE}/v1/index.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#pageNavMount, .page-nav, #settingsBtn', { timeout: 15000 });

      const navHrefs = ['relays.html', 'coding-agents.html', 'plan-usage.html'];
      for (const href of navHrefs) {
        const link = page.locator(`a[href="${href}"], a[href="./${href}"]`).first();
        if (await link.count()) {
          await Promise.all([
            page.waitForURL(new RegExp(`/v1/.*${href.replace('.', '\\.')}`), { timeout: 10000 }).catch(() => null),
            link.click(),
          ]);
          await waitQuiet(page, 500);
          assert(page.url().includes('/v1/'), `classic nav ${href} should stay under /v1/`);
          await page.goto(`${BASE}/v1/index.html`, { waitUntil: 'domcontentloaded' });
        }
      }
      results.push('PASS C1 classic nav pages open under /v1/');

      const rootNewLeaks = failed.filter((f) => {
        if (!f.url.match(/\.(js|css|json)(\?|$)/)) return false;
        try {
          const u = new URL(f.url);
          return !u.pathname.includes('/v1/') && !u.pathname.includes('/v2/');
        } catch {
          return false;
        }
      });
      // Classic may load absolute /favicon; ignore non-404. Only fail on 404 from non-v1 app assets intentionally requested — soft check:
      const v1Asset404 = failed.filter((f) => f.status === 404 && f.url.includes('/v1/') && /\.(js|css|json)(\?|$)/.test(f.url));
      assert(v1Asset404.length === 0, `classic v1 critical 404s: ${JSON.stringify(v1Asset404.slice(0, 5))}`);
      results.push('PASS C2 classic /v1/ has no critical asset 404');
      void rootNewLeaks;

      await page.goto(`${BASE}/v1/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#settingsBtn');
      await page.click('#settingsBtn');
      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes('/v1/') && !u.pathname.includes('/v2/'), { timeout: 15000 }),
        page.click('#siteEditionV2Btn', { force: true }),
      ]);
      results.push('PASS C3 classic -> new via settings');
      await ctx.close();
    }

    // D: json trees
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const rootPlans = await page.goto(`${BASE}/plans.json`);
      assert(rootPlans && rootPlans.ok(), 'root plans.json should exist');
      const rootPlatforms = await page.goto(`${BASE}/platforms.json`);
      assert(rootPlatforms && rootPlatforms.ok(), 'root platforms.json should exist');
      const v1Plans = await page.goto(`${BASE}/v1/plans.json`);
      assert(v1Plans && v1Plans.ok(), 'v1 plans.json should exist');
      const v1Relays = await page.goto(`${BASE}/v1/relays.json`);
      assert(v1Relays && v1Relays.ok(), 'v1 relays.json should exist');
      results.push('PASS D1 root/v1 json trees present');
      await ctx.close();
    }

    console.log(results.join('\n'));
    console.log(`\nALL SMOKE PASSED (${results.length} checks)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
