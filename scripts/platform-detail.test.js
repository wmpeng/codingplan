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
    assert.ok(html.includes('platform-detail-dim-score-unit'));
    assert.ok(html.includes('>5<span class="platform-detail-dim-score-unit">分</span>'));
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
      {
        vendor: 'X',
        plan: 'Pro',
        type: 'Token Plan',
        monthlyPrice: 100,
        firstMonthPrice: 90,
        tokenLimit: 600,
        discontinued: false
      },
      { vendor: 'X', plan: 'Old', type: 'Coding Plan', monthlyPrice: 50, discontinued: true }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('platform-detail-plans-list'));
    assert.ok(html.includes('Pro'));
    assert.ok(!html.includes('Old'));
    assert.ok(html.includes('600M'));
    assert.ok(html.includes('¥100'));
    assert.ok(html.includes('首月'));
    assert.ok(html.includes('Token Plan'));
    assert.ok(html.includes('600M'));
    assert.ok(html.includes('在套餐大表中查看'));
  });

  it('summarizes coding plan quota with monthly requests when token unlimited', () => {
    const plans = [
      {
        vendor: 'X',
        plan: 'Lite',
        type: 'Coding Plan',
        monthlyPrice: 49,
        tokenLimit: '无限制',
        monthlyRequests: 24000,
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('2.4万次/月') || html.includes('24000'));
    assert.ok(html.includes('Coding Plan'));
  });

  it('hides plans section when only discontinued plans exist', () => {
    const plans = [
      { vendor: 'X', plan: 'Old', type: 'Coding Plan', monthlyPrice: 50, discontinued: true }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(!html.includes('data-section="plans"'));
  });

  it('still shows plans but omits unpublished quota label', () => {
    const plans = [
      {
        vendor: 'OpenCode',
        plan: 'Go',
        type: 'Token Plan',
        monthlyPrice: 10,
        firstMonthPrice: 5,
        currency: '$',
        tokenLimit: '未公开',
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'OpenCode' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('Go'));
    assert.ok(html.includes('Token Plan'));
    assert.ok(html.includes('$10') || html.includes('10'));
    assert.ok(!html.includes('未公开'));
    assert.ok(!html.includes('platform-detail-plan-quota'));
  });

  it('omits unlimited shell when request quotas are unpublished', () => {
    const plans = [
      {
        vendor: 'Kimi',
        plan: 'Moderato',
        type: 'Coding Plan',
        monthlyPrice: 99,
        tokenLimit: '无限制',
        fiveHoursRequests: '未公开',
        weeklyRequests: '未公开',
        monthlyRequests: '未公开',
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'Kimi' }), { plans, monitorRow: null });
    assert.ok(html.includes('Moderato'));
    assert.ok(html.includes('Coding Plan'));
    assert.ok(!html.includes('未公开'));
    assert.ok(!html.includes('无限制'));
    assert.ok(!html.includes('platform-detail-plan-quota'));
  });

  it('prefers measured monthly token when request quotas are unpublished', () => {
    const plans = [
      {
        vendor: 'Kimi',
        plan: 'Andante',
        type: 'Coding Plan',
        monthlyPrice: 49,
        tokenLimit: '无限制',
        fiveHoursRequests: '未公开',
        weeklyRequests: '未公开',
        monthlyRequests: '未公开',
        measuredMonthlyTokenLimit: 84,
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'Kimi' }), { plans, monitorRow: null });
    assert.ok(html.includes('Andante'));
    assert.ok(html.includes('84M'));
    assert.ok(!html.includes('未公开'));
    assert.ok(!html.includes('无限制'));
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
        hours: [
          { color: 'green' },
          { color: 'yellow' },
          { color: 'red' },
          { color: 'gray' }
        ]
      }
    });
    assert.ok(html.includes('data-section="availability"'));
    assert.ok(html.includes('98.7% 可用'));
    assert.ok(html.includes('近 48 小时'));
    assert.ok(html.includes('platform-detail-hour-cell--green'));
    assert.ok(html.includes('platform-detail-hour-cell--yellow'));
    assert.ok(html.includes('查看完整可用性'));
  });

  it('omits availability when monitorRow null', () => {
    const html = buildDetailBodyHtml(samplePlatform(), { plans: [], monitorRow: null });
    assert.ok(!html.includes('data-section="availability"'));
  });
});
