(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ModelDirectory = api;
})(globalThis, function (Catalog) {
  'use strict';
  const EntityData = globalThis.EntityData || require('./entity-data.js');
  const UI = globalThis.CodingPlanUI || require('./ui-core.js');
  const pinKey = 'codingplanPinnedModels';
  function sanitizePins(ids, models) {
    const valid = new Set(models.map(model => model.slug));
    return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && valid.has(id)))];
  }
  function readPins(storage, models) {
    try { return sanitizePins(JSON.parse(storage.getItem(pinKey)), models); } catch (_) { return []; }
  }
  function writePins(storage, ids) { try { storage.setItem(pinKey, JSON.stringify(ids)); } catch (_) {} }
  function select(models, groups, state = {}, pins = []) {
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
    const visible = models.filter(model => pinned.has(model.slug) || matchedIds.has(model.slug));
    visible.sort((a, b) => {
      const priority = rank(a) - rank(b);
      if (priority) return priority;
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN') || order.get(a.slug) - order.get(b.slug);
      if ((globalThis.BenchmarkScores || require('./benchmark-scores.js')).keys.includes(state.sort)) {
        const x = Catalog.score(a, state.sort), y = Catalog.score(b, state.sort);
        if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; }
        else if (x !== y) return y - x;
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
  function tableHtml(selection, context) {
    const Scores = globalThis.BenchmarkScores || require('./benchmark-scores.js'), esc = UI.escapeHtml;
    const rows = selection.visible.map(model => {
      const pinned = selection.pinned.has(model.slug), featured = selection.featured.has(model.slug);
      const pin = UI.pinButton({pinned, label:`${pinned ? '取消置顶' : '置顶'} ${model.name}`, attributes:{'data-model-pin':model.slug}});
      return `<tr data-model-slug="${esc(model.slug)}" class="${featured ? 'is-featured' : ''}${pinned ? ' is-pinned' : ''}"><th scope="row"><div class="model-table-identity">${pin}<div><span class="model-table-name">${esc(model.name)}</span>${featured ? '<span class="model-featured-badge">精选</span>' : ''}</div></div></th><td>${esc(Catalog.modalities(model))}</td>${Scores.keys.map(key => `<td class="model-table-score">${Scores.cardHtml(model,key,context.benchmarks?.[key])}</td>`).join('')}<td class="model-table-platforms">${Catalog.modelPlatformCount(model,context)}</td><td class="model-table-actions"><a href="${esc(UI.route('plans',{model:model.slug}))}">查看套餐 →</a><a href="${esc(UI.route('pricing',{model:model.slug}))}">价格与额度 →</a></td></tr>`;
    }).join('');
    return `<div class="tool-table-wrap model-table-wrap" role="region" aria-label="模型对比表，可横向滚动" tabindex="0"><table class="tool-table model-directory-table"><colgroup><col class="model-name-col"><col class="model-modality-col">${Scores.keys.map(() => '<col class="model-score-col">').join('')}<col class="model-platforms-col"><col class="model-actions-col"></colgroup><thead><tr><th scope="col">模型</th><th scope="col">输入模态</th>${Scores.keys.map(key => `<th scope="col" class="model-table-score">${esc(Scores.definitions[key].label)}</th>`).join('')}<th scope="col" class="model-table-platforms">收录平台</th><th scope="col">购买方案</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return {select, countLabel, tableHtml, sanitizePins, readPins, writePins, pinKey};
});
