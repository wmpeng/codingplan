const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./offer-workspace.js');
const E = require('./entity-data.js');
const F = require('./filter-state.js');
const G = require('./purchase-guide.js');

test('只比较具体关系，不能由平台和模型并集产生交叉组合，也不能混入另一计费档位', () => {
  const options = [
    {key:'a-lite-x', item:{platform:{slug:'a'}, plan:{slug:'a-lite'}}, row:{slug:'a-lite-x'}},
    {key:'b-pro-y', item:{platform:{slug:'b'}, plan:{slug:'b-pro'}}, row:{slug:'b-pro-y'}}
  ];
  const rows = ['a-lite-x','a-lite-x-peak','a-pro-x','a-lite-y','b-pro-y','b-pro-x'].map(slug => ({slug}));
  assert.deepEqual(W.project(rows, options, 'points', true).map(x => x.slug), ['a-lite-x','b-pro-y']);
  assert.equal(W.project(rows, options, 'points', false), rows);
  assert.deepEqual(W.project(['a-lite','a-pro','b-pro'].map(slug => ({slug})), options, 'plans', true).map(x => x.slug), ['a-lite','b-pro']);
  assert.deepEqual(W.reconcile(['a-lite-x','stale'], options), ['a-lite-x']);
});

test('真实推荐的比较模型来自同一候选关系，投影只影响显示而不改变需求及排名', () => {
  const c = E.buildContext(require('../platforms.json'), require('../plans.json'), require('../models.json'), require('../plan-models.json'));
  c.modelGroups = require('../model-comparison-presets.json').groups;
  const config = require('../config.json');
  const state = F.createDefaultState(config);
  const before = JSON.stringify(state);
  const result = G.recommend(c, state, config), pool = W.options(result.candidates, c);
  assert.equal(new Set(pool.map(x => x.key)).size, pool.length);
  const chosen = result.groups.flatMap(([, items]) => items.map(item => W.preferredOption(item, pool)));
  for (const x of chosen) {
    assert.equal(x.item.plan.slug, x.row.planSlug);
    assert.equal(x.item.platform.slug, x.item.plan.platformSlug);
    assert.equal(x.model.slug, x.row.modelSlug);
  }
  W.project(pool.map(x => x.row), chosen, 'points', true);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(G.recommend(c, state, config).groups.map(([, items]) => items.map(x => x.id)), result.groups.map(([, items]) => items.map(x => x.id)));
});


test('首页明细保留未知关系和真实零值，未知数据不伪造为零或绘图点', () => {
  const c = E.buildContext(require('../platforms.json'), require('../plans.json'), require('../models.json'), require('../plan-models.json'));
  const all = E.buildComparisonPoints(c, 6.8, {includeUnknown:true});
  const chart = E.buildComparisonPoints(c, 6.8);
  const unknown = all.find(x => !chart.some(y => y.slug === x.slug));
  assert.ok(unknown);
  const M = require('./model-comparison.js');
  assert.equal(M.buildUsageChartPoints([unknown]).length, 0);
  assert.equal(M.buildUnitPriceBarChartPoints([unknown]).length, 0);
  assert.match(M.comparisonTableRowHtml(unknown, 'yi'), /data-point-id/);
  const relation = c.planModels.find(x => c.planBySlug.get(x.planSlug).billingMode === 'subscription');
  c.planBySlug.get(relation.planSlug).monthlyPrice = 0;
  c.planBySlug.get(relation.planSlug).comparisonMonthlyPrice = 0;
  relation.usage = {monthlyTokenInM:0, unitPriceCnyPerM:0};
  const zero = E.buildComparisonPoints(c, 6.8, {includeUnknown:true}).find(x => x.slug === relation.slug);
  assert.equal(zero.monthlyFeeCny, 0);
  assert.equal(zero.monthlyTokenInM, 0);
  assert.equal(zero.unitPriceCnyPerM, 0);
  const html = M.comparisonTableRowHtml(zero, 'yi');
  assert.match(html, /¥0 \/ 月/);
  assert.match(html, /¥0 \/ 亿/);
});
