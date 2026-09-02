const fs = require('fs');
const path = require('path');
const { validatePlatformRecords } = require('../../scripts/platform-catalog.js');
const EntityData = require('../../scripts/entity-data.js');

const root = path.join(__dirname, '../..');
const context = EntityData.buildContext(
  JSON.parse(fs.readFileSync(path.join(root, 'platforms.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(root, 'plans.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(root, 'models.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(root, 'plan-models.json'), 'utf8'))
);
const visiblePlatforms = EntityData.hydratePlatforms(context);
const visiblePlans = EntityData.hydratePlans(context);
const result = validatePlatformRecords(visiblePlatforms, visiblePlans);
const errors = [...result.errors];
for (const plan of context.plans) {
  if (!context.platformBySlug.has(plan.platformSlug)) errors.push(`Plan "${plan.slug}": unknown platformSlug "${plan.platformSlug}"`);
}
for (const relation of context.planModels) {
  if (!context.planBySlug.has(relation.planSlug)) errors.push(`PlanModel "${relation.slug}": unknown planSlug "${relation.planSlug}"`);
  if (!context.modelBySlug.has(relation.modelSlug)) errors.push(`PlanModel "${relation.slug}": unknown modelSlug "${relation.modelSlug}"`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${context.platforms.length} platforms, ${context.plans.length} plans, ${context.models.length} models, ${context.planModels.length} relations`);
