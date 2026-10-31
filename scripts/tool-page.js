(function (root) {
  'use strict';
  let pending;
  const requests = new Map();
  function loadJson(file) {
    if (!requests.has(file)) requests.set(file, fetch('/' + file, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('目录加载失败，请重试');
      return response.json();
    }).then(document => {
      const names = {'platforms.json':'platforms','plans.json':'plans','models.json':'models','config.json':'config','featured-catalog.json':'featured_catalog','changes.json':'changes'};
      if (document.contentVersion) (root.codingplanDataVersions ||= {})[names[file]] = document.contentVersion;
      return document;
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
      root.codingplanDataReady = true;
      root.dispatchEvent(new Event('codingplan:data-ready'));
      return { context, config };
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  function filters(data, view, onChange) {
    return root.CodingPlanFilterUI.mount({ element: document.getElementById('toolFilters'), context: data.context, config: data.config, mode: 'full', view, onChange });
  }
  function mountSearch(search, count) {
    const previous = search.closest('.tool-result-bar');
    const row = document.createElement('div');
    row.className = 'tool-result-bar filter-result-search';
    document.querySelector('#toolFilters .filter-state-footer').prepend(row);
    row.append(search, count);
    if (previous && !previous.children.length) previous.remove();
  }
  function error(host, message, options = {}) {
    root.CodingPlanEvents?.track('load_error', {module:'tool_page', error_code:'data_unavailable'});
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
  root.CodingPlanToolPage = { load, loadPreset, filters, mountSearch, error };
})(globalThis);
