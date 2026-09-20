const test = require('node:test');
const assert = require('node:assert/strict');
const Filters = require('./filter-state.js');

const unrestricted = (overrides = {}) => Filters.normalizeState({
  platformSlugs: null,
  planSlugs: null,
  modelSlugs: null,
  platformStatusMax: 'delisted',
  includeDiscontinued: true,
  ...overrides
});

test('单侧范围在多次规范化后仍保持开放，未知值不转换成零', () => {
  for (const range of [{ min: 50, max: null }, { min: null, max: 100 }]) {
    const state = unrestricted({ budgetCny: range, requestRanges: { weeklyRequests: range } });
    assert.deepEqual(Filters.cloneState(state).budgetCny, range);
    assert.deepEqual(Filters.cloneState(state).requestRanges.weeklyRequests, range);
  }
  assert.equal(unrestricted({ budgetCny: { min: '', max: null } }).budgetCny, null);
  for (const value of [null, undefined, '', ' ', 'unknown', false]) {
    assert.equal(Filters.toCny(value, '¥', 7), null);
    assert.equal(Filters.inRange(value, { min: null, max: 100 }), false);
    assert.equal(Filters.inRange(value, null), true);
  }
  assert.equal(Filters.toCny(0, '¥', 7), 0);
  assert.equal(Filters.inRange(0, { min: null, max: 100 }), true);
  const plans = [0, 50, 100, null, 'unknown'].map((monthlyPrice, i) => ({ slug: String(i), monthlyPrice, currency: '¥' }));
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ budgetCny: { min: 50, max: null } })).map(p => p.slug), ['1', '2']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ budgetCny: { min: null, max: 50 } })).map(p => p.slug), ['0', '1']);
});

test('评分阈值为零仍排除未知评分；平台视图忽略套餐与预算', () => {
  const points = [null, { scoreExact: null }, { scoreExact: 0 }].map((score, i) => ({ slug: String(i), scores: { artificialAnalysis: score } }));
  assert.deepEqual(Filters.filterPoints(points, unrestricted({ aaScoreMin: 0 })).map(p => p.slug), ['2']);
  const platforms = [{ slug: 'a' }];
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ planSlugs: [], budgetCny: { max: 0 } })), platforms);
});

test('订阅价格点按关联套餐筛选季价，按量 API 不受套餐价格和请求条件影响', () => {
  const points = [
    { slug: 'known', planSlug: 'a', billingMode: 'subscription' },
    { slug: 'unknown', planSlug: 'b', billingMode: 'subscription' },
    { slug: 'api', billingMode: 'payg' }
  ];
  const context = { planBySlug: new Map([['a', { quarterlyPrice: 10, currency: '$' }], ['b', { quarterlyPrice: 'unknown' }]]) };
  const state = unrestricted({ priceRanges: { quarterlyPrice: { min: 70, max: null } }, requestRanges: { weeklyRequests: { min: 100 } } });
  assert.deepEqual(Filters.filterPoints(points, state, { context, usdToCnyRate: 7 }).map(p => p.slug), ['known', 'api']);
  const plans = [{ slug: 'unlimited', weeklyRequests: '无限制' }, { slug: 'unknown', weeklyRequests: '未公开' }];
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ requestRanges: { weeklyRequests: { min: 100 } } })).map(p => p.slug), ['unlimited']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ requestRanges: { weeklyRequests: { max: 100 } } })), []);
});

test('默认精选配置可读取并校验稳定 slug', () => {
  const config = {
    homepageFilters: {
      defaults: {
        platformSlugs: ['p1'],
        planSlugs: ['plan1'],
        modelSlugs: ['m1'],
        modelMatch: 'all',
        budgetCny: null
      }
    }
  };
  const state = Filters.createDefaultState(config);
  assert.deepEqual(state.platformSlugs, ['p1']);
  assert.equal(state.modelMatch, 'all');
  const context = {
    platformBySlug: new Map([['p1', { slug: 'p1', catalogVisible: true }]]),
    planBySlug: new Map([['plan1', { slug: 'plan1', platformSlug: 'p1', planTableVisible: true }]]),
    modelBySlug: new Map([['m1', { slug: 'm1' }]])
  };
  assert.deepEqual(Filters.validateDefaults(config.homepageFilters.defaults, context).errors, []);
  assert.equal(Filters.validateDefaults({ ...config.homepageFilters.defaults, modelSlugs: ['missing'] }, context).ok, false);
});

