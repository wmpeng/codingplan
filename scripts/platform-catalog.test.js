const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterPlatforms,
  collectModelsForVendor,
  validatePlatformRecords,
  escapeHtml,
  formatInlineMarkdown,
  formatInlineMarkdownPreserveBreaks,
  buildPlatformCardHtml,
  buildPlatformStatusSliderHtml,
  normalizePinnedIds,
  sanitizePinnedIds,
  isPlatformPinned,
  togglePinnedId,
  sortPlatformsByPinned,
  sortItemsByPinned,
  getPlanRowPinId,
  sanitizePinnedIdList,
  mergePinnedIntoFiltered,
  partitionPinnedItems,
  buildRowPinButtonHtml,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
  buildPlatformPinButtonHtml,
  PLATFORM_PIN_MAX,
  PLANS_TABLE_PIN_STORAGE_KEY,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform,
  DEFAULT_PLATFORM_STATUS_MAX
} = require('./platform-catalog.js');

function samplePlatform(overrides = {}) {
  return {
    slug: 'x',
    slug: 'x',
    name: 'X',
    rating: 4,
    platformStatus: 'open',
    dimensions: {
      value: { score: 5, reason: 'a' },
      stability: { score: 3, reason: 'b' },
      models: { score: 4, reason: 'c' }
},
    ...overrides
  };
}

describe('filterPlatforms', () => {
  it('filters purchase status cumulatively and defaults to restricted', () => {
    const platforms = ['open', 'restricted', 'delisted'].map(status => samplePlatform({ slug: status, platformStatus: status }));
    assert.deepEqual(filterPlatforms(platforms).map(p => p.slug), ['open', 'restricted']);
    assert.deepEqual(filterPlatforms(platforms, { platformStatusMax: 'open' }).map(p => p.slug), ['open']);
    assert.deepEqual(filterPlatforms(platforms, { platformStatusMax: 'delisted' }).map(p => p.slug), ['open', 'restricted', 'delisted']);
  });
  it('keeps pinned platforms across status filtering', () => {
    const platforms = ['open', 'delisted'].map(status => samplePlatform({ slug: status, platformStatus: status }));
    assert.deepEqual(filterPlatforms(platforms, { platformStatusMax: 'open', pinnedIds: ['delisted'] }).map(p => p.slug), ['open', 'delisted']);
  });
});

describe('collectModelsForVendor', () => {
  it('unions active plan models only', () => {
    const plans = [
      { platformSlug: 'minimax', modelLabels: ['M3', 'M2.7'], planStatus: 'open' },
      { platformSlug: 'minimax', modelLabels: ['M2.5'], planStatus: 'delisted' },
      { platformSlug: 'kimi', modelLabels: ['K2.6'], planStatus: 'open' }
    ];
    assert.deepEqual(collectModelsForVendor(plans, 'minimax'), ['M3', 'M2.7']);
  });
});

