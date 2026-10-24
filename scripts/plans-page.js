(function (root) {
  'use strict';
  const Filters = root.CodingPlanFilters, Directory = root.PlanDirectory;
  const UI = root.CodingPlanUI, esc = UI.escapeHtml, Numbers = root.NumberDisplay;
  const money = (plan, field) => {
    const value = Directory.priceValue(plan, field);
    return Numbers.monthlyFee(value, plan.currency || '¥', '未知');
  };
  const requests = (plan, field) => {
    const value = plan.requestQuota?.[field];
    if (value === 'unlimited') return '无限制';
    if (Numbers.finite(value) === null) return '未知';
    return (field === 'monthly' ? Numbers.tokens : Numbers.count)(value);
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
      let sort = {key:'platformOrder', direction:'asc'}, sortPicker, sortSelect, directionButton, lastFilterKey, featuredOnly = false;
      const Url = root.CodingPlanFilterUrl, urlSchema = {
        query:Url.text('q'), key:Url.choice('sort', Directory.sortOptions.map(([key]) => key), 'platformOrder'),
        direction:Url.choice('direction', ['asc','desc'], 'asc')
      };
      const saved = Url.read(urlSchema);
      search.value = saved.query || ''; sort = {key:saved.key || 'platformOrder', direction:saved.direction || 'asc'};
      const tableBody = host.querySelector('[data-plan-body]'), count = host.querySelector('[data-plan-count]');
      const expandedQuotas = new Set(), expandedNotes = new Set();
      const quotaSorts = new Map();
      const tableWrap = tableBody.closest('.tool-table-wrap');
      const resizeQuota = () => host.style.setProperty('--plan-quota-width', `${tableWrap.clientWidth}px`);
      new ResizeObserver(resizeQuota).observe(tableWrap);
      resizeQuota();
      let selection;
      const quotaId = plan => `plan-quota-${encodeURIComponent(plan.slug)}`;
      const quotaContent = plan => root.PlanQuota.render(plan, context, selection.effectiveState, {notesOpen:expandedNotes.has(plan.slug), sort:quotaSorts.get(plan.slug)});
      function syncSort() {
        if (sortSelect) { sortSelect.value = sort.key; sortPicker.sync(); }
        if (directionButton) {
          directionButton.disabled = sort.key === 'platformOrder';
          directionButton.textContent = sort.direction === 'asc' ? '↑' : '↓';
          directionButton.setAttribute('aria-label', `当前${sort.direction === 'asc' ? '升序' : '降序'}，切换为${sort.direction === 'asc' ? '降序' : '升序'}`);
        }
        host.querySelectorAll('.tool-table > thead > tr > th').forEach(th => {
          const active = [...th.querySelectorAll('[data-plan-sort]')].find(button => button.dataset.planSort === sort.key);
          th.setAttribute('aria-sort', active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none');
          th.querySelectorAll('[data-plan-sort]').forEach(button => button.classList.toggle('is-active-sort', button === active));
        });
      }
      function apply() {
        Url.replace(urlSchema, {query:search.value, ...sort});
        selection = Directory.select(allPlans, state, {context, config, query:search.value, sort, pins, featuredOnly});
        search.disabled = featuredOnly;
        search.closest('.tool-result-bar').classList.toggle('is-search-paused', featuredOnly);
        count.textContent = Directory.countLabel(selection); syncSort();
        root.CodingPlanEvents?.results({result_count:selection.visible.length,result_key:JSON.stringify([state,selection.visible.map(x=>x.slug)])});
        tableBody.innerHTML = selection.visible.length ? selection.visible.map(plan => {
          const status = plan.planStatus || 'open';
          const url = UI.sanitizeUrl(plan.action, '');
          const models = UI.prioritizeFeaturedModels(plan.supportedModels || [], context.modelGroups);
          const label = `${plan.platformName} ${plan.name}`;
          const scope = {type:'plan',platformSlug:plan.platformSlug,planSlug:plan.slug};
          const notice = key => root.ChangeNotices.forField(context.changes,scope,key);
          const modelNotice = notice('models');
          const modelList = UI.modelTags(models.map(model => model.name), {maxRows:2,ariaLabel:label+' 支持模型'});
          const title = status !== 'delisted' && url
            ? `<a class="plan-title" data-plan-link="${status}" data-collect-outbound data-collect-platform="${esc(plan.platformSlug)}" data-collect-plan="${esc(plan.slug)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${status === 'open' ? '开通' : '去官网查看'} ${esc(label)}">${esc(label)} ${UI.externalLinkIcon}</a>`
            : `<strong class="plan-title">${esc(label)}</strong>`;
          return `<tr data-plan-row="${esc(plan.slug)}"${selection.pinned.has(plan.slug) ? ' class="is-pinned"' : ''}>
            <td data-plan-col="identity"><div class="plan-identity">${UI.pinButton({pinned:selection.pinned.has(plan.slug), label:`${selection.pinned.has(plan.slug) ? '取消置顶' : '置顶'} ${label}`, attributes:{'data-plan-pin':plan.slug}})}<div class="plan-identity-copy"><div class="plan-identity-line">${title}${selection.featured.has(plan.slug) ? '<span class="platform-featured-badge" data-plan-featured-badge>精选</span>' : ''}${notice('general')}</div><div class="plan-meta">${status === 'open' ? '' : `<span class="tool-tag plan-status" data-plan-status="${status}">${esc(UI.statusLabels[status])}</span>`}${root.EntityData.harnessApiBadge(plan.supportsHarnessApi)}</div></div></div></td>
            <td data-plan-col="rating"><span class="plan-rating" aria-label="${plan.rating > 0 ? esc(plan.rating)+' 星' : '待评定'}">${plan.rating > 0 ? '★ '+Number(plan.rating).toFixed(1) : '待评定'}</span></td>
            ${['firstMonthPrice','monthlyPrice','quarterlyPrice','yearlyPrice'].map(key => `<td data-plan-col="${key}"${key === 'firstMonthPrice' ? '' : ' data-plan-extra'}>${esc(money(plan,key))}${key==='firstMonthPrice'?notice('price'):''}</td>`).join('')}
            <td data-plan-col="models">${modelNotice ? `<div class="plan-models-with-notice">${modelList}${modelNotice}</div>` : modelList}</td>
            <td data-plan-col="monthlyToken" class="monthly-token-cell"><button type="button" class="plan-quota-toggle" data-plan-quota="${esc(plan.slug)}" aria-expanded="${expandedQuotas.has(plan.slug)}" aria-controls="${quotaId(plan)}" aria-label="${esc(label)} 额度明细"><span>${esc(Filters.formatMonthlyTokens(plan,selection.effectiveState))}</span></button>${notice('quota')}</td>
            ${['fiveHours','weekly','monthly'].map(key => `<td data-plan-col="requestQuota.${key}" data-plan-extra>${esc(requests(plan,key))}</td>`).join('')}
            <td data-plan-col="benefits" data-plan-extra>${chips(plan.benefits)}</td><td class="plan-note" data-plan-col="note">${esc(plan.note || '')}</td>
          </tr><tr class="plan-quota-row" data-plan-quota-row="${esc(plan.slug)}"${expandedQuotas.has(plan.slug) ? '' : ' hidden'}><td colspan="${host.classList.contains('show-all-columns') ? 13 : 6}"><section class="plan-quota-panel" id="${quotaId(plan)}" aria-label="${esc(label)} 额度明细">${expandedQuotas.has(plan.slug) ? quotaContent(plan) : ''}</section></td></tr>`;
        }).join('') : `<tr><td colspan="13"><div class="tool-empty">${featuredOnly ? '暂无符合精选范围的套餐，可关闭“显示精选”查看其他套餐。' : '没有匹配套餐，试着清空搜索或减少筛选条件。'}</div></td></tr>`;
        modelRows.refresh(); host.dataset.mounted = '1';
      }
      search.disabled = false; search.addEventListener('input', apply);
      host.addEventListener('click', event => {
        if (UI.toggleModels(event)) return;
        const quotaSort = event.target.closest('[data-plan-quota-sort]');
        if (quotaSort) {
          const panel = quotaSort.closest('.plan-quota-panel');
          const slug = panel.closest('[data-plan-quota-row]').dataset.planQuotaRow;
          const key = quotaSort.dataset.planQuotaSort;
          const next = root.PlanQuota.cycleSort(quotaSorts.get(slug), key);
          if (next) quotaSorts.set(slug, next); else quotaSorts.delete(slug);
          panel.innerHTML = quotaContent(allPlans.find(plan => plan.slug === slug));
          panel.querySelector(`[data-plan-quota-sort="${key}"]`)?.focus({preventScroll:true});
          return;
        }
        const quota = event.target.closest('[data-plan-quota]');
        if (quota) {
          const slug = quota.dataset.planQuota, open = !expandedQuotas.has(slug);
          if (open) expandedQuotas.add(slug); else expandedQuotas.delete(slug);
          quota.setAttribute('aria-expanded', String(open));
          const panel = document.getElementById(quota.getAttribute('aria-controls'));
          panel.closest('tr').hidden = !open;
          if (open) root.CodingPlanEvents?.track('detail_open', {entity_type:'plan_quota',plan_slug:slug,placement:'plans'});
          if (open) panel.innerHTML = quotaContent(allPlans.find(plan => plan.slug === slug));
          return;
        }
        const pin = event.target.closest('[data-plan-pin]');
        if (pin) {
          const slug = pin.dataset.planPin;
          pins = pins.includes(slug) ? pins.filter(id => id !== slug) : [slug,...pins];
          Directory.writePins(root.localStorage,pins); apply();
          root.CodingPlanEvents?.track('pin_change', {entity_type:'plan',entity_slug:slug,pinned:pins.includes(slug),placement:'plans'});
          [...host.querySelectorAll('[data-plan-pin]')].find(button => button.dataset.planPin === slug)?.focus({preventScroll:true});
          return;
        }
        const header = event.target.closest('[data-plan-sort]');
        if (header) {
          const key = header.dataset.planSort;
          sort = Directory.cycleSort(sort,key); apply();
        }
      });
      host.addEventListener('toggle', event => {
        const slug = event.target.dataset?.planQuotaNotes;
        if (slug) { if (event.target.open) expandedNotes.add(slug); else expandedNotes.delete(slug); }
      }, true);
      host.querySelector('[data-plan-columns]').addEventListener('change', event => {
        host.classList.toggle('show-all-columns', event.target.checked); modelRows.refresh();
        host.querySelectorAll('[data-plan-quota-row] > td').forEach(cell => cell.colSpan = event.target.checked ? 13 : 6);
      });
      root.CodingPlanToolPage.filters({context,config},'plans',(next,meta) => {
        const key = JSON.stringify([next, meta.featuredOnly, context.modelGroups, context.featuredPlatformSlugs]);
        if (meta.source === 'catalog' && key === lastFilterKey) return;
        lastFilterKey = key;
        state = next;
        featuredOnly = !!meta.featuredOnly;
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
