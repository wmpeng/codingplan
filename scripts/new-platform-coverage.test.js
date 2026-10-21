const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validatePlatformRecords} = require('./platform-catalog.js');
const load = name => JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const ids=['qoder-cn','qoder-intl','workbuddy','trae-cn','trae-intl'];
test('new platforms have ordered plans, descriptions and model coverage',()=>{
  const platforms=load('platforms.json').platforms, plans=load('plans.json').plans;
  const relations=plans.flatMap(p=>p.planModels.map(r=>({...r,planSlug:p.slug})));
  // Catalog ordering changes with later editorial updates; identity coverage does not.
  for (const slug of ids) assert.equal(platforms.filter(p=>p.slug===slug).length,1,slug);
  const selected=plans.filter(p=>ids.includes(p.platformSlug));
  assert.equal(selected.length,24);
  assert.deepEqual([...new Set(selected.map(p=>p.platformSlug))],ids);
  assert.ok(validatePlatformRecords(platforms.filter(p=>ids.includes(p.slug)),selected).ok);
  for(const p of selected){
    assert.ok(p.note && p.benefits.length);
    assert.equal(p.quarterlyPrice, typeof p.monthlyPrice==='number' ? p.monthlyPrice*3 : '不适用');
    if (p.slug === 'trae-intl-free') assert.ok(!relations.some(r=>r.planSlug===p.slug));
    else assert.ok(relations.some(r=>r.planSlug===p.slug),p.slug);
  }
  assert.ok(!relations.some(r=>r.planSlug==='trae-cn-lite' && r.modelSlug==='doubao-seed-evolving'));
});
test('unrated products retain unknown dimension scores',()=>{
  const platforms=load('platforms.json').platforms.filter(p=>ids.includes(p.slug));
  for (const platform of platforms) assert.equal(platform.dimensions.models.score, null);
});
