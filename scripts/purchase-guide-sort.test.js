const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./purchase-guide');
const {fixtureContext} = require('./test-fixtures.cjs');

function catalog(platforms, plans) {
  return fixtureContext({schemaVersion:1,platforms:platforms.map(platform=>({platformStatus:'open',...platform}))},
    {plans:plans.map(plan=>({rating:3,billingMode:'subscription',currency:'CNY',monthlyPrice:100,...plan}))},
    {schemaVersion:1,models:[{slug:'m',modalities:{input:['text'],output:['text']}}]},
    {planModels:plans.map(plan=>({slug:plan.slug+'-m',planSlug:plan.slug,modelSlug:'m',
      usage:{monthlyTokenInM:1000,unitPriceCnyPerM:plan.unitPrice ?? null}}))});
}
const result = (context, state = {}) => G.recommend(context,{priorities:['balanced'],...state},
  {usdToCnyRate:7},{allMatching:true});
const ids = items => items.map(item=>item.id);

test('综合排序先确定平台顺序，同分按平台目录，不被套餐评分、价格或精选打散', () => {
  const c=catalog([{slug:'low',rating:1},{slug:'first',rating:5},{slug:'second',rating:5},{slug:'high',rating:6}], [
    {slug:'second-best',platformSlug:'second',rating:5,monthlyPrice:0},
    {slug:'first-low',platformSlug:'first',rating:1,monthlyPrice:100},
    {slug:'high',platformSlug:'high',rating:1,monthlyPrice:1000},
    {slug:'low',platformSlug:'low',rating:5,monthlyPrice:0},
    {slug:'first-best',platformSlug:'first',rating:4,monthlyPrice:200},
  ]);
  c.featuredPlatformSlugs=['second'];c.modelGroups=[{enabled:true,modelSlugs:['m']}];
  const before=JSON.stringify(c);
  assert.deepEqual(ids(result(c).candidates),['high','first-best','first-low','second-best','low']);
  assert.equal(JSON.stringify(c),before);
});

test('平台内按套餐评分、人民币首月费用、套餐原序，零元保留且未知价格排后', () => {
  const c=catalog([{slug:'p',rating:5}], [
    {slug:'same-first',platformSlug:'p',rating:5,firstMonthPrice:14,currency:'USD'},
    {slug:'expensive',platformSlug:'p',rating:5,firstMonthPrice:200},
    {slug:'low-rating',platformSlug:'p',rating:1,firstMonthPrice:1},
    {slug:'same-second',platformSlug:'p',rating:5,firstMonthPrice:98},
    {slug:'cheap',platformSlug:'p',rating:5,firstMonthPrice:90},
    {slug:'unknown',platformSlug:'p',rating:5,firstMonthPrice:null},
    {slug:'free',platformSlug:'p',rating:5,firstMonthPrice:0},
  ]);
  assert.deepEqual(ids(result(c).candidates),['free','cheap','same-first','same-second','expensive','unknown','low-rating']);
  c.plans.reverse();
  assert.deepEqual(ids(result(c).candidates),['free','cheap','same-second','same-first','expensive','unknown','low-rating']);
});

test('评分零与缺失均视为待评定，平台用原序，套餐继续比较价格', () => {
  const c=catalog([{slug:'missing'},{slug:'zero',rating:0},{slug:'rated',rating:1}], [
    {slug:'zero-platform',platformSlug:'zero',rating:5},
    {slug:'missing-plan',platformSlug:'missing',rating:null,monthlyPrice:5},
    {slug:'zero-plan',platformSlug:'missing',rating:0,monthlyPrice:1},
    {slug:'rated-plan',platformSlug:'missing',rating:1,monthlyPrice:100},
    {slug:'rated-platform',platformSlug:'rated',rating:0},
  ]);
  assert.deepEqual(ids(result(c).candidates),['rated-platform','rated-plan','zero-plan','missing-plan','zero-platform']);
});

