const test = require('node:test');
const assert = require('node:assert/strict');
const Filters = require('./filter-state.js');

test('第三方工具条件采用套餐覆盖与平台默认，未确认不匹配，所有资格入口保持一致', () => {
  const {fixtureContext}=require('./test-fixtures.cjs'), E=require('./entity-data.js');
  const platforms=[{slug:'yes',platformStatus:'open',supportsHarnessApi:true},{slug:'no',platformStatus:'open',supportsHarnessApi:false},{slug:'unknown',platformStatus:'open'}];
  const plans=[{slug:'inherited',platformSlug:'yes'},{slug:'override-no',platformSlug:'yes',supportsHarnessApi:false},
    {slug:'override-yes',platformSlug:'no',supportsHarnessApi:true},{slug:'no',platformSlug:'no'},{slug:'unknown',platformSlug:'unknown'}]
    .map(plan=>({...plan,billingMode:'subscription',monthlyPrice:10}));
  const c=fixtureContext({schemaVersion:1,platforms},{plans},{schemaVersion:1,models:[{slug:'m'}]},
    {planModels:plans.map(plan=>({slug:plan.slug,planSlug:plan.slug,modelSlug:'m'}))});
  const state={harnessApiRequired:true},expected=['inherited','override-yes'];
  assert.deepEqual(Filters.matchingOffers(c,state).map(offer=>offer.plan.slug),expected);
  assert.deepEqual(Filters.filterPlans(E.buildPlanCatalog(c),state,{context:c}).map(plan=>plan.slug),expected);
  assert.deepEqual(Filters.filterPlans(plans,state,{context:{platformBySlug:c.platformBySlug}}).map(plan=>plan.slug),expected);
  const points=plans.map(plan=>({...plan,platformSlug:plan.platformSlug,supportsHarnessApi:E.resolveHarnessApi(c.platformBySlug.get(plan.platformSlug),plan)}));
  assert.deepEqual(Filters.filterPoints(points,state).map(point=>point.slug),expected);
  assert.equal(Filters.matchingOffers(c,{}).length,plans.length);
});

test('多模态筛选及旧字段包含纯非文本输出，未知与纯文本不纳入', () => {
  const {fixtureContext}=require('./test-fixtures.cjs');
  const E=require('./entity-data.js');
  const models=[{slug:'speech',multimodal:true,modalities:{input:['text'],output:['speech']}},
    {slug:'image-output',multimodal:true,modalities:{input:['text'],output:['image']}},
    {slug:'image-input',multimodal:true,modalities:{input:['text','image']}},
    {slug:'text',multimodal:false},{slug:'unknown',multimodal:'unknown'}];
  const context=fixtureContext({schemaVersion:1,platforms:[{slug:'p',platformStatus:'open'}]},
    {plans:[{slug:'plan',platformSlug:'p',billingMode:'subscription'}]}, {schemaVersion:1,models},
    {planModels:models.map(model=>({slug:model.slug,planSlug:'plan',modelSlug:model.slug}))});
  const expected=['speech','image-output','image-input'];
  for(const patch of [{multimodal:'multimodal'},{imageRequired:true}]) {
    assert.deepEqual(Filters.matchingOffers(context,patch)[0].rows.map(row=>row.modelSlug),expected);
  }
  const points=models.map(model=>({...model,modelSlug:model.slug,platformSlug:'p',billingMode:'subscription'}));
  assert.deepEqual(Filters.filterPoints(points,{multimodal:'multimodal'}).map(point=>point.slug),expected);
  assert.deepEqual(Filters.filterPoints(points,{imageRequired:true}).map(point=>point.slug),expected);
  for(const model of models) assert.equal(E.isMultimodal(model),expected.includes(model.slug));
  assert.equal(E.isMultimodal(null),false);
});

const unrestricted = (overrides = {}) => Filters.normalizeState({
  platformSlugs: null,
  modelSlugs: null,
  platformStatusMax: 'delisted',
  includeDiscontinued: true,
  ...overrides
});

