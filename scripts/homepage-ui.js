/* 首页呈现控制，不参与候选筛选、排序或用量计算。 */
(function () {
  'use strict';
  const columns = document.getElementById('homePlanColumns');
  const table = document.getElementById('plansTableSection');
  if (columns && table) {
    const updateColumns = () => {
      table.classList.toggle('home-plan-columns-all', columns.checked);
      window.dispatchEvent(new Event('resize'));
    };
    columns.addEventListener('change', updateColumns);
    updateColumns();
  }
  function enhanceUsage(host) {
    const view = host.querySelector('.usage-view');
    if (!view || view.dataset.homeLayout) return;
    view.dataset.homeLayout = '1';
    const presets = view.querySelector('[data-presets]');
    const note = view.querySelector('.usage-method-note');
    const wrap = (element, title) => {
      const details = document.createElement('details');
      details.className = 'home-secondary';
      const summary = document.createElement('summary');
      summary.textContent = title;
      details.append(summary, element);
      return details;
    };
    if (note) {
      const next = note.nextElementSibling;
      view.insertBefore(wrap(note, '如何读这些数据 · 价格、汇率与用量口径'), next);
    }
    if (presets) view.append(wrap(presets, '固定模型对比 · 独立于当前筛选'));
    view.querySelectorAll('.usage-chart-card').forEach((card, index) => {
      if (index < 2) card.classList.add('home-scatter-card');
    });
    window.dispatchEvent(new Event('resize'));
  }
  window.CodingPlanHomepageUI = { enhanceUsage };
})();
