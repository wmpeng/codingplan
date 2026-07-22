const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterPlatforms,
  collectModelsForVendor,
  resolvePlatformAction,
  validatePlatformRecords,
  validatePaygPricing,
  escapeHtml,
  buildPlatformCardHtml,
  buildPlatformTagBarHtml,
  buildPlatformStatusSliderHtml,
  buildPaygPricingSectionHtml,
  getPaygEntry,
  collectModelsFromPayg,
  flattenPaygRows,
  filterPaygRows,
  sortPaygRows,
  collectPaygFilterOptions,
  paygRowHasAnyPrice,
  normalizePinnedIds,
  sanitizePinnedIds,
  isPlatformPinned,
  togglePinnedId,
  sortPlatformsByPinned,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
  buildPlatformPinButtonHtml,
  PLATFORM_PIN_MAX,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform,
  DEFAULT_PLATFORM_STATUS_MAX
} = require('./platform-catalog.js');

const derivedTags = [
  { id: 'high-value', label: '性价比高', rule: { dimension: 'value', minScore: 4 } }
];

function samplePlatform(overrides = {}) {
  return {
    id: 'x',
    name: 'X',
    rating: 4,
    platformStatus: 'open',
    dimensions: {
      value: { score: 5, reason: 'a' },
      stability: { score: 3, reason: 'b' },
      models: { score: 4, reason: 'c' }
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
        platformStatus: 'limited',
        tags: ['适合养龙虾'],
        dimensions: {
          value: { score: 5, reason: 'a' },
          stability: { score: 3, reason: 'b' },
          models: { score: 4, reason: 'c' }
}
      }),
      samplePlatform({ id: 'c', name: 'C', tags: [] })
    ];
    const result = filterPlatforms(platforms, {
      selectedLabels: ['性价比高', '适合养龙虾'],
      platformStatusMax: 'limited',
      derivedTags,
      operationalTags: ['适合养龙虾']
    });
    assert.deepEqual(result.map(p => p.id), ['a', 'b']);
  });

  it('filters by platformStatusMax inclusive rank', () => {
    const platforms = [
      samplePlatform({ id: 'open', platformStatus: 'open' }),
      samplePlatform({ id: 'limited', platformStatus: 'limited' }),
      samplePlatform({ id: 'paused', platformStatus: 'paused' }),
      samplePlatform({ id: 'delisted', platformStatus: 'delisted' })
    ];

    assert.deepEqual(
      filterPlatforms(platforms, {
        selectedLabels: [],
        platformStatusMax: 'open',
        derivedTags,
        operationalTags: []
      }).map(p => p.id),
      ['open']
    );

    assert.deepEqual(
      filterPlatforms(platforms, {
        selectedLabels: [],
        platformStatusMax: 'limited',
        derivedTags,
        operationalTags: []
      }).map(p => p.id),
      ['open', 'limited']
    );

    assert.deepEqual(
      filterPlatforms(platforms, {
        selectedLabels: [],
        platformStatusMax: 'delisted',
        derivedTags,
        operationalTags: []
      }).map(p => p.id),
      ['open', 'limited', 'paused', 'delisted']
    );
  });

  it('defaults platformStatusMax to limited', () => {
    assert.equal(DEFAULT_PLATFORM_STATUS_MAX, 'limited');
    const platforms = [
      samplePlatform({ id: '1' }),
      samplePlatform({ id: '2', platformStatus: 'limited' }),
      samplePlatform({ id: '3', platformStatus: 'delisted' })
    ];
    const result = filterPlatforms(platforms, {
      selectedLabels: [],
      derivedTags,
      operationalTags: []
    });
    assert.deepEqual(result.map(p => p.id), ['1', '2']);
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
        models: { score: 4, reason: 'c' }
}
    });
    const r = validatePlatformRecords([bad], [{ vendor: 'X' }]);
    assert.equal(r.ok, false);
  });

  it('errors on invalid platformStatus', () => {
    const bad = samplePlatform({ platformStatus: 'nope' });
    const r = validatePlatformRecords([bad], [{ vendor: 'X' }]);
    assert.equal(r.ok, false);
    assert.match(r.errors.join('\n'), /platformStatus/);
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
        models: { score: 3, reason: 'ok' }
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
      samplePlatform({ platformStatus: 'delisted' }),
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

  it('omits badge for open; shows limited/paused/delisted beside title', () => {
    const open = buildPlatformCardHtml(
      samplePlatform({ action: 'https://example.com', platformStatus: 'open' }),
      [{ vendor: 'X', models: ['M1'], discontinued: false }]
    );
    assert.doesNotMatch(open, /platform-rush/);

    const limited = buildPlatformCardHtml(samplePlatform({ platformStatus: 'limited' }), []);
    assert.match(limited, /data-platform-status="limited"/);
    assert.match(limited, /定时放量/);

    const paused = buildPlatformCardHtml(samplePlatform({ platformStatus: 'paused' }), []);
    assert.match(paused, /暂时停售/);
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
        models: { score: 4, reason: 'c' }
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

  it('renders platform summary on card when present', () => {
    const withSummary = buildPlatformCardHtml(
      samplePlatform({ summary: '一句话总述' }),
      []
    );
    assert.match(withSummary, /platform-summary/);
    assert.ok(withSummary.includes('一句话总述'));

    const blank = buildPlatformCardHtml(samplePlatform({ summary: '   ' }), []);
    assert.doesNotMatch(blank, /platform-summary/);

    const missing = buildPlatformCardHtml(samplePlatform(), []);
    assert.doesNotMatch(missing, /platform-summary/);
  });
});

describe('buildPlatformTagBarHtml', () => {
  it('groups derived/operational chips and right-side status slider', () => {
    const cat = {
      derivedTags: [{ id: 'high-value', label: '性价比高', rule: { dimension: 'value', minScore: 4 } }],
      operationalTags: ['热门模型']
    };
    const html = buildPlatformTagBarHtml(cat, ['性价比高'], 'limited');
    assert.match(html, /platform-tag-bar-main/);
    assert.match(html, /platform-tag-group--derived/);
    assert.match(html, /platform-tag-chip--derived is-active" data-platform-tag="性价比高"/);
    assert.match(html, /platform-tag-group--operational/);
    assert.match(html, /platform-status-slider/);
    assert.match(html, /platform-status-prefix">显示</);
    assert.match(html, /platform-status-suffix">平台/);
    assert.match(html, />开放购买</);
    assert.match(html, />所有</);
    assert.doesNotMatch(html, /显示至|显示停售|显示需抢购|platform-tag-chip--toggle/);
  });
});

describe('buildPlatformStatusSliderHtml', () => {
  it('renders filter labels and highlights selected max', () => {
    const html = buildPlatformStatusSliderHtml('limited');
    assert.match(html, /platform-status-slider/);
    assert.match(html, /data-platform-status-max="limited"/);
    assert.match(html, /platform-status-seg/);
    assert.match(html, /platform-status-prefix">显示</);
    assert.match(html, /platform-status-suffix">平台/);
    assert.match(html, />开放购买</);
    assert.match(html, />定时放量</);
    assert.match(html, />暂时停售</);
    assert.match(html, />所有</);
    assert.match(html, /platform-status-seg is-active" data-platform-status="open"/);
    assert.match(html, /platform-status-seg is-active" data-platform-status="limited"/);
    assert.match(html, /platform-status-and" aria-hidden="true">和</);
    assert.doesNotMatch(html, /platform-status-seg is-active" data-platform-status="paused"/);
    assert.doesNotMatch(html, /platform-status-seg is-active" data-platform-status="delisted"/);
  });

  it('uses 仅显示 prefix only when open is selected', () => {
    const openHtml = buildPlatformStatusSliderHtml('open');
    assert.match(openHtml, /platform-status-prefix">仅显示</);
    assert.match(openHtml, /title="仅显示开放购买平台"/);
    assert.match(openHtml, /title="显示定时放量平台"/);
    assert.match(openHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.doesNotMatch(openHtml, /platform-status-and/);
    assert.doesNotMatch(openHtml, /platform-status-seg is-active" data-platform-status="limited"/);

    const allHtml = buildPlatformStatusSliderHtml('delisted');
    assert.match(allHtml, /platform-status-prefix">显示</);
    assert.match(allHtml, /title="显示所有平台"/);
    assert.match(allHtml, /platform-status-seg is-active" data-platform-status="delisted"/);
    assert.doesNotMatch(allHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.doesNotMatch(allHtml, /platform-status-and/);
  });

  it('highlights cumulative statuses with 和 until paused; 所有 is exclusive', () => {
    const pausedHtml = buildPlatformStatusSliderHtml('paused');
    assert.match(pausedHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.match(pausedHtml, /platform-status-seg is-active" data-platform-status="limited"/);
    assert.match(pausedHtml, /platform-status-seg is-active" data-platform-status="paused"/);
    assert.equal((pausedHtml.match(/platform-status-and/g) || []).length, 2);
    assert.match(pausedHtml, /aria-label="显示开放购买和定时放量和暂时停售平台"/);

    const limitedHtml = buildPlatformStatusSliderHtml('limited');
    assert.match(limitedHtml, /aria-label="显示开放购买和定时放量平台"/);
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
        models: { score: 4, reason: 'c' }
}
    });
    const { ok, errors } = validatePlatformRecords([p], []);
    assert.equal(ok, false);
    assert.ok(errors.some(e => e.includes('detail')));
  });

  it('rejects empty platform summary/detail when present', () => {
    const badSummary = samplePlatform({ summary: '  ' });
    const r1 = validatePlatformRecords([badSummary], []);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => e.includes('summary')));

    const badDetail = samplePlatform({ detail: '' });
    const r2 = validatePlatformRecords([badDetail], []);
    assert.equal(r2.ok, false);
    assert.ok(r2.errors.some((e) => e.includes('detail')));
  });

  it('allows non-empty platform summary and detail', () => {
    const { ok } = validatePlatformRecords(
      [samplePlatform({ summary: '短', detail: '长文案' })],
      []
    );
    assert.equal(ok, true);
  });
});

describe('payg pricing', () => {
  const platforms = [
    samplePlatform({ id: 'deepseek-official', name: 'DeepSeek 官方' }),
    samplePlatform({ id: 'gongji', name: '共继算力' })
  ];

  it('validates keyed entries and rejects unknown platform ids', () => {
    const okDoc = {
      modelOrder: ['DeepSeek-V4-Pro'],
      'deepseek-official': {
        currency: '¥',
        models: [{ name: 'DeepSeek-V4-Pro', input: 3, cache: 0.025, output: 6 }]
      }
    };
    assert.equal(validatePaygPricing(okDoc, platforms).ok, true);

    const bad = validatePaygPricing({ nope: { models: [{ name: 'X', input: 1 }] } }, platforms);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.includes('no matching platform')));
  });

  it('card uses payg models and badge when no plans', () => {
    const paygPricing = {
      'deepseek-official': {
        models: [
          { name: 'DeepSeek-V4-Pro', input: 3, cache: 0.025, output: 6 },
          { name: 'DeepSeek-V4-Flash', input: null, cache: null, output: null, note: '官网' }
        ]
      }
    };
    const html = buildPlatformCardHtml(
      samplePlatform({
        id: 'deepseek-official',
        name: 'DeepSeek 官方',
        action: 'https://platform.deepseek.com/'
      }),
      [],
      { paygPricing }
    );
    assert.match(html, /platform-rush--payg/);
    assert.ok(html.includes('按量'));
    assert.ok(html.includes('DeepSeek-V4-Pro'));
    assert.ok(html.includes('DeepSeek-V4-Flash'));
  });

  it('builds payg pricing section html', () => {
    const entry = getPaygEntry(
      {
        gongji: {
          currency: '¥',
          notes: ['须邀请链接'],
          models: [{ name: 'DeepSeek-V4-Pro', input: 2.4, cache: 0.02, output: 4.8, note: '8折' }]
        }
      },
      'gongji'
    );
    assert.deepEqual(collectModelsFromPayg(entry), ['DeepSeek-V4-Pro']);
    const html = buildPaygPricingSectionHtml(entry);
    assert.match(html, /data-section="payg"/);
    assert.ok(html.includes('¥2.4'));
    assert.ok(html.includes('须邀请链接'));
    assert.ok(html.includes('8折'));
    assert.ok(html.includes('href="payg.html"'));
    assert.ok(html.includes('在按量计价大表中查看'));
  });
});

describe('flattenPaygRows', () => {
  const platforms = [
    samplePlatform({ id: 'deepseek-official', name: 'DeepSeek 官方', rating: 4 }),
    samplePlatform({ id: 'gongji', name: '共继算力', rating: 3 })
  ];
  const payg = {
    modelOrder: ['DeepSeek-V4-Pro', 'DeepSeek-V4-Flash'],
    'deepseek-official': {
      currency: '¥',
      unit: 'per_m_tokens',
      notes: ['峰谷翻倍'],
      models: [
        { name: 'DeepSeek-V4-Flash', input: null, cache: null, output: null, note: '以官网为准' },
        { name: 'DeepSeek-V4-Pro', input: 3, cache: 0.025, output: 6 }
      ]
    },
    'orphan-id': {
      currency: '¥',
      unit: 'per_m_tokens',
      models: [{ name: 'X', input: 1, cache: 1, output: 1 }]
    }
  };

  it('expands platform×model using top-level modelOrder', () => {
    const rows = flattenPaygRows(payg, platforms, []);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].platformId, 'deepseek-official');
    assert.equal(rows[0].modelName, 'DeepSeek-V4-Flash');
    assert.equal(rows[0].order, 1);
    assert.equal(rows[1].modelName, 'DeepSeek-V4-Pro');
    assert.equal(rows[1].order, 0);
    assert.equal(rows[1].input, 3);
    assert.deepEqual(rows[1].notes, ['峰谷翻倍']);
  });
});

describe('paygRowHasAnyPrice', () => {
  it('true when any price is finite', () => {
    assert.equal(paygRowHasAnyPrice({ input: null, cache: 0.02, output: null }), true);
    assert.equal(paygRowHasAnyPrice({ input: null, cache: null, output: null }), false);
  });
});

describe('filterPaygRows', () => {
  const rows = [
    { platformId: 'a', modelName: 'M1', input: 1, cache: 1, output: 1 },
    { platformId: 'a', modelName: 'M2', input: null, cache: null, output: null },
    { platformId: 'b', modelName: 'M1', input: 2, cache: 2, output: 2 }
  ];
  it('filters by platform, model, and pricedOnly', () => {
    assert.equal(filterPaygRows(rows, { platformIds: ['a'] }).length, 2);
    assert.equal(filterPaygRows(rows, { modelNames: ['M1'] }).length, 2);
    assert.equal(filterPaygRows(rows, { pricedOnly: true }).length, 2);
    assert.equal(filterPaygRows(rows, { platformIds: ['a'], pricedOnly: true }).length, 1);
  });
});

describe('sortPaygRows', () => {
  it('sorts input asc with missing prices last', () => {
    const rows = [
      { modelName: 'c', input: null },
      { modelName: 'b', input: 2 },
      { modelName: 'a', input: 1 }
    ];
    const sorted = sortPaygRows(rows, { key: 'input', dir: 'asc' });
    assert.deepEqual(sorted.map((r) => r.modelName), ['a', 'b', 'c']);
  });

  it('sorts by model order then input price', () => {
    const rows = [
      { modelName: 'Flash', order: 20, input: 1 },
      { modelName: 'Pro', order: 10, input: 3 },
      { modelName: 'Pro', order: 10, input: 2.4 }
    ];
    const sorted = sortPaygRows(rows, { key: 'order', dir: 'asc' });
    assert.deepEqual(
      sorted.map((r) => `${r.modelName}:${r.input}`),
      ['Pro:2.4', 'Pro:3', 'Flash:1']
    );
  });
});

describe('collectPaygFilterOptions', () => {
  it('dedupes platforms and sorts models by order', () => {
    const rows = [
      { platformId: 'a', platformName: 'A', modelName: 'M2', order: 20 },
      { platformId: 'b', platformName: 'B', modelName: 'M1', order: 10 },
      { platformId: 'a', platformName: 'A', modelName: 'M1', order: 10 }
    ];
    const opts = collectPaygFilterOptions(rows);
    assert.deepEqual(opts.platforms.map((p) => p.id), ['a', 'b']);
    assert.deepEqual(opts.models, ['M1', 'M2']);
  });
});

describe('platform pins', () => {
  it('normalizes and sanitizes pinned ids against platforms', () => {
    assert.deepEqual(normalizePinnedIds(['a', '', 'a', 2, null, '  b  ']), ['a', '2', 'b']);
    const cleaned = sanitizePinnedIds(['a', 'gone', 'b', 'gone'], [
      samplePlatform({ id: 'a' }),
      samplePlatform({ id: 'b' })
    ]);
    assert.deepEqual(cleaned, ['a', 'b']);
  });

  it('toggles pin and keeps newest first with max cap', () => {
    let ids = togglePinnedId([], 'x');
    assert.deepEqual(ids, ['x']);
    ids = togglePinnedId(ids, 'y');
    assert.deepEqual(ids, ['y', 'x']);
    ids = togglePinnedId(ids, 'x');
    assert.deepEqual(ids, ['y']);
    const many = [];
    for (let i = 0; i < PLATFORM_PIN_MAX + 5; i++) {
      many.push(`p${i}`);
    }
    let capped = [];
    for (const id of many) {
      capped = togglePinnedId(capped, id, { max: PLATFORM_PIN_MAX });
    }
    assert.equal(capped.length, PLATFORM_PIN_MAX);
    assert.equal(capped[0], `p${PLATFORM_PIN_MAX + 4}`);
  });

  it('sorts pinned platforms to the front by pin order', () => {
    const platforms = [
      samplePlatform({ id: 'a', name: 'A' }),
      samplePlatform({ id: 'b', name: 'B' }),
      samplePlatform({ id: 'c', name: 'C' })
    ];
    const sorted = sortPlatformsByPinned(platforms, ['c', 'missing', 'a']);
    assert.deepEqual(sorted.map((p) => p.id), ['c', 'a', 'b']);
  });

  it('storage helpers tolerate bad JSON and missing storage', () => {
    assert.deepEqual(readPinnedIdsFromStorage(null), []);
    const mem = {
      data: '{not-json',
      getItem() {
        return this.data;
      },
      setItem(_k, v) {
        this.data = v;
      }
    };
    assert.deepEqual(readPinnedIdsFromStorage(mem), []);
    assert.equal(writePinnedIdsToStorage(mem, ['zhipu', 'zhipu', '']), true);
    assert.deepEqual(JSON.parse(mem.data), ['zhipu']);
  });

  it('card html includes pin button state', () => {
    const html = buildPlatformCardHtml(
      samplePlatform({ id: 'zhipu', name: '智谱AI', action: 'https://example.com' }),
      [],
      { pinnedIds: ['zhipu'] }
    );
    assert.match(html, /data-platform-pin="1"/);
    assert.match(html, /is-pinned/);
    assert.match(html, /aria-pressed="true"/);
    assert.ok(isPlatformPinned('zhipu', ['zhipu']));
    assert.ok(buildPlatformPinButtonHtml({ platformId: '', pinned: true }) === '');
  });
});
