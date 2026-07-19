const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterPlatforms,
  collectModelsForVendor,
  resolvePlatformAction,
  validatePlatformRecords,
  escapeHtml,
  buildPlatformCardHtml,
  buildPlatformTagBarHtml,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform
} = require('./platform-catalog.js');

const derivedTags = [
  { id: 'high-value', label: '性价比高', rule: { dimension: 'value', minScore: 4 } }
];

function samplePlatform(overrides = {}) {
  return {
    id: 'x',
    name: 'X',
    rating: 4,
    status: 'active',
    purchaseMode: 'anytime',
    dimensions: {
      value: { score: 5, reason: 'a' },
      stability: { score: 3, reason: 'b' },
      models: { score: 4, reason: 'c' },
      convenience: { score: 4, reason: 'd' }
    },
    tags: ['适合养龙虾'],
    ...overrides
  };
}

describe('filterPlatforms', () => {
  it('AND matches derived + operational tags', () => {
    const platforms = [
      samplePlatform({ id: 'a', name: 'A', tags: ['适合养龙虾'] }),
      samplePlatform({
        id: 'b',
        name: 'B',
        purchaseMode: 'rush',
        tags: ['适合养龙虾'],
        dimensions: {
          value: { score: 5, reason: 'a' },
          stability: { score: 3, reason: 'b' },
          models: { score: 4, reason: 'c' },
          convenience: { score: 4, reason: 'd' }
        }
      }),
      samplePlatform({ id: 'c', name: 'C', tags: [] })
    ];
    const result = filterPlatforms(platforms, {
      selectedLabels: ['性价比高', '适合养龙虾'],
      showDiscontinued: false,
      showRushPurchase: true,
      derivedTags,
      operationalTags: ['适合养龙虾'],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.deepEqual(result.map(p => p.id), ['a', 'b']);
  });

  it('hides discontinued unless showDiscontinued', () => {
    const platforms = [
      samplePlatform({ id: 'alive', status: 'active' }),
      samplePlatform({ id: 'dead', status: 'discontinued', purchaseMode: 'anytime' })
    ];
    const hidden = filterPlatforms(platforms, {
      selectedLabels: [],
      showDiscontinued: false,
      showRushPurchase: false,
      derivedTags,
      operationalTags: [],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.deepEqual(hidden.map(p => p.id), ['alive']);

    const shown = filterPlatforms(platforms, {
      selectedLabels: [],
      showDiscontinued: true,
      showRushPurchase: false,
      derivedTags,
      operationalTags: [],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.deepEqual(shown.map(p => p.id), ['alive', 'dead']);
  });

  it('hides rush unless showRushPurchase', () => {
    const platforms = [
      samplePlatform({ id: '1' }),
      samplePlatform({ id: '2', purchaseMode: 'rush' }),
      samplePlatform({ id: '3', purchaseMode: 'scheduled' })
    ];
    const hidden = filterPlatforms(platforms, {
      selectedLabels: [],
      showDiscontinued: false,
      showRushPurchase: false,
      derivedTags,
      operationalTags: [],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.deepEqual(hidden.map(p => p.id), ['1', '3']);

    const shown = filterPlatforms(platforms, {
      selectedLabels: [],
      showDiscontinued: false,
      showRushPurchase: true,
      derivedTags,
      operationalTags: [],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.deepEqual(shown.map(p => p.id), ['1', '2', '3']);
  });

  it('empty selectedLabels means all active (plus discontinued if toggled)', () => {
    const platforms = [
      samplePlatform({ id: '1' }),
      samplePlatform({ id: '2', purchaseMode: 'scheduled' })
    ];
    const result = filterPlatforms(platforms, {
      selectedLabels: [],
      showDiscontinued: false,
      showRushPurchase: false,
      derivedTags,
      operationalTags: [],
      showDiscontinuedLabel: '显示停售',
      showRushPurchaseLabel: '显示需抢购'
    });
    assert.equal(result.length, 2);
  });
});

describe('collectModelsForVendor', () => {
  it('unions active plan models only', () => {
    const plans = [
      { vendor: 'MiniMax', models: ['M3', 'M2.7'], discontinued: false },
      { vendor: 'MiniMax', models: ['M2.5'], discontinued: true },
      { vendor: 'Kimi', models: ['K2.6'], discontinued: false }
    ];
    assert.deepEqual(collectModelsForVendor(plans, 'MiniMax'), ['M3', 'M2.7']);
  });
});

describe('resolvePlatformAction', () => {
  it('prefers platform.action then first plan action', () => {
    const plans = [{ vendor: 'A', action: 'https://plan' }];
    assert.equal(resolvePlatformAction({ name: 'A', action: 'https://own' }, plans), 'https://own');
    assert.equal(resolvePlatformAction({ name: 'A', action: null }, plans), 'https://plan');
  });
});

describe('validatePlatformRecords', () => {
  it('errors when plan vendor missing platform', () => {
    const r = validatePlatformRecords([], [{ vendor: 'Z' }]);
    assert.equal(r.ok, false);
    assert.match(r.errors.join('\n'), /Z/);
  });

  it('errors on bad score or missing reason', () => {
    const bad = samplePlatform({
      dimensions: {
        value: { score: 6, reason: 'x' },
        stability: { score: 3, reason: '' },
        models: { score: 4, reason: 'c' },
        convenience: { score: 4, reason: 'd' }
      }
    });
    const r = validatePlatformRecords([bad], [{ vendor: 'X' }]);
    assert.equal(r.ok, false);
  });

  it('errors on invalid purchaseMode', () => {
    const bad = samplePlatform({ purchaseMode: 'nope' });
    const r = validatePlatformRecords([bad], [{ vendor: 'X' }]);
    assert.equal(r.ok, false);
    assert.match(r.errors.join('\n'), /purchaseMode/);
  });
});

describe('escapeHtml', () => {
  it('escapes HTML in malicious reason text', () => {
    const malicious = '<script>alert("xss")</script>';
    assert.equal(escapeHtml(malicious), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    const html = buildPlatformCardHtml(samplePlatform({
      dimensions: {
        value: { score: 3, reason: malicious },
        stability: { score: 3, reason: 'ok' },
        models: { score: 3, reason: 'ok' },
        convenience: { score: 3, reason: 'ok' }
      }
    }), [{ vendor: 'X', models: [], discontinued: false }]);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('buildPlatformCardHtml', () => {
  it('includes key classes and discontinued marker', () => {
    const active = buildPlatformCardHtml(samplePlatform(), [{ vendor: 'X', models: ['M1'], discontinued: false }]);
    assert.match(active, /class="platform-card"/);
    assert.match(active, /class="platform-dimensions"/);
    assert.doesNotMatch(active, /is-discontinued/);

    const dead = buildPlatformCardHtml(
      samplePlatform({ status: 'discontinued' }),
      [{ vendor: 'X', models: [], discontinued: false }]
    );
    assert.match(dead, /platform-card is-discontinued/);
  });

  it('adds external link icon on titled action links', () => {
    const withLink = buildPlatformCardHtml(
      samplePlatform({ action: 'https://example.com' }),
      [{ vendor: 'X', models: ['M1'], discontinued: false }]
    );
    assert.match(withLink, /platform-name-link/);
    assert.match(withLink, /class="link-icon"/);
    assert.match(withLink, /platform-name-text/);

    const noLink = buildPlatformCardHtml(samplePlatform({ action: null }), []);
    assert.doesNotMatch(noLink, /class="link-icon"/);
    assert.match(noLink, /class="platform-name"/);
  });

  it('omits purchase badge for anytime; shows scheduled/rush beside title', () => {
    const anytime = buildPlatformCardHtml(
      samplePlatform({ action: 'https://example.com', purchaseMode: 'anytime' }),
      [{ vendor: 'X', models: ['M1'], discontinued: false }]
    );
    assert.doesNotMatch(anytime, /platform-rush/);

    const rush = buildPlatformCardHtml(
      samplePlatform({ purchaseMode: 'rush' }),
      [{ vendor: 'X', models: ['M1'], discontinued: false }]
    );
    assert.match(rush, /platform-card-heading/);
    assert.match(rush, /platform-rush/);
    assert.match(rush, /data-purchase-mode="rush"/);
    assert.match(rush, /需要抢购/);
    assert.ok(rush.indexOf('platform-card-heading') < rush.indexOf('platform-rush'));
    assert.ok(rush.indexOf('platform-rush') < rush.indexOf('platform-dimensions'));

    const scheduled = buildPlatformCardHtml(samplePlatform({ purchaseMode: 'scheduled' }), []);
    assert.match(scheduled, /data-purchase-mode="scheduled"/);
    assert.match(scheduled, /定时购买/);
  });

  it('renders score with 分 unit and groups meta for vertical centering', () => {
    const html = buildPlatformCardHtml(samplePlatform(), []);
    assert.match(html, /dim-meta/);
    assert.match(html, /dim-score-unit/);
    assert.ok(html.includes('>5<span class="dim-score-unit">分</span>'));
  });

  it('card html uses short reason not detail', () => {
    const html = buildPlatformCardHtml(samplePlatform({
      dimensions: {
        value: { score: 5, reason: '短理由', detail: '长详解不应出现在卡面' },
        stability: { score: 3, reason: 'b' },
        models: { score: 4, reason: 'c' },
        convenience: { score: 4, reason: 'd' }
      }
    }), []);
    assert.ok(html.includes('短理由'));
    assert.ok(!html.includes('长详解不应出现在卡面'));
    assert.ok(html.includes('data-platform-id'));
    assert.ok(html.includes('platform-card-hint') || html.includes('查看详情'));
  });

  it('limits model tags on card face with +N overflow', () => {
    const models = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    const html = buildPlatformCardHtml(samplePlatform({ name: 'X' }), [
      { vendor: 'X', models, discontinued: false }
    ]);
    assert.ok(html.includes('M1'));
    assert.ok(html.includes('M5'));
    assert.ok(!html.includes('>M6<'));
    assert.ok(html.includes('model-tag-more'));
    assert.ok(html.includes('+2'));
  });
});

describe('buildPlatformTagBarHtml', () => {
  it('marks default selected tags active and includes show-rush toggle', () => {
    const cat = {
      derivedTags: [{ id: 'high-value', label: '性价比高', rule: { dimension: 'value', minScore: 4 } }],
      operationalTags: ['热门模型'],
      showDiscontinuedTag: '显示停售',
      showRushPurchaseTag: '显示需抢购'
    };
    const html = buildPlatformTagBarHtml(cat, ['性价比高'], false, true);
    assert.match(html, /class="platform-tag-chip is-active" data-platform-tag="性价比高"/);
    assert.match(html, /platform-tag-chip--discontinued/);
    assert.match(html, /platform-tag-chip--rush is-active/);
    assert.match(html, /data-platform-show-rush="1"/);
    assert.match(html, /显示需抢购/);
  });
});

describe('dimensionCopy', () => {
  it('prefers non-empty detail over reason', () => {
    assert.equal(dimensionCopy({ reason: '短', detail: '长文案' }), '长文案');
  });
  it('falls back to reason when detail missing or blank', () => {
    assert.equal(dimensionCopy({ reason: '短' }), '短');
    assert.equal(dimensionCopy({ reason: '短', detail: '  ' }), '短');
    assert.equal(dimensionCopy({ reason: '短', detail: '' }), '短');
  });
});

describe('collectPlansForVendor', () => {
  it('returns all plans for vendor including discontinued, in order', () => {
    const plans = [
      { vendor: 'A', plan: '1', discontinued: false },
      { vendor: 'B', plan: 'x' },
      { vendor: 'A', plan: '2', discontinued: true }
    ];
    const rows = collectPlansForVendor(plans, 'A');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].plan, '1');
    assert.equal(rows[1].plan, '2');
  });
});

describe('matchMonitorPlatform', () => {
  const board = [
    { platform_slug: 'minimax', platform_display_name: 'MiniMax', availability_rate: 0.99 },
    { platform_slug: 'foo', platform_display_name: 'Foo云', availability_rate: 0.8 }
  ];
  it('matches by monitorSlug first', () => {
    const hit = matchMonitorPlatform({ name: '别名', monitorSlug: 'minimax' }, board);
    assert.equal(hit.platform_slug, 'minimax');
  });
  it('matches by trimmed display name', () => {
    const hit = matchMonitorPlatform({ name: ' MiniMax ' }, board);
    assert.equal(hit.platform_slug, 'minimax');
  });
  it('returns null when no match', () => {
    assert.equal(matchMonitorPlatform({ name: '不存在' }, board), null);
  });
});

describe('validatePlatformRecords detail', () => {
  it('allows missing detail', () => {
    const { ok } = validatePlatformRecords([samplePlatform()], []);
    assert.equal(ok, true);
  });
  it('rejects empty detail string', () => {
    const p = samplePlatform({
      dimensions: {
        value: { score: 5, reason: 'a', detail: '' },
        stability: { score: 3, reason: 'b' },
        models: { score: 4, reason: 'c' },
        convenience: { score: 4, reason: 'd' }
      }
    });
    const { ok, errors } = validatePlatformRecords([p], []);
    assert.equal(ok, false);
    assert.ok(errors.some(e => e.includes('detail')));
  });
});
