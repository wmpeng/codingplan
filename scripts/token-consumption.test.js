const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('./entity-data.js');
const M = require('./model-comparison.js');

test('consumption sorting keeps unknowns last in either direction and uses full precision', () => {
  const rows = [{slug:'unknown',tokenConsumptionRate:null}, {slug:'high',tokenConsumptionRate:1.504},
    {slug:'low',tokenConsumptionRate:1.501}, {slug:'zero',tokenConsumptionRate:0}];
  assert.deepEqual(M.sortComparisonRows(rows,'tokenConsumptionRate','asc').map(r=>r.slug), ['zero','low','high','unknown']);
  assert.deepEqual(M.sortComparisonRows(rows,'tokenConsumptionRate','desc').map(r=>r.slug), ['high','low','zero','unknown']);
});

test('only the full pricing table renders consumption, with the shared numeric format', () => {
  for (const [value, text] of [[null,'—'],[undefined,'—'],[-1,'—'],[NaN,'—'],[Infinity,'—'],[0,'-100%'],[1,'0%'],[1.5,'+50%'],[.5,'-50%'],[.83,'-17%'],[1.005,'+0.50%']]) {
    const point={slug:'test',scores:{},tokenConsumptionRate:value};
    const html=M.comparisonTableRowHtml(point,'M',{compactIdentity:true});
    assert.ok(html.includes(`data-comparison-col="tokenConsumptionRate" title="">${text}</td>`));
    assert.ok(!M.comparisonTableRowHtml(point,'M',{}).includes('data-comparison-col="tokenConsumptionRate"'));
  }
  assert.ok(M.COMPARISON_TABLE_COLUMNS.find(c=>c.key==='tokenConsumptionRate'));
  assert.ok(!JSON.stringify(M.PRESET_TABLE_COLUMNS).includes('tokenConsumptionRate'));
});

test('all platform rows read the model rate without changing any existing price or quota', () => {
  const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
  const models=read('models.json'), before=JSON.stringify(models);
  const context=E.buildContext(read('platforms.json'),read('plans.json'),models);
  const points=E.buildComparisonPoints(context,7,{includeUnknown:true});
  assert.ok(points.some(p=>p.tokenConsumptionRate!==null));
  for(const point of points) assert.equal(point.tokenConsumptionRate,context.modelBySlug.get(point.modelSlug).tokenConsumptionRate ?? null);
  assert.equal(JSON.stringify(models),before);
  for(const model of models.models) delete model.tokenConsumptionRate;
  const legacy=E.buildComparisonPoints(E.buildContext(read('platforms.json'),read('plans.json'),models),7,{includeUnknown:true});
  const strip=rows=>rows.map(({tokenConsumptionRate,...rest})=>rest);
  assert.deepEqual(strip(points),strip(legacy));
});

test('a supplied model rate renders only its numeric value', () => {
  const html=M.comparisonTableRowHtml({slug:'manual',scores:{},tokenConsumptionRate:.829390511420922},'M',{compactIdentity:true});
  assert.match(html, /data-comparison-col="tokenConsumptionRate" title="">-17\.06%<\/td>/);
  assert.ok(!html.includes('估算'));
});

const indexText = (point, unit = 'M') => M.comparisonTableRowHtml(point,unit,{compactIdentity:true})
  .match(/data-comparison-col="priceIndexCnyPerM">([^<]*)<\/td>/)[1];

test('价格指数乘以原始消耗倍率，保留真实零；缺失和非法值不作为平均或零', () => {
  for(const [price,rate,expected] of [[2,1.5,3],[2,.8,1.6],[2,1,2],[2,0,0],[0,1.5,0],[.00012345,1.2345,.000152399025]]) {
    const point={slug:'index',scores:{},unitPriceCnyPerM:price,tokenConsumptionRate:rate};
    for(const unit of ['yi','M','B']) assert.equal(indexText(point,unit),M.formatUnitPrice(expected,unit));
    assert.ok(!M.comparisonTableRowHtml(point,'M',{}).includes('priceIndexCnyPerM'));
  }
  for(const invalid of [null,undefined,'',false,-1,NaN,Infinity]) {
    assert.equal(indexText({slug:'index',unitPriceCnyPerM:2,tokenConsumptionRate:invalid}),'—');
    assert.equal(indexText({slug:'index',unitPriceCnyPerM:invalid,tokenConsumptionRate:1.5}),'—');
  }
  assert.equal(indexText({slug:'index',unitPriceCnyPerM:0,tokenConsumptionRate:null}),'—');
  assert.equal(indexText({slug:'index',unitPriceCnyPerM:Number.MAX_VALUE,tokenConsumptionRate:2}),'—');
});

test('价格指数按未舍入乘积双向排序，未知始终排后且不改原记录', () => {
  const points=[{slug:'cheap',unitPriceCnyPerM:1,tokenConsumptionRate:3},
    {slug:'efficient',unitPriceCnyPerM:2,tokenConsumptionRate:.5},
    {slug:'zero',unitPriceCnyPerM:0,tokenConsumptionRate:2},
    {slug:'precise-a',unitPriceCnyPerM:1,tokenConsumptionRate:1.00002},
    {slug:'precise-z',unitPriceCnyPerM:1,tokenConsumptionRate:1.00001},
    {slug:'unknown',unitPriceCnyPerM:1,tokenConsumptionRate:null}];
  const before=structuredClone(points);
  assert.deepEqual(M.sortComparisonRows(points,'priceIndexCnyPerM','asc').map(p=>p.slug),['zero','efficient','precise-z','precise-a','cheap','unknown']);
  assert.deepEqual(M.sortComparisonRows(points,'priceIndexCnyPerM','desc').map(p=>p.slug),['cheap','precise-a','precise-z','efficient','zero','unknown']);
  assert.deepEqual(points,before);
});

test('价格指数跟随首月和每月口径，API 不套订阅优惠，原价和额度保持原样', () => {
  const context={planBySlug:new Map([['p',{monthlyPrice:100,firstMonthPrice:25}]])};
  const points=[{slug:'sub',planSlug:'p',billingMode:'subscription',unitPriceCnyPerM:2,tokenConsumptionRate:1.5,monthlyTokenInM:20},
    {slug:'api',billingMode:'payg',unitPriceCnyPerM:2,tokenConsumptionRate:.8}];
  const before=structuredClone(points),first=E.withComparisonPriceBasis(points,context,'firstMonth');
  assert.equal(indexText(first[0]),M.formatUnitPrice(.75,'M'));
  assert.equal(indexText(first[1]),M.formatUnitPrice(1.6,'M'));
  assert.equal(indexText(E.withComparisonPriceBasis(points,context,'monthly')[0]),M.formatUnitPrice(3,'M'));
  assert.equal(first[0].monthlyTokenInM,20);assert.deepEqual(points,before);
});
