(() => {
  'use strict';
  const mounted = new WeakMap();
  function mount(options) {
    const links = [...document.querySelectorAll(options.links)];
    const target = link => { try { return document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch (_) { return null; } };
    const sections = [...new Set(links.map(target).filter(Boolean))];
    if (!sections.length) return { update() {}, destroy() {} };
    if (mounted.has(links[0])) return mounted.get(links[0]);
    const events = new AbortController();
    const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, {...options, signal:events.signal});
    let pending = 0, focusFrame = 0, destroyed = false;
    const temporaryTargets = new Set();
    function update() {
      pending = 0;
      if (destroyed) return;
      const edge = Math.max(options.minOffset || 0, (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 48);
      let current;
      sections.forEach(section => { if (section.getBoundingClientRect().top <= edge) current = section.id; });
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = sections.at(-1).id;
      links.forEach(link => {
        if (target(link)?.id === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    const schedule = () => { if (!destroyed && !pending) pending = requestAnimationFrame(update); };
    listen(window, 'scroll', schedule, { passive: true }); listen(window, 'resize', schedule); listen(window, 'hashchange', schedule);
    links.forEach(link => listen(link, 'click', () => {
      const disclosure = link.closest('details');
      if (disclosure) {
        disclosure.open = false;
        const heading = target(link);
        if (heading) {
          if (!heading.hasAttribute('tabindex')) {
            heading.tabIndex = -1; temporaryTargets.add(heading);
            listen(heading, 'blur', () => { heading.removeAttribute('tabindex'); temporaryTargets.delete(heading); }, { once: true });
          }
          cancelAnimationFrame(focusFrame);
          focusFrame = requestAnimationFrame(() => { if (!destroyed) heading.focus({ preventScroll: true }); });
        }
      }
      schedule();
    }));
    const controller = {update, destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(pending); cancelAnimationFrame(focusFrame); events.abort();
      temporaryTargets.forEach(heading => heading.removeAttribute('tabindex')); temporaryTargets.clear();
      mounted.delete(links[0]);
    }};
    mounted.set(links[0], controller);
    update(); return controller;
  }
  window.CodingPlanSectionNavigation = { mount };
})();
