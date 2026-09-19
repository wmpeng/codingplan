const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMainView,
  readPlanPlatform,
  readMainViewFromSearch,
  buildMainViewUrl,
  applyMainViewDom,
  isPlainPrimaryClick
} = require('./main-views.js');

test('normalizeMainView', () => {
  assert.equal(normalizeMainView('usage'), 'usage');
  assert.equal(normalizeMainView('nope'), 'platforms');
  assert.equal(normalizeMainView(''), 'platforms');
});

test('平台套餐深链按 slug 筛选，忽略错误视图、名称与隐藏平台', () => {
  const platforms = [{ slug: 'zhipu', name: '智谱AI' }, { slug: 'hidden', catalogVisible: false }];
  assert.equal(readPlanPlatform('?view=plans&platform=zhipu', platforms), platforms[0]);
  for (const search of ['?view=usage&platform=zhipu', '?view=plans&platform=智谱AI', '?view=plans&platform=hidden', '?view=plans&platform=missing']) {
    assert.equal(readPlanPlatform(search, platforms), null);
  }
});

test('isPlainPrimaryClick', () => {
  assert.equal(isPlainPrimaryClick({ button: 0 }), true);
  assert.equal(isPlainPrimaryClick({ button: 1 }), false);
  assert.equal(isPlainPrimaryClick({ button: 0, ctrlKey: true }), false);
  assert.equal(isPlainPrimaryClick({ button: 0, metaKey: true }), false);
});

test('readMainViewFromSearch', () => {
  assert.equal(readMainViewFromSearch('?view=usage'), 'usage');
  assert.equal(readMainViewFromSearch('?view=monitor'), 'monitor');
  assert.equal(readMainViewFromSearch(''), 'platforms');
  assert.equal(readMainViewFromSearch('?view=x'), 'platforms');
});

test('buildMainViewUrl keeps other params', () => {
  const withPlatform = buildMainViewUrl('monitor', {
    pathname: '/index.html',
    currentSearch: '?platform=youyun'
  });
  const params = new URLSearchParams(withPlatform.split('?')[1] || '');
  assert.equal(params.get('view'), 'monitor');
  assert.equal(params.get('platform'), 'youyun');
  assert.equal(
    buildMainViewUrl('platforms', { pathname: '/index.html', currentSearch: '?view=unknown' }),
    '/index.html'
  );
});

test('applyMainViewDom toggles hidden and tab active', () => {
  const panels = {
    platforms: { hidden: false },
    plans: { hidden: false },
    usage: { hidden: false },
    monitor: { hidden: false }
  };
  const tabs = [];
  const tabsRoot = {
    querySelectorAll() {
      return tabs;
    }
  };
  ['platforms', 'plans', 'usage', 'monitor'].forEach((key) => {
    tabs.push({
      key,
      classList: {
        _on: false,
        toggle(name, on) {
          if (name === 'is-active') this._on = on;
        }
      },
      getAttribute(name) {
        return name === 'data-main-view' ? key : null;
      },
      setAttribute() {}
    });
  });
  applyMainViewDom({ view: 'usage', panels, tabsRoot });
  assert.equal(panels.platforms.hidden, true);
  assert.equal(panels.usage.hidden, false);
  assert.equal(tabs.find((t) => t.key === 'usage').classList._on, true);
});