describe('platform action', () => {
  it('uses the explicit platform link regardless of plan links or order', () => {
    const platform=samplePlatform({action:'https://example.com/platform'});
    const plans=[{platformSlug:platform.slug,action:'https://example.com/plan-one'}, {platformSlug:platform.slug,action:'https://example.com/plan-two'}];
    for(const rows of [plans,plans.slice().reverse()]){
      const html=buildPlatformCardHtml(platform,rows);
      assert.match(html,/href="https:\/\/example\.com\/platform"/);
      assert.doesNotMatch(html,/href="https:\/\/example\.com\/plan-/);
    }
  });
});

describe('validatePlatformRecords', () => {
  it('errors when plan platformSlug is missing from platforms', () => {
    const r = validatePlatformRecords([], [{ platformSlug: 'z' }]);
    assert.equal(r.ok, false);
    assert.match(r.errors.join('\n'), /platformSlug "z"/);
  });

  it('errors on bad score or missing reason', () => {
    const bad = samplePlatform({
      dimensions: {
        value: { score: 6, reason: 'x' },
        stability: { score: 3, reason: '' },
        models: { score: 4, reason: 'c' }
}
    });
    const r = validatePlatformRecords([bad], [{ platformSlug: 'x' }]);
    assert.equal(r.ok, false);
  });

  it('errors on invalid platformStatus', () => {
    const bad = samplePlatform({ platformStatus: 'nope' });
    const r = validatePlatformRecords([bad], [{ platformSlug: 'x' }]);
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
    }), [{ platformSlug: 'x', modelLabels: [], planStatus: 'open' }]);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('formatInlineMarkdown', () => {
  it('renders bold and safe http(s) links', () => {
    assert.equal(formatInlineMarkdown('看看**重点**'), '看看<strong>重点</strong>');
    assert.match(
      formatInlineMarkdown('[加群](https://example.com/a)'),
      /<a href="https:\/\/example\.com\/a" target="_blank" rel="noopener noreferrer">加群<\/a>/
    );
  });

  it('keeps internal links valid in browser and static generation', () => {
    assert.match(formatInlineMarkdown('[套餐](/plans/?platform=zhipu)'), /href="\/plans\/\?platform=zhipu"/);
    assert.doesNotMatch(formatInlineMarkdown('[套餐](/plans/?platform=zhipu)'), /example\.invalid/);
  });

  it('leaves unsafe urls as plain text and still escapes html', () => {
    assert.equal(
      formatInlineMarkdown('[x](javascript:alert(1))'),
      '[x](javascript:alert(1))'
    );
    assert.equal(
      formatInlineMarkdown('<b>raw</b>'),
      '&lt;b&gt;raw&lt;/b&gt;'
    );
  });

  it('preserves line breaks after markdown', () => {
    assert.equal(
      formatInlineMarkdownPreserveBreaks('a\n**b**'),
      'a<br><strong>b</strong>'
    );
  });
});

describe('buildPlatformCardHtml', () => {
  it('includes key classes and discontinued marker', () => {
    const active = buildPlatformCardHtml(samplePlatform(), [{ platformSlug: 'x', modelLabels: ['M1'], planStatus: 'open' }]);
    assert.match(active, /class="platform-card"/);
    assert.match(active, /class="platform-dimensions"/);
    assert.doesNotMatch(active, /is-discontinued/);

    const dead = buildPlatformCardHtml(
      samplePlatform({ platformStatus: 'delisted' }),
      [{ platformSlug: 'x', modelLabels: [], planStatus: 'open' }]
    );
    assert.match(dead, /platform-card is-discontinued/);
  });

  it('adds external link icon on titled action links', () => {
    const withLink = buildPlatformCardHtml(
      samplePlatform({ action: 'https://example.com' }),
      [{ platformSlug: 'x', modelLabels: ['M1'], planStatus: 'open' }]
    );
    assert.match(withLink, /platform-name-link/);
    assert.match(withLink, /class="link-icon"/);
    assert.match(withLink, /platform-name-text/);

    const noLink = buildPlatformCardHtml(samplePlatform({ action: null }), []);
    assert.doesNotMatch(noLink, /class="link-icon"/);
    assert.match(noLink, /class="platform-name"/);
  });

  it('omits badge for open; shows restricted/delisted beside title', () => {
    const open = buildPlatformCardHtml(
      samplePlatform({ action: 'https://example.com', platformStatus: 'open' }),
      [{ platformSlug: 'x', modelLabels: ['M1'], planStatus: 'open' }]
    );
    assert.doesNotMatch(open, /platform-rush/);

    const restricted = buildPlatformCardHtml(samplePlatform({ platformStatus: 'restricted' }), []);
    assert.match(restricted, /data-platform-status="restricted"/);
    assert.match(restricted, /购买受限/);
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

  it('uses a two-row layout budget on card faces with +N overflow', () => {
    const models = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    const html = buildPlatformCardHtml(samplePlatform({ name: 'X' }), [
      { platformSlug: 'x', modelLabels: models, planStatus: 'open' }
    ]);
    assert.ok(html.includes('M1'));
    assert.ok(html.includes('M5'));
    assert.match(html, /data-extra-model hidden>M6<\/span>/);
    assert.match(html, /data-extra-model hidden>M7<\/span>/);
    assert.match(html, /<button type="button"[^>]*data-platform-toggle-models[^>]*aria-expanded="false"/);
    assert.ok(html.includes('model-tag-more'));
    assert.match(html, /data-model-max-rows="2" data-model-limit="7"/);
    assert.ok(html.includes('+6'));
  });

  it('uses the full model list for row-limited cards instead of a fixed five-model cap', () => {
    const models = Array.from({length: 12}, (_, index) => `M${index + 1}`);
    const html = buildPlatformCardHtml(samplePlatform(), [
      { platformSlug: 'x', modelLabels: models, planStatus: 'open' }
    ], { modelMaxRows: 2 });
    assert.match(html, /data-model-max-rows="2" data-model-limit="12"/);
    assert.equal((html.match(/class="model-tag"/g) || []).length, 12);
    assert.match(html, /data-platform-toggle-models/);
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

  it('renders markdown bold/links in summary and dimension reason', () => {
    const html = buildPlatformCardHtml(
      samplePlatform({
        summary: '支持**加粗**与[链接](https://example.com/s)',
        dimensions: {
          value: { score: 4, reason: '见[说明](https://example.com/r)**重点**' },
          models: { score: 4, reason: 'ok' },
          stability: { score: 4, reason: 'ok' }
        }
      }),
      []
    );
    assert.match(html, /platform-summary[\s\S]*<strong>加粗<\/strong>/);
    assert.match(html, /platform-summary[\s\S]*href="https:\/\/example\.com\/s"/);
    assert.match(html, /dim-reason[\s\S]*href="https:\/\/example\.com\/r"/);
    assert.match(html, /dim-reason[\s\S]*<strong>重点<\/strong>/);
  });
});

describe('buildPlatformStatusSliderHtml', () => {
  it('renders filter labels and highlights selected max', () => {
    const html = buildPlatformStatusSliderHtml('restricted');
    assert.match(html, /platform-status-slider/);
    assert.match(html, /data-platform-status-max="restricted"/);
    assert.match(html, /platform-status-seg/);
    assert.match(html, /platform-status-prefix">显示</);
    assert.match(html, /platform-status-suffix">平台/);
    assert.match(html, />可以购买</);
    assert.match(html, />购买受限</);
    assert.match(html, />所有</);
    assert.match(html, /platform-status-seg is-active" data-platform-status="open"/);
    assert.match(html, /platform-status-seg is-active" data-platform-status="restricted"/);
    assert.match(html, /platform-status-and is-on" aria-hidden="true">和</);
    assert.equal((html.match(/platform-status-and/g) || []).length, 1);
    assert.equal((html.match(/platform-status-and is-on/g) || []).length, 1);
    assert.doesNotMatch(html, /platform-status-seg is-active" data-platform-status="delisted"/);
  });

  it('uses 仅显示 prefix only when open is selected', () => {
    const openHtml = buildPlatformStatusSliderHtml('open');
    assert.match(openHtml, /platform-status-prefix">仅显示</);
    assert.match(openHtml, /title="仅显示可以购买平台"/);
    assert.match(openHtml, /title="显示购买受限平台"/);
    assert.match(openHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.equal((openHtml.match(/platform-status-and/g) || []).length, 1);
    assert.doesNotMatch(openHtml, /platform-status-and is-on/);
    assert.doesNotMatch(openHtml, /platform-status-seg is-active" data-platform-status="restricted"/);

    const allHtml = buildPlatformStatusSliderHtml('delisted');
    assert.match(allHtml, /platform-status-prefix">显示</);
    assert.match(allHtml, /title="显示所有平台"/);
    assert.match(allHtml, /platform-status-seg is-active" data-platform-status="delisted"/);
    assert.doesNotMatch(allHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.equal((allHtml.match(/platform-status-and/g) || []).length, 1);
    assert.doesNotMatch(allHtml, /platform-status-and is-on/);
  });

  it('highlights cumulative statuses with 和 until restricted; 所有 is exclusive', () => {
    const restrictedHtml = buildPlatformStatusSliderHtml('restricted');
    assert.match(restrictedHtml, /platform-status-seg is-active" data-platform-status="open"/);
    assert.match(restrictedHtml, /platform-status-seg is-active" data-platform-status="restricted"/);
    assert.equal((restrictedHtml.match(/platform-status-and/g) || []).length, 1);
    assert.equal((restrictedHtml.match(/platform-status-and is-on/g) || []).length, 1);
    assert.match(restrictedHtml, /aria-label="显示可以购买和购买受限平台"/);
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
      { platformSlug: 'a', name: '1', planStatus: 'open' },
      { platformSlug: 'b', name: 'x' },
      { platformSlug: 'a', name: '2', planStatus: 'delisted' }
    ];
    const rows = collectPlansForVendor(plans, 'a');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, '1');
    assert.equal(rows[1].name, '2');
  });
});

describe('matchMonitorPlatform', () => {
  const board = [
    { platform_slug: 'minimax', platform_display_name: 'MiniMax' },
    { platform_slug: 'foo', platform_display_name: 'Foo云' }
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

describe('platform pins', () => {
  it('normalizes and sanitizes pinned ids against platforms', () => {
    assert.deepEqual(normalizePinnedIds(['a', '', 'a', 2, null, '  b  ']), ['a', '2', 'b']);
    const cleaned = sanitizePinnedIds(['a', 'gone', 'b', 'gone'], [
      samplePlatform({ slug: 'a' }),
      samplePlatform({ slug: 'b' })
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
      samplePlatform({ slug: 'a', name: 'A' }),
      samplePlatform({ slug: 'b', name: 'B' }),
      samplePlatform({ slug: 'c', name: 'C' })
    ];
    const sorted = sortPlatformsByPinned(platforms, ['c', 'missing', 'a']);
    assert.deepEqual(sorted.map((p) => p.slug), ['c', 'a', 'b']);
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
      samplePlatform({ slug: 'zhipu', name: '智谱AI', action: 'https://example.com' }),
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

describe('table row pins', () => {
  it('builds stable plan pin ids', () => {
    assert.equal(
      getPlanRowPinId({ slug: 'tencent-lite', platformSlug: 'tencent-cloud', name: 'Lite', type: 'Token Plan' }),
      'tencent-lite'
    );
    assert.equal(
      getPlanRowPinId({ slug: 'zhipu-lite', platformSlug: 'zhipu', name: 'Lite' }),
      'zhipu-lite'
    );
    assert.equal(PLANS_TABLE_PIN_STORAGE_KEY, 'plansTablePinnedIds');
  });

  it('merges pinned rows back and partitions for sort-safe head', () => {
    const all = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
    const filtered = [all[2]];
    const pinned = ['b', 'a'];
    const merged = mergePinnedIntoFiltered(all, filtered, pinned, getPlanRowPinId);
    assert.deepEqual(
      merged.map(getPlanRowPinId),
      ['c', 'b', 'a']
    );
    const { head, tail } = partitionPinnedItems(merged, pinned, getPlanRowPinId);
    assert.deepEqual(head.map(getPlanRowPinId), ['b', 'a']);
    assert.deepEqual(tail.map(getPlanRowPinId), ['c']);
    const ordered = sortItemsByPinned(merged, pinned, getPlanRowPinId);
    assert.deepEqual(ordered.map(getPlanRowPinId), ['b', 'a', 'c']);
    assert.deepEqual(sanitizePinnedIdList(['b', 'gone'], ['b', 'c']), ['b']);
    assert.match(buildRowPinButtonHtml({ pinId: 'b', pinned: true }), /data-table-pin="1"/);
  });
});

it('platform card gets API badge and models from entity-derived options', () => {
  const html = buildPlatformCardHtml(
    samplePlatform({ slug: 'gongji', name: '共绩算力' }),
    [],
    { hasApiPlan: true, supportedModels: [{slug:'kimi-k3',name:'Kimi-K3'}, {slug:'deepseek-v4-pro-0813',name:'DeepSeek-V4-Pro-0813'}] }
  );
  assert.match(html, /platform-rush--api/);
  assert.match(html, /按量/);
  assert.match(html, /Kimi-K3/);
  assert.match(html, /DeepSeek-V4-Pro-0813/);
});
