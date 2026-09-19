(function (root) {
  'use strict';
  const Filters = root.CodingPlanFilters;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '未公开';
  const money = (plan, field) => {
    const value = plan && plan[field];
    return typeof value === 'number' && Number.isFinite(value) ? `${plan.currency || '¥'}${number(value)}` : '未公开';
  };

  function boot() {
    const host = document.getElementById('plansPage');
    if (!host || !Filters || !root.EntityData) return;
    Promise.all(['platforms.json', 'plans.json', 'models.json', 'plan-models.json', 'config.json'].map(file => fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`${file} 加载失败`);
      return response.json();
    }))).then(([platformDoc, planDoc, modelDoc, relationDoc, config]) => {
      const context = root.EntityData.buildContext(platformDoc, planDoc, modelDoc, relationDoc);
      const allPlans = root.EntityData.buildPlanCatalog(context, { includeHidden: true }).filter(plan => plan.billingMode === 'subscription' && plan.planTableVisible !== false);
      const platforms = context.platforms.filter(item => item.catalogVisible !== false);
      const models = context.models;
      const tags = [...new Set(allPlans.flatMap(plan => plan.tags || []))];
      const params = new URLSearchParams(location.search);
      const initial = Filters.createDefaultState(config, { mode: 'full' });
      const linkedPlatform = params.get('platform');
      if (linkedPlatform && platforms.some(item => item.slug === linkedPlatform)) initial.platformSlugs = [linkedPlatform];
      let state = Filters.normalizeState(initial);
      let sort = { key: 'monthlyPrice', direction: 'asc' };

      const platformOptions = host.querySelector('[data-plan-platforms]');
      const modelOptions = host.querySelector('[data-plan-models]');
      const tagOptions = host.querySelector('[data-plan-tags]');
      const tableBody = host.querySelector('[data-plan-body]');
      const count = host.querySelector('[data-plan-count]');
      const budgetMin = host.querySelector('[data-budget-min]');
      const budgetMax = host.querySelector('[data-budget-max]');
      const modelMatch = host.querySelector('[data-plan-model-match]');
      const status = host.querySelector('[data-plan-status]');
      const includeDiscontinued = host.querySelector('[data-plan-discontinued]');
      const ranges = ['firstMonthPrice', 'monthlyPrice', 'quarterlyPrice', 'yearlyPrice'].map(key => ({ key, min: host.querySelector(`[data-range="${key}"][data-part="min"]`), max: host.querySelector(`[data-range="${key}"][data-part="max"]`) }));
      const requestRanges = ['fiveHoursRequests', 'weeklyRequests', 'monthlyRequests'].map(key => ({ key, min: host.querySelector(`[data-request-range="${key}"][data-part="min"]`), max: host.querySelector(`[data-request-range="${key}"][data-part="max"]`) }));

      function checks(items, key, label) {
        return items.map(item => `<label><input type="checkbox" data-plan-selection="${key}" value="${esc(item.slug)}"><span>${esc(label(item))}</span></label>`).join('');
      }
      platformOptions.innerHTML = checks(platforms, 'platformSlugs', item => item.name);
      modelOptions.innerHTML = checks(models, 'modelSlugs', item => item.name);
      tagOptions.innerHTML = tags.map(tag => `<label><input type="checkbox" data-plan-tag value="${esc(tag)}"><span>${esc(tag)}</span></label>`).join('');

      function apply() {
        const filtered = Filters.filterPlans(allPlans, state, { usdToCnyRate: config.usdToCnyRate, context });
        filtered.sort((a, b) => {
          const left = sort.key === 'monthlyPrice' ? Filters.toCny(a[sort.key], a.currency, config.usdToCnyRate) : a[sort.key];
          const right = sort.key === 'monthlyPrice' ? Filters.toCny(b[sort.key], b.currency, config.usdToCnyRate) : b[sort.key];
          const leftNumber = Number(left);
          const rightNumber = Number(right);
          const leftMissing = !Number.isFinite(leftNumber);
          const rightMissing = !Number.isFinite(rightNumber);
          if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
          if (leftMissing) return 0;
          const result = leftNumber - rightNumber;
          return sort.direction === 'asc' ? result : -result;
        });
        count.textContent = `${filtered.length} / ${allPlans.length} 个套餐`;
        tableBody.innerHTML = filtered.length ? filtered.map(plan => `<tr><td><strong>${esc(plan.platformName)}</strong></td><td>${esc(plan.name)}</td><td>${esc(plan.currency || '¥')}${number(plan.monthlyPrice)}<small> / 月</small><br><span class="tool-muted">首月 ${esc(money(plan, 'firstMonthPrice'))} · 季 ${esc(money(plan, 'quarterlyPrice'))} · 年 ${esc(money(plan, 'yearlyPrice'))}</span></td><td>${esc(plan.fiveHoursRequests)} / ${esc(plan.weeklyRequests)} / ${esc(plan.monthlyRequests)}</td><td>${(plan.modelLabels || []).map(name => `<span class="tool-tag">${esc(name)}</span>`).join('')}</td><td>${(plan.tags || []).map(tag => `<span class="tool-tag">${esc(tag)}</span>`).join('')}</td><td>${plan.discontinued ? '<span class="tool-tag">已下架</span>' : `<a href="${esc(plan.action || '#')}" target="_blank" rel="noopener noreferrer">开通 ↗</a>`}</td></tr>`).join('') : '<tr><td colspan="7"><div class="tool-empty">当前条件下没有套餐；请查看上方生效限制并逐项清空，或恢复全量。</div></td></tr>';
        host.querySelectorAll('[data-plan-selection]').forEach(input => { input.checked = (state[input.getAttribute('data-plan-selection')] || []).includes(input.value); });
        host.querySelectorAll('[data-plan-tag]').forEach(input => { input.checked = state.planTags.includes(input.value); });
        modelMatch.value = state.modelMatch;
        status.value = state.platformStatusMax;
        includeDiscontinued.checked = state.includeDiscontinued;
        budgetMin.value = state.budgetCny && state.budgetCny.min != null ? state.budgetCny.min : '';
        budgetMax.value = state.budgetCny && state.budgetCny.max != null ? state.budgetCny.max : '';
      }

      function update() {
        const min = budgetMin.value; const max = budgetMax.value;
        state.budgetCny = min === '' && max === '' ? null : { min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) };
        state.priceRanges = Object.fromEntries(ranges.map(item => [item.key, { min: item.min.value === '' ? null : Number(item.min.value), max: item.max.value === '' ? null : Number(item.max.value) }]).filter(([, range]) => range.min != null || range.max != null));
        state.requestRanges = Object.fromEntries(requestRanges.map(item => [item.key, { min: item.min.value === '' ? null : Number(item.min.value), max: item.max.value === '' ? null : Number(item.max.value) }]).filter(([, range]) => range.min != null || range.max != null));
        apply();
      }
      host.addEventListener('change', event => {
        const target = event.target;
        if (target.matches('[data-plan-selection]')) {
          const key = target.getAttribute('data-plan-selection');
          state[key] = [...host.querySelectorAll(`[data-plan-selection="${key}"]:checked`)].map(input => input.value);
        } else if (target.matches('[data-plan-tag]')) {
          state.planTags = [...host.querySelectorAll('[data-plan-tag]:checked')].map(input => input.value);
        } else if (target === modelMatch) state.modelMatch = target.value;
        else if (target === status) state.platformStatusMax = target.value;
        else if (target === includeDiscontinued) state.includeDiscontinued = target.checked;
        update();
      });
      host.addEventListener('input', update);
      host.addEventListener('click', event => {
        const reset = event.target.closest('[data-plan-reset]');
        if (reset) {
          state = Filters.createDefaultState(config, { mode: 'full' });
          for (const input of host.querySelectorAll('input[type="number"]')) input.value = '';
          apply();
        }
        const header = event.target.closest('[data-plan-sort]');
        if (header) {
          const key = header.getAttribute('data-plan-sort');
          sort = { key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc' };
          apply();
        }
      });
      apply();
    }).catch(error => { host.querySelector('[data-plan-error]').hidden = false; host.querySelector('[data-plan-error]').textContent = error.message || '套餐数据加载失败'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
