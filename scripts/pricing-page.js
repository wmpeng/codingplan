(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('pricingPage');
    try {
      const data = await root.CodingPlanToolPage.load();
      root.CodingPlanToolPage.filters(data, 'pricing');
      await root.ModelComparison.mountModelComparisonView(host, { mode: 'full' });
      const legend = host.querySelector('.usage-color-legend');
      const legendDetails = document.createElement('details'); legendDetails.className = 'tool-legend';
      legendDetails.open = !matchMedia('(max-width: 800px)').matches;
      const legendLabel = document.createElement('summary'); legendLabel.textContent = '图例 · 点击名称可单独查看';
      legend.before(legendDetails); legendDetails.append(legendLabel, legend);
      const presets = host.querySelector('[data-presets]');
      const details = document.createElement('details');
      details.className = 'tool-secondary';
      const summary = document.createElement('summary'); summary.textContent = '查看固定模型对比';
      details.append(summary, presets); host.append(details);
      const note = host.querySelector('.usage-method-note');
      const method = document.createElement('details'); method.className = 'tool-secondary';
      const label = document.createElement('summary'); label.textContent = '价格、汇率与用量口径';
      method.append(label, note); host.append(method);
    } catch (error) { root.CodingPlanToolPage.error(host, error.message); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
