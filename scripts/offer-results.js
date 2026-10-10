(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null), root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null), root.PlatformCatalog || (typeof require === 'function' ? require('./platform-catalog.js') : null), root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OfferResults = api;
})(globalThis, function (C, E, P, Numbers) {
  'use strict';
  const {esc,url} = C;
  const money = n => Numbers.monthlyFee(n, '¥', '待确认');
  const unitLabel = Numbers.tokenUnit;
  const tokenAmount = Numbers.tokenAmount;
  function quota(value,unit,withToken=true) {
    if(value==='unlimited')return '不限量';
    return typeof value==='number' ? `${tokenAmount(value,unit)} ${unitLabel(unit)}${withToken?' Token':''}` : '额度未知';
  }
  function setModelsExpanded(button,expanded) {
    button.closest('.offer-model-summary').querySelectorAll('[data-extra-model]').forEach(tag=>tag.hidden=!expanded);
    button.setAttribute('aria-expanded',String(expanded));
    button.setAttribute('aria-label',expanded?'收起额外模型':`展开其余 ${button.dataset.extraCount} 个模型`);
    button.textContent=expanded?'收起':'+'+button.dataset.extraCount;
  }
  function card(item,state) {
    const api=item.plan.billingMode==='payg', unit=state.tokenUnit;
    const status=item.plan.discontinued?'已下架':({open:'开放购买',limited:'定时放量',paused:'暂时停售',delisted:'已下架'}[item.platform.platformStatus] || '状态待确认');
    const canBuy=!item.plan.discontinued && ['open','limited'].includes(item.platform.platformStatus || 'open');
    const rows=item.rows.map(row=>{
      const model=item.models.find(m=>m.slug===row.modelSlug), tiers=[row.serviceTier,row.contextTier,row.timeTier].filter(Boolean).join(' / ');
      const inlineTimeTier=row.timeTier && !row.serviceTier && !row.contextTier;
      const name=esc(model?.name || row.modelSlug), tier=tiers?`<small${inlineTimeTier?' class="offer-time-tier"':''}>${esc(tiers)}</small>`:'';
      const label=inlineTimeTier?`<span class="offer-model-with-time"><span>${name}</span>${tier}</span>`:name+tier;
      const price=row.usage?.unitPriceCnyPerM;
      const amount=row.usage?.monthlyTokenInM;
      return `<tr><th scope="row">${label}</th><td>${api?'无固定额度':typeof amount==='number'?esc(tokenAmount(amount,unit)):esc(quota(amount,unit,false))}</td><td>${esc(Numbers.tokenPrice(price,unit,'单价未知'))}</td></tr>`;
    }).join('');
    const table=`<div class="offer-model-table-wrap" role="region" aria-label="${esc(item.platform.name+' '+item.plan.name)}模型额度"><table class="offer-model-table"><thead><tr><th scope="col">模型 / 档位</th><th scope="col">月额度 / ${unitLabel(unit)}</th><th scope="col">单价 / ${unitLabel(unit)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const modelsId='offer-model-tags-'+encodeURIComponent(item.id);
    const models=item.models.map(m=>m.name), modelTags=models.map((name,index)=>`<span class="model-tag"${index>2?' data-extra-model hidden':''}>${esc(name)}</span>`).join('')+(models.length>3?`<button type="button" class="model-tag model-tag-more" data-toggle-models data-extra-count="${models.length-3}" aria-expanded="false" aria-controls="${esc(modelsId)}" aria-label="展开其余 ${models.length-3} 个模型">+${models.length-3}</button>`:'');
    const rangeText=Numbers.range(item.rows.map(r=>r.usage?.monthlyTokenInM),v=>tokenAmount(v,unit));
    const unlimited=item.rows.some(r=>r.usage?.monthlyTokenInM==='unlimited');
    const range=rangeText!==null ? `${rangeText} ${unitLabel(unit)}`+(unlimited?'～不限量':'') : unlimited?'不限量':'额度未知';
    const priceRange=Numbers.range(item.rows.map(r=>r.usage?.unitPriceCnyPerM),v=>Numbers.tokenPrice(v,unit),v=>Numbers.unitPrice(v*Numbers.tokenFactor(unit),''));
    const originalPrice=!api && !['¥','CNY','RMB','￥'].includes(item.plan.currency || '¥') && typeof item.plan.monthlyPrice==='number' ? `<div class="offer-original-price" title="人民币金额按站内汇率折算，仅供参考。">${esc(Numbers.monthlyFee(item.plan.monthlyPrice,item.plan.currency))} / 月</div>` : '';
    const quotaSummary=`<summary class="offer-quota-summary is-compact${range==='额度未知'?' is-unknown':''}"><span class="offer-summary-metrics"><span class="offer-summary-quota">月额度 ${esc(range)}</span>${priceRange!==null?`<span class="offer-summary-price" aria-hidden="true">单价 ${esc(priceRange)}/${unitLabel(unit)}</span>`:''}</span></summary>`;
    const guide=globalThis.PlatformPages?.getUrl(item.platform.slug);
    const badges=(status==='开放购买'?'':`<span class="offer-status">${status}</span>`)+(E.resolveHarnessApi(item.platform,item.plan)===false?E.harnessApiBadge(false):'');
    const capabilities=badges?`<div class="offer-capabilities">${badges}</div>`:'';
    const platformUrl=guide || '/platforms/?platform='+encodeURIComponent(item.platform.slug);
    const action=url(item.plan.action || item.platform.action);
    const planTitle=canBuy && action!=='#'?`<a class="offer-plan" href="${esc(action)}" target="_blank" rel="noopener noreferrer" aria-label="前往开通 ${esc(item.platform.name+' '+item.plan.name)}"><span>${esc(item.plan.name)}</span>${P.EXTERNAL_LINK_ICON}</a>`:`<span class="offer-plan">${esc(item.plan.name)}</span>`;
    const fullPrice=`<a class="offer-full-price" href="/pricing/?platform=${encodeURIComponent(item.platform.slug)}&plan=${encodeURIComponent(item.plan.slug)}${api?'&relation='+encodeURIComponent(item.rows[0]?.slug || ''):''}">完整价格与额度 <span aria-hidden="true">→</span></a>`;
    const details=api?`${table}${fullPrice}`:`<details class="offer-models">${quotaSummary}<div class="offer-model-details">${table}<p class="comparison-method">各模型额度不相加，参考额度不代表连续任务保证。</p>${fullPrice}</div></details>`;
    return `<article class="offer-result offer-card-refined" data-offer-id="${esc(item.id)}" data-plan-slug="${esc(item.plan.slug)}"><div class="offer-result-heading"><div><h3 class="offer-title"><a class="offer-platform" href="${esc(platformUrl)}" aria-label="查看 ${esc(item.platform.name)} 平台详情"><span>${esc(item.platform.name)}</span></a><span class="offer-title-divider" aria-hidden="true">/</span>${planTitle}</h3>${capabilities}</div><div class="offer-price${item.cost==null?' is-unknown':''}"><div class="offer-price-line"><span>${api && item.cost==null?'按量计费':money(item.cost)}</span>${item.cost!=null?'<small>/ 月</small>':''}</div>${api&&item.cost!=null?'<div class="offer-price-note">估算</div>':''}${originalPrice}</div></div><div id="${esc(modelsId)}" class="offer-model-summary platform-models" aria-label="匹配模型">${modelTags}</div>${details}<div class="offer-result-actions"><details class="offer-reasons"><summary>匹配说明与限制</summary><ul>${[...item.reasons,...item.cautions].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></div></article>`;
  }
  function mount(host,context,config) {
    let advice=null, renderedAdvice, lastResult, lastFilterKey, lastPreference;
    const fitSummary = summary => {
      const price=summary.querySelector('.offer-summary-price');if(!price)return;
      const style=getComputedStyle(summary);
      const available=summary.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
      const metricsStyle=getComputedStyle(summary.querySelector('.offer-summary-metrics'));
      const arrowStyle=getComputedStyle(summary,'::after');
      const required=summary.querySelector('.offer-summary-quota').getBoundingClientRect().width+price.getBoundingClientRect().width+parseFloat(metricsStyle.columnGap)+parseFloat(style.columnGap)+parseFloat(arrowStyle.width)+parseFloat(arrowStyle.marginLeft)+parseFloat(arrowStyle.marginRight);
      const compact=required>available;
      summary.classList.toggle('is-compact',compact);
      price.setAttribute('aria-hidden',String(compact));
    };
    const summaryObserver=new ResizeObserver(entries=>entries.forEach(entry=>fitSummary(entry.target)));
    host.innerHTML = `<aside class="guide-advice" data-offer-advice hidden></aside><div class="section-heading offer-results-heading"><div><div class="offer-results-title"><h2>符合需求的方案</h2><span id="offerCount" role="status"></span></div><p>全部条件在同一个套餐内成立；按量方案按模型和计费档位展示。</p></div></div><div data-offer-content></div>`;
    const render=()=>{
      const controller=globalThis.CodingPlanHomeFilters;if(!controller)return;
      const state=controller.getState();
      const filterKey=JSON.stringify({...state,preference:null});
      const sortOnly=filterKey===lastFilterKey && state.preference!==lastPreference;
      const scroll={left:globalThis.scrollX,top:globalThis.scrollY};
      const focused=document.activeElement;
      const open=[...host.querySelectorAll('[data-offer-id]')].flatMap(el=>[...el.querySelectorAll('details[open]')].map(d=>[el.dataset.offerId,d.className]));
      const expandedModels=[...host.querySelectorAll('[data-toggle-models][aria-expanded="true"]')].map(button=>button.closest('[data-offer-id]').dataset.offerId);
      const result=globalThis.PurchaseGuide.recommend(context,state,config,{allMatching:true});lastResult=result;
      const count=host.querySelector('#offerCount');
      const countText=`${result.candidates.length} 个方案`;
      if(count.textContent!==countText)count.textContent=countText;
      const adviceHost=host.querySelector('[data-offer-advice]');
      adviceHost.hidden=!advice;
      if(advice!==renderedAdvice) {
        adviceHost.innerHTML=advice?`<h3>可以先直接使用网页或 App</h3><p>${esc(advice)}</p><button type="button" class="tool-button" data-restart-guide>继续选择工具接入或 API</button><p>下方保留当前筛选结果。</p>`:'';
        renderedAdvice=advice;
      }
      const content=host.querySelector('[data-offer-content]');
      const grid=content.querySelector('.offer-results-grid');
      if(sortOnly && grid) {
        // Move existing cards so expanded details and local interaction state survive.
        const cards=new Map([...grid.children].map(el=>[el.dataset.offerId,el]));
        for(const item of result.candidates) {
          const el=cards.get(item.id);
          el.querySelector('.offer-reasons ul').innerHTML=[...item.reasons,...item.cautions].map(text=>`<li>${esc(text)}</li>`).join('');
          grid.append(el);
        }
      } else content.innerHTML=result.candidates.length?`<div class="offer-results-grid">${result.candidates.map(x=>card(x,state)).join('')}</div>`:`<div class="tool-empty"><h3>暂无同时符合条件的方案</h3><p>${result.modelConflict?esc(result.modelConflict):"试着放宽一项条件；筛选不会自动改变。"}</p><div class="guide-options">${result.conflicts.map(x=>`<button type="button" data-relax="${esc(x.key)}">取消${esc(x.label)}（${x.count} 个套餐）</button>`).join('')}</div><button type="button" class="tool-button" data-reset-results>恢复默认条件</button></div>`;
      summaryObserver.disconnect();
      host.querySelectorAll('.offer-quota-summary').forEach(summary=>{fitSummary(summary);summaryObserver.observe(summary);});
      for(const [id,cls] of open){const el=[...host.querySelectorAll('[data-offer-id]')].find(x=>x.dataset.offerId===id);const d=el?.querySelector('details.'+cls);if(d)d.open=true;}
      for(const id of expandedModels){const el=[...host.querySelectorAll('[data-offer-id]')].find(x=>x.dataset.offerId===id);const button=el?.querySelector('[data-toggle-models]');if(button)setModelsExpanded(button,true);}
      if(sortOnly) {
        if(host.contains(focused) && focused!==document.activeElement)focused.focus({preventScroll:true});
        globalThis.scrollTo({...scroll,behavior:'instant'});
      }
      lastFilterKey=filterKey;
      lastPreference=state.preference;
    };
    host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-restart-guide'))globalThis.dispatchEvent(new Event('codingplan:guide-restart'));if(b.hasAttribute('data-reset-results'))globalThis.CodingPlanHomeFilters.reset();if(b.dataset.relax){const change=lastResult.conflicts.find(x=>x.key===b.dataset.relax);if(change)globalThis.CodingPlanHomeFilters.setState({[change.key]:change.value},'manual');}});
    host.addEventListener('click',e=>{
      const button=e.target.closest('[data-toggle-models]');if(!button)return;
      const expanded=button.getAttribute('aria-expanded')!=='true';
      setModelsExpanded(button,expanded);
    });
    globalThis.addEventListener('codingplan:filters-changed',e=>{if(!e.detail.full)render();});
    globalThis.addEventListener('codingplan:guide-advice',e=>{if(advice!==e.detail){advice=e.detail;render();}});
    render();
  }
  return {card,quota,mount};
});
