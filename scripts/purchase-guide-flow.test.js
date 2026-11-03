const test=require('node:test'),assert=require('node:assert/strict');
const Flow=require('./purchase-guide-flow'),F=require('./filter-state'),G=require('./purchase-guide'),E=require('./entity-data');
const {fixtureContext}=require('./test-fixtures.cjs');
function context(){
  return fixtureContext({schemaVersion:1,platforms:[{slug:'p',rating:5,platformStatus:'open',supportsHarnessApi:true,supportsDomestic:true},{slug:'codex',rating:4,platformStatus:'open',supportsHarnessApi:false,supportsDomestic:false}]},
    {plans:[{slug:'cheap',platformSlug:'p',billingMode:'subscription',monthlyPrice:10,currency:'¥'},{slug:'large',platformSlug:'p',billingMode:'subscription',monthlyPrice:100,currency:'¥'},{slug:'official',platformSlug:'codex',billingMode:'subscription',monthlyPrice:200,currency:'¥'}]},
    {schemaVersion:1,models:[{slug:'gpt-small',name:'Small',modalities:{input:['text'],output:['text']},scores:{artificialAnalysis:{score:30}}},{slug:'gpt-big',name:'Big',modalities:{input:['text','image'],output:['text']},scores:{artificialAnalysis:{score:60}}},{slug:'picture',name:'Picture',multimodal:true,modalities:{input:['text'],output:['image']}}]},
    {planModels:[{slug:'a',planSlug:'cheap',modelSlug:'gpt-small',usage:{monthlyTokenInM:100,fiveHourTokenInM:10}},{slug:'b',planSlug:'large',modelSlug:'gpt-big',usage:{monthlyTokenInM:1000}},{slug:'c',planSlug:'official',modelSlug:'gpt-big',usage:{monthlyTokenInM:500}}]});
}
test('每条路径都有用量题且在优先级前；用途影响估算，手填不重复乘系数',()=>{
  for(const start of ['new','existing']){const steps=Flow.steps({start});assert.equal(steps.indexOf('priority'),steps.indexOf('usage')+1);assert.equal(steps.includes('baseline'),start==='existing');}
  assert.ok(Flow.estimate({task:'coding',frequency:'daily',size:'normal'}).amount>Flow.estimate({task:'writing',frequency:'daily',size:'normal'}).amount);
  assert.equal(Flow.compile(context(),{usageMode:'known',tokens:125,task:'writing'}).state.monthlyTokenRange.min,125);
});
test('境内使用和图片转换成显式名单；空交集报错，不能退成不限',()=>{
  const c=context(),a={domestic:'required',image:'yes',modelKind:'any'};
  const {state,errors}=Flow.compile(c,a);assert.deepEqual(errors,[]);assert.deepEqual(state.platformSlugs,['p']);assert.deepEqual(state.modelSlugs,['gpt-big']);assert.equal(state.imageRequired,false);assert.equal(state.domesticNetworkOnly,false);
  assert.ok(Flow.compile(c,{...a,modelKind:'family',family:'claude'}).errors.length);
  const exact=Flow.compile(c,{...a,modelKind:'exact',exact:['gpt-small'],image:'yes'});assert.deepEqual(exact.state.modelSlugs,['gpt-small']);
  assert.deepEqual(Flow.compile(c,{modelKind:'any'}).state.modelSlugs,['gpt-small','gpt-big']);
});
test('境内要求排除未知和缺失，旧网络付款草稿采用相同综合条件',()=>{
  const c=context();
  c.platforms.push({slug:'unknown',supportsDomestic:null},{slug:'missing'});
  for (const answer of [{domestic:'required'},{network:'domestic'},{payment:'domestic'}])
    assert.deepEqual(Flow.compile(c,answer).state.platformSlugs,['p']);
  assert.deepEqual(Flow.compile(c,{domestic:'any'}).state.platformSlugs,['p','codex','unknown','missing']);
  c.platforms[0].supportsDomestic=null;
  assert.ok(Flow.compile(c,{domestic:'required'}).errors.some(text=>text.includes('境内使用')));
});
test('指定工具不等于通用 API；官方订阅可用，未知在待确认，套餐覆盖优先',()=>{
  const c=context(),s={usageEntry:'codex'};
  assert.deepEqual(F.matchingOffers(c,s).map(item=>item.plan.slug),['official']);
  const r=G.recommend(c,s,{}, {allMatching:true});assert.deepEqual(r.candidates.map(item=>item.id),['official']);assert.equal(r.pending.length,2);
  assert.equal(F.toolCompatibility({slug:'minimax',supportsHarnessApi:true},{billingMode:'subscription',supportsHarnessApi:false},'codex'),false);
  assert.equal(F.toolCompatibility({slug:'minimax',supportsHarnessApi:true},{billingMode:'subscription'},'codex'),true);
});
test('优先级按顺序比较，精选只破同分；全部模型的额度不相加',()=>{
  const c=context();
  assert.equal(G.recommend(c,{priorities:['cost','volume']},{},{allMatching:true}).candidates[0].id,'cheap');
  assert.equal(G.recommend(c,{priorities:['volume','cost']},{},{allMatching:true}).candidates[0].id,'large');
  c.featuredPlatformSlugs=['codex'];assert.equal(G.recommend(c,{priorities:['cost']},{},{allMatching:true}).candidates[0].id,'cheap');
  assert.equal(F.matchingOffers(c,{modelSlugs:['gpt-small','gpt-big'],modelMatch:'all'}).length,0);
});
test('无结果按优先级保护条件，展示牺牲项，保留工具和平台范围且不修改原条件',()=>{
  const c=context(),s={platformSlugs:['p'],modelSlugs:['gpt-big'],budgetCny:{max:20},monthlyTokenRange:{min:500},priorities:['cost','quality','volume']},before=JSON.stringify(s);
  const r=G.recommend(c,s,{}, {allMatching:true});assert.equal(r.candidates.length,0);assert.equal(r.alternatives[0].id,'cheap');assert.ok(r.alternatives[0].sacrifices.includes('模型范围'));assert.ok(!r.alternatives[0].sacrifices.includes('月预算'));assert.equal(JSON.stringify(s),before);
  const quality=G.recommend(c,{...s,priorities:['quality','volume','cost']},{},{allMatching:true});assert.equal(quality.alternatives[0].id,'large');assert.deepEqual(quality.alternatives[0].sacrifices,['月预算']);
  assert.ok(r.alternatives.every(item=>item.platform.slug==='p'));
  c.platformBySlug.get('codex').rating=6;
  const platformFirst=G.recommend(c,{...s,platformSlugs:null,priorities:['balanced','cost']},{},{allMatching:true});
  assert.equal(platformFirst.alternatives[0].id,'official','平台体验第一时，先比较平台评分，再考虑价格取舍');
});
test('预算或额度未知进入待确认；五小时额度不足不能靠月额度冒充已解决',()=>{
  const c=context();c.relationsByPlanSlug.get('large')[0].usage.monthlyTokenInM=null;
  const r=G.recommend(c,{monthlyTokenRange:{min:500}},{},{allMatching:true});assert.ok(r.pending.some(item=>item.id==='large' && item.unconfirmed.includes('月额度')));assert.ok(!r.candidates.some(item=>item.id==='large'));
  const item={...r.pending.find(item=>item.id==='large')};
  assert.match(Flow.baselineSummary(c,{start:'existing',plan:'cheap',pains:['fiveHours']},item,7).join(' '),/无法直接比较/);
});
test('真实目录模态字段和所有分支使用同一资格判断',()=>{
  const c=E.buildContext(require('../platforms.json'),require('../plans.json'),require('../models.json'));
  const featured=require('../featured-catalog.json');c.modelGroups=featured.groups;c.featuredPlatformSlugs=featured.platformSlugs;
  assert.ok(c.models.some(E.supportsImageInput));
  for(const entry of ['any','codex','claude-code','third-party','program'])for(const modelKind of ['any','top','balanced'])for(const domestic of ['any','required']){
    const result=Flow.compile(c,{entry,modelKind,domestic,usageMode:'estimate',frequency:'daily',size:'normal',task:'coding',priorities:['balanced','cost']});
    assert.deepEqual(result.errors,[]);
    const matched=F.matchingOffers(c,result.state,{usdToCnyRate:6.8});
    for(const item of matched){assert.equal(F.toolCompatibility(item.platform,item.plan,entry),true);assert.ok(item.rows.every(row=>result.state.modelSlugs.includes(row.modelSlug)));}
  }
});
