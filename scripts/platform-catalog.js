const DIMENSION_KEYS = ['value', 'stability', 'models', 'convenience'];

const PLATFORM_DIMENSION_META = [
  { key: 'value', label: '性价比' },
  { key: 'stability', label: '稳定性' },
  { key: 'models', label: '模型覆盖' },
  { key: 'convenience', label: '使用便捷性' }
];

const PURCHASE_MODES = ['anytime', 'scheduled', 'rush'];
const PURCHASE_MODE_LABELS = {
  anytime: '随时购买',
  scheduled: '定时购买',
  rush: '需要抢购'
};

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizePurchaseMode(value) {
  if (PURCHASE_MODES.includes(value)) return value;
  return 'anytime';
}

function purchaseModeLabel(mode) {
  return PURCHASE_MODE_LABELS[normalizePurchaseMode(mode)] || PURCHASE_MODE_LABELS.anytime;
}

function matchesDerivedTag(platform, rule) {
  if (rule.purchaseMode !== undefined) {
    if (normalizePurchaseMode(platform.purchaseMode) !== rule.purchaseMode) {
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
  showDiscontinued,
  showRushPurchase,
  derivedTags,
  operationalTags,
  showDiscontinuedLabel,
  showRushPurchaseLabel
}) {
  let result = platforms;

  if (!showDiscontinued) {
    result = result.filter(p => p.status !== 'discontinued');
  }

  if (!showRushPurchase) {
    result = result.filter(p => normalizePurchaseMode(p.purchaseMode) !== 'rush');
  }

  if (!selectedLabels || selectedLabels.length === 0) {
    return result;
  }

  const derivedByLabel = new Map((derivedTags || []).map(t => [t.label, t]));

  return result.filter(platform => {
    for (const label of selectedLabels) {
      if (label === showDiscontinuedLabel || label === showRushPurchaseLabel) {
        continue;
      }

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

    if (platform.status !== 'active' && platform.status !== 'discontinued') {
      errors.push(`${prefix}: invalid status "${platform.status}"`);
    }

    if (!PURCHASE_MODES.includes(platform.purchaseMode)) {
      errors.push(`${prefix}: purchaseMode must be one of ${PURCHASE_MODES.join(', ')}`);
    }

    if (platform.tags !== undefined && !Array.isArray(platform.tags)) {
      errors.push(`${prefix}: tags must be an array`);
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

function buildPlatformTagBarHtml(catalogConfig, selectedLabels, showDiscontinued, showRushPurchase) {
  const cat = catalogConfig || {};
  const selected = selectedLabels || [];
  const parts = [];

  const derivedChips = [];
  for (const tag of cat.derivedTags || []) {
    const label = tag.label;
    const active = selected.includes(label);
    derivedChips.push(
      `<button type="button" class="platform-tag-chip platform-tag-chip--derived${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
    );
  }
  if (derivedChips.length) {
    parts.push(`<div class="platform-tag-group platform-tag-group--derived" role="group" aria-label="预设筛选">${derivedChips.join('')}</div>`);
  }

  const operationalChips = [];
  for (const label of cat.operationalTags || []) {
    const active = selected.includes(label);
    operationalChips.push(
      `<button type="button" class="platform-tag-chip platform-tag-chip--operational${active ? ' is-active' : ''}" data-platform-tag="${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`
    );
  }
  if (operationalChips.length) {
    parts.push(`<div class="platform-tag-group platform-tag-group--operational" role="group" aria-label="平台标签">${operationalChips.join('')}</div>`);
  }

  const toggleChips = [];
  const discLabel = cat.showDiscontinuedTag || '显示停售';
  const discActive = !!showDiscontinued;
  toggleChips.push(
    `<button type="button" class="platform-tag-chip platform-tag-chip--toggle platform-tag-chip--discontinued${discActive ? ' is-active' : ''}" data-platform-discontinued="1" aria-pressed="${discActive ? 'true' : 'false'}"><span class="platform-tag-check" aria-hidden="true"></span>${escapeHtml(discLabel)}</button>`
  );

  const rushLabel = cat.showRushPurchaseTag || '显示需抢购';
  const rushActive = !!showRushPurchase;
  toggleChips.push(
    `<button type="button" class="platform-tag-chip platform-tag-chip--toggle platform-tag-chip--rush${rushActive ? ' is-active' : ''}" data-platform-show-rush="1" aria-pressed="${rushActive ? 'true' : 'false'}"><span class="platform-tag-check" aria-hidden="true"></span>${escapeHtml(rushLabel)}</button>`
  );

  if (toggleChips.length) {
    if (derivedChips.length || operationalChips.length) {
      parts.push('<span class="platform-tag-sep" aria-hidden="true"></span>');
    }
    parts.push(`<div class="platform-tag-group platform-tag-group--toggles" role="group" aria-label="显示开关">${toggleChips.join('')}</div>`);
  }

  return parts.join('');
}

const EXTERNAL_LINK_ICON =
  '<svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

function buildPlatformCardHtml(platform, plans, options = {}) {
  const sanitizeUrl = options.sanitizeUrl || (url => url);
  const rawAction = resolvePlatformAction(platform, plans);
  const action = sanitizeUrl(rawAction);
  const name = escapeHtml(platform.name || '');
  const nameHtml = action
    ? `<a class="platform-name-link" href="${escapeHtml(action)}" target="_blank" rel="noopener noreferrer"><span class="platform-name-text">${name}</span>${EXTERNAL_LINK_ICON}</a>`
    : `<span class="platform-name">${name}</span>`;

  const rating = Math.max(0, Math.min(5, Number(platform.rating) || 0));
  const stars = '⭐️'.repeat(rating);
  const summary = platform.summary
    ? `<p class="platform-summary">${escapeHtml(platform.summary)}</p>`
    : '';

  const purchaseMode = normalizePurchaseMode(platform.purchaseMode);
  const rushHtml =
    purchaseMode === 'anytime'
      ? ''
      : `<span class="platform-rush" data-purchase-mode="${purchaseMode}">${escapeHtml(purchaseModeLabel(purchaseMode))}</span>`;

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

  const models = collectModelsForVendor(plans, platform.name);
  const modelLimit = 5;
  const shownModels = models.slice(0, modelLimit);
  const extraModels = models.length - shownModels.length;
  const modelsHtml = models.length
    ? `<div class="platform-models" aria-label="模型">${shownModels.map((model) => `<span class="model-tag">${escapeHtml(model)}</span>`).join('')}${extraModels > 0 ? `<span class="model-tag model-tag-more">+${extraModels}</span>` : ''}</div>`
    : '';

  const discontinuedClass = platform.status === 'discontinued' ? ' is-discontinued' : '';

  return `
                <article class="platform-card${discontinuedClass}" data-platform-id="${escapeHtml(platform.id || '')}" tabindex="0" role="button" aria-label="${name} 详情">
                    <header>
                        <div class="platform-card-heading">
                            ${nameHtml}
                            ${rushHtml}
                        </div>
                        <span class="platform-rating" aria-label="${rating} 星">${stars}</span>
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
  PURCHASE_MODES,
  PURCHASE_MODE_LABELS,
  escapeHtml,
  normalizePurchaseMode,
  purchaseModeLabel,
  matchesDerivedTag,
  matchesOperationalTag,
  filterPlatforms,
  collectModelsForVendor,
  dimensionCopy,
  collectPlansForVendor,
  matchMonitorPlatform,
  resolvePlatformAction,
  validatePlatformRecords,
  buildPlatformTagBarHtml,
  buildPlatformCardHtml
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlatformCatalog;
} else {
  window.PlatformCatalog = PlatformCatalog;
}
