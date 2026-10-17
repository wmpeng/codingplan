(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FeaturedCatalog = api;
})(globalThis, function () {
  'use strict';
  const UI = globalThis.CodingPlanUI || require('./ui-core.js');
  const Help = globalThis.CodingPlanHelp || require('./ui-help.js');
  const esc = UI.escapeHtml, url = value => UI.sanitizeUrl(value, '#');
  function validate(config, context) {
    const errors = [];
    if (!Array.isArray(config.platformSlugs) || !config.platformSlugs.length) errors.push('精选平台不能为空');
    const seen = new Set();
    for (const slug of config.platformSlugs || []) {
      if (seen.has(slug)) errors.push('重复平台 ' + slug);
      seen.add(slug);
      if (!context.platformBySlug.has(slug)) errors.push('无效平台 ' + slug);
    }
    const models = new Set();
    const ids = (config.groups || []).map(g => g.id);
    if (ids.length !== 2 || !ids.includes('high-volume-models') || !ids.includes('sota-models')) errors.push('精选模型必须包含 high-volume-models 和 sota-models 两个分组');
    for (const group of config.groups || []) {
      if (![group.title, group.label].every(value => typeof value === 'string' && value.trim())) errors.push('精选分组缺少 title 或 label: ' + group.id);
      if (!group.modelSlugs?.length) errors.push('空模型组 ' + group.id);
      for (const slug of group.modelSlugs || []) {
        if (models.has(slug)) errors.push('模型重复分组 ' + slug);
        models.add(slug);
        if (!context.modelBySlug.has(slug)) errors.push('未知模型 ' + slug);
      }
    }
    if (errors.length) throw new Error(errors.join('；'));
    return config;
  }
  function score(model, key) {
    const value = model.scores?.[key];
    const n = value?.scoreExact ?? value?.score;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }
  function scoreHtml(model, key, label) {
    const n = score(model, key), record = model.scores?.[key];
    return `<span class="model-score"><span class="model-score-value"><strong${n == null ? ' class="score-unknown"' : ''}>${n == null ? '暂无评分' : n.toFixed(1)}</strong>${n != null && record.sourceUrl ? ` <a href="${esc(url(record.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(model.name)} ${label}评分来源" title="${esc(record.configuration || '评分来源')}">↗</a>` : ''}</span><span class="model-score-label">${label}</span></span>`;
  }
  function modalities(model) {
    const names = {text:'文本',image:'图片',speech:'音频',video:'视频'};
    if (!model.modalities?.input) return model.multimodal === true ? '支持多模态 · 具体模态待确认' : model.multimodal === false ? '文本输入' : '输入模态待确认';
    return model.modalities.input.map(x => names[x] || x).join(' / ') + '输入';
  }
  function modelCard(model, context, options = {}) {
    const supported = new Set(context.planModels.filter(r => r.modelSlug === model.slug).map(r => context.planBySlug.get(r.planSlug)).filter(p => {
      const platform = p && context.platformBySlug.get(p.platformSlug);
      return p && p.planStatus !== 'delisted' && platform && platform.platformStatus !== 'delisted';
    }).map(p => p.platformSlug));
    const title = options.directory ? `<header class="model-card-header"><h3>${esc(model.name)}</h3><div class="model-card-aside">${options.featured ? '<span class="model-featured-badge">精选</span>' : ''}${UI.pinButton({pinned:options.pinned,label:`${options.pinned ? '取消置顶' : '置顶'} ${model.name}`,attributes:{'data-model-pin':model.slug}})}</div></header>` : `<h3>${esc(model.name)}</h3>`;
    return `<article class="model-card${options.featured ? ' is-featured' : ''}${options.pinned ? ' is-pinned' : ''}" data-model-slug="${esc(model.slug)}">${title}<p class="model-modality">${esc(modalities(model))}</p><div class="model-scores">${scoreHtml(model,'artificialAnalysis','AA')}${scoreHtml(model,'deepSWE','DeepSWE')}</div><a class="model-offers-link" href="${esc(UI.route('plans',{model:model.slug}))}">${supported.size} 个平台收录 · 查看套餐 →</a><a class="model-price-link" href="${esc(UI.route('pricing',{model:model.slug}))}">比较价格与按量 API →</a></article>`;
  }
  function modelGroups(config, context) {
    return config.groups.map(g => `<section class="featured-model-group"><div class="section-heading"><h3>${esc(g.title)}</h3><span>${g.modelSlugs.length} 个模型</span></div><div class="model-grid">${g.modelSlugs.map(s => modelCard(context.modelBySlug.get(s),context)).join('')}</div></section>`).join('');
  }
  function points(context, config) {
    return globalThis.EntityData.buildComparisonPoints(context, config.usdToCnyRate, {includeUnknown:true}).map(p => ({...p, available: (p.planStatus || 'open') === 'open' && (context.platformBySlug.get(p.platformSlug)?.platformStatus || 'open') === 'open'}));
  }
  function presetTableOptions(options = {}) {
    return {limit:6, modelFilter:true, ...options};
  }
  function mountTables(host, preset, context, config, options = {}) {
    let unit = globalThis.CodingPlanDisplaySettings?.getTokenUnit() || 'yi';
    const data = points(context,config), expanded = new Set(), selectedModels = Object.create(null);
    const tableOptions = {...presetTableOptions(options), selectedModels, hideDescription:true};
    const render = () => {
      const focused = document.activeElement;
      const selectedButton = focused?.closest?.('[data-preset-model]');
      const focus = selectedButton && host.contains(selectedButton) ? {group:selectedButton.closest('[data-preset-id]').dataset.presetId,model:selectedButton.dataset.presetModel} : null;
      globalThis.ModelComparison.renderPresetComparisons(host,preset,data,unit,'featured',tableOptions);
      host.insertAdjacentHTML('beforeend', `<p class="comparison-method">订阅单价按参考月额度用满计算；各模型额度不相加。${Help.html(host.id + '-priceHelp','综合单价说明','订阅综合单价是用满参考月额度时的单价。按量 API 按实际用量计费，没有固定月额度。实际成本受输入、输出和缓存比例影响；不同模型能力不同，未知额度不等于零。')}<a href="/pricing/#pricingMethod">计算口径 →</a></p>`);
      for (const id of expanded) { const card = [...host.querySelectorAll('[data-preset-id]')].find(x=>x.dataset.presetId===id); if(card) toggle(card,true); }
      if(focus) focusModelButton(focus.group,focus.model);
    };
    function findCard(id) { return [...host.querySelectorAll('[data-preset-id]')].find(card=>card.dataset.presetId===id); }
    function focusModelButton(id,model) {
      const button = [...(findCard(id)?.querySelectorAll('[data-preset-model]') || [])].find(button=>button.dataset.presetModel===model);
      button?.focus({preventScroll:true});
    }
    function toggle(card,open) {
      card.querySelectorAll('[data-preset-extra]').forEach(row=>row.hidden=!open);
      const button=card.querySelector('[data-preset-expand]');
      if(button){button.setAttribute('aria-expanded',String(open));button.querySelector('span').textContent=open?'收起':'展开全部';}
    }
    host.addEventListener('click', event => {
      const b=event.target.closest('button'); if(!b)return;
      if(b.hasAttribute('data-preset-expand')) {const card=b.closest('[data-preset-id]'),open=b.getAttribute('aria-expanded')!=='true';open?expanded.add(card.dataset.presetId):expanded.delete(card.dataset.presetId);toggle(card,open);return;}
      if(b.hasAttribute('data-preset-model') && tableOptions.modelFilter) {
        const card=b.closest('[data-preset-id]'),id=card.dataset.presetId,model=b.dataset.presetModel;
        const group=preset.groups.find(group=>group.id===id);
        if(!group || (model && !group.modelSlugs.includes(model)))return;
        const previous=selectedModels[id] || [];
        if(!model && !previous.length)return;
        const restoreFocus=document.activeElement===b,top=card.getBoundingClientRect().top;
        const selection=!model ? [] : previous.includes(model) ? previous.filter(slug=>slug!==model) : [...previous,model];
        selection.length ? selectedModels[id]=selection : delete selectedModels[id];
        card.outerHTML=globalThis.ModelComparison.presetComparisonTableHtml(group,data,unit,'featured',{...tableOptions,selectedModelSlugs:selectedModels[id],platformSlugs:preset.platformSlugs});
        const next=findCard(id);
        if(expanded.has(id))toggle(next,true);
        const shift=next.getBoundingClientRect().top-top;
        if(Math.abs(shift)>1)globalThis.scrollBy({top:shift,behavior:'instant'});
        if(restoreFocus)focusModelButton(id,model);
      }
    });
    globalThis.addEventListener('codingplan:token-unit-changed', event => { unit=event.detail.tokenUnit; render(); });
    render();
  }
  return {esc,url,validate,score,scoreHtml,modalities,modelCard,modelGroups,points,presetTableOptions,mountTables};
});
