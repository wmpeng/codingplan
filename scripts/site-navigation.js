/* Page contents navigation; the primary site links remain in the header. */
(() => {
  'use strict';
  function initSettings() {
    const button = document.getElementById('settingsBtn');
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('ultraWideToggle');
    if (!button || !panel || !toggle || button.dataset.ultraWideBound) return;
    button.dataset.ultraWideBound = '1';
    button.disabled = false;
    function apply(on) {
      document.body.classList.toggle('ultra-wide', on);
      toggle.checked = on;
    }
    try { apply(localStorage.getItem('ultraWide') === '1'); } catch (_) { apply(false); }
    function open(on) {
      panel.hidden = !on;
      button.classList.toggle('active', on);
      button.setAttribute('aria-expanded', String(on));
    }
    button.addEventListener('click', () => open(panel.hidden));
    toggle.addEventListener('change', () => {
      apply(toggle.checked);
      try { localStorage.setItem('ultraWide', toggle.checked ? '1' : '0'); } catch (_) { /* 本次页面仍可设置。 */ }
    });
    document.addEventListener('click', event => {
      if (!panel.hidden && !document.getElementById('settingsMount').contains(event.target)) open(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { open(false); button.focus(); }
    });
  }
  function init() {
    document.querySelectorAll('[data-monitor-nav]').forEach(link => {
      link.hidden = window.__CODINGPLAN_FEATURES?.monitorView !== true;
    });
    const nav = document.querySelector('.site-header .tool-nav');
    const selected = nav?.querySelector('[aria-current="page"]');
    if (selected && nav.scrollWidth > nav.clientWidth) {
      // 仅移动导航自身，让窄屏进入文章/更新等页面时也能看到选中项。
      const item = selected.getBoundingClientRect(), bar = nav.getBoundingClientRect();
      nav.scrollLeft += item.left - bar.left - (bar.width - item.width) / 2;
    }
    initSettings();
    const links = [...document.querySelectorAll('.site-section-nav a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    let pending = false;
    function updateSection() {
      pending = false;
      let current = -1;
      sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= 120) current = i; });
      // 最后一节较短时无法滚到顶部；到达页底仍应正确标记当前目录。
      if (sections.length && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = sections.length - 1;
      links.forEach((link, i) => {
        if (i === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    if (links.length) {
      addEventListener('scroll', () => {
        if (!pending) { pending = true; requestAnimationFrame(updateSection); }
      }, {passive: true});
      addEventListener('resize', updateSection);
    }
    function updateLocation() {
      // Existing home links still open the same published history records.
      const history = document.getElementById('updateHistory');
      if (location.hash === '#updateHistory' && history) {
        history.open = true;
        requestAnimationFrame(() => history.scrollIntoView({block: 'start'}));
      }
      updateSection();
    }
    addEventListener('hashchange', updateLocation);
    addEventListener('codingplan:home-ready', updateLocation);
    updateLocation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
