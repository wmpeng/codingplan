/* Shared site presentation switches; monitoring probes run independently. */
(function (root) {
  'use strict';
  const features = { monitorView: false, platformComparison: false };
  if (typeof module === 'object' && module.exports) module.exports = features;
  else {
    root.__CODINGPLAN_FEATURES = features;
    document.documentElement.classList.toggle('feature-monitor-disabled', features.monitorView === false);
    document.documentElement.classList.toggle('feature-platform-comparison-enabled', features.platformComparison === true);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
