const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Url = require('./filter-url');
const Filters = require('./filter-state');
const context = {platforms:[{slug:'codex'},{slug:'zhipu'}], models:[{slug:'gpt-6-astra'},{slug:'glm-5-3'}]};
const schema = Url.sharedSchema(context, Filters.createViewPolicy({mode:'full',view:'pricing'}));

test('筛选链接区分不限、空勾选与部分勾选，名单去重且保持选择顺序', () => {
  for (const selected of [null, [], ['glm-5-3','gpt-6-astra']]) {
    const url = Url.update('https://codingplan.fyi/pricing/', schema, {snapshot:true,modelSlugs:selected});
    assert.deepEqual(Url.read(schema,url.search).modelSlugs, selected);
  }
  assert.deepEqual(Url.read(schema,'?models=glm-5-3,missing,glm-5-3,gpt-6-astra').modelSlugs,['glm-5-3','gpt-6-astra']);
  assert.deepEqual(Url.read(schema,'?models=removed'),{});
});

test('预算和原始 M Token 数保留真实零、单侧及小数范围，无效值不生效', () => {
  for (const value of [{min:0,max:null},{min:null,max:200.5},{min:0.5,max:10},{min:1e-7,max:1e21}]) {
    const url = Url.update('https://codingplan.fyi/',schema,{monthlyTokenRange:value});
    assert.deepEqual(Url.read(schema,url.search).monthlyTokenRange,value);
  }
  for (const tokens of ['NaN,','Infinity,','-1,','100,2',',','1,2,3','true,']) {
    assert.deepEqual(Url.read(schema,'?tokens='+encodeURIComponent(tokens)),{});
  }
  assert.deepEqual(Url.read(schema,'?api=garbage&order=unknown&match=unexpected'),{});
});

test('只写所属参数，保留套餐关系深链、来源参数和章节锚点', () => {
  const input = 'https://codingplan.fyi/pricing/?platform=codex&model=old&billing=payg&plan=codex-plus&relation=r1&utm_source=test#pricingMethod';
  const url = Url.update(input,schema,{snapshot:true,platformSlugs:['zhipu'],modelSlugs:[],apiOnly:false},['platform','model','billing']);
  assert.equal(url.searchParams.get('platform'),null);
  assert.equal(url.searchParams.get('plan'),'codex-plus');
  assert.equal(url.searchParams.get('relation'),'r1');
  assert.equal(url.searchParams.get('utm_source'),'test');
  assert.equal(url.hash,'#pricingMethod');
  assert.equal(url.searchParams.get('api'),null);
  const local = {query:Url.text('q'), key:Url.choice('sort',['default','price'],'default')};
  const withSearch = Url.update(url.href,local,{query:'中文 + & 模型',key:'price'});
  assert.equal(Url.read(local,withSearch.search).query,'中文 + & 模型');
  assert.equal(withSearch.searchParams.get('models'),'none');
  assert.equal(withSearch.searchParams.get('sort'),'price');
});

test('URL 更新只替换当前历史，滑块待写值与其他区域更新合并，存储受限不阻断', () => {
  const events = {}, calls = [];
  const root = {
    URL, URLSearchParams, Symbol, setTimeout, clearTimeout,
    location:new URL('https://codingplan.fyi/pricing/#chart'),
    history:{state:{router:'preserve'},replaceState(state,unused,url) {calls.push({state,url}); root.location=new URL(url,root.location);}},
    addEventListener(name,handler) {events[name]=handler;}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./filter-url'),'utf8'),root);
  const api = root.CodingPlanFilterUrl;
  api.replace({query:api.text('q')},{query:'codex'},{delay:true});
  assert.equal(calls.length,0);
  api.replace({sort:api.choice('sort',['price'],'default')},{sort:'default'});
  assert.equal(calls.length,0,'未变的局部状态不能提前写入滑块的待处理值');
  api.replace({sort:api.choice('sort',['price'],'default')},{sort:'price'});
  assert.equal(calls.length,1);
  assert.equal(root.location.searchParams.get('q'),'codex');
  assert.equal(root.location.searchParams.get('sort'),'price');
  assert.deepEqual(calls[0].state,{router:'preserve'});
  api.replace({query:api.text('q')},{query:'codex'}); assert.equal(calls.length,1);
  api.replace({query:api.text('q')},{query:'glm'},{delay:true}); events.pagehide();
  assert.equal(root.location.searchParams.get('q'),'glm');
  let reloads = 0;
  root.location.reload=()=>{reloads++;};
  events.popstate(); assert.equal(reloads,0);
  root.location.search='';events.popstate();assert.equal(reloads,1);
  root.history.replaceState=()=>{throw new Error('denied');};
  assert.doesNotThrow(()=>api.clear({query:api.text('q')}));
});
