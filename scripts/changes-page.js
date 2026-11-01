(function(root) {
  'use strict';
  function updateDates(document, day) {
    const list = document.querySelector('.changes-upcoming');
    if(!list)return;
    const rows=[...list.querySelectorAll('.change-record')];
    for(const row of rows) {
      const overdue=!!row.dataset.effectiveDate && row.dataset.effectiveDate<=day;
      row.classList.toggle('is-due',overdue);
      row.querySelector('[data-change-status-label]').textContent=overdue?'生效情况待确认':'已公告';
      row.dataset.due=String(overdue);
    }
    rows.sort((a,b)=>Number(b.dataset.due==='true')-Number(a.dataset.due==='true') ||
      (a.dataset.effectiveDate||'9999').localeCompare(b.dataset.effectiveDate||'9999')||a.id.localeCompare(b.id));
    rows.forEach(row=>list.append(row));
  }
  function revealHash(document, hash) {
    let id;try{id=decodeURIComponent(hash.replace(/^#/,''));}catch{return;}
    const target=document.getElementById(id);
    if(!target || !target.matches('.change-record'))return;
    let parent=target.parentElement;
    while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
    const detail=target.querySelector('.change-details');if(detail)detail.open=true;
    target.scrollIntoView({block:'start'});
  }
  function boot() {
    const jumps=document.querySelector('.updates-jumps');
    const header=document.querySelector('.site-header');
    if(jumps && header) {
      // 吸顶和锚点共用实际高度，适配窄屏、文字放大及按钮换行。
      const measure=()=>{
        document.documentElement.style.setProperty('--updates-header-height',`${header.getBoundingClientRect().height}px`);
        document.documentElement.style.setProperty('--updates-nav-height',`${jumps.getBoundingClientRect().height}px`);
      };
      measure();
      const observer=new ResizeObserver(measure);
      observer.observe(header);observer.observe(jumps);
    }
    const refresh=()=>updateDates(document,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
    refresh();revealHash(document,location.hash);
    root.addEventListener('hashchange',()=>revealHash(document,location.hash));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
    // 页面跨日停留时只刷新提示文字，不修改官方状态或业务数据。
    root.setInterval(refresh,60000);
  }
  if(typeof module==='object' && module.exports)module.exports={updateDates,revealHash};
  if(typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})(typeof globalThis!=='undefined'?globalThis:this);
