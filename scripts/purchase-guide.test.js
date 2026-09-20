const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./filter-state.js"),
  G = require("./purchase-guide.js"),
  E = require("./entity-data.js");
const state = (patch) =>
  F.normalizeState({
    platformSlugs: null,
    modelSlugs: null,
    platformStatusMax: "open",
    ...patch,
  });
function fixture() {
  const platforms = [
    {
      slug: "p",
      rating: 5,
      platformStatus: "open",
      externalUsage: true,
      requiresOverseasNetwork: false,
      requiresOverseasPayment: false,
      usageScope: "general",
    },
    {
      slug: "codex",
      rating: 4,
      platformStatus: "open",
      externalUsage: false,
      requiresOverseasNetwork: null,
      requiresOverseasPayment: true,
      usageScope: "coding",
    },
  ];
  const plans = [
    {
      slug: "cheap",
      platformSlug: "p",
      monthlyPrice: 10,
      currency: "¥",
      billingMode: "subscription",
    },
    {
      slug: "strong",
      platformSlug: "p",
      monthlyPrice: 100,
      currency: "¥",
      billingMode: "subscription",
    },
    {
      slug: "api",
      platformSlug: "p",
      billingMode: "payg",
      planTableVisible: false,
    },
    {
      slug: "closed",
      platformSlug: "codex",
      monthlyPrice: 30,
      currency: "¥",
      billingMode: "subscription",
    },
  ];
  const models = [
    {
      slug: "small",
      name: "Small",
      scores: { artificialAnalysis: { score: 30 } },
      modalities: { input: ["text"] },
    },
    {
      slug: "strong",
      name: "Strong",
      scores: { artificialAnalysis: { score: 80 } },
      modalities: { input: ["text", "image"] },
    },
  ];
  const rows = [
    {
      slug: "cheap-small",
      planSlug: "cheap",
      modelSlug: "small",
      usage: { monthlyTokenInM: 100 },
    },
    {
      slug: "strong-strong",
      planSlug: "strong",
      modelSlug: "strong",
      usage: { monthlyTokenInM: 1000 },
    },
    {
      slug: "strong-small",
      planSlug: "strong",
      modelSlug: "small",
      usage: { monthlyTokenInM: 20 },
    },
    {
      slug: "api-strong",
      planSlug: "api",
      modelSlug: "strong",
      usage: { unitPriceCnyPerM: 2 },
    },
    {
      slug: "api-small",
      planSlug: "api",
      modelSlug: "small",
      usage: { unitPriceCnyPerM: 0 },
    },
    {
      slug: "closed-strong",
      planSlug: "closed",
      modelSlug: "strong",
      usage: { monthlyTokenInM: "unknown" },
    },
  ];
  const doc = (key, list) => ({ schemaVersion: 1, [key]: list });
  const c = E.buildContext(
    doc("platforms", platforms),
    doc("plans", plans),
    doc("models", models),
    doc("planModels", rows),
  );
  c.modelGroups = [{ id: "sota-models", modelSlugs: ["strong"] }];
  return c;
}
const options = { usdToCnyRate: 7 };
test("预算、模型与额度不能跨套餐拼接，三个视图使用同一批关系", () => {
  const c = fixture(),
    s = state({
      modelSlugs: ["strong"],
      budgetCny: { max: 20 },
      monthlyTokenRange: { min: 100 },
    });
  assert.deepEqual(F.matchingOffers(c, s, options), []);
  assert.deepEqual(
    F.filterPlatforms(c.platforms, s, { context: c, ...options }),
    [],
  );
  assert.deepEqual(
    F.filterPlans(E.buildPlanCatalog(c), s, { context: c, ...options }),
    [],
  );
  assert.deepEqual(
    F.filterPoints(E.buildComparisonPoints(c, 7), s, {
      context: c,
      ...options,
    }),
    [],
  );
});
test("月Token保留按量、排除未知订阅；组合预算按实际目标估算，零价不视为未知", () => {
  const c = fixture(),
    s = state({ monthlyTokenRange: { min: 100 } });
  assert.deepEqual(
    F.matchingOffers(c, s, options).map((x) => x.plan.slug),
    ["cheap", "strong", "api"],
  );
  const api = F.matchingOffers(
    c,
    { ...s, budgetCny: { max: 100 } },
    options,
  ).find((x) => x.plan.slug === "api");
  assert.deepEqual(
    api.rows.map((x) => x.slug),
    ["api-small"],
  );
  assert.equal(F.apiCost(c.planModels[3], s), 200);
  assert.equal(F.apiCost({ usage: { unitPriceCnyPerM: "unknown" } }, s), null);
  assert.equal(
    F.matchingOffers(
      c,
      state({ useCase: "api", budgetCny: { max: 1 } }),
      options,
    ).length,
    1,
  );
});
test("外部工具、用途、网络支付、图片与模型分组分别生效", () => {
  const c = fixture();
  assert.ok(
    F.matchingOffers(c, state({ tool: "other" }), options).every(
      (x) => x.platform.slug === "p",
    ),
  );
  assert.ok(
    F.matchingOffers(c, state({ tool: "codex" }), options).some(
      (x) => x.plan.slug === "closed",
    ),
  );
  assert.deepEqual(
    F.matchingOffers(c, state({ useCase: "api" }), options).map(
      (x) => x.plan.slug,
    ),
    ["api"],
  );
  assert.ok(
    F.matchingOffers(c, state({ domesticNetworkOnly: true }), options).every(
      (x) => x.platform.slug === "p",
    ),
  );
  assert.ok(
    F.matchingOffers(c, state({ domesticPaymentOnly: true }), options).every(
      (x) => x.platform.slug === "p",
    ),
  );
  for (const patch of [{ imageRequired: true }, { modelGroup: "sota-models" }])
    assert.ok(
      F.matchingOffers(c, state(patch), options).every((x) =>
        x.rows.every((r) => r.modelSlug === "strong"),
      ),
    );
  assert.equal(
    F.matchingOffers(
      c,
      state({
        modelSlugs: ["small", "strong"],
        modelMatch: "all",
        monthlyTokenRange: { min: 100 },
      }),
      options,
    ).some((x) => x.plan.slug === "strong"),
    false,
  );
});
test("推荐排序使用符合条件的模型最高分、去重数量、平台评分及真实月支出", () => {
  const c = fixture();
  assert.equal(
    G.recommend(c, state({ preference: "cost" }), options).candidates[0].plan
      .slug,
    "cheap",
  );
  assert.equal(
    G.recommend(
      c,
      state({ preference: "quality", modelSlugs: ["small"] }),
      options,
    ).candidates.find((x) => x.plan.slug === "strong").score,
    30,
  );
  const r = G.recommend(c, state({ preference: "variety" }), options);
  assert.equal(r.candidates[0].plan.slug, "strong");
  assert.equal(r.candidates[0].models.length, 2);
  assert.equal(
    new Set(r.groups.flatMap(([, items]) => items.map((x) => x.plan.slug)))
      .size,
    r.groups.flatMap(([, items]) => items).length,
  );
  c.plans[1].discontinued = true;
  assert.ok(
    !G.recommend(
      c,
      state({ includeDiscontinued: true }),
      options,
    ).candidates.some((x) => x.plan.slug === "strong"),
  );
});
test("无结果报告可恢复候选的具体限制，且不修改输入", () => {
  const c = fixture(),
    s = state({
      budgetCny: { max: 1 },
      monthlyTokenRange: { min: 100 },
      modelSlugs: ["strong"],
    });
  const before = JSON.stringify(s),
    r = G.recommend(c, s, options);
  assert.equal(r.candidates.length, 0);
  assert.ok(r.conflicts.some((x) => x.key === "budgetCny"));
  assert.equal(JSON.stringify(s), before);
});
test("简化引导路线及用量系数", () => {
  assert.ok(G.directAdvice({ free: true }));
  assert.ok(G.directAdvice({ scenario: "everyday" }));
  assert.equal(G.directAdvice({ scenario: "coding" }), null);
  assert.deepEqual(
    G.usagePatch({ scenario: "writing", intensity: "daily" }).monthlyTokenRange,
    { min: 500, max: null },
  );
  assert.equal(G.usagePatch({ intensity: "trial" }).monthlyTokenRange, null);
});
test("真实目录的推荐引用完整，AA无分数不冒充零，分组模型存在", () => {
  const c = E.buildContext(
    require("../platforms.json"),
    require("../plans.json"),
    require("../models.json"),
    require("../plan-models.json"),
  );
  c.modelGroups = require("../model-comparison-presets.json").groups;
  for (const group of c.modelGroups.filter((x) =>
    ["sota-models", "high-volume-models"].includes(x.id),
  ))
    for (const slug of group.modelSlugs) assert.ok(c.modelBySlug.has(slug));
  for (const preference of ["balanced", "cost", "quality", "variety"]) {
    const r = G.recommend(c, state({ preference }), require("../config.json"));
    assert.ok(r.candidates.length);
    for (const x of r.candidates) {
      assert.ok(x.rows.every((row) => row.planSlug === x.plan.slug));
      assert.ok(x.reasons.length);
    }
  }
});
