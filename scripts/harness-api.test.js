const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('./entity-data.js');
const F = require('./filter-state.js');
const G = require('./purchase-guide.js');
const Cards = require('./platform-catalog.js');
const Detail = require('./platform-detail.js');
const Offers = require('./offer-results.js');

function context() {
  const platforms = [{slug:'yes',supportsHarnessApi:true}, {slug:'no',supportsHarnessApi:false}, {slug:'unknown',supportsHarnessApi:null}];
  const plans = [
    {slug:'inherit',platformSlug:'yes'}, {slug:'go',platformSlug:'yes',supportsHarnessApi:false},
    {slug:'opt-in',platformSlug:'no',supportsHarnessApi:true}, {slug:'closed',platformSlug:'no'},
    {slug:'unknown',platformSlug:'unknown'}, {slug:'api',platformSlug:'yes',billingMode:'payg'}
  ].map(p=>({name:p.slug,billingMode:'subscription',monthlyPrice:10, ...p}));
  const models = [{slug:'a',name:'A'},{slug:'b',name:'B'}];
  const planModels = plans.map(p=>({slug:p.slug+'-a',planSlug:p.slug,modelSlug:'a',usage:{monthlyTokenInM:100,unitPriceCnyPerM:1}}));
  planModels.push({slug:'go-b',planSlug:'go',modelSlug:'b',usage:{monthlyTokenInM:100}});
  return E.buildContext(...[platforms,plans,models,planModels].map((items,i)=>({schemaVersion:1,[['platforms','plans','models','planModels'][i]]:items})));
}
const all = patch => F.normalizeState({platformStatusMax:'delisted',includeDiscontinued:true,...patch});

test('三态平台默认与 boolean 套餐覆盖，false 不回落，不改源实体', () => {
  for (const value of [true,false,null]) {
    const platform = {supportsHarnessApi:value};
    for (const override of [true,false,undefined]) {
      const plan = override === undefined ? {} : {supportsHarnessApi:override};
      assert.equal(E.resolveHarnessApi(platform,plan),override === undefined ? value : override);
    }
    assert.equal(E.resolveHarnessApi(platform),value);
  }
  assert.equal(E.resolveHarnessApi(null,{}),null);
  const c=context(), before=JSON.stringify(c.plans);
  const catalog=E.buildPlanCatalog(c,{includeHidden:true});
  assert.equal(catalog.find(p=>p.slug==='go').supportsHarnessApi,false);
  assert.equal(catalog.find(p=>p.slug==='inherit').supportsHarnessApi,true);
  assert.equal(catalog.find(p=>p.slug==='unknown').supportsHarnessApi,null);
  assert.equal(JSON.stringify(c.plans),before);
});

test('能力仅用于展示，旧筛选状态不影响资格、视图投影或排序', () => {
  const c=context(), plain=all({}), state={...plain,harnessApiOnly:true}, opts={context:c};
  const expected=['inherit','go','opt-in','closed','unknown','api'];
  const offers=F.matchingOffers(c,state);
  assert.deepEqual(offers.map(x=>x.plan.slug),expected);
  assert.deepEqual(offers.map(x=>x.supportsHarnessApi),[true,false,true,false,null,true]);
  assert.deepEqual(offers,F.matchingOffers(c,plain));
  assert.equal(Object.hasOwn(F.normalizeState(state),'harnessApiOnly'),false);
  const points=E.buildComparisonPoints(c,7,{includeUnknown:true});
  assert.deepEqual(F.filterPoints(points,state,opts).map(x=>x.planSlug),[...expected,'go']);
  assert.deepEqual(F.filterPoints(points,state).map(x=>x.planSlug),[...expected,'go']);
  const plans=E.buildPlanCatalog(c,{includeHidden:true});
  assert.deepEqual(F.filterPlans(plans,state,opts).map(x=>x.slug),expected);
  assert.deepEqual(F.filterPlans(plans,state).map(x=>x.slug),expected);
  assert.deepEqual(F.filterPlatforms(c.platforms,state,opts).map(x=>x.slug),['yes','no','unknown']);
  assert.deepEqual(F.filterPlatforms(c.platforms,state).map(x=>x.slug),['yes','no','unknown']);
  assert.deepEqual(F.matchingOffers(c,all({harnessApiOnly:true,apiOnly:true})).map(x=>x.plan.slug),['api']);
  assert.deepEqual(F.matchingOffers(c,all({harnessApiOnly:true,platformSlugs:['yes'],modelSlugs:['a','b'],modelMatch:'all'})).map(x=>x.plan.slug),['go']);
  assert.deepEqual(G.recommend(c,state,{}, {allMatching:true}),G.recommend(c,plain,{}, {allMatching:true}));
  const result=G.recommend(c,all({platformSlugs:['unknown'],harnessApiOnly:true}),{}, {allMatching:true});
  assert.equal(result.candidates[0].plan.slug,'unknown');
  assert.ok(!result.conflicts.some(x=>x.key==='harnessApiOnly'));
});

