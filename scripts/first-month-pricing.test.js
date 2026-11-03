const test=require('node:test'),assert=require('node:assert/strict');
const F=require('./filter-state'),E=require('./entity-data'),G=require('./purchase-guide'),D=require('./plan-directory'),Flow=require('./purchase-guide-flow'),Cards=require('./offer-results');
const {fixtureContext}=require('./test-fixtures.cjs');
function context(){
 const plans=[
  {slug:'discount',monthlyPrice:100,firstMonthPrice:9},
  {slug:'regular-cheap',monthlyPrice:10,firstMonthPrice:20},
  {slug:'free',monthlyPrice:50,firstMonthPrice:0},
  {slug:'unknown',monthlyPrice:1,firstMonthPrice:'不适用'},
  {slug:'usd',monthlyPrice:100,firstMonthPrice:2,currency:'$'},
  {slug:'api',monthlyPrice:0,firstMonthPrice:0,billingMode:'payg'}
 ].map(p=>({name:p.slug,platformSlug:'p',currency:'¥',billingMode:'subscription',...p}));
 return fixtureContext({schemaVersion:1,platforms:[{slug:'p',name:'平台',platformStatus:'open',rating:5}]},{plans},{schemaVersion:1,models:[{slug:'m',name:'模型'}]},
  {planModels:plans.map(p=>({slug:p.slug+'--m',planSlug:p.slug,modelSlug:'m',usage:{monthlyTokenInM:100,unitPriceCnyPerM:2}}))});
}
const config={usdToCnyRate:7};
const subscriptions=offers=>offers.filter(o=>o.plan.billingMode==='subscription').map(o=>o.plan.slug);

test('首月费用保留零元、未知和外币边界，不回退常规月价也不冒充 API 固定费用',()=>{
 assert.equal(F.firstMonthCost({firstMonthPrice:0,monthlyPrice:100}),0);
 for(const firstMonthPrice of [undefined,null,'不适用'])assert.equal(F.firstMonthCost({firstMonthPrice,monthlyPrice:1}),null);
 assert.equal(F.firstMonthCost(undefined),null);
 assert.equal(F.firstMonthCost({firstMonthPrice:2,monthlyPrice:100,currency:'$'},7),14);
 assert.equal(F.firstMonthCost({firstMonthPrice:2,currency:'$'}),null);
 assert.equal(F.firstMonthCost({firstMonthPrice:2,currency:'EUR'},7),null);
 assert.equal(F.firstMonthCost({billingMode:'payg',firstMonthPrice:0,monthlyPrice:0}),null);
});

test('预算在方案、套餐目录、平台和比较点入口使用同一首月费用，源对象不变',()=>{
 const c=context(),before=JSON.stringify(c.plans),state={budgetCny:{max:15}},opts={context:c,...config};
 const plans=E.buildPlanCatalog(c).filter(p=>p.billingMode==='subscription');
 const expected=['discount','free','usd'];
 assert.deepEqual(subscriptions(F.matchingOffers(c,state,config)),expected);
 for(const options of [opts,config])assert.deepEqual(F.filterPlans(plans,state,options).map(p=>p.slug),expected);
 const points=E.buildComparisonPoints(c,7,{includeUnknown:true});
 for(const options of [opts,config])assert.deepEqual(F.filterPoints(points,state,options).filter(p=>p.billingMode==='subscription').map(p=>p.planSlug),expected);
 assert.equal(F.filterPlatforms(c.platforms,{budgetCny:{min:9,max:9}},opts).length,1);
 assert.equal(F.filterPlatforms(c.platforms,{budgetCny:{min:10,max:13},monthlyTokenRange:{min:10}},opts).length,0);
 assert.equal(JSON.stringify(c.plans),before);
});

test('首页价格优先级、卡片原币和原套餐比较使用首月费用',()=>{
 const c=context(),result=G.recommend(c,{priorities:['cost']},config,{allMatching:true});
 assert.deepEqual(subscriptions(result.candidates),['free','discount','usd','regular-cheap','unknown']);
 const usd=result.candidates.find(o=>o.plan.slug==='usd');
 assert.equal(usd.cost,14);
 const html=Cards.card(usd,F.normalizeState({}));
 assert.match(html,/\$2 \/ 首月/);assert.match(html,/<small>\/ 首月<\/small>/);assert.doesNotMatch(html,/\$100/);
 const regular=result.candidates.find(o=>o.plan.slug==='regular-cheap');
 assert.deepEqual(Flow.baselineSummary(c,{start:'existing',plan:'discount',pains:['cost']},regular,7),['首月费用比原套餐首月多 11 元']);
 assert.deepEqual(Flow.baselineSummary(c,{start:'existing',plan:'discount',pains:['cost']},{...regular,cost:9.05},7),['首月费用比原套餐首月多 0.05 元']);
 const budget=G.recommend(c,{budgetCny:{max:15}},config,{allMatching:true});
 assert.ok(budget.pending.find(o=>o.plan.slug==='unknown').unconfirmed.includes('首月费用'));
 assert.ok(budget.candidates.find(o=>o.plan.slug==='discount').reasons.some(r=>r.includes('首月费用 9 元')));
});

test('套餐默认平台内按首月价排序，明确每月价格列仍按常规月价排序',()=>{
 const c=context(),plans=E.buildPlanCatalog(c).filter(p=>p.billingMode==='subscription');
 const options={context:c,config},ids=patch=>D.select(plans,{}, {...options,...patch}).visible.map(p=>p.slug);
 assert.deepEqual(ids({}),['free','discount','usd','regular-cheap','unknown']);
 assert.deepEqual(ids({sort:{key:'monthlyPrice',direction:'asc'}}),['unknown','regular-cheap','free','discount','usd']);
});

test('按量 API 继续按月用量估算并按同一预算筛选，不以零元首月价当免费',()=>{
 const c=context();
 const candidate=max=>G.recommend(c,{platformSlugs:['p'],monthlyTokenRange:{min:10},budgetCny:{max}},config,{allMatching:true}).candidates.find(o=>o.plan.slug==='api');
 assert.equal(candidate(15),undefined);
 const api=candidate(20);assert.equal(api.cost,20);
 const html=Cards.card(api,F.normalizeState({monthlyTokenRange:{min:10}}));
 assert.match(html,/<small>\/ 月<\/small>/);assert.doesNotMatch(html,/\/ 首月/);
 assert.deepEqual(Flow.baselineSummary(c,{start:'existing',plan:'discount',pains:['cost']},api,7),['按量 API 月支出估算比原套餐首月多 11 元']);
});
