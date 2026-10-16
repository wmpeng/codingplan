(function (root, factory) {
  const api = factory(root.CodingPlanFilters || (typeof require === 'function' ? require('./filter-state.js') : null),
    root.PlatformCatalog || (typeof require === 'function' ? require('./platform-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlatformHub = api;
})(globalThis, function (Filters, Catalog) {
  'use strict';
  const matchesName = (platform, query) => `${platform.name} ${platform.slug}`.toLocaleLowerCase('zh-CN').includes(query);
  function select(platforms, state, options = {}) {
    const featured = new Set(options.featuredSlugs || []);
    const pinnedIds = Catalog.sanitizePinnedIds(options.pinnedIds, platforms);
    const pinnedSet = new Set(pinnedIds);
    const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
    const filterOptions = options.filterOptions || {};
    const matched = options.featuredOnly ? platforms.filter(p => featured.has(p.slug))
      : Filters.filterPlatforms(platforms, {...state, platformSlugs:null}, filterOptions).filter(p => matchesName(p, query));
    const matchedIds = new Set(matched.map(p => p.slug));
    const pinned = Catalog.sortPlatformsByPinned(platforms.filter(p => pinnedSet.has(p.slug)), pinnedIds);
    const results = matched.filter(p => !pinnedSet.has(p.slug));
    // Stable partition: preserve the source order inside featured and ordinary groups.
    results.sort((a, b) => Number(featured.has(b.slug)) - Number(featured.has(a.slug)));
    const notices = new Map();
    if (!options.featuredOnly) for (const platform of pinned) {
      if (matchedIds.has(platform.slug)) continue;
      const reasons = [];
      if (query && !matchesName(platform, query)) reasons.push('名称不匹配搜索词');
      if (state.domesticNetworkOnly && platform.requiresOverseasNetwork !== false) reasons.push(platform.requiresOverseasNetwork == null ? '境内可用情况待确认' : '不符合境内可用条件');
      if (state.domesticPaymentOnly && platform.requiresOverseasPayment !== false) reasons.push(platform.requiresOverseasPayment == null ? '境内购买情况待确认' : '不符合境内可购买条件');
      const baseline = {...Filters.createDefaultState({}, {mode:'full'}), platformSlugs:null, modelSlugs:null, platformStatusMax:'delisted', includeDiscontinued:true};
      const fails = patch => Filters.filterPlatforms([platform], {...baseline, ...patch}, filterOptions).length === 0;
      if (platform.platformStatus === 'delisted' && state.platformStatusMax !== 'delisted') reasons.push('平台已下架');
      else if ((state.excludedPlatformStatuses || []).includes(platform.platformStatus)) reasons.push('平台购买受限');
      if (state.modelSlugs?.length && fails({modelSlugs:state.modelSlugs, modelMatch:state.modelMatch})) reasons.push('不符合所选模型要求');
      if (state.budgetCny && fails({budgetCny:state.budgetCny, monthlyTokenRange:state.monthlyTokenRange})) reasons.push('不符合当前预算或费用待确认');
      if (state.monthlyTokenRange && fails({monthlyTokenRange:state.monthlyTokenRange})) reasons.push('不符合当前月用量或额度待确认');
      if (state.apiOnly && fails({apiOnly:true})) reasons.push('没有匹配的按量 API');
      notices.set(platform.slug, reasons.length ? reasons.join('；') : '当前条件下没有匹配的套餐');
    }
    return {pinned, results, matchedCount:matched.length, notices,
      extraPinnedCount:pinned.filter(p => !matchedIds.has(p.slug)).length};
  }
  function countLabel(selection, featuredOnly) {
    const count = featuredOnly ? `精选 ${selection.matchedCount} 个` : `符合条件 ${selection.matchedCount} 个`;
    const pins = featuredOnly ? selection.extraPinnedCount : selection.pinned.length;
    return count + (pins ? ` · 置顶 ${pins} 个` : '');
  }
  return {select, countLabel};
});
