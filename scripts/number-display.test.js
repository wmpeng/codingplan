const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./number-display.js');
const M = require('./model-comparison.js');
const F = require('./filter-state.js');

test('额度、次数、金额、单价和套餐费用共用数值分段规则', () => {
  const samples = [
    [1234.56, '1,235'], [100.1, '100'], [100.5, '101'], [100, '100'],
    [99, '99'], [99.999, '100.00'], [12.5, '12.50'], [1.005, '1.01'],
    [0.016, '0.02'], [0.01, '0.01'], [0.00123456, '0.001235'],
    [0.000123456, '0.0001235'], [0.001, '0.001000'], [0.0001, '0.0001000'],
    [0.00999999, '0.01000'], [0.000999999, '0.001000'],
    [0.00009999, '<0.0001'], [1e-12, '<0.0001'], [0, '0'], [-0, '0'],
  ];
  for (const [value, expected] of samples) {
    for (const formatter of [N.tokens, N.count, N.amount]) assert.equal(formatter(value), expected);
    const money = expected.startsWith('<') ? '<¥' + expected.slice(1) : '¥' + expected;
    assert.equal(N.unitPrice(value), money);
    assert.equal(N.monthlyFee(value), money);
  }
});

test('不适用、未知、不限量和真实零保持独立含义', () => {
  assert.equal(N.monthlyFee('不适用'), '不适用');
  assert.equal(N.unitPrice('不适用'), '不适用');
  for (const value of [null, undefined, '', ' ', false, NaN, Infinity, 'unknown', {}]) {
    assert.equal(N.unitPrice(value), '—');
    assert.equal(N.tokens(value), '—');
  }
  assert.equal(N.tokens('unlimited'), '不限量');
  assert.equal(N.unitPrice(-1), '—');
  assert.equal(N.tokens('unknown', '未知'), '未知');
  assert.equal(N.monthlyFee(0, '$'), '$0');
});

test('单位换算后格式化，范围使用实际端点，原始数值不变', () => {
  const values = [0.10094, 0.6107, null, 'unknown'];
  assert.equal(N.range(values, value => N.tokenPrice(value, 'yi')), '¥10.09～¥61.07');
  assert.deepEqual(values, [0.10094, 0.6107, null, 'unknown']);
  assert.equal(N.range([1.931, 1.932], N.tokens), '1.93');
  assert.equal(N.range([null, 'unknown'], N.tokens), null);
  const priceEnd = value => N.unitPrice(value, '');
  assert.equal(N.range([10.09, 61.07], N.unitPrice, priceEnd), '¥10.09～61.07');
  assert.equal(N.range([0, 0.00001], N.unitPrice, priceEnd), '¥0～<0.0001');
  assert.equal(N.tokenAmount(1.23456, 'B'), '0.001235');
  assert.equal(M.formatTokenAmount(12345, 'M'), '12,345M');
  assert.equal(M.formatUnitPrice(0, 'M'), '¥0 / M');
  assert.equal(M.formatUnitPrice(0.0001, 'M'), '¥0.0001000 / M');
  assert.equal(M.formatApiPricing({inputPerM:0, cachePerM:null, outputPerM:1.2}), '输入 ¥0 · 缓存 — · 输出 ¥1.20 / M');
  const plan = {monthlyTokenOptions:[{modelSlug:'m', value:193.2}, {modelSlug:'m', value:1170}]};
  assert.equal(F.formatMonthlyTokens(plan, F.normalizeState({tokenUnit:'yi'})), '1.93–11.70 亿');
});
