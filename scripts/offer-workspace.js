(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OfferWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Keep relation identity intact: platform/model sets would create unselected combinations.
  const key = (item, row) => JSON.stringify([item.platform.slug, item.plan.slug, row.slug]);
  function options(candidates, context) {
    return candidates.flatMap(item => item.rows.map(row => ({
      key: key(item, row), item, row, model: context.modelBySlug.get(row.modelSlug)
    })));
  }
  function preferredOption(item, options) {
    return options.filter(option => option.item.id === item.id).sort((a, b) => {
      const score = x => x.model.scores?.artificialAnalysis?.scoreExact ?? x.model.scores?.artificialAnalysis?.score ?? -Infinity;
      return score(b) - score(a);
    })[0];
  }
  function project(values, chosen, kind, only) {
    if (!only) return values;
    const ids = new Set(chosen.map(x => kind === 'platforms' ? x.item.platform.slug : kind === 'plans' ? x.item.plan.slug : x.row.slug));
    return values.filter(x => ids.has(x.slug));
  }
  function reconcile(keys, options) {
    const valid = new Set(options.map(x => x.key));
    return keys.filter(key => valid.has(key));
  }
  return { key, options, preferredOption, project, reconcile };
});
