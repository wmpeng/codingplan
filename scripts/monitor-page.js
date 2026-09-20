(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('monitorPage');
    try {
      const data = await root.CodingPlanToolPage.load();
      root.CodingPlanToolPage.filters(data, 'monitor');
      await root.mountMonitorBoard(host, { mode: 'full', configUrl: '/monitor/monitor-config.json', catalogContext: data.context });
    } catch (error) { root.CodingPlanToolPage.error(host, error.message); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
