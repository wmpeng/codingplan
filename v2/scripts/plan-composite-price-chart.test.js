const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getPlanCompositePriceCny,
  buildVendorColorMap,
  buildCompositePriceChartItems,
  formatCompositePriceLabel,
  VENDOR_COLOR_PALETTE
} = require('./plan-composite-price-chart.js');

describe('getPlanCompositePriceCny', () => {
  it('matches monthlyPrice / measuredMonthlyTokenLimit in CNY', () => {
    assert.equal(
      getPlanCompositePriceCny({ monthlyPrice: 49, measuredMonthlyTokenLimit: 100, currency: '¥' }, 6.8),
      0.49
    );
  });

  it('converts USD monthly price with rate', () => {
    assert.equal(
      getPlanCompositePriceCny({ monthlyPrice: 10, measuredMonthlyTokenLimit: 20, currency: '$' }, 6.8),
      3.4
    );
  });

  it('returns null when monthly or limit missing', () => {
    assert.equal(getPlanCompositePriceCny({ monthlyPrice: 49 }, 6.8), null);
    assert.equal(getPlanCompositePriceCny({ measuredMonthlyTokenLimit: 10 }, 6.8), null);
    assert.equal(getPlanCompositePriceCny({ monthlyPrice: 49, measuredMonthlyTokenLimit: 0 }, 6.8), null);
  });
});

describe('buildCompositePriceChartItems', () => {
  it('keeps only computable rows, sorts ascending, same vendor same color', () => {
    const items = buildCompositePriceChartItems(
      [
        { vendor: 'B厂', plan: '贵', monthlyPrice: 200, measuredMonthlyTokenLimit: 100 },
        { vendor: 'A厂', plan: '便宜', monthlyPrice: 40, measuredMonthlyTokenLimit: 100 },
        { vendor: 'B厂', plan: '中', monthlyPrice: 80, measuredMonthlyTokenLimit: 100 },
        { vendor: '跳过', plan: '无额度', monthlyPrice: 10 }
      ],
      { usdToCnyRate: 6.8 }
    );
    assert.deepEqual(
      items.map((x) => `${x.vendor}|${x.plan}`),
      ['A厂|便宜', 'B厂|中', 'B厂|贵']
    );
    assert.equal(items[0].price, 0.4);
    assert.equal(items[1].color, items[2].color);
    assert.notEqual(items[0].color, items[1].color);
    assert.equal(formatCompositePriceLabel(items[0].price), '¥0.40');
  });

  it('includes discontinued when present in input list', () => {
    const items = buildCompositePriceChartItems(
      [
        { vendor: 'A', plan: '在售', monthlyPrice: 40, measuredMonthlyTokenLimit: 100 },
        { vendor: 'B', plan: '下线', monthlyPrice: 10, measuredMonthlyTokenLimit: 100, discontinued: true }
      ],
      { usdToCnyRate: 6.8 }
    );
    assert.deepEqual(items.map((x) => x.plan), ['下线', '在售']);
    assert.equal(items[0].discontinued, true);
  });

  it('marks pinned without changing price sort order', () => {
    const items = buildCompositePriceChartItems(
      [
        { vendor: 'B', plan: '贵', monthlyPrice: 200, measuredMonthlyTokenLimit: 100 },
        { vendor: 'A', plan: '便宜', monthlyPrice: 40, measuredMonthlyTokenLimit: 100 },
        { vendor: 'C', plan: '中', monthlyPrice: 80, measuredMonthlyTokenLimit: 100 }
      ],
      {
        usdToCnyRate: 6.8,
        isPinned(plan) {
          return plan.plan === '贵';
        }
      }
    );
    assert.deepEqual(
      items.map((x) => `${x.plan}:${x.pinned ? 1 : 0}`),
      ['便宜:0', '中:0', '贵:1']
    );
  });

  it('assigns stable vendor colors by zh sort of vendors', () => {
    const map = buildVendorColorMap(['智谱AI', 'Kimi', '阿里·百炼']);
    const keys = [...map.keys()];
    assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'zh')));
    assert.ok(VENDOR_COLOR_PALETTE.includes(map.get('Kimi')));
  });
});
