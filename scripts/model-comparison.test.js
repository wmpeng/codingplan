const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PLATFORM_SELECTIONS,
  DEFAULT_MODEL_IDS,
  COMPARISON_TABLE_COLUMNS,
  getPointScore,
  getPointPlatformKey,
  createDefaultFilterState,
  filterPoints,
  buildUsageChartPoints,
  buildIntelligenceChartPoints,
  buildVendorColorMap,
  buildModelColorMap,
  getPointColorKey,
  filterBySoloColorKey,
  getSoloPointLabelField,
  getPointLabelText,
  sortComparisonRows,
  tokenAmountInUnit,
  unitPriceInTokenUnit,
  formatTokenAmount,
  formatUnitPrice,
  comparisonTableRowHtml,
  tooltipHtml
} = require('./model-comparison.js');

const points = [
  { vendor: 'A', platformType: 'Token Plan', canonicalModelId: 'm1', multimodal: true, billingType: 'subscription', monthlyFeeCny: 100, monthlyTokenInM: 500, unitPriceCnyPerM: .2, scores: { artificialAnalysis: { scoreExact: 60 }, deepSWE: { scoreExact: 30 } } },
  { vendor: 'B', platformType: 'API', canonicalModelId: 'm2', multimodal: false, billingType: 'payg', unitPriceCnyPerM: 1.2, scores: { artificialAnalysis: { scoreExact: 45 }, deepSWE: null } },
  { vendor: 'A', platformType: 'Coding Plan', canonicalModelId: 'm3', multimodal: 'unknown', billingType: 'subscription', monthlyFeeCny: 50, monthlyTokenInM: 'unknown', unitPriceCnyPerM: .5, scores: { artificialAnalysis: null, deepSWE: { scoreExact: 55 } } }
];

test('default filters use the curated available platforms and models', () => {
  const defaultPoints = [
    { vendor: '阿里·百炼', platformType: 'Token Plan', canonicalModelId: 'deepseek-v4-pro-0813' },
    { vendor: '阿里·百炼', platformType: 'Coding Plan', canonicalModelId: 'not-default' },
    { vendor: 'Claude', platformType: 'Token Plan', canonicalModelId: 'claude-opus-5' },
    { vendor: 'OpenCode', platformType: 'Token Plan', canonicalModelId: 'grok-4-6' },
    { vendor: 'OpenCode', platformType: 'Token Plan', canonicalModelId: 'muse-spark-1-2' },
    { vendor: 'MiniMax', platformType: 'Token Plan', canonicalModelId: 'minimax-m3' },
    { vendor: 'DeepSeek', platformType: 'API', canonicalModelId: 'deepseek-v4-flash-vision-exp' }
  ];
  const defaults = createDefaultFilterState(defaultPoints);
  assert.deepEqual(defaults.platforms, new Set([
    getPointPlatformKey(defaultPoints[0]),
    getPointPlatformKey(defaultPoints[2]),
    getPointPlatformKey(defaultPoints[6]),
    getPointPlatformKey(defaultPoints[5]),
    getPointPlatformKey(defaultPoints[3])
  ]));
  assert.deepEqual(defaults.models, new Set([
    'deepseek-v4-pro-0813', 'claude-opus-5', 'grok-4-6', 'muse-spark-1-2',
    'minimax-m3', 'deepseek-v4-flash-vision-exp'
  ]));
  assert.equal(DEFAULT_PLATFORM_SELECTIONS.length, 9);
  assert.equal(DEFAULT_MODEL_IDS.length, 14);
  assert.equal(DEFAULT_MODEL_IDS.includes('grok-4-6'), true);
  assert.equal(DEFAULT_MODEL_IDS.includes('muse-spark-1-2'), true);
  assert.equal(DEFAULT_MODEL_IDS.includes('minimax-m3'), true);
  assert.equal(DEFAULT_MODEL_IDS.includes('deepseek-v4-flash-vision-exp'), true);
  assert.equal(defaults.multimodal, 'all');
  assert.equal(defaults.aaScoreMin, '');
  assert.equal(defaults.deepSWEScoreMin, '');
  assert.equal(defaults.soloColorKey, null);
  assert.equal(defaults.tokenUnit, 'M');
});

