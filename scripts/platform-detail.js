(function (root, factory) {
  const catalog =
    typeof require === 'function'
      ? require('./platform-catalog.js')
      : root.PlatformCatalog;
  const entityData =
    typeof require === 'function'
      ? require('./entity-data.js')
      : root.EntityData;
  const api = factory(catalog || {}, entityData || {}, root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null));
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PlatformDetail = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PlatformCatalog, EntityData, Numbers) {
  const UI = globalThis.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null);
  const Notices = globalThis.ChangeNotices || (typeof require==='function' ? require('./change-notices.js') : null);

  let options = {
    getPlans: () => [],
    getEntityContext: () => null,
    onJumpPlansTable: () => {},
    isPlatformPinned: () => false,
    onTogglePlatformPin: () => {},
    escapeHtml: null
  };

  let openPlatformId = null;
  let openPlatformName = null;
  let triggerEl = null;
  let releaseModal = null;
  let modelRows = null;
  let closeBound = false;

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
    return Numbers.monthlyFee(amount, currency || '¥', null);
  }

  function formatApiPrice(value, currency) {
    return Numbers.unitPrice(value, currency || '¥');
  }

  function buildApiPricingSectionHtml(groups) {
    const validGroups = Array.isArray(groups) ? groups.filter((group) => group && Array.isArray(group.rows) && group.rows.length) : [];
    if (!validGroups.length) return '';
    const content = validGroups.map((group) => {
      const rows = group.rows.map((row) => {
        const prices = [
          ['输入', row.inputPerM, row.currency],
          ...(row.cacheWritePerM === undefined ? [] : [['缓存写入', row.cacheWritePerM, row.currency]]),
          [row.cacheWritePerM === undefined ? '缓存' : '缓存读取', row.cachePerM, row.currency],
          ['输出', row.outputPerM, row.currency],
          ['综合', row.unitPriceCnyPerM, '¥']
        ].map(([label, value, currency]) =>
          `<div class="platform-detail-api-price"><dt>${label}</dt><dd>${esc(formatApiPrice(value, currency))}</dd></div>`
        ).join('');
        return (
          `<li class="platform-detail-api-item">` +
          `<div class="platform-detail-api-model">` +
          `<span class="platform-detail-api-model-name">${esc(row.modelName)}</span>` +
          (row.tierLabel ? `<span class="platform-detail-api-tier">${esc(row.tierLabel)}</span>` : '') +
          `</div><dl class="platform-detail-api-prices">${prices}</dl>` +
          (row.note ? `<p class="platform-detail-api-model-note">${esc(row.note)}</p>` : '') +
          `</li>`
        );
      }).join('');
      const note = group.planNote
        ? `<p class="platform-detail-api-note">${esc(group.planNote)}</p>`
        : '';
      return (
        `<div class="platform-detail-api-group">` +
        (validGroups.length > 1 ? `<h4>${esc(group.planName)}</h4>` : '') +
        EntityData.harnessApiBadge(group.supportsHarnessApi) +
        `<ul class="platform-detail-api-list" role="list" aria-label="${esc(group.planName || '按量 API')}模型报价">${rows}</ul>${note}</div>`
      );
    }).join('');
    return (
      `<section class="platform-detail-section" data-section="api-pricing" aria-labelledby="platformDetailApiPricingHeading">` +
      `<h3 id="platformDetailApiPricingHeading" class="platform-detail-section-title">按量 API 定价</h3>` +
      `<p class="platform-detail-api-unit">单位：每百万 Token；综合价按站点统一工作负载计算</p>` +
      content +
      `<a class="tool-button platform-detail-api-link" href="/pricing/">在价格与额度中查看 →</a>` +
      `</section>`
    );
  }

  function formatPlanPriceHtml(plan) {
    const monthly = formatMoney(plan && plan.monthlyPrice, plan && plan.currency);
    if (!monthly) return '-';
    const first = formatMoney(plan && plan.firstMonthPrice, plan && plan.currency);
    if (typeof plan.firstMonthPrice === 'number' && first && plan.firstMonthPrice !== plan.monthlyPrice) {
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
      const text = Numbers.tokens(wan);
      return `${text}万`;
    }
    return Numbers.tokens(num);
  }

  function formatPlanQuota(plan) {
    if (!plan) return '';

    if (typeof plan.requestQuota?.monthly === 'number' && Number.isFinite(plan.requestQuota?.monthly)) {
      const short = formatCountShort(plan.requestQuota?.monthly);
      return short ? `${short}次/月` : '';
    }
    if (typeof plan.requestQuota?.weekly === 'number' && Number.isFinite(plan.requestQuota?.weekly)) {
      const short = formatCountShort(plan.requestQuota?.weekly);
      return short ? `${short}次/周` : '';
    }
    if (typeof plan.requestQuota?.fiveHours === 'number' && Number.isFinite(plan.requestQuota?.fiveHours)) {
      const short = formatCountShort(plan.requestQuota?.fiveHours);
      return short ? `${short}次/5h` : '';
    }
    return '';
  }

  function activePlansOnly(plans) {
    if (!Array.isArray(plans)) return [];
    return plans.filter(plan => plan && plan.planStatus !== 'delisted');
  }

  function buildModelTagsHtml(labels, ariaLabel) {
    return UI.modelTags(labels, {maxRows:2,className:'platform-detail-models',ariaLabel});
  }

  function buildModelsSectionHtml(labels) {
    const tags = buildModelTagsHtml(labels, '平台支持模型');
    if (!tags) return '';
    return (
      `<section class="platform-detail-section" data-section="models" aria-labelledby="platformDetailModelsHeading">` +
      `<h3 id="platformDetailModelsHeading" class="platform-detail-section-title">支持模型</h3>` +
      tags +
      `</section>`
    );
  }

  function buildPlansSectionHtml(plans, platform) {
    const active = activePlansOnly(plans);
    if (active.length === 0) return '';

    const rows = active
      .map(plan => {
        const planName = esc(plan && plan.name);
        const rating = Math.max(0, Math.min(5, Number(plan && plan.rating) || 0));
        const stars = rating > 0 ? `★ ${rating.toFixed(1)}` : '';
        const ratingHtml = stars
          ? `<span class="platform-detail-plan-rating" aria-label="${rating} 星">${stars}</span>`
          : '';
        const harnessHtml = EntityData.harnessApiBadge(EntityData.resolveHarnessApi(platform, plan));
        const modelsHtml = buildModelTagsHtml(plan.modelLabels, `${plan.name} 支持模型`);
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
          `</div>` +
          harnessHtml + modelsHtml +
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
      `<button type="button" class="platform-detail-jump-plans" data-jump-plans="1">在套餐页面查看 →</button>` +
      `</section>`
    );
  }

  function buildDetailBodyHtml(platform, ctx) {
    const context = ctx || {};

    const name = esc(platform && platform.name);
    const rating = Math.max(0, Math.min(5, Number(platform && platform.rating) || 0));
    const stars = `★ ${rating.toFixed(1)}`;
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
    const actionUrl = platform.action;
    const actionLink = actionUrl
      ? `<a class="platform-detail-action" href="${esc(actionUrl)}" target="_blank" rel="noopener noreferrer">去官网 ${PlatformCatalog.EXTERNAL_LINK_ICON}</a>`
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
    const modelLabels = context.entityContext
      ? EntityData.platformModels(context.entityContext, platformId).map(model => model.name)
      : PlatformCatalog.collectModelsForVendor(vendorPlans, platformId);

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
      (Notices?.platformInfo(context.entityContext?.changes,platformId) || '') +
      pinHtml +
      actionLink +
      (PlatformCatalog.getPlatformGuideUrl(platformId) ? `<a class="platform-guide-link" href="${esc(PlatformCatalog.getPlatformGuideUrl(platformId))}">查看完整介绍 →</a>` : '') +
      `</div>` +
      `<div class="platform-detail-meta">` +
      `<span class="platform-detail-rating" aria-label="${rating > 0 ? `${rating} 星` : '待评定'}">${rating > 0 ? stars : '待评定'}</span>` +
      statusHtml +
      EntityData.platformHarnessApiBadge(platform, rawPlans) +
      `</div>` +
      `</header>` +
      overviewHtml +
      `<section class="platform-detail-section" data-section="dimensions" aria-labelledby="platformDetailDimsHeading">` +
      `<h3 id="platformDetailDimsHeading" class="platform-detail-section-title">评价详解</h3>` +
      `<ul class="platform-detail-dimensions">${dims}</ul>` +
      `</section>` +
      buildModelsSectionHtml(modelLabels) +
      buildApiPricingSectionHtml(context.apiPricingGroups) +
      buildPlansSectionHtml(vendorPlans, platform)
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
    if (UI.toggleModels(event)) return;
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
        options.onTogglePlatformPin(id, 'platform_detail');
      }
      syncPinUi();
      return;
    }
    if (target.closest && target.closest('[data-jump-plans="1"]')) {
      const vendorName = openPlatformName;
      const platformSlug = openPlatformId;
      close();
      if (typeof options.onJumpPlansTable === 'function' && vendorName) {
        globalThis.CodingPlanEvents?.track('navigation_click', {target:'plans',platform_slug:platformSlug,placement:'platform_detail'}, true);
        options.onJumpPlansTable(vendorName);
      }
    }
  }

  function bindChromeOnce() {
    if (typeof document === 'undefined') return;
    if (!closeBound) {
      const overlay = overlayEl();
      const closeBtn = closeBtnEl();
      if (overlay) overlay.addEventListener('click', onOverlayClick);
      if (closeBtn) {
        closeBtn.innerHTML = globalThis.CodingPlanUI.closeIcon;
        closeBtn.classList.add('ui-icon-button', 'ui-icon-button--outlined');
        closeBtn.addEventListener('click', () => close());
      }
      closeBound = true;
    }
  }

  function init(userOptions) {
    options = {
      getPlans: () => [],
      getEntityContext: () => null,
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
    modelRows?.disconnect();
    modelRows = null;
    const overlay = overlayEl();
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
    }
    releaseModal?.();
    releaseModal = null;
    openPlatformId = null;
    openPlatformName = null;
    triggerEl = null;
  }

  function open(platform, openOpts) {
    if (!platform) return;
    const opts = openOpts || {};
    if (isOpen()) close();

    bindChromeOnce();

    const plans =
      typeof options.getPlans === 'function' ? options.getPlans() || [] : [];
    const entityContext =
      typeof options.getEntityContext === 'function' ? options.getEntityContext() : null;
    const apiPricingGroups =
      entityContext && typeof EntityData.buildApiPricingGroups === 'function'
        ? EntityData.buildApiPricingGroups(entityContext, platform && platform.slug)
        : [];
    const html = buildDetailBodyHtml(platform, {
      plans,
      entityContext,
      apiPricingGroups,
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


    globalThis.CodingPlanEvents?.track('detail_open', {entity_type:'platform', platform_slug:platform.slug, placement:location.pathname});
    overlay.dataset.collectPlatform = platform.slug;
    openPlatformId = platform.slug || null;
    openPlatformName = platform.name || null;
    triggerEl = opts.triggerEl || null;

    releaseModal = globalThis.CodingPlanDialogs.activate(overlay, {
      trigger: triggerEl, initialFocus: closeBtnEl(), onClose: close
    });

    modelRows = UI.observeModelTagRows(body);

  }

  return {
    init,
    open,
    close,
    isOpen,
    getOpenPlatformId,
    syncPinUi,
    buildApiPricingSectionHtml,
    buildDetailBodyHtml
  };
});
