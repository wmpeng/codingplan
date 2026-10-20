(function (root, factory) {
  const api = factory(root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null), root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CodingPlanFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (EntityData, Numbers) {
  'use strict';

  const DEFAULTS = Object.freeze({
    platformSlugs: null,
    modelSlugs: null,
    modelMatch: 'any',
    budgetCny: null,
    apiOnly: false,
    harnessApiRequired: false,
    monthlyTokenRange: null,
    tokenUnit: 'yi',
    platformStatusMax: 'restricted',
    excludedPlatformStatuses: [],
    excludedPlanStatuses: [],
    planStatusOnly: false,
    includeDiscontinued: false,
    priceRanges: {},
    requestRanges: {},
    multimodal: 'all',
    aaScoreMin: null,
    deepSWEScoreMin: null
  });

  const STATUS_RANK = { open: 0, restricted: 1, delisted: 2 };
  // Keep existing in-session filters usable after the two middle states merge.
  const normalizeStatus = status => status === 'limited' || status === 'paused' ? 'restricted' : status;

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

  function normalizeRangeMap(value, allowedKeys) {
    const output = {};
    if (!value || typeof value !== 'object') return output;
    for (const [key, range] of Object.entries(value)) {
      if (allowedKeys && !allowedKeys.includes(key)) continue;
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
    const platformStatusMax = normalizeStatus(input.platformStatusMax);
    return {
      platformSlugs: entitySelection(input.platformSlugs === undefined ? base.platformSlugs : input.platformSlugs),
      // Empty model picks mean unrestricted, while preserving the cleared checklist.
      modelSlugs: arrayOrNull(input.modelSlugs === undefined ? base.modelSlugs : input.modelSlugs),
      modelMatch: input.modelMatch === 'all' ? 'all' : 'any',
      apiOnly: input.apiOnly === true,
      harnessApiRequired: input.harnessApiRequired === true,
      modelGroup: ['sota-models', 'high-volume-models'].includes(input.modelGroup) ? input.modelGroup : 'any',
      imageRequired: input.imageRequired === true,
      domesticNetworkOnly: input.domesticNetworkOnly === true,
      domesticPaymentOnly: input.domesticPaymentOnly === true,
      preference: ['cost', 'quality', 'variety'].includes(input.preference) ? input.preference : 'balanced',
      monthlyTokenRange: cloneRange(input.monthlyTokenRange),
      tokenUnit: ['M','B'].includes(input.tokenUnit) ? input.tokenUnit : 'yi',
      budgetCny: cloneRange(input.budgetCny === undefined ? base.budgetCny : input.budgetCny),
      platformStatusMax: STATUS_RANK[platformStatusMax] === undefined ? base.platformStatusMax : platformStatusMax,
      excludedPlatformStatuses: [...new Set((arrayOrNull(input.excludedPlatformStatuses) || []).map(normalizeStatus).filter(status => status === 'restricted'))],
      excludedPlanStatuses: [...new Set((arrayOrNull(input.excludedPlanStatuses) || []).map(normalizeStatus).filter(status => status === 'restricted'))],
      planStatusOnly: input.planStatusOnly === true,
      includeDiscontinued: input.includeDiscontinued === undefined ? base.includeDiscontinued : input.includeDiscontinued === true,
      priceRanges: normalizeRangeMap(input.priceRanges === undefined ? base.priceRanges : input.priceRanges),
      requestRanges: normalizeRangeMap(input.requestRanges === undefined ? base.requestRanges : input.requestRanges, ['fiveHours','weekly','monthly']),
      multimodal: ['all', 'multimodal', 'text'].includes(input.multimodal) ? input.multimodal : 'all',
      aaScoreMin: nullableNumber(input.aaScoreMin, base.aaScoreMin),
      deepSWEScoreMin: nullableNumber(input.deepSWEScoreMin, base.deepSWEScoreMin)
    };
  }

  function cloneState(state) {
    return normalizeState(JSON.parse(JSON.stringify(state || {})));
  }

  // Controls distinguish a cleared checklist from select-all. Published business
  // state keeps its existing normalization: either platform selection is unrestricted.
  function cloneControlState(state) {
    const copy = normalizeState(state);
    if (Array.isArray(state?.platformSlugs) && !state.platformSlugs.length) copy.platformSlugs = [];
    return copy;
  }

  function readDefaults(config) {
    const configured = config && config.homepageFilters && config.homepageFilters.defaults;
    return normalizeState(configured || DEFAULTS);
  }

  function createDefaultState(config, options) {
    const mode = options && options.mode;
    if (mode === 'full') return normalizeState({}, { mode: 'full' });
    const state = readDefaults(config);
    const preset = options && options.featuredPreset;
    if (preset) {
      state.platformSlugs = arrayOrNull(preset.platformSlugs);
      state.modelSlugs = arrayOrNull((preset.groups || []).flatMap(group => group.modelSlugs || []));
    }
    return state;
  }

  // One policy owns page defaults and the constraints reapplied after every edit.
  // constrain mutates the caller-owned control state; it does not change eligibility.
  function createViewPolicy(options = {}) {
    const full = options.mode === 'full';
    const pricing = full && options.view === 'pricing';
    const plansPage = full && options.view === 'plans';
    const platformHub = full && options.view === 'platforms';
    const monitor = full && options.view === 'monitor';
    const planStatusOnly = plansPage || pricing;
    const purchaseTool = full && !monitor;
    function constrain(state) {
      state.planStatusOnly = planStatusOnly;
      if (planStatusOnly) {
        state.platformStatusMax = 'delisted';
        state.excludedPlatformStatuses = [];
      } else state.excludedPlanStatuses = [];
      state.imageRequired = false;
      if (plansPage) state.apiOnly = false;
      else state.harnessApiRequired = false;
      if (platformHub) {
        state.platformSlugs = null;
        state.includeDiscontinued = false;
        state.domesticNetworkOnly = state.domesticPaymentOnly = state.domesticNetworkOnly || state.domesticPaymentOnly;
      } else {
        state.domesticNetworkOnly = false;
        state.domesticPaymentOnly = false;
      }
      if (!full) {
        state.includeDiscontinued = false;
        state.platformStatusMax = 'restricted';
      }
      return state;
    }
    function createDefaults(config, tokenUnit = 'yi') {
      const state = createDefaultState(config, {mode:full ? 'full' : 'home'});
      state.platformSlugs = plansPage ? [] : null;
      state.modelSlugs = platformHub || plansPage ? [] : null;
      state.tokenUnit = tokenUnit;
      state.modelGroup = 'any';
      state.modelMatch = 'any';
      if (purchaseTool) {
        state.platformStatusMax = 'restricted';
        state.includeDiscontinued = false;
      }
      return constrain(state);
    }
    return {full, pricing, plansPage, platformHub, monitor, planStatusOnly, purchaseTool, createDefaults, constrain};
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

  // Browsing a catalog with every model selected must not require model details.
  // Explicit "all models in one plan" matching remains a real requirement.
  function catalogModelSelection(selected, match, models) {
    if (match === 'all' || !selected?.length || !models?.length) return selected;
    const slugs = new Set(selected);
    return models.every(model => slugs.has(model.slug)) ? null : selected;
  }

  function platformStatusMatches(platform, state) {
    const status = platform.platformStatus || 'open';
    return (STATUS_RANK[status] || 0) <= STATUS_RANK[state.platformStatusMax]
      && !state.excludedPlatformStatuses.includes(status);
  }

  function planStatusMatches(plan, state) {
    const status = plan.planStatus || 'open';
    return (state.includeDiscontinued || status !== 'delisted')
      && (!state.planStatusOnly || !state.excludedPlanStatuses.includes(status));
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
    return state.modelMatch === 'all' && state.modelSlugs?.length
      ? state.modelSlugs.every(slug => rows.some(row => row.modelSlug === slug && matches(row)))
      : rows.some(matches);
  }

  function formatMonthlyTokens(plan, state) {
    const rows = monthlyOptions(plan, state);
    const values = rows.map(row => row.value).filter(value => typeof value === 'number' && Number.isFinite(value));
    const unlimited = rows.some(row => row.value === 'unlimited');
    if (!values.length && !unlimited) return '未知';
    const unit = Numbers.tokenUnit(state.tokenUnit);
    const format = value => Numbers.tokenAmount(value, state.tokenUnit);
    const min = Math.min(...values), max = Math.max(...values);
    const text = values.length ? `${format(min)}${unlimited ? '–无限制' : min === max ? '' : '–' + format(max)} ${unit}` : '无限制';
    return text + (values.length + rows.filter(row => row.value === 'unlimited').length < rows.length ? '（部分未知）' : '');
  }

  function filterPlans(plans, state, options) {
    const current = normalizeState(state);
    const opts = options || {};
    const rate = opts.usdToCnyRate;
    if (current.planStatusOnly) current.modelSlugs = catalogModelSelection(current.modelSlugs, current.modelMatch, opts.context?.models);
    const requiresModelRows = !!(current.modelSlugs?.length || current.monthlyTokenRange
      || current.modelGroup !== 'any' || current.imageRequired || current.multimodal !== 'all'
      || current.aaScoreMin !== null || current.deepSWEScoreMin !== null);
    // Catalog browsing and plan-level conditions do not require model details.
    if (opts.context && Array.isArray(opts.context.plans) && (!current.planStatusOnly || requiresModelRows)) {
      const ids = new Set(matchingOffers(opts.context, current, opts).map(offer => offer.plan.slug));
      return (plans || []).filter(plan => ids.has(plan.slug));
    }
    return (plans || []).filter(plan => {
      if (current.apiOnly && plan.billingMode !== 'payg') return false;
      if (!planStatusMatches(plan, current)) return false;
      if (!selectedMatch(plan.platformSlug, current.platformSlugs)) return false;
      if (!modelMatch(plan.supportedModels || plan.modelSlugs, current.modelSlugs, current.modelMatch)) return false;
      const platform = opts.context && opts.context.platformBySlug
        ? opts.context.platformBySlug.get(plan.platformSlug)
        : null;
      if (!current.planStatusOnly && platform && !platformStatusMatches(platform, current)) return false;
      if (current.harnessApiRequired && EntityData.resolveHarnessApi(platform, plan) !== true) return false;
      if (!monthlyPlanMatches(plan, current, opts.context)) return false;
      const monthly = toCny(plan.monthlyPrice, plan.currency, rate);
      if (!inRange(monthly, current.budgetCny)) return false;
      for (const [key, range] of Object.entries(current.priceRanges)) {
        if (!inRange(toCny(plan[key], plan.currency, rate), range)) return false;
      }
      for (const [key, range] of Object.entries(current.requestRanges)) {
        const quota = plan.requestQuota?.[key];
        if (quota === 'unlimited') {
          if (range.max !== null) return false;
          continue;
        }
        if (!inRange(quota, range)) return false;
      }
      return true;
    });
  }

  function filterPlatforms(platforms, state, options) {
    const current = normalizeState(state);
    const opts = options || {};
    // Platform browsing can match catalog facts without requiring a live offer.
    if (opts.requireMatchingOffer !== false && opts.context && Array.isArray(opts.context.plans)) {
      const ids = new Set(matchingOffers(opts.context, current, opts).map(offer => offer.platform.slug));
      return (platforms || []).filter(platform => ids.has(platform.slug));
    }
    return (platforms || []).filter(platform => {
      if (!selectedMatch(platform.slug, current.platformSlugs)) return false;
      if (!platformStatusMatches(platform, current)) return false;
      if (current.domesticNetworkOnly && platform.requiresOverseasNetwork !== false) return false;
      if (current.domesticPaymentOnly && platform.requiresOverseasPayment !== false) return false;
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
    if (opts.context && Array.isArray(opts.context.plans)) {
      const ids = new Set(matchingOffers(opts.context, current, opts).flatMap(offer => offer.rows.map(row => row.slug)));
      return (points || []).filter(point => ids.has(point.slug));
    }
    const modelGroups = new Map();
    if (current.modelSlugs?.length && current.modelMatch === 'all') {
      (points || []).forEach(point => {
        if (!planStatusMatches(point, current)) return;
        if (current.monthlyTokenRange && point.billingMode !== 'payg' && !tokenInRange(point.monthlyTokenInM, current.monthlyTokenRange)) return;
        const key = `${point.platformSlug || ''}::${point.billingMode || ''}::${point.planSlug || ''}`;
        if (!modelGroups.has(key)) modelGroups.set(key, new Set());
        modelGroups.get(key).add(point.modelSlug);
      });
    }
    return (points || []).filter(point => {
      if (current.apiOnly && point.billingMode !== 'payg') return false;
      if (current.harnessApiRequired && point.supportsHarnessApi !== true) return false;
      if (!planStatusMatches(point, current)) return false;
      if (!selectedMatch(point.platformSlug, current.platformSlugs)) return false;
      const platform = opts.context?.platformBySlug?.get(point.platformSlug) || point;
      if (!current.planStatusOnly && !platformStatusMatches(platform, current)) return false;
      if (!selectedMatch(point.modelSlug, current.modelSlugs)) return false;
      if (current.monthlyTokenRange && point.billingMode !== 'payg' && !tokenInRange(point.monthlyTokenInM, current.monthlyTokenRange)) return false;
      if (point.billingMode === 'payg' && current.monthlyTokenRange && current.budgetCny && !inRange(apiCost(point, current), current.budgetCny)) return false;
      if (current.modelMatch === 'all' && current.modelSlugs?.length) {
        const key = `${point.platformSlug || ''}::${point.billingMode || ''}::${point.planSlug || ''}`;
        const available = modelGroups.get(key) || new Set();
        if (!current.modelSlugs.length || !current.modelSlugs.every(slug => available.has(slug))) return false;
      }
      if ((current.imageRequired || current.multimodal === 'multimodal') && !EntityData.isMultimodal(point)) return false;
      if (current.multimodal === 'text' && point.multimodal !== false) return false;
      if (!scoreAtLeast(point, 'artificialAnalysis', current.aaScoreMin)) return false;
      if (!scoreAtLeast(point, 'deepSWE', current.deepSWEScoreMin)) return false;
      const monthly = point.monthlyFeeCny === undefined
        ? toCny(point.originalMonthlyFee, point.originalCurrency, rate)
        : point.monthlyFeeCny;
      if (point.billingMode === 'subscription' && !inRange(monthly, current.budgetCny)) return false;
      if (point.billingMode === 'subscription') {
        for (const [key, range] of Object.entries(current.priceRanges)) {
          const plan = opts.context?.planBySlug?.get(point.planSlug);
          if (!plan || !inRange(toCny(plan[key], plan.currency, rate), range)) return false;
        }
      }
      return true;
    });
  }

  function targetTokens(state) {
    const range = state.monthlyTokenRange;
    return range ? (range.min == null ? range.max : range.min) : null;
  }

  function apiCost(row, state) {
    const amount = targetTokens(state);
    const unit = nullableNumber(row.usage ? row.usage.unitPriceCnyPerM : row.unitPriceCnyPerM, null);
    return amount === null || unit === null ? null : amount * unit;
  }

  // All eligibility conditions are evaluated on the same plan and model relation.
  function matchingOffers(context, state, options) {
    const s = normalizeState(state), opts = options || {};
    const selectedGroup = (context.modelGroups || []).find(group => group.id === s.modelGroup);
    const offers = [];
    for (const plan of context.plans) {
      const platform = context.platformBySlug.get(plan.platformSlug);
      if (!platform) continue;
      if (!planStatusMatches(plan, s)) continue;
      if (!selectedMatch(platform.slug, s.platformSlugs)) continue;
      if (!s.planStatusOnly && !platformStatusMatches(platform, s)) continue;
      if (s.domesticNetworkOnly && platform.requiresOverseasNetwork !== false) continue;
      if (s.domesticPaymentOnly && platform.requiresOverseasPayment !== false) continue;
      const supportsHarnessApi = EntityData.resolveHarnessApi(platform, plan);
      if (s.harnessApiRequired && supportsHarnessApi !== true) continue;
      if (s.apiOnly && plan.billingMode !== 'payg') continue;
      const monthlyCost = toCny(plan.monthlyPrice, plan.currency, opts.usdToCnyRate);
      if (plan.billingMode !== 'payg' && !inRange(monthlyCost, s.budgetCny)) continue;
      if (plan.billingMode !== 'payg' && Object.entries(s.priceRanges).some(([key, range]) => !inRange(toCny(plan[key], plan.currency, opts.usdToCnyRate), range))) continue;
      if (Object.entries(s.requestRanges).some(([key, range]) => !tokenInRange(plan.requestQuota?.[key], range))) continue;
      const rows = (context.relationsByPlanSlug.get(plan.slug) || []).filter(row => {
        const model = context.modelBySlug.get(row.modelSlug);
        if (!model || !selectedMatch(model.slug, s.modelSlugs)) return false;
        if (s.modelGroup !== 'any' && (!selectedGroup || !selectedGroup.modelSlugs.includes(model.slug))) return false;
        if ((s.imageRequired || s.multimodal === 'multimodal') && !EntityData.isMultimodal(model)) return false;
        if (s.multimodal === 'text' && model.multimodal !== false) return false;
        if (!scoreAtLeast(model, 'artificialAnalysis', s.aaScoreMin) || !scoreAtLeast(model, 'deepSWE', s.deepSWEScoreMin)) return false;
        if (plan.billingMode === 'payg') return !(s.monthlyTokenRange && s.budgetCny) || inRange(apiCost(row, s), s.budgetCny);
        return !s.monthlyTokenRange || tokenInRange(row.usage && row.usage.monthlyTokenInM, s.monthlyTokenRange);
      });
      if (!rows.length || (s.modelMatch === 'all' && s.modelSlugs?.length && !s.modelSlugs.every(slug => rows.some(row => row.modelSlug === slug)))) continue;
      offers.push({ plan, platform, rows, monthlyCost, supportsHarnessApi });
    }
    return offers;
  }

  function validateDefaults(raw, context) {
    const state = normalizeState(raw);
    const errors = [];
    const check = (name, values, map) => {
      if (values === null) return;
      for (const value of values) {
        if (!map.has(value)) errors.push(`${name} 不存在: ${value}`);
      }
    };
    if (!context) return { ok: true, errors, state };
    check('平台', state.platformSlugs, context.platformBySlug || new Map());
    check('模型', state.modelSlugs, context.modelBySlug || new Map());
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
    cloneControlState,
    readDefaults,
    createDefaultState,
    createViewPolicy,
    catalogModelSelection,
    toCny,
    inRange,
    modelMatch,
    formatMonthlyTokens,
    tokenInRange,
    filterPlans,
    filterPlatforms,
    filterPoints,
    matchingOffers,
    targetTokens,
    apiCost,
    validateDefaults,
    selectionLabel
  };
});
