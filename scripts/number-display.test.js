const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./number-display.js');
const M = require('./model-comparison.js');
const F = require('./filter-state.js');

test('额度保留最多三位有效数字，整数补零并分组，不使用科学计数', () => {
  const samples = [[1.932, '1.93'], [11.7, '11.7'], [12345, '12,300'], [9999, '10,000'], [0.00000012345, '0.000000123'], [999.5, '1,000'], [0, '0'], [-0, '0']];
  for (const [value, expected] of samples) assert.equal(N.tokens(value), expected);
  assert.equal(N.tokenAmount(1.23456, 'B'), '0.00123');
  assert.equal(N.tokenAmount(193.2, 'yi'), '1.93');
  assert.equal(N.tokenAmount(12345, 'M'), '12,300');
});

test('单价固定两位，月费整数，未知和真实零不混淆', () => {
  assert.equal(N.unitPrice(10.1), '¥10.10');
  assert.equal(N.unitPrice(1234.567), '¥1,234.57');
  assert.equal(N.unitPrice(0), '¥0.00');
  assert.equal(N.unitPrice(0.001), '<¥0.01');
  assert.equal(N.monthlyFee(1234.56), '¥1,235');
  assert.equal(N.monthlyFee(0.1), '<¥1');
  assert.equal(N.monthlyFee(0), '¥0');
  for (const value of [null, undefined, '', ' ', false, NaN, Infinity, 'unknown', {}]) {
    assert.equal(N.unitPrice(value), '—');
    assert.equal(N.tokens(value), '—');
  }
  assert.equal(N.tokens('unlimited'), '不限量');
  assert.equal(N.unitPrice(-1), '—');
});

test('范围使用当前关系的有效端点；转换后才格式化，保留原数值', () => {
  const values = [0.10094, 0.6107, null, 'unknown'];
  assert.equal(N.range(values, value => N.tokenPrice(value, 'yi')), '¥10.09～¥61.07');
  assert.deepEqual(values, [0.10094, 0.6107, null, 'unknown']);
  assert.equal(N.range([1.931,1.932],N.tokens), '1.93');
  assert.equal(N.range([null,'unknown'],N.tokens), null);
  assert.equal(M.formatTokenAmount(12345,'M'),'12,300M');
  assert.equal(M.formatUnitPrice(0,'M'),'¥0.00 / M');
  assert.equal(M.formatUnitPrice(0.0001,'M'),'<¥0.01 / M');
  assert.equal(M.formatApiPricing({inputPerM:0,cachePerM:null,outputPerM:1.2}),'输入 ¥0.00 · 缓存 — · 输出 ¥1.20 / M');
  const plan = {monthlyTokenOptions:[{modelSlug:'m',value:193.2},{modelSlug:'m',value:1170}]};
  assert.equal(F.formatMonthlyTokens(plan,F.normalizeState({tokenUnit:'yi'})),'1.93–11.7 亿');
});
