(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.EntityData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Model metadata owns modality facts; unknown never implies support.
  function isMultimodal(model) { return model?.multimodal === true; }

  function collection(documentValue, key, version = 1) {
    if (!documentValue || documentValue.schemaVersion !== version || !Array.isArray(documentValue[key])) {
      throw new Error(`${key}.json must contain schemaVersion=${version} and ${key}[]`);
    }
    return documentValue[key];
  }

  function billingPresentation(model, relation) {
    const modelName = model ? model.name : relation.modelSlug;
    const tierLabel = [relation.serviceTier, relation.contextTier, relation.timeTier]
      .filter(Boolean).map(tier => `[${tier}]`).join(' ');
    return { modelName, tierLabel, relationLabel: [modelName, tierLabel].filter(Boolean).join(' ') };
  }

  // A missing plan override inherits; false must never fall through to the platform.
  function resolveHarnessApi(platform, plan) {
    if (typeof plan?.supportsHarnessApi === 'boolean') return plan.supportsHarnessApi;
    return typeof platform?.supportsHarnessApi === 'boolean' ? platform.supportsHarnessApi : null;
  }

  function harnessApiBadge(value, options) {
    const partial = !!options?.partial;
    if (!partial && typeof value !== 'boolean') return '';
    const supported = partial || value === true;
    const label = supported ? '可接入第三方工具' : '不可接入第三方工具';
    const status = supported ? 'true' : 'false';
    return `<span class="harness-api-badge" data-harness-api="${status}" title="指通过 API Key 将模型接入第三方 AI 工具；具体工具及用途限制以平台说明为准">${label}</span>`;
  }

  function platformHarnessApiBadge(platform, plans) {
    const value = resolveHarnessApi(platform);
    const values = [value, ...(plans || []).filter(plan => plan.platformSlug === platform.slug && plan.planStatus !== 'delisted').map(plan => resolveHarnessApi(platform, plan))];
    const partial = values.includes(true) && values.some(value => value !== true);
    return harnessApiBadge(value, { partial });
  }

  // Inventory is a set of model identities, never a selection of billing rows.
  function supportedModels(context, plans) {
    const models = new Map();
    for (const plan of plans) {
      for (const relation of context.relationsByPlanSlug.get(plan.slug) || []) {
        const model = context.modelBySlug.get(relation.modelSlug);
        if (model && !models.has(model.slug)) models.set(model.slug, { slug: model.slug, name: model.name });
      }
    }
    return [...models.values()];
  }

  function platformModels(context, platformSlug) {
    // 平台卡片与平台模型筛选覆盖在售订阅和按量 API。
    return supportedModels(context, context.plans.filter(plan => plan.platformSlug === platformSlug && plan.planStatus !== 'delisted'));
  }

  function buildContext(platformDoc, planDoc, modelDoc) {
    const platforms = collection(platformDoc, 'platforms');
    const catalogue = collection(planDoc, 'plans', 3);
    const plans = [], planModels = [];
    for (const {planModels: relations, ...plan} of catalogue) {
      if (!Array.isArray(relations)) throw new Error(`plan ${plan.slug} must contain planModels[]`);
      plans.push(plan);
      for (const relation of relations) {
        if (Object.hasOwn(relation, 'planSlug')) throw new Error(`nested relation ${relation.slug} must not contain planSlug; inherit the parent plan`);
        planModels.push({...relation, planSlug: plan.slug});
      }
    }
    const models = collection(modelDoc, 'models');
    const platformBySlug = new Map(platforms.map((item) => [item.slug, item]));
    const planBySlug = new Map(plans.map((item) => [item.slug, item]));
    const modelBySlug = new Map(models.map((item) => [item.slug, item]));
    const relationsByPlanSlug = new Map();
    planModels.forEach((relation) => {
      if (!relationsByPlanSlug.has(relation.planSlug)) relationsByPlanSlug.set(relation.planSlug, []);
      relationsByPlanSlug.get(relation.planSlug).push(relation);
    });
    return { benchmarks: modelDoc.benchmarks || {}, workload: planDoc.workload, platforms, plans, models, planModels, platformBySlug, planBySlug, modelBySlug, relationsByPlanSlug };
  }

  function listPlatforms(context) {
    return context.platforms.slice();
  }

  function buildPlanCatalog(context) {
    return context.plans
      .map((plan) => {
        const platform = context.platformBySlug.get(plan.platformSlug);
        const models = supportedModels(context, [plan]);
        return {
          ...plan,
          supportsHarnessApi: resolveHarnessApi(platform, plan),
          platformName: (platform && platform.name) || plan.platformSlug,
          supportedModels: models,
          modelLabels: models.map(model => model.name),
          monthlyTokenOptions: (context.relationsByPlanSlug.get(plan.slug) || []).map(relation => ({
            modelSlug: relation.modelSlug,
            value: relation.usage && relation.usage.monthlyTokenInM
          }))
        };
      });
  }

  function currencyRate(currency, usdToCnyRate) {
    const normalized = String(currency || '').trim().toUpperCase();
    if (['¥', '￥', 'CNY', 'RMB'].includes(normalized)) return 1;
    if (['$', 'USD', 'US$'].includes(normalized)) return usdToCnyRate;
    return null;
  }

  function positiveNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }

  function comparisonScores(scores) {
    const output = {};
    for (const [benchmark, value] of Object.entries(scores || {})) {
      if (value === null) {
        output[benchmark] = null;
        continue;
      }
      if (typeof value !== 'object') continue;
      output[benchmark] = {};
      for (const key of ['score', 'scoreExact', 'configuration', 'confidenceInterval', 'confidenceIntervalExact', 'sourceUrl', 'publishedAt', 'confidenceLowerExact', 'confidenceUpperExact']) {
        if (value[key] !== undefined) output[benchmark][key] = value[key];
      }
    }
    return output;
  }

  function displayWindows(usage) {
    const monthly = positiveNumber(usage.monthlyTokenInM);
    const weekly = usage.weeklyTokenInM === 'unlimited' ? monthly : positiveNumber(usage.weeklyTokenInM);
    const fiveHours = usage.fiveHourTokenInM === 'unlimited' ? weekly : positiveNumber(usage.fiveHourTokenInM);
    return { fiveHours, weekly, monthly };
  }

  function buildApiPricingGroups(context, platformSlug) {
    return context.plans
      .filter((plan) => plan.billingMode === 'payg' && plan.platformSlug === platformSlug && plan.planStatus !== 'delisted')
      .map((plan) => {
        const rows = (context.relationsByPlanSlug.get(plan.slug) || [])
          .map((relation) => {
            const model = context.modelBySlug.get(relation.modelSlug);
            const pricing = relation.pricing || null;
            return {
              slug: relation.slug,
              modelSlug: relation.modelSlug,
              ...billingPresentation(model, relation),
              method: relation.method,
              currency: pricing && pricing.currency,
              inputPerM: pricing && pricing.inputPerM,
              ...(pricing && pricing.cacheWritePerM !== undefined ? {cacheWritePerM: pricing.cacheWritePerM} : {}),
              cachePerM: pricing && pricing.cachePerM,
              outputPerM: pricing && pricing.outputPerM,
              unitPriceCnyPerM: relation.usage && relation.usage.unitPriceCnyPerM,
              note: relation.note
            };
          });
        return {
          planSlug: plan.slug,
          planName: plan.name,
          supportsHarnessApi: resolveHarnessApi(context.platformBySlug.get(plan.platformSlug), plan),
          planNote: plan.note || null,
          actionUrl: plan.action || null,
          rows
        };
      })
      .filter((group) => group.rows.length > 0);
  }

  function displayPriceBasis() {
    return globalThis.CodingPlanDisplaySettings?.getPriceBasis?.() === 'monthly' ? 'monthly' : 'firstMonth';
  }

  function comparisonUnitPrice(value, plan, basis = 'monthly') {
    const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (basis !== 'firstMonth' || plan?.billingMode === 'payg' || !known(plan?.firstMonthPrice)) return value;
    if (!known(value) || !known(plan.monthlyPrice)) return null;
    if (plan.monthlyPrice > 0) return value * plan.firstMonthPrice / plan.monthlyPrice;
    return plan.firstMonthPrice === 0 ? value : null;
  }

  // Start from regular-price source points on every conversion; never compound
  // discounts or mutate quotas, budget prices, API quotes or entity records.
  function withComparisonPriceBasis(points, context, basis) {
    if (basis !== 'firstMonth') return points;
    return points.map(point => {
      const plan = context.planBySlug.get(point.planSlug);
      if (point.billingMode !== 'subscription' || typeof plan?.firstMonthPrice !== 'number' || !Number.isFinite(plan.firstMonthPrice) || plan.firstMonthPrice < 0) return point;
      return {...point, unitPriceCnyPerM:comparisonUnitPrice(point.unitPriceCnyPerM,plan,basis), unitPriceBasis:'firstMonth',firstMonthPrice:plan.firstMonthPrice};
    });
  }

  function buildComparisonPoints(context, usdToCnyRate, options) {
    const points = [];
    const displayNumber = value => options?.includeUnknown && value === 0 ? 0 : positiveNumber(value);
    for (const relation of context.planModels) {
      const plan = context.planBySlug.get(relation.planSlug);
      const model = context.modelBySlug.get(relation.modelSlug);
      if (!plan || !model) continue;
      const platform = context.platformBySlug.get(plan.platformSlug);
      if (!platform) continue;
      const usage = relation.usage || {};
      const unit = displayNumber(usage.unitPriceCnyPerM);
      const windows = displayWindows(usage);
      if (options?.includeUnknown) {
        if (usage.monthlyTokenInM === 0) windows.monthly = 0;
        if (usage.weeklyTokenInM === 0) windows.weekly = 0;
        if (usage.fiveHourTokenInM === 0) windows.fiveHours = 0;
      }
      const billingMode = plan.billingMode;
      const fee = displayNumber(plan.firstMonthPrice);
      const displayCurrency = plan.currency || '¥';
      const rate = currencyRate(displayCurrency, usdToCnyRate);
      const monthlyFeeCny = fee !== null && rate ? Math.round(fee * rate * 1e6) / 1e6 : null;
      if (!options?.includeUnknown && (billingMode === 'payg' ? !unit : !((monthlyFeeCny && windows.monthly) || unit))) continue;
      points.push({
        slug: relation.slug,
        platformSlug: platform.slug,
        planSlug: plan.slug,
        modelSlug: model.slug,
        platformName: platform.name,
        planName: plan.name,
        ...billingPresentation(model, relation),
        multimodal: model.multimodal,
        scores: comparisonScores(model.scores),
        tokenConsumptionRate: displayNumber(model.tokenConsumptionRate),
        ...(model.tokenConsumptionEstimated === true ? {tokenConsumptionEstimated: true} : {}),
        billingMode,
        supportsHarnessApi: resolveHarnessApi(platform, plan),
        planStatus: plan.planStatus,
        actionUrl: plan.action || platform.action || null,
        originalMonthlyFee: billingMode === 'subscription' ? fee : undefined,
        originalCurrency: billingMode === 'subscription'
          ? displayCurrency
          : (relation.pricing && relation.pricing.currency) || undefined,
        apiPricing: billingMode === 'payg' && relation.pricing
          ? {
              currency: relation.pricing.currency,
              inputPerM: relation.pricing.inputPerM,
              ...(relation.pricing.cacheWritePerM !== undefined ? {cacheWritePerM: relation.pricing.cacheWritePerM} : {}),
              cachePerM: relation.pricing.cachePerM,
              outputPerM: relation.pricing.outputPerM
            }
          : null,
        monthlyFeeCny: billingMode === 'subscription' ? monthlyFeeCny : undefined,
        ...(billingMode === 'subscription' ? {
          fiveHourTokenInM: windows.fiveHours,
          weeklyTokenInM: windows.weekly,
          monthlyTokenInM: windows.monthly
        } : {}),
        unitPriceCnyPerM: unit,
        note: relation.note
      });
    }
    return withComparisonPriceBasis(points, context, options?.priceBasis);
  }

  function catalogCounts(context) {
    return {
      platforms: context.platforms.filter(platform => platform.platformStatus !== 'delisted').length,
      plans: context.plans.filter(plan => plan.billingMode === 'subscription' && plan.planStatus !== 'delisted').length,
      models: context.models.length
    };
  }

  function headerSubtitle(context, subtitle) {
    const text = String(subtitle || '').replace(/^\d+\s*大平台\s*/, '');
    if (!context) return text;
    const counts = catalogCounts(context);
    return `${counts.platforms} 大平台 · ${counts.plans} 个在售套餐 · ${counts.models} 个模型<br>${text}`;
  }

  return {
    isMultimodal,
    resolveHarnessApi,
    harnessApiBadge,
    platformHarnessApiBadge,
    catalogCounts,
    headerSubtitle,
    collection,
    billingPresentation,
    supportedModels,
    platformModels,
    buildContext,
    listPlatforms,
    buildPlanCatalog,
    buildApiPricingGroups,
    buildComparisonPoints,
    displayPriceBasis,
    comparisonUnitPrice,
    withComparisonPriceBasis
  };
});
