(() => {
  'use strict';
  function init() {
    CodingPlanSectionNavigation.mount({links:'.article-page .doc-toc a[href^="#"]',minOffset:113});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
