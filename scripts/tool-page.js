(function (root) {
  'use strict';
  let pending;
  function load() {
    if (!pending) pending = Promise.all(['platforms.json', 'plans.json', 'models.json', 'plan-models.json', 'config.json'].map(file => fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('目录加载失败，请重试');
      return response.json();
    }))).then(([platforms, plans, models, relations, config]) => {
      root.appConfig = config;
      return { context: root.EntityData.buildContext(platforms, plans, models, relations), config };
    });
    return pending;
  }
  function filters(data, view, onChange) {
    return root.CodingPlanFilterUI.mount({ element: document.getElementById('toolFilters'), context: data.context, config: data.config, mode: 'full', view, onChange });
  }
  function error(host, message) {
    const box = document.createElement('div');
    box.className = 'tool-empty';
    box.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = message || '数据加载失败，请重试';
    const retry = document.createElement('button');
    retry.className = 'tool-button'; retry.type = 'button'; retry.textContent = '重新加载';
    retry.addEventListener('click', () => location.reload());
    box.append(text, retry); host.replaceChildren(box);
  }
  root.CodingPlanToolPage = { load, filters, error };
})(globalThis);
