const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('./ui-core');

test('精选名单统一先头部级再甜品级，单组保序、排除禁用与失效项并去重', () => {
  const groups = [
    {id:'high-volume-models', modelSlugs:['sweet-b','shared','sweet-a','missing']},
    {id:'disabled', enabled:false, modelSlugs:['disabled']},
    {id:'sota-models', modelSlugs:['top-b','shared','top-a','top-b']}
  ];
  const models = ['sweet-a','sweet-b','top-a','top-b','shared'].map(slug => ({slug}));
  const snapshot = JSON.stringify(groups);
  const expected = ['top-b','shared','top-a','sweet-b','sweet-a'];
  assert.deepEqual(UI.modelPresetSlugs(groups, 'featured', models), expected);
  assert.deepEqual(UI.modelPresetSlugs([...groups].reverse(), 'featured', models), expected);
  assert.deepEqual(UI.modelPresetSlugs(groups, 'sota-models', models), ['top-b','shared','top-a']);
  assert.deepEqual(UI.modelPresetSlugs(groups, 'high-volume-models', models), ['sweet-b','shared','sweet-a']);
  assert.deepEqual(UI.modelPresetSlugs(groups, 'disabled', models), []);
  assert.deepEqual(UI.modelPresetSlugs(groups, 'missing', models), []);
  assert.deepEqual(UI.modelPresetSlugs(undefined), []);
  assert.equal(JSON.stringify(groups), snapshot);
});

test('模型分组入口读取配置短名称，未加载时不复制旧分组名', () => {
  const groups = [{id:'sota-models',title:'能力模型',label:'能力级'}];
  assert.equal(UI.modelGroupLabel(groups,'sota-models'),'能力级');
  assert.equal(UI.modelGroupLabel([{id:'sota-models',title:'能力模型'}],'sota-models'),'能力模型');
  assert.equal(UI.modelGroupLabel(undefined,'sota-models'),'精选分组');
});
test('公共链接保留参数并阻止脚本及协议相对地址', () => {
  assert.equal(UI.route('pricing', { platform: '中文 & x', plan: 'a/b', model: null }), '/pricing/?platform=%E4%B8%AD%E6%96%87+%26+x&plan=a%2Fb');
  for (const input of ['javascript:alert(1)', '//outside.example', 'data:text/html,x', '', null]) assert.equal(UI.sanitizeUrl(input), null);
  assert.equal(UI.sanitizeUrl(' HTTPS://example.com/a '), 'HTTPS://example.com/a');
  assert.equal(UI.sanitizeUrl('/pricing/?model=x'), '/pricing/?model=x');
});
test('模型名单完整保留但按配置收起，标签和可访问名称均转义', () => {
  const html = UI.modelTags(['A', 'B', '<C & D>', 'E'], { limit: 2, id: 'models-x', ariaLabel: '套餐"模型' });
  assert.match(html, /&lt;C &amp; D&gt;/);
  assert.match(html, /aria-label="套餐&quot;模型"/);
  assert.equal((html.match(/data-extra-model hidden/g) || []).length, 2);
  assert.match(html, /aria-controls="models-x"/);
  assert.match(html, />\+2<\/button>/);
  assert.doesNotMatch(UI.modelTags(['A'], { limit: 5 }), /<button/);
  assert.doesNotMatch(UI.modelTags(['A', 'B'], { limit: 1, expanded: true }), / hidden/);
});
test('置顶按钮保留实体属性和可访问状态，不将名称解释成 HTML', () => {
  const html = UI.pinButton({pinned:true,label:'取消置顶 <套餐>',attributes:{'data-plan-pin':'a" & b'}});
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="取消置顶 &lt;套餐&gt;"/);
  assert.match(html, /data-plan-pin="a&quot; &amp; b"/);
  assert.match(html, /fill="currentColor"/);
  assert.doesNotMatch(html, /[☆★]/);
  assert.throws(() => UI.pinButton({attributes:{onclick:'alert(1)'}}), /不支持/);
});
