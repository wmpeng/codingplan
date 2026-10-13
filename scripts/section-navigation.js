(() => {
  'use strict';
  function mount(options) {
    const links = [...document.querySelectorAll(options.links)];
    const target = link => { try { return document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch (_) { return null; } };
    const sections = [...new Set(links.map(target).filter(Boolean))];
    if (!sections.length) return { update() {} };
    let pending = false;
    function update() {
      pending = false;
      const edge = Math.max(options.minOffset || 0, (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 48);
      let current;
      sections.forEach(section => { if (section.getBoundingClientRect().top <= edge) current = section.id; });
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = sections.at(-1).id;
      links.forEach(link => {
        if (target(link)?.id === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule); addEventListener('hashchange', schedule);
    links.forEach(link => link.addEventListener('click', () => {
      const disclosure = link.closest('details');
      if (disclosure) {
        disclosure.open = false;
        const heading = target(link);
        if (heading) {
          if (!heading.hasAttribute('tabindex')) { heading.tabIndex = -1; heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true }); }
          requestAnimationFrame(() => heading.focus({ preventScroll: true }));
        }
      }
      schedule();
    }));
    update(); return { update };
  }
  window.CodingPlanSectionNavigation = { mount };
})();
