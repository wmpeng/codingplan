(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PricingDirectory = api;
})(globalThis, function () {
  'use strict';
  const pinKey = 'codingplanPinnedPriceRows';
  const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  // Generated unit prices use the regular monthly fee. Scale that cost only;
  // quotas, API quotes, budget matching and the source objects stay unchanged.
  function withPriceBasis(points, context, basis) {
    if (basis !== 'firstMonth') return points;
    return points.map(point => {
      if (point.billingMode !== 'subscription') return point;
      const plan = context.planBySlug.get(point.planSlug);
      if (!known(plan?.firstMonthPrice)) return point;
      const unit = point.unitPriceCnyPerM;
      const value = known(unit) && known(plan.monthlyPrice)
        ? plan.monthlyPrice > 0 ? unit * plan.firstMonthPrice / plan.monthlyPrice
          : plan.firstMonthPrice === 0 ? unit : null
        : null;
      return {...point, unitPriceCnyPerM:value, unitPriceBasis:'firstMonth', firstMonthPrice:plan.firstMonthPrice};
    });
  }
  function cycleSort(sort, key) {
    if (sort.key !== key) return {key, direction:'asc'};
    return sort.direction === 'asc' ? {key, direction:'desc'} : {key:'unitPriceCnyPerM', direction:'asc'};
  }
  function sanitizePins(ids, points) {
    const valid = new Set(points.map(point => point.slug));
    return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && valid.has(id)))];
  }
  function readPins(storage, points) {
    try { return sanitizePins(JSON.parse(storage.getItem(pinKey)), points); } catch (_) { return []; }
  }
  function writePins(storage, pins) { try { storage.setItem(pinKey, JSON.stringify(pins)); } catch (_) {} }
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
  return {pinKey, withPriceBasis, cycleSort, sanitizePins, readPins, writePins, search, tableRows, paginate};
});
