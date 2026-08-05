const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMainView,
  readMainViewFromSearch,
  buildMainViewUrl,
  applyMainViewDom,
  isPlainPrimaryClick
} = require('./main-views.js');

test('normalizeMainView', () => {
  assert.equal(normalizeMainView('payg'), 'payg');
  assert.equal(normalizeMainView('nope'), 'platforms');
  assert.equal(normalizeMainView(''), 'platforms');
});

test('isPlainPrimaryClick', () => {
  assert.equal(isPlainPrimaryClick({ button: 0 }), true);
  assert.equal(isPlainPrimaryClick({ button: 1 }), false);
  assert.equal(isPlainPrimaryClick({ button: 0, ctrlKey: true }), false);
  assert.equal(isPlainPrimaryClick({ button: 0, metaKey: true }), false);
});

test('readMainViewFromSearch', () => {
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
    buildMainViewUrl('platforms', { pathname: '/index.html', currentSearch: '?view=payg' }),
    '/index.html'
  );
});

test('applyMainViewDom toggles hidden and tab active', () => {
  const panels = {
    platforms: { hidden: false },
    plans: { hidden: false },
    payg: { hidden: false },
    monitor: { hidden: false }
  };
  const tabs = [];
  const tabsRoot = {
    querySelectorAll() {
      return tabs;
    }
  };
  ['platforms', 'plans', 'monitor', 'payg'].forEach((key) => {
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
  applyMainViewDom({ view: 'payg', panels, tabsRoot });
  assert.equal(panels.platforms.hidden, true);
  assert.equal(panels.payg.hidden, false);
  assert.equal(tabs.find((t) => t.key === 'payg').classList._on, true);
});
