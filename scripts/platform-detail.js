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
    monitorApiBase: DEFAULT_MONITOR_API_BASE,
    onJumpPlansTable: () => {},
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
      { key: 'stability', label: '稳定性' },
      { key: 'models', label: '模型覆盖' },
      { key: 'convenience', label: '使用便捷性' }
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
        `<span class="platform-detail-price-first">首月 ${esc(first)}</span>`
      );
    }
    return `<span class="platform-detail-price-main">${esc(monthly)}</span>`;
  }

  function formatCountShort(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    if (num >= 10000) {
      const wan = num / 10000;
      const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, '');
      return `${text}万`;
    }
    return num.toLocaleString('zh-CN');
  }

  function formatPlanQuota(plan) {
    if (!plan) return '-';
    const token = plan.tokenLimit;
    if (typeof token === 'number' && Number.isFinite(token)) {
      return `${token}M`;
    }
    if (typeof plan.monthlyRequests === 'number' && Number.isFinite(plan.monthlyRequests)) {
      const short = formatCountShort(plan.monthlyRequests);
      return short ? `${short}次/月` : '-';
    }
    if (typeof plan.weeklyRequests === 'number' && Number.isFinite(plan.weeklyRequests)) {
      const short = formatCountShort(plan.weeklyRequests);
      return short ? `${short}次/周` : '-';
    }
    if (typeof plan.fiveHoursRequests === 'number' && Number.isFinite(plan.fiveHoursRequests)) {
      const short = formatCountShort(plan.fiveHoursRequests);
      return short ? `${short}次/5h` : '-';
    }
    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }
    return '-';
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
        const planName = esc(plan && plan.plan);
        const type = esc((plan && plan.type) || 'Coding Plan');
        const quota = esc(formatPlanQuota(plan));
        const priceHtml = formatPlanPriceHtml(plan);
        return (
          `<div class="platform-detail-plan-item">` +
          `<div class="platform-detail-plan-top">` +
          `<div class="platform-detail-plan-name">${planName}</div>` +
          `<div class="platform-detail-plan-price">${priceHtml}</div>` +
          `</div>` +
          `<div class="platform-detail-plan-bottom">` +
          `<span class="platform-detail-plan-type-badge">${type}</span>` +
          `<span class="platform-detail-plan-quota">${quota}</span>` +
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
      `<button type="button" class="platform-detail-jump-plans" data-jump-plans="1">在套餐大表中查看 →</button>` +
      `</section>`
    );
  }

  function formatAvailabilityRate(rate) {
    return ((rate || 0) * 100).toFixed(1) + '%';
  }

  function buildHoursSparklineHtml(hours) {
    if (!Array.isArray(hours) || hours.length === 0) return '';
    const recent = hours.length > 48 ? hours.slice(hours.length - 48) : hours;
    const cells = recent
      .map(cell => {
        const color = (cell && cell.color) || 'gray';
        return `<span class="platform-detail-hour-cell" data-color="${esc(color)}"></span>`;
      })
      .join('');
    return `<div class="platform-detail-hours" aria-hidden="true">${cells}</div>`;
  }

  function buildAvailabilitySectionHtml(platform, monitorRow) {
    if (!monitorRow) return '';

    const rateText = formatAvailabilityRate(monitorRow.availability_rate);
    const slug =
      (monitorRow.platform_slug && String(monitorRow.platform_slug).trim()) ||
      (platform && platform.monitorSlug && String(platform.monitorSlug).trim()) ||
      (platform && platform.name) ||
      '';
    const href = `monitor/?platform=${encodeURIComponent(slug)}`;

    return (
      `<section class="platform-detail-section" data-section="availability" aria-labelledby="platformDetailAvailHeading">` +
      `<h3 id="platformDetailAvailHeading" class="platform-detail-section-title">可用性</h3>` +
      `<div class="platform-detail-avail">` +
      `<span class="platform-detail-avail-rate">${esc(rateText)}</span>` +
      buildHoursSparklineHtml(monitorRow.hours) +
      `</div>` +
      `<a class="platform-detail-avail-link" href="${esc(href)}">查看完整可用性 →</a>` +
      `</section>`
    );
  }

  function normalizeBoardPayload(resp) {
    // 与 monitor/index.html 一致：优先取 resp.data
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
    const rush = !!(platform && platform.purchaseRush);
    const rushLabel = rush ? '需要抢购' : '无需抢购';
    const discontinued = platform && platform.status === 'discontinued';
    const actionUrl =
      typeof PlatformCatalog.resolvePlatformAction === 'function'
        ? PlatformCatalog.resolvePlatformAction(platform, Array.isArray(context.plans) ? context.plans : [])
        : null;
    const actionLink = actionUrl
      ? `<a class="platform-detail-action" href="${esc(actionUrl)}" target="_blank" rel="noopener noreferrer">去官网 →</a>`
      : '';

    const rawPlans = Array.isArray(context.plans) ? context.plans : [];
    const vendorPlans =
      typeof PlatformCatalog.collectPlansForVendor === 'function'
        ? PlatformCatalog.collectPlansForVendor(rawPlans, platform && platform.name)
        : rawPlans.filter(p => p && p.vendor === (platform && platform.name));

    const dims = dimensionMeta()
      .map(({ key, label }) => {
        const dim = (platform && platform.dimensions && platform.dimensions[key]) || {};
        const score = dim.score == null ? '—' : String(dim.score);
        const copy = copyForDim(dim);
        return (
          `<li class="platform-detail-dim" data-dim="${esc(key)}">` +
          `<span class="platform-detail-dim-score">${esc(score)}</span>` +
          `<div class="platform-detail-dim-main">` +
          `<span class="platform-detail-dim-label">${esc(label)}</span>` +
          `<p class="platform-detail-dim-copy">${esc(copy)}</p>` +
          `</div>` +
          `</li>`
        );
      })
      .join('');

    return (
      `<header class="platform-detail-header${discontinued ? ' is-discontinued' : ''}">` +
      `<div class="platform-detail-title-row">` +
      `<h2 id="platformDetailTitle" class="platform-detail-title">${name}</h2>` +
      actionLink +
      `</div>` +
      `<div class="platform-detail-meta">` +
      `<span class="platform-detail-rating" aria-label="${rating} 星">${stars}</span>` +
      `<span class="platform-detail-rush" data-rush="${rush ? 'true' : 'false'}">${rushLabel}</span>` +
      (discontinued ? `<span class="platform-detail-status">已停售</span>` : '') +
      `</div>` +
      `</header>` +
      `<section class="platform-detail-section" data-section="dimensions" aria-labelledby="platformDetailDimsHeading">` +
      `<h3 id="platformDetailDimsHeading" class="platform-detail-section-title">评价详解</h3>` +
      `<ul class="platform-detail-dimensions">${dims}</ul>` +
      `</section>` +
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

  function onOverlayClick(event) {
    const target = event.target;
    if (!target || !target.getAttribute) return;
    if (target.getAttribute('data-platform-detail-close') === '1') {
      close();
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
      monitorApiBase: DEFAULT_MONITOR_API_BASE,
      onJumpPlansTable: () => {},
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
    const html = buildDetailBodyHtml(platform, {
      plans,
      monitorRow: null
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

    openPlatformId = platform.id || null;
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

    body.innerHTML = buildDetailBodyHtml(platform, { plans, monitorRow });
  }

  return {
    init,
    open,
    close,
    isOpen,
    getOpenPlatformId,
    buildDetailBodyHtml
  };
});
