(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OfferResults = api;
})(globalThis, function (C) {
  'use strict';
  const {esc,url} = C;
  const money = n => typeof n === 'number' && Number.isFinite(n) ? `¥${n.toLocaleString('zh-CN',{maximumFractionDigits:2})}` : '待确认';
  function quota(value,unit) {
    if(value==='unlimited')return '不限量';
    return typeof value==='number' ? `${(value/(unit==='B'?1000:unit==='M'?1:100)).toLocaleString('zh-CN',{maximumFractionDigits:unit==='B'?9:3})} ${unit==='B'?'B':unit==='M'?'M':'亿'} Token` : '额度未知';
  }
  function card(item,state) {
    const api=item.plan.billingMode==='payg', unit=state.tokenUnit;
    const status=item.plan.discontinued?'已下架':({open:'开放购买',limited:'定时放量',paused:'暂时停售',delisted:'已下架'}[item.platform.platformStatus] || '状态待确认');
    const canBuy=!item.plan.discontinued && ['open','limited'].includes(item.platform.platformStatus || 'open');
    const rows=item.rows.map(row=>{
      const model=item.models.find(m=>m.slug===row.modelSlug), tiers=[row.serviceTier,row.contextTier,row.timeTier].filter(Boolean).join(' / ');
      const price=row.usage?.unitPriceCnyPerM;
      return `<tr><th scope="row">${esc(model?.name || row.modelSlug)}${tiers?`<small>${esc(tiers)}</small>`:''}</th><td>${api?'按量，无固定额度':esc(quota(row.usage?.monthlyTokenInM,unit))}</td><td>${typeof price==='number'?money(price*(unit==='B'?1000:unit==='M'?1:100))+'/'+(unit==='B'?'B':unit==='M'?'M':'亿')+' Token':'单价未知'}</td></tr>`;
    }).join('');
    const table=`<div class="offer-model-table-wrap" tabindex="0" role="region" aria-label="${esc(item.platform.name+' '+item.plan.name)}模型额度"><table class="offer-model-table"><thead><tr><th>模型 / 档位</th><th>月 Token 参考</th><th>综合单价</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const models=item.models.map(m=>m.name), modelTags=models.slice(0,3).map(name=>`<span class="model-tag">${esc(name)}</span>`).join('')+(models.length>3?`<span class="model-tag model-tag-more" aria-label="另有 ${models.length-3} 个模型">+${models.length-3}</span>`:'');
    const values=item.rows.map(r=>r.usage?.monthlyTokenInM).filter(v=>typeof v==='number');
    const unknown=item.rows.some(r=>r.usage?.monthlyTokenInM==null || r.usage?.monthlyTokenInM==='unknown');
    const range=values.length ? quota(Math.min(...values),unit)+(Math.max(...values)!==Math.min(...values)?' ～ '+quota(Math.max(...values),unit):'') : item.rows.some(r=>r.usage?.monthlyTokenInM==='unlimited')?'不限量':'额度未知';
    const originalPrice=!api && !['¥','CNY','RMB','￥'].includes(item.plan.currency || '¥') && typeof item.plan.monthlyPrice==='number' ? `<p class="offer-original-price">原价 ${esc(item.plan.currency)}${esc(item.plan.monthlyPrice)} / 月 · 按站内汇率折算人民币</p>` : '';
    const quotaSummary=api?'':`<p class="offer-quota-summary${range==='额度未知'?' is-unknown':''}">月额度参考：${esc(range)}${values.length&&unknown?' · 部分模型未知':''}</p>`;
    const guide=globalThis.PlatformPages?.getUrl(item.platform.slug);
    return `<article class="offer-result" data-offer-id="${esc(item.id)}" data-plan-slug="${esc(item.plan.slug)}"><div class="offer-result-heading"><div><h3 class="offer-title"><span class="offer-platform">${esc(item.platform.name)}</span><span class="offer-plan">${esc(item.plan.name)}${api?` · ${esc(item.models[0]?.name)}`:''}</span></h3><span class="offer-status">${status}</span></div><div class="offer-price${item.cost==null?' is-unknown':''}">${api && item.cost==null?'按量计费':money(item.cost)}${item.cost!=null?`<small> / 月${api?'（估算）':''}</small>`:''}</div></div><div class="offer-model-summary platform-models" aria-label="匹配模型">${modelTags}</div>${originalPrice}${quotaSummary}${api?table:`<details class="offer-models"><summary>查看 ${item.models.length} 个模型的额度与单价</summary>${table}<p class="comparison-method">各模型额度不相加，参考额度不代表连续任务保证。</p></details>`}<div class="offer-result-actions">${canBuy?`<a class="tool-button" href="${esc(url(item.plan.action || item.platform.action))}" target="_blank" rel="noopener noreferrer">查看开通</a>`:''}<a href="/pricing/?platform=${encodeURIComponent(item.platform.slug)}&model=${encodeURIComponent(item.models[0]?.slug || '')}&relation=${encodeURIComponent(item.rows[0]?.slug || '')}">价格明细</a>${guide?`<a href="${esc(guide)}">平台介绍</a>`:`<a href="/platforms/?platform=${encodeURIComponent(item.platform.slug)}">平台详情</a>`}<details class="offer-reasons"><summary>匹配说明与限制</summary><ul>${[...item.reasons,...item.cautions].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></div></article>`;
  }
  function mount(host,context,config) {
    let advice=null, lastResult;
    const render=()=>{
      const controller=globalThis.CodingPlanHomeFilters;if(!controller)return;
      const state=controller.getState();
      const open=[...host.querySelectorAll('[data-offer-id]')].flatMap(el=>[...el.querySelectorAll('details[open]')].map(d=>[el.dataset.offerId,d.className]));
      const result=globalThis.PurchaseGuide.recommend(context,state,config,{allMatching:true});lastResult=result;
      host.innerHTML=`${advice?`<aside class="guide-advice"><h3>可以先直接使用网页或 App</h3><p>${esc(advice)}</p><button type="button" class="tool-button" data-restart-guide>继续选择工具接入或 API</button><p>下方保留当前筛选结果。</p></aside>`:''}<div class="section-heading"><div><h2>符合需求的方案</h2><p>全部条件在同一个套餐内成立；按量方案按模型和计费档位展示。</p></div><span id="offerCount" role="status">${result.candidates.length} 个方案</span></div>${result.candidates.length?`<div class="offer-results-grid">${result.candidates.map(x=>card(x,state)).join('')}</div>`:`<div class="tool-empty"><h3>暂无同时符合条件的方案</h3><p>试着放宽一项条件；筛选不会自动改变。</p><div class="guide-options">${result.conflicts.map(x=>`<button type="button" data-relax="${esc(x.key)}">取消${esc(x.label)}（${x.count} 个套餐）</button>`).join('')}</div><button type="button" class="tool-button" data-reset-results>恢复默认条件</button></div>`}`;
      for(const [id,cls] of open){const el=[...host.querySelectorAll('[data-offer-id]')].find(x=>x.dataset.offerId===id);const d=el?.querySelector('details.'+cls);if(d)d.open=true;}
    };
    host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-restart-guide'))globalThis.dispatchEvent(new Event('codingplan:guide-restart'));if(b.hasAttribute('data-reset-results'))globalThis.CodingPlanHomeFilters.reset();if(b.dataset.relax){const change=lastResult.conflicts.find(x=>x.key===b.dataset.relax);if(change)globalThis.CodingPlanHomeFilters.setState({[change.key]:change.value},'manual');}});
    globalThis.addEventListener('codingplan:filters-changed',e=>{if(!e.detail.full)render();});
    globalThis.addEventListener('codingplan:guide-advice',e=>{if(advice!==e.detail){advice=e.detail;render();}});
    render();
  }
  return {card,quota,mount};
});
