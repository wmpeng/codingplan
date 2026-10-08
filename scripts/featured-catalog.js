(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FeaturedCatalog = api;
})(globalThis, function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = value => /^(https?:\/\/|\/(?!\/))/.test(value || '') ? value : '#';
  function validate(config, context) {
    const errors = [];
    if (!Array.isArray(config.platformSlugs) || !config.platformSlugs.length) errors.push('精选平台不能为空');
    const seen = new Set();
    for (const slug of config.platformSlugs || []) {
      if (seen.has(slug)) errors.push('重复平台 ' + slug);
      seen.add(slug);
      if (!context.platformBySlug.has(slug) || context.platformBySlug.get(slug).catalogVisible === false) errors.push('无效平台 ' + slug);
    }
    const models = new Set();
    const ids = (config.groups || []).map(g => g.id);
    if (ids.length !== 2 || !ids.includes('high-volume-models') || !ids.includes('sota-models')) errors.push('需要甜品和顶尖两个分组');
    for (const group of config.groups || []) {
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
    return `<span class="model-score"><span class="model-score-value"><strong${n == null ? ' class="score-unknown"' : ''}>${n == null ? '未评定' : n.toFixed(1)}</strong>${n != null && record.sourceUrl ? ` <a href="${esc(url(record.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(model.name)} ${label}评分来源" title="${esc(record.configuration || '评分来源')}">↗</a>` : ''}</span><span class="model-score-label">${label}</span></span>`;
  }
  function modalities(model) {
    const names = {text:'文本',image:'图片',audio:'音频',video:'视频'};
    if (!model.modalities?.input) return model.multimodal === true ? '支持多模态 · 具体模态待确认' : model.multimodal === false ? '文本输入' : '输入模态待确认';
    return model.modalities.input.map(x => names[x] || x).join(' / ') + '输入';
  }
  function modelCard(model, context) {
    const supported = new Set(context.planModels.filter(r => r.modelSlug === model.slug).map(r => context.planBySlug.get(r.planSlug)).filter(p => p && !p.discontinued && context.platformBySlug.get(p.platformSlug)?.catalogVisible !== false).map(p => p.platformSlug));
    return `<article class="model-card" data-model-slug="${esc(model.slug)}"><h3>${esc(model.name)}</h3><p class="model-modality">${esc(modalities(model))}</p><div class="model-scores">${scoreHtml(model,'artificialAnalysis','AA')}${scoreHtml(model,'deepSWE','DeepSWE')}</div><a class="model-offers-link" href="/plans/?model=${encodeURIComponent(model.slug)}">${supported.size} 个平台收录 · 查看套餐 →</a><a class="model-price-link" href="/pricing/?model=${encodeURIComponent(model.slug)}">比较价格与按量 API →</a></article>`;
  }
  function modelGroups(config, context) {
    return config.groups.map(g => `<section class="featured-model-group"><div class="section-heading"><h3>${esc(g.title)}</h3><span>${g.modelSlugs.length} 个模型</span></div><div class="model-grid">${g.modelSlugs.map(s => modelCard(context.modelBySlug.get(s),context)).join('')}</div></section>`).join('');
  }
  function points(context, config) {
    return globalThis.EntityData.buildComparisonPoints(context, config.usdToCnyRate, {includeUnknown:true}).map(p => ({...p, available: ['open','limited'].includes(context.platformBySlug.get(p.platformSlug)?.platformStatus || 'open')}));
  }
  function mountTables(host, preset, context, config, limit) {
    let unit = globalThis.CodingPlanDisplaySettings?.getTokenUnit() || 'yi';
    const data = points(context,config), expanded = new Set();
    const render = () => {
      globalThis.ModelComparison.renderPresetComparisons(host,preset,data,unit,'featured',{limit});
      host.insertAdjacentHTML('afterbegin', `<div class="featured-table-controls"><span>默认按综合单价从低到高</span></div>`);
      host.insertAdjacentHTML('beforeend','<p class="comparison-method">订阅综合单价按参考月额度用满计算；按量 API 没有固定月额度。实际成本受用量、输入输出和缓存比例影响，不同模型能力也有差异。未知不等于零，各模型额度不相加。<a href="/pricing/#pricingMethod">查看计算口径 →</a></p>');
      for (const id of expanded) { const card = [...host.querySelectorAll('[data-preset-id]')].find(x=>x.dataset.presetId===id); if(card) toggle(card,true); }
    };
    function toggle(card,open) {
      card.querySelectorAll('[data-preset-extra]').forEach(row=>row.hidden=!open);
      const button=card.querySelector('[data-preset-expand]');
      if(button){button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起列表':`展开全部 ${card.querySelectorAll('tbody tr').length} 条`;}
    }
    host.addEventListener('click', event => {
      const b=event.target.closest('button'); if(!b)return;
      if(b.hasAttribute('data-preset-expand')) {const card=b.closest('[data-preset-id]'),open=b.getAttribute('aria-expanded')!=='true';open?expanded.add(card.dataset.presetId):expanded.delete(card.dataset.presetId);toggle(card,open);return;}

    });
    globalThis.addEventListener('codingplan:token-unit-changed', event => { unit=event.detail.tokenUnit; render(); });
    render();
  }
  return {esc,url,validate,score,scoreHtml,modalities,modelCard,modelGroups,points,mountTables};
});
