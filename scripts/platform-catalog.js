const DIMENSION_KEYS = ['value', 'models', 'stability'];

const PLATFORM_DIMENSION_META = [
  { key: 'value', label: '性价比' },
  { key: 'models', label: '模型' },
  { key: 'stability', label: '可用性' }
];

const PLATFORM_STATUSES = ['open', 'limited', 'paused', 'delisted'];
const PLATFORM_STATUS_LABELS = {
  open: '开放购买',
  limited: '定时放量',
  paused: '暂时停售',
  delisted: '已下架'
};
/** 筛选滑块中间档位文案（前后另有前缀 /「平台」） */
const PLATFORM_STATUS_SEGMENT_LABELS = {
  open: '开放购买',
  limited: '定时放量',
  paused: '暂时停售',
  delisted: '所有'
};
const PLATFORM_STATUS_FILTER_SUFFIX = '平台';
const DEFAULT_PLATFORM_STATUS_MAX = 'paused';

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeInlineHttpUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const base =
      typeof globalThis !== 'undefined' &&
      globalThis.location &&
      typeof globalThis.location.origin === 'string'
        ? globalThis.location.origin
        : 'https://example.invalid';
    const parsed = new URL(url.trim(), base);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (error) {
    return null;
  }
  return null;
}

/** Inline Markdown: `[label](https://...)` links and `**bold**`. */
function formatInlineMarkdown(text) {
  if (text === null || text === undefined) return '';

  const linkPlaceholders = [];
  const withLinkPlaceholders = String(text).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
    const safeUrl = sanitizeInlineHttpUrl(url);
    if (!safeUrl) return match;

    const placeholder = `__INLINE_MD_LINK_${linkPlaceholders.length}__`;
    linkPlaceholders.push(
      `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    );
    return placeholder;
  });

  let formatted = escapeHtml(withLinkPlaceholders);
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__INLINE_MD_LINK_(\d+)__/g, (_, index) => {
    return linkPlaceholders[Number(index)] || '';
  });
  return formatted;
}

function formatInlineMarkdownPreserveBreaks(text) {
  return formatInlineMarkdown(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>');
}

function normalizePlatformStatus(value) {
  if (PLATFORM_STATUSES.includes(value)) return value;
  return 'open';
}

function platformStatusRank(value) {
  const idx = PLATFORM_STATUSES.indexOf(normalizePlatformStatus(value));
  return idx < 0 ? 0 : idx;
}

function platformStatusLabel(value) {
  return PLATFORM_STATUS_LABELS[normalizePlatformStatus(value)] || PLATFORM_STATUS_LABELS.open;
}

function platformStatusSegmentLabel(value) {
  const status = normalizePlatformStatus(value);
  return PLATFORM_STATUS_SEGMENT_LABELS[status] || PLATFORM_STATUS_SEGMENT_LABELS.open;
}

function platformStatusFilterPrefix(value) {
  return normalizePlatformStatus(value) === 'open' ? '仅显示' : '显示';
}

function platformStatusFilterLabel(value) {
  const status = normalizePlatformStatus(value);
  return `${platformStatusFilterPrefix(status)}${platformStatusSegmentLabel(status)}${PLATFORM_STATUS_FILTER_SUFFIX}`;
}

/** 当前档位的累计高亮：除「所有」外，高亮 max 及更开放的档；「所有」只高亮自身 */
function isPlatformStatusSegmentActive(status, maxStatus) {
  const max = normalizePlatformStatus(maxStatus);
  const current = normalizePlatformStatus(status);
  if (max === 'delisted') return current === 'delisted';
  return platformStatusRank(current) <= platformStatusRank(max);
}

/** 读出当前筛选：如「显示开放购买和定时放量平台」 */
function platformStatusFilterPhrase(maxStatus) {
  const max = normalizePlatformStatus(maxStatus);
  if (max === 'delisted') {
    return `${platformStatusFilterPrefix(max)}${platformStatusSegmentLabel(max)}${PLATFORM_STATUS_FILTER_SUFFIX}`;
  }
  const labels = PLATFORM_STATUSES
    .filter((status) => isPlatformStatusSegmentActive(status, max))
    .map((status) => platformStatusSegmentLabel(status));
  return `${platformStatusFilterPrefix(max)}${labels.join('和')}${PLATFORM_STATUS_FILTER_SUFFIX}`;
}

function matchesDerivedTag(platform, rule) {
  if (rule.platformStatus !== undefined) {
    if (normalizePlatformStatus(platform.platformStatus) !== rule.platformStatus) {
      return false;
    }
  }
  if (rule.dimension !== undefined && rule.minScore !== undefined) {
    const dim = platform.dimensions?.[rule.dimension];
    if (!dim || dim.score < rule.minScore) {
      return false;
    }
  }
  return true;
}

function matchesOperationalTag(platform, label) {
  return Array.isArray(platform.tags) && platform.tags.includes(label);
}

function filterPlatforms(platforms, {
  selectedLabels,
  platformStatusMax,
  derivedTags,
  operationalTags,
  pinnedIds
}) {
  const pinnedSet = new Set(normalizePinnedIds(pinnedIds));
  function isPinnedPlatform(platform) {
    const id = platform && typeof platform.slug === 'string' ? platform.slug.trim() : '';
    return !!(id && pinnedSet.has(id));
  }

  let result = platforms;
  const maxRank = platformStatusRank(platformStatusMax ?? DEFAULT_PLATFORM_STATUS_MAX);
  result = result.filter(
    (p) => isPinnedPlatform(p) || platformStatusRank(p.platformStatus) <= maxRank
  );

  if (!selectedLabels || selectedLabels.length === 0) {
    return result;
  }

  const derivedByLabel = new Map((derivedTags || []).map(t => [t.label, t]));

  return result.filter(platform => {
    if (isPinnedPlatform(platform)) return true;
    for (const label of selectedLabels) {
      const derived = derivedByLabel.get(label);
      if (derived) {
        if (!matchesDerivedTag(platform, derived.rule)) {
          return false;
        }
      } else {
        if (!matchesOperationalTag(platform, label)) {
          return false;
        }
      }
    }
    return true;
  });
}

const PLATFORM_PIN_STORAGE_KEY = 'platformCatalogPinnedIds';
const PLATFORM_PIN_MAX = 50;

function normalizePinnedIds(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const id = String(item).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizePinnedIds(pinnedIds, platforms) {
  const valid = new Set(
    (Array.isArray(platforms) ? platforms : [])
      .map((p) => (p && typeof p.slug === 'string' ? p.slug.trim() : ''))
      .filter(Boolean)
  );
  return normalizePinnedIds(pinnedIds).filter((id) => valid.has(id));
}

function isPlatformPinned(platformId, pinnedIds) {
  const id = typeof platformId === 'string' ? platformId.trim() : '';
  if (!id) return false;
  return normalizePinnedIds(pinnedIds).includes(id);
}

function togglePinnedId(pinnedIds, platformId, options = {}) {
  const id = typeof platformId === 'string' ? platformId.trim() : String(platformId || '').trim();
  const list = normalizePinnedIds(pinnedIds);
  if (!id) return list;
  const max =
    Number.isFinite(Number(options.max)) && Number(options.max) > 0
      ? Math.floor(Number(options.max))
      : PLATFORM_PIN_MAX;
  const idx = list.indexOf(id);
  if (idx >= 0) {
    return list.filter((_, i) => i !== idx);
  }
  return [id, ...list].slice(0, max);
}

function sortPlatformsByPinned(platforms, pinnedIds) {
  return sortItemsByPinned(platforms, pinnedIds, (platform) =>
    platform && typeof platform.slug === 'string' ? platform.slug.trim() : ''
  );
}

function sortItemsByPinned(items, pinnedIds, getId) {
  const list = Array.isArray(items) ? items.slice() : [];
  const pinned = normalizePinnedIds(pinnedIds);
  const resolveId =
    typeof getId === 'function' ? getId : (item) => (item && typeof item.id === 'string' ? item.id.trim() : '');
  if (!pinned.length || !list.length) return list;

  const rank = new Map(pinned.map((id, index) => [id, index]));
  const head = [];
  const tail = [];
  for (const item of list) {
    const id = resolveId(item);
    if (id && rank.has(id)) head.push(item);
    else tail.push(item);
  }
  head.sort((a, b) => rank.get(resolveId(a)) - rank.get(resolveId(b)));
  return head.concat(tail);
}

const PLANS_TABLE_PIN_STORAGE_KEY = 'plansTablePinnedIds';

function getPlanRowPinId(plan) {
  if (!plan || typeof plan !== 'object') return '';
  return String(plan.slug || '').trim();
}

function sanitizePinnedIdList(pinnedIds, validIds) {
  const valid = new Set(
    (Array.isArray(validIds) ? validIds : [])
      .map((id) => String(id == null ? '' : id).trim())
      .filter(Boolean)
  );
  return normalizePinnedIds(pinnedIds).filter((id) => valid.has(id));
}

/** 把已 pin 但被筛选掉的项从全集补回 */
function mergePinnedIntoFiltered(allItems, filteredItems, pinnedIds, getId) {
  const resolveId = typeof getId === 'function' ? getId : () => '';
  const result = Array.isArray(filteredItems) ? filteredItems.slice() : [];
  const pinned = normalizePinnedIds(pinnedIds);
  if (!pinned.length) return result;

  const seen = new Set();
  for (const item of result) {
    const id = resolveId(item);
    if (id) seen.add(id);
  }
  const byId = new Map();
  for (const item of Array.isArray(allItems) ? allItems : []) {
    const id = resolveId(item);
    if (id && !byId.has(id)) byId.set(id, item);
  }
  for (const id of pinned) {
    if (seen.has(id)) continue;
    const item = byId.get(id);
    if (item) {
      result.push(item);
      seen.add(id);
    }
  }
  return result;
}

/** 拆成：按 pin 顺序的头部 + 其余（供只排序未 pin 段） */
function partitionPinnedItems(items, pinnedIds, getId) {
  const resolveId = typeof getId === 'function' ? getId : () => '';
  const pinned = normalizePinnedIds(pinnedIds);
  const pinnedSet = new Set(pinned);
  const headMap = new Map();
  const tail = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = resolveId(item);
    if (id && pinnedSet.has(id)) headMap.set(id, item);
    else tail.push(item);
  }
  const head = [];
  for (const id of pinned) {
    if (headMap.has(id)) head.push(headMap.get(id));
  }
  return { head, tail };
}

function buildRowPinButtonHtml({ pinId, pinned } = {}) {
  const id = typeof pinId === 'string' ? pinId.trim() : '';
  if (!id) return '';
  const isPinned = !!pinned;
  const label = isPinned ? '取消置顶' : '置顶';
  const classes = ['platform-pin-btn', 'table-row-pin-btn', isPinned ? 'is-pinned' : '']
    .filter(Boolean)
    .join(' ');
  const icon = isPinned
    ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  return (
    `<button type="button" class="${classes}" data-table-pin="1" data-pin-id="${escapeHtml(id)}" ` +
    `aria-pressed="${isPinned ? 'true' : 'false'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">` +
    icon +
    `</button>`
  );
}

function readPinnedIdsFromStorage(storage, key) {
  const storageKey = key || PLATFORM_PIN_STORAGE_KEY;
  if (!storage || typeof storage.getItem !== 'function') return [];
  try {
    const raw = storage.getItem(storageKey);
    if (raw == null || raw === '') return [];
    return normalizePinnedIds(JSON.parse(raw));
  } catch (_) {
    return [];
  }
}

function writePinnedIdsToStorage(storage, pinnedIds, key) {
  const storageKey = key || PLATFORM_PIN_STORAGE_KEY;
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(storageKey, JSON.stringify(normalizePinnedIds(pinnedIds)));
    return true;
  } catch (_) {
    return false;
  }
}

function buildPlatformPinButtonHtml({ platformId, pinned, variant } = {}) {
  const id = typeof platformId === 'string' ? platformId.trim() : '';
  if (!id) return '';
  const isPinned = !!pinned;
  const kind = variant === 'detail' ? 'detail' : 'card';
  const label = isPinned ? '取消置顶' : '置顶';
  const classes = [
    kind === 'detail' ? 'platform-detail-pin-btn' : 'platform-pin-btn',
    isPinned ? 'is-pinned' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const icon = isPinned
    ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  return (
    `<button type="button" class="${classes}" data-platform-pin="1" data-platform-id="${escapeHtml(id)}" ` +
    `aria-pressed="${isPinned ? 'true' : 'false'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">` +
    icon +
    `</button>`
  );
}

function collectModelsForVendor(plans, platformSlug) {
  const seen = new Set();
  const models = [];

  for (const plan of plans) {
    if (plan.platformSlug !== platformSlug || plan.discontinued) {
      continue;
    }
    for (const model of plan.modelLabels || []) {
      if (!seen.has(model)) {
        seen.add(model);
        models.push(model);
      }
    }
  }

  return models;
}

function dimensionCopy(dim) {
  if (!dim || typeof dim !== 'object') return '';
  const detail = typeof dim.detail === 'string' ? dim.detail.trim() : '';
  if (detail) return detail;
  return typeof dim.reason === 'string' ? dim.reason : '';
}

function collectPlansForVendor(plans, platformSlug) {
  if (!Array.isArray(plans) || !platformSlug) return [];
  return plans.filter(p => p && p.platformSlug === platformSlug);
}

function matchMonitorPlatform(platform, boardPlatforms) {
  if (!platform || !Array.isArray(boardPlatforms)) return null;
  const slug = typeof platform.monitorSlug === 'string' ? platform.monitorSlug.trim() : '';
  if (slug) {
    const bySlug = boardPlatforms.find(b => b && b.platform_slug === slug);
    if (bySlug) return bySlug;
  }
  const name = String(platform.name || '').trim();
  if (!name) return null;
  return boardPlatforms.find(b => b && String(b.platform_display_name || '').trim() === name) || null;
}

function resolvePlatformAction(platform, plans) {
  if (platform.action) {
    return platform.action;
  }

  const plan = plans.find(p => p.platformSlug === platform.slug);
  return plan?.action ?? null;
}

function validatePlatformRecords(platforms, plans) {
  const errors = [];
  const platformSlugs = new Set(platforms.map(p => p.slug));

  const referencedSlugs = [...new Set(plans.map(p => p.platformSlug))];
  for (const platformSlug of referencedSlugs) {
    if (!platformSlugs.has(platformSlug)) {
      errors.push(`Plan platformSlug "${platformSlug}" has no matching platform`);
    }
  }

  for (const platform of platforms) {
    const prefix = `Platform "${platform.name}"`;

    if (!PLATFORM_STATUSES.includes(platform.platformStatus)) {
      errors.push(`${prefix}: platformStatus must be one of ${PLATFORM_STATUSES.join(', ')}`);
    }

    if (platform.tags !== undefined && !Array.isArray(platform.tags)) {
      errors.push(`${prefix}: tags must be an array`);
    }

    if (Object.prototype.hasOwnProperty.call(platform, 'summary')) {
      if (typeof platform.summary !== 'string' || platform.summary.trim() === '') {
        errors.push(`${prefix}: summary must be a non-empty string when present`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(platform, 'detail')) {
      if (typeof platform.detail !== 'string' || platform.detail.trim() === '') {
        errors.push(`${prefix}: detail must be a non-empty string when present`);
      }
    }

    for (const key of DIMENSION_KEYS) {
      const dim = platform.dimensions?.[key];
      if (!dim) {
        errors.push(`${prefix}: missing dimension "${key}"`);
        continue;
      }

      const { score, reason } = dim;
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        errors.push(`${prefix}: dimension "${key}" score must be an integer in [1, 5]`);
      }
      if (typeof reason !== 'string' || reason.trim() === '') {
        errors.push(`${prefix}: dimension "${key}" reason must be a non-empty string`);
      }
      if (Object.prototype.hasOwnProperty.call(dim, 'detail')) {
        if (typeof dim.detail !== 'string' || dim.detail.trim() === '') {
          errors.push(`${prefix}: dimension "${key}" detail must be a non-empty string when present`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function buildPlatformTagBarHtml(catalogConfig, selectedLabels, platformStatusMax) {
  const cat = catalogConfig || {};
  const selected = selectedLabels || [];
  const mainParts = [];

  const derivedChips = [];
  for (const tag of cat.derivedTags || []) {
    const label = tag.label;
    const active = selected.includes(label);
    derivedChips.push(
      `<button type="button" class="platform-tag-chip platform-tag-chip--derived${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
    );
  }
  if (derivedChips.length) {
    mainParts.push(`<div class="platform-tag-group platform-tag-group--derived" role="group" aria-label="预设筛选">${derivedChips.join('')}</div>`);
  }

  const operationalChips = [];
  for (const label of cat.operationalTags || []) {
    const active = selected.includes(label);
    operationalChips.push(
      `<button type="button" class="platform-tag-chip platform-tag-chip--operational${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
    );
  }
  if (operationalChips.length) {
    if (derivedChips.length) {
      mainParts.push('<span class="platform-tag-sep" aria-hidden="true"></span>');
    }
    mainParts.push(`<div class="platform-tag-group platform-tag-group--operational" role="group" aria-label="平台标签">${operationalChips.join('')}</div>`);
  }

  const mainHtml = mainParts.length
    ? `<div class="platform-tag-bar-main">${mainParts.join('')}</div>`
    : '';

  return `${mainHtml}${buildPlatformStatusSliderHtml(platformStatusMax)}`;
}

function buildPlatformStatusSliderHtml(platformStatusMax) {
  const max = normalizePlatformStatus(platformStatusMax ?? DEFAULT_PLATFORM_STATUS_MAX);
  const parts = [];
  PLATFORM_STATUSES.forEach((status, rank) => {
    const active = isPlatformStatusSegmentActive(status, max);
    const segmentLabel = platformStatusSegmentLabel(status);
    const fullLabel = platformStatusFilterLabel(status);
    parts.push(
      `<button type="button" class="platform-status-seg${active ? ' is-active' : ''}" data-platform-status="${status}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(fullLabel)}">` +
      `${escapeHtml(segmentLabel)}` +
      `</button>`
    );
    const next = PLATFORM_STATUSES[rank + 1];
    // 「和」常驻，「所有」前不插；用 is-on 控制显隐
    if (next && next !== 'delisted') {
      const andOn =
        isPlatformStatusSegmentActive(status, max) &&
        isPlatformStatusSegmentActive(next, max);
      parts.push(
        `<span class="platform-status-and${andOn ? ' is-on' : ''}" aria-hidden="true">和</span>`
      );
    }
  });

  return (
    `<div class="platform-status-slider" data-platform-status-max="${max}" role="group" aria-label="${escapeHtml(platformStatusFilterPhrase(max))}">` +
    `<span class="platform-status-prefix">${escapeHtml(platformStatusFilterPrefix(max))}</span>` +
    `<div class="platform-status-segments" tabindex="0">${parts.join('')}</div>` +
    `<span class="platform-status-suffix">${escapeHtml(PLATFORM_STATUS_FILTER_SUFFIX)}</span>` +
    `</div>`
  );
}

const EXTERNAL_LINK_ICON =
  '<svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

function buildPlatformCardHtml(platform, plans, options = {}) {
  const sanitizeUrl = options.sanitizeUrl || (url => url);
  const apiModelNames = Array.isArray(options.apiModelNames)
    ? options.apiModelNames.filter((name) => typeof name === 'string' && name.trim())
    : [];
  const hasApiPlan = !!options.hasApiPlan;
  const rawAction = resolvePlatformAction(platform, plans);
  const action = sanitizeUrl(rawAction);
  const name = escapeHtml(platform.name || '');
  const nameHtml = action
    ? `<a class="platform-name-link" href="${escapeHtml(action)}" target="_blank" rel="noopener noreferrer"><span class="platform-name-text">${name}</span>${EXTERNAL_LINK_ICON}</a>`
    : `<span class="platform-name">${name}</span>`;

  const rating = Math.max(0, Math.min(5, Number(platform.rating) || 0));
  const stars = '⭐️'.repeat(rating);
  const summaryText =
    typeof platform.summary === 'string' && platform.summary.trim()
      ? platform.summary.trim()
      : '';
  const summary = summaryText
    ? `<p class="platform-summary">${formatInlineMarkdownPreserveBreaks(summaryText)}</p>`
    : '';

  const status = normalizePlatformStatus(platform.platformStatus);
  const statusHtml =
    status === 'open'
      ? ''
      : `<span class="platform-rush" data-platform-status="${status}">${escapeHtml(platformStatusLabel(status))}</span>`;
  const apiBadge = hasApiPlan
    ? `<span class="platform-rush platform-rush--api">按量</span>`
    : '';

  const dimsHtml = PLATFORM_DIMENSION_META.map(({ key, label }) => {
    const dim = (platform.dimensions && platform.dimensions[key]) || {};
    const score = dim.score == null ? '—' : String(dim.score);
    const scoreHtml =
      score === '—'
        ? `<span class="dim-score">${escapeHtml(score)}</span>`
        : `<span class="dim-score">${escapeHtml(score)}<span class="dim-score-unit">分</span></span>`;
    return `<li data-dim="${escapeHtml(key)}"><div class="dim-meta">${scoreHtml}<span class="dim-label">${escapeHtml(label)}</span></div><span class="dim-reason">${formatInlineMarkdownPreserveBreaks(dim.reason || '')}</span></li>`;
  }).join('');

  const tags = Array.isArray(platform.tags) ? platform.tags : [];
  const tagsHtml = tags.length
    ? `<div class="platform-tags" aria-label="标签">${tags.map((tag) => `<span class="platform-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  let models = collectModelsForVendor(plans, platform.slug);
  if (!models.length && apiModelNames.length) {
    models = [...new Set(apiModelNames)];
  }
  const modelLimit = 5;
  const shownModels = models.slice(0, modelLimit);
  const extraModels = models.length - shownModels.length;
  const modelsHtml = models.length
    ? `<div class="platform-models" aria-label="模型">${shownModels.map((model) => `<span class="model-tag">${escapeHtml(model)}</span>`).join('')}${extraModels > 0 ? `<span class="model-tag model-tag-more">+${extraModels}</span>` : ''}</div>`
    : '';

  const discontinuedClass = status === 'delisted' ? ' is-discontinued' : '';
  const platformId = platform && typeof platform.slug === 'string' ? platform.slug.trim() : '';
  const pinned = isPlatformPinned(platformId, options.pinnedIds);
  const pinnedClass = pinned ? ' is-pinned' : '';
  const pinHtml = buildPlatformPinButtonHtml({
    platformId,
    pinned,
    variant: 'card'
  });

  return `
                <article class="platform-card${discontinuedClass}${pinnedClass}" data-platform-id="${escapeHtml(platformId)}" tabindex="0" role="button" aria-label="${name} 详情">
                    <header>
                        <div class="platform-card-heading">
                            ${nameHtml}
                            ${statusHtml}
                            ${apiBadge}
                        </div>
                        <div class="platform-card-aside">
                            ${pinHtml}
                            <span class="platform-rating" aria-label="${rating} 星">${stars}</span>
                        </div>
                    </header>
                    ${summary}
                    <ul class="platform-dimensions">${dimsHtml}</ul>
                    ${tagsHtml}
                    ${modelsHtml}
                    <span class="platform-card-hint">查看详情 <span aria-hidden="true">→</span></span>
                </article>
            `;
}

const PlatformCatalog = {
  DIMENSION_KEYS,
  PLATFORM_DIMENSION_META,
  PLATFORM_STATUSES,
  PLATFORM_STATUS_LABELS,
  PLATFORM_STATUS_SEGMENT_LABELS,
  PLATFORM_STATUS_FILTER_SUFFIX,
  DEFAULT_PLATFORM_STATUS_MAX,
  escapeHtml,
  formatInlineMarkdown,
  formatInlineMarkdownPreserveBreaks,
  normalizePlatformStatus,
  platformStatusRank,
  platformStatusLabel,
  platformStatusSegmentLabel,
  platformStatusFilterPrefix,
  platformStatusFilterLabel,
  isPlatformStatusSegmentActive,
  platformStatusFilterPhrase,
  matchesDerivedTag,
  matchesOperationalTag,
  filterPlatforms,
  PLATFORM_PIN_STORAGE_KEY,
  PLATFORM_PIN_MAX,
  PLANS_TABLE_PIN_STORAGE_KEY,
  normalizePinnedIds,
  sanitizePinnedIds,
  sanitizePinnedIdList,
  isPlatformPinned,
  togglePinnedId,
  sortPlatformsByPinned,
  sortItemsByPinned,
  getPlanRowPinId,
  mergePinnedIntoFiltered,
  partitionPinnedItems,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
  buildPlatformPinButtonHtml,
  buildRowPinButtonHtml,
  collectModelsForVendor,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform,
  resolvePlatformAction,
  validatePlatformRecords,
  buildPlatformTagBarHtml,
  buildPlatformStatusSliderHtml,
  buildPlatformCardHtml
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlatformCatalog;
} else {
  window.PlatformCatalog = PlatformCatalog;
}
