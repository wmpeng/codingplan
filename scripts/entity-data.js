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

  function displayModelName(model, relation) {
    let name = model ? model.name : relation.modelSlug;
    if (relation.serviceTier === '高速') {
      if (!/-highspeed$/i.test(name)) name += '-highspeed';
    } else if (relation.serviceTier) name += `-${relation.serviceTier}`;
    if (relation.contextTier) name += ` [${relation.contextTier}]`;
    if (relation.timeTier) name += ` [${relation.timeTier}]`;
    return name;
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

  function hydratePlatforms(context, options) {
    const includeHidden = !!(options && options.includeHidden);
    return context.platforms
      .filter((platform) => includeHidden || platform.catalogVisible !== false)
      .map((platform) => ({ ...platform, id: platform.slug }));
  }

  function hydratePlans(context, options) {
    const includeHidden = !!(options && options.includeHidden);
    return context.plans
      .filter((plan) => includeHidden || (plan.planTableVisible !== false && plan.type !== 'API'))
      .map((plan) => {
        const platform = context.platformBySlug.get(plan.platformSlug);
        const names = (context.relationsByPlanSlug.get(plan.slug) || [])
          .flatMap((relation) => (relation.catalogEntries || []).map((entry) => ({
            order: entry.order,
            label: entry.label || displayModelName(context.modelBySlug.get(relation.modelSlug), relation)
          })))
          .sort((left, right) => left.order - right.order)
          .map((entry) => entry.label);
        return {
          ...plan,
          id: plan.slug,
          vendor: plan.tableVendorLabel || (platform && platform.name) || plan.platformSlug,
          plan: plan.name,
          models: names
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
      const billingType = plan.type === 'API' ? 'payg' : 'subscription';
      const fee = positiveNumber(plan.comparisonMonthlyPrice ?? plan.monthlyPrice);
      const displayCurrency = plan.currency || '¥';
      const rate = currencyRate(displayCurrency, usdToCnyRate);
      const monthlyFeeCny = fee && rate ? Math.round(fee * rate * 1e6) / 1e6 : null;
      if (billingType === 'payg' ? !unit : !((monthlyFeeCny && windows.monthly) || unit)) continue;
      points.push({
        id: relation.slug,
        platformSlug: platform.slug,
        planSlug: plan.slug,
        modelSlug: model.slug,
        vendor: platform.name,
        platformType: plan.type,
        plan: plan.comparisonName || plan.name,
        model: displayModelName(model, relation),
        canonicalModelId: model.slug,
        canonicalModel: model.name,
        multimodal: model.multimodal,
        scores: comparisonScores(model.scores),
        billingType,
        actionUrl: plan.action || platform.action || null,
        originalMonthlyFee: billingType === 'subscription' ? fee : undefined,
        originalCurrency: billingType === 'subscription'
          ? displayCurrency
          : (relation.pricing && relation.pricing.currency) || undefined,
        monthlyFeeCny: billingType === 'subscription' ? monthlyFeeCny : undefined,
        ...(billingType === 'subscription' ? {
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

  return {
    collection,
    displayModelName,
    buildContext,
    hydratePlatforms,
    hydratePlans,
    buildComparisonPoints
  };
});
