const {fixtureContext} = require('./test-fixtures.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const EntityData = require('./entity-data.js');

test('display price basis defaults to first month without changing the regular source points', () => {
  const E=require('./entity-data.js'),saved=globalThis.CodingPlanDisplaySettings;
  try {
    delete globalThis.CodingPlanDisplaySettings;
    assert.equal(E.displayPriceBasis(),'firstMonth');
    globalThis.CodingPlanDisplaySettings={getPriceBasis:()=> 'monthly'};
    assert.equal(E.displayPriceBasis(),'monthly');
    const plan={billingMode:'subscription',monthlyPrice:100,firstMonthPrice:25};
    assert.equal(E.comparisonUnitPrice(2,plan,'firstMonth'),.5);
    assert.equal(E.comparisonUnitPrice(2,plan,'monthly'),2);
    assert.equal(E.comparisonUnitPrice(2,{...plan,billingMode:'payg'},'firstMonth'),2);
    assert.equal(plan.monthlyPrice,100);
  } finally {
    if(saved===undefined)delete globalThis.CodingPlanDisplaySettings;else globalThis.CodingPlanDisplaySettings=saved;
  }
});

test('nested public plans unfold parent identities without changing the document', () => {
  const platforms = {schemaVersion:1,platforms:[{slug:'platform-a'}]};
  const models = {schemaVersion:1,models:[{slug:'model-a'}]};
  const doc = {schemaVersion:3,workload:{tokensPerRequest:120000},plans:[
    {slug:'empty',platformSlug:'platform-a',planModels:[]},
    {slug:'plan-a',platformSlug:'platform-a',planModels:[
      {slug:'stable',modelSlug:'model-a',timeTier:'峰',usage:{monthlyTokenInM:0}},
      {slug:'unknown',modelSlug:'model-a',timeTier:'谷',usage:{monthlyTokenInM:'unknown'}}
    ]}
  ]};
  const before = JSON.stringify(doc);
  const c = EntityData.buildContext(platforms,doc,models);
  assert.deepEqual(c.plans.map(p=>p.slug),['empty','plan-a']);
  assert.deepEqual(c.relationsByPlanSlug.get('empty') || [],[]);
  assert.deepEqual(c.relationsByPlanSlug.get('plan-a').map(r=>r.slug),['stable','unknown']);
  assert.ok(c.planModels.every(r=>r.planSlug==='plan-a'));
  assert.ok(c.plans.every(p=>!Object.hasOwn(p,'planModels')));
  assert.deepEqual(c.workload,doc.workload);
  assert.equal(JSON.stringify(doc),before);
  const conflict = structuredClone(doc);
  conflict.plans[1].planModels[0].planSlug = 'wrong';
  assert.throws(()=>EntityData.buildContext(platforms,conflict,models),/planSlug/);
  assert.throws(()=>EntityData.buildContext(platforms,{...doc,schemaVersion:1},models),/schemaVersion/);
  assert.throws(()=>EntityData.buildContext(platforms,{...doc,schemaVersion:2},models),/schemaVersion/);
  const missing = structuredClone(doc);
  delete missing.plans[0].planModels;
  assert.throws(()=>EntityData.buildContext(platforms,missing,models),/planModels/);
});

test('inventory ignores every billing tier while detailed rows retain all variants', () => {
  const context = fixture();
  const plan = context.plans[0];
  plan.billingMode = 'payg';
  const relations = ['谷', '峰'].map((timeTier, i) => ({
    slug: `variant-${i}`, planSlug: plan.slug, modelSlug: 'model-a',
    timeTier, contextTier: '256K', serviceTier: '高速',
    usage: {unitPriceCnyPerM: i + 1}
  }));
  context.planModels = relations;
  context.relationsByPlanSlug.set(plan.slug, relations);
  assert.deepEqual(EntityData.platformModels(context, plan.platformSlug), [{slug:'model-a',name:'Model A'}]);
  assert.deepEqual(EntityData.buildPlanCatalog(context)[0].modelLabels, ['Model A']);
  const rows = EntityData.buildApiPricingGroups(context, plan.platformSlug)[0].rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].modelName, 'Model A');
  assert.equal(rows[0].tierLabel, '[高速] [256K] [谷]');
  assert.equal(rows[1].relationLabel, 'Model A [高速] [256K] [峰]');
  assert.equal(EntityData.buildComparisonPoints(context, 7).length, 2);
  plan.planStatus = 'delisted';
  assert.deepEqual(EntityData.platformModels(context, plan.platformSlug), []);
});

