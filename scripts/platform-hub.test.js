const test = require('node:test');
const assert = require('node:assert/strict');
const Hub = require('./platform-hub');
const Filters = require('./filter-state');
const Entity = require('./entity-data');
const preset = require('../model-comparison-presets.json');
const context = Entity.buildContext(require('../platforms.json'), require('../plans.json'), require('../models.json'));
const platforms = Entity.listPlatforms(context);
const featuredSlugs = preset.platformSlugs;
const state = {...Filters.createDefaultState({}, {mode:'full'}), platformStatusMax:'restricted', includeDiscontinued:false};
const options = {featuredSlugs, filterOptions:{context, entityData:Entity, usdToCnyRate:7}};

test('平台中心在匹配范围内精选优先，组内保留目录顺序', () => {
  const matches = platforms.filter(p => p.platformStatus !== 'delisted');
  const result = Hub.select(platforms, state, options);
  assert.equal(Hub.countLabel(result,false), `${matches.length} / 共 ${platforms.length}`);
  assert.deepEqual(result.results.map(p=>p.slug), [
    ...matches.filter(p=>featuredSlugs.includes(p.slug)), ...matches.filter(p=>!featuredSlugs.includes(p.slug))
  ].map(p=>p.slug));
});
test('被搜索与模型条件排除的置顶平台仍保留，不计入匹配数', () => {
  const pinnedIds = [featuredSlugs[0], platforms.find(p=>!featuredSlugs.includes(p.slug)).slug];
  const result = Hub.select(platforms, {...state, modelSlugs:['__missing']}, {...options, pinnedIds, query:'__missing'});
  assert.deepEqual(result.pinned.map(p=>p.slug), pinnedIds);
  assert.equal(result.matchedCount, 0);
  assert.equal(Hub.countLabel(result,false), `0 / 共 ${platforms.length} · 置顶 2 个`);
  assert.equal(result.results.length, 0);
  assert.deepEqual(result.visible.map(p=>p.slug),pinnedIds);
});
test('平台浏览不依赖在售套餐，费用或用量筛选仍排除历史套餐并保留置顶', () => {
  const source = context.plans.find(plan => (context.relationsByPlanSlug.get(plan.slug) || []).some(row => context.modelBySlug.has(row.modelSlug)));
  const platform = context.platformBySlug.get(source.platformSlug);
  const historyContext = {...context, plans:[{...source, planStatus:'delisted'}]};
  const filterOptions = {...options.filterOptions, context:historyContext};
  const historical = {...state, platformStatusMax:'delisted', includeDiscontinued:true};
  assert.equal(Filters.filterPlatforms([platform], historical, filterOptions).length,1);
  const result = Hub.select([platform],historical,{...options,filterOptions,pinnedIds:[platform.slug]});
  assert.equal(result.matchedCount,1);
  assert.deepEqual(result.visible.map(p=>p.slug),[platform.slug]);
  for (const condition of [{budgetCny:{max:100}}, {monthlyTokenRange:{min:1}}]) {
    const filtered = Hub.select([platform], {...historical,...condition}, {...options,filterOptions,pinnedIds:[platform.slug]});
    assert.equal(filtered.matchedCount,0);
    assert.deepEqual(filtered.visible.map(p=>p.slug),[platform.slug]);
  }
  assert.equal(historical.includeDiscontinued,true);
  const retiredPlatform = {...platform, platformStatus:'delisted'};
  const activeContext = {...historyContext, plans:[{...source,planStatus:'open'}],
    platformBySlug:new Map(context.platformBySlug).set(platform.slug,retiredPlatform)};
  const activeOptions = {...options,filterOptions:{...filterOptions,context:activeContext}};
  assert.equal(Hub.select([retiredPlatform],state,activeOptions).matchedCount,0);
  assert.equal(Hub.select([retiredPlatform],historical,activeOptions).matchedCount,1);
});

test('包含下架平台且无套餐条件时可浏览完整目录，全选模型不形成隐藏限制', () => {
  for (const modelSlugs of [null, [], context.models.map(model=>model.slug)]) {
    const input = {...state, platformStatusMax:'delisted', modelSlugs};
    const before = JSON.stringify(input);
    const result = Hub.select(platforms,input,options);
    assert.equal(result.matchedCount,platforms.length);
    assert.equal(result.visible.length,platforms.length);
    assert.equal(JSON.stringify(input),before);
  }
});

