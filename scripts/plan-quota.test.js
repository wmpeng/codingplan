const test = require('node:test');
const assert = require('node:assert/strict');
const Quota = require('./plan-quota');
const plan = {slug:'p', platformSlug:'platform', platformName:'平台', name:'套餐', note:'共享池，窗口限制同时适用。'};
const row = (slug, modelSlug, method, usage, extra = {}) => ({slug, modelSlug, method, usage, ...extra});
const rows = [
  row('a-peak','a','calculated',{fiveHourTokenInM:0, weeklyTokenInM:'unlimited', monthlyTokenInM:100},{timeTier:'峰',note:'模型专属限制 <说明>'}),
  row('a-offpeak','a','calculated',{monthlyTokenInM:200},{timeTier:'谷',note:'模型专属限制 <说明>'}),
  row('b','b','unknown',{monthlyTokenInM:'unknown'})
];
const context = {relationsByPlanSlug:new Map([['p',rows]]),modelBySlug:new Map([['a',{slug:'a',name:'模型 A'}],['b',{slug:'b',name:'模型 B'}]])};

test('明细按上方模型标签的精选优先顺序分组，同模型档位保留原序且不改源顺序', () => {
  const source = [rows[0],rows[2],rows[1]];
  const data = {...context,relationsByPlanSlug:new Map([['p',source]]),modelGroups:[{modelSlugs:['b']},{enabled:false,modelSlugs:['a']}]};
  const snapshot=JSON.stringify(source);
  assert.deepEqual(Quota.rows(plan,data,{}).map(r=>r.slug),['b','a-peak','a-offpeak']);
  assert.deepEqual(Quota.rows(plan,data,{modelSlugs:['a']}).map(r=>r.slug),['a-peak','a-offpeak']);
  assert.deepEqual(Quota.rows({...plan,supportedModels:[{slug:'b'},{slug:'a'}]},context,{}).map(r=>r.slug),['b','a-peak','a-offpeak']);
  assert.equal(JSON.stringify(source),snapshot);
});

test('默认额度明细按头部、甜品排列，保持同模型档位顺序', () => {
  const data={...context,modelGroups:[{id:'high-volume-models',modelSlugs:['a']},{id:'sota-models',modelSlugs:['b']}]};
  assert.deepEqual(Quota.rows(plan,data,{}).map(row=>row.slug),['b','a-peak','a-offpeak']);
});

test('明细与摘要按同一模型选择，保留该模型全部档位而不聚合额度', () => {
  assert.deepEqual(Quota.rows(plan, context, {modelSlugs:['a']}).map(r=>r.slug),['a-peak','a-offpeak']);
  for(const modelSlugs of [[],null]) assert.equal(Quota.rows(plan,context,{modelSlugs}).length,3);
  const html=Quota.render(plan,context,{modelSlugs:['a'],tokenUnit:'yi'});
  assert.match(html,/模型 A/);assert.doesNotMatch(html,/模型 B/);
  assert.match(html,/<td>1 亿<\/td>/);assert.match(html,/<td>2 亿<\/td>/);assert.match(html,/\[峰\]/);assert.match(html,/\[谷\]/);
  assert.equal((html.match(/扣减估算/g)||[]).length,1);assert.doesNotMatch(html,/>口径</);
});

