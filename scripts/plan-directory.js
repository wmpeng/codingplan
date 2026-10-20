(function (root, factory) {
  const api = factory(root.CodingPlanFilters || (typeof require === 'function' ? require('./filter-state.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanDirectory = api;
})(globalThis, function (Filters) {
  'use strict';
  const pinKey = 'codingplanPinnedPlans';
  const sortOptions = [
    ['platformOrder', '默认'], ['platformName', '平台名称'], ['name', '套餐名称'],
    ['rating', '评分'], ['firstMonthPrice', '首月价格'], ['monthlyPrice', '每月价格'],
    ['quarterlyPrice', '包季价格'], ['yearlyPrice', '包年价格'],
    ['modelLabels', '支持模型'], ['monthlyToken', '月 Token 参考'],
    ['requestQuota.fiveHours', '5 小时请求'], ['requestQuota.weekly', '每周请求'], ['requestQuota.monthly', '每月请求'],
    ['benefits', '其他权益'], ['note', '备注']
  ];
  function sanitizePins(ids, plans) {
    const valid = new Set(plans.map(plan => plan.slug));
    return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && valid.has(id)))];
  }
  function readPins(storage, plans) {
    try { return sanitizePins(JSON.parse(storage.getItem(pinKey)), plans); } catch (_) { return []; }
  }
  function writePins(storage, ids) { try { storage.setItem(pinKey, JSON.stringify(ids)); } catch (_) {} }
  function purchaseStatus(plan, platform) {
    const planStatus = plan.planStatus || 'open', platformStatus = platform?.platformStatus || 'open';
    return (Filters.STATUS_RANK[platformStatus] || 0) > (Filters.STATUS_RANK[planStatus] || 0) ? platformStatus : planStatus;
  }
  function cycleSort(sort, key) {
    if (sort.key !== key) return {key, direction:'asc'};
    return sort.direction === 'asc' ? {key, direction:'desc'} : {key:'platformOrder', direction:'asc'};
  }
  function priceValue(plan, key) {
    return plan[key];
  }
  function select(plans, state, options = {}) {
    const {context, config = {}, query = '', sort = {key:'platformOrder', direction:'asc'}} = options;
    const pinned = new Set(sanitizePins(options.pins, plans));
    const text = String(query).trim().toLocaleLowerCase('zh-CN');
    const matched = Filters.filterPlans(plans, {...state, apiOnly:false}, {
      context, usdToCnyRate:config.usdToCnyRate, platformCatalog:config.platformCatalog
    }).filter(plan => `${plan.platformName} ${plan.name} ${plan.slug}`.toLocaleLowerCase('zh-CN').includes(text));
    const matchedIds = new Set(matched.map(plan => plan.slug));
    const visible = plans.filter(plan => matchedIds.has(plan.slug) || pinned.has(plan.slug));
    const platformOrder = new Map(context.platforms.map((platform, index) => [platform.slug, index]));
    const value = plan => {
      if (sort.key === 'monthlyToken') {
        const values = (plan.monthlyTokenOptions || []).filter(row => !state.modelSlugs?.length || state.modelSlugs.includes(row.modelSlug))
          .map(row => row.value === 'unlimited' ? Infinity : row.value).filter(value => typeof value === 'number' && !Number.isNaN(value));
        return values.length ? Math.max(...values) : null;
      }
      const key = sort.key === 'platformOrder' ? 'monthlyPrice' : sort.key;
      if (key.startsWith('requestQuota.')) {
        const requests = plan.requestQuota?.[key.slice('requestQuota.'.length)];
        return requests === 'unlimited' ? Infinity : typeof requests === 'number' ? requests : null;
      }
      const result = priceValue(plan, key);
      if (key.endsWith('Price')) return Filters.toCny(result, plan.currency, config.usdToCnyRate);
      if (key === 'rating') return result > 0 ? result : null;
      return Array.isArray(result) ? result.join('、') : result;
    };
    visible.sort((a, b) => {
      if (pinned.has(a.slug) !== pinned.has(b.slug)) return pinned.has(a.slug) ? -1 : 1;
      if (sort.key === 'platformOrder') {
        const delta = (platformOrder.get(a.platformSlug) ?? platformOrder.size) - (platformOrder.get(b.platformSlug) ?? platformOrder.size);
        if (delta) return delta;
      }
      const left = value(a), right = value(b);
      if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
      const delta = left === right ? 0 : typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'zh-CN');
      return sort.direction === 'desc' ? -delta : delta;
    });
    return {visible, pinned, matchedCount:matched.length, totalCount:plans.length};
  }
  function countLabel(selection) {
    return `${selection.matchedCount} / ${selection.totalCount} 个套餐` + (selection.pinned.size ? ` · 置顶 ${selection.pinned.size} 个` : '');
  }
  return {pinKey, sortOptions, sanitizePins, readPins, writePins, purchaseStatus, cycleSort, priceValue, select, countLabel};
});
