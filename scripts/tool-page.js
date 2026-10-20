(function (root) {
  'use strict';
  let pending;
  const requests = new Map();
  function loadJson(file) {
    if (!requests.has(file)) requests.set(file, fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('目录加载失败，请重试');
      return response.json();
    }).catch(error => { requests.delete(file); throw error; }));
    return requests.get(file);
  }
  function loadPreset() { return loadJson('featured-catalog.json'); }
  function load() {
    if (!pending) pending = Promise.all([
      ...['platforms.json', 'plans.json', 'models.json', 'config.json'].map(loadJson),
      loadPreset().catch(() => null),
      root.ChangeNotices ? loadJson('changes.json').catch(() => null) : null
    ]).then(([platforms, plans, models, config, preset, changes]) => {
      root.appConfig = config;
      const context = root.EntityData.buildContext(platforms, plans, models);
      context.changes = changes;
      if (preset) {
        context.modelGroups = preset.groups || [];
        context.featuredPlatformSlugs = preset.platformSlugs || [];
      }
      return { context, config };
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  function filters(data, view, onChange) {
    return root.CodingPlanFilterUI.mount({ element: document.getElementById('toolFilters'), context: data.context, config: data.config, mode: 'full', view, onChange });
  }
  function error(host, message, options = {}) {
    const box = document.createElement('div');
    box.className = 'tool-empty';
    box.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = message || '数据加载失败，请重试';
    const retry = document.createElement('button');
    retry.className = 'tool-button'; retry.type = 'button'; retry.textContent = '重新加载';
    retry.addEventListener('click', () => location.reload());
    box.append(text, retry);
    host.setAttribute('aria-busy', 'false');
    if (options.preserveContent) host.prepend(box); else host.replaceChildren(box);
  }
  root.CodingPlanToolPage = { load, loadPreset, filters, error };
})(globalThis);
