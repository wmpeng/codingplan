(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.EntityData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function collection(documentValue, key) {
    if (!documentValue || documentValue.schemaVersion !== 1 || !Array.isArray(documentValue[key])) {
      throw new Error(`${key}.json must contain schemaVersion=1 and ${key}[]`);
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
    const label = partial ? '部分套餐支持 Harness API' : value === true ? '支持 Harness API' : value === false ? '不支持 Harness API' : 'Harness API 待确认';
    const status = partial ? 'partial' : value === true ? 'true' : value === false ? 'false' : 'unknown';
    return `<span class="harness-api-badge" data-harness-api="${status}" title="个人 Harness 的模型接口接入；具体工具及用途限制以平台说明为准">${label}</span>`;
  }

  function platformHarnessApiBadge(platform, plans) {
    const value = resolveHarnessApi(platform);
    const values = [value, ...(plans || []).filter(plan => plan.platformSlug === platform.slug && !plan.discontinued).map(plan => resolveHarnessApi(platform, plan))];
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
    // 平台卡片与平台模型筛选也要覆盖按量 API；planTableVisible 只控制套餐表展示。
    return supportedModels(context, context.plans.filter(plan => plan.platformSlug === platformSlug && !plan.discontinued));
  }

  function buildContext(platformDoc, planDoc, modelDoc, planModelDoc) {
    const platforms = collection(platformDoc, 'platforms');
    const plans = collection(planDoc, 'plans');
    const models = collection(modelDoc, 'models');
    const planModels = collection(planModelDoc, 'planModels');
    const platformBySlug = new Map(platforms.map((item) => [item.slug, item]));
    const planBySlug = new Map(plans.map((item) => [item.slug, item]));
    const modelBySlug = new Map(models.map((item) => [item.slug, item]));
    const relationsByPlanSlug = new Map();
    planModels.forEach((relation) => {
      if (!relationsByPlanSlug.has(relation.planSlug)) relationsByPlanSlug.set(relation.planSlug, []);
      relationsByPlanSlug.get(relation.planSlug).push(relation);
    });
    return { workload: planModelDoc.workload, platforms, plans, models, planModels, platformBySlug, planBySlug, modelBySlug, relationsByPlanSlug };
  }

  function listPlatforms(context, options) {
    const includeHidden = !!(options && options.includeHidden);
    return context.platforms
      .filter((platform) => includeHidden || platform.catalogVisible !== false);
  }

  function buildPlanCatalog(context, options) {
    const includeHidden = !!(options && options.includeHidden);
    return context.plans
      .filter((plan) => includeHidden || (plan.planTableVisible !== false && plan.billingMode !== 'payg'))
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
      for (const key of ['score', 'scoreExact', 'configuration', 'confidenceInterval', 'confidenceIntervalExact']) {
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
      .filter((plan) => plan.billingMode === 'payg' && plan.platformSlug === platformSlug && !plan.discontinued)
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
      const fee = displayNumber(plan.comparisonMonthlyPrice ?? plan.monthlyPrice);
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
        platformVisible: platform.catalogVisible !== false,
        planName: plan.comparisonName || plan.name,
        ...billingPresentation(model, relation),
        multimodal: model.multimodal,
        scores: comparisonScores(model.scores),
        billingMode,
        supportsHarnessApi: resolveHarnessApi(platform, plan),
        discontinued: !!plan.discontinued,
        planTableVisible: plan.planTableVisible !== false,
        actionUrl: plan.action || platform.action || null,
        originalMonthlyFee: billingMode === 'subscription' ? fee : undefined,
        originalCurrency: billingMode === 'subscription'
          ? displayCurrency
          : (relation.pricing && relation.pricing.currency) || undefined,
        apiPricing: billingMode === 'payg' && relation.pricing
          ? {
              currency: relation.pricing.currency,
              inputPerM: relation.pricing.inputPerM,
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
    return points;
  }

  function catalogCounts(context) {
    return {
      platforms: listPlatforms(context).length,
      plans: buildPlanCatalog(context).filter(plan => !plan.discontinued).length,
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
    buildComparisonPoints
  };
});
