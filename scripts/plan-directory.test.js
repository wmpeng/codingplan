const test = require('node:test');
const assert = require('node:assert/strict');
const Directory = require('./plan-directory');
const Filters = require('./filter-state');
const state = {...Filters.DEFAULTS};
const platforms = [{slug:'z',platformStatus:'open'},{slug:'a',platformStatus:'open'}];
const plans = [
  {slug:'usd',platformSlug:'z',platformName:'Z平台',name:'标准',monthlyPrice:10,currency:'$',planStatus:'open',monthlyTokenOptions:[{value:100}]},
  {slug:'free',platformSlug:'z',platformName:'Z平台',name:'免费',monthlyPrice:0,currency:'¥',planStatus:'open',monthlyTokenOptions:[{value:'unlimited'}]},
  {slug:'unknown',platformSlug:'a',platformName:'A平台',name:'未知',monthlyPrice:null,currency:'¥',planStatus:'open'},
  {slug:'retired',platformSlug:'a',platformName:'A平台',name:'旧版',monthlyPrice:5,currency:'¥',planStatus:'delisted'},
  {slug:'cny',platformSlug:'a',platformName:'A平台',name:'标准',monthlyPrice:50,currency:'¥',planStatus:'open'}
];
// No entity relations are needed for this catalog fixture; shared eligibility is tested separately.
const options = {context:{platforms},config:{usdToCnyRate:7}};
const ids = selection => selection.visible.map(plan => plan.slug);

test('精选套餐由精选平台与任一精选模型共同决定，暂停条件和搜索但保留额外置顶',()=>{
  const rows=[
    {...plans[0],slug:'featured-a',supportedModels:[{slug:'m1'}],monthlyTokenOptions:[{modelSlug:'m1',value:10},{modelSlug:'m2',value:1000}]},
    {...plans[0],slug:'featured-b',planStatus:'restricted',supportedModels:[{slug:'m1'},{slug:'m2'}],monthlyTokenOptions:[{modelSlug:'m1',value:50}]},
    {...plans[0],slug:'no-featured-model',supportedModels:[{slug:'m2'}]},
    {...plans[4],slug:'other-platform',supportedModels:[{slug:'m1'}]},
    {...plans[0],slug:'delisted',planStatus:'delisted',supportedModels:[{slug:'m1'}]},
    {...plans[0],slug:'no-models',supportedModels:[]}
  ];
  const context={platforms,models:[{slug:'m1'},{slug:'m2'}],featuredPlatformSlugs:['z'],modelGroups:[{modelSlugs:['m1']},{enabled:false,modelSlugs:['m2']}]};
  const saved={...state,modelSlugs:['m2'],budgetCny:{max:0},harnessApiRequired:true,excludedPlanStatuses:['restricted'],includeDiscontinued:true};
  const snapshot=JSON.stringify(saved);
  const selection=Directory.select(rows,saved,{...options,context,query:'不会匹配',featuredOnly:true,pins:['other-platform','featured-a','delisted'],sort:{key:'monthlyToken',direction:'desc'}});
  assert.deepEqual([...selection.featured],['featured-a','featured-b']);
  assert.deepEqual(new Set(ids(selection)),new Set(['featured-a','featured-b','other-platform','delisted']));
  assert.equal(selection.matchedCount,2);assert.equal(Directory.countLabel(selection),'精选 2 个套餐 · 置顶 2 个');
  assert.equal(ids(selection).filter(id=>id==='featured-a').length,1);
  assert.deepEqual(selection.effectiveState.modelSlugs,['m1']);assert.equal(JSON.stringify(saved),snapshot);
  const sorted=Directory.select(rows,saved,{...options,context,featuredOnly:true,sort:{key:'monthlyToken',direction:'desc'}});
  assert.deepEqual(ids(sorted),['featured-b','featured-a']);
  const normal=Directory.select(rows,saved,{...options,context,query:'不会匹配'});
  assert.equal(normal.matchedCount,0);assert.deepEqual([...normal.featured],['featured-a','featured-b']);
  for(const patch of [{featuredPlatformSlugs:[]},{modelGroups:[]}])assert.equal(Directory.select(rows,saved,{...options,context:{...context,...patch},featuredOnly:true}).matchedCount,0);
  const allFeatured=Directory.select(rows,saved,{...options,context:{...context,modelGroups:[{modelSlugs:['m1','m2']}]},featuredOnly:true});
  assert.equal(allFeatured.featured.has('no-models'),false);
});
test('默认按平台目录与月价排序，未知排后；价格统一换算且零价有效', () => {
  assert.deepEqual(ids(Directory.select(plans,state,options)),['free','usd','cny','unknown']);
  const sorted = direction => ids(Directory.select(plans,state,{...options,sort:{key:'monthlyPrice',direction}}));
  assert.deepEqual(sorted('asc'),['free','cny','usd','unknown']);
  assert.deepEqual(sorted('desc'),['usd','cny','free','unknown']);
});
test('置顶不被搜索、预算与历史筛选隐藏，不重复计入匹配数量', () => {
  const result=Directory.select(plans,{...state,budgetCny:{max:1}}, {...options,pins:['usd','retired','missing'],query:'标准'});
  assert.deepEqual(ids(result),['usd','retired']);
  assert.equal(result.matchedCount,0);
  assert.equal(Directory.countLabel(result),'0 / 5 个套餐 · 置顶 2 个');
  assert.equal(Directory.select(plans,state,{...options,pins:['usd'],query:'标准'}).visible.filter(p=>p.slug==='usd').length,1);
});
test('套餐置顶独立存储并过滤失效身份、重复身份和损坏记录', () => {
  const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
  Directory.writePins(storage,['usd','usd','missing']);
  assert.deepEqual(Directory.readPins(storage,plans),['usd']);
  assert.equal(store.has('codingplanPinnedModels'),false);
  storage.setItem(Directory.pinKey,'bad JSON');
  assert.deepEqual(Directory.readPins(storage,plans),[]);
});
test('购买状态取平台与套餐中更受限的一层', () => {
  for(const platform of ['open','restricted','delisted'])for(const plan of ['open','restricted','delisted']) {
    const expected=Filters.STATUS_RANK[plan]>Filters.STATUS_RANK[platform]?plan:platform;
    assert.equal(Directory.purchaseStatus({planStatus:plan},{platformStatus:platform}),expected);
  }
});
test('月额度排序保留无限制与未知的区别，API 参数不使订阅目录清空', () => {
  assert.deepEqual(ids(Directory.select(plans,state,{...options,sort:{key:'monthlyToken',direction:'desc'}})),['free','usd','unknown','cny']);
  assert.deepEqual(ids(Directory.select(plans,{...state,apiOnly:true},options)),ids(Directory.select(plans,state,options)));
});

