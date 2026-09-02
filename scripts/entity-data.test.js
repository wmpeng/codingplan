const test = require('node:test');
const assert = require('node:assert/strict');
const EntityData = require('./entity-data.js');

function fixture() {
  return EntityData.buildContext(
    { schemaVersion: 1, platforms: [{ slug: 'platform-a', name: '平台A' }] },
    { schemaVersion: 1, plans: [{ slug: 'plan-a', platformSlug: 'platform-a', name: 'Pro', type: 'Token Plan', monthlyPrice: 10, currency: '$' }] },
    { schemaVersion: 1, models: [{ slug: 'model-a', name: 'Model A', multimodal: false, scores: { artificialAnalysis: { score: 10, scoreExact: 10.2, modelSlug: 'internal-source-key', sourceUrl: 'https://example.com' } } }] },
    { schemaVersion: 1, planModels: [{ slug: 'plan-a--model-a--gu', planSlug: 'plan-a', modelSlug: 'model-a', timeTier: '谷', contextTier: null, serviceTier: null, catalogOrder: 0, usage: { monthlyTokenInM: 100, unitPriceCnyPerM: 0.68 }, note: null }] }
  );
}

test('builds explicit catalog presentation fields from slug joins', () => {
  const plan = EntityData.buildPlanCatalog(fixture())[0];
  assert.equal(plan.platformName, '平台A');
  assert.equal(plan.name, 'Pro');
  assert.deepEqual(plan.modelLabels, ['Model A [谷]']);
});

test('builds comparison points without name-based joins', () => {
  const point = EntityData.buildComparisonPoints(fixture(), 6.8)[0];
  assert.equal(point.platformSlug, 'platform-a');
  assert.equal(point.planSlug, 'plan-a');
  assert.equal(point.modelSlug, 'model-a');
  assert.equal(point.platformName, '平台A');
  assert.equal(point.planName, 'Pro');
  assert.equal(point.monthlyFeeCny, 68);
  assert.deepEqual(point.scores, { artificialAnalysis: { score: 10, scoreExact: 10.2 } });
});

test('builds API pricing groups and keeps raw input cache output prices', () => {
  const context = EntityData.buildContext(
    { schemaVersion: 1, platforms: [{ slug: 'platform-a', name: '平台A' }] },
    { schemaVersion: 1, plans: [{ slug: 'platform-a-api', platformSlug: 'platform-a', name: '按量 API', type: 'API', note: '活动说明' }] },
    { schemaVersion: 1, models: [{ slug: 'model-a', name: 'Model A', multimodal: false }] },
    { schemaVersion: 1, planModels: [{
      slug: 'platform-a-api--model-a--feng', planSlug: 'platform-a-api', modelSlug: 'model-a',
      timeTier: '峰', contextTier: null, serviceTier: null, catalogOrder: 0, method: 'calculated',
      usage: { unitPriceCnyPerM: 0.25 },
      pricing: { currency: '¥', inputPerM: 1, cachePerM: 0.1, outputPerM: 2 }, note: '高峰价格'
    }] }
  );
  const groups = EntityData.buildApiPricingGroups(context, 'platform-a');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].planSlug, 'platform-a-api');
  assert.equal(groups[0].planNote, '活动说明');
  assert.deepEqual(groups[0].rows[0], {
    slug: 'platform-a-api--model-a--feng', modelSlug: 'model-a', modelName: 'Model A [峰]',
    method: 'calculated', currency: '¥', inputPerM: 1, cachePerM: 0.1,
    outputPerM: 2, unitPriceCnyPerM: 0.25, note: '高峰价格'
  });
  const point = EntityData.buildComparisonPoints(context, 6.8)[0];
  assert.deepEqual(point.apiPricing, { currency: '¥', inputPerM: 1, cachePerM: 0.1, outputPerM: 2 });
});