test('综合排序的 API 价格沿用目标月用量估算，无用量时不把 API 当免费', () => {
  const c=catalog([{slug:'p',rating:5}], [
    {slug:'api-expensive',platformSlug:'p',billingMode:'payg',unitPrice:0.2},
    {slug:'subscription',platformSlug:'p',monthlyPrice:1,firstMonthPrice:50},
    {slug:'api-cheap',platformSlug:'p',billingMode:'payg',unitPrice:0.1},
  ]);
  assert.deepEqual(ids(result(c,{monthlyTokenRange:{min:100}}).candidates),['api-cheap','api-expensive','subscription']);
  assert.deepEqual(ids(result(c).candidates),['subscription','api-expensive','api-cheap']);
});

test('综合排序也用于备选，待确认直接排除，其他三种排序仍保留精选破同分', () => {
  const c=catalog([{slug:'p',rating:5,supportsHarnessApi:null}], [
    {slug:'low',platformSlug:'p',rating:1,monthlyPrice:10},
    {slug:'best',platformSlug:'p',rating:5,monthlyPrice:100},
    {slug:'middle',platformSlug:'p',rating:3,monthlyPrice:50},
  ]);
  const s={budgetCny:{max:0}},before=JSON.stringify(s);
  assert.deepEqual(ids(result(c,s).alternatives),['best','middle','low']);
  assert.equal(JSON.stringify(s),before);
  const unknown=result(c,{usageEntry:'third-party'});assert.deepEqual(unknown.candidates,[]);assert.deepEqual(unknown.alternatives,[]);assert.equal(Object.hasOwn(unknown,'pending'),false);
  const tie=catalog([{slug:'first',rating:5},{slug:'featured',rating:5}], [
    {slug:'first',platformSlug:'first'},{slug:'featured',platformSlug:'featured'},
  ]);
  tie.featuredPlatformSlugs=['featured'];
  assert.deepEqual(ids(result(tie).candidates),['first','featured']);
  for(const sort of ['volume','cost','quality'])
    assert.deepEqual(ids(result(tie,{priorities:[sort]}).candidates),['featured','first']);
});

test('放宽用量或模型要求不能重新引入原条件下待确认的套餐，未知的无关字段不形成门槛', () => {
  const c=catalog([{slug:'p',rating:5}], [
    {slug:'partial-quota',platformSlug:'p',rating:5,monthlyPrice:25},
    {slug:'unknown-cost',platformSlug:'p',rating:5,firstMonthPrice:null},
    {slug:'partial-api',platformSlug:'p',rating:5,billingMode:'payg',unitPrice:0.01},
    {slug:'known',platformSlug:'p',rating:3,monthlyPrice:10},
  ]);
  const model={slug:'n',modalities:{input:['text'],output:['text']}};
  c.models.push(model);c.modelBySlug.set('n',model);
  for(const plan of c.plans){
    const rows=c.relationsByPlanSlug.get(plan.slug);
    if(plan.slug==='known')rows[0].usage.monthlyTokenInM=100;
    const row={slug:plan.slug+'-n',planSlug:plan.slug,modelSlug:'n',usage:{
      monthlyTokenInM:plan.slug==='partial-quota'?null:plan.slug==='known'?100:1000,
      unitPriceCnyPerM:null}};
    rows.push(row);c.planModels.push(row);
  }
  const state={budgetCny:{max:30},monthlyTokenRange:{min:500},modelSlugs:['m','n'],modelMatch:'all'};
  const r=result(c,state);
  assert.deepEqual(r.candidates,[]);
  assert.deepEqual(ids(r.alternatives),['known']);
  assert.equal(Object.hasOwn(r,'pending'),false);
  const unrestricted=result(c).candidates;
  assert.ok(unrestricted.some(item=>item.id==='unknown-cost'));
  assert.ok(unrestricted.some(item=>item.id==='partial-quota'));
});
