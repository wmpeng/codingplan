(function (root) {
  "use strict";
  function bindSelectionHelp(host) {
    const helpSelector = '[data-multimodal-help], [data-platform-help]';
    const wrapSelector = '.model-multimodal-help, .platform-shortcut-help';
    const triggers = () => [...host.querySelectorAll(helpSelector)];
    let closeTimer = null;
    const cancelClose = () => { root.clearTimeout(closeTimer); closeTimer = null; };
    const show = (button, visible) => {
      button.setAttribute('aria-expanded', String(visible));
      const tooltip = document.getElementById(button.getAttribute('aria-controls'));
      if (!tooltip) return;
      tooltip.hidden = !visible;
      if (visible) {
        tooltip.style.top = ''; tooltip.style.bottom = '';
        const viewport = root.visualViewport;
        const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || root.innerHeight);
        const panel = button.closest('.filter-picker-menu');
        const bottom = Math.min(viewportBottom - 8, panel ? panel.getBoundingClientRect().bottom - 8 : viewportBottom);
        if (tooltip.getBoundingClientRect().bottom > bottom) {
          tooltip.style.top = 'auto'; tooltip.style.bottom = 'calc(100% + 6px)';
        }
      }
    };
    const close = button => { cancelClose(); delete button.dataset.pinned; show(button, false); };
    const reposition = () => triggers().filter(button => button.getAttribute('aria-expanded') === 'true').forEach(button => show(button, true));
    host.addEventListener('scroll', reposition, true);
    root.addEventListener('resize', () => root.requestAnimationFrame(reposition));
    root.visualViewport?.addEventListener('resize', () => root.requestAnimationFrame(reposition));
    let restoringFocus = false;
    host.addEventListener('pointerover', event => {
      if (event.pointerType !== 'mouse') return;
      const wrap = event.target.closest(wrapSelector);
      if (wrap) { cancelClose(); show(wrap.querySelector('button'), true); }
    });
    host.addEventListener('pointerout', event => {
      if (event.pointerType !== 'mouse') return;
      const wrap = event.target.closest(wrapSelector);
      if (!wrap || wrap.contains(event.relatedTarget)) return;
      const button = wrap.querySelector('button');
      if (!button.dataset.pinned && !wrap.contains(document.activeElement)) {
        cancelClose(); closeTimer = root.setTimeout(() => show(button, false), 150);
      }
    });
    host.addEventListener('focusin', event => {
      if (!restoringFocus && event.target.matches(helpSelector)) { cancelClose(); show(event.target, true); }
    });
    host.addEventListener('focusout', event => {
      const wrap = event.target.closest(wrapSelector);
      if (wrap && !wrap.contains(event.relatedTarget) && !wrap.querySelector('button').dataset.pinned) close(wrap.querySelector('button'));
    });
    host.addEventListener('click', event => {
      const button = event.target.closest(helpSelector);
      if (!button) return;
      cancelClose();
      if (button.dataset.pinned) close(button);
      else { button.dataset.pinned = 'true'; show(button, true); }
    });
    host.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const button = triggers().find(button => button.getAttribute('aria-expanded') === 'true');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation(); close(button);
      restoringFocus = true; button.focus({preventScroll:true}); restoringFocus = false;
    });
    document.addEventListener('click', event => {
      for (const button of triggers()) if (!button.closest(wrapSelector).contains(event.target)) close(button);
    });
    host.addEventListener('toggle', event => {
      if (event.target.matches('[data-picker]') && !event.target.open) triggers().forEach(close);
    }, true);
  }

  function positionStatusPanel(host) {
    const picker = host.querySelector('#homeStatusPicker');
    if (!picker?.open) return;
    const menu = picker.querySelector('.filter-picker-menu');
    if (root.innerWidth <= 800) { menu.removeAttribute('style'); return; }
    const anchor = picker.querySelector('summary').getBoundingClientRect();
    const actions = host.querySelector('.filter-state-actions').getBoundingClientRect();
    const panelWidth = 240;
    const minTop = (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 8;
    Object.assign(menu.style, {position:'fixed', width:`${panelWidth}px`, right:'auto', bottom:'auto', maxHeight:`${Math.max(100, root.innerHeight - minTop - 14)}px`});
    menu.style.left = `${Math.max(14, Math.min(anchor.left, root.innerWidth - panelWidth - 14))}px`;
    menu.style.top = `${Math.max(minTop, Math.min(anchor.bottom + 8, root.innerHeight - menu.getBoundingClientRect().height - 14))}px`;
    // Keep the footer actions reachable when the menu extends over their row.
    const bounds = menu.getBoundingClientRect();
    if (bounds.left < actions.right && bounds.right > actions.left && bounds.top < actions.bottom && bounds.bottom > actions.top) {
      if (actions.left - panelWidth - 8 >= 14) menu.style.left = `${actions.left - panelWidth - 8}px`;
      else if (anchor.top - bounds.height - 8 >= minTop) menu.style.top = `${anchor.top - bounds.height - 8}px`;
    }
  }
  function positionSelectionPanels(host) {
    positionStatusPanel(host);
    host.querySelectorAll('[data-picker][open], #homeBudgetPicker[open], #homeTokenPicker[open]').forEach(picker => {
    const menu = picker.querySelector('.filter-picker-menu');
    const viewport = root.visualViewport;
    const width = viewport?.width || root.innerWidth;
    const height = viewport?.height || root.innerHeight;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const mobile = root.innerWidth <= 800;
    const panelWidth = mobile ? width - 28 : Math.min(menu.classList.contains('budget-menu') ? 350 : 380, width - 28);
    const minTop = Math.max(top + 14, Math.min(top + height - 100, (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 8));
    Object.assign(menu.style, {position:"fixed", width:`${panelWidth}px`, maxHeight:`${Math.min(620, top + height - minTop - 14)}px`, right:"auto", bottom:"auto"});
    const anchor = picker.querySelector('summary').getBoundingClientRect();
    const panelHeight = menu.getBoundingClientRect().height;
    menu.style.left = `${mobile ? left + 14 : Math.max(left + 14, Math.min(anchor.left, left + width - panelWidth - 14))}px`;
    menu.style.top = `${Math.max(minTop, Math.min(mobile ? top + height - panelHeight - 18 : anchor.bottom + 8, top + height - panelHeight - 14))}px`;
    });
  }
  root.CodingPlanFilterPopovers = {bindSelectionHelp, positionStatusPanel, positionSelectionPanels};
})(globalThis);
