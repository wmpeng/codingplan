const test = require('node:test');
const assert = require('node:assert/strict');
const Directory = require('./model-directory');
const Catalog = require('./featured-catalog');
const models = [
  {slug:'ordinary',name:'A',scores:{artificialAnalysis:{score:100},deepSWE:{score:50}}},
  {slug:'featured-b',name:'C',scores:{artificialAnalysis:{score:5},deepSWE:{score:20}}},
  {slug:'pinned',name:'Z',scores:{artificialAnalysis:{score:1}},multimodal:false,modalities:{input:['text']}},
  {slug:'featured-a',name:'B',scores:{artificialAnalysis:{score:10},deepSWE:{score:30}},multimodal:true,modalities:{input:['image']}},
  {slug:'unknown',name:'D',scores:{}}
];
const groups = [{id:'featured',enabled:true,modelSlugs:['featured-a','featured-b']},{id:'disabled',enabled:false,modelSlugs:['ordinary']}];
test('所有排序始终置顶、精选、普通优先，默认精选按配置顺序，分数未知排后', () => {
  const ids = sort => Directory.select(models,groups,{sort},['pinned']).visible.map(model=>model.slug);
  assert.deepEqual(ids('default'),['pinned','featured-a','featured-b','ordinary','unknown']);
  for(const sort of ['name','artificialAnalysis','deepSWE']) assert.deepEqual(ids(sort),['pinned','featured-a','featured-b','ordinary','unknown']);
  assert.deepEqual(models.map(model=>model.slug),['ordinary','featured-b','pinned','featured-a','unknown']);
});
test('置顶绕过搜索和多模态条件，不计入匹配数，重复和失效置顶去除', () => {
  const empty=Directory.select(models,groups,{query:'missing',multimodal:true},['pinned','pinned','missing']);
  assert.deepEqual(empty.visible.map(model=>model.slug),['pinned']);
  assert.equal(empty.matchedCount,0);assert.equal(Directory.countLabel(empty),'符合条件 0 个 · 置顶 1 个');
  assert.deepEqual(Directory.select(models,groups,{multimodal:true},['pinned']).visible.map(model=>model.slug),['pinned','featured-a']);
});

test('精选模式互斥且忽略搜索与多模态，保留置顶、去重并仅统计额外置顶', () => {
  const grouped=[{id:'high-volume-models',modelSlugs:['featured-a']},{id:'sota-models',modelSlugs:['featured-b']},groups[1]];
  const all=Directory.select(models,grouped,{featuredMode:'all',query:'missing',multimodal:true},['pinned','featured-a']);
  assert.deepEqual(all.visible.map(model=>model.slug),['pinned','featured-a','featured-b']);
  assert.equal(Directory.countLabel(all),'精选 2 个 · 置顶 1 个');
  for(const [mode,slug] of [['high-volume-models','featured-a'],['sota-models','featured-b']]) {
    const selection=Directory.select(models,grouped,{featuredMode:mode,query:'missing',multimodal:true},['ordinary']);
    assert.deepEqual(selection.visible.map(model=>model.slug),['ordinary',slug]);
    assert.equal(Directory.countLabel(selection),'精选 1 个 · 置顶 1 个');
  }
  assert.equal(Directory.select(models,grouped,{featuredMode:'disabled'}).featuredMode,false);
  assert.equal(Directory.select(models,grouped,{featuredMode:''}).visible.length,models.length);
});

test('普通浏览和全部精选默认先头部级再甜品级，保留组内顺序、置顶及主动排序', () => {
  const grouped = [
    {id:'high-volume-models',modelSlugs:['featured-a']},
    {id:'sota-models',modelSlugs:['featured-b','unknown']}
  ];
  const ids = (state, pins=[]) => Directory.select(models,grouped,state,pins).visible.map(model=>model.slug);
  assert.deepEqual(ids({featuredMode:'all'}), ['featured-b','unknown','featured-a']);
  assert.deepEqual(ids({featuredMode:'all'}, ['ordinary','featured-a']), ['ordinary','featured-a','featured-b','unknown']);
  for (const sort of ['name','artificialAnalysis','deepSWE']) {
    assert.deepEqual(ids({featuredMode:'all',sort}), ['featured-a','featured-b','unknown']);
  }
  assert.deepEqual(ids({featuredMode:'sota-models'}), ['featured-b','unknown']);
  assert.deepEqual(ids({}), ['featured-b','unknown','featured-a','ordinary','pinned']);
  assert.deepEqual(ids({query:'featured'}), ['featured-b','featured-a']);
  assert.deepEqual(ids({}, ['ordinary','featured-a']), ['ordinary','featured-a','featured-b','unknown','pinned']);
});

test('多模态沿用实体布尔字段，包含非图片的音频或输出能力，未知不计入', () => {
  const modes=[{slug:'audio',name:'音频',multimodal:true,modalities:{input:['text','audio']}},
    {slug:'output',name:'输出',multimodal:true,modalities:{input:['text'],output:['text','audio']}},
    {slug:'legacy',name:'已确认',multimodal:true,modalities:null},
    {slug:'text',name:'文本',multimodal:false},{slug:'unknown',name:'未知',multimodal:'unknown'}];
  assert.deepEqual(Directory.select(modes,[],{multimodal:true}).visible.map(model=>model.slug),['audio','output','legacy']);
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
