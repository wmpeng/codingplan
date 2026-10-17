(function (root) {
  'use strict';
  function mount(select, label) {
    const UI = root.CodingPlanUI, picker = document.createElement('details');
    picker.className = 'filter-picker single-select-picker'; picker.id = select.id + 'Picker';
    picker.innerHTML = `<summary aria-label="${UI.escapeHtml(label)}" aria-haspopup="listbox" aria-controls="${select.id}Options"><span>${UI.escapeHtml(label)}</span><span data-select-value></span></summary><div id="${select.id}Options" class="filter-picker-menu" role="listbox" aria-label="${UI.escapeHtml(label)}">${[...select.options].map(option => `<button type="button" role="option" aria-label="${UI.escapeHtml(option.text)}" data-select-value="${UI.escapeHtml(option.value)}" tabindex="-1">${UI.escapeHtml(option.text)}</button>`).join('')}</div>`;
    const fallback = select.closest('[data-select-fallback]') || select;
    fallback.before(picker); fallback.hidden = true;
    const summary = picker.querySelector('summary'), menu = picker.querySelector('[role="listbox"]');
    const options = [...menu.querySelectorAll('[role="option"]')];
    function close(focus = false) { picker.open = false; if (focus) summary.focus({preventScroll:true}); }
    function sync() {
      summary.querySelector('[data-select-value]').textContent = select.selectedOptions[0]?.text || '';
      options.forEach(option => { const selected = option.dataset.selectValue === select.value; option.setAttribute('aria-selected', String(selected)); option.tabIndex = selected ? 0 : -1; });
    }
    function position() {
      if (!picker.open) return;
      const view = root.visualViewport, left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
      const width = view?.width || innerWidth, height = view?.height || innerHeight;
      const anchor = summary.getBoundingClientRect(), header = document.querySelector('.site-header')?.getBoundingClientRect();
      const minTop = Math.max(top + 8, (header?.bottom || 0) + 8), panelWidth = Math.min(248, width - 28);
      Object.assign(menu.style, {position:'fixed', width:panelWidth+'px', minWidth:'0', right:'auto', bottom:'auto', maxHeight:Math.max(80, top + height - minTop - 14)+'px'});
      menu.style.left = Math.max(left + 14, Math.min(anchor.left, left + width - panelWidth - 14))+'px';
      menu.style.top = Math.max(minTop, Math.min(anchor.bottom + 6, top + height - menu.getBoundingClientRect().height - 14))+'px';
    }
    picker.addEventListener('toggle', () => {
      if (!picker.open) return;
      document.querySelectorAll('.single-select-picker[open]').forEach(other => { if (other !== picker) other.open = false; }); position();
    });
    summary.addEventListener('keydown', event => {
      if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
      event.preventDefault(); picker.open = true; position();
      (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0]).focus();
    });
    menu.addEventListener('click', event => {
      const option = event.target.closest('[role="option"]'); if (!option) return;
      select.value = option.dataset.selectValue; sync(); close(true); select.dispatchEvent(new Event('input', {bubbles:true}));
    });
    menu.addEventListener('keydown', event => {
      const index = options.indexOf(document.activeElement); let next;
      if (event.key === 'ArrowDown') next = (index + 1) % options.length;
      if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      if (next !== undefined) { event.preventDefault(); options.forEach((option, index) => { option.tabIndex = index === next ? 0 : -1; }); options[next].focus(); }
    });
    document.addEventListener('focusin', event => { if (!picker.contains(event.target)) close(); });
    document.addEventListener('click', event => { if (!picker.contains(event.target)) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && picker.open) { event.preventDefault(); close(true); } });
    root.addEventListener('resize', position); root.addEventListener('scroll', position, {passive:true}); root.visualViewport?.addEventListener('resize', position);
    select.addEventListener('input', sync); sync();
    return {sync, close};
  }
  root.CodingPlanSingleSelect = {mount};
})(globalThis);
