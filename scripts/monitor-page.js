(function (root) {
  'use strict';
  function loadCatalogContext() {
    if (!root.EntityData) return Promise.resolve(null);
    const files = ['platforms.json', 'plans.json', 'models.json', 'plan-models.json'];
    return Promise.all(files.map(file => fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`${file} 加载失败`);
      return response.json();
    }))).then(documents => root.EntityData.buildContext(...documents)).catch(error => {
      console.warn('监控页公开实体目录加载失败，继续使用监控 API:', error);
      return null;
    });
  }
  function boot() {
    const host = document.getElementById('monitorPage');
    if (!host || !root.mountMonitorBoard) return;
    const params = new URLSearchParams(root.location && root.location.search || '');
    loadCatalogContext().then(catalogContext => root.mountMonitorBoard(host, {
      configUrl: '/monitor/monitor-config.json',
      initialPlatform: params.get('platform') || '',
      catalogContext
    })).catch(error => {
      host.innerHTML = `<div class="tool-empty">可用性数据加载失败：${String(error && error.message || error)}</div>`;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
