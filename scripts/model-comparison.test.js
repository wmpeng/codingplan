const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ATTRACTIVE_UNIT_PRICE_CNY_PER_YI,
  DEFAULT_PLATFORM_SELECTIONS,
  DEFAULT_MODEL_SLUGS,
  COMPARISON_TABLE_COLUMNS,
  getPointScore,
  getPointPlatformKey,
  createDefaultFilterState,
  getMonthlyPriceBounds,
  priceToPercent,
  percentToPrice,
  filterPoints,
  buildUsageChartPoints,
  buildIntelligenceChartPoints,
  buildUnitPriceBarChartPoints,
  buildUnitPriceBarSeries,
  getUnitPriceBarAxisLabel,
  getAttractiveUnitPriceThreshold,
  getChartAxisBounds,
  clipRectangleAboveUnitPriceLine,
  getUnitPriceBoundaryPoints,
  buildUsageAttractiveZone,
  buildVendorColorMap,
  buildModelColorMap,
  getPointColorKey,
  filterBySoloColorKey,
  getSoloPointLabelField,
  getPointLabelText,
  sortComparisonRows,
  normalizePresetConfig,
  buildPresetComparisonRows,
  getPresetModelQualifier,
  presetComparisonTableHtml,
  tokenAmountInUnit,
  unitPriceInTokenUnit,
  formatTokenAmount,
  formatUnitPrice,
  platformCellHtml,
  comparisonTableRowHtml,
  tooltipHtml
} = require('./model-comparison.js');

const points = [
  { platformName: 'A', platformType: 'Token Plan', modelSlug: 'm1', multimodal: true, billingType: 'subscription', monthlyFeeCny: 100, monthlyTokenInM: 500, unitPriceCnyPerM: .2, scores: { artificialAnalysis: { scoreExact: 60 }, deepSWE: { scoreExact: 30 } } },
  { platformName: 'B', platformType: 'API', modelSlug: 'm2', multimodal: false, billingType: 'payg', unitPriceCnyPerM: 1.2, scores: { artificialAnalysis: { scoreExact: 45 }, deepSWE: null } },
  { platformName: 'A', platformType: 'Coding Plan', modelSlug: 'm3', multimodal: 'unknown', billingType: 'subscription', monthlyFeeCny: 50, monthlyTokenInM: 'unknown', unitPriceCnyPerM: .5, scores: { artificialAnalysis: null, deepSWE: { scoreExact: 55 } } }
];

test('default filters use the curated available platforms and models', () => {
  const defaultPoints = [
    { platformName: '阿里·百炼', platformType: 'Token Plan', modelSlug: 'deepseek-v4-pro-0813' },
    { platformName: '阿里·百炼', platformType: 'Coding Plan', modelSlug: 'not-default' },
    { platformName: 'Claude', platformType: 'Token Plan', modelSlug: 'claude-opus-5' },
    { platformName: 'OpenCode', platformType: 'Token Plan', modelSlug: 'grok-4-6' },
    { platformName: 'OpenCode', platformType: 'Token Plan', modelSlug: 'muse-spark-1-2' },
    { platformName: 'MiniMax', platformType: 'Token Plan', modelSlug: 'minimax-m3' },
    { platformName: 'DeepSeek', platformType: 'API', modelSlug: 'deepseek-v4-flash-vision-exp' }
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
    'deepseek-v4-pro-0813', 'claude-opus-5', 'muse-spark-1-2',
    'minimax-m3', 'deepseek-v4-flash-vision-exp'
  ]));
  assert.equal(DEFAULT_PLATFORM_SELECTIONS.length, 9);
  assert.equal(DEFAULT_MODEL_SLUGS.length, 13);
  assert.equal(DEFAULT_MODEL_SLUGS.includes('grok-4-6'), false);
  assert.equal(DEFAULT_MODEL_SLUGS.includes('muse-spark-1-2'), true);
  assert.equal(DEFAULT_MODEL_SLUGS.includes('minimax-m3'), true);
  assert.equal(DEFAULT_MODEL_SLUGS.includes('deepseek-v4-flash-vision-exp'), true);
  assert.equal(defaults.multimodal, 'all');
  assert.equal(defaults.aaScoreMin, '');
  assert.equal(defaults.deepSWEScoreMin, '');
  assert.equal(defaults.soloColorKey, null);
  assert.equal(defaults.tokenUnit, 'yi');
  assert.equal(defaults.monthlyPriceMin, null);
  assert.equal(defaults.monthlyPriceMax, null);
});

