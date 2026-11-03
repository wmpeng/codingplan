const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const UI = require('./ui-core');
const Filters = require('./filter-state');
const NumberDisplay = require('./number-display');

function loadControls(document = {querySelector:() => null}) {
  const sandbox = vm.createContext({CodingPlanUI:UI, NumberDisplay, document,
    PurchaseGuide:require('./purchase-guide.js')});
  vm.runInContext(fs.readFileSync(require.resolve('./filter-controls'), 'utf8'), sandbox);
  return sandbox.CodingPlanFilterControls;
}

test('共享筛选模板保留各页控件范围、状态对象和不可信目录名称转义', () => {
  const controls = loadControls();
  const context = {platforms:[{slug:'p',name:'平台 <测试>'}],models:[{slug:'m',name:'模型 & 测试'}],modelGroups:[]};
  for (const view of ['home','platforms','plans','pricing']) {
    const policy = Filters.createViewPolicy(view === 'home' ? {} : {mode:'full',view});
    const state = policy.createDefaults({}, 'M');
    const before = JSON.stringify({state,context});
    const html = controls.render({policy,state,context});
    assert.equal(JSON.stringify({state,context}), before);
    for (const id of ['homeModelPicker','homeBudgetPicker','homeTokenPicker','homeStatusPicker']) {
      assert.equal((html.match(new RegExp('id="'+id+'"','g')) || []).length, 1);
    }
    assert.equal(html.includes('id="homePlatformPicker"'), view !== 'platforms');
    assert.equal(html.includes('data-budget-mode="api"'), view !== 'plans');
    assert.equal(html.includes('data-platform-domestic'), view === 'platforms');
    assert.equal(html.includes('data-filter-field="mainlandRequired"'), view === 'pricing');
    assert.equal(html.includes('data-filter-field="harnessApiRequired"'), view === 'plans');
    assert.equal(html.includes('包含已下架'), view !== 'home');
    assert.match(html, /模型 &amp; 测试/);
    assert.doesNotMatch(html, /平台 <测试>/);
  }
});

test('目录摘要沿用控件身份、顺序和实时状态，空名单与不限仍有不同活动标记', () => {
  const summaries = new Map([
    ['homePlatformPicker',{attribute:'data-picker-count',textContent:'不限'}],
    ['homeModelPicker',{attribute:'data-picker-count',textContent:'全部'}],
    ['homeBudgetPicker',{attribute:'data-budget-label',textContent:'仅按量'}],
    ['homeTokenPicker',{attribute:'data-token-label',textContent:'不限'}],
    ['homeStatusPicker',{attribute:'data-status-label',textContent:'不限'}],
  ]);
  const elements = new Map([...summaries].map(([id,summary]) => ['#'+id, {
    id,querySelector:selector => selector === '['+summary.attribute+']' ? summary : null,
  }]));
  const controls = loadControls();
  let state = {platformSlugs:[],modelSlugs:null,apiOnly:true,budgetCny:null,monthlyTokenRange:null};
  const specs = controls.directoryControls({querySelector:selector => elements.get(selector)}, 'plans', () => state);
  assert.deepEqual(Array.from(specs, spec => spec.label), ['平台','模型','月预算','月 Token 数','购买状态']);
  assert.deepEqual(Array.from(specs, spec => spec.read(spec.element)[0]), [true,false,true,false,false]);
  assert.ok(specs.every(spec => spec.picker && spec.paused));
  state = {...state,platformSlugs:null,modelSlugs:['m'],apiOnly:false,monthlyTokenRange:{min:0,max:null}};
  summaries.get('homeStatusPicker').textContent = '包含已下架';
  assert.deepEqual(Array.from(specs, spec => spec.read(spec.element)[0]), [false,true,false,true,true]);
  assert.equal(specs[4].read(specs[4].element)[1], '包含已下架');
});

test('目录精选暂停规则保留价格大陆例外，展示分段保留独立分组', () => {
  const controls = loadControls();
  const element = {};
  const selectors = new Set(['.price-billing-filter','.pricing-mainland-control, .platform-access-filter',
    '.platform-featured-control','.usage-color-control','.usage-benchmark-control','.usage-scale-control']);
  const host = {querySelector:selector => selectors.has(selector) ? element : null};
  const pricing = controls.directoryControls(host,'pricing',() => ({}));
  const platforms = controls.directoryControls(host,'platforms',() => ({}));
  assert.equal(pricing.find(spec => spec.label === '中国大陆可用').paused, false);
  assert.equal(platforms.find(spec => spec.label === '中国大陆可用').paused, true);
  assert.equal(pricing.find(spec => spec.label === '显示精选').paused, false);
  assert.equal(pricing.find(spec => spec.label === '计费方式').paused, true);
  assert.equal(platforms.some(spec => spec.label === '计费方式'), false);
  assert.deepEqual(Array.from(pricing.filter(spec => spec.display), spec => spec.label), ['颜色','评分','坐标轴']);
});
