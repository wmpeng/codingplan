(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ModelDirectory = api;
})(globalThis, function (Catalog) {
  'use strict';
  const EntityData = globalThis.EntityData || require('./entity-data.js');
  const UI = globalThis.CodingPlanUI || require('./ui-core.js');
  const Scores = globalThis.BenchmarkScores || require('./benchmark-scores.js');
  const pinKey = 'codingplanPinnedModels';
  const sortKeys = ['default','name',...Scores.keys,'platformCount'];
  const defaultDirection = key => key === 'name' || key === 'default' ? 'asc' : 'desc';
  function cycleSort(state, key) {
    const first = defaultDirection(key);
    if (state.key !== key) return {key, direction:first};
    return state.direction === first ? {key, direction:first === 'asc' ? 'desc' : 'asc'} : {key:'default', direction:'asc'};
  }
  const {sanitizePins, readPins, writePins} = UI.pinStore(pinKey);
  function select(models, groups, state = {}, pins = [], platformCounts = new Map()) {
    const pinned = new Set(sanitizePins(pins, models));
    const featured = new Set(UI.modelPresetSlugs(groups, 'featured', models));
    const enabledGroups = groups.filter(group => group.enabled !== false);
    const group = enabledGroups.find(group => group.id === state.featuredMode);
    const modeSlugs = state.featuredMode === 'all' ? featured : group ? new Set(UI.modelPresetSlugs(groups, group.id, models)) : null;
    const query = String(state.query || '').trim().toLocaleLowerCase();
    const matched = models.filter(model => modeSlugs ? modeSlugs.has(model.slug)
      : (!query || `${model.name} ${model.slug}`.toLocaleLowerCase().includes(query)) && (!state.multimodal || EntityData.isMultimodal(model)));
    const matchedIds = new Set(matched.map(model => model.slug));
    const order = new Map(models.map((model, index) => [model.slug, index]));
    const featuredOrder = new Map([...featured].map((slug, index) => [slug, index]));
    const rank = model => pinned.has(model.slug) ? 0 : featured.has(model.slug) ? 1 : 2;
    const direction = state.direction || defaultDirection(state.sort);
    const multiplier = direction === 'desc' ? -1 : 1;
    const visible = models.filter(model => pinned.has(model.slug) || matchedIds.has(model.slug));
    visible.sort((a, b) => {
      const priority = rank(a) - rank(b);
      if (priority) return priority;
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN') * multiplier || order.get(a.slug) - order.get(b.slug);
      if (Scores.keys.includes(state.sort)) {
        const x = Catalog.score(a, state.sort), y = Catalog.score(b, state.sort);
        if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; }
        else if (x !== y) return (x - y) * multiplier;
      }
      if (state.sort === 'platformCount') {
        const difference = (platformCounts.get(a.slug) || 0) - (platformCounts.get(b.slug) || 0);
        if (difference) return difference * multiplier;
      }
      if ((!state.sort || state.sort === 'default') && !pinned.has(a.slug) && featured.has(a.slug)) return featuredOrder.get(a.slug) - featuredOrder.get(b.slug);
      return order.get(a.slug) - order.get(b.slug);
    });
    return {visible, featured, pinned, matchedCount: matched.length, featuredMode: !!modeSlugs,
      extraPinnedCount: [...pinned].filter(slug => !matchedIds.has(slug)).length};
  }
  function countLabel(selection) {
    const pins = selection.featuredMode ? selection.extraPinnedCount : selection.pinned.size;
    return `${selection.featuredMode ? '精选' : '符合条件'} ${selection.matchedCount} 个` + (pins ? ` · 置顶 ${pins} 个` : '');
  }
  function tableRowsHtml(selection, context) {
    const esc = UI.escapeHtml;
    if (!selection.visible.length) return '<tr><td colspan="8"><p class="tool-empty">没有匹配模型，试着清空搜索或减少条件。</p></td></tr>';
    return selection.visible.map(model => {
      const pinned = selection.pinned.has(model.slug), featured = selection.featured.has(model.slug);
      const pin = UI.pinButton({pinned, label:`${pinned ? '取消置顶' : '置顶'} ${model.name}`, attributes:{'data-model-pin':model.slug}});
      return `<tr data-model-slug="${esc(model.slug)}" class="${featured ? 'is-featured' : ''}${pinned ? ' is-pinned' : ''}"><th scope="row"><div class="model-table-identity">${pin}<div><span class="model-table-name">${esc(model.name)}</span>${featured ? '<span class="model-featured-badge">精选</span>' : ''}</div></div></th><td>${esc(Catalog.modalities(model))}</td>${Scores.keys.map(key => `<td class="model-table-score">${Scores.cardHtml(model,key,context.benchmarks?.[key])}</td>`).join('')}<td class="model-table-platforms">${Catalog.modelPlatformCount(model,context)}</td><td class="model-table-actions"><a href="${esc(UI.route('plans',{model:model.slug}))}">查看套餐 →</a><a href="${esc(UI.route('pricing',{model:model.slug}))}">价格与额度 →</a></td></tr>`;
    }).join('');
  }
  function tableHtml(selection, context) {
    const heading = (key, label, className = '') => `<th scope="col" class="${className}" aria-sort="none"><button type="button" class="table-sort-button" data-model-sort="${key}" aria-label="${label}排序">${label}</button></th>`;
    return `<div class="tool-table-wrap model-table-wrap" role="region" aria-label="模型对比表，可横向滚动" tabindex="0"><table class="tool-table model-directory-table"><colgroup><col class="model-name-col"><col class="model-modality-col">${Scores.keys.map(() => '<col class="model-score-col">').join('')}<col class="model-platforms-col"><col class="model-actions-col"></colgroup><thead><tr>${heading('name','模型')}<th scope="col">输入模态</th>${Scores.keys.map(key => heading(key,Scores.definitions[key].label,'model-table-score')).join('')}${heading('platformCount','收录平台','model-table-platforms')}<th scope="col">购买方案</th></tr></thead><tbody>${tableRowsHtml(selection,context)}</tbody></table></div>`;
  }
  return {select, countLabel, tableHtml, tableRowsHtml, sortKeys, defaultDirection, cycleSort, sanitizePins, readPins, writePins, pinKey};
});
