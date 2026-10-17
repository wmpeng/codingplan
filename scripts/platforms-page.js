(function (root) {
  'use strict';
  function boot() {
    const host = document.getElementById('platformHubApp');
    if (!host || !root.EntityData || !root.PlatformCatalog) return;
    const modelRows = root.CodingPlanUI.observeModelTagRows(host);
    host.addEventListener('click', event => root.PlatformCatalog.togglePlatformModels(event));
    host.setAttribute('aria-busy', 'true');
    root.CodingPlanToolPage.load().then(({ context, config: appConfig }) => {
      const platforms = root.EntityData.listPlatforms(context);
      const plans = root.EntityData.buildPlanCatalog(context).filter(plan => plan.billingMode === 'subscription');
      const config = appConfig && appConfig.platformCatalog || {};
      let state = root.CodingPlanFilters.createDefaultState(appConfig, { mode: 'full' });
      let featuredOnly = false;
      const search = host.querySelector('[data-hub-search]');
      const linkedPlatform = platforms.find(platform => platform.slug === new URLSearchParams(location.search).get('platform'));
      if (linkedPlatform) search.value = linkedPlatform.name;
      search.disabled = false;
      const grid = host.querySelector('[data-hub-grid]');
      const empty = host.querySelector('[data-hub-empty]');
      const showing = host.querySelector('[data-hub-showing]');
      const pinned = root.PlatformCatalog.readPinnedIdsFromStorage(root.localStorage);
      let pinnedIds = root.PlatformCatalog.sanitizePinnedIds(pinned, platforms);

      function render() {
        const featuredSlugs = context.featuredPlatformSlugs || [];
        const selection = root.PlatformHub.select(platforms, state, {featuredOnly, featuredSlugs, pinnedIds, query:search.value,
          filterOptions:{platformCatalog:config, context, usdToCnyRate:appConfig.usdToCnyRate, entityData:root.EntityData}});
        const cardHtml = platform => {
          const apiGroups = root.EntityData.buildApiPricingGroups(context, platform.slug);
          return root.PlatformCatalog.buildPlatformCardHtml(platform, plans, {
            hasApiPlan: apiGroups.length > 0,
            supportedModels: root.PlatformHub.prioritizeFeaturedModels(root.EntityData.platformModels(context, platform.slug), context.modelGroups),
            featured: featuredSlugs.includes(platform.slug),
            modelMaxRows: 3,
            pinnedIds,
            sanitizeUrl: root.CodingPlanUI.sanitizeUrl
          });
        };
        grid.innerHTML = selection.visible.map(cardHtml).join('');
        modelRows.refresh();
        search.disabled = featuredOnly;
        search.closest('.tool-result-bar').classList.toggle('is-search-paused', featuredOnly);
        host.setAttribute('aria-busy','false');
        empty.hidden = selection.visible.length > 0;
        showing.innerHTML = root.PlatformHub.countHtml(selection, featuredOnly);
        if (root.PlatformDetail && root.PlatformDetail.syncPinUi) root.PlatformDetail.syncPinUi();
      }

      search.addEventListener('input', render);
      host.addEventListener('click', event => {
        if (event.target.closest('[data-platform-toggle-models]')) return;
        const pinButton = event.target.closest('[data-platform-pin="1"]');
        if (pinButton) {
          event.preventDefault();
          event.stopPropagation();
          const id = pinButton.getAttribute('data-platform-id');
          pinnedIds = root.PlatformCatalog.sanitizePinnedIds(root.PlatformCatalog.togglePinnedId(pinnedIds, id), platforms);
          root.PlatformCatalog.writePinnedIdsToStorage(root.localStorage, pinnedIds);
          render();
          host.querySelectorAll('[data-platform-pin="1"]').forEach(button => {
            if (button.getAttribute('data-platform-id') === id) button.focus({preventScroll:true});
          });
          return;
        }
        if (event.target.closest('a')) return;
        const card = event.target.closest('.platform-card');
        if (!card || !root.PlatformDetail) return;
        const platform = platforms.find(item => item.slug === card.getAttribute('data-platform-id'));
        if (platform) root.PlatformDetail.open(platform, { triggerEl: card });
      });
      host.addEventListener('keydown', event => {
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
        onJumpPlansTable: platformName => { window.location.href = root.CodingPlanUI.route('plans',{platform:platforms.find(item=>item.name===platformName)?.slug}); },
        isPlatformPinned: id => pinnedIds.includes(id),
        onTogglePlatformPin: id => {
          pinnedIds = root.PlatformCatalog.sanitizePinnedIds(root.PlatformCatalog.togglePinnedId(pinnedIds, id), platforms);
          root.PlatformCatalog.writePinnedIdsToStorage(root.localStorage, pinnedIds);
          render();
        }
      });
      if (root.__CODINGPLAN_FEATURES?.platformComparison === true && root.PlatformComparison && root.PlatformComparison.mountLauncher) {
        document.querySelector('[data-hub-compare]').disabled = false;
        root.PlatformComparison.mountLauncher({ button: document.querySelector('[data-hub-compare]'), count: document.querySelector('[data-hub-compare-count]'), platforms, getPinnedIds: () => pinnedIds });
      }
      root.CodingPlanToolPage.filters({ context, config: appConfig }, 'platforms', (next, meta) => {
        state = next;
        featuredOnly = meta.featuredOnly;
        if (meta.source === 'reset') search.value = '';
        render();
      });
    }).catch(error => {
      const loading = document.querySelector('#toolFilters .tool-filter-loading');
      if (loading) loading.textContent = '筛选条件暂时无法加载，仍可浏览下方平台信息';
      root.CodingPlanToolPage.error(host, error.message, { preserveContent: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