test('模型任意/全部匹配与实体跨维度交集', () => {
  const plans = [
    { slug: 'p-a', platformSlug: 'a', supportedModels: ['m1', 'm2'], tags: ['个人', '多模态'], monthlyPrice: 10, currency: '¥' },
    { slug: 'p-b', platformSlug: 'a', supportedModels: ['m1'], tags: ['个人'], monthlyPrice: 20, currency: '¥' },
    { slug: 'p-c', platformSlug: 'b', supportedModels: ['m2'], tags: ['个人', '多模态'], monthlyPrice: 30, currency: '¥' }
  ];
  const any = unrestricted({ platformSlugs: ['a'], modelSlugs: ['m2'], modelMatch: 'any', planTags: ['个人', '多模态'] });
  assert.deepEqual(Filters.filterPlans(plans, any).map(plan => plan.slug), ['p-a']);
  const all = unrestricted({ platformSlugs: ['a'], modelSlugs: ['m1', 'm2'], modelMatch: 'all' });
  assert.deepEqual(Filters.filterPlans(plans, all).map(plan => plan.slug), ['p-a']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ platformSlugs: [], planSlugs: [], modelSlugs: [], modelMatch: 'all' })), plans);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ platformSlugs: ['a'], planSlugs: plans.map(plan => plan.slug) })).map(plan => plan.slug), ['p-a', 'p-b']);
});

test('套餐视图同时应用平台标签和套餐标签', () => {
  const plans = [
    { slug: 'good', platformSlug: 'a', supportedModels: [], tags: ['个人'] },
    { slug: 'other-platform', platformSlug: 'b', supportedModels: [], tags: ['个人'] },
    { slug: 'other-plan-tag', platformSlug: 'a', supportedModels: [], tags: ['团队'] }
  ];
  const context = {
    platformBySlug: new Map([
      ['a', { slug: 'a', platformStatus: 'open', tags: ['可支付宝'] }],
      ['b', { slug: 'b', platformStatus: 'open', tags: [] }]
    ])
  };
  const state = unrestricted({ platformSlugs: null, planSlugs: null, platformTags: ['可支付宝'], planTags: ['个人'] });
  assert.deepEqual(Filters.filterPlans(plans, state, { context }).map(plan => plan.slug), ['good']);
  const derived = unrestricted({ platformTags: ['性价比高'] });
  assert.deepEqual(Filters.filterPlans(plans, derived, {
    context,
    platformCatalog: { derivedTags: [{ label: '性价比高', rule: { dimension: 'value', minScore: 4 } }] }
  }).map(plan => plan.slug), []);
});

test('平台模型筛选、状态和清空/全选语义', () => {
  const platforms = [
    { slug: 'a', platformStatus: 'open', catalogVisible: true },
    { slug: 'b', platformStatus: 'paused', catalogVisible: true },
    { slug: 'c', platformStatus: 'delisted', catalogVisible: true }
  ];
  const context = { platformBySlug: new Map(platforms.map(item => [item.slug, item])) };
  const entityData = { platformModels: (_context, slug) => slug === 'a' ? [{ slug: 'm1' }, { slug: 'm2' }] : [{ slug: 'm1' }] };
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ platformSlugs: null, modelSlugs: ['m1', 'm2'], modelMatch: 'all', platformStatusMax: 'paused' }), { context, entityData }).map(item => item.slug), ['a']);
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ platformSlugs: [] }), { context, entityData }), platforms);
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ platformSlugs: platforms.map(item => item.slug) }), { context, entityData }).map(item => item.slug), ['a', 'b', 'c']);
});

