const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPointScore,
  filterPoints,
  buildUsageChartPoints,
  buildIntelligenceChartPoints,
  buildVendorColorMap,
  buildModelColorMap
} = require('./model-comparison.js');

const points = [
  { vendor: 'A', canonicalModelId: 'm1', multimodal: true, billingType: 'subscription', monthlyFeeCny: 100, monthlyTokenInM: 500, unitPriceCnyPerM: .2, scores: { artificialAnalysis: { scoreExact: 60 }, deepSWE: { scoreExact: 30 } } },
  { vendor: 'B', canonicalModelId: 'm2', multimodal: false, billingType: 'payg', unitPriceCnyPerM: 1.2, scores: { artificialAnalysis: { scoreExact: 45 }, deepSWE: null } },
  { vendor: 'A', canonicalModelId: 'm3', multimodal: 'unknown', billingType: 'subscription', monthlyFeeCny: 50, monthlyTokenInM: 'unknown', unitPriceCnyPerM: .5, scores: { artificialAnalysis: null, deepSWE: { scoreExact: 55 } } }
];

test('shared filters apply vendor, model, modality and exact score', () => {
  assert.deepEqual(filterPoints(points, { vendors: new Set(['A']), models: new Set(), multimodal: 'multimodal', aaScoreMin: 59.9, deepSWEScoreMin: 29 }), [points[0]]);
  assert.deepEqual(filterPoints(points, { vendors: new Set(), models: new Set(['m2']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' }), [points[1]]);
  assert.deepEqual(filterPoints(points, { multimodal: 'all', aaScoreMin: 50, deepSWEScoreMin: 40 }), []);
});

test('unknown modality only appears in all', () => {
  assert.equal(filterPoints(points, { multimodal: 'text', aaScoreMin: '', deepSWEScoreMin: '' }).includes(points[2]), false);
  assert.equal(filterPoints(points, { multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' }).includes(points[2]), true);
});

test('chart builders exclude invalid coordinates and benchmark gaps', () => {
  assert.deepEqual(buildUsageChartPoints(points), [points[0]]);
  assert.deepEqual(buildIntelligenceChartPoints(points, 'artificialAnalysis'), [points[0], points[1]]);
  assert.deepEqual(buildIntelligenceChartPoints(points, 'deepSWE'), [points[0], points[2]]);
  assert.equal(getPointScore(points[0], 'artificialAnalysis'), 60);
});

test('platform colors are stable regardless of input order', () => {
  const first = buildVendorColorMap(['B', 'A']);
  const second = buildVendorColorMap(['A', 'B']);
  assert.deepEqual(first, second);
  const models = buildModelColorMap(['m3', 'm1', 'm2']);
  assert.deepEqual(models, buildModelColorMap(['m2', 'm1', 'm3']));
  assert.equal(new Set(Object.values(models)).size, 3);
});
