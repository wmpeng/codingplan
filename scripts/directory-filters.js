(function (root) {
  'use strict';

  function mount(host, search, count, {controls, pausedFields = null} = {}) {
    const surface = host.matches('.filter-state-bar') ? host : host.querySelector('.filter-state-bar');
    const grid = host.querySelector('.filter-state-grid');
    const footer = host.querySelector('.filter-state-footer');
    const searchGroup = search.closest('.filter-result-search');
    const reset = host.querySelector('[data-filter-action="restore-defaults"], [data-filter-action="reset"]');
    const actions = reset.parentElement;
    const header = document.querySelector('.site-header');
    const sentinel = document.createElement('div');
    const spacer = document.createElement('div'); spacer.className = 'directory-filter-spacer';
    host.before(sentinel); host.after(spacer);

    const toolbar = document.createElement('div');
    toolbar.className = 'directory-filter-toolbar';
    const filters = document.createElement('div');
    filters.className = 'directory-filter-group'; filters.setAttribute('aria-label', '筛选');
    const display = document.createElement('div');
    display.className = 'directory-display-group'; display.setAttribute('aria-label', '展示');
    const divider = document.createElement('span');
    divider.className = 'directory-filter-divider'; divider.setAttribute('aria-hidden', 'true');
    const utility = document.createElement('div');
    utility.className = 'directory-filter-utility';
    const entries = [];
    if (pausedFields) {
      surface.prepend(grid);
      pausedFields.classList.add('directory-filter-fields'); filters.append(pausedFields);
    }
    count.dataset.directoryResultCount = '';
    sentinel.parentElement.classList.add('directory-filter-region');
    let compact = false, stuck = false, enabled = true, frame, fullHeight = 0, layoutSignature = '';
    let openEntry = null, fitSignature = '';
    const compactWidths = new Map(), originalWidths = new Map();

    function button(label, className, icon) {
      const el = document.createElement('button'); el.type = 'button';
      el.className = className; el.setAttribute('aria-label', label); el.title = label;
      el.innerHTML = icon; return el;
    }
    const searchLabel = search.getAttribute('aria-label') || search.placeholder || '搜索';
    const searchButton = button(searchLabel, 'ui-icon-button directory-search-toggle',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>');
    const searchMenu = document.createElement('div');
    searchMenu.className = 'filter-picker-menu tool-result-bar directory-control-menu';
    searchMenu.id = 'directorySearchMenu'; searchMenu.hidden = true;
    searchButton.setAttribute('aria-controls', searchMenu.id);
    searchButton.setAttribute('aria-expanded', 'false');
    searchButton.setAttribute('aria-haspopup', 'true');
    const toggle = button('收起筛选与展示设置', 'tool-button directory-filter-toggle',
      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 5 4 4 4-4M5 10l4 4 4-4"/></svg><span>收起</span>');
    toggle.setAttribute('aria-controls', 'directoryFilterControls');
    grid.id = 'directoryFilterControls';
    const resetIcon = document.createElement('span'); resetIcon.className = 'directory-reset-icon';
    resetIcon.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7a6.5 6.5 0 1 1-.3 5M4 3v4h4"/></svg>';
    const resetText = document.createElement('span'); resetText.className = 'directory-reset-text';
    resetText.textContent = reset.textContent; reset.replaceChildren(resetIcon, resetText);
    reset.setAttribute('aria-label', '重置筛选');

    function add(spec) {
      const {label, picker:isPicker = false} = spec;
      const group = spec.display ? display : spec.paused && pausedFields ? pausedFields : filters;
      const control = spec.element || host.querySelector(spec.selector);
      let el = control, trigger, menu;
      if (isPicker) {
        trigger = control.querySelector('summary'); menu = control.querySelector('.filter-picker-menu');
        trigger.querySelector('[data-select-value]')?.classList.add('directory-picker-value');
      } else {
        el = document.createElement('div'); el.className = 'directory-filter-control';
        trigger = button(label, 'directory-control-trigger', '');
        const text = document.createElement('span'); text.textContent = label; trigger.append(text);
        menu = document.createElement('div'); menu.className = 'filter-picker-menu directory-control-menu';
        menu.id = 'directoryControl' + entries.length; trigger.setAttribute('aria-controls', menu.id);
        trigger.setAttribute('aria-haspopup', 'true'); menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', label+'设置');
        trigger.setAttribute('aria-expanded', 'false'); menu.append(control); el.append(trigger, menu);
      }
      el.classList.add('directory-filter-entry');
      const dot = document.createElement('i'); dot.className = 'directory-filter-dot'; dot.setAttribute('aria-hidden', 'true');
      trigger.querySelector('span').classList.add('directory-control-label');
      trigger.querySelector('span').append(dot);
      if (!isPicker) {
        control.querySelectorAll(':scope > span, summary > span:first-child, label > span').forEach(span => {
          if (span.textContent.trim() && !span.querySelector('input,button')) span.classList.add('directory-control-label');
        });
        const labels = control.matches('label') ? [control] : [...control.querySelectorAll('label')];
        labels.forEach(label => [...label.childNodes].forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const text = document.createElement('span'); text.className = 'directory-control-label';
            node.replaceWith(text); text.append(node);
          }
        }));
      }
      const entry = {el, control, trigger, menu, label, isPicker, spec}; entries.push(entry); group.append(el);
      if (!isPicker) trigger.addEventListener('click', () => showMenu(entry, openEntry !== entry));
      else control.addEventListener('toggle', () => { if (control.open) closeMenus(entry); });
      return entry;
    }
    controls.forEach(add);
    divider.hidden = !entries.some(entry => entry.spec.display);
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
      Object.assign(entry.menu.style, {position:'fixed', width:entry === searchEntry ? '340px' : 'max-content', maxWidth:(width-28)+'px', minWidth:'0', right:'auto', bottom:'auto', maxHeight:Math.max(80, top + height - minTop - 14)+'px'});
      const panelWidth = Math.min(entry.menu.getBoundingClientRect().width, width - 28);
      entry.menu.style.width = panelWidth+'px';
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

    function reserveHeight() {
      spacer.style.height = stuck ? Math.max(0, fullHeight-host.getBoundingClientRect().height)+'px' : '0px';
    }
    function setOriginal(entry, original) {
      entry.original = original;
      entry.el.classList.toggle('directory-filter-original', original);
      if (!entry.isPicker) {
        entry.menu.classList.toggle('filter-picker-menu', compact && !original);
        entry.menu.hidden = compact && !original && openEntry !== entry;
      }
    }
    function setCompact(value) {
      if (value === compact && host.dataset.directoryFiltersMounted) return;
      closeMenus();
      compact = value; host.classList.toggle('directory-filters-compact', compact);
      fitSignature = '';
      toggle.setAttribute('aria-expanded', String(!compact));
      toggle.setAttribute('aria-label', compact ? '展开筛选与展示设置' : '收起筛选与展示设置');
      toggle.title = compact ? '展开筛选与展示设置' : '收起筛选与展示设置';
      toggle.querySelector('span').textContent = compact ? '展开' : '收起';
      if (compact) {
        toolbar.prepend(filters, display); toolbar.append(utility); utility.insertBefore(count, actions); utility.append(actions, toggle);
        searchMenu.append(search);
      } else {
        grid.append(filters, divider, display); searchGroup.append(search, count); footer.append(utility);
        utility.append(actions, toggle);
      }
      for (const entry of entries) {
        setOriginal(entry, !compact);
        if (!entry.isPicker) entry.trigger.setAttribute('aria-expanded', 'false');
      }
      for (const entry of entries) entry.el.classList.remove('directory-filter-overflow');
      filters.hidden = display.hidden = false;
      reserveHeight();
      schedule();
    }
    toggle.addEventListener('click', () => {
      if (!stuck) return;
      // Move focus before controls are moved into hidden menus.
      toggle.focus({preventScroll:true}); setCompact(!compact);
    });

    function syncState() {
      entries.forEach(entry => {
        const [active, value] = entry.spec.read(entry.control);
        entry.el.dataset.active = String(!!active);
        const title = entry.label + '：' + value;
        entry.trigger.title = title; entry.trigger.setAttribute('aria-label', title);
        if (!entry.isPicker) entry.trigger.disabled = entry.control.inert || entry.control.matches('fieldset:disabled');
      });
      searchButton.classList.toggle('is-active', !!search.value);
      searchButton.title = search.value ? '搜索：'+search.value : searchLabel;
      searchButton.disabled = search.disabled;
      searchGroup.classList.toggle('is-search-paused', search.disabled);
      searchMenu.classList.toggle('is-search-paused', search.disabled);
    }

    function fit() {
      // Keep an active editor or open menu in place while adapting its neighbours.
      const locked = new Set(entries.filter(entry => entry.el.contains(document.activeElement) || entry === openEntry || entry.control.open));
      const signature = compact ? [toolbar.clientWidth, utility.getBoundingClientRect().width, getComputedStyle(toolbar).font,
        ...entries.map(entry => [entry.trigger.title, locked.has(entry) ? String(entry.original) : '', entry.control.open])].join('|') : '';
      if (signature && signature === fitSignature) return;
      fitSignature = signature;
      for (const entry of entries) entry.el.classList.remove('directory-filter-overflow');
      filters.hidden = display.hidden = false; display.classList.remove('directory-display-no-divider');
      if (!compact) return;
      // Measure each form in a batch. Focused controls retain their current form.
      entries.forEach(entry => { if (!locked.has(entry)) setOriginal(entry, false); });
      entries.forEach(entry => {
        if (!locked.has(entry) || !entry.original) compactWidths.set(entry, entry.el.getBoundingClientRect().width);
      });
      entries.forEach(entry => { if (!locked.has(entry)) setOriginal(entry, true); });
      entries.forEach(entry => {
        if (!locked.has(entry) || entry.original) originalWidths.set(entry, entry.el.getBoundingClientRect().width);
      });
      const filterEntries = entries.filter(entry => !entry.spec.display), displayEntries = entries.filter(entry => entry.spec.display);
      const originals = new Set(entries.filter(entry => locked.has(entry) ? entry.original : originalWidths.get(entry) <= compactWidths.get(entry)));
      const sizes = new Map(entries.map(entry => [entry, (originals.has(entry) ? originalWidths : compactWidths).get(entry)]));
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
        for (let i = 0; i < Math.max(filterEntries.length, displayEntries.length); i++) {
          if (displayEntries[i] && chosenDisplay.length === i && widthFor(chosenFilters, [...chosenDisplay, displayEntries[i]]) <= available) chosenDisplay.push(displayEntries[i]);
          if (filterEntries[i] && chosenFilters.length === i && widthFor([...chosenFilters, filterEntries[i]], chosenDisplay) <= available) chosenFilters.push(filterEntries[i]);
        }
      }
      const chosen = new Set([...chosenFilters, ...chosenDisplay]);
      // Avoid hiding a keyboard user or an open picker during a resize.
      if (entries.some(entry => !chosen.has(entry) && locked.has(entry))) { setCompact(false); return; }
      // Cover entries first, then spend the remaining width in the same priority order.
      for (let i = 0; i < Math.max(filterEntries.length, displayEntries.length); i++) {
        for (const entry of [displayEntries[i], filterEntries[i]]) {
          if (!entry || !chosen.has(entry) || originals.has(entry) || locked.has(entry)) continue;
          const previous = sizes.get(entry);
          sizes.set(entry, originalWidths.get(entry));
          if (widthFor(chosenFilters, chosenDisplay) <= available) originals.add(entry);
          else sizes.set(entry, previous);
        }
      }
      entries.forEach(entry => {
        setOriginal(entry, chosen.has(entry) && originals.has(entry));
        entry.el.classList.toggle('directory-filter-overflow', !chosen.has(entry));
      });
      filters.hidden = !chosenFilters.length; display.hidden = !chosenDisplay.length;
      display.classList.toggle('directory-display-no-divider', !chosenFilters.length);
      const hidden = entries.filter(entry => !chosen.has(entry));
      toggle.title = hidden.length ? '展开全部：'+hidden.map(entry => entry.label).join('、') : '展开筛选与展示设置';
    }
    function update() {
      const top = (header?.getBoundingClientRect().height || 0) + 8;
      host.style.setProperty('--directory-filter-top', top+'px');
      const viewHeight = root.visualViewport?.height || root.innerHeight;
      enabled = viewHeight - top >= 224;
      const layout = [host.clientWidth, top, getComputedStyle(host).font].join('|');
      const editing = entries.some(entry => entry.el.contains(document.activeElement) || entry === openEntry || entry.control.open);
      if (stuck && layout !== layoutSignature && !editing) {
        // A narrower layout may make the original card taller than the scroll distance.
        const wasCompact = compact;
        host.classList.remove('directory-filters-stuck', 'directory-sticky-filters');
        toggle.hidden = true; setCompact(false);
        fullHeight = host.getBoundingClientRect().height;
        if (wasCompact) setCompact(true);
        host.classList.add('directory-filters-stuck');
      }
      // Defer a full-card measurement until the active editor/menu is released.
      if (!stuck || !editing) layoutSignature = layout;
      if (!stuck && !compact) fullHeight = host.getBoundingClientRect().height;
      // Keep normal flow until the entire original card has passed the header.
      const nextStuck = enabled && sentinel.getBoundingClientRect().top + fullHeight <= top;
      host.classList.toggle('directory-sticky-filters', nextStuck);
      toggle.hidden = !nextStuck;
      if (nextStuck !== stuck) {
        stuck = nextStuck; host.classList.toggle('directory-filters-stuck', stuck);
        if (stuck && host.contains(document.activeElement)) toggle.focus({preventScroll:true});
        setCompact(stuck);
      }
      if (!enabled && compact) setCompact(false);
      syncState(); fit(); reserveHeight();
      if (openEntry) positionMenu(openEntry);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    host.addEventListener('input', schedule); host.addEventListener('change', schedule); host.addEventListener('click', schedule);
    host.addEventListener('focusin', schedule); host.addEventListener('focusout', schedule);
    root.addEventListener('codingplan:filters-changed', schedule);
    root.addEventListener('resize', schedule); root.addEventListener('scroll', schedule, {passive:true});
    root.visualViewport?.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule); observer.observe(host); if (header) observer.observe(header);
    new MutationObserver(schedule).observe(count, {childList:true, characterData:true, subtree:true});
    document.fonts?.ready.then(() => { fitSignature = ''; layoutSignature = ''; schedule(); });
    document.addEventListener('click', event => { if (openEntry && !openEntry.el.contains(event.target) && !openEntry.menu.contains(event.target)) closeMenus(); });
    host.addEventListener('keydown', event => {
      if (event.key === 'Escape' && openEntry) { event.preventDefault(); closeMenus(null, true); }
    });
    document.addEventListener('focusin', event => { if (openEntry && !openEntry.el.contains(event.target) && !openEntry.menu.contains(event.target)) closeMenus(); });
    host.classList.add('directory-filters'); setCompact(false);
    host.dataset.directoryFiltersMounted = '1'; update();
  }
  root.DirectoryFilters = {mount};
})(globalThis);
