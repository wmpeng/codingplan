(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ModelDirectory = api;
})(globalThis, function (Catalog) {
  'use strict';
  const pinKey = 'codingplanPinnedModels';
  function sanitizePins(ids, models) {
    const valid = new Set(models.map(model => model.slug));
    return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && valid.has(id)))];
  }
  function readPins(storage, models) {
    try { return sanitizePins(JSON.parse(storage.getItem(pinKey)), models); } catch (_) { return []; }
  }
  function writePins(storage, ids) { try { storage.setItem(pinKey, JSON.stringify(ids)); } catch (_) {} }
  function select(models, groups, state = {}, pins = []) {
    const pinned = new Set(sanitizePins(pins, models));
    const featured = new Set(groups.filter(group => group.enabled !== false).flatMap(group => group.modelSlugs || []));
    const enabledGroups = groups.filter(group => group.enabled !== false);
    const group = enabledGroups.find(group => group.id === state.featuredMode);
    const modeSlugs = state.featuredMode === 'all' ? featured : group ? new Set(group.modelSlugs) : null;
    const query = String(state.query || '').trim().toLocaleLowerCase();
    const matched = models.filter(model => modeSlugs ? modeSlugs.has(model.slug)
      : (!query || `${model.name} ${model.slug}`.toLocaleLowerCase().includes(query)) && (!state.multimodal || model.multimodal === true));
    const matchedIds = new Set(matched.map(model => model.slug));
    const order = new Map(models.map((model, index) => [model.slug, index]));
    const rank = model => pinned.has(model.slug) ? 0 : featured.has(model.slug) ? 1 : 2;
    const visible = models.filter(model => pinned.has(model.slug) || matchedIds.has(model.slug));
    visible.sort((a, b) => {
      const priority = rank(a) - rank(b);
      if (priority) return priority;
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN') || order.get(a.slug) - order.get(b.slug);
      if (['artificialAnalysis', 'deepSWE'].includes(state.sort)) {
        const x = Catalog.score(a, state.sort), y = Catalog.score(b, state.sort);
        if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; }
        else if (x !== y) return y - x;
      }
      return order.get(a.slug) - order.get(b.slug);
    });
    return {visible, featured, pinned, matchedCount: matched.length, featuredMode: !!modeSlugs,
      extraPinnedCount: [...pinned].filter(slug => !matchedIds.has(slug)).length};
  }
  function countLabel(selection) {
    const pins = selection.featuredMode ? selection.extraPinnedCount : selection.pinned.size;
    return `${selection.featuredMode ? '精选' : '符合条件'} ${selection.matchedCount} 个` + (pins ? ` · 置顶 ${pins} 个` : '');
  }
  return {select, countLabel, sanitizePins, readPins, writePins, pinKey};
});
