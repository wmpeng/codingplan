const test = require('node:test');
const assert = require('node:assert/strict');
const Directory = require('./model-directory');
const Catalog = require('./featured-catalog');
const models = [
  {slug:'ordinary',name:'A',scores:{artificialAnalysis:{score:100},deepSWE:{score:50}}},
  {slug:'featured-b',name:'C',scores:{artificialAnalysis:{score:5},deepSWE:{score:20}}},
  {slug:'pinned',name:'Z',scores:{artificialAnalysis:{score:1}},modalities:{input:['text']}},
  {slug:'featured-a',name:'B',scores:{artificialAnalysis:{score:10},deepSWE:{score:30}},modalities:{input:['image']}},
  {slug:'unknown',name:'D',scores:{}}
];
const groups = [{id:'featured',enabled:true,modelSlugs:['featured-a','featured-b']},{id:'disabled',enabled:false,modelSlugs:['ordinary']}];
test('所有排序始终置顶、精选、普通优先，默认保留目录顺序，分数未知排后', () => {
  const ids = sort => Directory.select(models,groups,{sort},['pinned']).visible.map(model=>model.slug);
  assert.deepEqual(ids('default'),['pinned','featured-b','featured-a','ordinary','unknown']);
  for(const sort of ['name','artificialAnalysis','deepSWE']) assert.deepEqual(ids(sort),['pinned','featured-a','featured-b','ordinary','unknown']);
  assert.deepEqual(models.map(model=>model.slug),['ordinary','featured-b','pinned','featured-a','unknown']);
});
test('置顶绕过搜索分组和图片条件，不计入匹配数，重复和失效置顶去除', () => {
  const empty=Directory.select(models,groups,{query:'missing',group:'featured',image:true},['pinned','pinned','missing']);
  assert.deepEqual(empty.visible.map(model=>model.slug),['pinned']);
  assert.equal(empty.matchedCount,0);assert.equal(Directory.countLabel(empty),'符合条件 0 个 · 置顶 1 个');
  assert.deepEqual(Directory.select(models,groups,{group:'featured',image:true},['pinned']).visible.map(model=>model.slug),['pinned','featured-a']);
});
test('模型置顶独立持久化，失效值和存储失败不会破坏目录', () => {
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  Directory.writePins(storage,['ordinary','ordinary','missing']);assert.deepEqual(Directory.readPins(storage,models),['ordinary']);
  const broken={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
  assert.deepEqual(Directory.readPins(broken,models),[]);assert.doesNotThrow(()=>Directory.writePins(broken,[]));
});
test('模型收录平台数排除下架套餐及平台，保留受限渠道并去重；首页卡片不增加标记与置顶', () => {
  const plans=[{slug:'active',platformSlug:'p',planStatus:'open'},{slug:'restricted',platformSlug:'r',planStatus:'restricted'},{slug:'old-plan',platformSlug:'x',planStatus:'delisted'},{slug:'old-platform',platformSlug:'old',planStatus:'open'}];
  const context={planModels:[...plans,plans[0]].map(plan=>({modelSlug:'ordinary',planSlug:plan.slug})),planBySlug:new Map(plans.map(plan=>[plan.slug,plan])),platformBySlug:new Map(['p','r','x','old'].map(slug=>[slug,{platformStatus:slug==='old'?'delisted':slug==='r'?'restricted':'open'}]))};
  const html=Catalog.modelCard(models[0],context);assert.match(html,/2 个平台收录/);assert.doesNotMatch(html,/data-model-pin|model-featured-badge/);
  const decorated=Catalog.modelCard(models[0],context,{directory:true,featured:true,pinned:true});
  assert.match(decorated,/is-featured is-pinned/);assert.match(decorated,/model-featured-badge/);assert.match(decorated,/aria-pressed="true"/);
});