test('请求额度排序读取嵌套窗口，零值有效，未知与缺省排后', () => {
  const rows = [
    {...plans[0], slug:'known', requestQuota:{weekly:4200}},
    {...plans[0], slug:'zero', requestQuota:{weekly:0}},
    {...plans[0], slug:'unlimited', requestQuota:{weekly:'unlimited'}},
    {...plans[0], slug:'unknown', requestQuota:{weekly:'unknown'}},
    {...plans[0], slug:'absent'}
  ];
  const sorted = direction => ids(Directory.select(rows,state,{...options,sort:{key:'requestQuota.weekly',direction}}));
  assert.deepEqual(sorted('asc'), ['zero','known','unlimited','unknown','absent']);
  assert.deepEqual(sorted('desc'), ['unlimited','known','zero','unknown','absent']);
  assert.deepEqual(ids(Directory.select(rows,{...state,requestRanges:{weekly:{min:0,max:4200}}},options)), ['known','zero']);
});

test('月 Token 按当前所选模型的最大档位排序，忽略未知并保留零值与无限制', () => {
  const row=(slug, values)=>({...plans[0],slug,modelSlugs:['m1','m2','m3'],monthlyTokenOptions:values.map(([modelSlug,value])=>({modelSlug,value}))});
  const rows=[
    row('a',[['m1',1],['m1',100],['m2',10],['m3','unlimited']]),
    row('b',[['m1',30],['m2',50]]),row('zero',[['m2',0]]),row('unknown',[['m2',null]])
  ];
  const sorted=(modelSlugs,direction='desc')=>ids(Directory.select(rows,{...state,modelSlugs},{...options,sort:{key:'monthlyToken',direction}}));
  assert.deepEqual(sorted(null),['a','b','zero','unknown']);
  assert.deepEqual(sorted(['m1']),['a','b','zero','unknown']);
  assert.deepEqual(sorted(['m1','m2']),['a','b','zero','unknown']);
  assert.deepEqual(sorted(['m2']),['b','a','zero','unknown']);
  assert.deepEqual(sorted(['m2'],'asc'),['zero','a','b','unknown']);
});

test('表头按升序、降序、默认循环，切换字段从升序开始', () => {
  let sort={key:'platformOrder',direction:'asc'};
  sort=Directory.cycleSort(sort,'monthlyPrice');assert.deepEqual(sort,{key:'monthlyPrice',direction:'asc'});
  sort=Directory.cycleSort(sort,'monthlyPrice');assert.deepEqual(sort,{key:'monthlyPrice',direction:'desc'});
  sort=Directory.cycleSort(sort,'monthlyPrice');assert.deepEqual(sort,{key:'platformOrder',direction:'asc'});
  sort=Directory.cycleSort({key:'monthlyPrice',direction:'desc'},'rating');assert.deepEqual(sort,{key:'rating',direction:'asc'});
});

test('使用生成后首月价格，不适用与真实零元保持区别且不反推月价', () => {
  const rows=[
    {...plans[0],slug:'monthly',firstMonthPrice:10},
    {...plans[4],slug:'offer',firstMonthPrice:20},
    {...plans[4],slug:'free',firstMonthPrice:0},
    {...plans[2],slug:'unknown',firstMonthPrice:'不适用'},
    {...plans[4],slug:'regular',firstMonthPrice:50}
  ];
  assert.equal(Directory.priceValue(rows[0],'firstMonthPrice'),10);
  assert.equal(Directory.priceValue(rows[1],'firstMonthPrice'),20);
  assert.equal(Directory.priceValue(rows[2],'firstMonthPrice'),0);
  assert.equal(Directory.priceValue(rows[3],'firstMonthPrice'),'不适用');
  assert.equal(Directory.priceValue({monthlyPrice:'不适用',quarterlyPrice:120},'monthlyPrice'),'不适用');
  for(const [direction,expected] of [['asc',['free','offer','regular','monthly','unknown']],['desc',['monthly','regular','offer','free','unknown']]]) {
    assert.deepEqual(ids(Directory.select(rows,state,{...options,sort:{key:'firstMonthPrice',direction}})),expected);
  }
  assert.equal(rows[3].firstMonthPrice,'不适用');
});
