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

  function formatMonthlyPrice(plan) {
    const price = plan && plan.monthlyPrice;
    if (price == null || price === '' || Number.isNaN(Number(price))) return '-';
    const currency = (plan && plan.currency) || '¥';
    const num = Number(price);
    const text = Number.isInteger(num) ? String(num) : String(num);
    return `${currency}${text}`;
  }

  function buildPlansSectionHtml(plans) {
    if (!Array.isArray(plans) || plans.length === 0) return '';

    const rows = plans
      .map(plan => {
        const dead = !!(plan && plan.discontinued);
        const planName = esc(plan && plan.plan);
        const type = esc((plan && plan.type) || 'Coding Plan');
        const price = esc(formatMonthlyPrice(plan));
        return (
          `<tr class="platform-detail-plan-row${dead ? ' is-discontinued' : ''}">` +
          `<td class="platform-detail-plan-name">${planName}</td>` +
          `<td class="platform-detail-plan-type">${type}</td>` +
          `<td class="platform-detail-plan-price">${price}</td>` +
          `<td class="platform-detail-plan-status">${dead ? '<span class="platform-detail-plan-badge">停售</span>' : ''}</td>` +
          `</tr>`
        );
      })
      .join('');

    return (
      `<section class="platform-detail-section" data-section="plans" aria-labelledby="platformDetailPlansHeading">` +
      `<h3 id="platformDetailPlansHeading" class="platform-detail-section-title">套餐</h3>` +
      `<div class="platform-detail-plans-wrap">` +
      `<table class="platform-detail-plans-table">` +
      `<thead><tr>` +
      `<th scope="col">套餐</th>` +
      `<th scope="col">类型</th>` +
      `<th scope="col">月价</th>` +
      `<th scope="col">状态</th>` +
      `</tr></thead>` +
      `<tbody>${rows}</tbody>` +
      `</table>` +
      `</div>` +
      `<button type="button" class="platform-detail-jump-plans" data-jump-plans="1">在套餐大表中查看</button>` +
      `</section>`
    );
  }

  function buildDetailBodyHtml(platform, ctx) {
    const context = ctx || {};
    void context.monitorRow;

    const name = esc(platform && platform.name);
    const rating = Math.max(0, Math.min(5, Number(platform && platform.rating) || 0));
    const stars = '⭐️'.repeat(rating);
    const rush = !!(platform && platform.purchaseRush);
    const rushLabel = rush ? '需要抢购' : '无需抢购';
    const discontinued = platform && platform.status === 'discontinued';

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
      `<h2 id="platformDetailTitle" class="platform-detail-title">${name}</h2>` +
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
      buildPlansSectionHtml(vendorPlans)
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

  function open(platform, openOpts) {
    if (!platform) return;
    const opts = openOpts || {};
    if (isOpen()) close();

    bindChromeOnce();

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
