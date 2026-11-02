(function (root) {
  'use strict';
  const Filters = root.CodingPlanFilters, Directory = root.PlanDirectory;
  const UI = root.CodingPlanUI;
  function boot() {
    const host = document.getElementById('plansPage');
    if (!host || !Filters || !Directory || !root.EntityData) return;
    const modelRows = UI.observeModelTagRows(host);
    root.CodingPlanToolPage.load().then(({context, config}) => {
      const allPlans = root.EntityData.buildPlanCatalog(context).filter(plan => plan.billingMode === 'subscription');
      const search = host.querySelector('[data-plan-search]');
      let state = Filters.createDefaultState(config, {mode:'full'}), pins = Directory.readPins(root.localStorage, allPlans);
      let sort = {key:'platformOrder', direction:'asc'}, lastFilterKey, featuredOnly = false;
      const Url = root.CodingPlanFilterUrl, urlSchema = {
        query:Url.text('q'), key:Url.choice('sort', Directory.sortOptions.map(([key]) => key), 'platformOrder'),
        direction:Url.choice('direction', ['asc','desc'], 'asc')
      };
      const saved = Url.read(urlSchema);
      search.value = saved.query || ''; sort = {key:saved.key || 'platformOrder', direction:saved.direction || 'asc'};
      const tableBody = host.querySelector('[data-plan-body]'), count = host.querySelector('[data-plan-count]');
      const expandedQuotas = new Set(), expandedNotes = new Set();
      const expandedPlanNotes = new Set([...host.querySelectorAll('[data-plan-note][open]')].map(note => note.dataset.planNote));
      const quotaSorts = new Map();
      const tableWrap = tableBody.closest('.tool-table-wrap');
      const resizeQuota = () => host.style.setProperty('--plan-quota-width', `${tableWrap.clientWidth}px`);
      new ResizeObserver(resizeQuota).observe(tableWrap);
      resizeQuota();
      let selection;
      const quotaContent = plan => root.PlanQuota.render(plan, context, selection.effectiveState, {notesOpen:expandedNotes.has(plan.slug), sort:quotaSorts.get(plan.slug)});
      function syncSort() {
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
        tableBody.innerHTML = selection.visible.length ? root.PlanTable.rowsHtml(selection, context, {expandedQuotas, expandedPlanNotes, quotaContent, showAllColumns:host.classList.contains('show-all-columns')}) : `<tr><td colspan="13"><div class="tool-empty">${featuredOnly ? '暂无符合精选范围的套餐，可关闭“显示精选”查看其他套餐。' : '没有匹配套餐，试着清空搜索或减少筛选条件。'}</div></td></tr>`;
        root.StaticContent?.ready(host); modelRows.refresh(); host.dataset.mounted = '1';
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
        const planNote = event.target.dataset?.planNote;
        if (planNote) { if (event.target.open) expandedPlanNotes.add(planNote); else expandedPlanNotes.delete(planNote); }
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
      root.CodingPlanToolPage.mountSearch(search, count);
      syncSort();
      root.CodingPlanToolPage.mountDirectoryFilters('plans', search, count);
    }).catch(error => root.CodingPlanToolPage.error(host,error.message, {preserveContent:true}));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(globalThis);