test('three plan statuses retain independent platform and delisted-plan gates', () => {
  const {fixtureContext}=require('./test-fixtures.cjs');
  const E=require('./entity-data.js');
  const statuses=['open','restricted','delisted'];
  const platforms=statuses.map(platformStatus=>({slug:platformStatus,platformStatus}));
  const plans=platforms.flatMap(p=>statuses.map(planStatus=>({
    slug:`${p.slug}-${planStatus}`,platformSlug:p.slug,planStatus,billingMode:'subscription',monthlyPrice:10
  })));
  const c=fixtureContext({schemaVersion:1,platforms},{plans},{schemaVersion:1,models:[{slug:'m'}]},
    {planModels:plans.map(p=>({slug:p.slug,planSlug:p.slug,modelSlug:'m',usage:{monthlyTokenInM:100}}))});
  const opts={context:c};
  for(const includeDiscontinued of [false,true])for(const platformStatusMax of ['restricted','delisted']) {
    const state=Filters.normalizeState({includeDiscontinued,platformStatusMax});
    const expected=plans.filter(p=>(platformStatusMax==='delisted'||p.platformSlug!=='delisted')&&(includeDiscontinued||p.planStatus!=='delisted')).map(p=>p.slug);
    assert.deepEqual(Filters.matchingOffers(c,state).map(o=>o.plan.slug),expected);
    assert.deepEqual(Filters.filterPlans(E.buildPlanCatalog(c),state,opts).map(p=>p.slug),expected);
  }
  const restrictedPlatformOpenPlan=Filters.normalizeState({platformSlugs:['restricted'],platformStatusMax:'open'});
  assert.deepEqual(Filters.matchingOffers(c,restrictedPlatformOpenPlan),[]);
});

test('购买状态排除受限平台，并保留完整页的累积状态筛选', () => {
  const platforms = ['open', 'restricted', 'delisted'].map(status => ({slug:status,platformStatus:status}));
  const plans = platforms.map(p => ({slug:p.slug,platformSlug:p.slug,billingMode:'subscription',monthlyPrice:10}));
  const context = {platforms,plans,platformBySlug:new Map(platforms.map(p=>[p.slug,p])),
    relationsByPlanSlug:new Map(plans.map(p=>[p.slug,[{slug:p.slug,modelSlug:'m'}]])),modelBySlug:new Map([['m',{slug:'m'}]])};
  const cases = [ [[],['open','restricted']], [['restricted'],['open']] ];
  for (const [excluded,expected] of cases) {
    const state = Filters.normalizeState({excludedPlatformStatuses:excluded});
    assert.deepEqual(Filters.matchingOffers(context,state).map(o=>o.platform.slug),expected);
    assert.deepEqual(Filters.filterPlatforms(platforms,state).map(p=>p.slug),expected);
    // Also exercise adapter paths without the offer-level context.
    assert.deepEqual(Filters.filterPlans(plans,state,{context:{platformBySlug:context.platformBySlug}}).map(p=>p.slug),expected);
    assert.deepEqual(Filters.filterPoints(platforms.map(p=>({...p,billingMode:'payg'})),state).map(p=>p.slug),expected);
  }
  const full = Filters.createDefaultState({}, {mode:'full'});
  assert.deepEqual(Filters.matchingOffers(context,full).map(o=>o.platform.slug),platforms.map(p=>p.slug));
  assert.deepEqual(Filters.matchingOffers(context,{...full,platformStatusMax:'restricted'}).map(o=>o.platform.slug),['open','restricted']);
  assert.deepEqual(Filters.normalizeState({excludedPlatformStatuses:['restricted','restricted','unknown','delisted']}).excludedPlatformStatuses,['restricted']);
  for(const previous of ['limited','paused']) {
    const migrated=Filters.normalizeState({platformStatusMax:previous,excludedPlatformStatuses:['limited','paused']});
    assert.equal(migrated.platformStatusMax,'restricted');
    assert.deepEqual(migrated.excludedPlatformStatuses,['restricted']);
  }
});

