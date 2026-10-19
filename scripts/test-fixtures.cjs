// Test data construction for the public nested Plan catalogue.
const EntityData = require('./entity-data.js');
function fixtureContext(platforms, plans, models, relations = {planModels: []}) {
  return EntityData.buildContext(platforms, {
    schemaVersion: 3,
    workload: relations.workload,
    plans: plans.plans.map(plan => ({...plan, planStatus: plan.planStatus ?? platforms.platforms.find(p=>p.slug===plan.platformSlug)?.platformStatus ?? 'open', planModels: relations.planModels
      .filter(row => row.planSlug === plan.slug)
      .map(({planSlug, ...row}) => row)}))
  }, models);
}
module.exports = {fixtureContext};
