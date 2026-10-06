const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('./entity-data.js'),F=require('./filter-state.js'),G=require('./purchase-guide.js'),C=require('./featured-catalog.js'),M=require('./model-comparison.js'),R=require('./offer-results.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',n+'.json'),'utf8'));
const config=read('config'),preset=read('model-comparison-presets');
const ctx=E.buildContext(read('platforms'),read('plans'),read('models'),read('plan-models'));ctx.modelGroups=preset.groups;

test('精选来源完整、唯一，需求默认全量且不依赖精选名单',()=>{
  C.validate(preset,ctx);
  assert.equal(preset.groups.length,2);
  const state=F.createDefaultState(config);
  assert.equal(state.platformSlugs,null);assert.equal(state.modelSlugs,null);
  assert.equal(config.recommendationGroups,undefined);
  assert.throws(()=>C.validate({...preset,platformSlugs:['missing']},ctx),/无效平台/);
  assert.throws(()=>C.validate({...preset,groups:[preset.groups[0],{...preset.groups[1],modelSlugs:preset.groups[0].modelSlugs}]},ctx),/重复分组/);
});

test('所有符合条件的套餐和API关系都保留，筛选不能跨套餐拼接',()=>{
  for(const patch of [{},{modelSlugs:['gpt-6-sol']},{budgetCny:{max:100,min:null},monthlyTokenRange:{min:100,max:null}},{platformStatusMax:'delisted',includeDiscontinued:true}]){
    const state=F.normalizeState({...F.createDefaultState(config),...patch});
    const offers=F.matchingOffers(ctx,state,{usdToCnyRate:config.usdToCnyRate,platformCatalog:config.platformCatalog});
    const result=G.recommend(ctx,state,config,{allMatching:true});
    const expected=offers.flatMap(o=>o.plan.billingMode==='payg'?o.rows.map(r=>o.plan.slug+':'+r.slug):[o.plan.slug]);
    assert.deepEqual(new Set(result.candidates.map(c=>c.id)),new Set(expected));
    assert.equal(result.candidates.length,new Set(expected).size);
    for(const item of result.candidates){assert.ok(item.rows.every(r=>r.planSlug===item.plan.slug));assert.match(R.card(item,state),/data-offer-id/);}
  }
});

test('未知、零与按量费用分开显示，固定表不吞未知额度或混入下架方案',()=>{
  const group={id:'test',title:'模型',kind:'multi',modelSlugs:['m']};
  const points=[
    {slug:'unknown',platformSlug:'p',modelSlug:'m',billingMode:'subscription',unitPriceCnyPerM:null,monthlyTokenInM:null},
    {slug:'zero',platformSlug:'p',modelSlug:'m',billingMode:'subscription',unitPriceCnyPerM:0,monthlyTokenInM:0,monthlyFeeCny:0},
    {slug:'api',platformSlug:'p',modelSlug:'m',billingMode:'payg',unitPriceCnyPerM:1},
    {slug:'old',platformSlug:'p',modelSlug:'m',billingMode:'subscription',discontinued:true},
    {slug:'hidden',platformSlug:'p',modelSlug:'m',billingMode:'subscription',platformVisible:false}
  ];
  assert.equal(M.buildPresetComparisonRows(points,group,'all').length,3);
  const html=M.presetComparisonTableHtml(group,points,'yi','all');
  assert.match(html,/未知/);assert.match(html,/¥0 \/ 亿/);assert.match(html,/按量/);
  assert.match(M.unitPriceVisualHtml(points[0],'yi',{}),/usage-price-bar-empty/);
  assert.doesNotMatch(M.unitPriceVisualHtml(points[0],'yi',{}),/¥0/);
  assert.equal(M.tokenAmountInUnit(null,'M'),null);
  assert.equal(M.unitPriceInTokenUnit(null,'M'),null);
  assert.equal(R.quota('unknown','yi'),'额度未知');assert.equal(R.quota(0,'yi'),'0 亿 Token');
});

test('精选与完整范围可复用同一固定表，保留具体模型档位和安全文本',()=>{
  const points=C.points(ctx,config);
  for(const group of preset.groups){
    const featured=M.buildPresetComparisonRows(points,group,'featured',preset.platformSlugs);
    const all=M.buildPresetComparisonRows(points,group,'all',preset.platformSlugs);
    assert.ok(all.length>=featured.length);
    assert.ok(featured.every(p=>preset.platformSlugs.includes(p.platformSlug)&&group.modelSlugs.includes(p.modelSlug)));
    assert.ok(all.every(p=>!p.discontinued&&p.available!==false&&p.platformVisible!==false));
  }
  const model={slug:'test',name:'<script>oops</script>',scores:{artificialAnalysis:{score:0}},modalities:null};
  const html=C.modelCard(model,ctx);assert.doesNotMatch(html,/<script>/);assert.match(html,/0\.0/);assert.match(html,/待确认/);
});