test('API 类型限制独立于零预算，价格点和订阅表同步过滤', () => {
  const points = [
    { slug: 'sub', billingMode: 'subscription', monthlyFeeCny: 0 },
    { slug: 'api', billingMode: 'payg', unitPriceCnyPerM: 2 },
    { slug: 'unknown', billingMode: 'payg', unitPriceCnyPerM: null }
  ];
  const onlyApi = unrestricted({ apiOnly: true });
  assert.deepEqual(Filters.filterPoints(points, onlyApi).map(x => x.slug), ['api', 'unknown']);
  assert.equal(Filters.cloneState(onlyApi).apiOnly, true);
  const zeroBudget = unrestricted({ budgetCny: { max: 0 } });
  assert.equal(zeroBudget.apiOnly, false);
  assert.deepEqual(Filters.filterPoints(points, zeroBudget), points);
  assert.deepEqual(Filters.filterPoints(points, unrestricted({ apiOnly: true, budgetCny: { max: 0 }, monthlyTokenRange: { min: 1 } })), []);
  assert.deepEqual(Filters.filterPlans([{ slug: 'sub', billingMode: 'subscription', monthlyPrice: 0 }], onlyApi), []);
});

test('月 Token 按同一模型关系匹配，不相加；未知订阅在范围启用时排除，按量 API 保留', () => {
  const plan = { slug: 'p', supportedModels: ['a', 'b'], monthlyTokenOptions: [
    { modelSlug: 'a', value: 100 }, { modelSlug: 'b', value: 300 }, { modelSlug: 'b', value: null }
  ] };
  const state = unrestricted({ monthlyTokenRange: { min: 200 }, modelSlugs: ['a'] });
  assert.deepEqual(Filters.filterPlans([plan], state), []);
  state.modelSlugs = ['b'];
  assert.deepEqual(Filters.filterPlans([plan], state), [plan]);
  state.modelSlugs = ['a', 'b']; state.modelMatch = 'all';
  assert.deepEqual(Filters.filterPlans([plan], state), []);
  assert.equal(Filters.formatMonthlyTokens(plan, unrestricted({ tokenUnit: 'yi' })), '1–3 亿（部分未知）');
  assert.equal(Filters.formatMonthlyTokens(plan, unrestricted({ tokenUnit: 'M', modelSlugs: ['a'] })), '100 M');
  const points = [
    { slug: 'a', planSlug: 'p', modelSlug: 'a', billingMode: 'subscription', monthlyTokenInM: 100 },
    { slug: 'b', planSlug: 'p', modelSlug: 'b', billingMode: 'subscription', monthlyTokenInM: 300 },
    { slug: 'unknown', billingMode: 'subscription', monthlyTokenInM: null },
    { slug: 'api', billingMode: 'payg' }
  ];
  assert.deepEqual(Filters.filterPoints(points, unrestricted()), points);
  assert.deepEqual(Filters.filterPoints(points, unrestricted({ monthlyTokenRange: { min: 200 } })).map(p => p.slug), ['b', 'api']);
  assert.deepEqual(Filters.filterPoints(points, state), []);
  assert.equal(Filters.tokenInRange('unlimited', { min: 200, max: null }), true);
  assert.equal(Filters.tokenInRange('unlimited', { min: null, max: 200 }), false);
  assert.deepEqual(Filters.cloneState(state).monthlyTokenRange, { min: 200, max: null });
});

test('套餐月 Token 摘要仅统计有限额度，保留模型选择、零值及未知提示', () => {
  const plan = { monthlyTokenOptions: [
    { modelSlug: 'a', value: 13 }, { modelSlug: 'a', value: 200 },
    { modelSlug: 'b', value: 'unlimited' }, { modelSlug: 'c', value: null },
    { modelSlug: 'zero', value: 0 }
  ] };
  const snapshot = JSON.stringify(plan);
  const summary = (modelSlugs, tokenUnit = 'yi') => Filters.formatMonthlyTokens(plan, unrestricted({ modelSlugs, tokenUnit }));
  assert.equal(summary(['a', 'b']), '0.13–2 亿');
  assert.equal(summary(['a', 'b'], 'M'), '13–200 M');
  assert.equal(summary(['a', 'b'], 'B'), '0.01–0.20 B');
  assert.equal(summary(['a', 'b', 'c']), '0.13–2 亿（部分未知）');
  assert.equal(summary(['zero', 'b']), '0 亿');
  for (const slugs of [['b'], ['b', 'c'], ['c'], ['missing']]) assert.equal(summary(slugs), '未知');
  assert.equal(Filters.formatMonthlyTokens({ monthlyTokenOptions: [
    { modelSlug: 'a', value: 13 }, { modelSlug: 'b', value: 'unlimited' }
  ] }, unrestricted({ tokenUnit: 'yi' })), '0.13 亿');
  assert.equal(JSON.stringify(plan), snapshot);
});

