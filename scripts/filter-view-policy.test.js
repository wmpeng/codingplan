const test = require('node:test');
const assert = require('node:assert/strict');
const Filters = require('./filter-state');

const views = [
  {name:'home', options:{}, platformSlugs:null, modelSlugs:null, history:false, max:'restricted', planOnly:false},
  {name:'pricing', options:{mode:'full',view:'pricing'}, platformSlugs:null, modelSlugs:null, history:false, max:'delisted', planOnly:true},
  {name:'platforms', options:{mode:'full',view:'platforms'}, platformSlugs:null, modelSlugs:[], history:false, max:'restricted', planOnly:false},
  {name:'plans', options:{mode:'full',view:'plans'}, platformSlugs:[], modelSlugs:[], history:false, max:'delisted', planOnly:true},
  {name:'monitor', options:{mode:'full',view:'monitor'}, platformSlugs:null, modelSlugs:null, history:true, max:'delisted', planOnly:false}
];

test('五类页面的默认条件和重置快照保持各自口径，单位和配置输入不被修改', () => {
  for(const view of views) {
    const config={homepageFilters:{defaults:{modelGroup:'sota-models',modelMatch:'all'}}};
    const before=JSON.stringify(config), policy=Filters.createViewPolicy(view.options);
    const initial=policy.createDefaults(config,'B'), reset=Filters.cloneControlState(initial);
    assert.deepEqual(initial.platformSlugs,view.platformSlugs,view.name);
    assert.deepEqual(initial.modelSlugs,view.modelSlugs,view.name);
    assert.equal(initial.includeDiscontinued,view.history,view.name);
    assert.equal(initial.platformStatusMax,view.max,view.name);
    assert.equal(initial.planStatusOnly,view.planOnly,view.name);
    assert.equal(initial.modelGroup,'any'); assert.equal(initial.modelMatch,'any');
    assert.equal(initial.tokenUnit,'B');
    reset.budgetCny={max:10}; reset.modelSlugs=['custom'];
    assert.deepEqual(policy.createDefaults(config,'B'),initial);
    assert.deepEqual(policy.constrain(Filters.cloneControlState(initial)),initial);
    assert.equal(JSON.stringify(config),before);
  }
});

test('公开状态规范化保持兼容，控件快照保留空勾选并隔离所有可变字段', () => {
  const raw={platformSlugs:[],modelSlugs:[],excludedPlatformStatuses:['restricted'],excludedPlanStatuses:['restricted'],
    budgetCny:{max:50},monthlyTokenRange:{min:100},priceRanges:{monthlyPrice:{max:20}},requestRanges:{weekly:{max:10}}};
  const before=JSON.stringify(raw), copy=Filters.cloneControlState(raw);
  assert.equal(Filters.cloneState(raw).platformSlugs,null);
  assert.deepEqual(copy.platformSlugs,[]);assert.deepEqual(copy.modelSlugs,[]);
  copy.platformSlugs.push('platform'); copy.modelSlugs.push('model');
  copy.excludedPlatformStatuses.length=0; copy.excludedPlanStatuses.length=0;
  copy.budgetCny.max=0;copy.monthlyTokenRange.min=0;
  copy.priceRanges.monthlyPrice.max=0;copy.requestRanges.weekly.max=0;
  assert.equal(JSON.stringify(raw),before);
  for(const platformSlugs of [null,[' a ','a',null]]) {
    const input={platformSlugs};
    assert.deepEqual(Filters.cloneControlState(input),Filters.cloneState(input));
  }
});

test('每次更新重施页面限制，不能通过控制器打开不适用的历史、工具或境内条件', () => {
  for(const view of views) {
    const policy=Filters.createViewPolicy(view.options);
    const input=Filters.cloneControlState({platformSlugs:['p'],modelSlugs:['m'],budgetCny:{max:25},
      platformStatusMax:'open',excludedPlatformStatuses:['restricted'],excludedPlanStatuses:['restricted'],
      includeDiscontinued:true,planStatusOnly:!view.planOnly,apiOnly:true,harnessApiRequired:true,
      domesticNetworkOnly:true,domesticPaymentOnly:false,imageRequired:true});
    const result=policy.constrain(input);
    assert.equal(result,input,'约束只更新调用者持有的控件状态');
    assert.equal(result.planStatusOnly,view.planOnly);
    assert.deepEqual(result.excludedPlatformStatuses,view.planOnly?[]:['restricted']);
    assert.deepEqual(result.excludedPlanStatuses,view.planOnly?['restricted']:[]);
    assert.equal(result.includeDiscontinued,!['home','platforms'].includes(view.name));
    assert.equal(result.apiOnly,view.name!=='plans');
    assert.equal(result.harnessApiRequired,view.name==='plans');
    assert.equal(result.domesticNetworkOnly,view.name==='platforms');
    assert.equal(result.domesticPaymentOnly,view.name==='platforms');
    assert.equal(result.imageRequired,false);
    assert.deepEqual(result.platformSlugs,view.name==='platforms'?null:['p']);
    assert.deepEqual(result.modelSlugs,['m']);assert.deepEqual(result.budgetCny,{min:null,max:25});
    const snapshot=Filters.cloneControlState(result);
    assert.deepEqual(policy.constrain(result),snapshot,'重复施加约束不再改变状态');
  }
});

test('目录全选模型与不限等价，严格同时支持和部分选择不被放宽', () => {
  const models=[{slug:'a'},{slug:'b'}];
  for(const selected of [null,[],['a'],['a','b']]) {
    const before=JSON.stringify(selected);
    const any=Filters.catalogModelSelection(selected,'any',models);
    assert.deepEqual(any,selected?.length===2?null:selected);
    assert.deepEqual(Filters.catalogModelSelection(selected,'all',models),selected);
    assert.deepEqual(Filters.catalogModelSelection(selected,'any',[]),selected);
    assert.equal(JSON.stringify(selected),before);
  }
});
