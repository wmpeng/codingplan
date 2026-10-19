(function (root) {
  'use strict';
  const Filters = root.CodingPlanFilters, Directory = root.PlanDirectory;
  const UI = root.CodingPlanUI, esc = UI.escapeHtml, Numbers = root.NumberDisplay;
  const money = (plan, field) => {
    const value = Directory.priceValue(plan, field);
    if (field === 'monthlyPrice' || field === 'firstMonthPrice') return Numbers.monthlyFee(value, plan.currency || '¥', '未知');
    return Numbers.finite(value) === null ? '未知' : `${plan.currency || '¥'}${Numbers.amount(value)}`;
  };
  const requests = (plan, field) => {
    const value = plan[field];
    if (value === '无限制' || value === 'unlimited') return '无限制';
    if (Numbers.finite(value) === null) return '未知';
    return (field === 'monthlyRequests' ? Numbers.tokens : Numbers.count)(value);
  };
  function chips(values) {
    const items = values || [], tag = value => `<span class="tool-tag">${esc(value)}</span>`;
    return items.slice(0, 4).map(tag).join('') + (items.length > 4 ? `<details class="plan-cell-more"><summary>另 ${items.length - 4} 项</summary>${items.slice(4).map(tag).join('')}</details>` : '');
  }
  function boot() {
    const host = document.getElementById('plansPage');
    if (!host || !Filters || !Directory || !root.EntityData) return;
    const modelRows = UI.observeModelTagRows(host);
    root.CodingPlanToolPage.load().then(({context, config}) => {
      const allPlans = root.EntityData.buildPlanCatalog(context).filter(plan => plan.billingMode === 'subscription');
      const search = host.querySelector('[data-plan-search]');
      let state = Filters.createDefaultState(config, {mode:'full'}), pins = Directory.readPins(root.localStorage, allPlans);
      let sort = {key:'platformOrder', direction:'asc'}, sortPicker, sortSelect, directionButton, lastFilterKey;
      const tableBody = host.querySelector('[data-plan-body]'), count = host.querySelector('[data-plan-count]');
      function syncSort() {
        if (sortSelect) { sortSelect.value = sort.key; sortPicker.sync(); }
        if (directionButton) {
          directionButton.disabled = sort.key === 'platformOrder';
          directionButton.textContent = sort.direction === 'asc' ? '↑' : '↓';
          directionButton.setAttribute('aria-label', `当前${sort.direction === 'asc' ? '升序' : '降序'}，切换为${sort.direction === 'asc' ? '降序' : '升序'}`);
        }
        host.querySelectorAll('th').forEach(th => {
          const active = [...th.querySelectorAll('[data-plan-sort]')].find(button => button.dataset.planSort === sort.key);
          th.setAttribute('aria-sort', active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none');
          th.querySelectorAll('[data-plan-sort]').forEach(button => button.classList.toggle('is-active-sort', button === active));
        });
      }
      function apply() {
        const selection = Directory.select(allPlans, state, {context, config, query:search.value, sort, pins});
        count.textContent = Directory.countLabel(selection); syncSort();
        tableBody.innerHTML = selection.visible.length ? selection.visible.map(plan => {
          const status = plan.planStatus || 'open';
          const url = UI.sanitizeUrl(plan.action, '');
          const models = UI.prioritizeFeaturedModels(plan.supportedModels || [], context.modelGroups);
          const label = `${plan.platformName} ${plan.name}`;
          const title = status !== 'delisted' && url
            ? `<a class="plan-title" data-plan-link="${status}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${status === 'open' ? '开通' : '去官网查看'} ${esc(label)}">${esc(label)} ${UI.externalLinkIcon}</a>`
            : `<strong class="plan-title">${esc(label)}</strong>`;
          return `<tr data-plan-row="${esc(plan.slug)}"${selection.pinned.has(plan.slug) ? ' class="is-pinned"' : ''}>
            <td data-plan-col="identity"><div class="plan-identity">${UI.pinButton({pinned:selection.pinned.has(plan.slug), label:`${selection.pinned.has(plan.slug) ? '取消置顶' : '置顶'} ${label}`, attributes:{'data-plan-pin':plan.slug}})}<div class="plan-identity-copy">${title}<div class="plan-meta">${status === 'open' ? '' : `<span class="tool-tag plan-status" data-plan-status="${status}">${esc(UI.statusLabels[status])}</span>`}${root.EntityData.harnessApiBadge(plan.supportsHarnessApi)}</div></div></div></td>
            <td data-plan-col="rating"><span class="plan-rating" aria-label="${plan.rating > 0 ? esc(plan.rating)+' 星' : '待评定'}">${plan.rating > 0 ? '★ '+Number(plan.rating).toFixed(1) : '待评定'}</span></td>
            ${['firstMonthPrice','monthlyPrice','quarterlyPrice','yearlyPrice'].map(key => `<td data-plan-col="${key}"${key === 'firstMonthPrice' ? '' : ' data-plan-extra'}>${esc(money(plan,key))}</td>`).join('')}
            <td data-plan-col="models">${UI.modelTags(models.map(model => model.name), {maxRows:2,ariaLabel:label+' 支持模型'})}</td>
            <td data-plan-col="monthlyToken" class="monthly-token-cell" title="所选模型各档位的月 Token 参考范围，不相加；按最大值排序，详细口径见价格与额度">${esc(Filters.formatMonthlyTokens(plan,state))}</td>
            ${['fiveHoursRequests','weeklyRequests','monthlyRequests'].map(key => `<td data-plan-col="${key}" data-plan-extra>${esc(requests(plan,key))}</td>`).join('')}
            <td data-plan-col="benefits" data-plan-extra>${chips(plan.benefits)}</td><td class="plan-note" data-plan-col="note">${esc(plan.note || '')}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="13"><div class="tool-empty">没有匹配套餐，试着清空搜索或减少筛选条件。</div></td></tr>';
        modelRows.refresh(); host.dataset.mounted = '1';
      }
      search.disabled = false; search.addEventListener('input', apply);
      host.addEventListener('click', event => {
        if (UI.toggleModels(event)) return;
        const pin = event.target.closest('[data-plan-pin]');
        if (pin) {
          const slug = pin.dataset.planPin;
          pins = pins.includes(slug) ? pins.filter(id => id !== slug) : [slug,...pins];
          Directory.writePins(root.localStorage,pins); apply();
          [...host.querySelectorAll('[data-plan-pin]')].find(button => button.dataset.planPin === slug)?.focus({preventScroll:true});
          return;
        }
        const header = event.target.closest('[data-plan-sort]');
        if (header) {
          const key = header.dataset.planSort;
          sort = Directory.cycleSort(sort,key); apply();
        }
      });
      host.querySelector('[data-plan-columns]').addEventListener('change', event => {
        host.classList.toggle('show-all-columns', event.target.checked); modelRows.refresh();
      });
      root.CodingPlanToolPage.filters({context,config},'plans',(next,meta) => {
        const key = JSON.stringify([next, context.modelGroups]);
        if (meta.source === 'catalog' && key === lastFilterKey) return;
        lastFilterKey = key;
        state = next;
        if (meta.source === 'reset') { search.value = ''; sort = {key:'platformOrder',direction:'asc'}; }
        apply();
      });
      const footer = document.querySelector('#toolFilters .filter-state-footer');
      const controls = document.createElement('div'); controls.className = 'plan-sort-controls';
      controls.innerHTML = `<label data-select-fallback>排序 <select id="planSort" aria-label="套餐排序">${Directory.sortOptions.map(([key,label]) => `<option value="${key}">${esc(label)}</option>`).join('')}</select></label><button type="button" class="ui-icon-button ui-icon-button--outlined" data-plan-direction></button>`;
      footer.insertBefore(controls,footer.querySelector('.filter-state-actions'));
      sortSelect = controls.querySelector('select'); directionButton = controls.querySelector('[data-plan-direction]');
      sortPicker = root.CodingPlanSingleSelect.mount(sortSelect,'排序');
      sortSelect.addEventListener('input', () => {
        sort = {key:sortSelect.value,direction:['monthlyToken','rating'].includes(sortSelect.value) ? 'desc' : 'asc'}; apply();
      });
      directionButton.addEventListener('click', () => { sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'; apply(); });
      root.addEventListener('storage', event => {
        if (event.key === Directory.pinKey || event.key === null) { pins = Directory.readPins(root.localStorage,allPlans); apply(); }
      });
      syncSort();
    }).catch(error => root.CodingPlanToolPage.error(host,error.message));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(globalThis);