test('公开套餐不保留标签字段，默认筛选不再限制套餐名单', () => {
  const plans = require('../plans.json').plans;
  assert.ok(plans.every(plan => !Object.hasOwn(plan, 'tags')));
  const config = require('../config.json');
  const state = Filters.createDefaultState(config);
  assert.equal(Object.hasOwn(state, 'planSlugs'), false);
  assert.equal(Object.hasOwn(state, 'planTags'), false);
});

test('单侧范围在多次规范化后仍保持开放，未知值不转换成零', () => {
  for (const range of [{ min: 50, max: null }, { min: null, max: 100 }]) {
    const state = unrestricted({ budgetCny: range, requestRanges: { weekly: range } });
    assert.deepEqual(Filters.cloneState(state).budgetCny, range);
    assert.deepEqual(Filters.cloneState(state).requestRanges.weekly, range);
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
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ budgetCny: { max: 0 } })), platforms);
});

test('订阅价格点按关联套餐筛选季价，按量 API 不受套餐价格和请求条件影响', () => {
  const points = [
    { slug: 'known', planSlug: 'a', billingMode: 'subscription' },
    { slug: 'unknown', planSlug: 'b', billingMode: 'subscription' },
    { slug: 'api', billingMode: 'payg' }
  ];
  const context = { planBySlug: new Map([['a', { quarterlyPrice: 10, currency: '$' }], ['b', { quarterlyPrice: 'unknown' }]]) };
  const state = unrestricted({ priceRanges: { quarterlyPrice: { min: 70, max: null } }, requestRanges: { weekly: { min: 100 } } });
  assert.deepEqual(Filters.filterPoints(points, state, { context, usdToCnyRate: 7 }).map(p => p.slug), ['known', 'api']);
  const plans = [{ slug: 'unlimited', requestQuota: {weekly:'unlimited'} }, { slug: 'unknown', requestQuota: {weekly:'unknown'} }];
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ requestRanges: { weekly: { min: 100 } } })).map(p => p.slug), ['unlimited']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ requestRanges: { weekly: { max: 100 } } })), []);
});

test('请求额度范围在目录与关系候选中一致处理数值、未知、缺省和不限量', () => {
  const {fixtureContext}=require('./test-fixtures.cjs'), E=require('./entity-data.js');
  const plans = [0,4200,'unknown','unlimited',undefined].map((weekly,index)=>({
    slug:String(index),platformSlug:'p',billingMode:'subscription',monthlyPrice:10,
    ...(weekly === undefined ? {} : {requestQuota:{fiveHours:'unknown',weekly,monthly:'unknown'}})
  }));
  const context=fixtureContext({schemaVersion:1,platforms:[{slug:'p',platformStatus:'open'}]},
    {plans}, {schemaVersion:1,models:[{slug:'m'}]},
    {planModels:plans.map(plan=>({slug:plan.slug,planSlug:plan.slug,modelSlug:'m'}))});
  for (const [range, expected] of [[{min:0,max:4200},['0','1']],[{min:4200},['1','3']]]) {
    const state={requestRanges:{weekly:range}};
    assert.deepEqual(Filters.matchingOffers(context,state).map(o=>o.plan.slug),expected);
    assert.deepEqual(Filters.filterPlans(E.buildPlanCatalog(context),state,{context}).map(p=>p.slug),expected);
  }
});

