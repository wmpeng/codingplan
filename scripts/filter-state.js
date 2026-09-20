(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CodingPlanFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    platformSlugs: ['zhipu', 'minimax', 'opencode', 'bytedance-ark', 'deepseek-official', 'codex'],
    modelSlugs: ['claude-fable-5-1', 'gpt-6-astra', 'glm-5-3', 'deepseek-v4-1-flash', 'kimi-k3', 'minimax-m3'],
    modelMatch: 'any',
    budgetCny: null,
    monthlyTokenRange: null,
    tokenUnit: 'yi',
    platformStatusMax: 'paused',
    platformTags: [],
    includeDiscontinued: false,
    priceRanges: {},
    requestRanges: {},
    multimodal: 'all',
    aaScoreMin: null,
    deepSWEScoreMin: null
  });

  const STATUS_RANK = { open: 0, limited: 1, paused: 2, delisted: 3 };

  function arrayOrNull(value) {
    if (value === null) return null;
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(item => String(item == null ? '' : item).trim()).filter(Boolean))];
  }

  function cloneRange(range) {
    if (!range || typeof range !== 'object') return null;
    const min = nullableNumber(range.min, null);
    const max = nullableNumber(range.max, null);
    if (min === null && max === null) return null;
    return { min, max };
  }

  function normalizeRangeMap(value) {
    const output = {};
    if (!value || typeof value !== 'object') return output;
    for (const [key, range] of Object.entries(value)) {
      const normalized = cloneRange(range);
      if (normalized) output[key] = normalized;
    }
    return output;
  }

  function nullableNumber(value, fallback) {
    if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function entitySelection(value) {
    const selection = arrayOrNull(value);
    return selection && selection.length ? selection : null;
  }

  function normalizeState(raw, options) {
    const input = raw || {};
    const opts = options || {};
    const base = opts.mode === 'full' ? {
      ...DEFAULTS,
      platformSlugs: null,
      modelSlugs: null,
      platformStatusMax: 'delisted',
      includeDiscontinued: true
    } : DEFAULTS;
    return {
      platformSlugs: entitySelection(input.platformSlugs === undefined ? base.platformSlugs : input.platformSlugs),
      modelSlugs: entitySelection(input.modelSlugs === undefined ? base.modelSlugs : input.modelSlugs),
      modelMatch: input.modelMatch === 'all' ? 'all' : 'any',
      monthlyTokenRange: cloneRange(input.monthlyTokenRange),
      tokenUnit: input.tokenUnit === 'M' ? 'M' : 'yi',
      budgetCny: cloneRange(input.budgetCny === undefined ? base.budgetCny : input.budgetCny),
      platformStatusMax: STATUS_RANK[input.platformStatusMax] === undefined ? base.platformStatusMax : input.platformStatusMax,
      platformTags: arrayOrNull(input.platformTags) || [],
      includeDiscontinued: input.includeDiscontinued === undefined ? base.includeDiscontinued : input.includeDiscontinued === true,
      priceRanges: normalizeRangeMap(input.priceRanges === undefined ? base.priceRanges : input.priceRanges),
      requestRanges: normalizeRangeMap(input.requestRanges === undefined ? base.requestRanges : input.requestRanges),
      multimodal: ['all', 'multimodal', 'text'].includes(input.multimodal) ? input.multimodal : 'all',
      aaScoreMin: nullableNumber(input.aaScoreMin, base.aaScoreMin),
      deepSWEScoreMin: nullableNumber(input.deepSWEScoreMin, base.deepSWEScoreMin)
    };
  }

  function cloneState(state) {
    return normalizeState(JSON.parse(JSON.stringify(state || {})));
  }

  function readDefaults(config) {
    const configured = config && config.homepageFilters && config.homepageFilters.defaults;
    return normalizeState(configured || DEFAULTS);
  }

  function createDefaultState(config, options) {
    const mode = options && options.mode;
    if (mode === 'full') return normalizeState({}, { mode: 'full' });
    return readDefaults(config);
  }

  function toCny(value, currency, rate) {
    const number = nullableNumber(value, null);
    if (number === null) return null;
    const normalized = String(currency || '¥').trim().toUpperCase();
    if (['¥', '￥', 'CNY', 'RMB'].includes(normalized)) return number;
    if (['$', 'USD', 'US$'].includes(normalized)) {
      const factor = Number(rate);
      return Number.isFinite(factor) && factor > 0 ? number * factor : null;
    }
    return null;
  }

  function inRange(value, range) {
    if (!range) return true;
    const number = nullableNumber(value, null);
    if (number === null) return false;
    if (range.min !== null && number < range.min) return false;
    if (range.max !== null && number > range.max) return false;
    return true;
  }

  function selectedMatch(value, selected) {
    if (selected === null || !selected.length) return true;
    return selected.includes(String(value || ''));
  }

  function modelMatch(models, selected, mode) {
    if (selected === null || !selected.length) return true;
    const available = new Set((models || []).map(model => typeof model === 'string' ? model : model.slug));
    return mode === 'all'
      ? selected.every(slug => available.has(slug))
      : selected.some(slug => available.has(slug));
  }

  // Store Token ranges in M; unit changes never alter the underlying requirement.
  function tokenInRange(value, range) {
    if (!range) return true;
    if (value === 'unlimited') return range.max === null;
    return inRange(value, range);
  }

  function monthlyOptions(plan, state, context) {
    const rows = plan.monthlyTokenOptions || ((context && context.relationsByPlanSlug && context.relationsByPlanSlug.get(plan.slug)) || [])
      .map(row => ({ modelSlug: row.modelSlug, value: row.usage && row.usage.monthlyTokenInM }));
    return rows.filter(row => selectedMatch(row.modelSlug, state.modelSlugs));
  }

  function monthlyPlanMatches(plan, state, context) {
    if (!state.monthlyTokenRange) return true;
    const rows = monthlyOptions(plan, state, context);
    const matches = row => tokenInRange(row.value, state.monthlyTokenRange);
    return state.modelMatch === 'all' && state.modelSlugs
      ? state.modelSlugs.every(slug => rows.some(row => row.modelSlug === slug && matches(row)))
      : rows.some(matches);
  }

  function formatMonthlyTokens(plan, state) {
    const rows = monthlyOptions(plan, state);
    const values = rows.map(row => row.value).filter(value => typeof value === 'number' && Number.isFinite(value));
    const unlimited = rows.some(row => row.value === 'unlimited');
    if (!values.length && !unlimited) return '未知';
    const factor = state.tokenUnit === 'M' ? 1 : 100;
    const unit = state.tokenUnit === 'M' ? 'M' : '亿';
    const format = value => (value / factor).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
    const min = Math.min(...values), max = Math.max(...values);
    const text = values.length ? `${format(min)}${unlimited ? '–无限制' : min === max ? '' : '–' + format(max)} ${unit}` : '无限制';
    return text + (values.length + rows.filter(row => row.value === 'unlimited').length < rows.length ? '（部分未知）' : '');
  }

  function filterPlans(plans, state, options) {
    const current = normalizeState(state);
    const opts = options || {};
    const rate = opts.usdToCnyRate;
    return (plans || []).filter(plan => {
      if (plan.planTableVisible === false) return false;
      if (!current.includeDiscontinued && plan.discontinued) return false;
      if (!selectedMatch(plan.platformSlug, current.platformSlugs)) return false;
      if (!modelMatch(plan.supportedModels || plan.modelSlugs, current.modelSlugs, current.modelMatch)) return false;
      const platform = opts.context && opts.context.platformBySlug
        ? opts.context.platformBySlug.get(plan.platformSlug)
        : null;
      if (platform && STATUS_RANK[platform.platformStatus || 'open'] > STATUS_RANK[current.platformStatusMax]) return false;
      if (current.platformTags.length && (!platform || !current.platformTags.every(tag => platformTagMatches(platform, tag, opts.platformCatalog || {})))) return false;
      if (!monthlyPlanMatches(plan, current, opts.context)) return false;
      const monthly = toCny(plan.monthlyPrice, plan.currency, rate);
      if (!inRange(monthly, current.budgetCny)) return false;
      for (const [key, range] of Object.entries(current.priceRanges)) {
        if (!inRange(toCny(plan[key], plan.currency, rate), range)) return false;
      }
      for (const [key, range] of Object.entries(current.requestRanges)) {
        if (plan[key] === '无限制' || plan[key] === 'unlimited') {
          if (range.max !== null) return false;
          continue;
        }
        if (!inRange(plan[key], range)) return false;
      }
      return true;
    });
  }

  function platformTagMatches(platform, label, config) {
    if (Array.isArray(platform.tags) && platform.tags.includes(label)) return true;
    const derived = (config && config.derivedTags) || [];
    const entry = derived.find(item => item && item.label === label);
    if (!entry || !entry.rule) return false;
    const dimension = platform.dimensions && platform.dimensions[entry.rule.dimension];
    return dimension && typeof dimension.score === 'number' && dimension.score >= entry.rule.minScore;
  }

  function filterPlatforms(platforms, state, options) {
    const current = normalizeState(state);
    const opts = options || {};
    const config = opts.platformCatalog || {};
    return (platforms || []).filter(platform => {
      if (platform.catalogVisible === false) return false;
      if (!selectedMatch(platform.slug, current.platformSlugs)) return false;
      if (STATUS_RANK[platform.platformStatus || 'open'] > STATUS_RANK[current.platformStatusMax]) return false;
      if (current.platformTags.length && !current.platformTags.every(tag => platformTagMatches(platform, tag, config))) return false;
      if (opts.context && opts.entityData && current.modelSlugs !== null) {
        const models = typeof opts.entityData.platformModels === 'function'
          ? opts.entityData.platformModels(opts.context, platform.slug)
          : [];
        if (!modelMatch(models, current.modelSlugs, current.modelMatch)) return false;
      }
      return true;
    });
  }

  function scoreAtLeast(point, key, minimum) {
    if (minimum === null) return true;
    const score = point && point.scores && point.scores[key];
    const exact = nullableNumber(score && (score.scoreExact === undefined ? score.score : score.scoreExact), null);
    return exact !== null && exact >= minimum;
  }

  function filterPoints(points, state, options) {
    const current = normalizeState(state);
    const opts = options || {};
    const rate = opts.usdToCnyRate;
    const modelGroups = new Map();
    if (current.modelSlugs !== null && current.modelMatch === 'all') {
      (points || []).forEach(point => {
        if (point.platformVisible === false || (point.planTableVisible === false && point.billingMode !== 'payg')) return;
        if (!current.includeDiscontinued && point.discontinued) return;
        if (current.monthlyTokenRange && (point.billingMode !== 'subscription' || !tokenInRange(point.monthlyTokenInM, current.monthlyTokenRange))) return;
        const key = `${point.platformSlug || ''}::${point.billingMode || ''}::${point.planSlug || ''}`;
        if (!modelGroups.has(key)) modelGroups.set(key, new Set());
        modelGroups.get(key).add(point.modelSlug);
      });
    }
    return (points || []).filter(point => {
      if (point.platformVisible === false) return false;
      if (point.planTableVisible === false && point.billingMode !== 'payg') return false;
      if (!current.includeDiscontinued && point.discontinued) return false;
      if (!selectedMatch(point.platformSlug, current.platformSlugs)) return false;
      if (!selectedMatch(point.modelSlug, current.modelSlugs)) return false;
      if (current.monthlyTokenRange && (point.billingMode !== 'subscription' || !tokenInRange(point.monthlyTokenInM, current.monthlyTokenRange))) return false;
      if (current.modelMatch === 'all' && current.modelSlugs !== null) {
        const key = `${point.platformSlug || ''}::${point.billingMode || ''}::${point.planSlug || ''}`;
        const available = modelGroups.get(key) || new Set();
        if (!current.modelSlugs.length || !current.modelSlugs.every(slug => available.has(slug))) return false;
      }
      if (current.multimodal === 'multimodal' && point.multimodal !== true) return false;
      if (current.multimodal === 'text' && point.multimodal !== false) return false;
      if (!scoreAtLeast(point, 'artificialAnalysis', current.aaScoreMin)) return false;
      if (!scoreAtLeast(point, 'deepSWE', current.deepSWEScoreMin)) return false;
      const monthly = point.monthlyFeeCny === undefined
        ? toCny(point.originalMonthlyFee, point.originalCurrency, rate)
        : point.monthlyFeeCny;
      if (point.billingMode === 'subscription' && !inRange(monthly, current.budgetCny)) return false;
      if (point.billingMode === 'subscription') {
        for (const [key, range] of Object.entries(current.priceRanges)) {
          if (key === 'monthlyPrice' && !inRange(monthly, range)) return false;
          if (key !== 'monthlyPrice') {
            const plan = opts.context && opts.context.planBySlug && opts.context.planBySlug.get(point.planSlug);
            if (!plan || !inRange(toCny(plan[key], plan.currency, rate), range)) return false;
          }
        }
      }
      return true;
    });
  }

  function validateDefaults(raw, context) {
    const state = normalizeState(raw);
    const errors = [];
    const check = (name, values, map, hiddenCheck) => {
      if (values === null) return;
      for (const value of values) {
        if (!map.has(value)) errors.push(`${name} 不存在: ${value}`);
        else if (hiddenCheck && hiddenCheck(map.get(value))) errors.push(`${name} 不可见: ${value}`);
      }
    };
    if (!context) return { ok: true, errors, state };
    check('平台', state.platformSlugs, context.platformBySlug || new Map(), item => item.catalogVisible === false);
    check('模型', state.modelSlugs, context.modelBySlug || new Map(), item => item.catalogVisible === false);
    return { ok: errors.length === 0, errors, state };
  }

  function selectionLabel(selected, all, label) {
    if (selected === null) return `${label}不限`;
    if (!selected.length) return `${label}不限`;
    if (all && selected.length === all.length) return `${label}全部`;
    return `${label}${selected.length}项`;
  }

  return {
    DEFAULTS,
    STATUS_RANK,
    arrayOrNull,
    normalizeState,
    cloneState,
    readDefaults,
    createDefaultState,
    toCny,
    inRange,
    modelMatch,
    formatMonthlyTokens,
    tokenInRange,
    filterPlans,
    filterPlatforms,
    filterPoints,
    validateDefaults,
    selectionLabel
  };
});
