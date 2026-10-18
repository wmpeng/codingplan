const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./pricing-directory.js');
const E = require('./entity-data.js');
const M = require('./model-comparison.js');

test('首月综合单价按售价比例换算，原始精度、常规月费与额度不变', () => {
  const context={planBySlug:new Map([['p',{monthlyPrice:100,firstMonthPrice:25}]])};
  const points=[{slug:'r',planSlug:'p',billingMode:'subscription',monthlyFeeCny:680,unitPriceCnyPerM:.234567,monthlyTokenInM:2900}];
  const before=structuredClone(points),first=E.withComparisonPriceBasis(points,context,'firstMonth');
  assert.ok(Math.abs(first[0].unitPriceCnyPerM-.234567/4)<1e-14);
  assert.equal(first[0].monthlyFeeCny,680);assert.equal(first[0].monthlyTokenInM,2900);
  assert.deepEqual(points,before);assert.equal(E.withComparisonPriceBasis(points,context,'monthly'),points);
});

test('首月缺省回退、真实零、未知月价及 API 不相互混淆', () => {
  const plans=[['missing',{monthlyPrice:100,firstMonthPrice:'-'}],['free',{monthlyPrice:100,firstMonthPrice:0}],['unknown',{firstMonthPrice:5}],['zero',{monthlyPrice:0,firstMonthPrice:0}]];
  const context={planBySlug:new Map(plans)};
  const points=plans.map(([slug])=>({slug,planSlug:slug,billingMode:'subscription',unitPriceCnyPerM:slug==='zero'?0:1}));
  points.push({slug:'api',billingMode:'payg',unitPriceCnyPerM:5,apiPricing:{inputPerM:6}});
  points.push({slug:'unknownUsage',planSlug:'free',billingMode:'subscription',unitPriceCnyPerM:null});
  const first=E.withComparisonPriceBasis(points,context,'firstMonth');
  assert.equal(first[0],points[0]);assert.equal(first[1].unitPriceCnyPerM,0);
  assert.equal(first[2].unitPriceCnyPerM,null);assert.equal(first[3].unitPriceCnyPerM,0);
  assert.equal(first[4],points[4]);assert.equal(first[5].unitPriceCnyPerM,null);
  const free={...first[1],scores:{artificialAnalysis:{scoreExact:30}}};
  assert.deepEqual(M.buildIntelligenceChartPoints([free],'artificialAnalysis','log'),[]);
  assert.deepEqual(M.buildIntelligenceChartPoints([free],'artificialAnalysis','value'),[free]);
});

test('明细置顶去重并保留非匹配记录，只改变表格，未知排序仍最后', () => {
  const points=[{slug:'a',platformName:'平台',planName:'套餐',modelName:'模型',unitPriceCnyPerM:1},
    {slug:'b',platformName:'其他',unitPriceCnyPerM:2},{slug:'c',unitPriceCnyPerM:null}];
  assert.deepEqual(D.sanitizePins(['b','missing','b',7],points),['b']);
  const matched=D.search(points,'套餐');assert.deepEqual(matched,[points[0]]);
  assert.deepEqual(D.tableRows(matched,points,['b'],M.sortComparisonRows,{key:'unitPriceCnyPerM',direction:'asc'}).map(x=>x.slug),['b','a']);
  assert.deepEqual(matched,[points[0]]);
  let sort={key:'unitPriceCnyPerM',direction:'asc'};
  sort=D.cycleSort(sort,'model');assert.deepEqual(sort,{key:'model',direction:'asc'});
  sort=D.cycleSort(sort,'model');assert.deepEqual(sort,{key:'model',direction:'desc'});
  sort=D.cycleSort(sort,'model');assert.deepEqual(sort,{key:'unitPriceCnyPerM',direction:'asc'});
  assert.deepEqual(D.readPins({getItem:()=>'{bad'},points),[]);
});

test('已下架明细无开通链接，状态与首月口径进入提示，评分保留原分数', () => {
  const point={slug:'retired',platformName:'平台',planName:'套餐',relationLabel:'模型',billingMode:'subscription',planStatus:'delisted',actionUrl:'https://example.com',unitPriceCnyPerM:1,unitPriceBasis:'firstMonth',firstMonthPrice:10,scores:{artificialAnalysis:{score:42}}};
  const row=M.comparisonTableRowHtml(point,'M',{compactIdentity:true,pinned:true});
  assert.match(row,/已下架/);assert.doesNotMatch(row,/<a /);assert.match(row,/data-price-pin="retired"/);
  assert.match(row,/is-pinned/);assert.match(row,/>42</);assert.equal((row.match(/<td\b/g)||[]).length,12);
  const tooltip=M.tooltipHtml(point,'artificialAnalysis','vendor','M');assert.match(tooltip,/已下架/);assert.match(tooltip,/按首月价格计算/);
});

test('分页只限制明细DOM，完整结果不丢失，置顶在每页保留且边界安全', () => {
  const rows=Array.from({length:453},(_,index)=>({slug:String(index)})),pins=['400'];
  const all=new Set();
  for(let index=0;index<3;index++){
    const page=D.paginate(rows,pins,index);
    assert.equal(page.pages,3);assert.equal(page.page,index);assert.equal(page.rows[0].slug,'400');
    assert.ok(page.rows.length<=201);page.rows.forEach(row=>all.add(row.slug));
  }
  assert.equal(all.size,rows.length);assert.equal(D.paginate(rows,pins,99).page,2);
  assert.deepEqual(D.paginate([],[],0),{page:0,pages:1,rows:[]});
});
