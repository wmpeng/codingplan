/* Coding Plan 事件语义集中在此；传输、身份和重试由 common 发送器维护。 */
(function (root) {
  'use strict';
  const path = location.pathname;
  const pageType = /^\/articles\/.+/.test(path) ? 'article' : path.split('/').filter(Boolean)[0] || 'home';
  const config = root.CodingPlanEventCollectConfig || {};
  const sdk = root.EventCollect;
  let ready = false, pending, latestResult, interaction;
  let lastResultKey;
  function track(name, properties = {}, urgent = false) {
    try {
      if (!ready) return;
      const item = sdk.track(name, properties);
      if (urgent) void sdk.flush(true);
      return item;
    } catch (_) { return null; }
  }
  const finite = value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e16 ? value : null;
  function filterSummary(state) {
    return {
      platform_count: state.platformSlugs?.length || 0, model_count: state.modelSlugs?.length || 0,
      budget_cny: finite(typeof state.budgetCny === 'number' ? state.budgetCny : state.budgetCny?.max), token_min_m: finite(state.monthlyTokenRange?.min),
      api_only: !!state.apiOnly, model_match: state.modelMatch || 'any', preference: state.preference || 'balanced'
    };
  }
  function results(detail) {
    latestResult = detail;
    if (!pending && lastResultKey !== detail.result_key) {
      lastResultKey = detail.result_key;
      track('results_view', { result_count: detail.result_count, ...(interaction ? { interaction_id: interaction } : {}) });
    }
  }
  function commitFilter() {
    if (!pending) return;
    const next = pending; pending = null;
    const item = track('filter_apply', { ...next.summary, source: next.source });
    interaction = item?.event_id;
    // filter_apply 的事件 ID 也作为其对应结果的关联 ID。
    if (latestResult) {
      lastResultKey = latestResult.result_key;
      track('results_view', { result_count: latestResult.result_count, ...(interaction ? { interaction_id: interaction } : {}) });
    }
  }
  let debounce;
  root.addEventListener('codingplan:filters-changing', event => {
    const { state, source } = event.detail;
    if (['init', 'catalog', 'display'].includes(source)) return;
    pending = { summary: filterSummary(state), source };
    clearTimeout(debounce); debounce = setTimeout(commitFilter, 600);
  });
  root.addEventListener('codingplan:results-rendered', event => results(event.detail));
  root.CodingPlanEvents = { track, results, commitFilter };
  document.addEventListener('visibilitychange', () => { if (document.hidden) commitFilter(); });
  function placement(el) {
    if (el.closest('.tool-nav')) return 'site_nav';
    if (el.closest('.tool-brand')) return 'site_brand';
    if (el.closest('#platformDetailOverlay')) return 'platform_detail';
    if (el.closest('.model-card')) return 'model_card';
    if (el.closest('.platform-card')) return 'platform_card';
    if (el.closest('.hero-article')) return 'hero_article';
    if (el.closest('#homeKnowledge')) return 'home_articles';
    if (el.closest('.hero-find-button')) return 'hero';
    return pageType;
  }
  const slug = value => /^[a-z0-9][a-z0-9_-]{0,159}$/.test(value || '') ? value : null;
  function internalNavigation(el, url) {
    if (url.origin !== location.origin) return false;
    const samePage = url.pathname === path;
    // Only the two primary homepage section jumps are counted; skip TOCs and arbitrary anchors.
    if (samePage && url.hash) {
      const target = ['/', '/index.html'].includes(path)
        ? el.matches('.hero-find-button') && url.hash === '#selectionWorkspace' ? 'selection'
          : url.hash === '#purchaseGuide' ? 'purchase_guide' : null
        : null;
      if (target) track('navigation_click', { target, placement: placement(el) }, true);
      return true;
    }
    const cleanPath = url.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    const targets = {'/':'home','/pricing':'pricing','/plans':'plans','/platforms':'platforms',
      '/models':'models','/articles':'articles','/updates':'updates'};
    const article = cleanPath.match(/^\/articles\/(model_comparisons|plan_comparisons|news)\/([a-z0-9_-]+)$/);
    const platform = cleanPath.match(/^\/platforms\/([a-z0-9-]+)$/);
    const target = article ? 'article' : platform ? 'platform_guide' : targets[cleanPath];
    if (!target) return true;
    const properties = { target, target_path: url.pathname, placement: placement(el) };
    for (const [param, field] of [['platform','platform_slug'],['model','model_slug'],['plan','plan_slug']]) {
      const value = slug(url.searchParams.get(param)); if (value) properties[field] = value;
    }
    if (platform) properties.platform_slug = platform[1];
    track('navigation_click', properties, true);
    return true;
  }
  // 捕获阶段只处理明确标记或既有语义入口，不采集任意点击文字与完整 URL。
  document.addEventListener('click', event => {
    const el = event.target.closest('a, [data-collect-event], [data-community-open]');
    if (!el) return;
    if (el.matches('[data-community-open], .community-join, .community-invite-link')) {
      track('community_click', { placement: el.closest('#communityFloat, #communityDialog') ? 'floating' : el.closest('#communityFooter') ? 'footer' : 'hero',
        action: el.matches('[data-community-open]') ? 'open' : 'join' }, true);
      return;
    }
    if (el.dataset.collectEvent) {
      track(el.dataset.collectEvent, { placement: el.dataset.collectPlacement || pageType }, true); return;
    }
    if (el.matches('a[href]')) {
      const url = new URL(el.href, location.href);
      if (internalNavigation(el, url)) return;
      if (url.origin === 'https://github.com' && /^\/wmpeng\/codingplan\/(issues|discussions)\/?$/.test(url.pathname)) {
        track('outbound_click', {link_kind:'feedback', channel:'github', action:url.pathname.split('/')[3], placement:placement(el)}, true);
        return;
      }
    }
    if (el.matches('.offer-open-link, .platform-name-link, .platform-detail-action, [data-collect-outbound], .guide-actions .guide-button.secondary')) {
      const url = new URL(el.href, location.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return;
      commitFilter();
      const entity = el.closest('[data-platform-id], [data-plan-slug], [data-collect-platform]');
      track('outbound_click', {
        placement: el.closest('#platformDetailOverlay') ? 'platform_detail' : el.closest('[data-offer-id]') ? 'home_results' : pageType,
        platform_slug: el.dataset.collectPlatform || entity?.dataset.collectPlatform || entity?.dataset.platformId || (pageType === 'platforms' ? path.split('/')[2] : null) || null,
        plan_slug: el.dataset.collectPlan || entity?.dataset.planSlug || null,
        link_kind: el.matches('.guide-button.secondary') || (el.dataset.planLink && el.dataset.planLink !== 'open') ? 'website' : 'purchase'
      }, true);
    }
  }, true);
  function init() {
    if (!sdk) return;
    sdk.init({ namespace: 'codingplan', endpoint: config.endpoint, context: { page_type: pageType } });
    ready = true;
    track('page_view');
    // 已加载的结果可能早于 DOMContentLoaded，补记初次实际展示。
    if (latestResult) { const detail = latestResult; lastResultKey = undefined; results(detail); }
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      const section = document.createElement('div'); section.className = 'settings-privacy-section';
      section.innerHTML = `<div class="settings-toggle-row">
        <label for="eventCollectToggle">允许匿名使用统计</label>
        <label class="toggle-switch">
          <input type="checkbox" id="eventCollectToggle" aria-label="允许匿名使用统计" aria-describedby="eventCollectDescription">
          <span class="toggle-slider" aria-hidden="true"></span>
        </label>
      </div>
      <p class="settings-description" id="eventCollectDescription">仅统计访问与操作，不采集输入内容。</p>`;
      const toggle = section.querySelector('input'); toggle.checked = sdk.isUserEnabled();
      panel.append(section);
      toggle.addEventListener('change', () => {
        if (toggle.checked) {
          sdk.setEnabled(true);
          track('settings_change', {setting:'anonymous_statistics', value:true});
        } else {
          // One best-effort send while still allowed; disable synchronously, with no retry after opt-out.
          track('settings_change', {setting:'anonymous_statistics', value:false}, true);
          sdk.setEnabled(false);
        }
      });
      root.addEventListener('storage', () => { toggle.checked = sdk.isUserEnabled(); });
    }
    if (pageType === 'article') {
      let visibleSince = document.hidden ? null : performance.now(), visibleTime = 0, read = false;
      function accrue() {
        if (visibleSince !== null) visibleTime += performance.now() - visibleSince;
        visibleSince = document.hidden ? null : performance.now();
      }
      function check() {
        accrue();
        if (!read && !document.hidden && visibleTime >= 10000 &&
            (scrollY + innerHeight) / Math.max(document.documentElement.scrollHeight, 1) >= 0.75) {
          read = true; track('article_read', { progress: 75 });
        }
      }
      document.addEventListener('visibilitychange', accrue);
      addEventListener('scroll', check, { passive: true });
      const reader = setInterval(() => { check(); if (read) clearInterval(reader); }, 2000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(globalThis);
