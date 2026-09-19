(function (root) {
  'use strict';

  const Filters = root.CodingPlanFilters;
  if (!Filters) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function optionLabel(item, kind) {
    if (kind === 'plans') return `${item.platformName || item.platformSlug} · ${item.name}`;
    return item.name || item.slug;
  }

  function valuesFor(state, key) {
    return state[key] === null ? null : (Array.isArray(state[key]) ? state[key] : []);
  }

  function buildPicker({ id, label, key, items, state, onChange }) {
    const rawSelected = valuesFor(state, key);
    const selected = rawSelected === null ? items.map(item => item.slug) : (rawSelected || []);
    const defaults = (state.__defaults && state.__defaults[key]) || [];
    const allIds = items.map(item => item.slug);
    const countText = rawSelected === null || selected.length === allIds.length ? '全部' : `${selected.length} 项`;
    const options = items.map(item => {
      const value = String(item.slug);
      return `<label data-filter-option data-search-text="${escapeHtml(optionLabel(item, key))}"><input type="checkbox" value="${escapeHtml(value)}" ${selected.includes(value) ? 'checked' : ''}><span>${escapeHtml(optionLabel(item, key))}</span></label>`;
    }).join('');
    return `<details class="filter-picker" data-picker="${escapeHtml(key)}" id="${escapeHtml(id)}">
      <summary><span>${escapeHtml(label)}</span><span class="filter-picker-count" data-picker-count>${escapeHtml(countText)}</span></summary>
      <div class="filter-picker-menu">
        <input type="search" data-picker-search placeholder="搜索${escapeHtml(label)}" aria-label="搜索${escapeHtml(label)}">
        <div class="filter-picker-tools"><button type="button" data-picker-action="clear">清空</button><button type="button" data-picker-action="all">全选</button><button type="button" data-picker-action="default">恢复默认</button></div>
        <div data-picker-options>${options}</div>
      </div>
    </details>`;
  }

  function buildRange(key, label, state) {
    const range = state[key] && state[key][label] ? state[key][label] : {};
    const min = range.min == null ? '' : range.min;
    const max = range.max == null ? '' : range.max;
    return `<div class="filter-range" data-range-group="${escapeHtml(key)}" data-range-key="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><input type="number" data-range-part="min" placeholder="最低" value="${escapeHtml(min)}"><span aria-hidden="true">—</span><input type="number" data-range-part="max" placeholder="最高" value="${escapeHtml(max)}"></div>`;
  }

  function mount() {
    const mountPoint = document.getElementById('homepageUnifiedFiltersMount');
    const context = root.codingplanEntityContext;
    if (!mountPoint || !context || !root.EntityData) return false;
    if (mountPoint.dataset.mounted === '1') return true;
    const catalog = (root.appConfig && root.appConfig.platformCatalog) || {};
    const platforms = (context.platforms || []).filter(item => item.catalogVisible !== false);
    const plans = root.EntityData.buildPlanCatalog(context).filter(item => item.planTableVisible !== false);
    const models = (context.models || []).filter(item => item.catalogVisible !== false);
    const defaultValidation = Filters.validateDefaults(root.appConfig && root.appConfig.homepageFilters && root.appConfig.homepageFilters.defaults, context);
    if (!defaultValidation.ok) {
      mountPoint.innerHTML = `<p class="filter-state-error">首页默认筛选配置无效：${escapeHtml(defaultValidation.errors.join('；'))}</p>`;
      mountPoint.dataset.mounted = '1';
      console.error(defaultValidation.errors.join('\n'));
      return true;
    }
    const defaults = Filters.createDefaultState(root.appConfig || {});
    const state = Filters.normalizeState(defaults);
    // 深链只预选当前平台，选择器的“恢复默认”仍回到配置中的精选名单。
    const configuredDefaults = {
      platformSlugs: [...(state.platformSlugs || [])],
      planSlugs: [...(state.planSlugs || [])],
      modelSlugs: [...(state.modelSlugs || [])]
    };
    const params = new URLSearchParams(root.location && root.location.search || '');
    const linkedPlatform = params.get('platform');
    if (params.get('view') === 'plans' && linkedPlatform && platforms.some(item => item.slug === linkedPlatform)) {
      state.platformSlugs = [linkedPlatform];
    }
    state.__defaults = configuredDefaults;

    mountPoint.innerHTML = `<section class="filter-state-bar surface-panel" aria-label="统一筛选">
      <div class="filter-state-summary"><span class="filter-state-label">当前筛选</span><span class="filter-state-chip" data-summary="platformSlugs"></span><span class="filter-state-chip" data-summary="planSlugs"></span><span class="filter-state-chip" data-summary="modelSlugs"></span><span class="filter-state-chip" data-summary="budgetCny" hidden></span><div class="filter-state-actions"><button type="button" class="filter-state-btn" data-filter-action="clear-all">清空全部</button><button type="button" class="filter-state-btn primary" data-filter-action="restore-all">恢复默认</button></div></div>
      <p class="filter-state-hint" data-filter-hint></p>
      <div class="filter-state-grid">
        ${buildPicker({ id: 'homePlatformPicker', label: '平台', key: 'platformSlugs', items: platforms, state, onChange: null })}
        ${buildPicker({ id: 'homePlanPicker', label: '套餐', key: 'planSlugs', items: plans, state, onChange: null })}
        ${buildPicker({ id: 'homeModelPicker', label: '模型', key: 'modelSlugs', items: models, state, onChange: null })}
        <details class="filter-picker" data-picker="budgetCny" id="homeBudgetPicker"><summary><span>月预算（人民币）</span><span class="filter-picker-count" data-budget-label>不限</span></summary><div class="filter-picker-menu"><div class="filter-range budget-range"><input type="number" min="0" step="1" data-budget-part="min" placeholder="最低预算"><span aria-hidden="true">—</span><input type="number" min="0" step="1" data-budget-part="max" placeholder="最高预算"></div><p class="filter-help">美元套餐按当前站点汇率换算；按量 API 不参加月预算筛选。</p><div class="filter-picker-tools"><button type="button" data-budget-action="clear">取消限制</button></div></div></details>
      </div>
      <details class="filter-more"><summary>更多筛选与口径</summary><div class="filter-more-grid">
        <label class="filter-inline"><span>模型匹配</span><select data-filter-field="modelMatch"><option value="any">任意一个</option><option value="all">全部所选</option></select></label>
        <label class="filter-inline"><span>平台状态</span><select data-filter-field="platformStatusMax"><option value="open">开放购买</option><option value="limited">含定时放量</option><option value="paused">含暂停售</option><option value="delisted">全部状态</option></select></label>
        <label class="filter-inline"><span>多模态</span><select data-filter-field="multimodal"><option value="all">全部</option><option value="multimodal">仅多模态</option><option value="text">仅纯文本</option></select></label>
        <label class="filter-inline"><span>AA 最低分</span><input type="number" min="0" max="100" data-filter-field="aaScoreMin" placeholder="不限"></label>
        <label class="filter-inline"><span>DeepSWE 最低分</span><input type="number" min="0" max="100" data-filter-field="deepSWEScoreMin" placeholder="不限"></label>
        <label class="filter-inline"><input type="checkbox" data-filter-field="includeDiscontinued"><span>包含下架套餐</span></label>
        <div class="filter-subgroup"><strong>平台标签</strong><div data-tag-options="platformTags"></div></div>
        <div class="filter-subgroup"><strong>套餐标签</strong><div data-tag-options="planTags"></div></div>
        <div class="filter-subgroup filter-ranges"><strong>价格范围（折合人民币）</strong>${buildRange('priceRanges', 'firstMonthPrice', state)}${buildRange('priceRanges', 'monthlyPrice', state)}${buildRange('priceRanges', 'quarterlyPrice', state)}${buildRange('priceRanges', 'yearlyPrice', state)}</div>
        <div class="filter-subgroup filter-ranges"><strong>请求数范围</strong>${buildRange('requestRanges', 'fiveHoursRequests', state)}${buildRange('requestRanges', 'weeklyRequests', state)}${buildRange('requestRanges', 'monthlyRequests', state)}</div>
      </div><p class="filter-help">平台、套餐和模型的筛选会在适用的 Tab 中联动；监控只使用平台和模型条件。清空实体选择会得到空结果，全选表示该维度不缩小范围。</p></details>
    </section>`;

    const tagValues = [...new Set(platforms.flatMap(item => Array.isArray(item.tags) ? item.tags : []))];
    const derived = (catalog.derivedTags || []).map(item => item.label).filter(Boolean);
    const planTags = [...new Set(plans.flatMap(item => Array.isArray(item.tags) ? item.tags : []))];
    const renderTags = (key, values) => {
      const host = mountPoint.querySelector(`[data-tag-options="${key}"]`);
      if (!host) return;
      host.innerHTML = [...new Set(values)].map(value => `<label><input type="checkbox" value="${escapeHtml(value)}"><span>${escapeHtml(value)}</span></label>`).join('');
    };
    renderTags('platformTags', [...derived, ...tagValues]);
    renderTags('planTags', planTags);

    function summary(key, label, allItems) {
      const selected = state[key];
      const el = mountPoint.querySelector(`[data-summary="${key}"]`);
      if (!el) return;
      if (selected === null) el.textContent = `${label}全部`;
      else if (!selected.length) el.textContent = `${label}已清空`;
      else if (selected.length === allItems.length) el.textContent = `${label}全部`;
      else el.textContent = `${label}${selected.length}项`;
    }

    function render() {
      summary('platformSlugs', '平台', platforms);
      summary('planSlugs', '套餐', plans);
      summary('modelSlugs', '模型', models);
      const budgetChip = mountPoint.querySelector('[data-summary="budgetCny"]');
      const budgetLabel = mountPoint.querySelector('[data-budget-label]');
      const budget = state.budgetCny;
      const budgetText = budget && (budget.min != null || budget.max != null)
        ? `¥${budget.min == null ? 0 : budget.min}–${budget.max == null ? '不限' : budget.max}` : '不限';
      budgetChip.hidden = !(budget && (budget.min != null || budget.max != null));
      budgetChip.textContent = `预算${budgetText}`;
      const active = [];
      const statusLabels = { open: '开放购买', limited: '含定时放量', paused: '含暂停售', delisted: '全部状态' };
      if (state.platformStatusMax !== 'delisted') active.push(`平台状态：${statusLabels[state.platformStatusMax] || state.platformStatusMax}`);
      if (state.modelMatch === 'all') active.push('模型需同时支持全部所选');
      if (state.multimodal !== 'all') active.push(state.multimodal === 'multimodal' ? '仅多模态' : '仅纯文本');
      if (state.includeDiscontinued) active.push('包含下架套餐');
      if (state.platformTags.length) active.push(`平台标签 ${state.platformTags.length} 项`);
      if (state.planTags.length) active.push(`套餐标签 ${state.planTags.length} 项`);
      if (Object.keys(state.priceRanges).length) active.push(`价格范围 ${Object.keys(state.priceRanges).length} 项`);
      if (Object.keys(state.requestRanges).length) active.push(`请求范围 ${Object.keys(state.requestRanges).length} 项`);
      if (state.aaScoreMin != null) active.push(`AA ≥ ${state.aaScoreMin}`);
      if (state.deepSWEScoreMin != null) active.push(`DeepSWE ≥ ${state.deepSWEScoreMin}`);
      const hint = mountPoint.querySelector('[data-filter-hint]');
      if (hint) hint.textContent = active.length
        ? `生效限制：${active.join('、')}。无结果时可在对应选择器逐项清空，或恢复默认。`
        : '更多筛选未启用；无结果时可在对应选择器逐项清空，或恢复默认。';
      budgetLabel.textContent = budgetText;
      const budgetMin = mountPoint.querySelector('[data-budget-part="min"]');
      const budgetMax = mountPoint.querySelector('[data-budget-part="max"]');
      if (budgetMin) budgetMin.value = budget && budget.min != null ? budget.min : '';
      if (budgetMax) budgetMax.value = budget && budget.max != null ? budget.max : '';
      mountPoint.querySelector('[data-filter-field="modelMatch"]').value = state.modelMatch;
      mountPoint.querySelector('[data-filter-field="platformStatusMax"]').value = state.platformStatusMax;
      mountPoint.querySelector('[data-filter-field="multimodal"]').value = state.multimodal;
      mountPoint.querySelector('[data-filter-field="aaScoreMin"]').value = state.aaScoreMin == null ? '' : state.aaScoreMin;
      mountPoint.querySelector('[data-filter-field="deepSWEScoreMin"]').value = state.deepSWEScoreMin == null ? '' : state.deepSWEScoreMin;
      mountPoint.querySelector('[data-filter-field="includeDiscontinued"]').checked = state.includeDiscontinued;
      for (const [key, items] of [['platformSlugs', platforms], ['planSlugs', plans], ['modelSlugs', models]]) {
        const selected = state[key] === null ? items.map(item => item.slug) : (state[key] || []);
        const details = mountPoint.querySelector(`[data-picker="${key}"]`);
        details.querySelector('[data-picker-count]').textContent = selected.length === items.length ? '全部' : `${selected.length} 项`;
        details.querySelectorAll('[data-picker-option]');
        details.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected.includes(input.value); });
      }
      mountPoint.querySelectorAll('[data-tag-options]').forEach(host => {
        const key = host.getAttribute('data-tag-options');
        const selected = state[key] || [];
        host.querySelectorAll('input').forEach(input => { input.checked = selected.includes(input.value); });
      });
      mountPoint.querySelectorAll('[data-range-group]').forEach(group => {
        const mapKey = group.getAttribute('data-range-group');
        const rangeKey = group.getAttribute('data-range-key');
        const range = state[mapKey] && state[mapKey][rangeKey];
        const minInput = group.querySelector('[data-range-part="min"]');
        const maxInput = group.querySelector('[data-range-part="max"]');
        if (minInput) minInput.value = range && range.min != null ? range.min : '';
        if (maxInput) maxInput.value = range && range.max != null ? range.max : '';
      });
    }

    function publish() {
      const clean = Filters.normalizeState(state);
      delete clean.__defaults;
      root.__codingplanUnifiedFiltersState = clean;
      if (root.__codingplanHomeApi && typeof root.__codingplanHomeApi.setUnifiedFilters === 'function') root.__codingplanHomeApi.setUnifiedFilters(clean);
      root.dispatchEvent(new CustomEvent('codingplan:filters-changed', { detail: { state: clean } }));
      render();
    }

    function setSelection(key, values) {
      state[key] = values === null ? null : [...new Set(values)];
      publish();
    }

    mountPoint.addEventListener('input', event => {
      const target = event.target;
      const picker = target.closest('[data-picker]');
      if (target.matches('[data-picker-search]')) {
        const query = target.value.trim().toLowerCase();
        target.closest('.filter-picker-menu').querySelectorAll('[data-filter-option]').forEach(option => { option.hidden = query && !option.dataset.searchText.toLowerCase().includes(query); });
        return;
      }
      if (target.matches('[data-budget-part]')) {
        const min = mountPoint.querySelector('[data-budget-part="min"]').value;
        const max = mountPoint.querySelector('[data-budget-part="max"]').value;
        state.budgetCny = min === '' && max === '' ? null : { min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) };
        publish();
        return;
      }
      if (target.matches('[data-range-part]')) {
        const group = target.closest('[data-range-group]');
        const rangeKey = group.getAttribute('data-range-key');
        const mapKey = group.getAttribute('data-range-group');
        const minInput = group.querySelector('[data-range-part="min"]').value;
        const maxInput = group.querySelector('[data-range-part="max"]').value;
        state[mapKey] = { ...(state[mapKey] || {}) };
        if (minInput === '' && maxInput === '') delete state[mapKey][rangeKey];
        else state[mapKey][rangeKey] = { min: minInput === '' ? null : Number(minInput), max: maxInput === '' ? null : Number(maxInput) };
        publish();
        return;
      }
      if (target.matches('[data-filter-field]')) {
        const key = target.getAttribute('data-filter-field');
        state[key] = target.type === 'checkbox' ? target.checked : (target.value === '' ? null : target.value);
        publish();
        return;
      }
      if (picker && target.matches('input[type="checkbox"]')) {
        const key = picker.getAttribute('data-picker');
        const values = [...picker.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
        setSelection(key, values);
      }
    });

    mountPoint.addEventListener('change', event => {
      const target = event.target;
      if (target.matches('[data-filter-field]')) {
        const key = target.getAttribute('data-filter-field');
        state[key] = target.type === 'checkbox' ? target.checked : (target.value === '' ? null : target.value);
        publish();
      }
      const tagHost = target.closest('[data-tag-options]');
      if (tagHost && target.matches('input')) {
        const key = tagHost.getAttribute('data-tag-options');
        state[key] = [...tagHost.querySelectorAll('input:checked')].map(input => input.value);
        publish();
      }
    });

    mountPoint.addEventListener('click', event => {
      const action = event.target.closest('[data-picker-action]');
      if (action) {
        const picker = action.closest('[data-picker]');
        const key = picker.getAttribute('data-picker');
        const items = key === 'platformSlugs' ? platforms : key === 'planSlugs' ? plans : models;
        const actionName = action.getAttribute('data-picker-action');
        if (actionName === 'clear') setSelection(key, []);
        if (actionName === 'all') setSelection(key, null);
        if (actionName === 'default') setSelection(key, state.__defaults[key]);
        event.preventDefault();
        return;
      }
      if (event.target.closest('[data-budget-action="clear"]')) {
        state.budgetCny = null;
        publish();
        event.preventDefault();
        return;
      }
      const globalAction = event.target.closest('[data-filter-action]');
      if (globalAction) {
        if (globalAction.getAttribute('data-filter-action') === 'restore-all') {
          const restored = Filters.createDefaultState(root.appConfig || {});
          for (const key of Object.keys(restored)) state[key] = restored[key];
        } else {
          state.platformSlugs = [];
          state.planSlugs = [];
          state.modelSlugs = [];
          state.budgetCny = null;
          state.modelMatch = 'any';
          state.platformStatusMax = 'delisted';
          state.platformTags = [];
          state.planTags = [];
          state.includeDiscontinued = true;
          state.priceRanges = {};
          state.requestRanges = {};
          state.multimodal = 'all';
          state.aaScoreMin = null;
          state.deepSWEScoreMin = null;
        }
        publish();
      }
    });

    mountPoint.dataset.mounted = '1';
    document.body.classList.add('homepage-unified-active');
    root.__codingplanUnifiedFiltersState = Filters.normalizeState(state);
    render();
    publish();
    return true;
  }

  function waitForCatalog() {
    if (mount()) return;
    root.addEventListener('codingplan:catalog-ready', mount, { once: true });
    root.setTimeout(() => { if (!mount()) waitForCatalog(); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForCatalog);
  else waitForCatalog();
})(typeof globalThis !== 'undefined' ? globalThis : this);
