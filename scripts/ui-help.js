(function (root, factory) {
  const api = factory(root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CodingPlanHelp = api;
  if (root.document) api.bind(root.document);
})(globalThis, function (UI) {
  'use strict';
  function html(id, label, text) {
    const esc = UI.escapeHtml;
    return `<span class="ui-help"><button type="button" class="ui-help-button" popovertarget="${esc(id)}" aria-label="${esc(label)}" aria-expanded="false" aria-controls="${esc(id)}"><span aria-hidden="true">?</span></button><span class="ui-help-content" id="${esc(id)}" popover="auto" role="tooltip">${esc(text)}</span></span>`;
  }
  function bind(doc) {
    let active = null, pinned = false;
    const buttonFor = target => target?.closest?.('.ui-help-button');
    const content = button => doc.getElementById(button.getAttribute('aria-controls'));
    const place = () => {
      if (!active?.isConnected) { active = null; return; }
      const box = active.getBoundingClientRect(), tip = content(active);
      const view = doc.defaultView.visualViewport;
      const left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
      const width = view?.width || doc.documentElement.clientWidth;
      const height = view?.height || doc.documentElement.clientHeight;
      tip.style.maxWidth = `${Math.max(0, width - 24)}px`;
      tip.style.maxHeight = `${Math.max(0, height - 24)}px`;
      const size = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(left + 12, Math.min(box.left, left + width - size.width - 12))}px`;
      tip.style.top = `${Math.max(top + 12, box.bottom + size.height + 8 < top + height - 12 ? box.bottom + 8 : box.top - size.height - 8)}px`;
    };
    const close = () => {
      if (active) { const tip = content(active); if (tip?.matches(':popover-open')) tip.hidePopover(); active.setAttribute('aria-expanded', 'false'); }
      active = null; pinned = false;
    };
    const show = button => {
      if (active !== button) close();
      active = button;
      const tip = content(button);
      if (!tip.matches(':popover-open')) tip.showPopover();
      button.setAttribute('aria-expanded', 'true'); place();
    };
    doc.addEventListener('pointerover', event => { const b = buttonFor(event.target); if (b && event.pointerType === 'mouse') show(b); });
    doc.addEventListener('pointerout', event => {
      if (!active || pinned || event.pointerType !== 'mouse') return;
      const wrap = active.closest('.ui-help');
      if (wrap.contains(event.target) && !wrap.contains(event.relatedTarget) && !wrap.contains(doc.activeElement)) close();
    });
    doc.addEventListener('focusin', event => { const b = buttonFor(event.target); if (b) show(b); });
    doc.addEventListener('focusout', event => { if (active && !pinned && active.closest('.ui-help').contains(event.target) && !active.closest('.ui-help').contains(event.relatedTarget)) close(); });
    doc.addEventListener('click', event => {
      const b = buttonFor(event.target);
      if (b) { event.preventDefault(); if (active === b && pinned) close(); else { show(b); pinned = true; } }
      else if (active && !active.closest('.ui-help').contains(event.target)) close();
    });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape' && active) { event.preventDefault(); close(); } });
    doc.addEventListener('toggle', event => {
      if (active && event.target === content(active) && event.newState === 'closed') close();
    }, true);
    doc.addEventListener('scroll', place, true);
    doc.defaultView.addEventListener('resize', place);
    doc.defaultView.visualViewport?.addEventListener('resize', place);
  }
  return {html, bind};
});
