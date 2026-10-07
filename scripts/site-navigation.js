/* Page contents navigation; the primary site links remain in the header. */
(() => {
  'use strict';
  function init() {
    const links = [...document.querySelectorAll('.site-section-nav a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    let pending = false;
    function updateSection() {
      pending = false;
      let current = -1;
      sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= 120) current = i; });
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