test('real catalogs keep bare identities and API platform cards do not duplicate peak rows', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const docs = ['platforms','plans','models'].map(name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', `${name}.json`), 'utf8')));
  const context = EntityData.buildContext(...docs);
  for (const plan of EntityData.buildPlanCatalog(context)) {
    assert.deepEqual(plan.modelLabels, plan.supportedModels.map(model => context.modelBySlug.get(model.slug).name));
    assert.equal(new Set(plan.supportedModels.map(model => model.slug)).size, plan.supportedModels.length);
  }
  const models = EntityData.platformModels(context, 'deepseek-official');
  assert.ok(models.length > 0);
  const html = require('./platform-catalog.js').buildPlatformCardHtml(context.platformBySlug.get('deepseek-official'), [], {hasApiPlan:true, supportedModels:models});
  assert.ok(!html.includes('[谷]'));
  assert.ok(!html.includes('[峰]'));
  assert.ok(EntityData.buildApiPricingGroups(context, 'deepseek-official').flatMap(group => group.rows).some(row => row.tierLabel.includes('[峰]')));
});

test('header counts use non-delisted platforms, active subscriptions and model identities', () => {
  const context = fixture();
  context.platforms.push({slug:'retired',platformStatus:'delisted'});
  context.plans.push(
    {slug:'old',platformSlug:'platform-a',billingMode:'subscription',planStatus: 'delisted'},
    {slug:'api',platformSlug:'platform-a',billingMode:'payg'},
    {slug:'extra',platformSlug:'platform-a',billingMode:'subscription'}
  );
  assert.deepEqual(EntityData.catalogCounts(context), {platforms:1,plans:2,models:2});
  assert.equal(EntityData.headerSubtitle(context, '31 大平台 介绍'), '1 大平台 · 2 个在售套餐 · 2 个模型<br>介绍');
  assert.equal(EntityData.headerSubtitle(null, '介绍'), '介绍');
  context.models.push({slug:'model-c'});
  assert.equal(EntityData.catalogCounts(context).models, 3);
});

test('catalogues retain historical platforms and both billing modes for callers to filter', () => {
  const context = fixture();
  context.platforms.push({slug:'retired',platformStatus:'delisted'});
  context.plans.push({slug:'api',platformSlug:'platform-a',billingMode:'payg'});
  assert.deepEqual(EntityData.listPlatforms(context).map(p=>p.slug),['platform-a','retired']);
  assert.deepEqual(EntityData.buildPlanCatalog(context).map(p=>p.slug),['plan-a','api']);
});

function fixture() {
  return fixtureContext(
    { schemaVersion: 1, platforms: [{ slug: 'platform-a', name: '平台A' }] },
    { schemaVersion: 1, plans: [{ slug: 'plan-a', platformSlug: 'platform-a', name: 'Pro', billingMode: 'subscription', monthlyPrice: 10, firstMonthPrice: 10, currency: '$' }] },
    { schemaVersion: 1, models: [
      { slug: 'model-a', name: 'Model A', multimodal: false, scores: { artificialAnalysis: { score: 10, scoreExact: 10.2, modelSlug: 'internal-source-key', sourceUrl: 'https://example.com' } } },
      { slug: 'model-b', name: 'Model B', multimodal: false, scores: {} }
    ] },
    { schemaVersion: 1, planModels: [
      { slug: 'plan-a--model-a--gu', planSlug: 'plan-a', modelSlug: 'model-a', timeTier: '谷', contextTier: null, serviceTier: null, usage: { monthlyTokenInM: 100, unitPriceCnyPerM: 0.68 }, note: null },
      { slug: 'plan-a--model-b--ctx-256k', planSlug: 'plan-a', modelSlug: 'model-b', timeTier: null, contextTier: '256K', serviceTier: null, usage: {}, note: null },
      { slug: 'plan-a--model-a', planSlug: 'plan-a', modelSlug: 'model-a', timeTier: null, contextTier: null, serviceTier: null, usage: {}, note: null }
    ] }
  );
}

