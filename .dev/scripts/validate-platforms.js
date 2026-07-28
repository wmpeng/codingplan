const fs = require('fs');
const path = require('path');
const { validatePlatformRecords } = require('../../scripts/platform-catalog.js');

const root = path.join(__dirname, '../..');
const platforms = JSON.parse(fs.readFileSync(path.join(root, 'platforms.json'), 'utf8'));
const plans = JSON.parse(fs.readFileSync(path.join(root, 'plans.json'), 'utf8'));
const result = validatePlatformRecords(platforms, plans);
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${platforms.length} platforms cover ${new Set(plans.map(p => p.vendor)).size} vendors`);