test('shared filters apply vendor, model, modality and exact score', () => {
  assert.deepEqual(filterPoints(points, { platforms: new Set([getPointPlatformKey(points[0])]), models: new Set(), multimodal: 'multimodal', aaScoreMin: 59.9, deepSWEScoreMin: 29 }), [points[0]]);
  assert.deepEqual(filterPoints(points, { platforms: new Set(), models: new Set(['m2']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' }), [points[1]]);
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
  const manyPlatforms = Array.from({ length: 30 }, (_, index) => `platform-${index}`);
  const manyColors = buildVendorColorMap(manyPlatforms);
  assert.deepEqual(manyColors, buildVendorColorMap([...manyPlatforms].reverse()));
  assert.equal(new Set(Object.values(manyColors)).size, manyPlatforms.length);
  assert.equal(Object.values(manyColors).every((color) => /^#[0-9a-f]{6}$/.test(color)), true);
  const models = buildModelColorMap(['m3', 'm1', 'm2']);
  assert.deepEqual(models, buildModelColorMap(['m2', 'm1', 'm3']));
  assert.equal(new Set(Object.values(models)).size, 3);
  assert.equal(Object.values(models).every((color) => /^#[0-9a-f]{6}$/.test(color)), true);
});

test('legend solo mode filters by the active color dimension', () => {
  assert.equal(getPointColorKey(points[0], 'vendor'), getPointPlatformKey(points[0]));
  assert.equal(getPointColorKey(points[0], 'model'), 'm1');
  assert.deepEqual(filterBySoloColorKey(points, 'vendor', getPointPlatformKey(points[0])), [points[0]]);
  assert.deepEqual(filterBySoloColorKey(points, 'model', 'm2'), [points[1]]);
  assert.deepEqual(filterBySoloColorKey(points, 'vendor', null), points);
});

test('single visible model or platform selects the opposite point label', () => {
  const samePlatformModel = { ...points[0], canonicalModelId: 'm4' };
  assert.equal(getSoloPointLabelField([points[0]]), 'vendor');
  assert.equal(getSoloPointLabelField([points[0], samePlatformModel]), 'model');
  assert.equal(getSoloPointLabelField([points[0], points[2]]), null);
  assert.equal(getSoloPointLabelField([points[0], points[1]]), null);
});

test('platform and model filters match legend solo point-label behavior', () => {
  const samePlatformModel = { ...points[0], canonicalModelId: 'm4' };
  const platformFromFilter = filterPoints([...points, samePlatformModel], { platforms: new Set([getPointPlatformKey(points[0])]), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' });
  const platformFromLegend = filterBySoloColorKey([...points, samePlatformModel], 'vendor', getPointPlatformKey(points[0]));
  assert.equal(getSoloPointLabelField(platformFromFilter), 'model');
  assert.equal(getSoloPointLabelField(platformFromLegend), 'model');

  const modelFromFilter = filterPoints(points, { models: new Set(['m1']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' });
  const modelFromLegend = filterBySoloColorKey(points, 'model', 'm1');
  assert.equal(getSoloPointLabelField(modelFromFilter), 'vendor');
  assert.equal(getSoloPointLabelField(modelFromLegend), 'vendor');
});

test('platform filter key separates plan types for the same vendor', () => {
  assert.notEqual(getPointPlatformKey(points[0]), getPointPlatformKey(points[2]));
  assert.deepEqual(JSON.parse(getPointPlatformKey(points[0])), ['A', 'Token Plan']);
  assert.equal(/[\u0000-\u001f]/.test(getPointPlatformKey(points[0])), false);
  assert.notEqual(getPointColorKey(points[0], 'vendor'), getPointColorKey(points[2], 'vendor'));
  assert.deepEqual(filterPoints(points, { platforms: new Set([getPointPlatformKey(points[0])]), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' }), [points[0]]);
  assert.deepEqual(filterBySoloColorKey(points, 'vendor', getPointPlatformKey(points[0])), [points[0]]);
});

test('model point labels preserve complete bracket qualifiers', () => {
  assert.equal(getPointLabelText({ model: 'GLM-5.3-Flash [谷]', canonicalModel: 'GLM-5.3-Flash' }, 'model'), 'GLM-5.3-Flash [谷]');
  assert.equal(getPointLabelText({ model: 'Kimi-K3 【256K】', canonicalModel: 'Kimi-K3' }, 'model'), 'Kimi-K3 【256K】');
  assert.equal(getPointLabelText({ model: 'Model-X (peak)', canonicalModel: 'Model-X' }, 'model'), 'Model-X (peak)');
  assert.equal(getPointLabelText({ vendor: '智谱国际版', platformType: 'Token Plan' }, 'vendor'), '智谱国际版 · Token Plan');
  assert.equal(getPointLabelText({ vendor: '智谱AI', platformType: 'Coding Plan' }, 'vendor'), '智谱AI · Coding Plan');
  assert.equal(getPointLabelText({ vendor: 'DeepSeek', platformType: 'API' }, 'vendor'), 'DeepSeek · API');
  assert.equal(getPointLabelText({ vendor: '未知平台' }, 'vendor'), '未知平台');
});

test('model color tooltip leads with the model and keeps platform second', () => {
  const point = { ...points[0], vendor: 'MiniMax', plan: '新Ultra', model: 'MiniMax-M3' };
  const byModel = tooltipHtml(point, 'artificialAnalysis', 'model');
  assert.ok(byModel.indexOf('<strong>MiniMax-M3</strong>') < byModel.indexOf('<div>MiniMax · 新Ultra</div>'));

  const byVendor = tooltipHtml(point, 'artificialAnalysis', 'vendor');
  assert.ok(byVendor.indexOf('<strong>MiniMax · 新Ultra</strong>') < byVendor.indexOf('<div>MiniMax-M3</div>'));
});

test('comparison tables sort text and numeric values with missing values last', () => {
  const rows = [
    { id: 'b', vendor: '平台B', model: 'Model 10', monthlyFeeCny: 100, monthlyTokenInM: 50, unitPriceCnyPerM: 2 },
    { id: 'a', vendor: '平台A', model: 'Model 2', monthlyFeeCny: 50, monthlyTokenInM: 100, unitPriceCnyPerM: 0.5 },
    { id: 'c', vendor: '平台C', model: 'Model 1', unitPriceCnyPerM: 1 }
  ];
  assert.deepEqual(sortComparisonRows(rows, 'vendor', 'asc').map((row) => row.id), ['a', 'b', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'model', 'asc').map((row) => row.id), ['c', 'a', 'b']);
  assert.deepEqual(sortComparisonRows(rows, 'price', 'asc').map((row) => row.id), ['a', 'b', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'price', 'desc').map((row) => row.id), ['b', 'a', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'monthlyTokenInM', 'desc').map((row) => row.id), ['a', 'b', 'c']);
});

test('comparison table rows format subscription and payg semantics', () => {
  const subscription = comparisonTableRowHtml({
    id: 'sub', billingType: 'subscription', vendor: '平台A', platformType: 'Token Plan', plan: 'Pro',
    model: 'Model A [峰]', monthlyFeeCny: 70, fiveHourTokenInM: 12.5,
    weeklyTokenInM: 50, monthlyTokenInM: 100, unitPriceCnyPerM: 0.7,
    scores: {
      artificialAnalysis: { score: 52, scoreExact: 51.6 },
      deepSWE: { score: 41, scoreExact: 40.7, confidenceInterval: 3 }
    },
    note: '按官方额度推算'
  });
  assert.match(subscription, /平台A/);
  assert.match(subscription, /¥70 \/ 月/);
  assert.match(subscription, /Model A \[峰\]/);
  assert.match(subscription, /12\.5M/);
  assert.match(subscription, /50M/);
  assert.match(subscription, /100M/);
  assert.match(subscription, /¥0\.7 \/ M/);
  assert.match(subscription, />52</);
  assert.match(subscription, /41 ±3/);
  assert.match(subscription, /按官方额度推算/);

  const payg = comparisonTableRowHtml({
    id: 'api', billingType: 'payg', vendor: 'DeepSeek', platformType: 'API', plan: '按量 API',
    model: 'Model A', unitPriceCnyPerM: 0.1444
  });
  assert.match(payg, /按量/);
  assert.match(payg, /¥0\.1444 \/ M/);
  assert.equal(payg.includes('0M'), false);
  assert.equal(payg.includes('undefined'), false);
});

test('token unit conversion keeps amount and unit price mathematically aligned', () => {
  assert.equal(tokenAmountInUnit(250, 'M'), 250);
  assert.equal(tokenAmountInUnit(250, 'yi'), 2.5);
  assert.equal(unitPriceInTokenUnit(0.2, 'M'), 0.2);
  assert.equal(unitPriceInTokenUnit(0.2, 'yi'), 20);
  assert.equal(formatTokenAmount(250, 'M'), '250M');
  assert.equal(formatTokenAmount(250, 'yi'), '2.5亿');
  assert.equal(formatUnitPrice(0.2, 'M'), '¥0.2 / M');
  assert.equal(formatUnitPrice(0.2, 'yi'), '¥20 / 亿');

  const yiRow = comparisonTableRowHtml({
    id: 'sub-yi', billingType: 'subscription', vendor: '平台A', platformType: 'Token Plan', plan: 'Pro',
    model: 'Model A', monthlyFeeCny: 70, fiveHourTokenInM: 250,
    weeklyTokenInM: 500, monthlyTokenInM: 1000, unitPriceCnyPerM: 0.2
  }, 'yi');
  assert.match(yiRow, /¥20 \/ 亿/);
  assert.match(yiRow, /2\.5亿/);
  assert.match(yiRow, /5亿/);
  assert.match(yiRow, /10亿/);
});

test('unit price column appears before all three usage columns', () => {
  const keys = COMPARISON_TABLE_COLUMNS.map((column) => column.key);
  const unitPriceIndex = keys.indexOf('unitPriceCnyPerM');
  assert.ok(unitPriceIndex < keys.indexOf('fiveHourTokenInM'));
  assert.ok(unitPriceIndex < keys.indexOf('weeklyTokenInM'));
  assert.ok(unitPriceIndex < keys.indexOf('monthlyTokenInM'));
});

test('comparison tables sort both benchmark scores by exact value', () => {
  const rows = [
    { id: 'a', scores: { artificialAnalysis: { scoreExact: 50.2 }, deepSWE: { scoreExact: 20.1 } } },
    { id: 'b', scores: { artificialAnalysis: { scoreExact: 50.8 }, deepSWE: { scoreExact: 30.4 } } },
    { id: 'c', scores: { artificialAnalysis: null, deepSWE: null } }
  ];
  assert.deepEqual(sortComparisonRows(rows, 'artificialAnalysis', 'desc').map((row) => row.id), ['b', 'a', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'deepSWE', 'asc').map((row) => row.id), ['a', 'b', 'c']);
});
