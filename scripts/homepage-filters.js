(function (root) {
  'use strict';

  const Filters = root.CodingPlanFilters;
  if (!Filters) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function optionLabel(item, kind) {
    if (kind === 'planSlugs') return `${item.platformName || item.platformSlug} · ${item.name}`;
    return item.name || item.slug;
  }

  function valuesFor(state, key) {
    return state[key] === null ? null : (Array.isArray(state[key]) ? state[key] : []);
  }

  function buildPicker({ id, label, key, items, state }) {
    const rawSelected = valuesFor(state, key);
    const selected = rawSelected === null ? items.map(item => item.slug) : (rawSelected || []);
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

  const rangeLabels = { firstMonthPrice: '首月价格', monthlyPrice: '包月价格', quarterlyPrice: '包季价格', yearlyPrice: '包年价格', fiveHoursRequests: '5 小时请求数', weeklyRequests: '每周请求数', monthlyRequests: '每月请求数' };

  function buildRange(key, label, state) {
    const range = state[key] && state[key][label] ? state[key][label] : {};
    const min = range.min == null ? '' : range.min;
    const max = range.max == null ? '' : range.max;
    return `<div class="filter-range" data-range-group="${escapeHtml(key)}" data-range-key="${escapeHtml(label)}"><span>${escapeHtml(rangeLabels[label] || label)}</span><input aria-label="${escapeHtml(rangeLabels[label] || label)}最低" type="number" data-range-part="min" placeholder="最低" value="${escapeHtml(min)}"><span aria-hidden="true">—</span><input aria-label="${escapeHtml(rangeLabels[label] || label)}最高" type="number" data-range-part="max" placeholder="最高" value="${escapeHtml(max)}"></div>`;
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
      platformSlugs: state.platformSlugs === null ? null : [...state.platformSlugs],
      planSlugs: state.planSlugs === null ? null : [...state.planSlugs],
      modelSlugs: state.modelSlugs === null ? null : [...state.modelSlugs]
    };
    const params = new URLSearchParams(root.location && root.location.search || '');
    const linkedPlatform = params.get('platform');
    if (params.get('view') === 'plans' && linkedPlatform && platforms.some(item => item.slug === linkedPlatform)) {
      state.platformSlugs = [linkedPlatform];
    }
    state.__defaults = configuredDefaults;

    mountPoint.innerHTML = `<section class="filter-state-bar surface-panel" aria-label="统一筛选">
      <div class="filter-state-summary"><span class="filter-state-label">当前筛选</span><span class="filter-state-chip" data-summary="platformSlugs"></span><span class="filter-state-chip" data-summary="planSlugs"></span><span class="filter-state-chip" data-summary="modelSlugs"></span><span class="filter-state-chip" data-summary="budgetCny" hidden></span><div class="filter-state-actions"><button type="button" class="filter-state-btn" data-filter-action="clear-all">清空全部</button><button type="button" class="filter-state-btn primary" data-filter-action="restore-all">恢复默认</button></div></div>
      <p class="filter-state-hint" data-filter-hint></p><div class="filter-active-limits" data-active-limits aria-label="逐项取消筛选限制"></div>
      <div class="filter-state-grid">
        ${buildPicker({ id: 'homePlatformPicker', label: '平台', key: 'platformSlugs', items: platforms, state })}
        ${buildPicker({ id: 'homePlanPicker', label: '套餐', key: 'planSlugs', items: plans, state })}
        ${buildPicker({ id: 'homeModelPicker', label: '模型', key: 'modelSlugs', items: models, state })}
        <details class="filter-picker" data-picker="budgetCny" id="homeBudgetPicker"><summary><span>月预算（人民币）</span><span class="filter-picker-count" data-budget-label>不限</span></summary>
          <div class="filter-picker-menu budget-menu">
            <div class="budget-heading">月预算<span>拖动滑块或点击金额输入</span></div>
            <div class="budget-values">
              <label><span>最低金额</span><div><span>¥</span><input type="number" min="0" step="1" data-budget-part="min" placeholder="0" aria-label="最低月预算（人民币）"></div></label>
              <span class="budget-dash" aria-hidden="true">—</span>
              <label><span>最高金额</span><div><span>¥</span><input type="number" min="0" step="1" data-budget-part="max" placeholder="不限" aria-label="最高月预算（人民币）"></div></label>
            </div>
            <div class="budget-slider"><div class="budget-track"></div><div class="budget-selected" data-budget-track></div><input type="range" min="0" max="1000" step="1" value="0" data-budget-slider="min" aria-label="拖动最低月预算"><input type="range" min="0" max="1000" step="1" value="1000" data-budget-slider="max" aria-label="拖动最高月预算"></div>
            <div class="budget-scale"><span>¥0</span><span data-budget-scale></span></div>
            <div class="budget-presets" aria-label="常用月预算">${[[null, null, '不限'], [null, 50, '50 元以内'], [50, 100, '50–100 元'], [100, 200, '100–200 元'], [200, 700, '200–700 元'], [700, null, '700 元以上']].map(([min, max, label]) => `<button type="button" data-budget-preset data-min="${min == null ? '' : min}" data-max="${max == null ? '' : max}" aria-pressed="false">${label}</button>`).join('')}</div>
            <p class="filter-help">按人民币比较，美元按站点汇率换算。按量 API 不受月预算限制。</p>
            <div class="filter-picker-tools budget-footer"><button type="button" data-budget-action="clear">取消限制</button><button type="button" data-budget-action="done">完成</button></div>
          </div>
        </details>
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

    // Keep the main row compact; detailed conditions remain available in More.
    const filterRow = mountPoint.querySelector('.filter-state-grid');
    filterRow.appendChild(mountPoint.querySelector('.filter-state-actions'));
    const more = mountPoint.querySelector('.filter-more');
    more.querySelector('summary').textContent = '更多筛选';
    more.appendChild(mountPoint.querySelector('[data-filter-hint]'));
    more.appendChild(mountPoint.querySelector('[data-active-limits]'));

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

    const budgetScaleBase = Math.max(1000, Math.ceil(Math.max(0, ...plans.map(plan => Filters.toCny(plan.monthlyPrice, plan.currency, root.appConfig.usdToCnyRate) || 0)) / 100) * 100);
    let budgetScaleMax = budgetScaleBase;
    const budgetPosition = value => Math.sqrt(Math.max(0, Math.min(budgetScaleMax, value)) / budgetScaleMax) * 1000;
    const budgetAmount = position => Math.round((Number(position) / 1000) ** 2 * budgetScaleMax);

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
      if (!state.includeDiscontinued) active.push('排除下架套餐');
      if (state.platformTags.length) active.push(`平台标签 ${state.platformTags.length} 项`);
      if (state.planTags.length) active.push(`套餐标签 ${state.planTags.length} 项`);
      if (Object.keys(state.priceRanges).length) active.push(`价格范围 ${Object.keys(state.priceRanges).length} 项`);
      if (Object.keys(state.requestRanges).length) active.push(`请求范围 ${Object.keys(state.requestRanges).length} 项`);
      if (state.aaScoreMin != null) active.push(`AA ≥ ${state.aaScoreMin}`);
      if (state.deepSWEScoreMin != null) active.push(`DeepSWE ≥ ${state.deepSWEScoreMin}`);
      const hint = mountPoint.querySelector('[data-filter-hint]');
      if (hint) hint.textContent = active.length
        ? `当前条件（各视图仅使用适用项）：${active.join('、')}。无结果时可取消下方限制，或恢复默认。`
        : '更多筛选未启用；无结果时可取消下方限制，或恢复默认。';
      const limits = [];
      for (const [key, label] of [['platformSlugs', '平台'], ['planSlugs', '套餐'], ['modelSlugs', '模型']]) {
        if (state[key] !== null) limits.push([key, '', `${label}选择`]);
      }
      if (budget) limits.push(['budgetCny', '', '月预算']);
      if (state.platformStatusMax !== 'delisted') limits.push(['platformStatusMax', '', '平台状态']);
      if (!state.includeDiscontinued) limits.push(['includeDiscontinued', '', '排除下架套餐']);
      if (state.modelMatch === 'all') limits.push(['modelMatch', '', '全部模型匹配']);
      if (state.multimodal !== 'all') limits.push(['multimodal', '', '多模态']);
      for (const key of ['aaScoreMin', 'deepSWEScoreMin']) {
        if (state[key] != null) limits.push([key, '', key === 'aaScoreMin' ? 'AA 分数' : 'DeepSWE 分数']);
      }
      for (const key of ['platformTags', 'planTags']) {
        for (const tag of state[key]) limits.push([key, tag, tag]);
      }
      for (const key of ['priceRanges', 'requestRanges']) {
        for (const item of Object.keys(state[key])) limits.push([key, item, rangeLabels[item] || item]);
      }
      mountPoint.querySelector('[data-active-limits]').innerHTML = limits.map(([key, item, label]) =>
        `<button type="button" class="filter-state-btn" data-remove-filter="${escapeHtml(key)}" data-remove-item="${escapeHtml(item)}" aria-label="取消${escapeHtml(label)}限制">${escapeHtml(label)} ×</button>`).join('');
      budgetLabel.textContent = budgetText;
      const budgetMin = mountPoint.querySelector('[data-budget-part="min"]');
      const budgetMax = mountPoint.querySelector('[data-budget-part="max"]');
      if (budgetMin) budgetMin.value = budget && budget.min != null ? budget.min : '';
      if (budgetMax) budgetMax.value = budget && budget.max != null ? budget.max : '';
      budgetScaleMax = Math.max(budgetScaleMax, budget && budget.min || 0, budget && budget.max || 0);
      const low = budgetPosition(budget && budget.min || 0);
      const high = budget && budget.max != null ? budgetPosition(budget.max) : 1000;
      const lowerSlider = mountPoint.querySelector('[data-budget-slider="min"]');
      const upperSlider = mountPoint.querySelector('[data-budget-slider="max"]');
      lowerSlider.value = low;
      upperSlider.value = high;
      lowerSlider.setAttribute('aria-valuetext', `最低 ${budget && budget.min || 0} 元`);
      upperSlider.setAttribute('aria-valuetext', budget && budget.max != null ? `最高 ${budget.max} 元` : '最高不限');
      lowerSlider.style.zIndex = low >= 1000 ? '4' : '2';
      upperSlider.style.zIndex = high <= 0 ? '4' : '2';
      const track = mountPoint.querySelector('[data-budget-track]');
      track.style.left = `${low / 10}%`;
      track.style.width = `${Math.max(0, high - low) / 10}%`;
      mountPoint.querySelector('[data-budget-scale]').textContent = `¥${budgetScaleMax.toLocaleString('zh-CN')} / 不限`;
      mountPoint.querySelectorAll('[data-budget-preset]').forEach(button => {
        const min = button.dataset.min === '' ? null : Number(button.dataset.min);
        const max = button.dataset.max === '' ? null : Number(button.dataset.max);
        button.setAttribute('aria-pressed', String((budget && budget.min != null ? budget.min : null) === min && (budget && budget.max != null ? budget.max : null) === max));
      });
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
      if (target.matches('[data-budget-slider]')) {
        let min = Number(mountPoint.querySelector('[data-budget-slider="min"]').value);
        let max = Number(mountPoint.querySelector('[data-budget-slider="max"]').value);
        if (min > max) { if (target.dataset.budgetSlider === 'min') min = max; else max = min; }
        state.budgetCny = min === 0 && max === 1000 ? null : { min: min === 0 ? null : budgetAmount(min), max: max === 1000 ? null : budgetAmount(max) };
        publish();
        return;
      }
      if (target.matches('[data-budget-part]')) {
        const min = mountPoint.querySelector('[data-budget-part="min"]').value;
        const max = mountPoint.querySelector('[data-budget-part="max"]').value;
        state.budgetCny = min === '' && max === '' ? null : { min: min === '' ? null : Math.max(0, Number(min)), max: max === '' ? null : Math.max(0, Number(max)) };
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
      if (target.matches('input[type="number"][data-filter-field]')) {
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
      const remove = event.target.closest('[data-remove-filter]');
      if (remove) {
        const key = remove.dataset.removeFilter;
        const item = remove.dataset.removeItem;
        if (key === 'platformTags' || key === 'planTags') state[key] = state[key].filter(value => value !== item);
        else if (key === 'priceRanges' || key === 'requestRanges') delete state[key][item];
        else state[key] = Filters.createDefaultState({}, { mode: 'full' })[key];
        publish();
        return;
      }
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
      const preset = event.target.closest('[data-budget-preset]');
      if (preset) {
        const min = preset.dataset.min === '' ? null : Number(preset.dataset.min);
        const max = preset.dataset.max === '' ? null : Number(preset.dataset.max);
        state.budgetCny = min === null && max === null ? null : { min, max };
        publish();
        return;
      }
      if (event.target.closest('[data-budget-action="done"]')) {
        const picker = mountPoint.querySelector('#homeBudgetPicker');
        picker.open = false;
        picker.querySelector('summary').focus();
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
    mountPoint.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const picker = event.target.closest('.filter-picker[open]');
      if (picker) {
        picker.open = false;
        picker.querySelector('summary').focus();
        event.preventDefault();
      }
    });
    mountPoint.querySelectorAll('.filter-picker').forEach(picker => {
      picker.addEventListener('toggle', () => {
        if (picker.open) mountPoint.querySelectorAll('.filter-picker[open]').forEach(other => {
          if (other !== picker) other.open = false;
        });
      });
    });
    document.addEventListener('click', event => {
      mountPoint.querySelectorAll('.filter-picker[open]').forEach(picker => {
        if (!picker.contains(event.target)) picker.open = false;
      });
    });
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
