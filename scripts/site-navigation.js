/* Page contents navigation; the primary site links remain in the header. */
(() => {
  'use strict';
  // 单位是全站显示偏好，不属于方案筛选；内部用量始终以 M 保存。
  const unitKey = 'codingplanTokenUnit';
  let tokenUnit = 'yi';
  try { const stored = localStorage.getItem(unitKey); tokenUnit = ['M', 'B'].includes(stored) ? stored : 'yi'; } catch (_) {}
  function syncUnitControls() {
    document.querySelectorAll('[data-settings-token-unit]').forEach(control => {
      control.setAttribute('aria-pressed', String(control.dataset.settingsTokenUnit === tokenUnit));
    });
  }
  function applyTokenUnit(value, persist = true) {
    const next = ['M', 'B'].includes(value) ? value : 'yi', changed = next !== tokenUnit;
    tokenUnit = next;
    if (persist) { try { localStorage.setItem(unitKey, next); } catch (_) {} }
    syncUnitControls();
    if (changed) window.dispatchEvent(new CustomEvent('codingplan:token-unit-changed', {detail: {tokenUnit}}));
  }
  window.CodingPlanDisplaySettings = {getTokenUnit: () => tokenUnit, setTokenUnit: applyTokenUnit};
  window.addEventListener('storage', event => {
    if (event.key === unitKey || event.key === null) applyTokenUnit(event.key === null ? 'yi' : event.newValue, false);
  });
  function initSettings() {
    const button = document.getElementById('settingsBtn');
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('ultraWideToggle');
    if (!button || !panel || !toggle || button.dataset.ultraWideBound) return;
    button.dataset.ultraWideBound = '1';
    button.disabled = false;
    syncUnitControls();
    panel.addEventListener('click', event => {
      const control = event.target.closest('[data-settings-token-unit]');
      if (control) applyTokenUnit(control.dataset.settingsTokenUnit);
    });
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
    const sectionNavigation = document.querySelector('.section-navigation');
    const sectionButton = sectionNavigation?.querySelector('.section-nav-toggle');
    const sectionPanel = sectionNavigation?.querySelector('.site-section-nav');
    if (sectionButton && sectionPanel) {
      const narrow = matchMedia('(max-width: 1100px)');
      function layoutSectionPanel() {
        if (!narrow.matches) {
          sectionPanel.style.removeProperty('max-height');
          delete sectionPanel.dataset.side;
          return;
        }
        const rect = sectionButton.getBoundingClientRect();
        const below = innerHeight - rect.bottom - 20;
        const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
        const above = Math.max(0, rect.top - headerBottom - 20);
        const up = below < 240 && above > below;
        sectionPanel.dataset.side = up ? 'above' : 'below';
        sectionPanel.style.maxHeight = `${Math.max(44, Math.min(320, up ? above : below))}px`;
      }
      function setSectionOpen(open, restoreFocus = false) {
        if (open || !narrow.matches) layoutSectionPanel();
        sectionButton.setAttribute('aria-expanded', String(open));
        sectionButton.setAttribute('aria-label', open ? '收起首页目录' : '展开首页目录');
        if (restoreFocus) sectionButton.focus({preventScroll: true});
      }
      sectionButton.hidden = false;
      sectionButton.disabled = false;
      sectionNavigation.classList.add('is-collapsible');
      sectionButton.addEventListener('click', () => setSectionOpen(sectionButton.getAttribute('aria-expanded') !== 'true'));
      sectionPanel.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || !narrow.matches) return;
        setSectionOpen(false);
        // 关闭面板后，将键盘焦点交给所选章节，避免焦点留在隐藏链接上。
        const target = document.getElementById(link.hash.slice(1));
        if (target) {
          if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
            target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once: true});
          }
          target.focus({preventScroll: true});
        }
      });
      document.addEventListener('click', event => {
        if (!sectionNavigation.contains(event.target)) setSectionOpen(false);
      });
      document.addEventListener('keydown', event => {
        if (narrow.matches && event.key === 'Escape' && sectionButton.getAttribute('aria-expanded') === 'true') {
          setSectionOpen(false, true);
        }
      });
      sectionNavigation.addEventListener('focusout', event => {
        if (event.relatedTarget && !sectionNavigation.contains(event.relatedTarget)) setSectionOpen(false);
      });
      narrow.addEventListener('change', () => {
        const wasInside = sectionPanel.contains(document.activeElement);
        setSectionOpen(false, narrow.matches && wasInside);
      });
      const layoutOpenPanel = () => {
        if (sectionButton.getAttribute('aria-expanded') === 'true') layoutSectionPanel();
      };
      addEventListener('resize', layoutOpenPanel);
      addEventListener('scroll', layoutOpenPanel, {passive: true});
    }
    const links = [...document.querySelectorAll('.site-section-nav a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    let pending = false;
    function updateSection() {
      pending = false;
      let current = -1;
      const sectionTop = (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 48;
      sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= sectionTop) current = i; });
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
