const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validatePlatformRecords,filterPlatforms} = require('./platform-catalog.js');
const load = name => JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const ids=['qoder-cn','qoder-intl','workbuddy','trae-cn','trae-intl'];
test('new platforms have ordered plans, descriptions and model coverage',()=>{
  const platforms=load('platforms.json').platforms, plans=load('plans.json').plans;
  const relations=load('plan-models.json').planModels;
  const start=platforms.findIndex(p=>p.slug==='github');
  assert.deepEqual(platforms.slice(start+1,start+7).map(p=>p.slug),[...ids,'iflytek']);
  const selected=plans.filter(p=>ids.includes(p.platformSlug));
  assert.equal(selected.length,17);
  assert.deepEqual([...new Set(selected.map(p=>p.platformSlug))],ids);
  assert.ok(validatePlatformRecords(platforms.filter(p=>ids.includes(p.slug)),selected).ok);
  for(const p of selected){
    assert.ok(p.summary && p.note && p.benefits.length);
    for(const key of ['fiveHoursRequests','weeklyRequests','monthlyRequests','quarterlyPrice']) assert.equal(p[key],'未公开');
    assert.ok(relations.some(r=>r.planSlug===p.slug),p.slug);
    assert.equal(p.measuredMonthlyTokenLimit,undefined);
  }
  assert.ok(!relations.some(r=>r.planSlug==='trae-cn-lite' && r.modelSlug==='doubao-seed-evolving'));
});
test('unrated dimensions do not pass high-score filters',()=>{
  const platforms=load('platforms.json').platforms.filter(p=>ids.includes(p.slug));
  assert.deepEqual(filterPlatforms(platforms,{selectedLabels:['模型强'],derivedTags:[{label:'模型强',rule:{dimension:'models',minScore:4}}]}),[]);
});
