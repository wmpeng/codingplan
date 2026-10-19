(function(root,factory){
  const api=factory(root.CodingPlanUI || (typeof require==='function' ? require('./ui-core.js') : null));
  if(typeof module==='object' && module.exports)module.exports=api;
  root.ChangeNotices=api;
})(globalThis,function(UI){
  'use strict';
  const esc=UI.escapeHtml;
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const url=record=>'/updates/#change-'+encodeURIComponent(record.slug);
  function matches(target,scope){
    // Platform summaries include their plans; a plan/point never inherits a sibling's notice.
    if(scope.type==='platform')return target.platformSlug===scope.platformSlug && target.type!=='model';
    if(target.type==='model')return scope.type==='point' && target.modelSlug===scope.modelSlug;
    if(target.platformSlug!==scope.platformSlug)return false;
    if(target.type==='platform')return true;
    if(target.planSlug!==scope.planSlug)return false;
    if(target.type==='plan')return true;
    return target.type==='plan_model' && (scope.type==='plan' || target.planModelSlug===scope.slug);
  }
  function select(catalog,scope){
    return (catalog?.changes || []).filter(record=>record.officialStatus==='announced' && record.targets.some(target=>matches(target,scope)))
      .sort((a,b)=>(a.effectiveTime.date || '9999').localeCompare(b.effectiveTime.date || '9999') || a.slug.localeCompare(b.slug));
  }
  function timing(record,today=day()){
    const time=record.effectiveTime;
    if(time.type==='date')return `${time.date}${time.date<=today ? ' · 生效情况待确认' : ' 起（公告计划）'}`;
    return time.type==='relative' ? time.description : '生效日期未公布';
  }
  function field(record){
    const types=new Set(record.changes.map(change=>change.type));
    if(types.size!==1)return 'general';
    return ({price:'price',quota:'quota',model_support:'models'})[[...types][0]] || 'general';
  }
  function item(record,options={}){
    const due=record.effectiveTime.type==='date' && record.effectiveTime.date<=(options.today || day());
    const diff=record.changes.map(change=>`${change.label}：${change.before} → ${change.after}`).join('；');
    const scope=options.showTargets ? `<span class="change-notice-scope">涉及：${esc(record.targets.map(target=>target.label).join('、'))}</span>` : '';
    return `<div class="change-notice${due?' is-due':''}" data-change-notice="${esc(record.slug)}"${record.effectiveTime.type==='date'?` data-change-date="${esc(record.effectiveTime.date)}"`:''}>`+
      `${options.compact?'':`<strong>${esc(record.title)}</strong>`}<span class="change-notice-time">${esc(timing(record,options.today))}</span>`+
      `<span>${esc(diff)}</span>${record.effectiveTime.type==='date' && record.effectiveTime.description?`<span>${esc(record.effectiveTime.description)}</span>`:''}${record.audience?`<span class="change-notice-audience">适用：${esc(record.audience)}</span>`:''}${scope}`+
      `<a href="${url(record)}">查看详情 →</a></div>`;
  }
  function brief(records,options={}){
    if(!records.length)return '';
    return `<div class="change-notices">${item(records[0],{compact:true,...options})}${records.length>1?`<a class="change-notice-more" href="${url(records[1])}">另有 ${records.length-1} 项变更 →</a>`:''}</div>`;
  }
  function forField(catalog,scope,key,options={}){
    let records=select(catalog,scope).filter(record=>field(record)===key);
    if(options.seen){records=records.filter(record=>!options.seen.has(scope.planSlug+':'+record.slug));records.forEach(record=>options.seen.add(scope.planSlug+':'+record.slug));}
    return brief(records,options);
  }
  function section(catalog,platformSlug,options={}){
    const records=select(catalog,{type:'platform',platformSlug});
    return records.length ? `<div class="change-notices" data-change-notices>${records.map(record=>item(record,{...options,showTargets:true})).join('')}</div>` : '';
  }
  function updateDates(doc,today=day()){
    doc.querySelectorAll('[data-change-notice][data-change-date]').forEach(element=>{
      const date=element.dataset.changeDate,due=date<=today;
      element.classList.toggle('is-due',due);
      element.querySelector('.change-notice-time').textContent=`${date}${due?' · 生效情况待确认':' 起（公告计划）'}`;
    });
  }
  if(typeof document!=='undefined'){
    const refresh=()=>updateDates(document);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
    setInterval(refresh,60000);
  }
  return {day,url,matches,select,timing,field,item,brief,forField,section,updateDates};
});
