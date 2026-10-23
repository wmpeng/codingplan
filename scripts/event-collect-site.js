/* Coding Plan 事件语义集中在此；传输、身份和重试由 common 发送器维护。 */
(function (root) {
  'use strict';
  const path = location.pathname;
  const pageType = /^\/articles\/.+/.test(path) ? 'article' : path.split('/').filter(Boolean)[0] || 'home';
  const config = root.CodingPlanEventCollectConfig || {};
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '8765';
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
  // 捕获阶段只处理明确标记或既有语义入口，不采集任意点击文字与完整 URL。
  document.addEventListener('click', event => {
    const el = event.target.closest('a, [data-collect-event], [data-community-open]');
    if (!el) return;
    if (el.matches('[data-community-open], .community-join')) {
      track('community_click', { placement: el.closest('#communityFloat, #communityDialog') ? 'floating' : el.closest('#communityFooter') ? 'footer' : 'hero' }, true);
      return;
    }
    if (el.dataset.collectEvent) {
      track(el.dataset.collectEvent, { placement: el.dataset.collectPlacement || pageType }, true); return;
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
    sdk.init({ namespace: 'codingplan', endpoint: local ? config.localEndpoint : config.endpoint,
      enabled: local || config.enabled === true, context: { page_type: pageType } });
    ready = true;
    track('page_view');
    // 已加载的结果可能早于 DOMContentLoaded，补记初次实际展示。
    if (latestResult) { const detail = latestResult; lastResultKey = undefined; results(detail); }
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      const label = document.createElement('label'); label.className = 'settings-unit-section';
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = sdk.isEnabled();
      label.append(toggle, document.createTextNode(' 允许匿名使用统计'));
      const description = document.createElement('small');
      description.textContent = '记录页面访问和关键操作，用于改进网站；不采集输入内容。';
      label.append(document.createElement('br'), description); panel.append(label);
      toggle.addEventListener('change', () => sdk.setEnabled(toggle.checked));
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