test('默认精选配置可读取并校验稳定 slug', () => {
  const config = {
    homepageFilters: {
      defaults: {
        platformSlugs: ['p1'],
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
    platformBySlug: new Map([['p1', { slug: 'p1' }]]),
    planBySlug: new Map([['plan1', { slug: 'plan1', platformSlug: 'p1' }]]),
    modelBySlug: new Map([['m1', { slug: 'm1' }]])
  };
  assert.deepEqual(Filters.validateDefaults(config.homepageFilters.defaults, context).errors, []);
  assert.equal(Filters.validateDefaults({ ...config.homepageFilters.defaults, modelSlugs: ['missing'] }, context).ok, false);
});

test('显式精选参数取平台与两组模型并集，完整页基础状态为全量', () => {
  const config = { homepageFilters: { defaults: { platformSlugs: ['old'], modelSlugs: ['old'], budgetCny: { max: 200 } } } };
  const featuredPreset = { platformSlugs: ['p1', 'p2'], groups: [
    { modelSlugs: ['m1', 'm2'] }, { modelSlugs: ['m2', 'm3'] }
  ] };
  const state = Filters.createDefaultState(config, { mode: 'home', featuredPreset });
  assert.deepEqual(state.platformSlugs, ['p1', 'p2']);
  assert.deepEqual(state.modelSlugs, ['m1', 'm2', 'm3']);
  assert.deepEqual(state.budgetCny, { min: null, max: 200 });
  assert.equal(state.platformStatusMax, 'restricted');
  assert.equal(state.modelMatch, 'any');
  state.platformSlugs.push('extra');
  state.modelSlugs.pop();
  const restored = Filters.createDefaultState(config, { featuredPreset });
  assert.deepEqual(restored.platformSlugs, ['p1', 'p2']);
  assert.deepEqual(restored.modelSlugs, ['m1', 'm2', 'm3']);
  const full = Filters.createDefaultState(config, { mode: 'full', featuredPreset });
  assert.equal(full.platformSlugs, null);
  assert.equal(full.modelSlugs, null);
  assert.equal(full.budgetCny, null);
});

test('模型任意/全部匹配与实体跨维度交集', () => {
  const plans = [
    { slug: 'p-a', platformSlug: 'a', supportedModels: ['m1', 'm2'], monthlyPrice: 10, currency: '¥' },
    { slug: 'p-b', platformSlug: 'a', supportedModels: ['m1'], monthlyPrice: 20, currency: '¥' },
    { slug: 'p-c', platformSlug: 'b', supportedModels: ['m2'], monthlyPrice: 30, currency: '¥' }
  ];
  const any = unrestricted({ platformSlugs: ['a'], modelSlugs: ['m2'], modelMatch: 'any' });
  assert.deepEqual(Filters.filterPlans(plans, any).map(plan => plan.slug), ['p-a']);
  const all = unrestricted({ platformSlugs: ['a'], modelSlugs: ['m1', 'm2'], modelMatch: 'all' });
  assert.deepEqual(Filters.filterPlans(plans, all).map(plan => plan.slug), ['p-a']);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ platformSlugs: [], modelSlugs: [], modelMatch: 'all' })), plans);
  assert.deepEqual(Filters.filterPlans(plans, unrestricted({ platformSlugs: ['a'], })).map(plan => plan.slug), ['p-a', 'p-b']);
});

test('removed platform label state cannot silently restrict results', () => {
  const plans = [{ slug: 'a', platformSlug: 'a', supportedModels: [] }];
  const state = unrestricted({ platformTags: ['old-label'] });
  assert.equal(Object.hasOwn(state, 'platformTags'), false);
  assert.deepEqual(Filters.filterPlans(plans, state), plans);
});

test('平台模型筛选、状态和清空/全选语义', () => {
  const platforms = [
    { slug: 'a', platformStatus: 'open' },
    { slug: 'b', platformStatus: 'restricted' },
    { slug: 'c', platformStatus: 'delisted' }
  ];
  const context = { platformBySlug: new Map(platforms.map(item => [item.slug, item])) };
  const entityData = { platformModels: (_context, slug) => slug === 'a' ? [{ slug: 'm1' }, { slug: 'm2' }] : [{ slug: 'm1' }] };
  assert.deepEqual(Filters.filterPlatforms(platforms, unrestricted({ platformSlugs: null, modelSlugs: ['m1', 'm2'], modelMatch: 'all', platformStatusMax: 'restricted' }), { context, entityData }).map(item => item.slug), ['a']);
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
  assert.deepEqual(Filters.filterPlans([{ slug: 'retired', platformSlug: 'p', planStatus: 'delisted' }], unrestricted({includeDiscontinued:false})), []);
});

