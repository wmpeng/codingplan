(function (root, factory) {
  const catalog =
    typeof require === 'function'
      ? require('./platform-catalog.js')
      : root.PlatformCatalog;
  const api = factory(catalog || {});
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PlatformDetail = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PlatformCatalog) {
  const DEFAULT_MONITOR_API_BASE = 'https://api.dreamfree.space/vc';

  let options = {
    getPlans: () => [],
    getPaygPricing: () => null,
    monitorApiBase: DEFAULT_MONITOR_API_BASE,
    onJumpPlansTable: () => {},
    isPlatformPinned: () => false,
    onTogglePlatformPin: () => {},
    escapeHtml: null
  };

  let openPlatformId = null;
  let openPlatformName = null;
  let triggerEl = null;
  let escBound = false;
  let closeBound = false;
  let openSeq = 0;
  let boardCache = null; // { platforms: [] } | false (failed)
  let boardPromise = null;

  function esc(text) {
    const fn = options.escapeHtml || PlatformCatalog.escapeHtml;
    return typeof fn === 'function' ? fn(text) : String(text == null ? '' : text);
  }

  function dimensionMeta() {
    return PlatformCatalog.PLATFORM_DIMENSION_META || [
      { key: 'value', label: '性价比' },
      { key: 'models', label: '模型' },
      { key: 'stability', label: '可用性' }
    ];
  }

  function copyForDim(dim) {
    if (typeof PlatformCatalog.dimensionCopy === 'function') {
      return PlatformCatalog.dimensionCopy(dim);
    }
    if (!dim || typeof dim !== 'object') return '';
    const detail = typeof dim.detail === 'string' ? dim.detail.trim() : '';
    if (detail) return detail;
    return typeof dim.reason === 'string' ? dim.reason : '';
  }

  function formatMoney(amount, currency) {
    if (amount == null || amount === '' || Number.isNaN(Number(amount))) return null;
    const cur = currency || '¥';
    const num = Number(amount);
    const text = Number.isInteger(num) ? String(num) : String(num);
    return `${cur}${text}`;
  }

  function formatPlanPriceHtml(plan) {
    const monthly = formatMoney(plan && plan.monthlyPrice, plan && plan.currency);
    if (!monthly) return '-';
    const first = formatMoney(plan && plan.firstMonthPrice, plan && plan.currency);
    if (first && Number(plan.firstMonthPrice) !== Number(plan.monthlyPrice)) {
      return (
        `<span class="platform-detail-price-main">${esc(monthly)}</span>` +
        `<span class="platform-detail-price-sep" aria-hidden="true"> · </span>` +
        `<span class="platform-detail-price-first">首月 ${esc(first)}</span>`
      );
    }
    return `<span class="platform-detail-price-main">${esc(monthly)}</span>`;
  }

  function formatCountShort(n) {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num >= 10000) {
      const wan = num / 10000;
      const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, '');
      return `${text}万`;
    }
    return num.toLocaleString('zh-CN');
  }

  function formatPlanQuota(plan) {
    if (!plan) return '';

    if (
      typeof plan.measuredMonthlyTokenLimit === 'number' &&
      Number.isFinite(plan.measuredMonthlyTokenLimit) &&
      plan.measuredMonthlyTokenLimit > 0
    ) {
      return `${plan.measuredMonthlyTokenLimit}M Token`;
    }
    if (typeof plan.monthlyRequests === 'number' && Number.isFinite(plan.monthlyRequests)) {
      const short = formatCountShort(plan.monthlyRequests);
      return short ? `${short}次/月` : '';
    }
    if (typeof plan.weeklyRequests === 'number' && Number.isFinite(plan.weeklyRequests)) {
      const short = formatCountShort(plan.weeklyRequests);
      return short ? `${short}次/周` : '';
    }
    if (typeof plan.fiveHoursRequests === 'number' && Number.isFinite(plan.fiveHoursRequests)) {
      const short = formatCountShort(plan.fiveHoursRequests);
      return short ? `${short}次/5h` : '';
    }
    return '';
  }

  function activePlansOnly(plans) {
    if (!Array.isArray(plans)) return [];
    return plans.filter(plan => plan && !plan.discontinued);
  }

  function buildPlansSectionHtml(plans) {
    const active = activePlansOnly(plans);
    if (active.length === 0) return '';

    const rows = active
      .map(plan => {
        const planName = esc(plan && plan.name);
        const type = esc((plan && plan.type) || 'Coding Plan');
        const rating = Math.max(0, Math.min(5, Number(plan && plan.rating) || 0));
        const stars = rating > 0 ? '⭐️'.repeat(rating) : '';
        const ratingHtml = stars
          ? `<span class="platform-detail-plan-rating" aria-label="${rating} 星">${stars}</span>`
          : '';
        const summary =
          typeof plan.summary === 'string' && plan.summary.trim() ? plan.summary.trim() : '';
        const summaryHtml = summary
          ? `<p class="platform-detail-plan-summary">${esc(summary)}</p>`
          : '';
        const quota = formatPlanQuota(plan);
        const quotaHtml = quota
          ? `<div class="platform-detail-plan-quota">${esc(quota)}</div>`
          : '';
        const priceHtml = formatPlanPriceHtml(plan);
        return (
          `<div class="platform-detail-plan-item">` +
          `<div class="platform-detail-plan-main">` +
          `<div class="platform-detail-plan-title-row">` +
          `<span class="platform-detail-plan-name">${planName}</span>` +
          ratingHtml +
          `<span class="platform-detail-plan-type-badge">${type}</span>` +
          `</div>` +
          summaryHtml +
          `</div>` +
          `<div class="platform-detail-plan-side">` +
          `<div class="platform-detail-plan-price">${priceHtml}</div>` +
          quotaHtml +
          `</div>` +
          `</div>`
        );
      })
      .join('');

    return (
      `<section class="platform-detail-section" data-section="plans" aria-labelledby="platformDetailPlansHeading">` +
      `<h3 id="platformDetailPlansHeading" class="platform-detail-section-title">套餐</h3>` +
      `<div class="platform-detail-plans-list" aria-label="在售套餐">` +
      rows +
      `</div>` +
      `<button type="button" class="platform-detail-jump-plans" data-jump-plans="1">在套餐对比中查看 →</button>` +
      `</section>`
    );
  }

  const DETAIL_AVAIL_HOURS = 48;

  function formatAvailabilityRate(rate) {
    return ((rate || 0) * 100).toFixed(1) + '%';
  }

  // 与监控页同口径：排除灰格后 绿=1、黄=0.5、红=0，再取平均
  function availabilityRateFromHours(hours) {
    const cells = Array.isArray(hours) ? hours : [];
    let withData = 0;
    let score = 0;
    for (let i = 0; i < cells.length; i++) {
      const color = (cells[i] && cells[i].color) || 'gray';
      if (color === 'gray') continue;
      withData += 1;
      if (color === 'green') score += 1;
      else if (color === 'yellow') score += 0.5;
    }
    if (!withData) return 0;
    return Math.round((score / withData) * 10000) / 10000;
  }

  function recentHours(hours, count) {
    if (!Array.isArray(hours) || hours.length === 0) return [];
    if (hours.length <= count) return hours;
    return hours.slice(hours.length - count);
  }

  function buildHoursSparklineHtml(hours) {
    if (!hours.length) return '';
    const cells = hours
      .map(cell => {
        const color = (cell && cell.color) || 'gray';
        return `<span class="platform-detail-hour-cell platform-detail-hour-cell--${esc(color)}"></span>`;
      })
      .join('');
    return `<div class="platform-detail-hours" aria-hidden="true">${cells}</div>`;
  }

  function buildAvailabilitySectionHtml(platform, monitorRow) {
    if (!monitorRow) return '';

    // 弹层宽度有限：条带与百分比都按最近 48 小时
    const visible = recentHours(monitorRow.hours, DETAIL_AVAIL_HOURS);
    const rateText = `${formatAvailabilityRate(availabilityRateFromHours(visible))} 可用`;
    const slug =
      (monitorRow.platform_slug && String(monitorRow.platform_slug).trim()) ||
      (platform && platform.monitorSlug && String(platform.monitorSlug).trim()) ||
      (platform && platform.name) ||
      '';
    const href = `index.html?view=monitor&platform=${encodeURIComponent(slug)}`;

    return (
      `<section class="platform-detail-section" data-section="availability" aria-labelledby="platformDetailAvailHeading">` +
      `<h3 id="platformDetailAvailHeading" class="platform-detail-section-title">可用性</h3>` +
      `<div class="platform-detail-avail">` +
      `<div class="platform-detail-avail-top">` +
      `<span class="platform-detail-avail-caption">近 48 小时</span>` +
      `<span class="platform-detail-avail-rate">${esc(rateText)}</span>` +
      `</div>` +
      buildHoursSparklineHtml(visible) +
      `</div>` +
      `<a class="platform-detail-avail-link" href="${esc(href)}">查看完整可用性 →</a>` +
      `</section>`
    );
  }

  function normalizeBoardPayload(resp) {
    // 与可用性监控接口一致：优先取 resp.data
    const payload = (resp && resp.data) || resp;
    if (!payload || typeof payload !== 'object') return null;
    if (!Array.isArray(payload.platforms)) return null;
    return payload;
  }

  async function ensureBoard(apiBase) {
    if (boardCache) return boardCache;
    if (boardCache === false) return null;
    if (boardPromise) return boardPromise;
    const base = (apiBase || DEFAULT_MONITOR_API_BASE).replace(/\/$/, '');
    boardPromise = fetch(`${base}/monitor/board?days=7`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(data => {
        const normalized = normalizeBoardPayload(data);
        if (!normalized) {
          boardCache = false;
          return null;
        }
        boardCache = normalized;
        return normalized;
      })
      .catch(() => {
        boardCache = false;
        return null;
      })
      .finally(() => {
        boardPromise = null;
      });
    return boardPromise;
  }

  function buildDetailBodyHtml(platform, ctx) {
    const context = ctx || {};
    const monitorRow = context.monitorRow || null;

    const name = esc(platform && platform.name);
    const rating = Math.max(0, Math.min(5, Number(platform && platform.rating) || 0));
    const stars = '⭐️'.repeat(rating);
    const status =
      typeof PlatformCatalog.normalizePlatformStatus === 'function'
        ? PlatformCatalog.normalizePlatformStatus(platform && platform.platformStatus)
        : (platform && platform.platformStatus) || 'open';
    const statusLabel =
      typeof PlatformCatalog.platformStatusLabel === 'function'
        ? PlatformCatalog.platformStatusLabel(status)
        : status;
    const statusHtml =
      status === 'open'
        ? ''
        : `<span class="platform-detail-rush" data-platform-status="${esc(status)}">${esc(statusLabel)}</span>`;
    const discontinued = status === 'delisted';
    const actionUrl =
      typeof PlatformCatalog.resolvePlatformAction === 'function'
        ? PlatformCatalog.resolvePlatformAction(platform, Array.isArray(context.plans) ? context.plans : [])
        : null;
    const actionLink = actionUrl
      ? `<a class="platform-detail-action" href="${esc(actionUrl)}" target="_blank" rel="noopener noreferrer">去官网 →</a>`
      : '';
    const platformId =
      platform && typeof platform.slug === 'string' ? platform.slug.trim() : '';
    const pinned =
      typeof context.isPinned === 'boolean'
        ? context.isPinned
        : typeof options.isPlatformPinned === 'function'
          ? !!options.isPlatformPinned(platformId)
          : false;
    const pinHtml =
      typeof PlatformCatalog.buildPlatformPinButtonHtml === 'function'
        ? PlatformCatalog.buildPlatformPinButtonHtml({
            platformId,
            pinned,
            variant: 'detail'
          })
        : '';

    const rawPlans = Array.isArray(context.plans) ? context.plans : [];
    const vendorPlans =
      typeof PlatformCatalog.collectPlansForVendor === 'function'
        ? PlatformCatalog.collectPlansForVendor(rawPlans, platform && platform.slug)
        : rawPlans.filter(p => p && p.platformSlug === (platform && platform.slug));

    const dims = dimensionMeta()
      .map(({ key, label }) => {
        const dim = (platform && platform.dimensions && platform.dimensions[key]) || {};
        const score = dim.score == null ? '—' : String(dim.score);
        const scoreHtml =
          score === '—'
            ? `<span class="platform-detail-dim-score">${esc(score)}</span>`
            : `<span class="platform-detail-dim-score">${esc(score)}<span class="platform-detail-dim-score-unit">分</span></span>`;
        const copy = copyForDim(dim);
        const copyHtml =
          typeof PlatformCatalog.formatInlineMarkdownPreserveBreaks === 'function'
            ? PlatformCatalog.formatInlineMarkdownPreserveBreaks(copy)
            : esc(copy);
        return (
          `<li class="platform-detail-dim" data-dim="${esc(key)}">` +
          scoreHtml +
          `<div class="platform-detail-dim-main">` +
          `<span class="platform-detail-dim-label">${esc(label)}</span>` +
          `<p class="platform-detail-dim-copy">${copyHtml}</p>` +
          `</div>` +
          `</li>`
        );
      })
      .join('');

    const overviewDetail =
      typeof platform.detail === 'string' && platform.detail.trim()
        ? platform.detail.trim()
        : '';
    const overviewSummary =
      typeof platform.summary === 'string' && platform.summary.trim()
        ? platform.summary.trim()
        : '';
    const overviewCopy = overviewDetail || overviewSummary;
    const overviewCopyHtml =
      typeof PlatformCatalog.formatInlineMarkdownPreserveBreaks === 'function'
        ? PlatformCatalog.formatInlineMarkdownPreserveBreaks(overviewCopy)
        : esc(overviewCopy);
    const overviewHtml = overviewCopy
      ? (
          `<section class="platform-detail-section" data-section="overview">` +
          `<p class="platform-detail-overview">${overviewCopyHtml}</p>` +
          `</section>`
        )
      : '';

    return (
      `<header class="platform-detail-header${discontinued ? ' is-discontinued' : ''}">` +
      `<div class="platform-detail-title-row">` +
      `<h2 id="platformDetailTitle" class="platform-detail-title">${name}</h2>` +
      pinHtml +
      actionLink +
      `</div>` +
      `<div class="platform-detail-meta">` +
      `<span class="platform-detail-rating" aria-label="${rating} 星">${stars}</span>` +
      statusHtml +
      (discontinued ? `<span class="platform-detail-status">已停售</span>` : '') +
      `</div>` +
      `</header>` +
      overviewHtml +
      `<section class="platform-detail-section" data-section="dimensions" aria-labelledby="platformDetailDimsHeading">` +
      `<h3 id="platformDetailDimsHeading" class="platform-detail-section-title">评价详解</h3>` +
      `<ul class="platform-detail-dimensions">${dims}</ul>` +
      `</section>` +
      (typeof PlatformCatalog.buildPaygPricingSectionHtml === 'function'
        ? PlatformCatalog.buildPaygPricingSectionHtml(
            context.paygEntry,
            context.paygModelOrder
          )
        : '') +
      buildPlansSectionHtml(vendorPlans) +
      buildAvailabilitySectionHtml(platform, monitorRow)
    );
  }

  function overlayEl() {
    return typeof document !== 'undefined'
      ? document.getElementById('platformDetailOverlay')
      : null;
  }

  function bodyEl() {
    return typeof document !== 'undefined'
      ? document.getElementById('platformDetailBody')
      : null;
  }

  function closeBtnEl() {
    return typeof document !== 'undefined'
      ? document.getElementById('platformDetailClose')
      : null;
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }
  }

  function syncPinUi() {
    if (!openPlatformId) return;
    const body = bodyEl();
    if (!body) return;
    const btn = body.querySelector('[data-platform-pin="1"]');
    if (!btn) return;
    const pinned =
      typeof options.isPlatformPinned === 'function'
        ? !!options.isPlatformPinned(openPlatformId)
        : false;
    const label = pinned ? '取消置顶' : '置顶';
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.classList.toggle('is-pinned', pinned);
    if (typeof PlatformCatalog.buildPlatformPinButtonHtml === 'function') {
      const fresh = PlatformCatalog.buildPlatformPinButtonHtml({
        platformId: openPlatformId,
        pinned,
        variant: 'detail'
      });
      if (fresh) {
        const tmp = document.createElement('div');
        tmp.innerHTML = fresh;
        const next = tmp.firstElementChild;
        if (next) btn.replaceWith(next);
      }
    }
  }

  function onOverlayClick(event) {
    const target = event.target;
    if (!target || !target.getAttribute) return;
    if (target.getAttribute('data-platform-detail-close') === '1') {
      close();
      return;
    }
    const pinBtn = target.closest && target.closest('[data-platform-pin="1"]');
    if (pinBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id =
        (pinBtn.getAttribute('data-platform-id') || openPlatformId || '').trim();
      if (id && typeof options.onTogglePlatformPin === 'function') {
        options.onTogglePlatformPin(id);
      }
      syncPinUi();
      return;
    }
    if (target.closest && target.closest('[data-jump-plans="1"]')) {
      const vendorName = openPlatformName;
      close();
      if (typeof options.onJumpPlansTable === 'function' && vendorName) {
        options.onJumpPlansTable(vendorName);
      }
    }
  }

  function bindChromeOnce() {
    if (typeof document === 'undefined') return;
    if (!escBound) {
      document.addEventListener('keydown', onKeydown);
      escBound = true;
    }
    if (!closeBound) {
      const overlay = overlayEl();
      const closeBtn = closeBtnEl();
      if (overlay) overlay.addEventListener('click', onOverlayClick);
      if (closeBtn) closeBtn.addEventListener('click', () => close());
      closeBound = true;
    }
  }

  function init(userOptions) {
    options = {
      getPlans: () => [],
      getPaygPricing: () => null,
      monitorApiBase: DEFAULT_MONITOR_API_BASE,
      onJumpPlansTable: () => {},
      isPlatformPinned: () => false,
      onTogglePlatformPin: () => {},
      escapeHtml: null,
      ...(userOptions || {})
    };
    bindChromeOnce();
  }

  function isOpen() {
    return openPlatformId != null;
  }

  function getOpenPlatformId() {
    return openPlatformId;
  }

  function close() {
    const overlay = overlayEl();
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
    openPlatformId = null;
    openPlatformName = null;
    const returnTo = triggerEl;
    triggerEl = null;
    if (returnTo && typeof returnTo.focus === 'function') {
      try {
        returnTo.focus();
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function open(platform, openOpts) {
    if (!platform) return;
    const opts = openOpts || {};
    if (isOpen()) close();

    bindChromeOnce();

    const seq = ++openSeq;
    const plans =
      typeof options.getPlans === 'function' ? options.getPlans() || [] : [];
    const paygPricing =
      typeof options.getPaygPricing === 'function' ? options.getPaygPricing() : null;
    const paygEntry =
      typeof PlatformCatalog.getPaygEntry === 'function'
        ? PlatformCatalog.getPaygEntry(paygPricing, platform && platform.slug)
        : null;
    const paygModelOrder =
      typeof PlatformCatalog.getPaygModelOrderList === 'function'
        ? PlatformCatalog.getPaygModelOrderList(paygPricing)
        : [];
    const html = buildDetailBodyHtml(platform, {
      plans,
      monitorRow: null,
      paygEntry,
      paygModelOrder,
      isPinned:
        typeof options.isPlatformPinned === 'function'
          ? !!options.isPlatformPinned(platform && platform.slug)
          : false
    });

    const body = bodyEl();
    const overlay = overlayEl();
    if (!body || !overlay) return;

    body.innerHTML = html;
    overlay.hidden = false;
    overlay.classList.add('is-open');
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = 'hidden';
    }

    openPlatformId = platform.slug || null;
    openPlatformName = platform.name || null;
    triggerEl = opts.triggerEl || null;

    const closeBtn = closeBtnEl();
    if (closeBtn && typeof closeBtn.focus === 'function') {
      closeBtn.focus();
    } else {
      const dialog = overlay.querySelector('.platform-detail-dialog');
      if (dialog && typeof dialog.focus === 'function') dialog.focus();
    }

    const board = await ensureBoard(options.monitorApiBase);
    if (seq !== openSeq || !isOpen()) return;
    if (!board || !Array.isArray(board.platforms)) return;

    const monitorRow =
      typeof PlatformCatalog.matchMonitorPlatform === 'function'
        ? PlatformCatalog.matchMonitorPlatform(platform, board.platforms)
        : null;
    if (!monitorRow) return;

    body.innerHTML = buildDetailBodyHtml(platform, {
      plans,
      monitorRow,
      paygEntry,
      paygModelOrder,
      isPinned:
        typeof options.isPlatformPinned === 'function'
          ? !!options.isPlatformPinned(platform && platform.slug)
          : false
    });
  }

  return {
    init,
    open,
    close,
    isOpen,
    getOpenPlatformId,
    syncPinUi,
    buildDetailBodyHtml
  };
});
