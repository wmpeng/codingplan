(function (root, factory) {
  const api = factory(root.FeaturedCatalog || (typeof require === 'function' ? require('./featured-catalog.js') : null), root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null), root.PlatformCatalog || (typeof require === 'function' ? require('./platform-catalog.js') : null), root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OfferResults = api;
})(globalThis, function (C, E, P, Numbers) {
  'use strict';
  const UI = globalThis.CodingPlanUI || require('./ui-core.js');
  const esc = UI.escapeHtml, url = value => UI.sanitizeUrl(value, '#');
  const money = n => Numbers.monthlyFee(n, '¥', '待确认');
  const unitLabel = Numbers.tokenUnit;
  const tokenAmount = Numbers.tokenAmount;
  function initialOffers(candidates) {
    const platforms = new Set(), selected = new Set();
    for(let index=0;index<candidates.length && selected.size<3;index++){
      const slug=candidates[index].platform.slug;
      if(platforms.has(slug))continue;
      platforms.add(slug);selected.add(index);
    }
    for(let index=0;index<candidates.length && selected.size<3;index++)selected.add(index);
    return candidates.filter((item,index)=>selected.has(index));
  }
  function quota(value,unit,withToken=true) {
    if(value==='unlimited')return '不限量';
    return typeof value==='number' ? `${tokenAmount(value,unit)} ${unitLabel(unit)}${withToken?' Token':''}` : '额度未知';
  }
  const setModelsExpanded = UI.setModelsExpanded;
  function card(item,state,modelGroups = []) {
    const models = UI.prioritizeFeaturedModels(item.models,modelGroups);
    const modelOrder = new Map(models.map((model,index)=>[model.slug,index]));
    const api=item.plan.billingMode==='payg', unit=state.tokenUnit;
    const unitPrice = row => E.comparisonUnitPrice(row.usage?.unitPriceCnyPerM,item.plan,E.displayPriceBasis());
    const estimateColumn=api && state.monthlyTokenRange != null;
    const estimates=new Map((item.apiEstimates || []).map(value=>[value.relationSlug,value.cost]));
    const estimatedRange=api ? Numbers.range((item.apiEstimates || [{cost:item.cost}]).map(value=>value.cost),money,value=>Numbers.monthlyFee(value,'')) : null;
    const statuses=[item.platform.platformStatus || 'open',item.plan.planStatus || 'open'];
    const statusKey=statuses.includes('delisted')?'delisted':statuses.includes('restricted')?'restricted':'open';
    const status=UI.statusLabels[statusKey], canBuy=statusKey==='open';
    const rows=[...item.rows].sort((a,b)=>(modelOrder.get(a.modelSlug) ?? models.length)-(modelOrder.get(b.modelSlug) ?? models.length)).map(row=>{
      const model=item.models.find(m=>m.slug===row.modelSlug), tiers=[row.serviceTier,row.contextTier,row.timeTier].filter(Boolean).join(' / ');
      const inlineTimeTier=row.timeTier && !row.serviceTier && !row.contextTier;
      const name=esc(model?.name || row.modelSlug), tier=tiers?`<small${inlineTimeTier?' class="offer-time-tier"':''}>${esc(tiers)}</small>`:'';
      const label=inlineTimeTier?`<span class="offer-model-with-time"><span>${name}</span>${tier}</span>`:name+tier;
      const price=unitPrice(row);
      const amount=row.usage?.monthlyTokenInM;
      const amountCell=api && !estimateColumn ? '' : `<td>${estimateColumn?esc(Numbers.monthlyFee(estimates.get(row.slug),'¥','费用未知')):typeof amount==='number'?esc(tokenAmount(amount,unit)):esc(quota(amount,unit,false))}</td>`;
      return `<tr><th scope="row">${label}</th>${amountCell}<td>${esc(Numbers.tokenPrice(price,unit,'单价未知'))}</td></tr>`;
    }).join('');
    const amountHeading=api && !estimateColumn ? '' : `<th scope="col">${estimateColumn?'月支出估算':'月额度 / '+unitLabel(unit)}</th>`;
    const table=`<div class="offer-model-table-wrap" role="region" aria-label="${esc(item.platform.name+' '+item.plan.name)}${api?'价格与估算':'模型额度'}"><table class="offer-model-table"><thead><tr><th scope="col">模型 / 档位</th>${amountHeading}<th scope="col">单价 / ${unitLabel(unit)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const modelsId='offer-model-tags-'+encodeURIComponent(item.id);
    const modelTags=UI.modelTags(models.map(m=>m.name),{maxRows:1,id:modelsId,className:'offer-model-summary platform-models',ariaLabel:'匹配模型'});
    const rangeText=Numbers.range(item.rows.map(r=>r.usage?.monthlyTokenInM),v=>tokenAmount(v,unit));
    const unlimited=item.rows.some(r=>r.usage?.monthlyTokenInM==='unlimited');
    const range=rangeText!==null ? `${rangeText} ${unitLabel(unit)}`+(unlimited?'～不限量':'') : unlimited?'不限量':'额度未知';
    const priceRange=Numbers.range(item.rows.map(unitPrice),v=>Numbers.tokenPrice(v,unit),v=>Numbers.unitPrice(v*Numbers.tokenFactor(unit),''));
    const originalPrice=!api && !['¥','CNY','RMB','￥'].includes(item.plan.currency || '¥') && typeof item.plan.firstMonthPrice==='number' ? `<div class="offer-original-price" title="人民币金额按站内汇率折算，仅供参考。">${esc(Numbers.monthlyFee(item.plan.firstMonthPrice,item.plan.currency))} / 首月</div>` : '';
    const quotaSummary=`<summary class="offer-quota-summary is-compact${range==='额度未知'?' is-unknown':''}"><span class="offer-summary-metrics"><span class="offer-summary-quota"><span class="offer-summary-label">月额度 </span><span class="offer-summary-value">${esc(range === '额度未知' ? '未知' : range)}</span></span>${priceRange!==null?`<span class="offer-summary-price" aria-hidden="true"><span class="offer-summary-label">单价 </span><span class="offer-summary-value">${esc(priceRange)} /${unitLabel(unit)}</span></span>`:''}</span></summary>`;
    const unknownPrices=item.rows.some(row=>Numbers.finite(row.usage?.unitPriceCnyPerM)===null);
    const apiSummary=`<summary class="offer-quota-summary offer-api-summary${priceRange===null?' is-unknown':''}"><span class="offer-summary-metrics"><span class="offer-summary-quota"><span class="offer-summary-label">${priceRange!==null && unknownPrices?'已知单价':'单价'} </span><span class="offer-summary-value">${priceRange!==null?`${esc(priceRange)} /${unitLabel(unit)}`:'待确认'}</span></span></span></summary>`;
    const badges=(statusKey==='open'?'':`<span class="offer-status" data-offer-status="${statusKey}">${status}</span>`)+(E.resolveHarnessApi(item.platform,item.plan)===false?E.harnessApiBadge(false):'');
    const capabilities=badges?`<div class="offer-capabilities">${badges}</div>`:'';
    const action=url(item.plan.action || item.platform.action);
    const name=esc(item.platform.name+' '+item.plan.name);
    const title=canBuy && action!=='#'?`<a class="offer-open-link" href="${esc(action)}" target="_blank" rel="noopener noreferrer" aria-label="前往开通 ${name}"><span>${name}</span>${P.EXTERNAL_LINK_ICON}</a>`:`<span class="offer-name">${name}</span>`;
    const fullPrice=`<a class="offer-full-price" href="${esc(UI.route('pricing',{platform:item.platform.slug,plan:item.plan.slug}))}"><span class="offer-full-price-text">完整价格与额度<span aria-hidden="true">→</span></span></a>`;
    const detailNote=api ? estimateColumn?'各模型/档位独立估算，费用不相加。':'无固定月额度，按实际用量计费。' : '各模型额度不相加，参考额度不代表连续任务保证。';
    const details=`<details class="offer-models">${api?apiSummary:quotaSummary}<div class="offer-model-details">${table}<p class="comparison-method${api?' offer-api-estimate-note':''}">${detailNote}</p>${fullPrice}</div></details>`;
    const priceText=api ? estimatedRange ?? '按量计费' : money(item.cost);
    const estimateLabel=item.costRange?.hasUnknown?'已知费用估算':item.costRange && item.costRange.min!==item.costRange.max?'估算范围':'估算';
    return `<article class="offer-result offer-card-refined${api?' offer-api':''}" data-offer-id="${esc(item.id)}" data-plan-slug="${esc(item.plan.slug)}" data-collect-platform="${esc(item.platform.slug)}"><div class="offer-result-heading"><div><h3 class="offer-title">${title}</h3>${capabilities}</div><div class="offer-price${item.cost==null?' is-unknown':''}"><div class="offer-price-line"><span>${esc(priceText).replace('～','<wbr>～')}</span>${item.cost!=null?`<small>/ ${api?'月':'首月'}</small>`:''}</div>${api&&item.cost!=null?`<div class="offer-price-note">${estimateLabel}</div>`:''}${originalPrice}</div></div>${modelTags}${details}<div class="offer-result-actions"><details class="offer-reasons"><summary>匹配说明与限制</summary><ul>${[...item.reasons,...item.cautions].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></div></article>`;
  }
  function mount(host,context,config) {
    let lastResult, lastFilterKey, lastPreference, showAll=false;
    const fitSummary = summary => {
      const price=summary.querySelector('.offer-summary-price');if(!price)return;
      // Always measure from the original size so a previous shrink never traps
      // the summary at 12px or causes it to alternate sizes on observer callbacks.
      summary.classList.remove('is-compact','has-small-values');
      const style=getComputedStyle(summary);
      const available=summary.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
      const metricsStyle=getComputedStyle(summary.querySelector('.offer-summary-metrics'));
      const arrowStyle=getComputedStyle(summary,'::after');
      const spacing=parseFloat(metricsStyle.columnGap)+parseFloat(style.columnGap)+parseFloat(arrowStyle.width)+parseFloat(arrowStyle.marginLeft)+parseFloat(arrowStyle.marginRight);
      const required=()=>[...summary.querySelectorAll('.offer-summary-label,.offer-summary-value')].reduce((width,el)=>width+el.getBoundingClientRect().width,spacing);
      let compact=false;
      if(required()>available) {
        summary.classList.add('has-small-values');
        compact=required()>available;
        // When even 12px does not fit, keep the visible quota at its original size.
        if(compact)summary.classList.remove('has-small-values');
      }
      summary.classList.toggle('is-compact',compact);
      price.setAttribute('aria-hidden',String(compact));
    };
    const modelRows=UI.observeModelTagRows(host);
    const summaryObserver=new ResizeObserver(entries=>entries.forEach(entry=>fitSummary(entry.target)));
    host.innerHTML = `<div class="section-heading offer-results-heading"><div><div class="offer-results-title"><h2>推荐的方案</h2></div></div></div><div data-offer-content></div>`;
    const render=()=>{
      const controller=globalThis.CodingPlanHomeFilters;if(!controller)return;
      const state=controller.getState();
      const filterKey=JSON.stringify({...state,preference:null,priorities:null});
      const priorityKey=JSON.stringify(state.priorities);
      const sortOnly=filterKey===lastFilterKey && priorityKey!==lastPreference;
      if(filterKey!==lastFilterKey)showAll=false;
      const scroll={left:globalThis.scrollX,top:globalThis.scrollY};
      const focused=document.activeElement;
      const open=[...host.querySelectorAll('[data-offer-id]')].flatMap(el=>[...el.querySelectorAll('details[open]')].map(d=>[el.dataset.offerId,d.className]));
      const expandedModels=[...host.querySelectorAll('[data-toggle-models][aria-expanded="true"]')].map(button=>button.closest('[data-offer-id]').dataset.offerId);
      const result=globalThis.PurchaseGuide.recommend(context,state,config,{allMatching:true});lastResult=result;
      const initialIds=new Set(initialOffers(result.candidates).map(item=>item.id));
      const foldedCount=result.candidates.length-initialIds.size;
      for(const item of [...result.candidates,...result.alternatives]) {
        item.cautions.push(...(globalThis.PurchaseGuideFlow?.baselineSummary(context,globalThis.CodingPlanGuideContext || {},item,config.usdToCnyRate) || []));
      }
      const content=host.querySelector('[data-offer-content]');
      const grid=content.querySelector('.offer-results-grid');
      if(sortOnly && grid && result.candidates.length) {
        // Move existing cards so expanded details and local interaction state survive.
        const cards=new Map([...grid.children].map(el=>[el.dataset.offerId,el]));
        for(const item of result.candidates) {
          const el=cards.get(item.id);
          el.querySelector('.offer-reasons ul').innerHTML=[...item.reasons,...item.cautions].map(text=>`<li>${esc(text)}</li>`).join('');
          grid.append(el);
        }
      } else content.innerHTML=result.candidates.length?`<div class="offer-results-grid" data-matching-grid>${result.candidates.map(x=>card(x,state,context.modelGroups)).join('')}</div>${foldedCount>0?'<button type="button" class="tool-button offer-expand" data-expand-offers></button>':''}`:`<div class="tool-empty"><h3>暂无同时符合条件的方案</h3><p>${result.modelConflict?esc(result.modelConflict):'下面是按所选排序取舍后的备选，原筛选条件保持不变。'}</p><button type="button" class="tool-button" data-reset-results>显示精选</button></div>${result.alternatives.length?`<div class="offer-results-grid" data-alternative-grid>${result.alternatives.map(item=>`<section class="offer-alternative"><p class="offer-sacrifice">需要放宽：${esc(item.sacrifices.join('、'))}${item.sacrifices.includes('月预算')?`（原上限 ${money(state.budgetCny?.max)}，此方案 ${money(item.cost)}／${item.plan.billingMode==='payg'?'月':'首月'}）`:''}${item.sacrifices.includes('月用量')?`（原目标 ${quota(globalThis.CodingPlanFilters.targetTokens(state),state.tokenUnit)}／月）`:''}</p>${card(item,item.relaxedState,context.modelGroups)}</section>`).join('')}</div>`:'<p>保留平台范围和使用方式后，暂时也没有可推荐的备选。可以回到筛选区调整这两项。</p>'}`;
      content.querySelectorAll('[data-matching-grid] > [data-offer-id]').forEach(el=>el.hidden=!showAll && !initialIds.has(el.dataset.offerId));
      const expand=content.querySelector('[data-expand-offers]');if(expand){expand.textContent=showAll?'收起其他方案':`展开其他 ${foldedCount} 个方案`;expand.setAttribute('aria-expanded',String(showAll));}
      summaryObserver.disconnect();
      host.querySelectorAll('.offer-quota-summary').forEach(summary=>{fitSummary(summary);summaryObserver.observe(summary);});
      for(const [id,cls] of open){const el=[...host.querySelectorAll('[data-offer-id]')].find(x=>x.dataset.offerId===id);const d=el?.querySelector('details.'+cls);if(d)d.open=true;}
      for(const id of expandedModels){const el=[...host.querySelectorAll('[data-offer-id]')].find(x=>x.dataset.offerId===id);const button=el?.querySelector('[data-toggle-models]');if(button)setModelsExpanded(button,true);}
      modelRows.refresh();
      if(sortOnly) {
        if(host.contains(focused) && focused!==document.activeElement)focused.focus({preventScroll:true});
        globalThis.scrollTo({...scroll,behavior:'instant'});
      }
      globalThis.dispatchEvent(new CustomEvent('codingplan:results-rendered', {detail:{result_count:result.candidates.length,result_key:JSON.stringify(state)}}));
      lastFilterKey=filterKey;
      lastPreference=priorityKey;
    };
    host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-restart-guide'))globalThis.dispatchEvent(new Event('codingplan:guide-restart'));if(b.hasAttribute('data-reset-results'))globalThis.CodingPlanHomeFilters.reset();if(b.dataset.relax){const change=lastResult.conflicts.find(x=>x.key===b.dataset.relax);if(change)globalThis.CodingPlanHomeFilters.setState({[change.key]:change.value},'manual');}});
    host.addEventListener('click',e=>{
      const expand=e.target.closest('[data-expand-offers]');if(expand){showAll=!showAll;render();host.querySelector('[data-expand-offers]')?.focus({preventScroll:true});return;}
      const button=e.target.closest('[data-toggle-models]');if(!button)return;
      const expanded=button.getAttribute('aria-expanded')!=='true';
      setModelsExpanded(button,expanded);
    });
    globalThis.addEventListener('codingplan:filters-changed',e=>{if(!e.detail.full)render();});
    globalThis.addEventListener('codingplan:price-basis-changed',render);
    render();
  }
  return {card,quota,mount,initialOffers};
});
