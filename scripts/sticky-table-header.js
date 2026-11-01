(function () {
  'use strict';
  function mount(host, scroll, table) {
    if (scroll.dataset.stickyHeaderMounted || !table.tHead) return;
    scroll.dataset.stickyHeaderMounted = '1';
    const header = table.tHead;
    const overlay = document.createElement('div');
    overlay.className = 'sticky-table-header';
    overlay.hidden = true;
    const copyTable = table.cloneNode(false);
    copyTable.removeAttribute('id'); copyTable.removeAttribute('data-table');
    const copy = header.cloneNode(true);
    const suffix = '-floating-header';
    copy.querySelectorAll('[id]').forEach(element => { element.id += suffix; });
    copy.querySelectorAll('[aria-controls],[aria-describedby],[popovertarget]').forEach(element => {
      for (const name of ['aria-controls','aria-describedby','popovertarget']) {
        if (element.hasAttribute(name)) element.setAttribute(name, element.getAttribute(name).split(/\s+/).map(id => id + suffix).join(' '));
      }
    });
    copyTable.append(copy); overlay.append(copyTable); scroll.after(overlay);
    let frame = 0, syncing = false;
    function update() {
      frame = 0;
      const nav = document.querySelector('.site-header');
      const filters = document.querySelector('#toolFilters.directory-filters-stuck');
      const top = Math.max(0, nav?.getBoundingClientRect().bottom || 0, filters?.getBoundingClientRect().bottom || 0);
      const area = scroll.getBoundingClientRect(), tableBox = table.getBoundingClientRect();
      const headBox = header.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const visible = area.width > 0 && headBox.height > 0 && headBox.top < top && tableBox.bottom > top + headBox.height && top + headBox.height + 80 < viewportHeight;
      overlay.hidden = !visible;
      if (!visible) return;
      Object.assign(overlay.style, {left: `${area.left}px`, top: `${top}px`, width: `${area.width}px`, height: `${headBox.height}px`});
      copyTable.style.width = `${tableBox.width}px`;
      const originalCells = [...header.rows[0].cells], copyCells = [...copy.rows[0].cells];
      originalCells.forEach((cell, index) => {
        const target = copyCells[index], width = cell.getBoundingClientRect().width;
        target.hidden = cell.hidden; target.className = cell.className;
        const sourceButtons = cell.querySelectorAll('[data-plan-sort]'), copyButtons = target.querySelectorAll('[data-plan-sort]');
        sourceButtons.forEach((button, i) => { if (copyButtons[i]) copyButtons[i].className = button.className; });
        if (cell.hasAttribute('aria-sort')) target.setAttribute('aria-sort', cell.getAttribute('aria-sort'));
        else target.removeAttribute('aria-sort');
        target.style.width = `${width}px`; target.style.minWidth = `${width}px`; target.style.maxWidth = `${width}px`;
      });
      syncing = true; overlay.scrollLeft = scroll.scrollLeft; syncing = false;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroll.addEventListener('scroll', schedule, {passive:true});
    overlay.addEventListener('scroll', () => { if (!syncing) scroll.scrollLeft = overlay.scrollLeft; }, {passive:true});
    overlay.addEventListener('click', event => {
      if (event.target.closest('.ui-help')) return;
      const button = event.target.closest('[data-plan-sort]');
      const price = event.target.closest('[data-table-sort][data-sort-key]');
      if (!button && !price) return;
      event.stopPropagation();
      const cells = [...copy.rows[0].cells], selected = (button || price).closest('th');
      const original = header.rows[0].cells[cells.indexOf(selected)];
      const target = button ? original?.querySelector(`[data-plan-sort="${CSS.escape(button.dataset.planSort)}"]`) : original?.querySelector('button');
      (target || original)?.click(); schedule();
    });
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule, {passive:true});
    window.visualViewport?.addEventListener('resize', schedule);
    document.addEventListener('change', schedule);
    document.addEventListener('click', schedule);
    const observer = new ResizeObserver(schedule); observer.observe(scroll); observer.observe(table); observer.observe(header);
    const filters = document.getElementById('toolFilters'); if (filters) observer.observe(filters);
    new MutationObserver(schedule).observe(header, {subtree:true, attributes:true, childList:true, characterData:true});
    document.fonts?.ready.then(schedule); schedule();
  }
  function start() {
    const host = document.querySelector('#plansPage, #pricingPage');
    if (!host) return;
    const find = () => {
      const scroll = host.querySelector('.tool-table-wrap, .usage-data-card .usage-table-scroll');
      const table = scroll?.querySelector('table');
      if (table?.tHead) { mount(host, scroll, table); observer.disconnect(); }
    };
    const observer = new MutationObserver(find); observer.observe(host, {childList:true, subtree:true}); find();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
