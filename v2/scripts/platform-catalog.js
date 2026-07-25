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
const DEFAULT_PLATFORM_STATUS_MAX = 'limited';

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  operationalTags
}) {
  let result = platforms;
  const maxRank = platformStatusRank(platformStatusMax ?? DEFAULT_PLATFORM_STATUS_MAX);
  result = result.filter(p => platformStatusRank(p.platformStatus) <= maxRank);

  if (!selectedLabels || selectedLabels.length === 0) {
    return result;
  }

  const derivedByLabel = new Map((derivedTags || []).map(t => [t.label, t]));

  return result.filter(platform => {
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
      .map((p) => (p && typeof p.id === 'string' ? p.id.trim() : ''))
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
  const list = Array.isArray(platforms) ? platforms.slice() : [];
  const pinned = normalizePinnedIds(pinnedIds);
  if (!pinned.length || !list.length) return list;

  const rank = new Map(pinned.map((id, index) => [id, index]));
  const head = [];
  const tail = [];
  for (const platform of list) {
    const id = platform && typeof platform.id === 'string' ? platform.id.trim() : '';
    if (id && rank.has(id)) head.push(platform);
    else tail.push(platform);
  }
  head.sort((a, b) => rank.get(a.id.trim()) - rank.get(b.id.trim()));
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

function collectModelsForVendor(plans, vendorName) {
  const seen = new Set();
  const models = [];

  for (const plan of plans) {
    if (plan.vendor !== vendorName || plan.discontinued) {
      continue;
    }
    for (const model of plan.models || []) {
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

function collectPlansForVendor(plans, vendorName) {
  if (!Array.isArray(plans) || !vendorName) return [];
  return plans.filter(p => p && p.vendor === vendorName);
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

  const plan = plans.find(p => p.vendor === platform.name);
  return plan?.action ?? null;
}

function getPaygEntry(paygPricing, platformId) {
  if (!paygPricing || typeof paygPricing !== 'object' || !platformId) return null;
  const entry = paygPricing[platformId];
  return entry && typeof entry === 'object' ? entry : null;
}

function collectModelsFromPayg(entry) {
  if (!entry || !Array.isArray(entry.models)) return [];
  const names = [];
  for (const model of entry.models) {
    const name = model && typeof model.name === 'string' ? model.name.trim() : '';
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function formatPaygPrice(value, currency) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const cur = currency || '¥';
  const text = Number.isInteger(num) ? String(num) : String(num);
  return `${cur}${text}`;
}

function isFinitePaygPrice(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function paygRowHasAnyPrice(row) {
  if (!row) return false;
  return (
    isFinitePaygPrice(row.input) ||
    isFinitePaygPrice(row.cache) ||
    isFinitePaygPrice(row.output)
  );
}

function normalizePaygPriceField(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const PAYG_DOC_META_KEYS = new Set(['modelOrder']);

function getPaygModelOrderList(paygPricing) {
  if (!paygPricing || typeof paygPricing !== 'object' || Array.isArray(paygPricing)) {
    return [];
  }
  if (!Array.isArray(paygPricing.modelOrder)) return [];
  const names = [];
  const seen = new Set();
  for (const item of paygPricing.modelOrder) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const name = item.trim();
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function resolvePaygModelOrder(modelOrderList, modelName, fallbackIndex) {
  const list = Array.isArray(modelOrderList) ? modelOrderList : [];
  const name = typeof modelName === 'string' ? modelName.trim() : '';
  if (name) {
    const idx = list.indexOf(name);
    if (idx >= 0) return idx;
  }
  return 1000 + (Number.isFinite(fallbackIndex) ? fallbackIndex : 0);
}

function flattenPaygRows(paygPricing, platforms, plans) {
  const planList = Array.isArray(plans) ? plans : [];
  const byId = new Map(
    (Array.isArray(platforms) ? platforms : [])
      .filter((p) => p && typeof p.id === 'string' && p.id)
      .map((p) => [p.id, p])
  );
  if (!paygPricing || typeof paygPricing !== 'object' || Array.isArray(paygPricing)) {
    return [];
  }
  const modelOrderList = getPaygModelOrderList(paygPricing);
  const rows = [];
  for (const [platformId, entry] of Object.entries(paygPricing)) {
    if (PAYG_DOC_META_KEYS.has(platformId)) continue;
    const platform = byId.get(platformId);
    if (!platform || !entry || typeof entry !== 'object' || !Array.isArray(entry.models)) {
      continue;
    }
    const currency = entry.currency || '¥';
    const unit = entry.unit || 'per_m_tokens';
    const platformNotes = Array.isArray(entry.notes)
      ? entry.notes.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
      : [];
    const action = resolvePlatformAction(platform, planList);
    entry.models.forEach((model, index) => {
      if (!model || typeof model.name !== 'string' || !model.name.trim()) return;
      const modelName = model.name.trim();
      const notes = platformNotes.slice();
      if (typeof model.note === 'string' && model.note.trim()) {
        notes.push(model.note.trim());
      }
      rows.push({
        platformId,
        platformName: String(platform.name || platformId),
        rating: Number(platform.rating) || 0,
        action: action || null,
        modelName,
        order: resolvePaygModelOrder(modelOrderList, modelName, index),
        input: normalizePaygPriceField(model.input),
        cache: normalizePaygPriceField(model.cache),
        output: normalizePaygPriceField(model.output),
        currency,
        unit,
        notes
      });
    });
  }
  return rows;
}

function filterPaygRows(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const platformIds = Array.isArray(options.platformIds) ? options.platformIds : null;
  const modelNames = Array.isArray(options.modelNames) ? options.modelNames : null;
  const pricedOnly = !!options.pricedOnly;
  const platformSet = platformIds && platformIds.length ? new Set(platformIds) : null;
  const modelSet = modelNames && modelNames.length ? new Set(modelNames) : null;
  return list.filter((row) => {
    if (!row) return false;
    if (platformSet && !platformSet.has(row.platformId)) return false;
    if (modelSet && !modelSet.has(row.modelName)) return false;
    if (pricedOnly && !paygRowHasAnyPrice(row)) return false;
    return true;
  });
}

function sortPaygRows(rows, options = {}) {
  const key = options.key || 'order';
  const dir = options.dir === 'desc' ? -1 : 1;
  const list = (Array.isArray(rows) ? rows : []).slice();
  const isNumeric =
    key === 'input' ||
    key === 'cache' ||
    key === 'output' ||
    key === 'rating' ||
    key === 'order';

  function numericValue(row, field) {
    if (!row) return NaN;
    const raw = row[field];
    if (raw == null || raw === '') return NaN;
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  }

  function compareNumeric(av, bv, direction) {
    const aOk = Number.isFinite(av);
    const bOk = Number.isFinite(bv);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    if (av === bv) return 0;
    return av < bv ? -direction : direction;
  }

  list.sort((a, b) => {
    if (isNumeric) {
      const primary = compareNumeric(numericValue(a, key), numericValue(b, key), dir);
      if (primary !== 0) return primary;
      // 同 order / 同价时：按模型名，再按输入价，便于同模型比价挨在一起
      if (key === 'order') {
        const byName = String((a && a.modelName) || '').localeCompare(
          String((b && b.modelName) || ''),
          'zh'
        );
        if (byName !== 0) return byName;
        return compareNumeric(numericValue(a, 'input'), numericValue(b, 'input'), 1);
      }
      return 0;
    }
    const as = String((a && a[key]) || '');
    const bs = String((b && b[key]) || '');
    return as.localeCompare(bs, 'zh') * dir;
  });
  return list;
}

function collectPaygFilterOptions(rows) {
  const platforms = [];
  const seenP = new Set();
  const modelMeta = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    if (row.platformId && !seenP.has(row.platformId)) {
      seenP.add(row.platformId);
      platforms.push({ id: row.platformId, name: row.platformName || row.platformId });
    }
    if (row.modelName && !modelMeta.has(row.modelName)) {
      modelMeta.set(row.modelName, {
        name: row.modelName,
        order: Number.isFinite(Number(row.order)) ? Number(row.order) : 9999
      });
    } else if (row.modelName && modelMeta.has(row.modelName)) {
      const prev = modelMeta.get(row.modelName);
      const nextOrder = Number.isFinite(Number(row.order)) ? Number(row.order) : 9999;
      if (nextOrder < prev.order) prev.order = nextOrder;
    }
  }
  const models = [...modelMeta.values()]
    .sort((a, b) => (a.order === b.order ? a.name.localeCompare(b.name, 'zh') : a.order - b.order))
    .map((m) => m.name);
  return { platforms, models };
}

function buildPaygPricingSectionHtml(entry, modelOrder) {
  if (!entry || !Array.isArray(entry.models) || !entry.models.length) return '';
  const currency = entry.currency || '¥';
  const notes = Array.isArray(entry.notes)
    ? entry.notes.filter((n) => typeof n === 'string' && n.trim())
    : [];
  const notesHtml = notes.length
    ? `<ul class="platform-detail-payg-notes">${notes
        .map((n) => `<li>${escapeHtml(n.trim())}</li>`)
        .join('')}</ul>`
    : '';

  const orderList = Array.isArray(modelOrder)
    ? modelOrder.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
    : [];

  const rows = entry.models
    .slice()
    .sort((a, b) => {
      const an = a && typeof a.name === 'string' ? a.name.trim() : '';
      const bn = b && typeof b.name === 'string' ? b.name.trim() : '';
      const ao = resolvePaygModelOrder(orderList, an, 0);
      const bo = resolvePaygModelOrder(orderList, bn, 0);
      if (ao !== bo) return ao - bo;
      return an.localeCompare(bn, 'zh');
    })
    .map((model) => {
      if (!model || typeof model.name !== 'string' || !model.name.trim()) return '';
      const note =
        typeof model.note === 'string' && model.note.trim()
          ? `<div class="platform-detail-payg-model-note">${escapeHtml(model.note.trim())}</div>`
          : '';
      return (
        `<tr>` +
        `<td><span class="platform-detail-payg-model-name">${escapeHtml(model.name.trim())}</span>${note}</td>` +
        `<td>${escapeHtml(formatPaygPrice(model.input, currency))}</td>` +
        `<td>${escapeHtml(formatPaygPrice(model.cache, currency))}</td>` +
        `<td>${escapeHtml(formatPaygPrice(model.output, currency))}</td>` +
        `</tr>`
      );
    })
    .filter(Boolean)
    .join('');

  if (!rows) return '';

  return (
    `<section class="platform-detail-section" data-section="payg" aria-labelledby="platformDetailPaygHeading">` +
    `<h3 id="platformDetailPaygHeading" class="platform-detail-section-title">按量定价</h3>` +
    `<p class="platform-detail-payg-unit">单位：元 / 百万 token</p>` +
    `<div class="platform-detail-payg-table-wrap">` +
    `<table class="platform-detail-payg-table">` +
    `<thead><tr><th scope="col">模型</th><th scope="col">输入</th><th scope="col">缓存</th><th scope="col">输出</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `</table>` +
    `</div>` +
    notesHtml +
    `<a class="platform-detail-avail-link" href="index.html?view=payg">在按量计费大表中查看 →</a>` +
    `</section>`
  );
}

function validatePaygPricing(paygPricing, platforms) {
  const errors = [];
  if (paygPricing == null) {
    return { ok: true, errors };
  }
  if (typeof paygPricing !== 'object' || Array.isArray(paygPricing)) {
    return { ok: false, errors: ['payg-pricing.json must be an object keyed by platform id'] };
  }

  const platformIds = new Set(
    (Array.isArray(platforms) ? platforms : [])
      .map((p) => (p && typeof p.id === 'string' ? p.id : ''))
      .filter(Boolean)
  );

  if (Object.prototype.hasOwnProperty.call(paygPricing, 'modelOrder')) {
    if (!Array.isArray(paygPricing.modelOrder)) {
      errors.push('modelOrder must be an array of model name strings when present');
    } else {
      const seen = new Set();
      paygPricing.modelOrder.forEach((item, index) => {
        if (typeof item !== 'string' || !item.trim()) {
          errors.push(`modelOrder[${index}] must be a non-empty string`);
          return;
        }
        const name = item.trim();
        if (seen.has(name)) {
          errors.push(`modelOrder contains duplicate "${name}"`);
        }
        seen.add(name);
      });
    }
  }

  for (const [platformId, entry] of Object.entries(paygPricing)) {
    if (PAYG_DOC_META_KEYS.has(platformId)) continue;
    const prefix = `Payg "${platformId}"`;
    if (!platformIds.has(platformId)) {
      errors.push(`${prefix}: no matching platform id in platforms.json`);
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${prefix}: entry must be an object`);
      continue;
    }
    if (!Array.isArray(entry.models) || entry.models.length === 0) {
      errors.push(`${prefix}: models must be a non-empty array`);
      continue;
    }
    if (entry.notes !== undefined) {
      if (!Array.isArray(entry.notes) || entry.notes.some((n) => typeof n !== 'string' || !n.trim())) {
        errors.push(`${prefix}: notes must be an array of non-empty strings when present`);
      }
    }
    entry.models.forEach((model, index) => {
      const mPrefix = `${prefix} models[${index}]`;
      if (!model || typeof model !== 'object') {
        errors.push(`${mPrefix}: must be an object`);
        return;
      }
      if (typeof model.name !== 'string' || !model.name.trim()) {
        errors.push(`${mPrefix}: name must be a non-empty string`);
      }
      for (const key of ['input', 'cache', 'output']) {
        if (!Object.prototype.hasOwnProperty.call(model, key)) continue;
        if (model[key] === null) continue;
        const num = Number(model[key]);
        if (!Number.isFinite(num) || num < 0) {
          errors.push(`${mPrefix}: ${key} must be null or a non-negative number`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(model, 'note')) {
        if (typeof model.note !== 'string' || !model.note.trim()) {
          errors.push(`${mPrefix}: note must be a non-empty string when present`);
        }
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function validatePlatformRecords(platforms, plans) {
  const errors = [];
  const platformNames = new Set(platforms.map(p => p.name));

  const vendors = [...new Set(plans.map(p => p.vendor))];
  for (const vendor of vendors) {
    if (!platformNames.has(vendor)) {
      errors.push(`Plan vendor "${vendor}" has no matching platform`);
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
  const paygEntry = getPaygEntry(options.paygPricing, platform && platform.id);
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
    ? `<p class="platform-summary">${escapeHtml(summaryText)}</p>`
    : '';

  const status = normalizePlatformStatus(platform.platformStatus);
  const statusHtml =
    status === 'open'
      ? ''
      : `<span class="platform-rush" data-platform-status="${status}">${escapeHtml(platformStatusLabel(status))}</span>`;
  const paygBadge = paygEntry
    ? `<span class="platform-rush platform-rush--payg">按量</span>`
    : '';

  const dimsHtml = PLATFORM_DIMENSION_META.map(({ key, label }) => {
    const dim = (platform.dimensions && platform.dimensions[key]) || {};
    const score = dim.score == null ? '—' : String(dim.score);
    const scoreHtml =
      score === '—'
        ? `<span class="dim-score">${escapeHtml(score)}</span>`
        : `<span class="dim-score">${escapeHtml(score)}<span class="dim-score-unit">分</span></span>`;
    return `<li data-dim="${escapeHtml(key)}"><div class="dim-meta">${scoreHtml}<span class="dim-label">${escapeHtml(label)}</span></div><span class="dim-reason">${escapeHtml(dim.reason || '')}</span></li>`;
  }).join('');

  const tags = Array.isArray(platform.tags) ? platform.tags : [];
  const tagsHtml = tags.length
    ? `<div class="platform-tags" aria-label="标签">${tags.map((tag) => `<span class="platform-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  let models = collectModelsForVendor(plans, platform.name);
  if (!models.length && paygEntry) {
    models = collectModelsFromPayg(paygEntry);
  }
  const modelLimit = 5;
  const shownModels = models.slice(0, modelLimit);
  const extraModels = models.length - shownModels.length;
  const modelsHtml = models.length
    ? `<div class="platform-models" aria-label="模型">${shownModels.map((model) => `<span class="model-tag">${escapeHtml(model)}</span>`).join('')}${extraModels > 0 ? `<span class="model-tag model-tag-more">+${extraModels}</span>` : ''}</div>`
    : '';

  const discontinuedClass = status === 'delisted' ? ' is-discontinued' : '';
  const platformId = platform && typeof platform.id === 'string' ? platform.id.trim() : '';
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
                            ${paygBadge}
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
  normalizePinnedIds,
  sanitizePinnedIds,
  isPlatformPinned,
  togglePinnedId,
  sortPlatformsByPinned,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
  buildPlatformPinButtonHtml,
  collectModelsForVendor,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform,
  resolvePlatformAction,
  getPaygEntry,
  collectModelsFromPayg,
  formatPaygPrice,
  paygRowHasAnyPrice,
  getPaygModelOrderList,
  flattenPaygRows,
  filterPaygRows,
  sortPaygRows,
  collectPaygFilterOptions,
  buildPaygPricingSectionHtml,
  validatePaygPricing,
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
