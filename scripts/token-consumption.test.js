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
  for (const [value, text] of [[null,'—'],[undefined,'—'],[0,'×0'],[1,'×1'],[1.5,'×1.50'],[.5,'×0.50']]) {
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
  assert.match(html, /data-comparison-col="tokenConsumptionRate" title="">×0\.83<\/td>/);
  assert.ok(!html.includes('估算'));
});