test('builds explicit catalog presentation fields from slug joins', () => {
  const plan = EntityData.buildPlanCatalog(fixture())[0];
  assert.equal(plan.platformName, '平台A');
  assert.equal(plan.name, 'Pro');
  assert.deepEqual(plan.modelLabels, ['Model A', 'Model B']);
  assert.deepEqual(plan.supportedModels.map(model => model.slug), ['model-a', 'model-b']);
});

test('builds comparison points without name-based joins', () => {
  const point = EntityData.buildComparisonPoints(fixture(), 6.8)[0];
  assert.equal(point.platformSlug, 'platform-a');
  assert.equal(point.planSlug, 'plan-a');
  assert.equal(point.modelSlug, 'model-a');
  assert.equal(point.platformName, '平台A');
  assert.equal(point.planName, 'Pro');
  const context=fixture();
  context.plans[0].name='套餐正式名称';
  assert.equal(EntityData.buildComparisonPoints(context,6.8)[0].planName,'套餐正式名称');
  assert.equal(point.billingMode, 'subscription');
  assert.equal(point.monthlyFeeCny, 68);
  assert.deepEqual(point.scores, { artificialAnalysis: { score: 10, scoreExact: 10.2, sourceUrl:'https://example.com' } });
});

test('builds API pricing groups and keeps raw input cache output prices', () => {
  const context = fixtureContext(
    { schemaVersion: 1, platforms: [{ slug: 'platform-a', name: '平台A' }] },
    { schemaVersion: 1, plans: [{ slug: 'platform-a-api', platformSlug: 'platform-a', name: '按量 API', billingMode: 'payg', note: '活动说明' }] },
    { schemaVersion: 1, models: [{ slug: 'model-a', name: 'Model A', multimodal: false }] },
    { schemaVersion: 1, planModels: [{
      slug: 'platform-a-api--model-a--feng', planSlug: 'platform-a-api', modelSlug: 'model-a',
      timeTier: '峰', contextTier: null, serviceTier: null, method: 'calculated',
      usage: { unitPriceCnyPerM: 0.25 },
      pricing: { currency: '¥', inputPerM: 1, cachePerM: 0.1, outputPerM: 2 }, note: '高峰价格'
    }] }
  );
  const groups = EntityData.buildApiPricingGroups(context, 'platform-a');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].planSlug, 'platform-a-api');
  assert.equal(groups[0].planNote, '活动说明');
  assert.deepEqual(groups[0].rows[0], {
    slug: 'platform-a-api--model-a--feng', modelSlug: 'model-a', modelName: 'Model A', tierLabel: '[峰]', relationLabel: 'Model A [峰]',
    method: 'calculated', currency: '¥', inputPerM: 1, cachePerM: 0.1,
    outputPerM: 2, unitPriceCnyPerM: 0.25, note: '高峰价格'
  });
  const point = EntityData.buildComparisonPoints(context, 6.8)[0];
  assert.equal(point.billingMode, 'payg');
  assert.deepEqual(point.apiPricing, { currency: '¥', inputPerM: 1, cachePerM: 0.1, outputPerM: 2 });
  context.planModels[0].pricing.cacheWritePerM = 0;
  assert.equal(EntityData.buildApiPricingGroups(context, 'platform-a')[0].rows[0].cacheWritePerM, 0);
  assert.equal(EntityData.buildComparisonPoints(context, 6.8)[0].apiPricing.cacheWritePerM, 0);
});


test('comparison fees use generated first-month prices, preserving zero and unavailable prices', () => {
  const context=fixture(),plan=context.plans[0];
  for(const [first,expected] of [[5,34],[0,0],['不适用',null]]){
    plan.firstMonthPrice=first;
    const point=EntityData.buildComparisonPoints(context,6.8,{includeUnknown:true})[0];
    assert.equal(point.monthlyFeeCny,expected);
    assert.equal(point.originalMonthlyFee,first==='不适用'?null:first);
    assert.equal(point.unitPriceCnyPerM,.68);
    assert.equal(plan.monthlyPrice,10);
  }
});
