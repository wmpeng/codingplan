(function (root) {
  'use strict';
  function mount(host, scroll, table, {filters = document.getElementById('toolFilters'), fields = document.querySelector('.plan-columns-control')} = {}) {
    if (scroll.dataset.stickyHeaderMounted) return scroll.stickyHeaderController;
    if (!table.tHead) return;
    const header = table.tHead;
    const events = new AbortController();
    const listen = (target, type, callback, options = {}) => target?.addEventListener(type, callback, {...options, signal:events.signal});
    const fieldsHome = fields?.parentNode, fieldsNext = fields?.nextSibling;
    scroll.dataset.stickyHeaderMounted = '1';
    const identity = header.rows[0].cells[0];
    if (fields) {
      identity.classList.add('table-header-identity');
      identity.append(fields);
      listen(fields, 'click', event => event.stopPropagation());
      listen(fields, 'keydown', event => event.stopPropagation());
    }
    const anchor = document.createElement('div');
    anchor.className = 'table-header-anchor';
    scroll.before(anchor); anchor.append(scroll);
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
    copyTable.append(copy); overlay.append(copyTable); anchor.append(overlay);
    const backdrop = document.createElement('div');
    backdrop.className = 'sticky-table-backdrop'; backdrop.hidden = true; overlay.before(backdrop);
    let frame = 0, syncing = false, destroyed = false;
    function update() {
      frame = 0;
      const nav = document.querySelector('.site-header');
      const filterBottom = filters?.classList.contains('directory-filters-stuck') ? filters.getBoundingClientRect().bottom : 0;
      const baseTop = Math.max(0, nav?.getBoundingClientRect().bottom || 0, filterBottom);
      const layoutStyle = getComputedStyle(anchor);
      const gap = parseFloat(layoutStyle.getPropertyValue('--table-header-gap'));
      const top = baseTop + gap;
      const area = scroll.getBoundingClientRect(), tableBox = table.getBoundingClientRect();
      const scrollStyle = getComputedStyle(scroll);
      const border = parseFloat(scrollStyle.borderTopWidth) || 0;
      overlay.style.borderWidth = border + 'px';
      overlay.style.borderColor = scrollStyle.borderTopColor;
      overlay.style.borderTopLeftRadius = scrollStyle.borderTopLeftRadius;
      overlay.style.borderTopRightRadius = scrollStyle.borderTopRightRadius;
      const headBox = header.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const visible = area.width > 0 && headBox.height > 0 && headBox.top < top && tableBox.bottom > top + headBox.height && top + headBox.height + 80 < viewportHeight;
      overlay.hidden = !visible; backdrop.hidden = !visible;
      Object.assign(backdrop.style, {top:baseTop+'px', height:(gap+headBox.height+border*2)+'px'});
      if (!visible) return;
      Object.assign(overlay.style, {left: `${area.left}px`, top: `${top}px`, width: `${area.width}px`, height: `${headBox.height + border*2}px`});
      copyTable.style.width = `${tableBox.width}px`;
      const originalCells = [...header.rows[0].cells], copyCells = [...copy.rows[0].cells];
      originalCells.forEach((cell, index) => {
        const target = copyCells[index], width = cell.getBoundingClientRect().width;
        target.hidden = cell.hidden; target.className = cell.className;
        const sourceButtons = cell.querySelectorAll('.table-sort-button'), copyButtons = target.querySelectorAll('.table-sort-button');
        sourceButtons.forEach((button, i) => { if (copyButtons[i]) copyButtons[i].className = button.className; });
        if (cell.hasAttribute('aria-sort')) target.setAttribute('aria-sort', cell.getAttribute('aria-sort'));
        else target.removeAttribute('aria-sort');
        target.style.width = `${width}px`; target.style.minWidth = `${width}px`; target.style.maxWidth = `${width}px`;
      });
      if (fields) copy.querySelector('.plan-columns-control input').checked = fields.querySelector('input').checked;
      syncing = true; overlay.scrollLeft = scroll.scrollLeft; syncing = false;
    }
    const schedule = () => { if (!destroyed && !frame) frame = requestAnimationFrame(update); };
    listen(scroll, 'scroll', schedule, {passive:true});
    const copyFields = copy.querySelector('.plan-columns-control');
    listen(copyFields, 'click', event => event.stopPropagation());
    listen(copyFields, 'keydown', event => event.stopPropagation());
    listen(copyFields?.querySelector('input'), 'change', event => {
      const input = fields.querySelector('input');
      input.checked = event.target.checked;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      schedule();
    });
    listen(overlay, 'scroll', () => { if (!syncing) scroll.scrollLeft = overlay.scrollLeft; }, {passive:true});
    listen(overlay, 'click', event => {
      if (event.target.closest('.ui-help')) return;
      const button = event.target.closest('.table-sort-button');
      const price = event.target.closest('[data-table-sort][data-sort-key]');
      if (!button && !price) return;
      event.stopPropagation();
      const cells = [...copy.rows[0].cells], selected = (button || price).closest('th');
      const original = header.rows[0].cells[cells.indexOf(selected)];
      const buttonIndex = button ? [...selected.querySelectorAll('.table-sort-button')].indexOf(button) : 0;
      const target = original?.querySelectorAll('.table-sort-button')[buttonIndex];
      (target || original)?.click(); schedule();
    });
    listen(window, 'scroll', schedule, {passive:true});
    listen(window, 'resize', schedule, {passive:true});
    listen(window.visualViewport, 'resize', schedule);
    listen(document, 'change', schedule);
    listen(document, 'click', schedule);
    const observer = new ResizeObserver(schedule); observer.observe(scroll); observer.observe(table); observer.observe(header);
    if (filters) observer.observe(filters);
    const mutations = new MutationObserver(schedule);
    mutations.observe(header, {subtree:true, attributes:true, childList:true, characterData:true});
    const controller = {refresh:schedule, destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); events.abort(); observer.disconnect(); mutations.disconnect();
      if (fields && fieldsHome?.isConnected) fieldsHome.insertBefore(fields, fieldsNext?.parentNode === fieldsHome ? fieldsNext : null);
      if (fields) identity.classList.remove('table-header-identity');
      anchor.before(scroll); anchor.remove();
      delete scroll.dataset.stickyHeaderMounted; delete scroll.stickyHeaderController;
    }};
    scroll.stickyHeaderController = controller;
    document.fonts?.ready.then(schedule); schedule();
    return controller;
  }
  function start() {
    const host = document.querySelector('#plansPage, #pricingPage');
    if (!host) return;
    const find = () => {
      // 默认正文会被动态目录替换；不要克隆未启用的控件或绑定将被移除的表。
      if (host.hasAttribute('data-static-content')) return;
      const scroll = host.querySelector('.tool-table-wrap, .usage-data-card .usage-table-scroll');
      const table = scroll?.querySelector('table');
      if (table?.tHead) { mount(host, scroll, table); observer.disconnect(); }
    };
    const observer = new MutationObserver(find); observer.observe(host, {childList:true, subtree:true, attributes:true, attributeFilter:['data-static-content']}); find();
  }
  root.CodingPlanStickyTableHeader = {mount};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(globalThis);
