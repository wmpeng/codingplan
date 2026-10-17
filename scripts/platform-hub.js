(function (root, factory) {
  const api = factory(root.CodingPlanFilters || (typeof require === 'function' ? require('./filter-state.js') : null),
    root.PlatformCatalog || (typeof require === 'function' ? require('./platform-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlatformHub = api;
})(globalThis, function (Filters, Catalog) {
  'use strict';
  const matchesName = (platform, query) => `${platform.name} ${platform.slug}`.toLocaleLowerCase('zh-CN').includes(query);
  function prioritizeFeaturedModels(models, groups = []) {
    const featured = new Set(groups.filter(group => group.enabled !== false).flatMap(group => group.modelSlugs || []));
    return [...models.filter(model => featured.has(model.slug)), ...models.filter(model => !featured.has(model.slug))];
  }
  function select(platforms, state, options = {}) {
    const featured = new Set(options.featuredSlugs || []);
    const pinnedIds = Catalog.sanitizePinnedIds(options.pinnedIds, platforms);
    const pinnedSet = new Set(pinnedIds);
    const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
    const filterOptions = options.filterOptions || {};
    const matched = options.featuredOnly ? platforms.filter(p => featured.has(p.slug))
      : Filters.filterPlatforms(platforms, {...state, platformSlugs:null, includeDiscontinued:false}, filterOptions).filter(p => matchesName(p, query));
    const matchedIds = new Set(matched.map(p => p.slug));
    const pinned = Catalog.sortPlatformsByPinned(platforms.filter(p => pinnedSet.has(p.slug)), pinnedIds);
    const results = matched.filter(p => !pinnedSet.has(p.slug));
    // Stable partition: preserve the source order inside featured and ordinary groups.
    results.sort((a, b) => Number(featured.has(b.slug)) - Number(featured.has(a.slug)));
    return {pinned, results, visible:[...pinned,...results], matchedCount:matched.length, totalCount:platforms.length,
      extraPinnedCount:pinned.filter(p => !matchedIds.has(p.slug)).length};
  }
  function countParts(selection, featuredOnly) {
    const current = featuredOnly ? `精选 ${selection.matchedCount} 个` : String(selection.matchedCount);
    const total = featuredOnly ? '' : ` / 共 ${selection.totalCount}`;
    const pins = featuredOnly ? selection.extraPinnedCount : selection.pinned.length;
    return [current, total, pins ? ` · 置顶 ${pins} 个` : ''];
  }
  function countLabel(selection, featuredOnly) {
    return countParts(selection, featuredOnly).join('');
  }
  function countHtml(selection, featuredOnly) {
    const [current, total, pins] = countParts(selection, featuredOnly);
    if (featuredOnly) return current + pins;
    return `<span class="platform-count-main"><strong class="platform-count-value">${current}</strong><span class="platform-count-total">${total}</span></span>${pins}`;
  }
  return {select, countLabel, countHtml, prioritizeFeaturedModels};
});
