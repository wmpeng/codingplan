(function (root) {
  'use strict';
  function boot() {
    const host = document.getElementById('platformHubApp');
    if (!host || !root.EntityData || !root.PlatformCatalog) return;
    root.CodingPlanToolPage.load().then(({ context, config: appConfig }) => {
      const platforms = root.EntityData.listPlatforms(context);
      const plans = root.EntityData.buildPlanCatalog(context);
      const config = appConfig && appConfig.platformCatalog || {};
      let state = root.CodingPlanFilters.createDefaultState(appConfig, { mode: 'full' });
      const search = host.querySelector('[data-hub-search]');
      const grid = host.querySelector('[data-hub-grid]');
      const empty = host.querySelector('[data-hub-empty]');
      const showing = host.querySelector('[data-hub-showing]');
      const pinned = root.PlatformCatalog.readPinnedIdsFromStorage(root.localStorage);
      let pinnedIds = root.PlatformCatalog.sanitizePinnedIds(pinned, platforms);

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
        root.PlatformComparison.mountLauncher({ button: document.querySelector('[data-hub-compare]'), count: document.querySelector('[data-hub-compare-count]'), platforms, getPinnedIds: () => pinnedIds });
      }
      root.CodingPlanToolPage.filters({ context, config: appConfig }, 'platforms', next => { state = next; render(); });
    }).catch(error => root.CodingPlanToolPage.error(host, error.message));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
