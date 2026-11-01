(function (root) {
  'use strict';

  function mount(host, search, count) {
    const surface = host.querySelector('.filter-state-bar');
    const grid = host.querySelector('.filter-state-grid');
    const footer = host.querySelector('.filter-state-footer');
    const searchGroup = search.closest('.filter-result-search');
    const reset = host.querySelector('[data-filter-action="restore-defaults"]');
    const actions = reset.parentElement;
    const header = document.querySelector('.site-header');
    const sentinel = document.createElement('div');
    host.before(sentinel);

    const toolbar = document.createElement('div');
    toolbar.className = 'pricing-filter-toolbar';
    const filters = document.createElement('div');
    filters.className = 'pricing-filter-group'; filters.setAttribute('aria-label', '筛选');
    const display = document.createElement('div');
    display.className = 'pricing-display-group'; display.setAttribute('aria-label', '展示');
    const divider = document.createElement('span');
    divider.className = 'pricing-filter-divider'; divider.setAttribute('aria-hidden', 'true');
    const utility = document.createElement('div');
    utility.className = 'pricing-filter-utility';
    const entries = [];
    let compact = false, stuck = false, enabled = true, frame;
    let openEntry = null, fitSignature = '';

    function button(label, className, icon) {
      const el = document.createElement('button'); el.type = 'button';
      el.className = className; el.setAttribute('aria-label', label); el.title = label;
      el.innerHTML = icon; return el;
    }
    const searchButton = button('搜索平台、套餐或模型', 'ui-icon-button pricing-search-toggle',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>');
    const searchMenu = document.createElement('div');
    searchMenu.className = 'filter-picker-menu pricing-control-menu';
    searchMenu.id = 'pricingSearchMenu'; searchMenu.hidden = true;
    searchButton.setAttribute('aria-controls', searchMenu.id);
    searchButton.setAttribute('aria-expanded', 'false');
    searchButton.setAttribute('aria-haspopup', 'true');
    const toggle = button('收起筛选与展示设置', 'tool-button pricing-filter-toggle',
      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 5 4 4 4-4M5 10l4 4 4-4"/></svg><span>收起</span>');
    toggle.setAttribute('aria-controls', 'pricingFilterControls');
    grid.id = 'pricingFilterControls';
    const resetIcon = document.createElement('span'); resetIcon.className = 'pricing-reset-icon';
    resetIcon.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7a6.5 6.5 0 1 1-.3 5M4 3v4h4"/></svg>';
    const resetText = document.createElement('span'); resetText.className = 'pricing-reset-text';
    resetText.textContent = reset.textContent; reset.replaceChildren(resetIcon, resetText);
    reset.setAttribute('aria-label', '重置筛选');

    function add(selector, label, group, isPicker = false) {
      const control = grid.querySelector(selector);
      let el = control, trigger, menu;
      if (isPicker) {
        trigger = control.querySelector('summary'); menu = control.querySelector('.filter-picker-menu');
      } else {
        el = document.createElement('div'); el.className = 'pricing-filter-control';
        trigger = button(label, 'pricing-control-trigger', '');
        const text = document.createElement('span'); text.textContent = label; trigger.append(text);
        menu = document.createElement('div'); menu.className = 'filter-picker-menu pricing-control-menu';
        menu.id = 'pricingControl' + entries.length; trigger.setAttribute('aria-controls', menu.id);
        trigger.setAttribute('aria-haspopup', 'true'); menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', label);
        trigger.setAttribute('aria-expanded', 'false'); menu.append(control); el.append(trigger, menu);
      }
      el.classList.add('pricing-filter-entry');
      const dot = document.createElement('i'); dot.className = 'pricing-filter-dot'; dot.setAttribute('aria-hidden', 'true');
      trigger.querySelector('span').append(dot);
      const entry = {el, control, trigger, menu, label, isPicker}; entries.push(entry); group.append(el);
      if (!isPicker) trigger.addEventListener('click', () => showMenu(entry, openEntry !== entry));
      else control.addEventListener('toggle', () => { if (control.open) closeMenus(entry); });
      return entry;
    }
    add('#homePlatformPicker', '平台', filters, true);
    add('#homeModelPicker', '模型', filters, true);
    add('#homeBudgetPicker', '月预算', filters, true);
    add('#homeTokenPicker', '月 Token 数', filters, true);
    add('#homeStatusPicker', '购买状态', filters, true);
    add('.price-billing-filter', '计费方式', filters);
    add('.pricing-mainland-control', '支持中国大陆', filters);
    add('.usage-color-control', '颜色', display);
    add('.usage-benchmark-control', '评分', display);
    add('.usage-scale-control', '坐标轴', display);
    const searchEntry = {el: utility, trigger: searchButton, menu: searchMenu, label: '搜索'};
    utility.append(searchButton, count, actions, toggle); toolbar.append(filters, display, utility);
    grid.replaceChildren(); surface.prepend(toolbar, searchMenu);

    function closeMenus(except, returnFocus = false) {
      for (const entry of entries) if (entry !== except && entry.isPicker) entry.control.open = false;
      if (openEntry && openEntry !== except) {
        const previous = openEntry; openEntry = null;
        previous.menu.hidden = true; previous.trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus || previous.menu.contains(document.activeElement)) previous.trigger.focus({preventScroll:true});
      }
    }
    function positionMenu(entry) {
      const view = root.visualViewport;
      const left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
      const width = view?.width || root.innerWidth, height = view?.height || root.innerHeight;
      const anchor = entry.trigger.getBoundingClientRect();
      const minTop = Math.max(top + 8, (header?.getBoundingClientRect().bottom || 0) + 8);
      const panelWidth = Math.min(entry === searchEntry ? 340 : 420, width - 28);
      Object.assign(entry.menu.style, {position:'fixed', width:panelWidth+'px', minWidth:'0', right:'auto', bottom:'auto', maxHeight:Math.max(80, top + height - minTop - 14)+'px'});
      entry.menu.style.left = Math.max(left + 14, Math.min(anchor.left, left + width - panelWidth - 14))+'px';
      entry.menu.style.top = Math.max(minTop, Math.min(anchor.bottom + 8, top + height - entry.menu.getBoundingClientRect().height - 14))+'px';
    }
    function showMenu(entry, open) {
      closeMenus(open ? entry : null);
      if (!open || !compact) return;
      openEntry = entry; entry.menu.hidden = false; entry.trigger.setAttribute('aria-expanded', 'true');
      positionMenu(entry); if (entry === searchEntry) search.focus({preventScroll:true});
    }
    searchButton.addEventListener('click', () => showMenu(searchEntry, openEntry !== searchEntry));

    function setCompact(value) {
      if (value === compact && host.dataset.pricingFiltersMounted) return;
      closeMenus();
      compact = value; host.classList.toggle('pricing-filters-compact', compact);
      fitSignature = '';
      toggle.setAttribute('aria-expanded', String(!compact));
      toggle.setAttribute('aria-label', compact ? '展开筛选与展示设置' : '收起筛选与展示设置');
      toggle.querySelector('span').textContent = compact ? '展开' : '收起';
      if (compact) {
        toolbar.prepend(filters, display); toolbar.append(utility); utility.insertBefore(count, actions); utility.append(actions, toggle);
        searchMenu.append(search);
      } else {
        grid.append(filters, divider, display); searchGroup.append(search, count); footer.append(utility);
        utility.append(actions, toggle);
      }
      for (const entry of entries) if (!entry.isPicker) {
        entry.menu.classList.toggle('filter-picker-menu', compact);
        entry.menu.hidden = compact; entry.trigger.setAttribute('aria-expanded', 'false');
      }
      for (const entry of entries) entry.el.classList.remove('pricing-filter-overflow');
      filters.hidden = display.hidden = false;
      schedule();
    }
    toggle.addEventListener('click', () => {
      if (!stuck) return;
      // Move focus before controls are moved into hidden menus.
      toggle.focus({preventScroll:true}); setCompact(!compact);
    });

    function syncState() {
      const state = host.filterController.getState();
      const values = [
        [state.platformSlugs !== null, entries[0].control.querySelector('[data-picker-count]').textContent],
        [state.modelSlugs !== null, entries[1].control.querySelector('[data-picker-count]').textContent],
        [state.apiOnly || state.budgetCny !== null, host.querySelector('[data-budget-label]').textContent],
        [state.monthlyTokenRange !== null, host.querySelector('[data-token-label]').textContent],
        [state.includeDiscontinued || state.excludedPlanStatuses.length > 0, host.querySelector('[data-status-label]').textContent]
      ];
      for (const entry of entries.slice(5)) {
        if (entry === entries[6]) values.push([state.mainlandRequired, state.mainlandRequired ? '开启' : '关闭']);
        else {
          const buttons = [...entry.control.querySelectorAll('button')];
          const selected = buttons.findIndex(el => el.classList.contains('is-active'));
          values.push([selected > 0, buttons[selected]?.textContent || '']);
        }
      }
      entries.forEach((entry, i) => {
        entry.el.dataset.active = String(!!values[i][0]);
        const title = entry.label + '：' + values[i][1];
        entry.trigger.title = title; entry.trigger.setAttribute('aria-label', title);
      });
      searchButton.classList.toggle('is-active', !!search.value);
      searchButton.title = search.value ? '搜索：'+search.value : '搜索平台、套餐或模型';
    }

    function fit() {
      const signature = compact ? [toolbar.clientWidth, utility.getBoundingClientRect().width, getComputedStyle(toolbar).font,
        ...entries.map(entry => entry.el.dataset.active)].join('|') : '';
      if (signature && signature === fitSignature) return;
      fitSignature = signature;
      for (const entry of entries) entry.el.classList.remove('pricing-filter-overflow');
      filters.hidden = display.hidden = false; display.classList.remove('pricing-display-no-divider');
      if (!compact) return;
      // Restore once, measure all entries together, then apply the chosen set together.
      const filterEntries = entries.slice(0, 7), displayEntries = entries.slice(7);
      const sizes = new Map(entries.map(entry => [entry, entry.el.getBoundingClientRect().width]));
      const style = getComputedStyle(toolbar), gap = parseFloat(style.columnGap) || 0;
      const groupGap = parseFloat(getComputedStyle(filters).columnGap) || 0;
      const dividerWidth = 16;
      const available = toolbar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - utility.getBoundingClientRect().width;
      const widthFor = (f, d) => f.reduce((sum, entry) => sum + sizes.get(entry), 0) + d.reduce((sum, entry) => sum + sizes.get(entry), 0)
        + Math.max(0, f.length - 1) * groupGap + Math.max(0, d.length - 1) * groupGap
        + (f.length && d.length ? dividerWidth : 0) + (Number(!!f.length) + Number(!!d.length)) * gap;
      let chosenFilters = filterEntries, chosenDisplay = displayEntries;
      if (widthFor(chosenFilters, chosenDisplay) > available) {
        chosenFilters = []; chosenDisplay = [];
        for (let i = 0; i < filterEntries.length; i++) {
          if (displayEntries[i] && chosenDisplay.length === i && widthFor(chosenFilters, [...chosenDisplay, displayEntries[i]]) <= available) chosenDisplay.push(displayEntries[i]);
          if (chosenFilters.length === i && widthFor([...chosenFilters, filterEntries[i]], chosenDisplay) <= available) chosenFilters.push(filterEntries[i]);
        }
      }
      const chosen = new Set([...chosenFilters, ...chosenDisplay]);
      // Avoid hiding a keyboard user or an open picker during a resize.
      if (entries.some(entry => !chosen.has(entry) && (entry.el.contains(document.activeElement) || entry.control.open))) { setCompact(false); return; }
      entries.forEach(entry => entry.el.classList.toggle('pricing-filter-overflow', !chosen.has(entry)));
      filters.hidden = !chosenFilters.length; display.hidden = !chosenDisplay.length;
      display.classList.toggle('pricing-display-no-divider', !chosenFilters.length);
      const hidden = entries.filter(entry => !chosen.has(entry));
      toggle.title = hidden.length ? '展开全部：'+hidden.map(entry => entry.label).join('、') : '展开筛选与展示设置';
    }
    function update() {
      const top = (header?.getBoundingClientRect().height || 0) + 8;
      host.style.setProperty('--pricing-filter-top', top+'px');
      const viewHeight = root.visualViewport?.height || root.innerHeight;
      enabled = viewHeight - top >= 224;
      host.classList.toggle('pricing-sticky-filters', enabled);
      const nextStuck = enabled && sentinel.getBoundingClientRect().top < top - 1;
      toggle.hidden = !nextStuck;
      if (nextStuck !== stuck) {
        stuck = nextStuck; host.classList.toggle('pricing-filters-stuck', stuck);
        if (stuck && host.contains(document.activeElement)) toggle.focus({preventScroll:true});
        setCompact(stuck);
      }
      if (!enabled && compact) setCompact(false);
      syncState(); fit();
      if (openEntry) positionMenu(openEntry);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    host.addEventListener('input', schedule); host.addEventListener('change', schedule); host.addEventListener('click', schedule);
    root.addEventListener('codingplan:filters-changed', schedule);
    root.addEventListener('resize', schedule); root.addEventListener('scroll', schedule, {passive:true});
    root.visualViewport?.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule); observer.observe(host); if (header) observer.observe(header);
    new MutationObserver(schedule).observe(count, {childList:true, characterData:true, subtree:true});
    document.fonts?.ready.then(() => { fitSignature = ''; schedule(); });
    document.addEventListener('click', event => { if (openEntry && !openEntry.el.contains(event.target) && !openEntry.menu.contains(event.target)) closeMenus(); });
    host.addEventListener('keydown', event => {
      if (event.key === 'Escape' && openEntry) { event.preventDefault(); closeMenus(null, true); }
    });
    document.addEventListener('focusin', event => { if (openEntry && !openEntry.el.contains(event.target) && !openEntry.menu.contains(event.target)) closeMenus(); });
    host.classList.add('pricing-filters'); setCompact(false);
    host.dataset.pricingFiltersMounted = '1'; update();
  }
  root.PricingFilters = {mount};
})(globalThis);
