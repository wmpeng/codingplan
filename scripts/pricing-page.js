(function (root) {
  'use strict';
  function boot() {
    const host = document.getElementById('pricingPage');
    if (!host || !root.ModelComparison) return;
    fetch('/config.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : {}).then(config => {
      root.appConfig = config || {};
      return root.ModelComparison.mountModelComparisonView(host, { mode: 'full' });
    }).catch(error => {
      host.innerHTML = `<div class="tool-empty">价格数据加载失败：${String(error && error.message || error)}</div>`;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