test('零、未知和无限制保持各自语义；移除口径列并在标题合并标注，单位换算不改源', () => {
  const snapshot=JSON.stringify(context.relationsByPlanSlug.get('p'));
  const html=Quota.render(plan,context,{modelSlugs:null,tokenUnit:'M'});
  assert.match(html,/<td>0 M<\/td>/);assert.match(html,/<td>不限量<\/td>/);assert.match(html,/<td>未知<\/td>/);
  assert.doesNotMatch(html,/>口径</);assert.doesNotMatch(html,/plan-quota-method/);
  assert.match(html,/plan-quota-basis">扣减估算 · 待确认/);
  assert.match(html,/<td>100 M<\/td>/);assert.match(html,/<td>200 M<\/td>/);
  assert.equal(JSON.stringify(context.relationsByPlanSlug.get('p')),snapshot);
});

test('额度明细按各窗口原值稳定排序，未知始终排后，无限制大于有限值，默认顺序可恢复', () => {
  const source = [
    row('unknown','a','unknown',{}),
    row('large','a','measured',{monthlyTokenInM:200,weeklyTokenInM:5,fiveHourTokenInM:2}),
    row('zero','b','measured',{monthlyTokenInM:0,weeklyTokenInM:10,fiveHourTokenInM:0}),
    row('tie','b','measured',{monthlyTokenInM:200,weeklyTokenInM:0}),
    row('unlimited','c','officialQuota',{monthlyTokenInM:'unlimited',weeklyTokenInM:'unlimited',fiveHourTokenInM:'unlimited'})
  ];
  const data={...context,relationsByPlanSlug:new Map([['p',source]])};
  const snapshot=JSON.stringify(source),ids=(sort,state={})=>Quota.rows(plan,data,state,sort).map(r=>r.slug);
  let sort=Quota.cycleSort(null,'monthlyTokenInM');
  assert.deepEqual(ids(sort),['zero','large','tie','unlimited','unknown']);
  sort=Quota.cycleSort(sort,'monthlyTokenInM');
  assert.deepEqual(ids(sort),['unlimited','large','tie','zero','unknown']);
  assert.deepEqual(ids(sort,{modelSlugs:['b']}),['tie','zero']);
  sort=Quota.cycleSort(sort,'monthlyTokenInM');assert.equal(sort,null);
  assert.deepEqual(ids(sort),source.map(r=>r.slug));
  assert.deepEqual(ids({key:'weeklyTokenInM',direction:'asc'}),['tie','large','zero','unlimited','unknown']);
  assert.deepEqual(ids({key:'fiveHourTokenInM',direction:'desc'}),['unlimited','large','zero','unknown','tie']);
  assert.equal(Quota.cycleSort(null,'invalid'),null);
  const html=Quota.render(plan,data,{tokenUnit:'M'},{sort:{key:'monthlyTokenInM',direction:'desc'}});
  assert.match(html,/aria-sort="descending"><button[^>]+data-plan-quota-sort="monthlyTokenInM"/);
  assert.match(html,/每月用量：恢复默认顺序/);
  assert.equal(JSON.stringify(source),snapshot);
});

test('未知月额度仍可查看请求额度和限制，全未知短窗口不增加空列', () => {
  const html=Quota.render({...plan,requestQuota:{fiveHours:0,weekly:'unknown',monthly:'unlimited'}},context,{modelSlugs:['b'],tokenUnit:'B'});
  assert.match(html,/请求额度/);assert.match(html,/<strong>0<\/strong>/);assert.match(html,/<strong>无限制<\/strong>/);
  assert.match(html,/<td>未知<\/td>/);assert.doesNotMatch(html,/<th scope="col">5 小时/);assert.doesNotMatch(html,/<th scope="col">每周/);
  assert.match(html,/共享池，窗口限制同时适用/);
});

test('共享提示只显示一次，相同长说明合并且默认折叠，安全转义并定位完整套餐', () => {
  const html=Quota.render(plan,context,{modelSlugs:null,tokenUnit:'yi'});
  assert.equal((html.match(/各模型参考额度不相加/g)||[]).length,1);
  assert.equal((html.match(/模型专属限制 &lt;说明&gt;/g)||[]).length,1);
  assert.match(html,/<details[^>]*data-plan-quota-notes="p">/);
  assert.match(html,/\/pricing\/\?platform=platform&amp;plan=p/);
  assert.match(Quota.render(plan,context,{tokenUnit:'yi'},{notesOpen:true}),/data-plan-quota-notes="p" open/);
  const empty=Quota.render({...plan,slug:'absent'},context,{tokenUnit:'yi'});
  assert.match(empty,/暂无所选模型/);assert.match(empty,/额度说明与限制/);assert.doesNotMatch(empty,/<table/);
});