test('shared filters apply vendor, model, modality and exact score', () => {
  assert.deepEqual(filterPoints(points, { platforms: new Set([getPointPlatformKey(points[0])]), models: new Set(), multimodal: 'multimodal', aaScoreMin: 59.9, deepSWEScoreMin: 29 }), [points[0]]);
  assert.deepEqual(filterPoints(points, { platforms: new Set(), models: new Set(['m2']), multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '' }), [points[1]]);
  assert.deepEqual(filterPoints(points, { multimodal: 'all', aaScoreMin: 50, deepSWEScoreMin: 40 }), []);
});

test('monthly package price filter uses a logarithmic dual-slider range', () => {
  const bounds = getMonthlyPriceBounds(points);
  assert.deepEqual(bounds, { min: 50, max: 100 });
  assert.equal(priceToPercent(bounds.min, bounds), 0);
  assert.equal(Math.round(priceToPercent(bounds.max, bounds)), 100);
  assert.equal(Math.round(percentToPrice(0, bounds)), bounds.min);
  assert.equal(Math.round(percentToPrice(100, bounds)), bounds.max);
  assert.deepEqual(filterPoints(points, {
    multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '',
    monthlyPriceMin: 60, monthlyPriceMax: 120
  }), [points[0]]);
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

test('unit price bar chart keeps valid prices and sorts them low to high', () => {
  const invalid = { platformName: 'C', modelSlug: 'm4', unitPriceCnyPerM: 'unknown' };
  const sorted = buildUnitPriceBarChartPoints([points[1], invalid, points[2], points[0]]);
  assert.deepEqual(sorted, [points[0], points[2], points[1]]);
  assert.equal(getUnitPriceBarAxisLabel({ platformName: 'A', billingType: 'subscription', planName: 'Pro', modelName: 'Model [峰]' }), 'A · Pro · Model [峰]');
  assert.equal(getUnitPriceBarAxisLabel({ platformName: 'B', billingType: 'payg', modelName: 'Model API' }), 'B · 按量 API · Model API');

  const colors = buildVendorColorMap(sorted.map(getPointPlatformKey));
  const result = buildUnitPriceBarSeries(sorted, 'vendor', colors, 'M');
  assert.equal(result.categories.length, 3);
  assert.equal(result.series.length, 3);
  assert.equal(result.series.every((series) => series.type === 'bar'), true);
  assert.deepEqual(result.series.flatMap((series) => series.data).filter(Boolean).map((item) => item.value).sort((a, b) => a - b), [0.2, 0.5, 1.2]);
});

test('15 yuan per yi attractive zones keep the unit-price boundary consistent', () => {
  assert.equal(ATTRACTIVE_UNIT_PRICE_CNY_PER_YI, 15);
  assert.equal(getAttractiveUnitPriceThreshold('M'), 0.15);
  assert.equal(getAttractiveUnitPriceThreshold('yi'), 15);
  assert.deepEqual(getChartAxisBounds([39, 1360], 'log'), { min: 10, max: 10000 });

  const xBounds = { min: 10, max: 10000 };
  const yBounds = { min: 10, max: 100000 };
  const polygon = clipRectangleAboveUnitPriceLine(xBounds, yBounds, 0.15);
  assert.ok(polygon.length >= 3);
  assert.equal(polygon.every(([x, y]) => y + 1e-8 >= x / 0.15), true);
  assert.equal(getUnitPriceBoundaryPoints(xBounds, yBounds, 0.15).length, 2);

  const zoneM = buildUsageAttractiveZone([
    { monthlyFeeCny: 39, monthlyTokenInM: 100 },
    { monthlyFeeCny: 1360, monthlyTokenInM: 96000 }
  ], 'M', 'log');
  const zoneYi = buildUsageAttractiveZone([
    { monthlyFeeCny: 39, monthlyTokenInM: 100 },
    { monthlyFeeCny: 1360, monthlyTokenInM: 96000 }
  ], 'yi', 'log');
  assert.equal(zoneM.threshold, 0.15);
  assert.equal(zoneYi.threshold, 15);
  assert.deepEqual(zoneM.xBounds, zoneYi.xBounds);
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
  const samePlatformModel = { ...points[0], modelSlug: 'm4' };
  assert.equal(getSoloPointLabelField([points[0]]), 'vendor');
  assert.equal(getSoloPointLabelField([points[0], samePlatformModel]), 'model');
  assert.equal(getSoloPointLabelField([points[0], points[2]]), null);
  assert.equal(getSoloPointLabelField([points[0], points[1]]), null);
});

test('platform and model filters match legend solo point-label behavior', () => {
  const samePlatformModel = { ...points[0], modelSlug: 'm4' };
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
  assert.equal(getPointLabelText({ modelName: 'GLM-5.3-Flash [谷]', canonicalModelName: 'GLM-5.3-Flash' }, 'model'), 'GLM-5.3-Flash [谷]');
  assert.equal(getPointLabelText({ modelName: 'Kimi-K3 【256K】', canonicalModelName: 'Kimi-K3' }, 'model'), 'Kimi-K3 【256K】');
  assert.equal(getPointLabelText({ modelName: 'Model-X (peak)', canonicalModelName: 'Model-X' }, 'model'), 'Model-X (peak)');
  assert.equal(getPointLabelText({ platformName: '智谱国际版', platformType: 'Token Plan' }, 'vendor'), '智谱国际版 · Token Plan');
  assert.equal(getPointLabelText({ platformName: '智谱AI', platformType: 'Coding Plan' }, 'vendor'), '智谱AI · Coding Plan');
  assert.equal(getPointLabelText({ platformName: 'DeepSeek', platformType: 'API' }, 'vendor'), 'DeepSeek · API');
  assert.equal(getPointLabelText({ platformName: '未知平台' }, 'vendor'), '未知平台');
});

test('model color tooltip leads with the model and keeps platform second', () => {
  const point = { ...points[0], platformName: 'MiniMax', planName: '新Ultra', modelName: 'MiniMax-M3' };
  const byModel = tooltipHtml(point, 'artificialAnalysis', 'model');
  assert.ok(byModel.indexOf('<strong>MiniMax-M3</strong>') < byModel.indexOf('<div>MiniMax · 新Ultra</div>'));

  const byVendor = tooltipHtml(point, 'artificialAnalysis', 'vendor');
  assert.ok(byVendor.indexOf('<strong>MiniMax · 新Ultra</strong>') < byVendor.indexOf('<div>MiniMax-M3</div>'));
});

test('comparison tables sort text and numeric values with missing values last', () => {
  const rows = [
    { slug: 'b', platformName: '平台B', modelName: 'Model 10', monthlyFeeCny: 100, monthlyTokenInM: 50, unitPriceCnyPerM: 2 },
    { slug: 'a', platformName: '平台A', modelName: 'Model 2', monthlyFeeCny: 50, monthlyTokenInM: 100, unitPriceCnyPerM: 0.5 },
    { slug: 'c', platformName: '平台C', modelName: 'Model 1', unitPriceCnyPerM: 1 }
  ];
  assert.deepEqual(sortComparisonRows(rows, 'vendor', 'asc').map((row) => row.slug), ['a', 'b', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'model', 'asc').map((row) => row.slug), ['c', 'a', 'b']);
  assert.deepEqual(sortComparisonRows(rows, 'price', 'asc').map((row) => row.slug), ['a', 'b', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'price', 'desc').map((row) => row.slug), ['b', 'a', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'monthlyTokenInM', 'desc').map((row) => row.slug), ['a', 'b', 'c']);
});

test('unit price sorting uses package price ascending as the tie breaker', () => {
  const rows = [
    { slug: 'higher-package', monthlyFeeCny: 200, unitPriceCnyPerM: 0.5 },
    { slug: 'lower-package', monthlyFeeCny: 100, unitPriceCnyPerM: 0.5 },
    { slug: 'missing-package', unitPriceCnyPerM: 0.5 },
    { slug: 'lower-unit-price', monthlyFeeCny: 500, unitPriceCnyPerM: 0.4 }
  ];
  assert.deepEqual(sortComparisonRows(rows, 'unitPriceCnyPerM', 'asc').map((row) => row.slug), [
    'lower-unit-price', 'lower-package', 'higher-package', 'missing-package'
  ]);
});

test('preset comparisons are configured outside the renderer', () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'model-comparison-presets.json'), 'utf8'));
  const config = normalizePresetConfig(source);
  assert.equal(config.groups.length, 5);
  assert.deepEqual(config.groups.map((group) => group.kind), ['single', 'single', 'single', 'multi', 'multi']);
  assert.deepEqual(config.groups[0].modelSlugs, ['deepseek-v4-flash-0731']);
  assert.equal(config.groups[3].title, '甜品级模型对比');
  assert.deepEqual(config.groups[3].modelSlugs, ['deepseek-v4-flash-0731', 'glm-5-3-flash', 'gpt-5-6-luna']);
  assert.equal(config.groups[4].title, 'SOTA模型对比');
  assert.deepEqual(config.groups[4].modelSlugs, ['claude-opus-5', 'gpt-5-6-sol', 'glm-5-3', 'kimi-k3']);
});

