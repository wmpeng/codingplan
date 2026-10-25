const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createChecker,pageType} = require('./data-updates');

function fixture(reply = {err_code:0,data:{has_update:false}}) {
  let clock = 0, sequence = 0, notices = 0;
  const timers = new Map(), calls = [];
  const env = {Date:{now:()=>clock}, AbortController,
    setTimeout(fn,delay) { const id=++sequence; timers.set(id,{fn,at:clock+delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url,options) { calls.push({url,...options,payload:JSON.parse(options.body)}); if(reply instanceof Error)throw reply;
      return {ok:true,json:async()=>reply}; }
  };
  const checker = createChecker(env,()=>notices++);
  const check = (purpose,model='one') => checker.check({page_type:'home',purpose,context:{model_slug:model},versions:{models:'2026-10-25T01:00:00.000Z'}});
  async function tick(ms) {
    const end=clock+ms;
    while(true) {
      const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      timers.delete(next[0]);clock=next[1].at;next[1].fn();await Promise.resolve();await Promise.resolve();
    }
    clock=end;await Promise.resolve();await Promise.resolve();
  }
  return {check,tick,calls,env,notices:()=>notices};
}

test('only a successful response with a literal boolean true notifies, once per page',async()=>{
  for(const reply of [{},{data:{has_update:true}},{err_code:1,data:{has_update:true}},
    {err_code:0,data:{has_update:'true'}},{err_code:0,data:{has_update:1}},
    {err_code:0,data:{has_update:false}},new Error('offline')]) {
    const f=fixture(reply);f.check('page_display');await f.tick(0);assert.equal(f.notices(),0);
  }
  const f=fixture({err_code:0,data:{has_update:true,changed_files:['models']}});
  f.check('page_display');await f.tick(0);f.check('platform_detail');await f.tick(0);
  assert.equal(f.notices(),1);assert.equal(f.calls.length,1);
});

test('HTTP failures, invalid JSON and request rejection are silent even if the body says true',async()=>{
  for (const fetch of [async()=>({ok:false,json:async()=>({err_code:0,data:{has_update:true}})}),
    async()=>({ok:true,json:async()=>{throw new Error('invalid json');}})]) {
    const f=fixture();f.env.fetch=fetch;f.check('page_display');await f.tick(0);assert.equal(f.notices(),0);
  }
});

test('all filter purposes share one rolling ten-second gate and retain the latest trailing action',async()=>{
  const f=fixture();f.check('filter_results');await f.tick(100);
  f.check('filter_featured_toggle');await f.tick(100);f.check('filter_reset','latest');
  await f.tick(9799);assert.equal(f.calls.length,1);
  await f.tick(1);assert.equal(f.calls.length,2);
  assert.equal(f.calls[1].payload.purpose,'filter_reset');assert.equal(f.calls[1].payload.context.model_slug,'latest');
  assert.equal(f.calls[1].cache,'no-store');assert.equal(f.calls[1].credentials,'omit');
});

test('continuous search debounces; a newer search replaces a pending filter',async()=>{
  const f=fixture();f.check('filter_search','a');await f.tick(200);f.check('filter_search','ab');
  await f.tick(399);assert.equal(f.calls.length,0);await f.tick(1);assert.equal(f.calls.length,1);
  f.check('filter_results');await f.tick(9900);f.check('filter_search','abc');
  await f.tick(399);assert.equal(f.calls.length,1);await f.tick(1);assert.equal(f.calls.length,2);
  assert.equal(f.calls[1].payload.context.model_slug,'abc');
});

test('a pending request never blocks caller or other purposes; identical in-flight checks deduplicate',async()=>{
  const f=fixture();let finish;
  f.env.fetch=async()=>new Promise(resolve=>{finish=resolve;});
  assert.equal(f.check('page_display'),undefined);f.check('page_display');
  finish({ok:true,json:async()=>({err_code:0,data:{has_update:false}})});await f.tick(0);
});

test('page types distinguish static guides and articles',()=>{
  for(const [url,type] of [['/','home'],['/models/','models'],['/platforms/','platforms'],['/platforms/codex/','platform_guide'],['/articles/','articles'],['/articles/news/example/','article']])assert.equal(pageType(url),type);
});
