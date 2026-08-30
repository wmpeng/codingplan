const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPointScore,
  filterPoints,
  buildUsageChartPoints,
  buildIntelligenceChartPoints,
  buildVendorColorMap,
  buildModelColorMap,
  getPointColorKey,
  filterBySoloColorKey,
  getSoloPointLabelField,
  getPointLabelText,
  tooltipHtml
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
  assert.equal(Object.values(models).every((color) => /^#[0-9a-f]{6}$/.test(color)), true);
});

test('legend solo mode filters by the active color dimension', () => {
  assert.equal(getPointColorKey(points[0], 'vendor'), 'A');
  assert.equal(getPointColorKey(points[0], 'model'), 'm1');
  assert.deepEqual(filterBySoloColorKey(points, 'vendor', 'A'), [points[0], points[2]]);
  assert.deepEqual(filterBySoloColorKey(points, 'model', 'm2'), [points[1]]);
  assert.deepEqual(filterBySoloColorKey(points, 'vendor', null), points);
});

test('single visible model or platform selects the opposite point label', () => {
  assert.equal(getSoloPointLabelField([points[0]]), 'vendor');
  assert.equal(getSoloPointLabelField([points[0], points[2]]), 'model');
  assert.equal(getSoloPointLabelField([points[0], points[1]]), null);
});

test('platform and model filters match legend solo point-label behavior', () => {
  const platformFromFilter = filterPoints(points, { vendors: new Set(['A']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' });
  const platformFromLegend = filterBySoloColorKey(points, 'vendor', 'A');
  assert.equal(getSoloPointLabelField(platformFromFilter), 'model');
  assert.equal(getSoloPointLabelField(platformFromLegend), 'model');

  const modelFromFilter = filterPoints(points, { models: new Set(['m1']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' });
  const modelFromLegend = filterBySoloColorKey(points, 'model', 'm1');
  assert.equal(getSoloPointLabelField(modelFromFilter), 'vendor');
  assert.equal(getSoloPointLabelField(modelFromLegend), 'vendor');
});

test('model point labels preserve complete bracket qualifiers', () => {
  assert.equal(getPointLabelText({ model: 'GLM-5.3-Flash [off-peak]', canonicalModel: 'GLM-5.3-Flash' }, 'model'), 'GLM-5.3-Flash [off-peak]');
  assert.equal(getPointLabelText({ model: 'Kimi-K3 【256K】', canonicalModel: 'Kimi-K3' }, 'model'), 'Kimi-K3 【256K】');
  assert.equal(getPointLabelText({ model: 'Model-X (peak)', canonicalModel: 'Model-X' }, 'model'), 'Model-X (peak)');
  assert.equal(getPointLabelText({ vendor: '智谱国际版' }, 'vendor'), '智谱国际版');
});

test('model color tooltip leads with the model and keeps platform second', () => {
  const point = { ...points[0], vendor: 'MiniMax', plan: '新Ultra', model: 'MiniMax-M3' };
  const byModel = tooltipHtml(point, 'artificialAnalysis', 'model');
  assert.ok(byModel.indexOf('<strong>MiniMax-M3</strong>') < byModel.indexOf('<div>MiniMax · 新Ultra</div>'));

  const byVendor = tooltipHtml(point, 'artificialAnalysis', 'vendor');
  assert.ok(byVendor.indexOf('<strong>MiniMax · 新Ultra</strong>') < byVendor.indexOf('<div>MiniMax-M3</div>'));
});