test('preset rows include subscriptions and payg while sorting by unit and package price', () => {
  const group = { kind: 'single', modelSlugs: ['m1'] };
  const defaultPlatform = { platformName: '智谱AI', platformType: 'Token Plan' };
  const rows = [
    { ...defaultPlatform, slug: 'expensive', billingType: 'subscription', modelSlug: 'm1', monthlyFeeCny: 100, monthlyTokenInM: 100, unitPriceCnyPerM: 1 },
    { ...defaultPlatform, slug: 'cheap', billingType: 'subscription', modelSlug: 'm1', monthlyFeeCny: 50, monthlyTokenInM: 100, unitPriceCnyPerM: 0.5 },
    { platformName: 'DeepSeek', platformType: 'API', slug: 'api', billingType: 'payg', modelSlug: 'm1', unitPriceCnyPerM: 0.1 },
    { ...defaultPlatform, slug: 'unknown', billingType: 'subscription', modelSlug: 'm1', monthlyFeeCny: 20, monthlyTokenInM: 'unknown', unitPriceCnyPerM: 0.2 },
    { ...defaultPlatform, slug: 'other', billingType: 'subscription', modelSlug: 'm2', monthlyFeeCny: 10, monthlyTokenInM: 100, unitPriceCnyPerM: 0.1 },
    { platformName: '智谱AI', platformType: 'Coding Plan', slug: 'not-default-type', billingType: 'subscription', modelSlug: 'm1', monthlyFeeCny: 10, monthlyTokenInM: 100, unitPriceCnyPerM: 0.1 }
  ];
  assert.deepEqual(buildPresetComparisonRows(rows, group).map((row) => row.slug), ['api', 'cheap', 'expensive']);
  assert.deepEqual(buildPresetComparisonRows(rows, group, 'all').map((row) => row.slug), ['not-default-type', 'api', 'cheap', 'expensive']);
});

