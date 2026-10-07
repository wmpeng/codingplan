/* Shared navigation enhancement. Static links remain usable without JavaScript. */
(() => {
  'use strict';
  function init() {
    const sidebar = document.querySelector('.site-sidebar');
    if (!sidebar) return;
    document.body.prepend(sidebar);
    sidebar.id = 'siteNavigation';
    const header = document.createElement('header');
    header.className = 'site-mobile-header';
    header.append(sidebar.querySelector('.tool-brand').cloneNode(true));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'site-menu-toggle';
    toggle.textContent = '菜单';
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '打开导航');
    header.append(toggle);
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'site-nav-backdrop';
    backdrop.setAttribute('aria-label', '关闭导航');
    backdrop.tabIndex = -1;
    document.body.prepend(header, backdrop);
    document.body.classList.add('nav-enhanced');
    const mobile = matchMedia('(max-width: 900px)');
    let opened = false;
    const previousInert = new Map();
    const focusables = () => [...sidebar.querySelectorAll('a[href], button, input, summary, [tabindex="0"]')]
      .filter(el => el.getClientRects().length && !el.disabled);
    function setOpen(value, restoreFocus = true) {
      opened = value && mobile.matches;
      sidebar.classList.toggle('is-open', opened);
      document.body.classList.toggle('site-nav-open', opened);
      toggle.setAttribute('aria-expanded', String(opened));
      toggle.setAttribute('aria-label', opened ? '关闭导航' : '打开导航');
      if (opened) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.setAttribute('aria-label', '站点导航');
        for (const el of document.body.children) {
          if ([sidebar, header, backdrop].includes(el) || !(el instanceof HTMLElement)) continue;
          previousInert.set(el, el.inert); el.inert = true;
        }
        focusables()[0]?.focus();
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        sidebar.removeAttribute('aria-label');
        for (const [el, inert] of previousInert) el.inert = inert;
        previousInert.clear();
        if (restoreFocus && mobile.matches) toggle.focus();
      }
    }
    toggle.addEventListener('click', () => setOpen(!opened));
    backdrop.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', e => {
      if (e.target.closest('a[href]') && opened) setOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (!opened) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if (e.key === 'Tab') {
        const items = [...focusables(), toggle], index = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    });
    mobile.addEventListener('change', () => setOpen(false, false));
    function updateLocation() {
      const history = document.getElementById('updateHistory');
      const isHistory = location.pathname === '/' && location.hash === '#updateHistory';
      const historyLink = sidebar.querySelector('[data-nav-history]');
      if (isHistory) historyLink?.setAttribute('aria-current', 'location');
      else historyLink?.removeAttribute('aria-current');
      const homeLink = sidebar.querySelector('.tool-nav a[href="/"]');
      if (location.pathname === '/') {
        if (isHistory) homeLink?.removeAttribute('aria-current');
        else homeLink?.setAttribute('aria-current', 'page');
      }
      if (isHistory && history) {
        history.open = true;
        requestAnimationFrame(() => history.scrollIntoView({block: 'start'}));
      }
    }
    addEventListener('hashchange', updateLocation);
    addEventListener('codingplan:home-ready', updateLocation);
    updateLocation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
