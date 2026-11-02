(function () {
const CatalogUI = typeof module === 'object' && module.exports ? require('./ui-core.js') : globalThis.CodingPlanUI;
const PlatformGuideRegistry = typeof module === 'object' && module.exports
  ? require('./platform-pages.js') : (globalThis.PlatformPages || { getUrl: () => null });
const PlatformEntityData = typeof module === 'object' && module.exports
  ? require('./entity-data.js') : globalThis.EntityData;

function getPlatformGuideUrl(slug) { return PlatformGuideRegistry.getUrl(slug); }

const DIMENSION_KEYS = ['value', 'models', 'stability'];

const PLATFORM_DIMENSION_META = [
  { key: 'value', label: '性价比' },
  { key: 'models', label: '模型' },
  { key: 'stability', label: '可用性' }
];

const PLATFORM_STATUSES = ['open', 'restricted', 'delisted'];
const PLATFORM_STATUS_LABELS = CatalogUI.statusLabels;
const DEFAULT_PLATFORM_STATUS_MAX = 'restricted';

const escapeHtml = CatalogUI.escapeHtml;

const sanitizeInlineHttpUrl = CatalogUI.sanitizeUrl;

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
  if (value === 'limited' || value === 'paused') return 'restricted';
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

function filterPlatforms(platforms, { platformStatusMax, pinnedIds } = {}) {
  const pinnedSet = new Set(normalizePinnedIds(pinnedIds));
  const maxRank = platformStatusRank(platformStatusMax ?? DEFAULT_PLATFORM_STATUS_MAX);
  return platforms.filter(platform => pinnedSet.has(platform.slug) || platformStatusRank(platform.platformStatus) <= maxRank);
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
  const kind = variant === 'detail' ? 'detail' : 'card';
  return CatalogUI.pinButton({pinned:!!pinned, className:kind === 'detail' ? 'platform-detail-pin-btn' : 'platform-pin-btn', attributes:{'data-platform-pin':'1','data-platform-id':id}});
}

function collectModelsForVendor(plans, platformSlug) {
  const seen = new Set();
  const models = [];

  for (const plan of plans) {
    if (plan.platformSlug !== platformSlug || plan.planStatus === 'delisted') {
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
      if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
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

const EXTERNAL_LINK_ICON = CatalogUI.externalLinkIcon;

function buildPlatformCardHtml(platform, plans, options = {}) {
  const sanitizeUrl = options.sanitizeUrl || CatalogUI.sanitizeUrl;
  const supportedModels = Array.isArray(options.supportedModels)
    ? options.supportedModels
    : [];
  const hasApiPlan = !!options.hasApiPlan;
  const action = sanitizeUrl(platform.action);
  const name = escapeHtml(platform.name || '');
  const nameHtml = action
    ? `<a class="platform-name-link" href="${escapeHtml(action)}" target="_blank" rel="noopener noreferrer"><span class="platform-name-text">${name}</span>${EXTERNAL_LINK_ICON}</a>`
    : `<span class="platform-name">${name}</span>`;

  const rating = Math.max(0, Math.min(5, Number(platform.rating) || 0));
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

  const models = supportedModels.length ? supportedModels.map(model => model.name) : collectModelsForVendor(plans, platform.slug);
  const modelsHtml = CatalogUI.modelTags(models, {
    maxRows: options.modelMaxRows ?? 2, className: 'platform-models', ariaLabel: '模型', toggleAttribute: 'data-platform-toggle-models'
  });

  const capabilitiesHtml = `<div class="platform-capabilities">${PlatformEntityData.platformHarnessApiBadge(platform, plans)}</div>`;
  const dimensionsHtml = `<ul class="platform-dimensions">${dimsHtml}</ul>`;
  const detailSections = options.capabilitiesBeforeScores
    ? [capabilitiesHtml, dimensionsHtml] : [dimensionsHtml, capabilitiesHtml];
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
                <article class="platform-card${discontinuedClass}${pinnedClass}${options.featured ? ' is-featured' : ''}" data-platform-id="${escapeHtml(platformId)}" tabindex="0" role="button" aria-label="${name} 详情">
                    <header>
                        <div class="platform-card-heading">
                            ${nameHtml}
                            ${statusHtml}
                            ${apiBadge}
                        </div>
                        <div class="platform-card-aside">
                            ${options.featured ? '<span class="platform-featured-badge">精选</span>' : ''}
                            ${pinHtml}
                            <span class="platform-rating" aria-label="${rating > 0 ? `${rating} 星` : '待评定'}">${rating > 0 ? `★ ${rating.toFixed(1)}` : '待评定'}</span>
                        </div>
                    </header>
                    ${summary}
                    ${detailSections.join('\n                    ')}
                    ${modelsHtml}
                    <div class="platform-card-links"><span class="platform-card-hint">快速查看 <span aria-hidden="true">→</span></span>${getPlatformGuideUrl(platformId) ? `<a class="platform-guide-link" href="${escapeHtml(getPlatformGuideUrl(platformId))}">平台介绍 →</a>` : ''}</div>
                </article>
            `;
}

function togglePlatformModels(event) {
  return CatalogUI.toggleModels(event, '[data-platform-toggle-models]');
}

// 页面负责状态、排序和埋点；这里只统一卡片内操作与焦点恢复。
function bindPlatformCardActions(host, { onTogglePin, onOpen }) {
  host.addEventListener('click', event => {
    if (togglePlatformModels(event)) return;
    const pinButton = event.target.closest('[data-platform-pin="1"]');
    if (pinButton) {
      const id = pinButton.getAttribute('data-platform-id');
      onTogglePin(id, event);
      // 置顶会重建卡片，需从新 DOM 找回按钮。
      Array.from(host.querySelectorAll('[data-platform-pin="1"]'))
        .find(button => button.getAttribute('data-platform-id') === id)?.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest('a')) return;
    const card = event.target.closest('.platform-card');
    if (card) onOpen(card.getAttribute('data-platform-id'), card);
  });
  host.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('a,button')) return;
    const card = event.target.closest('.platform-card');
    if (!card) return;
    event.preventDefault();
    onOpen(card.getAttribute('data-platform-id'), card);
  });
}

function buildPlanModelListHtml(labels) {
  const models = Array.isArray(labels) ? labels : [];
  const tags = models.map(name => `<span class="model-tag">${escapeHtml(name)}</span>`).join('');
  if (models.length <= 3) return tags;
  return `<details class="home-plan-models"><summary>${escapeHtml(models.slice(0, 2).join('、'))} 等 ${models.length} 个模型</summary><div>${tags}</div></details>`;
}

const PlatformCatalog = {
  EXTERNAL_LINK_ICON,
  buildPlanModelListHtml,
  getPlatformGuideUrl,
  DIMENSION_KEYS,
  PLATFORM_DIMENSION_META,
  PLATFORM_STATUSES,
  PLATFORM_STATUS_LABELS,
  DEFAULT_PLATFORM_STATUS_MAX,
  escapeHtml,
  formatInlineMarkdown,
  formatInlineMarkdownPreserveBreaks,
  normalizePlatformStatus,
  platformStatusRank,
  platformStatusLabel,
  filterPlatforms,
  PLATFORM_PIN_STORAGE_KEY,
  PLATFORM_PIN_MAX,
  normalizePinnedIds,
  sanitizePinnedIds,
  isPlatformPinned,
  togglePinnedId,
  sortPlatformsByPinned,
  sortItemsByPinned,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
  buildPlatformPinButtonHtml,
  collectModelsForVendor,
  dimensionCopy,
  collectPlansForVendor,
  validatePlatformRecords,
  buildPlatformCardHtml,
  togglePlatformModels,
  bindPlatformCardActions
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlatformCatalog;
} else {
  window.PlatformCatalog = PlatformCatalog;
}

})();
