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

test('能力筛选沿同套餐判断，订阅与按量共同生效，全部视图投影一致', () => {
  const c=context(), state=all({harnessApiOnly:true}), opts={context:c};
  const expected=['inherit','opt-in','api'];
  assert.deepEqual(F.matchingOffers(c,state).map(x=>x.plan.slug),expected);
  const points=E.buildComparisonPoints(c,7,{includeUnknown:true});
  assert.deepEqual(F.filterPoints(points,state,opts).map(x=>x.planSlug),expected);
  assert.deepEqual(F.filterPoints(points,state).map(x=>x.planSlug),expected);
  const plans=E.buildPlanCatalog(c,{includeHidden:true});
  assert.deepEqual(F.filterPlans(plans,state,opts).map(x=>x.slug),expected);
  assert.deepEqual(F.filterPlans(plans,state).map(x=>x.slug),expected);
  assert.deepEqual(F.filterPlatforms(c.platforms,state,opts).map(x=>x.slug),['yes','no']);
  assert.deepEqual(F.matchingOffers(c,all({harnessApiOnly:true,apiOnly:true})).map(x=>x.plan.slug),['api']);
  assert.equal(F.matchingOffers(c,all({harnessApiOnly:true,platformSlugs:['yes'],modelSlugs:['a','b'],modelMatch:'all'})).length,0);
  assert.ok(G.recommend(c,state,{}, {allMatching:true}).candidates.every(x=>x.supportsHarnessApi===true));
  const result=G.recommend(c,all({platformSlugs:['unknown'],harnessApiOnly:true}),{}, {allMatching:true});
  assert.ok(result.conflicts.some(x=>x.key==='harnessApiOnly' && x.count===1));
});

test('旧工具条件不再限制或排序，默认/清空不要求 API 接入', () => {
  const c=context(), legacy=all({tool:'other'}), plain=all({});
  assert.equal(Object.hasOwn(legacy,'tool'),false);
  assert.equal(F.createDefaultState({}).harnessApiOnly,false);
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
