(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlatformComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_COMPARISON_ITEMS = 4;
  const METRIC_PIN_STORAGE_KEY = 'platformComparisonPinnedMetricIds';
  const VALID_METRIC_IDS = [
    'purchase-status',
    'plan-types',
    'models-score',
    'model-catalog',
    'stability-score',
    'value-score',
    'active-plans',
    'monthly-price',
    'positioning',
    'notice'
  ];

  let launcherState = null;

  function getCatalog() {
    return typeof PlatformCatalog !== 'undefined' ? PlatformCatalog : null;
  }

  function escapeHtml(value) {
    const catalog = getCatalog();
    if (catalog && catalog.escapeHtml) return catalog.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMarkdown(value) {
    const catalog = getCatalog();
    if (catalog && catalog.formatInlineMarkdownPreserveBreaks) {
      return catalog.formatInlineMarkdownPreserveBreaks(value || '');
    }
    return escapeHtml(value || '');
  }

  function uniqueIds(raw) {
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(raw) ? raw : []) {
      const id = String(value == null ? '' : value).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function getComparisonCapacity(width) {
    const viewportWidth = Number(width);
    if (Number.isFinite(viewportWidth) && viewportWidth <= 760) return 2;
    if (Number.isFinite(viewportWidth) && viewportWidth <= 1180) return 3;
    return 4;
  }

  function normalizeSelection(ids, platforms, limit = MAX_COMPARISON_ITEMS) {
    const validIds = new Set(
      (Array.isArray(platforms) ? platforms : [])
        .map((platform) => String(platform && platform.slug || '').trim())
        .filter(Boolean)
    );
    return uniqueIds(ids)
      .filter((id) => validIds.has(id))
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function selectDefaultPlatforms(pinnedIds, platforms, capacity) {
    return normalizeSelection(pinnedIds, platforms, capacity);
  }

  function shouldCompareDirectly(pinnedIds, platforms, capacity) {
    const pins = normalizeSelection(pinnedIds, platforms, Number.MAX_SAFE_INTEGER);
    return pins.length >= 2 && pins.length <= capacity;
  }

  function buildComparisonUrl(ids) {
    const selected = uniqueIds(ids).slice(0, MAX_COMPARISON_ITEMS);
    const query = new URLSearchParams();
    if (selected.length) query.set('platforms', selected.join(','));
    return `platform-compare.html${query.toString() ? `?${query.toString()}` : ''}`;
  }

  function readSelectionFromSearch(search, platforms) {
    const params = new URLSearchParams(search || '');
    return normalizeSelection(String(params.get('platforms') || '').split(','), platforms, MAX_COMPARISON_ITEMS);
  }

  function sortPickerPlatforms(platforms, pinnedIds) {
    const items = Array.isArray(platforms) ? platforms.slice() : [];
    const catalog = getCatalog();
    if (catalog && catalog.sortPlatformsByPinned) {
      return catalog.sortPlatformsByPinned(items, pinnedIds);
    }
    const rank = new Map(uniqueIds(pinnedIds).map((id, index) => [id, index]));
    return items.sort((left, right) => {
      const leftRank = rank.has(left.slug) ? rank.get(left.slug) : Number.MAX_SAFE_INTEGER;
      const rightRank = rank.has(right.slug) ? rank.get(right.slug) : Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank;
    });
  }

  function createPicker(options) {
    const platforms = Array.isArray(options.platforms) ? options.platforms : [];
    const pinnedIds = normalizeSelection(options.pinnedIds, platforms, Number.MAX_SAFE_INTEGER);
    const capacity = Math.max(2, Math.min(MAX_COMPARISON_ITEMS, Number(options.capacity) || 2));
    let selectedIds = normalizeSelection(options.selectedIds, platforms, capacity);
    let searchText = '';
    let lastFocused = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'platform-compare-picker';
    overlay.innerHTML = `
      <button type="button" class="platform-compare-picker-backdrop" aria-label="关闭选择器"></button>
      <div class="platform-compare-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="platformComparePickerTitle">
        <header class="platform-compare-picker-header">
          <div>
            <h2 id="platformComparePickerTitle">${escapeHtml(options.title || '选择要对比的平台')}</h2>
            <p>本屏最多并排对比 ${capacity} 个平台；Pin 项会优先预选，但这里的选择不会改变 Pin。</p>
          </div>
          <button type="button" class="platform-compare-picker-close" aria-label="关闭">×</button>
        </header>
        <div class="platform-compare-picker-tools">
          <input type="search" class="platform-compare-picker-search" placeholder="搜索平台名称或简介" aria-label="搜索平台">
          <span class="platform-compare-picker-count" aria-live="polite"></span>
        </div>
        <div class="platform-compare-picker-list"></div>
        <footer class="platform-compare-picker-footer">
          <p class="platform-compare-picker-note">至少选择 2 个。靠前的 Pin 项会作为默认候选。</p>
          <button type="button" class="platform-comparison-primary-btn" disabled>开始对比</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('has-platform-compare-picker');

    const list = overlay.querySelector('.platform-compare-picker-list');
    const search = overlay.querySelector('.platform-compare-picker-search');
    const count = overlay.querySelector('.platform-compare-picker-count');
    const confirm = overlay.querySelector('.platform-comparison-primary-btn');
    const closeButtons = overlay.querySelectorAll('.platform-compare-picker-close, .platform-compare-picker-backdrop');

    function close(reason) {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      document.body.classList.remove('has-platform-compare-picker');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      if (reason === 'cancel' && typeof options.onCancel === 'function') options.onCancel();
    }

    function render() {
      const pinnedSet = new Set(pinnedIds);
      const normalizedSearch = searchText.trim().toLocaleLowerCase('zh-CN');
      const visible = sortPickerPlatforms(platforms, pinnedIds).filter((platform) => {
        if (!normalizedSearch) return true;
        return `${platform.name || ''} ${platform.summary || ''} ${platform.detail || ''}`
          .toLocaleLowerCase('zh-CN')
          .includes(normalizedSearch);
      });
      const atCapacity = selectedIds.length >= capacity;
      count.textContent = `已选 ${selectedIds.length} / ${capacity}`;
      confirm.disabled = selectedIds.length < 2;
      list.innerHTML = visible.length
        ? visible.map((platform) => {
            const selected = selectedIds.includes(platform.slug);
            const disabled = atCapacity && !selected;
            return `
              <label class="platform-compare-picker-option${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}">
                <input type="checkbox" value="${escapeHtml(platform.slug)}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                <span class="platform-compare-picker-option-copy">
                  <span class="platform-compare-picker-option-name">${escapeHtml(platform.name)}</span>
                  <span class="platform-compare-picker-option-summary">${escapeHtml(platform.summary || '暂无简介')}</span>
                </span>
                ${pinnedSet.has(platform.slug) ? '<span class="platform-compare-picker-pin">已 Pin</span>' : ''}
              </label>`;
          }).join('')
        : '<p class="platform-compare-picker-empty">没有匹配的平台</p>';
    }

    function onKeydown(event) {
      if (event.key === 'Escape') close('cancel');
    }

    list.addEventListener('change', (event) => {
      const input = event.target.closest('input[type="checkbox"]');
      if (!input) return;
      if (input.checked) selectedIds = uniqueIds([...selectedIds, input.value]).slice(0, capacity);
      else selectedIds = selectedIds.filter((id) => id !== input.value);
      render();
    });
    search.addEventListener('input', () => {
      searchText = search.value;
      render();
    });
    confirm.addEventListener('click', () => {
      if (selectedIds.length < 2) return;
      const result = selectedIds.slice();
      close('confirm');
      if (typeof options.onConfirm === 'function') options.onConfirm(result);
    });
    closeButtons.forEach((button) => button.addEventListener('click', () => close('cancel')));
    document.addEventListener('keydown', onKeydown);
    render();
    window.setTimeout(() => search.focus(), 0);
    return { close, getSelection: () => selectedIds.slice() };
  }

  function updateLauncherCount() {
    if (!launcherState) return;
    const pinned = normalizeSelection(
      typeof launcherState.getPinnedIds === 'function' ? launcherState.getPinnedIds() : [],
      launcherState.platforms,
      Number.MAX_SAFE_INTEGER
    );
    if (launcherState.count) {
      launcherState.count.hidden = pinned.length === 0;
      launcherState.count.textContent = String(pinned.length);
    }
  }

  function mountLauncher(options) {
    const button = options && options.button;
    if (!button) return false;
    launcherState = {
      button,
      count: options.count || null,
      platforms: Array.isArray(options.platforms) ? options.platforms : [],
      getPinnedIds: options.getPinnedIds
    };
    updateLauncherCount();
    if (button.dataset.platformCompareBound === '1') return true;
    button.dataset.platformCompareBound = '1';
    button.addEventListener('click', () => {
      const platforms = launcherState.platforms;
      const capacity = getComparisonCapacity(window.innerWidth);
      const pinned = normalizeSelection(
        typeof launcherState.getPinnedIds === 'function' ? launcherState.getPinnedIds() : [],
        platforms,
        Number.MAX_SAFE_INTEGER
      );
      if (shouldCompareDirectly(pinned, platforms, capacity)) {
        window.location.href = buildComparisonUrl(pinned);
        return;
      }
      createPicker({
        platforms,
        pinnedIds: pinned,
        selectedIds: selectDefaultPlatforms(pinned, platforms, capacity),
        capacity,
        onConfirm(ids) {
          window.location.href = buildComparisonUrl(ids);
        }
      });
    });
    return true;
  }

  function positivePrice(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  }

  function formatPriceRange(plans) {
    const byCurrency = new Map();
    for (const plan of plans) {
      if (plan.type === 'API') continue;
      const price = positivePrice(plan.monthlyPrice);
      if (price === null) continue;
      const currency = String(plan.currency || '¥').trim() || '¥';
      if (!byCurrency.has(currency)) byCurrency.set(currency, []);
      byCurrency.get(currency).push(price);
    }
    if (!byCurrency.size) return '暂无可直接比较的月付价格';
    return Array.from(byCurrency.entries()).map(([currency, values]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return min === max
        ? `${currency}${formatNumber(min)}/月`
        : `${currency}${formatNumber(min)}–${formatNumber(max)}/月`;
    }).join('；');
  }

  function scoreOf(platform, key) {
    const dimension = platform && platform.dimensions && platform.dimensions[key];
    return dimension && Number.isFinite(Number(dimension.score)) ? Number(dimension.score) : null;
  }

  function buildPlatformView(platform, context) {
    const activePlans = context.plans.filter((plan) => plan.platformSlug === platform.slug && !plan.discontinued);
    const visiblePlans = activePlans.filter((plan) => plan.planTableVisible !== false);
    const planSlugs = new Set(activePlans.map((plan) => plan.slug));
    const modelNames = [];
    const modelSeen = new Set();
    context.planModels.forEach((relation) => {
      if (!planSlugs.has(relation.planSlug) || modelSeen.has(relation.modelSlug)) return;
      const model = context.modelBySlug.get(relation.modelSlug);
      modelSeen.add(relation.modelSlug);
      modelNames.push(model ? model.name : relation.modelSlug);
    });
    modelNames.sort((left, right) => left.localeCompare(right, 'zh-CN'));
    const types = Array.from(new Set(activePlans.map((plan) => plan.type).filter(Boolean)));
    const dims = ['value', 'models', 'stability']
      .map((key) => ({ key, score: scoreOf(platform, key), data: platform.dimensions && platform.dimensions[key] }))
      .filter((item) => item.data)
      .sort((left, right) => (left.score == null ? 99 : left.score) - (right.score == null ? 99 : right.score));
    const noticeDimension = dims[0] && dims[0].data;
    const catalog = getCatalog();
    const status = catalog && catalog.normalizePlatformStatus
      ? catalog.normalizePlatformStatus(platform.platformStatus)
      : (platform.platformStatus || 'open');
    const statusLabel = catalog && catalog.platformStatusLabel
      ? catalog.platformStatusLabel(status)
      : status;

    return {
      platform,
      status,
      statusLabel,
      activePlans,
      visiblePlans,
      types,
      modelNames,
      monthlyPrice: formatPriceRange(activePlans),
      notice: noticeDimension
        ? (noticeDimension.detail || noticeDimension.reason || platform.summary || '暂无额外提醒')
        : (platform.summary || '暂无额外提醒')
    };
  }

  function plainText(value) {
    return String(value == null ? '' : value)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dimensionCell(view, key, leadInfo) {
    const dimension = view.platform.dimensions && view.platform.dimensions[key];
    if (!dimension) return '暂无评分';
    const score = Number(dimension.score);
    const badge = leadInfo && leadInfo.leaders.has(view.platform.slug)
      ? `<span class="platform-comparison-lead-badge">${escapeHtml(leadInfo.badge)}</span>`
      : '';
    return `
      <div class="platform-comparison-score-line">
        <span class="platform-comparison-score">${Number.isFinite(score) ? `${score}/5` : '未评分'}</span>
        ${badge}
      </div>
      <div>${formatMarkdown(dimension.reason || '')}</div>`;
  }

  function computeLeadInfo(views, key) {
    const values = views
      .map((view) => ({ slug: view.platform.slug, score: scoreOf(view.platform, key) }))
      .filter((item) => item.score !== null);
    if (!values.length) return { leaders: new Set(), badge: '' };
    const top = Math.max(...values.map((item) => item.score));
    const leaders = new Set(values.filter((item) => item.score === top).map((item) => item.slug));
    const distinct = Array.from(new Set(values.map((item) => item.score))).sort((a, b) => b - a);
    const margin = distinct.length > 1 ? top - distinct[1] : 0;
    const badge = leaders.size > 1
      ? '并列领先'
      : (distinct.length > 1 ? `领先 ${formatNumber(margin)} 分` : '本组最高');
    return { top, leaders, badge, margin };
  }

  function buildRows(views) {
    const modelLead = computeLeadInfo(views, 'models');
    const stabilityLead = computeLeadInfo(views, 'stability');
    const valueLead = computeLeadInfo(views, 'value');
    return [
      {
        id: 'purchase-status', group: '购买与使用门槛', label: '购买状态',
        key: (view) => view.status,
        render: (view) => `<span class="platform-comparison-status platform-comparison-status--${escapeHtml(view.status)}">${escapeHtml(view.statusLabel)}</span>`
      },
      {
        id: 'plan-types', group: '购买与使用门槛', label: '可用方式',
        key: (view) => view.types.slice().sort().join('|'),
        render: (view) => escapeHtml(view.types.length ? view.types.join('、') : '暂无在售方式')
      },
      {
        id: 'models-score', group: '模型能力', label: '模型能力',
        key: (view) => scoreOf(view.platform, 'models'),
        render: (view) => dimensionCell(view, 'models', modelLead)
      },
      {
        id: 'model-catalog', group: '模型能力', label: '在售模型覆盖',
        key: (view) => view.modelNames.length,
        render: (view) => {
          const preview = view.modelNames.slice(0, 7);
          const more = Math.max(0, view.modelNames.length - preview.length);
          return `<strong>${view.modelNames.length} 个模型</strong>${preview.length ? `<div class="platform-comparison-model-list">${escapeHtml(preview.join('、'))}${more ? ` 等 ${more + preview.length} 个` : ''}</div>` : ''}`;
        }
      },
      {
        id: 'stability-score', group: '平台体验', label: '可用性与稳定性',
        key: (view) => scoreOf(view.platform, 'stability'),
        render: (view) => dimensionCell(view, 'stability', stabilityLead)
      },
      {
        id: 'value-score', group: '套餐概况', label: '综合性价比',
        key: (view) => scoreOf(view.platform, 'value'),
        render: (view) => dimensionCell(view, 'value', valueLead)
      },
      {
        id: 'active-plans', group: '套餐概况', label: '在售方案',
        key: (view) => view.activePlans.length,
        render: (view) => `<strong>${view.activePlans.length} 个</strong>${view.types.length ? ` · ${escapeHtml(view.types.join('、'))}` : ''}`
      },
      {
        id: 'monthly-price', group: '套餐概况', label: '订阅月价范围',
        key: (view) => view.monthlyPrice,
        render: (view) => escapeHtml(view.monthlyPrice)
      },
      {
        id: 'positioning', group: '适合谁与主要风险', label: '平台定位',
        key: (view) => plainText(view.platform.detail || view.platform.summary),
        render: (view) => formatMarkdown(view.platform.detail || view.platform.summary || '暂无简介')
      },
      {
        id: 'notice', group: '适合谁与主要风险', label: '主要提醒',
        key: (view) => plainText(view.notice),
        render: (view) => formatMarkdown(view.notice)
      }
    ];
  }

  function rowHasDifference(row, views) {
    const values = views.map((view) => JSON.stringify(row.key(view)));
    return new Set(values).size > 1;
  }

  function readMetricPins(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      return uniqueIds(JSON.parse(storage.getItem(METRIC_PIN_STORAGE_KEY) || '[]'))
        .filter((id) => VALID_METRIC_IDS.includes(id));
    } catch (_) {
      return [];
    }
  }

  function writeMetricPins(storage, ids) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(METRIC_PIN_STORAGE_KEY, JSON.stringify(uniqueIds(ids).filter((id) => VALID_METRIC_IDS.includes(id))));
      return true;
    } catch (_) {
      return false;
    }
  }

  function pinButton(row, pinned) {
    const title = pinned ? '取消置顶' : '置顶到我的重点';
    const path = pinned
      ? '<path fill="currentColor" d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'
      : '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>';
    return `<button type="button" class="platform-comparison-metric-pin${pinned ? ' is-pinned' : ''}" data-metric-pin="${escapeHtml(row.id)}" aria-pressed="${pinned ? 'true' : 'false'}" aria-label="${title}" title="${title}"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">${path}</svg></button>`;
  }

  function renderSummary(views) {
    const items = [
      { key: 'models', label: '模型能力领先' },
      { key: 'stability', label: '稳定性领先' },
      { key: 'value', label: '性价比领先' }
    ];
    return items.map((item) => {
      const lead = computeLeadInfo(views, item.key);
      const leaders = views.filter((view) => lead.leaders.has(view.platform.slug));
      const detail = leaders.length === views.length
        ? `${lead.top}/5，当前候选并列`
        : (leaders.length > 1
            ? `${lead.top}/5，${leaders.length} 个并列，比下一档高 ${formatNumber(lead.margin)} 分`
            : `${lead.top}/5，比下一档高 ${formatNumber(lead.margin)} 分`);
      return `
        <article class="platform-comparison-summary-card">
          <span class="platform-comparison-summary-label">${escapeHtml(item.label)}</span>
          <strong class="platform-comparison-summary-winner">${escapeHtml(leaders.map((view) => view.platform.name).join('、') || '暂无结论')}</strong>
          <p class="platform-comparison-summary-detail">${escapeHtml(detail)}</p>
        </article>`;
    }).join('');
  }

  function renderSelectionCards(platforms, selectedIds) {
    const selectedSet = new Set(selectedIds);
    return selectedIds.map((id, index) => {
      const platform = platforms.find((item) => item.slug === id);
      const options = platforms.map((item) => {
        const disabled = item.slug !== id && selectedSet.has(item.slug);
        return `<option value="${escapeHtml(item.slug)}" ${item.slug === id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(item.name)}</option>`;
      }).join('');
      return `
        <div class="platform-comparison-select-card">
          <div class="platform-comparison-select-card-top">
            <span class="platform-comparison-select-card-label">候选 ${index + 1}</span>
            <span class="platform-comparison-select-card-rating">${platform && platform.rating ? `${platform.rating}/5` : '未评分'}</span>
          </div>
          <select data-comparison-slot="${index}" aria-label="替换候选 ${index + 1}">${options}</select>
        </div>`;
    }).join('');
  }

  async function bootComparePage() {
    const loading = document.getElementById('platformComparisonLoading');
    const error = document.getElementById('platformComparisonError');
    const app = document.getElementById('platformComparisonApp');
    if (!loading || !app) return false;
    try {
      const responses = await Promise.all([
        fetch('platforms.json', { cache: 'no-store' }),
        fetch('plans.json', { cache: 'no-store' }),
        fetch('models.json', { cache: 'no-store' }),
        fetch('plan-models.json', { cache: 'no-store' })
      ]);
      const labels = ['platforms.json', 'plans.json', 'models.json', 'plan-models.json'];
      responses.forEach((response, index) => {
        if (!response.ok) throw new Error(`${labels[index]} 加载失败（HTTP ${response.status}）`);
      });
      const documents = await Promise.all(responses.map((response) => response.json()));
      if (typeof EntityData === 'undefined') throw new Error('数据模块未加载');
      const context = EntityData.buildContext(...documents);
      const platforms = EntityData.listPlatforms(context);
      let selectedIds = readSelectionFromSearch(window.location.search, platforms);
      let metricPins = readMetricPins(window.localStorage);
      let onlyDifferences = false;

      const selectionEl = document.getElementById('platformComparisonSelection');
      const summaryEl = document.getElementById('platformComparisonSummary');
      const matrixEl = document.getElementById('platformComparisonMatrix');
      const chooseButton = document.getElementById('platformComparisonChoose');
      const diffToggle = document.getElementById('platformComparisonOnlyDifferences');
      const focusHint = document.getElementById('platformComparisonFocusHint');

      function currentPinnedPlatforms() {
        const catalog = getCatalog();
        return catalog && catalog.readPinnedIdsFromStorage
          ? catalog.readPinnedIdsFromStorage(window.localStorage)
          : [];
      }

      function updateUrl() {
        const next = new URL(window.location.href);
        next.searchParams.set('platforms', selectedIds.join(','));
        history.replaceState({ platforms: selectedIds.slice() }, '', next.pathname + next.search);
      }

      function renderMatrix() {
        const views = selectedIds
          .map((id) => platforms.find((platform) => platform.slug === id))
          .filter(Boolean)
          .map((platform) => buildPlatformView(platform, context));
        const rows = buildRows(views).filter((row) => !onlyDifferences || rowHasDifference(row, views));
        const pinRank = new Map(metricPins.map((id, index) => [id, index]));
        const pinnedRows = rows
          .filter((row) => pinRank.has(row.id))
          .sort((left, right) => pinRank.get(left.id) - pinRank.get(right.id));
        const regularRows = rows.filter((row) => !pinRank.has(row.id));
        const groups = [];
        if (pinnedRows.length) groups.push({ name: '我的重点', rows: pinnedRows, focus: true });
        for (const row of regularRows) {
          let group = groups.find((item) => !item.focus && item.name === row.group);
          if (!group) {
            group = { name: row.group, rows: [], focus: false };
            groups.push(group);
          }
          group.rows.push(row);
        }
        focusHint.textContent = metricPins.length
          ? `已置顶 ${metricPins.length} 项；再次点击书签可取消。`
          : '点每行左侧的书签，可把最关心的指标置顶。';
        if (!rows.length) {
          matrixEl.innerHTML = '<p class="platform-comparison-no-differences">这些候选在当前指标中没有可见差异。</p>';
          return;
        }
        matrixEl.innerHTML = groups.map((group) => `
          <section class="platform-comparison-group${group.focus ? ' platform-comparison-group--focus' : ''}">
            <h3 class="platform-comparison-group-title">${escapeHtml(group.name)}</h3>
            ${group.rows.map((row) => `
              <div class="platform-comparison-row" data-comparison-row="${escapeHtml(row.id)}">
                <div class="platform-comparison-row-label">
                  ${pinButton(row, pinRank.has(row.id))}
                  <span class="platform-comparison-row-label-copy">${escapeHtml(row.label)}</span>
                </div>
                ${views.map((view) => `<div class="platform-comparison-cell">${row.render(view)}</div>`).join('')}
              </div>`).join('')}
          </section>`).join('');
      }

      function render() {
        const views = selectedIds
          .map((id) => platforms.find((platform) => platform.slug === id))
          .filter(Boolean)
          .map((platform) => buildPlatformView(platform, context));
        const columnCount = Math.max(2, selectedIds.length);
        document.documentElement.style.setProperty('--comparison-columns', String(columnCount));
        selectionEl.innerHTML = renderSelectionCards(platforms, selectedIds);
        summaryEl.innerHTML = renderSummary(views);
        renderMatrix();
      }

      function setSelection(ids) {
        const next = normalizeSelection(ids, platforms, MAX_COMPARISON_ITEMS);
        if (next.length < 2) return false;
        selectedIds = next;
        updateUrl();
        render();
        return true;
      }

      function openPicker(required) {
        const capacity = getComparisonCapacity(window.innerWidth);
        const initial = selectedIds.length >= 2
          ? selectedIds.slice(0, capacity)
          : selectDefaultPlatforms(currentPinnedPlatforms(), platforms, capacity);
        createPicker({
          title: required ? '先选择要对比的平台' : '重新选择对比平台',
          platforms,
          pinnedIds: currentPinnedPlatforms(),
          selectedIds: initial,
          capacity,
          onConfirm: setSelection,
          onCancel: required ? () => { window.location.href = 'index.html?view=platforms'; } : null
        });
      }

      selectionEl.addEventListener('change', (event) => {
        const select = event.target.closest('[data-comparison-slot]');
        if (!select) return;
        const index = Number(select.getAttribute('data-comparison-slot'));
        if (!Number.isInteger(index)) return;
        const next = selectedIds.slice();
        next[index] = select.value;
        setSelection(next);
      });
      matrixEl.addEventListener('click', (event) => {
        const button = event.target.closest('[data-metric-pin]');
        if (!button) return;
        const id = button.getAttribute('data-metric-pin');
        metricPins = metricPins.includes(id)
          ? metricPins.filter((item) => item !== id)
          : [id, ...metricPins];
        writeMetricPins(window.localStorage, metricPins);
        renderMatrix();
      });
      chooseButton.addEventListener('click', () => openPicker(false));
      diffToggle.addEventListener('change', () => {
        onlyDifferences = diffToggle.checked;
        renderMatrix();
      });

      loading.hidden = true;
      app.hidden = false;
      if (selectedIds.length < 2) {
        openPicker(true);
      } else {
        render();
      }
      return true;
    } catch (cause) {
      loading.hidden = true;
      error.hidden = false;
      error.textContent = `平台对比暂时无法加载：${cause && cause.message ? cause.message : cause}`;
      return false;
    }
  }

  return {
    MAX_COMPARISON_ITEMS,
    METRIC_PIN_STORAGE_KEY,
    VALID_METRIC_IDS,
    getComparisonCapacity,
    normalizeSelection,
    selectDefaultPlatforms,
    shouldCompareDirectly,
    buildComparisonUrl,
    readSelectionFromSearch,
    formatPriceRange,
    computeLeadInfo,
    rowHasDifference,
    readMetricPins,
    writeMetricPins,
    mountLauncher,
    updateLauncherCount,
    createPicker,
    bootComparePage
  };
});
