(function (root) {
  'use strict';
  function boot() {
    const host = document.getElementById('platformHubApp');
    if (!host || !root.EntityData || !root.PlatformCatalog) return;
    Promise.all(['platforms.json', 'plans.json', 'models.json', 'plan-models.json', 'config.json'].map(file => fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`${file} 加载失败`);
      return response.json();
    }))).then(([platformDoc, planDoc, modelDoc, relationDoc, appConfig]) => {
      const context = root.EntityData.buildContext(platformDoc, planDoc, modelDoc, relationDoc);
      const platforms = root.EntityData.listPlatforms(context);
      const plans = root.EntityData.buildPlanCatalog(context);
      const config = appConfig && appConfig.platformCatalog || {};
      const state = { platformSlugs: null, modelSlugs: null, planSlugs: null, modelMatch: 'any', platformStatusMax: 'delisted', platformTags: [] };
      const search = host.querySelector('[data-hub-search]');
      const status = host.querySelector('[data-hub-status]');
      const tagHost = host.querySelector('[data-hub-tags]');
      const grid = host.querySelector('[data-hub-grid]');
      const empty = host.querySelector('[data-hub-empty]');
      const showing = host.querySelector('[data-hub-showing]');
      const pinned = root.PlatformCatalog.readPinnedIdsFromStorage(root.localStorage);
      let pinnedIds = root.PlatformCatalog.sanitizePinnedIds(pinned, platforms);

      const tagValues = [...new Set([...(config.derivedTags || []).map(item => item.label), ...platforms.flatMap(item => item.tags || [])])];
      tagHost.innerHTML = tagValues.map(tag => `<button type="button" class="hub-tag" data-hub-tag="${root.PlatformCatalog.escapeHtml(tag)}" aria-pressed="false">${root.PlatformCatalog.escapeHtml(tag)}</button>`).join('');

      function render() {
        let filtered = root.CodingPlanFilters
          ? root.CodingPlanFilters.filterPlatforms(platforms, state, { platformCatalog: config, context, entityData: root.EntityData })
          : platforms;
        const query = (search.value || '').trim().toLocaleLowerCase('zh-CN');
        if (query) filtered = filtered.filter(item => `${item.name} ${item.slug}`.toLocaleLowerCase('zh-CN').includes(query));
        filtered = root.PlatformCatalog.sortPlatformsByPinned(filtered, pinnedIds);
        grid.innerHTML = filtered.map(platform => {
          const apiGroups = root.EntityData.buildApiPricingGroups(context, platform.slug);
          return root.PlatformCatalog.buildPlatformCardHtml(platform, plans, {
            hasApiPlan: apiGroups.length > 0,
            supportedModels: root.EntityData.platformModels(context, platform.slug),
            pinnedIds,
            sanitizeUrl: url => url
          });
        }).join('');
        empty.hidden = filtered.length > 0;
        showing.textContent = `${filtered.length} / ${platforms.length} 个平台`;
        if (root.PlatformDetail && root.PlatformDetail.syncPinUi) root.PlatformDetail.syncPinUi();
      }

      search.addEventListener('input', render);
      status.addEventListener('change', () => { state.platformStatusMax = status.value; render(); });
      tagHost.addEventListener('click', event => {
        const button = event.target.closest('[data-hub-tag]');
        if (!button) return;
        const tag = button.getAttribute('data-hub-tag');
        state.platformTags = state.platformTags.includes(tag) ? state.platformTags.filter(item => item !== tag) : [...state.platformTags, tag];
        button.setAttribute('aria-pressed', String(state.platformTags.includes(tag)));
        button.classList.toggle('is-active', state.platformTags.includes(tag));
        render();
      });
      grid.addEventListener('click', event => {
        const pinButton = event.target.closest('[data-platform-pin="1"]');
        if (pinButton) {
          event.preventDefault();
          event.stopPropagation();
          const id = pinButton.getAttribute('data-platform-id');
          pinnedIds = root.PlatformCatalog.sanitizePinnedIds(root.PlatformCatalog.togglePinnedId(pinnedIds, id), platforms);
          root.PlatformCatalog.writePinnedIdsToStorage(root.localStorage, pinnedIds);
          render();
          return;
        }
        if (event.target.closest('a')) return;
        const card = event.target.closest('.platform-card');
        if (!card || !root.PlatformDetail) return;
        const platform = platforms.find(item => item.slug === card.getAttribute('data-platform-id'));
        if (platform) root.PlatformDetail.open(platform, { triggerEl: card });
      });
      grid.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const card = event.target.closest('.platform-card');
        if (!card || event.target.closest('a,button')) return;
        event.preventDefault();
        const platform = platforms.find(item => item.slug === card.getAttribute('data-platform-id'));
        if (platform && root.PlatformDetail) root.PlatformDetail.open(platform, { triggerEl: card });
      });
      if (root.PlatformDetail) root.PlatformDetail.init({
        getPlans: () => plans,
        getEntityContext: () => context,
        monitorApiBase: (root.MONITOR_CONFIG && root.MONITOR_CONFIG.apiBase) || 'https://api.dreamfree.space/vc',
        onJumpPlansTable: platformName => { window.location.href = `/plans/?platform=${encodeURIComponent(platforms.find(item => item.name === platformName)?.slug || '')}`; },
        isPlatformPinned: id => pinnedIds.includes(id),
        onTogglePlatformPin: id => {
          pinnedIds = root.PlatformCatalog.sanitizePinnedIds(root.PlatformCatalog.togglePinnedId(pinnedIds, id), platforms);
          root.PlatformCatalog.writePinnedIdsToStorage(root.localStorage, pinnedIds);
          render();
        }
      });
      if (root.PlatformComparison && root.PlatformComparison.mountLauncher) {
        root.PlatformComparison.mountLauncher({ button: host.querySelector('[data-hub-compare]'), count: host.querySelector('[data-hub-compare-count]'), platforms, getPinnedIds: () => pinnedIds });
      }
      render();
    }).catch(error => {
      host.querySelector('[data-hub-error]').hidden = false;
      host.querySelector('[data-hub-error]').textContent = error.message || '平台数据加载失败';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
