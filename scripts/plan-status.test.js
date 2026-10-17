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

test('套餐状态与预算、用量、模型、平台名单共同匹配，其他页面仍保留原有两层状态', () => {
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