test('人民币换算、未知值和范围筛选', () => {
  assert.equal(Filters.toCny(10, '$', 7.2), 72);
  assert.equal(Filters.toCny('unknown', '$', 7.2), null);
  const plans = [
    { slug: 'cny', platformSlug: 'p', supportedModels: [], monthlyPrice: 70, currency: '¥' },
    { slug: 'usd', platformSlug: 'p', supportedModels: [], monthlyPrice: 10, currency: '$' },
    { slug: 'unknown', platformSlug: 'p', supportedModels: [], monthlyPrice: 'unknown', currency: '$' }
  ];
  const state = unrestricted({ budgetCny: { min: 70, max: 72 }, priceRanges: { monthlyPrice: { min: 70, max: 72 } } });
  assert.deepEqual(Filters.filterPlans(plans, state, { usdToCnyRate: 7.2 }).map(plan => plan.slug), ['cny', 'usd']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted(), { usdToCnyRate: 7.2 }).map(plan => plan.slug), ['cny', 'usd', 'unknown']);
  assert.deepEqual(Filters.filterPlans([{ slug: 'hidden', platformSlug: 'p', planTableVisible: false, discontinued: true }], unrestricted()), []);
});

test('价格点的全部模型匹配按平台与套餐分组，按量 API 不参加月预算', () => {
  const points = [
    { slug: 'a-1', platformSlug: 'a', planSlug: 'plan-a', billingMode: 'subscription', modelSlug: 'm1', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥', planTableVisible: true },
    { slug: 'a-2', platformSlug: 'a', planSlug: 'plan-a', billingMode: 'subscription', modelSlug: 'm2', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥', planTableVisible: true },
    { slug: 'b-1', platformSlug: 'b', planSlug: 'plan-b', billingMode: 'subscription', modelSlug: 'm1', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥', planTableVisible: true },
    { slug: 'api-1', platformSlug: 'b', planSlug: 'api-b', billingMode: 'payg', modelSlug: 'm1', unitPriceCnyPerM: 1, planTableVisible: false }
  ];
  const state = unrestricted({ modelSlugs: ['m1', 'm2'], modelMatch: 'all', budgetCny: { min: 10, max: 60 } });
  assert.deepEqual(Filters.filterPoints(points, state).map(point => point.slug), ['a-1', 'a-2']);
  const budget = unrestricted({ modelSlugs: ['m1'], budgetCny: { min: 10, max: 20 } });
  assert.deepEqual(Filters.filterPoints(points, budget).map(point => point.slug), ['api-1']);
  const withDiscontinued = unrestricted({ modelSlugs: ['m1'], includeDiscontinued: false });
  points[2].discontinued = true;
  assert.deepEqual(Filters.filterPoints(points, withDiscontinued).map(point => point.slug), ['a-1', 'api-1']);
});

test('全部模型匹配不把已下架或隐藏的模型算入当前可见套餐', () => {
  const points = [
    { slug: 'active', platformSlug: 'p', planSlug: 'plan', billingMode: 'subscription', modelSlug: 'm1', planTableVisible: true },
    { slug: 'discontinued', platformSlug: 'p', planSlug: 'plan', billingMode: 'subscription', modelSlug: 'm2', planTableVisible: true, discontinued: true }
  ];
  const state = unrestricted({ modelSlugs: ['m1', 'm2'], modelMatch: 'all', includeDiscontinued: false });
  assert.deepEqual(Filters.filterPoints(points, state), []);
  assert.deepEqual(Filters.filterPoints(points, { ...state, includeDiscontinued: true }).map(point => point.slug), ['active', 'discontinued']);
});

test('清空单个实体维度不取消其他条件，全部模型模式下空选择也不限', () => {
  const plans = [{ slug: 'a', platformSlug: 'p', monthlyPrice: 50 }, { slug: 'b', platformSlug: 'q', monthlyPrice: 50 }, { slug: 'c', platformSlug: 'p', monthlyPrice: 100 }];
  const state = unrestricted({ platformSlugs: ['p'], planSlugs: [], modelSlugs: [], modelMatch: 'all', budgetCny: { max: 60 } });
  assert.deepEqual(Filters.filterPlans(plans, state).map(p => p.slug), ['a']);
  assert.equal(Filters.modelMatch([], [], 'all'), true);
});
