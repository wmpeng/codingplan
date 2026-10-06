(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('pricingPage');
    try {
      const data = await root.CodingPlanToolPage.load();
      const presetResponse = await fetch('/model-comparison-presets.json');
      if (!presetResponse.ok) throw new Error('精选配置加载失败');
      const preset = await presetResponse.json();
      root.FeaturedCatalog.validate(preset, data.context);
      root.FeaturedCatalog.mountTables(document.getElementById('pricingPresets'), preset, data.context, data.config);
      root.CodingPlanToolPage.filters(data, 'pricing');
      await root.ModelComparison.mountModelComparisonView(host, { mode: 'full', hidePresets: true });
      const legend = host.querySelector('.usage-color-legend');
      const legendDetails = document.createElement('details'); legendDetails.className = 'tool-legend';
      legendDetails.open = !matchMedia('(max-width: 800px)').matches;
      const legendLabel = document.createElement('summary'); legendLabel.textContent = '图例 · 点击名称可单独查看';
      legend.before(legendDetails); legendDetails.append(legendLabel, legend);
      const note = host.querySelector('.usage-method-note');
      const method = document.createElement('details'); method.className = 'tool-secondary'; method.id = 'pricingMethod'; if (location.hash === '#pricingMethod') method.open = true;
      const label = document.createElement('summary'); label.textContent = '价格、汇率与用量口径';
      method.append(label, note); host.append(method);
      if (location.hash === '#pricingMethod') method.scrollIntoView({block:'start'});
      const relation = new URLSearchParams(location.search).get('relation');
      const row = relation && [...host.querySelectorAll('[data-point-id]')].find(el => el.dataset.pointId === relation);
      if (row) { row.classList.add('price-focus-row'); row.tabIndex = -1; row.focus({preventScroll:true}); row.scrollIntoView({block:'center'}); }
    } catch (error) { root.CodingPlanToolPage.error(host, error.message); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
