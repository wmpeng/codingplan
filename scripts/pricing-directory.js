(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PricingDirectory = api;
})(globalThis, function () {
  'use strict';
  const UI = globalThis.CodingPlanUI || require('./ui-core.js');
  const pinKey = 'codingplanPinnedPriceRows';
  function cycleSort(sort, key) {
    if (sort.key !== key) return {key, direction:'asc'};
    return sort.direction === 'asc' ? {key, direction:'desc'} : {key:'unitPriceCnyPerM', direction:'asc'};
  }
  const {sanitizePins, readPins, writePins} = UI.pinStore(pinKey);
  function search(points, query) {
    const text = String(query || '').trim().toLocaleLowerCase('zh-CN');
    return text ? points.filter(point => `${point.platformName} ${point.planName} ${point.modelName} ${point.relationLabel}`.toLocaleLowerCase('zh-CN').includes(text)) : points;
  }
  function tableRows(matched, all, pins, sortRows, sort) {
    const ids = new Set(matched.map(point => point.slug)), pinned = new Set(sanitizePins(pins, all));
    return sortRows(all.filter(point => ids.has(point.slug) || pinned.has(point.slug)), sort.key, sort.direction)
      .sort((a,b) => Number(pinned.has(b.slug)) - Number(pinned.has(a.slug)));
  }
  function paginate(rows, pins, index, size = 200) {
    const pinned = new Set(pins), fixed = rows.filter(row => pinned.has(row.slug));
    const normal = rows.filter(row => !pinned.has(row.slug));
    const pages = Math.max(1, Math.ceil(normal.length / size));
    const page = Math.max(0, Math.min(pages - 1, index));
    return {page, pages, rows:[...fixed, ...normal.slice(page * size, (page + 1) * size)]};
  }
  return {pinKey, cycleSort, sanitizePins, readPins, writePins, search, tableRows, paginate};
});
