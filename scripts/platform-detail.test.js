const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildDetailBodyHtml } = require('./platform-detail.js');

function samplePlatform(overrides = {}) {
  return {
    id: 'demo',
    name: 'Demo Platform',
    rating: 4,
    status: 'active',
    purchaseRush: false,
    dimensions: {
      value: { score: 5, reason: '短理由', detail: '长详解' },
      stability: { score: 3, reason: '稳定短' },
      models: { score: 4, reason: '模型短' },
      convenience: { score: 4, reason: '便捷短' }
    },
    ...overrides
  };
}

describe('buildDetailBodyHtml', () => {
  it('detail section uses dimensionCopy', () => {
    const platform = samplePlatform();
    const html = buildDetailBodyHtml(platform, { plans: [], monitorRow: null });
    assert.ok(html.includes('评价详解'));
    assert.ok(html.includes('长详解'));
    assert.ok(!html.includes('data-section="plans"'));
    assert.ok(!html.includes('data-section="availability"'));
  });

  it('falls back to reason when detail missing', () => {
    const platform = samplePlatform({
      dimensions: {
        value: { score: 5, reason: '仅短理由' },
        stability: { score: 3, reason: '稳定短' },
        models: { score: 4, reason: '模型短' },
        convenience: { score: 4, reason: '便捷短' }
      }
    });
    const html = buildDetailBodyHtml(platform, { plans: [], monitorRow: null });
    assert.ok(html.includes('仅短理由'));
    assert.ok(html.includes('性价比'));
  });

  it('renders plans section when vendor has plans', () => {
    const plans = [
      { vendor: 'X', plan: 'Pro', type: 'Coding Plan', monthlyPrice: 100, discontinued: false },
      { vendor: 'X', plan: 'Old', type: 'Coding Plan', monthlyPrice: 50, discontinued: true }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('Pro'));
    assert.ok(!html.includes('Old'));
    assert.ok(!html.includes('停售'));
    assert.ok(!html.includes('状态'));
    assert.ok(html.includes('月价'));
    assert.ok(html.includes('在套餐大表中查看'));
  });

  it('hides plans section when only discontinued plans exist', () => {
    const plans = [
      { vendor: 'X', plan: 'Old', type: 'Coding Plan', monthlyPrice: 50, discontinued: true }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(!html.includes('data-section="plans"'));
  });

  it('omits plans section when empty', () => {
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans: [], monitorRow: null });
    assert.ok(!html.includes('data-section="plans"'));
  });

  it('renders availability when monitorRow present', () => {
    const html = buildDetailBodyHtml(samplePlatform({ name: 'MiniMax' }), {
      plans: [],
      monitorRow: {
        platform_slug: 'minimax',
        platform_display_name: 'MiniMax',
        availability_rate: 0.987,
        hours: []
      }
    });
    assert.ok(html.includes('data-section="availability"'));
    assert.ok(html.includes('98') || html.includes('98.7') || html.includes('99'));
    assert.ok(html.includes('查看完整可用性'));
  });

  it('omits availability when monitorRow null', () => {
    const html = buildDetailBodyHtml(samplePlatform(), { plans: [], monitorRow: null });
    assert.ok(!html.includes('data-section="availability"'));
  });
});
