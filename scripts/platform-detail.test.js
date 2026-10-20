const {fixtureContext} = require('./test-fixtures.cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildDetailBodyHtml } = require('./platform-detail.js');
const EntityData = require('./entity-data.js');

function samplePlatform(overrides = {}) {
  return {
    slug: 'demo',
    slug: 'demo',
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
  it('uses the explicit platform action even when the first plan has another link', () => {
    const platform=samplePlatform({action:'https://example.com/platform'});
    const html=buildDetailBodyHtml(platform,{plans:[{slug:'p',platformSlug:platform.slug,name:'Plan',action:'https://example.com/plan'}],monitorRow:null});
    assert.match(html,/class="platform-detail-action" href="https:\/\/example\.com\/platform"/);
  });

  it('uses one canonical delisted status without a duplicate discontinued badge', () => {
    const html = buildDetailBodyHtml(samplePlatform({platformStatus:'delisted'}), {plans:[],monitorRow:null});
    assert.equal((html.match(/>已下架</g) || []).length,1);
    assert.doesNotMatch(html,/已停售/);
  });
  it('shows the complete model inventory including API-only models, deduplicates tiers and excludes discontinued plans', () => {
    const platform = samplePlatform();
    const models = Array.from({ length: 7 }, (_, index) => ({ slug: `m${index}`, name: `Model ${index}` }));
    const entityContext = fixtureContext({ schemaVersion: 1, platforms: [platform] }, { schemaVersion: 1, plans: [
      { slug: 'lite', platformSlug: 'demo', name: 'Lite', billingMode: 'subscription' },
      { slug: 'pro', platformSlug: 'demo', name: 'Pro', billingMode: 'subscription' },
      { slug: 'api', platformSlug: 'demo', name: 'API', billingMode: 'payg' },
      { slug: 'old', platformSlug: 'demo', name: 'Old', planStatus: 'delisted' }
    ] }, { schemaVersion: 1, models }, { schemaVersion: 1, planModels: [
      { planSlug: 'lite', modelSlug: 'm0' },
      { planSlug: 'lite', modelSlug: 'm0', timeTier: '谷时' },
      ...models.slice(0, 5).map(model => ({ planSlug: 'pro', modelSlug: model.slug })),
      { planSlug: 'api', modelSlug: 'm5' },
      { planSlug: 'old', modelSlug: 'm6' }
    ] });
    const html = buildDetailBodyHtml(platform, { entityContext, plans: EntityData.buildPlanCatalog(entityContext) });
    const inventory = html.match(/<section[^>]*data-section="models"[\s\S]*?<\/section>/)[0];
    for (const model of models.slice(0, 6)) assert.ok(inventory.includes(model.name));
    assert.equal((inventory.match(/>Model 0<\/span>/g) || []).length, 1);
    assert.ok(!inventory.includes('Model 6'));
    assert.match(inventory, /data-model-max-rows="2"/);
    const liteModels = html.match(/<div class="ui-model-tags platform-detail-models" data-model-tags[^>]*aria-label="Lite 支持模型">(.*?)<\/div>/)[1];
    assert.ok(liteModels.includes('Model 0'));
    assert.ok(!liteModels.includes('Model 1'));
    const proModels = html.match(/<div class="ui-model-tags platform-detail-models" data-model-tags[^>]*aria-label="Pro 支持模型">(.*?)<\/div>/)[1];
    assert.ok(proModels.includes('Model 4'));
    assert.ok(!proModels.includes('Model 5'));
  });

  it('renders model labels safely without entity context and omits empty inventories', () => {
    const html = buildDetailBodyHtml(samplePlatform(), { plans: [
      { platformSlug: 'demo', name: 'Lite', modelLabels: ['<Model & One>'], monthlyPrice: 10 },
      { platformSlug: 'other', name: 'Other', modelLabels: ['Other model'] }
    ] });
    assert.ok(html.includes('data-section="models"'));
    assert.ok(html.includes('&lt;Model &amp; One&gt;'));
    assert.ok(!html.includes('<Model & One>'));
    assert.ok(!html.includes('Other model'));
    assert.ok(!buildDetailBodyHtml(samplePlatform(), { plans: [] }).includes('data-section="models"'));
  });

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

  it('renders markdown bold/links in overview and dimension copy', () => {
    const html = buildDetailBodyHtml(
      samplePlatform({
        detail: '概览**加粗**与[链接](https://example.com/d)',
        dimensions: {
          value: {
            score: 5,
            reason: '短',
            detail: '详解见[说明](https://example.com/v)与**重点**'
          },
          models: { score: 4, reason: '模型短' },
          stability: { score: 3, reason: '稳定短' }
        }
      }),
      { plans: [], monitorRow: null }
    );
    assert.match(html, /platform-detail-overview[\s\S]*<strong>加粗<\/strong>/);
    assert.match(html, /platform-detail-overview[\s\S]*href="https:\/\/example\.com\/d"/);
    assert.match(html, /platform-detail-dim-copy[\s\S]*href="https:\/\/example\.com\/v"/);
    assert.match(html, /platform-detail-dim-copy[\s\S]*<strong>重点<\/strong>/);
  });

  it('renders API pricing from PlanModel groups and links to the comparison view', () => {
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'gongji', name: '共绩算力' }), {
      plans: [],
      monitorRow: null,
      apiPricingGroups: [{
        planSlug: 'gongji-api',
        planName: '按量 API',
        planNote: '须邀请',
        rows: [{
          slug: 'gongji-api--deepseek-v4-pro-0813',
          modelName: 'DeepSeek-V4-Pro-0813', currency: '¥',
          inputPerM: 2.4, cachePerM: 0.02, outputPerM: 4.8,
          unitPriceCnyPerM: 0.1257, note: '官方价格的 8 折'
        }]
      }]
    });
    assert.ok(html.includes('data-section="api-pricing"'));
    assert.ok(html.includes('按量 API 定价'));
    assert.ok(html.includes('¥2.4'));
    assert.ok(html.includes('¥0.02'));
    assert.ok(html.includes('¥4.8'));
    assert.ok(html.includes('官方价格的 8 折'));
    assert.ok(html.includes('在价格与额度中查看'));
    assert.ok(html.includes('href="/pricing/"'));
    assert.ok(!html.includes('view=usage'));
    assert.ok(!html.includes('data-section="plans"'));
    const dimsAt = html.indexOf('data-section="dimensions"');
    const apiAt = html.indexOf('data-section="api-pricing"');
    assert.ok(dimsAt >= 0 && apiAt > dimsAt);
  });

  it('renders pin button in detail header', () => {
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'opencode', name: 'OpenCode' }), {
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
        platformSlug: 'x',
        name: 'Pro',
        billingMode: 'subscription',
        monthlyPrice: 100,
        firstMonthPrice: 90,
        rating: 4,
        requestQuota: {fiveHours: 'unknown', weekly: 'unknown', monthly: 600},
        planStatus: 'open'
      },
      { platformSlug: 'x', name: 'Old', billingMode: 'subscription', monthlyPrice: 50, planStatus: 'delisted' }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'x', name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('platform-detail-plans-list'));
    assert.ok(html.includes('platform-detail-plan-title-row'));
    assert.ok(html.includes('Pro'));
    assert.ok(!html.includes('Old'));
    assert.ok(html.includes('600次/月'));
    assert.ok(html.includes('¥100'));
    assert.ok(html.includes('首月'));
    assert.ok(html.includes('platform-detail-price-sep'));
    assert.ok(html.includes('platform-detail-plan-rating'));
    assert.ok(html.includes('在套餐页面查看'));
  });

  it('keeps price on one line without first-month when absent', () => {
    const plans = [
      {
        platformSlug: 'x',
        name: 'Lite',
        billingMode: 'subscription',
        monthlyPrice: 49,
        firstMonthPrice: '-',
        rating: 3,
        requestQuota: {fiveHours: 'unknown', weekly: 'unknown', monthly: 1900},
        planStatus: 'open'
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'x', name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('Lite'));
    assert.ok(html.includes('1,900次/月') || html.includes('1900'));
    assert.ok(!html.includes('platform-detail-price-sep'));
    assert.ok(!html.includes('首月'));
  });

  it('summarizes coding plan quota with monthly requests when token unlimited', () => {
    const plans = [
      {
        platformSlug: 'x',
        name: 'Lite',
        billingMode: 'subscription',
        monthlyPrice: 49,
        requestQuota: {fiveHours: 'unknown', weekly: 'unknown', monthly: 24000},
        planStatus: 'open'
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'x', name: 'X' }), { plans, monitorRow: null });
    assert.ok(html.includes('2.4万次/月') || html.includes('24000'));
  });

  it('hides plans section when only discontinued plans exist', () => {
    const plans = [
      { platformSlug: 'x', name: 'Old', billingMode: 'subscription', monthlyPrice: 50, planStatus: 'delisted' }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'x', name: 'X' }), { plans, monitorRow: null });
    assert.ok(!html.includes('data-section="plans"'));
  });

  it('still shows plans but omits unpublished quota label', () => {
    const plans = [
      {
        platformSlug: 'opencode',
        name: 'Go',
        billingMode: 'subscription',
        monthlyPrice: 10,
        firstMonthPrice: 5,
        currency: '$',
        planStatus: 'open'
      }
    ];
    const html = buildDetailBodyHtml(samplePlatform({ slug: 'opencode', name: 'OpenCode' }), { plans, monitorRow: null });
    assert.ok(html.includes('data-section="plans"'));
    assert.ok(html.includes('Go'));
    assert.ok(html.includes('$10') || html.includes('10'));
    assert.ok(html.includes('platform-detail-plan-main'));
    assert.ok(!html.includes('未公开'));
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
        // 绿=1、黄=0.5、红=0 / 非灰 = 1.5/3 = 50%
        hours: [
          { color: 'green' },
          { color: 'yellow' },
          { color: 'red' },
          { color: 'gray' }
        ]
      }
    });
    assert.ok(html.includes('data-section="availability"'));
    assert.ok(html.includes('50.0% 可用'));
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
