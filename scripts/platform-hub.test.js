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
  const matches = Filters.filterPlatforms(platforms, state, options.filterOptions);
  const result = Hub.select(platforms, state, options);
  assert.deepEqual(result.results.map(p=>p.slug), [
    ...matches.filter(p=>featuredSlugs.includes(p.slug)), ...matches.filter(p=>!featuredSlugs.includes(p.slug))
  ].map(p=>p.slug));
});
test('被搜索与模型条件排除的置顶平台仍保留，不计入匹配数', () => {
  const pinnedIds = [featuredSlugs[0], platforms.find(p=>!featuredSlugs.includes(p.slug)).slug];
  const result = Hub.select(platforms, {...state, modelSlugs:['__missing']}, {...options, pinnedIds, query:'__missing'});
  assert.deepEqual(result.pinned.map(p=>p.slug), pinnedIds);
  assert.equal(result.matchedCount, 0);
  assert.equal(result.results.length, 0);
  assert.deepEqual(result.visible.map(p=>p.slug),pinnedIds);
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