test('旧工具条件不再限制或排序，默认/清空不要求 API 接入', () => {
  const c=context(), legacy=all({tool:'other'}), plain=all({});
  assert.equal(Object.hasOwn(legacy,'tool'),false);
  assert.equal(Object.hasOwn(F.createDefaultState({}),'harnessApiOnly'),false);
  assert.deepEqual(G.recommend(c,legacy,{}, {allMatching:true}),G.recommend(c,plain,{}, {allMatching:true}));
});

test('标签区分待确认和不支持，平台例外与套餐最终值展示一致', () => {
  const c=context(), platform=c.platforms[0];
  assert.match(E.harnessApiBadge(null),/data-harness-api="unknown".*待确认/);
  assert.match(Cards.buildPlatformCardHtml(platform,c.plans),/部分套餐支持 Harness API/);
  const html=Detail.buildDetailBodyHtml(platform,{plans:c.plans});
  assert.match(html,/部分套餐支持 Harness API/);
  assert.match(html,/不支持 Harness API/);
  const offer=G.recommend(c,all({platformSlugs:['yes']}),{}, {allMatching:true}).candidates.find(x=>x.plan.slug==='go');
  assert.match(Offers.card(offer,all({})),/data-harness-api="false"/);
  assert.doesNotMatch(Offers.card(offer,all({})),/data-harness-api="true"/);
});

test('方案卡片只显示非开放状态和明确不支持的能力，不渲染空标签行', () => {
  const base=G.recommend(context(),all({}),{}, {allMatching:true}).candidates.find(x=>x.plan.slug==='inherit');
  for(const [platformStatus,capability,discontinued,expectedStatus] of [
    ['open',true,false,null],['open',null,false,null],['open',false,false,null],
    ['limited',true,false,'定时放量'],['paused',false,false,'暂时停售'],
    ['delisted',null,false,'已下架'],['open',true,true,'已下架']
  ]) {
    const item={...base,platform:{...base.platform,platformStatus,supportsHarnessApi:capability},plan:{...base.plan,discontinued}};
    const html=Offers.card(item,all({}));
    assert.doesNotMatch(html,/>开放购买</);
    assert.doesNotMatch(html,/data-harness-api="(?:true|unknown)"/);
    assert.equal(html.includes('class="offer-capabilities"'),!!expectedStatus||capability===false);
    assert.equal(html.includes('class="offer-status"'),!!expectedStatus);
    if(expectedStatus)assert.ok(html.includes(`>${expectedStatus}</span>`));
    assert.equal(html.includes('data-harness-api="false"'),capability===false);
  }
});

test('当前目录按用户确认完整分类，Command Go 为唯一覆盖', () => {
  const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  const platforms=read('platforms.json').platforms, plans=read('plans.json').plans;
  assert.equal(platforms.length,43);
  assert.equal(platforms.filter(p=>p.supportsHarnessApi===true).length,28);
  assert.deepEqual(platforms.filter(p=>p.supportsHarnessApi===false).map(p=>p.slug).sort(),['claude','codex','github','qoder-cn','qoder-intl','trae-cn','trae-intl','workbuddy']);
  assert.deepEqual(platforms.filter(p=>p.supportsHarnessApi===null).map(p=>p.slug).sort(),['baidu-qianfan-coding-legacy','minimax-coding-legacy','stepfun','tencent-cloud-coding-legacy','unicom-cloud-coding-legacy','zhipu-coding-legacy','zhipu-intl-coding-legacy']);
  assert.deepEqual(plans.filter(p=>Object.hasOwn(p,'supportsHarnessApi')).map(p=>[p.slug,p.supportsHarnessApi]),[['commandcode-go',false]]);
  const command=platforms.find(p=>p.slug==='command-code');
  for (const p of plans.filter(p=>p.platformSlug===command.slug)) assert.equal(E.resolveHarnessApi(command,p),p.slug!=='commandcode-go');
  assert.ok(platforms.every(p=>!Object.hasOwn(p,'externalUsage')));
});
