const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('./ui-core');
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
