(function (root) {
  'use strict';
  const mounted = new WeakMap();
  let nextId = 0;
  function mount(select, label, {showLabel = true} = {}) {
    if (mounted.has(select)) return mounted.get(select);
    if (!select.id) select.id = `singleSelect${++nextId}`;
    const events = new AbortController();
    const listen = (target, type, callback, options = {}) => target?.addEventListener(type, callback, {...options, signal:events.signal});
    const UI = root.CodingPlanUI, picker = document.createElement('details');
    picker.className = 'filter-picker single-select-picker'; picker.id = select.id + 'Picker';
    picker.innerHTML = `<summary aria-label="${UI.escapeHtml(label)}" aria-haspopup="listbox" aria-controls="${select.id}Options">${showLabel ? `<span>${UI.escapeHtml(label)}</span>` : ''}<span data-select-value></span></summary><div id="${select.id}Options" class="filter-picker-menu" role="listbox" aria-label="${UI.escapeHtml(label)}">${[...select.options].map(option => `<button type="button" role="option" aria-label="${UI.escapeHtml(option.text)}" data-select-value="${UI.escapeHtml(option.value)}" tabindex="-1" ${option.disabled ? 'disabled' : ''}>${UI.escapeHtml(option.text)}</button>`).join('')}</div>`;
    const fallback = select.closest('[data-select-fallback]') || select;
    const fallbackHidden = fallback.hidden;
    fallback.before(picker); fallback.hidden = true;
    const summary = picker.querySelector('summary'), menu = picker.querySelector('[role="listbox"]');
    const options = [...menu.querySelectorAll('[role="option"]')];
    function close(focus = false) { picker.open = false; if (focus) summary.focus({preventScroll:true}); }
    function sync() {
      picker.inert = select.disabled;
      summary.setAttribute('aria-disabled', String(select.disabled));
      summary.setAttribute('aria-expanded', String(picker.open));
      summary.title = select.title;
      if (select.hasAttribute('aria-describedby')) summary.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
      summary.querySelector('[data-select-value]').textContent = select.selectedOptions[0]?.text || '';
      options.forEach(option => { const selected = option.dataset.selectValue === select.value; option.setAttribute('aria-selected', String(selected)); option.tabIndex = selected ? 0 : -1; });
    }
    function position() {
      if (!picker.open) return;
      const view = root.visualViewport, left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
      const width = view?.width || innerWidth, height = view?.height || innerHeight;
      const anchor = summary.getBoundingClientRect(), header = document.querySelector('.site-header')?.getBoundingClientRect();
      const minTop = Math.max(top + 8, (header?.bottom || 0) + 8), panelWidth = Math.min(Math.max(248, anchor.width), 360, width - 28);
      Object.assign(menu.style, {position:'fixed', width:panelWidth+'px', minWidth:'0', right:'auto', bottom:'auto', maxHeight:Math.max(80, top + height - minTop - 14)+'px'});
      const point = UI.anchoredPanelPosition({anchor, panel:{width:panelWidth, height:menu.getBoundingClientRect().height}, viewport:{left,top,width,height}, minTop, gap:6});
      menu.style.left = point.left + 'px'; menu.style.top = point.top + 'px';
    }
    listen(picker, 'toggle', () => {
      summary.setAttribute('aria-expanded', String(picker.open));
      if (!picker.open) return;
      document.querySelectorAll('.single-select-picker[open]').forEach(other => { if (other !== picker) other.open = false; }); position();
    });
    listen(summary, 'click', event => {
      event.preventDefault(); picker.open = !picker.open; if (picker.open) position();
    });
    listen(summary, 'keydown', event => {
      if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
      event.preventDefault(); picker.open = true; position();
      (options.find(option => !option.disabled && option.getAttribute('aria-selected') === 'true') || options.find(option => !option.disabled))?.focus();
    });
    listen(menu, 'click', event => {
      const option = event.target.closest('[role="option"]'); if (!option || option.disabled) return;
      select.value = option.dataset.selectValue; sync(); close(true);
      select.dispatchEvent(new Event('input', {bubbles:true}));
      select.dispatchEvent(new Event('change', {bubbles:true}));
    });
    listen(menu, 'keydown', event => {
      const enabled = options.filter(option => !option.disabled);
      if (!enabled.length) return;
      const index = enabled.indexOf(document.activeElement); let next;
      if (event.key === 'ArrowDown') next = (index + 1) % enabled.length;
      if (event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = enabled.length - 1;
      if (next !== undefined) { event.preventDefault(); options.forEach(option => { option.tabIndex = option === enabled[next] ? 0 : -1; }); enabled[next].focus(); }
    });
    listen(document, 'focusin', event => { if (!picker.contains(event.target)) close(); });
    listen(document, 'click', event => { if (!picker.contains(event.target)) close(); });
    listen(document, 'keydown', event => { if (event.key === 'Escape' && picker.open) { event.preventDefault(); close(true); } });
    listen(root, 'resize', position); listen(root, 'scroll', position, {passive:true}); listen(root.visualViewport, 'resize', position);
    listen(select, 'input', sync); sync();
    let destroyed = false;
    const controller = {sync, close, focus() { summary.focus({preventScroll:true}); }, destroy() {
      if (destroyed) return;
      destroyed = true;
      close(); events.abort(); picker.remove(); fallback.hidden = fallbackHidden; mounted.delete(select);
    }};
    mounted.set(select, controller);
    return controller;
  }
  function mountAll(host) {
    const controls = [...host.querySelectorAll('select[data-custom-select]')].map(select => mount(select, select.getAttribute('aria-label'), {showLabel:false}));
    return {sync() { controls.forEach(control => control.sync()); }, destroy() { controls.forEach(control => control.destroy()); }};
  }
  root.CodingPlanSingleSelect = {mount, mountAll};
})(globalThis);