test('平台本身的状态、境内条件、搜索和模型匹配仍独立生效', () => {
  const history = {...state, platformStatusMax:'delisted'};
  const domestic = Hub.select(platforms,{...history,domesticNetworkOnly:true,domesticPaymentOnly:true},options);
  assert.deepEqual(new Set(domestic.visible.map(p=>p.slug)),new Set(platforms.filter(p=>p.requiresOverseasNetwork===false && p.requiresOverseasPayment===false).map(p=>p.slug)));
  const available = Hub.select(platforms,{...history,excludedPlatformStatuses:['restricted']},options);
  assert.ok(available.visible.every(p=>p.platformStatus!=='restricted'));
  const target = platforms.find(p=>p.platformStatus==='delisted');
  assert.deepEqual(Hub.select(platforms,history,{...options,query:target.slug}).visible.map(p=>p.slug),[target.slug]);
  const modelSlugs = [context.models[0].slug];
  const matches = Filters.filterPlatforms(platforms,{...history,modelSlugs},options.filterOptions);
  assert.deepEqual(new Set(Hub.select(platforms,{...history,modelSlugs},options).visible.map(p=>p.slug)),new Set(matches.map(p=>p.slug)));
});

test('无套餐平台可浏览，预算、用量及组合条件只接受同一在售套餐', () => {
  const fixture = Entity.buildContext({schemaVersion:1,platforms:[
    {slug:'active',platformStatus:'open'}, {slug:'history',platformStatus:'restricted'},
    {slug:'retired',platformStatus:'delisted'}, {slug:'empty',platformStatus:'open'}
  ]},{schemaVersion:3,plans:[
    {slug:'cheap',platformSlug:'active',planStatus:'open',billingMode:'subscription',monthlyPrice:20,currency:'CNY',planModels:[{slug:'cheap-model',modelSlug:'m',usage:{monthlyTokenInM:10}}]},
    {slug:'large',platformSlug:'active',planStatus:'open',billingMode:'subscription',monthlyPrice:100,currency:'CNY',planModels:[{slug:'large-model',modelSlug:'n',usage:{monthlyTokenInM:1000}}]},
    ...['history','retired'].map(slug=>({slug,platformSlug:slug,planStatus:'delisted',billingMode:'subscription',monthlyPrice:0,currency:'CNY',planModels:[{slug:slug+'-model',modelSlug:'m',usage:{monthlyTokenInM:1000}}]}))
  ]},{schemaVersion:1,models:[{slug:'m'},{slug:'n'}]});
  const opts={filterOptions:{context:fixture,entityData:Entity}},input={...state,platformStatusMax:'delisted',includeDiscontinued:true};
  assert.equal(Hub.select(fixture.platforms,input,opts).matchedCount,4);
  for(const condition of [{budgetCny:{max:50}},{monthlyTokenRange:{min:100}},{budgetCny:{min:null,max:null}}]) {
    const result=Hub.select(fixture.platforms,{...input,...condition},opts);
    assert.equal(result.matchedCount,condition.budgetCny?.max===null?4:1);
    if(result.matchedCount===1)assert.equal(result.visible[0].slug,'active');
  }
  for(const condition of [{budgetCny:{max:0}},{budgetCny:{max:50},monthlyTokenRange:{min:100}}]) {
    assert.equal(Hub.select(fixture.platforms,{...input,...condition},opts).matchedCount,0);
  }
  assert.equal(Hub.select(fixture.platforms,{...input,modelSlugs:['m','n'],modelMatch:'all'},opts).matchedCount,0);
});
test('精选模式忽略所有条件，补回非精选置顶、去重且不改原状态', () => {
  const pinnedIds = [featuredSlugs[0], platforms.find(p=>!featuredSlugs.includes(p.slug)).slug];
  const input = {...state, modelSlugs:['__missing'], budgetCny:{min:null,max:0}, domesticNetworkOnly:true};
  const before = JSON.stringify(input);
  const result = Hub.select(platforms, input, {...options, featuredOnly:true, pinnedIds, query:'__missing'});
  assert.equal(result.matchedCount, featuredSlugs.length);
  assert.equal(result.extraPinnedCount, 1);
  const visible = [...result.pinned, ...result.results].map(p=>p.slug);
  assert.equal(new Set(visible).size, visible.length);
  assert.deepEqual(new Set(visible), new Set([...featuredSlugs,...pinnedIds]));
  assert.deepEqual(result.visible.map(p=>p.slug),visible);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Hub.countLabel(result,true), `精选 ${featuredSlugs.length} 个 · 置顶 1 个`);
  assert.equal(Hub.select(platforms,input,{...options,pinnedIds,query:'__missing'}).matchedCount,0);
});
