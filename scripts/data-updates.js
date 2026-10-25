/* Background checks only; the currently rendered data is never replaced. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) api.mount(root);
})(globalThis, function() {
  'use strict';
  function pageType(path) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length || parts[0] === 'index.html') return 'home';
    if (parts[0] === 'platforms' && parts.length > 1 && parts[1] !== 'index.html') return 'platform_guide';
    if (parts[0] === 'articles' && parts.length > 1 && parts[1] !== 'index.html') return 'article';
    return parts[0] === 'platform-compare.html' ? 'platforms' : parts[0];
  }
  function createChecker(env, notify) {
    let lastFilter = -Infinity, filterTimer, searchTimer, pending, notified = false;
    const inFlight = new Set();
    const now = () => env.Date.now();
    async function send(payload) {
      const key = JSON.stringify(payload);
      if (notified || inFlight.has(key)) return;
      inFlight.add(key);
      const controller = new env.AbortController();
      const timeout = env.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await env.fetch(env.CodingPlanDataUpdateEndpoint || 'https://api.dreamfree.space/vc/site/data/check_updates', {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', cache:'no-store',
          body:key, signal:controller.signal
        });
        if (!response.ok) return;
        const body = await response.json();
        // Never coerce values or interpret errors/missing fields as an update.
        if (!notified && body?.err_code === 0 && body?.data?.has_update === true) {
          notified = true;
          env.clearTimeout(filterTimer); env.clearTimeout(searchTimer); pending = null;
          notify();
        }
      } catch (_) { /* Unsupported endpoint, timeout, offline and malformed replies are silent. */ }
      finally { env.clearTimeout(timeout); inFlight.delete(key); }
    }
    function flushFilter() {
      env.clearTimeout(filterTimer);
      if (!pending || notified) return;
      const delay = 10000 - (now() - lastFilter);
      if (delay > 0) { filterTimer = env.setTimeout(flushFilter, delay); return; }
      const payload = pending; pending = null; lastFilter = now();
      void send(payload);
    }
    function check(payload) {
      if (notified || !Object.keys(payload.versions || {}).length) return;
      if (!payload.purpose.startsWith('filter_')) { void send(payload); return; }
      pending = payload;
      env.clearTimeout(searchTimer);
      // A search also cancels an older trailing filter, so only the latest input survives.
      env.clearTimeout(filterTimer);
      if (payload.purpose === 'filter_search') searchTimer = env.setTimeout(flushFilter, 400);
      else flushFilter();
    }
    return {check};
  }
  function mount(root) {
    const doc = root.document, type = pageType(root.location.pathname);
    let snapshot;
    try { snapshot = JSON.parse(doc.getElementById('site-data-versions')?.textContent || '{}'); }
    catch (_) { snapshot = {}; }
    function versions(purpose) {
      const dynamic = root.codingplanDataVersions || {};
      if (purpose !== 'page_display' && purpose !== 'periodic_check') return {...dynamic};
      if (!['home','pricing','plans','models','platforms'].includes(type)) return {...snapshot};
      const result = {...dynamic};
      // Homepage announcements, articles and footer config remain static after dynamic takeover.
      if (type === 'home') for (const key of ['announcements','articles_catalog','config']) {
        if (snapshot[key] && (!result[key] || snapshot[key] < result[key])) result[key] = snapshot[key];
      }
      return result;
    }
    const checker = createChecker(root, () => {
      const dialog = doc.createElement('dialog');
      dialog.className = 'data-update-dialog';
      dialog.setAttribute('aria-labelledby','dataUpdateTitle');
      dialog.innerHTML = '<h2 id="dataUpdateTitle">网站数据已更新</h2><p>刷新页面可查看最新内容。</p><footer><button type="button" class="tool-button" data-update-later>暂不刷新</button><button type="button" class="tool-button primary" data-update-reload>刷新页面</button></footer>';
      doc.body.append(dialog);
      let release;
      const close = () => { dialog.close(); release?.(); dialog.remove(); };
      dialog.querySelector('[data-update-later]').addEventListener('click',close);
      dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
      dialog.querySelector('[data-update-reload]').addEventListener('click',() => {
        root.CodingPlanFilterUrl?.flush(); root.location.reload();
      });
      dialog.showModal();
      release = root.CodingPlanDialogs?.activate(dialog,{dialog,onClose:close});
    });
    function check(purpose, context = {}) {
      checker.check({page_type:type,purpose,context,versions:versions(purpose)});
    }
    root.CodingPlanUpdates = {check};
    let initialized = false;
    const ready = () => { if (!initialized) { initialized = true; root.setTimeout(() => check('page_display'),0); } };
    if (!['home','pricing','plans','models','platforms'].includes(type) || root.codingplanDataReady) ready();
    else root.addEventListener('codingplan:data-ready',ready,{once:true});
    root.setInterval(() => { if (initialized && !doc.hidden) check('periodic_check'); },300000);
    root.addEventListener('pageshow',event => { if (event.persisted) check('periodic_check'); });

    root.addEventListener('codingplan:filters-changed',event => {
      const source = event.detail?.source;
      if (['init','catalog','display','sort'].includes(source)) return;
      const purpose = event.detail.updatePurpose || (source === 'guide' ? 'purchase_guide' : source === 'reset' ? 'filter_reset' :
        ['featured-mode','featured'].includes(source) ? 'filter_featured_toggle' : 'filter_results');
      check(purpose);
    });
    const searches = '#modelSearch, [data-plan-search], [data-hub-search], [data-price-search]';
    doc.addEventListener('input',event => {
      if (event.target.matches(searches)) check('filter_search');
      else if (event.target.matches('#modelMultimodal')) check('filter_results');
    });
    // Capture the control before its component replaces DOM; queue checks after the operation.
    doc.addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) {
        const summary = event.target.closest('.offer-quota-summary');
        if (summary && !summary.parentElement.open) {
          const card = summary.closest('[data-plan-slug]');
          root.queueMicrotask(() => check('plan_quota',{plan_slug:card?.dataset.planSlug}));
        }
        return;
      }
      let purpose, context = {};
      if (button.matches('[data-preset-model]')) {
        purpose = 'featured_model_select'; context = button.dataset.presetModel ? {model_slug:button.dataset.presetModel} : {};
      } else if (button.matches('[data-preset-expand]') && button.getAttribute('aria-expanded') !== 'true') purpose = 'featured_expand';
      else if (button.matches('[data-plan-quota]') && button.getAttribute('aria-expanded') !== 'true') {
        purpose = 'plan_quota'; context = {plan_slug:button.dataset.planQuota};
      } else if (button.matches('[data-model-featured]')) purpose = 'filter_featured_toggle';
      else if (button.id === 'modelReset') purpose = 'filter_reset';
      else if (button.matches('[data-benchmark], [data-scale-value], [data-color-mode], [data-color-key]')) purpose = 'price_comparison';
      if (purpose) root.queueMicrotask(() => check(purpose,context));
    },true);
  }
  return {pageType,createChecker,mount};
});
