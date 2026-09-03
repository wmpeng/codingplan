const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getComparisonCapacity,
  normalizeSelection,
  selectDefaultPlatforms,
  shouldCompareDirectly,
  buildComparisonUrl,
  readSelectionFromSearch,
  formatPriceRange,
  computeLeadInfo,
  rowHasDifference,
  readMetricPins,
  writeMetricPins,
  METRIC_PIN_STORAGE_KEY
} = require('./platform-comparison.js');

const platforms = [
  { slug: 'newest', name: 'Newest', dimensions: { models: { score: 5 } } },
  { slug: 'older', name: 'Older', dimensions: { models: { score: 4 } } },
  { slug: 'third', name: 'Third', dimensions: { models: { score: 5 } } },
  { slug: 'fourth', name: 'Fourth', dimensions: { models: { score: 3 } } },
  { slug: 'fifth', name: 'Fifth', dimensions: { models: { score: 2 } } }
];

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

describe('responsive comparison selection', () => {
  it('uses 2/3/4 columns at the chosen width breakpoints', () => {
    assert.equal(getComparisonCapacity(390), 2);
    assert.equal(getComparisonCapacity(760), 2);
    assert.equal(getComparisonCapacity(761), 3);
    assert.equal(getComparisonCapacity(1180), 3);
    assert.equal(getComparisonCapacity(1181), 4);
  });

  it('keeps newest pinned ids first and limits them to the screen capacity', () => {
    assert.deepEqual(
      selectDefaultPlatforms(['newest', 'older', 'third', 'missing'], platforms, 2),
      ['newest', 'older']
    );
  });

  it('enters directly only when the complete pin set fits and has at least two items', () => {
    assert.equal(shouldCompareDirectly([], platforms, 4), false);
    assert.equal(shouldCompareDirectly(['newest'], platforms, 4), false);
    assert.equal(shouldCompareDirectly(['newest', 'older'], platforms, 2), true);
    assert.equal(shouldCompareDirectly(['newest', 'older', 'third'], platforms, 2), false);
  });
});

describe('comparison URL state', () => {
  it('round-trips valid unique platform ids', () => {
    const url = buildComparisonUrl(['newest', 'older', 'newest']);
    assert.equal(url, 'platform-compare.html?platforms=newest%2Colder');
    assert.deepEqual(readSelectionFromSearch(url.split('?')[1], platforms), ['newest', 'older']);
  });

  it('drops unknown ids and caps shared links at four items', () => {
    assert.deepEqual(
      normalizeSelection(['newest', 'bad', 'older', 'third', 'fourth', 'fifth'], platforms, 4),
      ['newest', 'older', 'third', 'fourth']
    );
  });
});

describe('comparison presentation helpers', () => {
  it('does not combine prices across currencies', () => {
    assert.equal(formatPriceRange([
      { billingMode: 'subscription', monthlyPrice: 29, currency: '¥' },
      { billingMode: 'subscription', monthlyPrice: 119, currency: '¥' },
      { billingMode: 'subscription', monthlyPrice: 10, currency: '$' },
      { billingMode: 'payg', monthlyPrice: 1, currency: '¥' }
    ]), '¥29–119/月；$10/月');
  });

  it('marks ties and calculates a single leader margin', () => {
    const tied = computeLeadInfo(platforms.slice(0, 3).map((platform) => ({ platform })), 'models');
    assert.deepEqual([...tied.leaders], ['newest', 'third']);
    assert.equal(tied.badge, '并列领先');

    const single = computeLeadInfo(platforms.slice(0, 2).map((platform) => ({ platform })), 'models');
    assert.deepEqual([...single.leaders], ['newest']);
    assert.equal(single.badge, '领先 1 分');
  });

  it('detects differences from the row comparison key, not rendered prose', () => {
    const same = { key: () => 5 };
    const different = { key: (view) => view.value };
    assert.equal(rowHasDifference(same, [{ value: 1 }, { value: 2 }]), false);
    assert.equal(rowHasDifference(different, [{ value: 1 }, { value: 2 }]), true);
  });
});

describe('metric pin storage', () => {
  it('keeps metric pins separate and removes unknown row ids', () => {
    const storage = memoryStorage();
    assert.equal(writeMetricPins(storage, ['models-score', 'bad', 'purchase-status']), true);
    assert.equal(storage.getItem(METRIC_PIN_STORAGE_KEY), '["models-score","purchase-status"]');
    assert.deepEqual(readMetricPins(storage), ['models-score', 'purchase-status']);
  });
});
