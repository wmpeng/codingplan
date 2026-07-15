const DIMENSION_KEYS = ['value', 'stability', 'models', 'convenience'];

function matchesDerivedTag(platform, rule) {
  if (rule.purchaseRush !== undefined) {
    if (platform.purchaseRush !== rule.purchaseRush) {
      return false;
    }
  }
  if (rule.dimension !== undefined && rule.minScore !== undefined) {
    const dim = platform.dimensions?.[rule.dimension];
    if (!dim || dim.score < rule.minScore) {
      return false;
    }
  }
  return true;
}

function matchesOperationalTag(platform, label) {
  return Array.isArray(platform.tags) && platform.tags.includes(label);
}

function filterPlatforms(platforms, {
  selectedLabels,
  showDiscontinued,
  derivedTags,
  operationalTags,
  showDiscontinuedLabel
}) {
  let result = platforms;

  if (!showDiscontinued) {
    result = result.filter(p => p.status !== 'discontinued');
  }

  if (!selectedLabels || selectedLabels.length === 0) {
    return result;
  }

  const derivedByLabel = new Map(derivedTags.map(t => [t.label, t]));

  return result.filter(platform => {
    for (const label of selectedLabels) {
      if (label === showDiscontinuedLabel) {
        continue;
      }

      const derived = derivedByLabel.get(label);
      if (derived) {
        if (!matchesDerivedTag(platform, derived.rule)) {
          return false;
        }
      } else {
        if (!matchesOperationalTag(platform, label)) {
          return false;
        }
      }
    }
    return true;
  });
}

function collectModelsForVendor(plans, vendorName) {
  const seen = new Set();
  const models = [];

  for (const plan of plans) {
    if (plan.vendor !== vendorName || plan.discontinued) {
      continue;
    }
    for (const model of plan.models || []) {
      if (!seen.has(model)) {
        seen.add(model);
        models.push(model);
      }
    }
  }

  return models;
}

function resolvePlatformAction(platform, plans) {
  if (platform.action) {
    return platform.action;
  }

  const plan = plans.find(p => p.vendor === platform.name);
  return plan?.action ?? null;
}

function validatePlatformRecords(platforms, plans) {
  const errors = [];
  const platformNames = new Set(platforms.map(p => p.name));

  const vendors = [...new Set(plans.map(p => p.vendor))];
  for (const vendor of vendors) {
    if (!platformNames.has(vendor)) {
      errors.push(`Plan vendor "${vendor}" has no matching platform`);
    }
  }

  for (const platform of platforms) {
    const prefix = `Platform "${platform.name}"`;

    if (platform.status !== 'active' && platform.status !== 'discontinued') {
      errors.push(`${prefix}: invalid status "${platform.status}"`);
    }

    if (typeof platform.purchaseRush !== 'boolean') {
      errors.push(`${prefix}: purchaseRush must be a boolean`);
    }

    if (platform.tags !== undefined && !Array.isArray(platform.tags)) {
      errors.push(`${prefix}: tags must be an array`);
    }

    for (const key of DIMENSION_KEYS) {
      const dim = platform.dimensions?.[key];
      if (!dim) {
        errors.push(`${prefix}: missing dimension "${key}"`);
        continue;
      }

      const { score, reason } = dim;
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        errors.push(`${prefix}: dimension "${key}" score must be an integer in [1, 5]`);
      }
      if (typeof reason !== 'string' || reason.trim() === '') {
        errors.push(`${prefix}: dimension "${key}" reason must be a non-empty string`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

const PlatformCatalog = {
  DIMENSION_KEYS,
  matchesDerivedTag,
  matchesOperationalTag,
  filterPlatforms,
  collectModelsForVendor,
  resolvePlatformAction,
  validatePlatformRecords
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlatformCatalog;
} else {
  window.PlatformCatalog = PlatformCatalog;
}
