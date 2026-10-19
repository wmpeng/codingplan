const test = require('node:test');
const assert = require('node:assert/strict');
const Filters = require('./filter-state');
const Entity = require('./entity-data');

const statuses = ['open', 'restricted', 'delisted'];
function fixture() {
  const platforms = statuses.map(status => ({slug:status,platformStatus:status}));
  const plans = statuses.flatMap(platform => statuses.map(status => ({
    slug:platform+'-'+status,platformSlug:platform,planStatus:status,
    billingMode:'subscription',monthlyPrice:10,currency:'CNY',
    planModels:[{slug:platform+'-'+status+'-m',modelSlug:'m',usage:{monthlyTokenInM:100}}]
  })));
  return Entity.buildContext({schemaVersion:1,platforms},{schemaVersion:3,plans},{schemaVersion:1,models:[{slug:'m'}]});
}

test('套餐状态筛选仅使用套餐字段，平台状态和旧参数不能形成额外门槛', () => {
  const context = fixture(), plans = Entity.buildPlanCatalog(context);
  for(const includeDiscontinued of [false,true]) for(const excludedPlanStatuses of [[],['restricted']]) {
    const state = {planStatusOnly:true,includeDiscontinued,excludedPlanStatuses,
      platformStatusMax:'open',excludedPlatformStatuses:['restricted']};
    const expected = context.plans.filter(plan => (includeDiscontinued || plan.planStatus!=='delisted')
      && !excludedPlanStatuses.includes(plan.planStatus)).map(plan=>plan.slug);
    for(const options of [{context}, {context:{platformBySlug:context.platformBySlug}}]) {
      assert.deepEqual(Filters.filterPlans(plans,state,options).map(plan=>plan.slug),expected);
    }
    assert.deepEqual(Filters.matchingOffers(context,state).map(offer=>offer.plan.slug),expected);
  }
});

test('套餐状态与预算、用量、模型、平台名单共同匹配，未启用套餐范围时仍保留两层状态', () => {
  const context=fixture(),plans=Entity.buildPlanCatalog(context);
  const state={planStatusOnly:true,includeDiscontinued:true,platformSlugs:['delisted'],modelSlugs:['m'],
    budgetCny:{max:10},monthlyTokenRange:{min:100},excludedPlanStatuses:['restricted']};
  assert.deepEqual(Filters.filterPlans(plans,state,{context}).map(plan=>plan.slug),['delisted-open','delisted-delisted']);
  assert.deepEqual(Filters.filterPlans(plans,{...state,budgetCny:{max:9}},{context}),[]);
  assert.deepEqual(Filters.filterPlans(plans,{...state,monthlyTokenRange:{min:101}},{context}),[]);
  assert.deepEqual(Filters.filterPlans(plans,{...state,planStatusOnly:false},{context}),[]);
});

test('套餐状态字段规范化、克隆和默认值不污染平台状态条件', () => {
  const input={planStatusOnly:true,excludedPlanStatuses:['restricted','restricted','open','bad'],excludedPlatformStatuses:['restricted']};
  const state=Filters.cloneState(input);
  assert.deepEqual(state.excludedPlanStatuses,['restricted']);
  assert.deepEqual(state.excludedPlatformStatuses,['restricted']);
  assert.equal(state.planStatusOnly,true);
  assert.equal(Filters.createDefaultState({}).planStatusOnly,false);
  assert.deepEqual(Filters.createDefaultState({}).excludedPlanStatuses,[]);
  state.excludedPlanStatuses.push('delisted');
  assert.equal(input.excludedPlanStatuses.length,4);
});

test('价格点按最终套餐状态筛选，订阅与按量 API 在完整上下文和独立点模式结果一致', () => {
  const context=fixture();
  for(const plan of context.plans) {
    if(plan.platformSlug==='restricted') plan.billingMode='payg';
    for(const row of context.relationsByPlanSlug.get(plan.slug)) row.usage.unitPriceCnyPerM=2;
  }
  const points=Entity.buildComparisonPoints(context,7,{includeUnknown:true}).map(point=>({
    ...point,platformStatus:context.platformBySlug.get(point.platformSlug).platformStatus
  }));
  assert.ok(points.some(p=>p.billingMode==='payg'));
  for(const includeDiscontinued of [false,true]) for(const excludedPlanStatuses of [[],['restricted']]) {
    const state={planStatusOnly:true,includeDiscontinued,excludedPlanStatuses,
      platformStatusMax:'open',excludedPlatformStatuses:['restricted']};
    const expected=points.filter(p=>(includeDiscontinued||p.planStatus!=='delisted')&&!excludedPlanStatuses.includes(p.planStatus)).map(p=>p.slug);
    for(const options of [{context},{}]) {
      assert.deepEqual(Filters.filterPoints(points,state,options).map(p=>p.slug),expected);
    }
  }
});

test('浏览完整套餐目录保留没有模型明细的套餐，模型全选与清空均不产生隐藏门槛', () => {
  const context=Entity.buildContext(require('../platforms.json'),require('../plans.json'),require('../models.json'));
  const plans=Entity.buildPlanCatalog(context).filter(plan=>plan.billingMode==='subscription');
  const incomplete=plans.filter(plan=>!(context.relationsByPlanSlug.get(plan.slug)||[]).length);
  assert.ok(incomplete.length>0);
  for(const modelSlugs of [null,[],context.models.map(model=>model.slug)]) {
    const input={planStatusOnly:true,includeDiscontinued:true,modelSlugs};
    const before=JSON.stringify(input);
    assert.deepEqual(Filters.filterPlans(plans,input,{context}).map(plan=>plan.slug),plans.map(plan=>plan.slug));
    assert.equal(JSON.stringify(input),before);
  }
  const active=Filters.filterPlans(plans,{planStatusOnly:true},{context});
  assert.ok(incomplete.filter(plan=>plan.planStatus!=='delisted').every(plan=>active.some(p=>p.slug===plan.slug)));
  assert.equal(Filters.matchingOffers(context,{planStatusOnly:true,includeDiscontinued:true}).some(offer=>incomplete.some(plan=>plan.slug===offer.plan.slug)),false);
});

test('无模型明细的套餐仍可按套餐价格筛选，模型或用量条件则必须有对应明细', () => {
  const context=fixture();
  context.models.push({slug:'n'});
  context.modelBySlug.set('n',context.models[1]);
  context.plans=[{slug:'empty',platformSlug:'open',planStatus:'open',billingMode:'subscription',monthlyPrice:20,currency:'CNY'}];
  const plans=Entity.buildPlanCatalog(context),state={planStatusOnly:true,includeDiscontinued:true};
  assert.equal(Filters.filterPlans(plans,{...state,budgetCny:{max:20}},{context}).length,1);
  assert.equal(Filters.filterPlans(plans,{...state,budgetCny:{max:19}},{context}).length,0);
  for(const condition of [{modelSlugs:['m']},{monthlyTokenRange:{min:0}},{aaScoreMin:0},{modelSlugs:context.models.map(m=>m.slug),modelMatch:'all'}]) {
    assert.deepEqual(Filters.filterPlans(plans,{...state,...condition},{context}),[]);
  }
  assert.deepEqual(Filters.filterPlans(plans,{...state,planStatusOnly:false},{context}),[]);
});
