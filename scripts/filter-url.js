(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CodingPlanFilterUrl = api;
})(globalThis, function (root) {
  'use strict';
  const INVALID = Symbol('invalid');
  const field = (param, parse, format = String, fallback) => ({param, parse, format, fallback});
  const choice = (param, values, fallback) => field(param, value => values.includes(value) ? value : INVALID, String, fallback);
  const flag = param => field(param, value => value === '1' ? true : value === '0' ? false : INVALID, value => value ? '1' : '0', false);
  const text = param => field(param, value => value, String, '');
  function selection(param, items) {
    const valid = new Set(items.map(item => item.slug));
    return field(param, value => {
      if (value === 'all') return null;
      if (value === 'none') return [];
      const slugs = [...new Set(value.split(',').filter(slug => valid.has(slug)))];
      return slugs.length ? slugs : INVALID;
    }, value => value === null ? 'all' : value.length ? value.join(',') : 'none');
  }
  function range(param) {
    return field(param, value => {
      if (!/^([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)?,([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)?$/i.test(value)) return INVALID;
      const [min, max] = value.split(',').map(part => part === '' ? null : Number(part));
      return (min === null && max === null) || [min,max].some(n => n !== null && !Number.isFinite(n)) ||
        (min !== null && max !== null && min > max) ? INVALID : {min,max};
    }, value => `${value.min ?? ''},${value.max ?? ''}`, null);
  }
  function read(schema, search = root.location.search) {
    const params = new URLSearchParams(search), result = {};
    for (const [key, spec] of Object.entries(schema)) {
      if (!params.has(spec.param)) continue;
      const value = spec.parse(params.get(spec.param));
      if (value !== INVALID) result[key] = value;
    }
    return result;
  }
  function update(url, schema, values, remove = []) {
    const next = new URL(url);
    remove.forEach(key => next.searchParams.delete(key));
    for (const [key, spec] of Object.entries(schema)) {
      if (!Object.hasOwn(values, key)) continue;
      const value = values[key];
      if (value === undefined || JSON.stringify(value) === JSON.stringify(spec.fallback)) next.searchParams.delete(spec.param);
      else next.searchParams.set(spec.param, spec.format(value));
    }
    return next;
  }
  let timer = null, pending = null, currentSearch = root.location?.search;
  function flush() {
    root.clearTimeout(timer); timer = null;
    if (!pending) return;
    const next = pending; pending = null;
    next.hash = root.location.hash;
    if (next.href === root.location.href) return;
    try {
      root.history.replaceState(root.history.state, '', next.pathname + next.search + next.hash);
      currentSearch = next.search;
    }
    catch (_) { /* 筛选仍可使用；受限浏览器不阻断页面。 */ }
  }
  function replace(schema, values, options = {}) {
    const previous = pending?.href || root.location.href;
    const next = update(previous, schema, values, options.remove);
    if (next.href === previous) return;
    pending = next;
    if (options.delay) { root.clearTimeout(timer); timer = root.setTimeout(flush, 120); }
    else flush();
  }
  function clear(schema, remove = []) {
    replace(schema, Object.fromEntries(Object.keys(schema).map(key => [key, undefined])), {remove});
  }
  function sharedSchema(context, policy) {
    const schema = {
      snapshot: flag('filters'),
      modelSlugs: selection('models', context.models),
      modelMatch: choice('match', ['any','all'], 'any'),
      budgetCny: range('budget'), monthlyTokenRange: range('tokens'),
      apiOnly: flag('api'), harnessApiRequired: flag('harness'),
      preference: choice('order', ['balanced','cost','quality','variety'], 'balanced'),
      restricted: flag('restricted'), history: flag('history'),
      domestic: flag('domestic'), featuredOnly: flag('featured')
    };
    if (!policy.platformHub) schema.platformSlugs = selection('platforms', context.platforms);
    return schema;
  }
  // Flush trailing slider updates before reload, leaving the page, or copying a URL.
  if (root.addEventListener) {
    for (const event of ['pagehide','beforeunload','copy','pointerup','change']) root.addEventListener(event, flush, true);
    root.addEventListener('keydown', event => {
      if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && ['r','c','l'].includes(event.key.toLowerCase()))) flush();
    }, true);
    root.addEventListener('popstate', () => {
      if (root.location.search === currentSearch) return;
      // Anchor navigation can create same-document entries with older queries.
      // Re-enter the normal initialization path without adding a history entry.
      pending = null; root.clearTimeout(timer); timer = null;
      root.location.reload();
    });
  }
  return {choice, flag, text, selection, range, read, update, replace, clear, flush, sharedSchema};
});
