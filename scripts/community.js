/* Homepage community invitation: opt-in panel and a dismissible scroll launcher. */
(() => {
  'use strict';
  function init() {
    const launcher = document.getElementById('communityFloat');
    const dialog = document.getElementById('communityDialog');
    const hero = document.querySelector('.discovery-hero');
    const footer = document.getElementById('communityFooter');
    if (!launcher || !dialog || !hero || !footer) return;
    const trigger = launcher.querySelector('[data-community-open]');
    const storageKey = 'codingplanCommunityDismissed';
    let dismissed = false, pending = false;
    try { dismissed = sessionStorage.getItem(storageKey) === '1'; } catch (_) {}
    const mobile = () => matchMedia('(max-width: 600px)').matches;
    const visible = node => node && node.getClientRects().length > 0;
    function closePanel(restoreFocus = true) {
      if (!dialog.open) return;
      dialog.close();
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus && !launcher.hidden) trigger.focus({ preventScroll: true });
    }
    function update() {
      pending = false;
      const bottom = footer.getBoundingClientRect();
      const footerVisible = bottom.top < innerHeight && bottom.bottom > 0;
      const busy = [...document.querySelectorAll('#platformDetailOverlay, #purchaseGuide, .filter-picker[open], #settingsPanel')].some(visible);
      const keyboard = mobile() && window.visualViewport && innerHeight - visualViewport.height > 140;
      const hide = dismissed || hero.getBoundingClientRect().bottom > 0 || footerVisible || busy || keyboard;
      if (hide) closePanel(false);
      if (launcher.hidden !== !!hide) launcher.hidden = !!hide;
    }
    function schedule() {
      if (!pending) { pending = true; requestAnimationFrame(update); }
    }
    trigger.addEventListener('click', () => {
      if (dialog.open) { closePanel(); return; }
      if (mobile()) dialog.showModal(); else dialog.show();
      trigger.setAttribute('aria-expanded', 'true');
      dialog.querySelector('[data-community-close]').focus({ preventScroll: true });
    });
    launcher.querySelector('[data-community-dismiss]').addEventListener('click', () => {
      dismissed = true;
      try { sessionStorage.setItem(storageKey, '1'); } catch (_) {}
      closePanel(false);
      launcher.hidden = true;
    });
    dialog.querySelector('[data-community-close]').addEventListener('click', () => closePanel());
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && dialog.open) { event.preventDefault(); closePanel(); }
    });
    document.addEventListener('click', event => {
      if (!dialog.open || launcher.contains(event.target)) return;
      const rect = dialog.getBoundingClientRect();
      if (!dialog.contains(event.target) || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel(false);
    });
    const observer = new MutationObserver(schedule);
    for (const selector of ['#platformDetailOverlay', '#purchaseGuide', '#homepageUnifiedFiltersMount', '#settingsMount']) {
      const node = document.querySelector(selector);
      if (node) observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open', 'class'] });
    }
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', () => { closePanel(false); schedule(); });
    addEventListener('codingplan:home-ready', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
