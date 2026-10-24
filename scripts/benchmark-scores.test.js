const test=require('node:test');const assert=require('node:assert/strict');
const Scores=require('./benchmark-scores.js');const Catalog=require('./featured-catalog.js');const Directory=require('./model-directory.js');const Comparison=require('./model-comparison.js');
test('four metrics retain zero, missing, signed percentages and source precision',()=>{
 assert.deepEqual(Scores.keys,['artificialAnalysis','deepSWE','liveBench','arena']);
 assert.equal(Scores.format(null,'arena'),'—');assert.equal(Scores.format({scoreExact:0},'arena'),'0.00%');
 assert.equal(Scores.format({scoreExact:-2.125},'arena'),'-2.13%');assert.equal(Scores.format({scoreExact:2.125},'arena'),'+2.13%');
 assert.equal(Scores.format({scoreExact:80.25},'liveBench'),'80.3');assert.equal(Scores.value({scoreExact:null}),null);
});
test('cards share four quadrants, concise labels, accessible details and escaped metadata',()=>{
 const model={slug:'demo',name:'Demo',scores:{liveBench:{scoreExact:80.2,configuration:'<config>',sourceUrl:'https://livebench.ai/',publishedAt:'2026-10-23'}}};
 const html=Catalog.modelCard(model,{planModels:[],benchmarks:{}});
 assert.equal((html.match(/class="model-score"/g)||[]).length,4);
 assert.match(html,/Demo LiveBench评分详情/);assert.match(html,/2026-10-23/);assert.match(html,/&lt;config&gt;/);assert.doesNotMatch(html,/<config>/);
 assert.match(Scores.details({scoreExact:1,confidenceLowerExact:-2,confidenceUpperExact:4},'arena'),/-2.00% ～ 4.00%/);
});
test('new score sorting uses exact precision and keeps missing behind negative values',()=>{
 const models=[{slug:'unknown',name:'unknown',scores:{arena:null}},{slug:'negative',name:'negative',scores:{arena:{scoreExact:-2}}},{slug:'zero',name:'zero',scores:{arena:{scoreExact:0}}}];
 assert.deepEqual(Directory.select(models,[],{sort:'arena'}).visible.map(m=>m.slug),['zero','negative','unknown']);
 const points=models.map(m=>({...m,slug:m.slug}));assert.deepEqual(Comparison.sortComparisonRows(points,'arena','desc').map(m=>m.slug),['zero','negative','unknown']);
 assert.equal(Comparison.getPointScore({scores:{arena:null}},'arena'),null);
});
