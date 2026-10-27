(function(root) {
  'use strict';
  const HOME_LIMIT = 6;
  function today() {
    return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  function ended(row, day = today()) {
    return row.ended === true || !!row.endsOn && row.endsOn < day;
  }
  function refresh(document, day = today()) {
    const home = document.querySelector('[data-home-announcements]');
    if (home) {
      let shown = 0;
      for (const row of home.querySelectorAll('[data-announcement]')) {
        row.hidden = ended({ended:row.dataset.ended === 'true',endsOn:row.dataset.endsOn},day) || shown >= HOME_LIMIT;
        if (!row.hidden) shown++;
      }
      home.hidden = shown === 0;
    }
    const section = document.querySelector('[data-announcement-details]');
    if (!section) return;
    const active = section.querySelector('[data-announcement-active]');
    const archive = section.querySelector('[data-announcement-archive]');
    const rows = [...section.querySelectorAll('.announcement-record')].sort((a,b)=>Number(a.dataset.order)-Number(b.dataset.order));
    let count = 0;
    for (const row of rows) {
      const isEnded = ended({ended:row.dataset.ended === 'true',endsOn:row.dataset.endsOn},day);
      (isEnded ? archive : active).append(row);
      const status = row.querySelector('[data-announcement-status]');
      status.textContent = isEnded ? '已结束' : '';
      status.hidden = !isEnded;
      if (!isEnded) count++;
    }
    section.querySelector('[data-announcement-empty]').hidden = count > 0;
    section.querySelector('details').hidden = rows.length === count;
    section.querySelector('[data-announcement-archive-count]').textContent = rows.length - count;
  }
  function reveal(document, hash) {
    let id; try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const row = document.getElementById(id);
    if (!row?.matches('.announcement-record')) return;
    const details = row.closest('details');
    if (details) details.open = true;
    row.scrollIntoView({block:'start'});
    row.focus({preventScroll:true});
  }
  function boot() {
    const update = () => {refresh(document); reveal(document, location.hash);};
    update();
    root.addEventListener('hashchange', () => reveal(document, location.hash));
    document.addEventListener('visibilitychange', () => {if (!document.hidden) update();});
    root.setInterval(() => refresh(document), 60000);
  }
  if (typeof module === 'object' && module.exports) module.exports = {HOME_LIMIT, today, ended, refresh, reveal};
  if (typeof document !== 'undefined') document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
