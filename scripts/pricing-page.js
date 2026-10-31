(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('pricingPage');
    try {
      const data = await root.CodingPlanToolPage.load();
      const preset = await root.CodingPlanToolPage.loadPreset();
      root.FeaturedCatalog.validate(preset, data.context);
      root.FeaturedCatalog.mountTables(document.getElementById('pricingPresets'), preset, data.context, data.config, {hideHeading:true});
      root.CodingPlanToolPage.filters(data, 'pricing');
      const results = document.createElement('div'); results.className = 'tool-result-bar pricing-result-bar';
      results.innerHTML = '<input type="search" data-price-search placeholder="搜索平台、套餐或模型" aria-label="搜索平台、套餐或模型"><span class="tool-count" data-pricing-result-count aria-live="polite"></span>';
      host.before(results);
      const params = new URLSearchParams(location.search);
      const relation = params.get('relation');
      const plan = data.context.planBySlug.get(params.get('plan'));
      const focusRelationSlugs = relation ? [relation] : (data.context.relationsByPlanSlug.get(plan?.slug) || []).map(row => row.slug);
      const filterState = document.getElementById('toolFilters').filterController.getState();
      await root.ModelComparison.mountModelComparisonView(host, { mode: 'full', hidePresets: true, data, preset, filterState, focusRelationSlugs,
        directory:root.PricingDirectory, colorControlHost:document.querySelector('#toolFilters .filter-state-grid'), search:results.querySelector('input'), count:results.querySelector('[data-pricing-result-count]') });
      const legend = host.querySelector('.usage-color-legend');
      const legendDetails = document.createElement('details'); legendDetails.className = 'tool-legend';
      legendDetails.open = !matchMedia('(max-width: 800px)').matches;
      const legendLabel = document.createElement('summary'); legendLabel.textContent = '图例 · 点击名称单独看图';
      legend.before(legendDetails); legendDetails.append(legendLabel, legend);
      const note = host.querySelector('.usage-method-note');
      const method = document.createElement('details'); method.className = 'tool-secondary'; method.id = 'pricingMethod'; if (location.hash === '#pricingMethod') method.open = true;
      const label = document.createElement('summary'); label.textContent = '价格、汇率与用量口径';
      method.append(label, note); host.append(method);
      const openMethod = () => { if (location.hash === '#pricingMethod') { method.open = true; method.scrollIntoView({block:'start'}); } };
      root.addEventListener('hashchange', openMethod);
      document.getElementById('pricingPresets').addEventListener('click', event => {
        if (event.target.closest('a[href="/pricing/#pricingMethod"]')) method.open = true;
      });
      openMethod();
      const rows = [...host.querySelectorAll('.price-focus-row')];
      if (rows[0]) { rows[0].tabIndex = -1; rows[0].focus({preventScroll:true}); rows[0].scrollIntoView({block:'center'}); }
    } catch (error) { root.CodingPlanToolPage.error(host, error.message); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
