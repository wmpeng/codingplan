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
  function mountDirectoryFilters(view, search, count) {
    const host = document.getElementById('toolFilters'), controls = [];
    const state = () => host.filterController.getState();
    function add(selector, label, read, options = {}) {
      const element = host.querySelector(selector) || document.querySelector(selector);
      if (element) controls.push({element, label, read, paused:true, ...options});
    }
    const picker = (selector, label, key, value) => add(selector, label,
      el => [state()[key] != null, el.querySelector(value).textContent], {picker:true});
    picker('#homePlatformPicker', '平台', 'platformSlugs', '[data-picker-count]');
    picker('#homeModelPicker', '模型', 'modelSlugs', '[data-picker-count]');
    add('#homeBudgetPicker', '月预算', el => [state().apiOnly || state().budgetCny != null, el.querySelector('[data-budget-label]').textContent], {picker:true});
    picker('#homeTokenPicker', '月 Token 数', 'monthlyTokenRange', '[data-token-label]');
    add('#homeStatusPicker', '购买状态', el => { const value=el.querySelector('[data-status-label]').textContent; return [value !== '不限', value]; }, {picker:true});
    function segments(selector, label, display = false) {
      add(selector, label, el => { const buttons=[...el.querySelectorAll('button')], index=buttons.findIndex(button=>button.classList.contains('is-active')); return [index>0, buttons[index]?.textContent || '']; }, {display});
    }
    function checkbox(selector, label, options) {
      add(selector,label,el=>{const checked=el.querySelector('input').checked; return [checked,checked?'开启':'关闭'];},options);
    }
    if (view === 'pricing') segments('.price-billing-filter', '计费方式');
    checkbox('.pricing-mainland-control, .platform-access-filter', '支持中国大陆');
    checkbox('.plan-harness-filter', '需支持第三方工具');
    add('.platform-featured-control','显示精选',el=>{const checked=el.querySelector('[data-catalog-featured]').getAttribute('aria-pressed')==='true';return [checked,checked?'开启':'关闭'];},{paused:false});
    segments('.usage-color-control', '颜色', true);
    segments('.usage-benchmark-control', '评分', true);
    segments('.usage-scale-control', '坐标轴', true);
    checkbox('.plan-columns-control','更多字段',{display:true,paused:false});
    root.DirectoryFilters.mount(host, search, count, {controls, pausedFields:host.querySelector('[data-featured-filter-fields]')});
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
  root.CodingPlanToolPage = { load, loadPreset, filters, mountSearch, mountDirectoryFilters, error };
})(globalThis);
