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
    return {pinned, results, visible:[...pinned,...results], matchedCount:matched.length,
      extraPinnedCount:pinned.filter(p => !matchedIds.has(p.slug)).length};
  }
  function countLabel(selection, featuredOnly) {
    const count = featuredOnly ? `精选 ${selection.matchedCount} 个` : `符合条件 ${selection.matchedCount} 个`;
    const pins = featuredOnly ? selection.extraPinnedCount : selection.pinned.length;
    return count + (pins ? ` · 置顶 ${pins} 个` : '');
  }
  return {select, countLabel};
});
