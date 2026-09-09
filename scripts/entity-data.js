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
    return { platforms, plans, models, planModels, platformBySlug, planBySlug, modelBySlug, relationsByPlanSlug };
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
          platformName: (platform && platform.name) || plan.platformSlug,
          supportedModels: models,
          modelLabels: models.map(model => model.name)
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
          planNote: plan.note || null,
          actionUrl: plan.action || null,
          rows
        };
      })
      .filter((group) => group.rows.length > 0);
  }

  function buildComparisonPoints(context, usdToCnyRate) {
    const points = [];
    for (const relation of context.planModels) {
      const plan = context.planBySlug.get(relation.planSlug);
      const model = context.modelBySlug.get(relation.modelSlug);
      if (!plan || !model) continue;
      const platform = context.platformBySlug.get(plan.platformSlug);
      if (!platform) continue;
      const usage = relation.usage || {};
      const unit = positiveNumber(usage.unitPriceCnyPerM);
      const windows = displayWindows(usage);
      const billingMode = plan.billingMode;
      const fee = positiveNumber(plan.comparisonMonthlyPrice ?? plan.monthlyPrice);
      const displayCurrency = plan.currency || '¥';
      const rate = currencyRate(displayCurrency, usdToCnyRate);
      const monthlyFeeCny = fee && rate ? Math.round(fee * rate * 1e6) / 1e6 : null;
      if (billingMode === 'payg' ? !unit : !((monthlyFeeCny && windows.monthly) || unit)) continue;
      points.push({
        slug: relation.slug,
        platformSlug: platform.slug,
        planSlug: plan.slug,
        modelSlug: model.slug,
        platformName: platform.name,
        planName: plan.comparisonName || plan.name,
        ...billingPresentation(model, relation),
        multimodal: model.multimodal,
        scores: comparisonScores(model.scores),
        billingMode,
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