test('preset tables add model only for multi groups and preserve single-model qualifiers', () => {
  const point = {
    slug: 'row', billingType: 'subscription', platformName: '智谱AI', platformType: 'Token Plan', planName: 'Pro',
    modelName: 'GLM-5.3-Flash [谷]', canonicalModelName: 'GLM-5.3-Flash', modelSlug: 'glm-5-3-flash',
    monthlyFeeCny: 100, monthlyTokenInM: 1000, unitPriceCnyPerM: 0.1
  };
  assert.equal(getPresetModelQualifier(point), '[谷]');
  const single = presetComparisonTableHtml({ id: 'single', title: '单模型', kind: 'single', modelSlugs: ['glm-5-3-flash'] }, [point], 'M');
  const multi = presetComparisonTableHtml({ id: 'multi', title: '多模型', kind: 'multi', modelSlugs: ['glm-5-3-flash'] }, [point], 'yi');
  assert.match(single, /平台 \/ 套餐/);
  assert.equal(single.includes('平台 / 模型 / 套餐'), false);
  assert.equal(single.includes('按综合单价从低到高'), false);
  assert.equal(single.includes('包含：'), false);
  assert.match(single, /usage-preset-qualifier">\[谷\]/);
  assert.match(single, /¥0\.1 \/ M/);
  assert.match(multi, /平台 \/ 模型 \/ 套餐/);
  assert.equal(multi.includes('<th scope="col">模型</th>'), false);
  assert.match(multi, /包含：GLM-5\.3-Flash/);
  assert.match(multi, /GLM-5\.3-Flash \[谷\]/);
  assert.match(multi, /¥10 \/ 亿/);
  assert.match(multi, /10亿/);
});

test('preset tables show payg rows with explicit unavailable subscription fields', () => {
  const apiPoint = {
    slug: 'api', billingType: 'payg', platformName: 'DeepSeek', platformType: 'API', planName: '按量 API',
    modelName: 'DeepSeek-V4-Flash-0731', canonicalModelName: 'DeepSeek-V4-Flash-0731',
    modelSlug: 'deepseek-v4-flash-0731', unitPriceCnyPerM: 0.1
  };
  const html = presetComparisonTableHtml({
    id: 'api', title: 'API', kind: 'single', modelSlugs: ['deepseek-v4-flash-0731']
  }, [apiPoint], 'yi');
  assert.match(html, /usage-preset-price">按量<\/span>/);
  assert.match(html, /¥10 \/ 亿/);
  assert.match(html, /usage-preset-metric-secondary"><span>月用量<\/span><span>—<\/span>/);
});

test('comparison table rows format subscription and payg semantics', () => {
  const subscription = comparisonTableRowHtml({
    slug: 'sub', billingType: 'subscription', platformName: '平台A', platformType: 'Token Plan', planName: 'Pro',
    modelName: 'Model A [峰]', monthlyFeeCny: 70, fiveHourTokenInM: 12.5,
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
    slug: 'api', billingType: 'payg', platformName: 'DeepSeek', platformType: 'API', planName: '按量 API',
    modelName: 'Model A', unitPriceCnyPerM: 0.1444
  });
  assert.match(payg, /按量/);
  assert.match(payg, /¥0\.1444 \/ M/);
  assert.equal(payg.includes('0M'), false);
  assert.equal(payg.includes('undefined'), false);
});

test('platform table cell links to safe plan actions', () => {
  const linked = platformCellHtml({ platformName: '平台A', actionUrl: 'https://example.com/plan?a=1&b=2' });
  assert.match(linked, /class="usage-platform-link"/);
  assert.match(linked, /href="https:\/\/example\.com\/plan\?a=1&amp;b=2"/);
  assert.match(linked, /target="_blank"/);
  assert.match(linked, /rel="noopener noreferrer"/);
  assert.match(linked, /平台A/);

  const unlinked = platformCellHtml({ platformName: '平台B', actionUrl: 'javascript:alert(1)' });
  assert.equal(unlinked.includes('<a '), false);
  assert.match(unlinked, /平台B/);
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
    slug: 'sub-yi', billingType: 'subscription', platformName: '平台A', platformType: 'Token Plan', planName: 'Pro',
    modelName: 'Model A', monthlyFeeCny: 70, fiveHourTokenInM: 250,
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
    { slug: 'a', scores: { artificialAnalysis: { scoreExact: 50.2 }, deepSWE: { scoreExact: 20.1 } } },
    { slug: 'b', scores: { artificialAnalysis: { scoreExact: 50.8 }, deepSWE: { scoreExact: 30.4 } } },
    { slug: 'c', scores: { artificialAnalysis: null, deepSWE: null } }
  ];
  assert.deepEqual(sortComparisonRows(rows, 'artificialAnalysis', 'desc').map((row) => row.slug), ['b', 'a', 'c']);
  assert.deepEqual(sortComparisonRows(rows, 'deepSWE', 'asc').map((row) => row.slug), ['a', 'b', 'c']);
});
