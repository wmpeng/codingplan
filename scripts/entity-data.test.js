const test = require('node:test');
const assert = require('node:assert/strict');
const EntityData = require('./entity-data.js');

function fixture() {
  return EntityData.buildContext(
    { schemaVersion: 1, platforms: [{ slug: 'platform-a', name: '平台A' }] },
    { schemaVersion: 1, plans: [{ slug: 'plan-a', platformSlug: 'platform-a', name: 'Pro', type: 'Token Plan', monthlyPrice: 10, currency: '$' }] },
    { schemaVersion: 1, models: [{ slug: 'model-a', name: 'Model A', multimodal: false, scores: { artificialAnalysis: { score: 10, scoreExact: 10.2, modelSlug: 'internal-source-key', sourceUrl: 'https://example.com' } } }] },
    { schemaVersion: 1, planModels: [{ slug: 'plan-a--model-a--gu', planSlug: 'plan-a', modelSlug: 'model-a', timeTier: '谷', contextTier: null, serviceTier: null, catalogEntries: [{ order: 0, label: 'Model A [谷]' }], usage: { monthlyTokenInM: 100, unitPriceCnyPerM: 0.68 }, note: null }] }
  );
}

test('hydrates legacy presentation fields from slug joins', () => {
  const plan = EntityData.hydratePlans(fixture())[0];
  assert.equal(plan.vendor, '平台A');
  assert.equal(plan.plan, 'Pro');
  assert.deepEqual(plan.models, ['Model A [谷]']);
});

test('builds comparison points without name-based joins', () => {
  const point = EntityData.buildComparisonPoints(fixture(), 6.8)[0];
  assert.equal(point.platformSlug, 'platform-a');
  assert.equal(point.planSlug, 'plan-a');
  assert.equal(point.modelSlug, 'model-a');
  assert.equal(point.monthlyFeeCny, 68);
  assert.deepEqual(point.scores, { artificialAnalysis: { score: 10, scoreExact: 10.2 } });
});
