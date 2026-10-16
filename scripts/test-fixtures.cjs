// Test data construction for the public nested Plan catalogue.
const EntityData = require('./entity-data.js');
function fixtureContext(platforms, plans, models, relations = {planModels: []}) {
  return EntityData.buildContext(platforms, {
    schemaVersion: 2,
    workload: relations.workload,
    plans: plans.plans.map(plan => ({...plan, planModels: relations.planModels
      .filter(row => row.planSlug === plan.slug)
      .map(({planSlug, ...row}) => row)}))
  }, models);
}
module.exports = {fixtureContext};
