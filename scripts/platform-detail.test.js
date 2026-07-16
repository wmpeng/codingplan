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
});