test('价格点的全部模型匹配按平台与套餐分组，按量 API 不参加月预算', () => {
  const points = [
    { slug: 'a-1', platformSlug: 'a', planSlug: 'plan-a', billingMode: 'subscription', modelSlug: 'm1', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥' },
    { slug: 'a-2', platformSlug: 'a', planSlug: 'plan-a', billingMode: 'subscription', modelSlug: 'm2', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥' },
    { slug: 'b-1', platformSlug: 'b', planSlug: 'plan-b', billingMode: 'subscription', modelSlug: 'm1', monthlyFeeCny: 50, originalMonthlyFee: 50, originalCurrency: '¥' },
    { slug: 'api-1', platformSlug: 'b', planSlug: 'api-b', billingMode: 'payg', modelSlug: 'm1', unitPriceCnyPerM: 1 }
  ];
  const state = unrestricted({ modelSlugs: ['m1', 'm2'], modelMatch: 'all', budgetCny: { min: 10, max: 60 } });
  assert.deepEqual(Filters.filterPoints(points, state).map(point => point.slug), ['a-1', 'a-2']);
  const budget = unrestricted({ modelSlugs: ['m1'], budgetCny: { min: 10, max: 20 } });
  assert.deepEqual(Filters.filterPoints(points, budget).map(point => point.slug), ['api-1']);
  const withDiscontinued = unrestricted({ modelSlugs: ['m1'], includeDiscontinued: false });
  points[2].planStatus = 'delisted';
  assert.deepEqual(Filters.filterPoints(points, withDiscontinued).map(point => point.slug), ['a-1', 'api-1']);
});

test('全部模型匹配不把已下架关系算入当前可用套餐', () => {
  const points = [
    { slug: 'active', platformSlug: 'p', planSlug: 'plan', billingMode: 'subscription', modelSlug: 'm1' },
    { slug: 'discontinued', platformSlug: 'p', planSlug: 'plan', billingMode: 'subscription', modelSlug: 'm2', planStatus: 'delisted' }
  ];
  const state = unrestricted({ modelSlugs: ['m1', 'm2'], modelMatch: 'all', includeDiscontinued: false });
  assert.deepEqual(Filters.filterPoints(points, state), []);
  assert.deepEqual(Filters.filterPoints(points, { ...state, includeDiscontinued: true }).map(point => point.slug), ['active', 'discontinued']);
});

test('清空单个实体维度不取消其他条件，全部模型模式下空选择也不限', () => {
  const plans = [{ slug: 'a', platformSlug: 'p', monthlyPrice: 50 }, { slug: 'b', platformSlug: 'q', monthlyPrice: 50 }, { slug: 'c', platformSlug: 'p', monthlyPrice: 100 }];
  const state = unrestricted({ platformSlugs: ['p'], modelSlugs: [], modelMatch: 'all', budgetCny: { max: 60 } });
  assert.deepEqual(Filters.filterPlans(plans, state).map(p => p.slug), ['a']);
  assert.equal(Filters.modelMatch([], [], 'all'), true);
});


test('空模型清单保留勾选状态但不限制业务，不能令未知额度通过用量要求',()=>{
  const cleared=Filters.normalizeState({modelSlugs:[],modelMatch:'all',monthlyTokenRange:{min:100}});
  assert.deepEqual(Filters.cloneState(cleared).modelSlugs,[]);
  const plans=[{slug:'known',monthlyTokenOptions:[{modelSlug:'m',value:100}]},{slug:'unknown',monthlyTokenOptions:[{modelSlug:'m',value:null}]}];
  assert.deepEqual(Filters.filterPlans(plans,cleared).map(p=>p.slug),['known']);
  const points=[{slug:'known',modelSlug:'m',billingMode:'subscription',monthlyTokenInM:100},{slug:'unknown',modelSlug:'m',billingMode:'subscription',monthlyTokenInM:null}];
  assert.deepEqual(Filters.filterPoints(points,cleared).map(p=>p.slug),['known']);
});


test('比较点使用首月金额时，月付价格条件仍检查正式月价',()=>{
  const point={slug:'r',planSlug:'p',billingMode:'subscription',monthlyFeeCny:20};
  const context={planBySlug:new Map([['p',{monthlyPrice:100,firstMonthPrice:20,currency:'¥'}]])};
  const filter=priceRanges=>Filters.filterPoints([point],unrestricted({priceRanges}),{context});
  assert.equal(filter({monthlyPrice:{min:90,max:110}}).length,1);
  assert.equal(filter({monthlyPrice:{max:30}}).length,0);
  assert.equal(filter({firstMonthPrice:{max:30}}).length,1);
  context.planBySlug.get('p').monthlyPrice='不适用';
  assert.equal(filter({monthlyPrice:{min:0}}).length,0);
});
