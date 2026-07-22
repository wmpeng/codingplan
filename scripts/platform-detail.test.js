const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildDetailBodyHtml } = require('./platform-detail.js');

function samplePlatform(overrides = {}) {
  return {
    id: 'demo',
    name: 'Demo Platform',
    rating: 4,
    status: 'active',
    platformStatus: 'open',
    dimensions: {
      value: { score: 5, reason: '短理由', detail: '长详解' },
      stability: { score: 3, reason: '稳定短' },
      models: { score: 4, reason: '模型短' }
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
        models: { score: 4, reason: '模型短' }
}
    });
    const html = buildDetailBodyHtml(platform, { plans: [], monitorRow: null });
    assert.ok(html.includes('仅短理由'));
    assert.ok(html.includes('性价比'));
  });

  it('renders platform overview from detail, falls back to summary, omits when empty', () => {
    const withDetail = buildDetailBodyHtml(
      samplePlatform({ summary: '卡面短', detail: '浮层长文案' }),
      { plans: [], monitorRow: null }
    );
    assert.ok(withDetail.includes('data-section="overview"'));
    assert.ok(withDetail.includes('platform-detail-overview'));
    assert.ok(withDetail.includes('浮层长文案'));
    assert.ok(!withDetail.includes('卡面短'));
    assert.ok(!withDetail.includes('总述'));

    const summaryOnly = buildDetailBodyHtml(
      samplePlatform({ summary: '只有简要' }),
      { plans: [], monitorRow: null }
    );
    assert.ok(summaryOnly.includes('data-section="overview"'));
    assert.ok(summaryOnly.includes('只有简要'));

    const none = buildDetailBodyHtml(samplePlatform(), { plans: [], monitorRow: null });
    assert.ok(!none.includes('data-section="overview"'));
  });

  it('renders payg pricing section when paygEntry provided', () => {
    const html = buildDetailBodyHtml(samplePlatform({ id: 'gongji', name: '共继算力' }), {
      plans: [],
      monitorRow: null,
      paygEntry: {
        currency: '¥',
        notes: ['须邀请'],
        models: [{ name: 'DeepSeek-V4-Pro', input: 2.4, cache: 0.02, output: 4.8 }]
      }
    });
    assert.ok(html.includes('data-section="payg"'));
    assert.ok(html.includes('按量定价'));
    assert.ok(html.includes('¥2.4'));
    assert.ok(html.includes('在按量计价大表中查看'));
    assert.ok(html.includes('href="payg.html"'));
    assert.ok(!html.includes('data-section="plans"'));
    const dimsAt = html.indexOf('data-section="dimensions"');
    const paygAt = html.indexOf('data-section="payg"');
    assert.ok(dimsAt >= 0 && paygAt > dimsAt);
  });

  it('renders pin button in detail header', () => {
    const html = buildDetailBodyHtml(samplePlatform({ id: 'opencode', name: 'OpenCode' }), {
      plans: [],
      monitorRow: null,
      isPinned: true
    });
    assert.match(html, /data-platform-pin="1"/);
    assert.match(html, /platform-detail-pin-btn/);
    assert.match(html, /aria-pressed="true"/);
  });

  it('renders plans section when vendor has plans', () => {
    const plans = [
      {
        vendor: 'X',
        plan: 'Pro',
        type: 'Token Plan',
        monthlyPrice: 100,
        firstMonthPrice: 90,
        rating: 4,
        tokenLimit: 600,
        summary: '额度充足，适合主力日常',
        discontinued: false
      },
      { vendor: 'X', plan: 'Old', type: 'Coding Plan', monthlyPrice: 50, discontinued: true }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('platform-detail-plans-list'));
    assert.ok(html.includes('platform-detail-plan-title-row'));
    assert.ok(html.includes('Pro'));
    assert.ok(!html.includes('Old'));
    assert.ok(html.includes('600M Token'));
    assert.ok(html.includes('¥100'));
    assert.ok(html.includes('首月'));
    assert.ok(html.includes('platform-detail-price-sep'));
    assert.ok(html.includes('Token Plan'));
    assert.ok(html.includes('platform-detail-plan-rating'));
    assert.ok(html.includes('额度充足，适合主力日常'));
    assert.ok(html.includes('在套餐大表中查看'));
  });

  it('omits empty summary and keeps price on one line without first-month when absent', () => {
    const plans = [
      {
        vendor: 'X',
        plan: 'Lite',
        type: 'Coding Plan',
        monthlyPrice: 49,
        firstMonthPrice: '-',
        rating: 3,
        monthlyRequests: 1900,
        tokenLimit: '无限制',
        summary: '   ',
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('Lite'));
    assert.ok(html.includes('1,900次/月') || html.includes('1900'));
    assert.ok(!html.includes('platform-detail-plan-summary'));
    assert.ok(!html.includes('platform-detail-price-sep'));
    assert.ok(!html.includes('首月'));
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
    assert.ok(html.includes('platform-detail-plan-main'));
    assert.ok(!html.includes('未公开'));
    assert.ok(!html.includes('platform-detail-plan-quota'));
  });

  it('omits quota pill for 无限制 / 未公开 / 0', () => {
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
      },
      {
        vendor: 'Kimi',
        plan: 'Zero',
        type: 'Token Plan',
        monthlyPrice: 1,
        tokenLimit: 0,
        discontinued: false
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ name: 'Kimi' }), { plans, monitorRow: null });
    assert.ok(html.includes('Andante'));
    assert.ok(html.includes('Zero'));
    assert.ok(!html.includes('未公开'));
    assert.ok(!html.includes('无限制'));
    assert.ok(!html.includes('84M'));
    assert.ok(!html.includes('0M'));
    assert.ok(!html.includes('platform-detail-plan-quota'));
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
        // 后端 7 天率仅作参考；展示应按可见条带重算：绿+黄 / 非灰 = 2/3
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
    assert.ok(html.includes('66.7% 可用'));
    assert.ok(!html.includes('98.7% 可用'));
    assert.ok(html.includes('近 48 小时'));
    assert.ok(html.includes('platform-detail-hour-cell--green'));
    assert.ok(html.includes('platform-detail-hour-cell--yellow'));
    assert.ok(html.includes('查看完整可用性'));
  });

  it('availability rate uses last 48 hours only', () => {
    const olderRed = Array.from({ length: 48 }, () => ({ color: 'red' }));
    const recentGreen = Array.from({ length: 48 }, () => ({ color: 'green' }));
    const html = buildDetailBodyHtml(samplePlatform({ name: 'MiniMax' }), {
      plans: [],
      monitorRow: {
        platform_slug: 'minimax',
        availability_rate: 0.5,
        hours: olderRed.concat(recentGreen)
      }
    });
    assert.ok(html.includes('100.0% 可用'));
    assert.ok(!html.includes('50.0% 可用'));
  });

  it('omits availability when monitorRow null', () => {
    const html = buildDetailBodyHtml(samplePlatform(), { plans: [], monitorRow: null });
    assert.ok(!html.includes('data-section="availability"'));
  });
});
