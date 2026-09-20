(function (root, factory) {
  const api = factory(
    root.CodingPlanFilters ||
      (typeof require === "function" ? require("./filter-state.js") : null),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PurchaseGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (F) {
  "use strict";
  const levels = { trial: null, occasional: 100, daily: 1000, heavy: 4000 };
  const coefficients = { writing: 0.5, coding: 1, professional: 1, api: 1 };
  const directScenarios = ["everyday", "image"];
  function directAdvice(answers) {
    if (answers.free)
      return "暂时不想花钱，可以先使用豆包网页版或桌面版，无需在这里选购套餐。";
    if (
      directScenarios.includes(answers.scenario) ||
      (answers.scenario === "writing" && answers.writingMode === "web")
    )
      return "这类需求可以先使用豆包、千问、Kimi 或 DeepSeek 的网页 / App，无需在这里选购套餐。具体功能以产品内提供的入口为准。";
    return null;
  }
  function scenarioPatch(answers) {
    return {
      useCase:
        answers.scenario === "api"
          ? "api"
          : ["writing", "professional"].includes(answers.scenario)
            ? "general"
            : answers.scenario === "coding"
              ? "coding"
              : "any",
    };
  }
  function usagePatch(answers) {
    const quantity = levels[answers.intensity];
    return {
      monthlyTokenRange:
        quantity == null
          ? null
          : {
              min: quantity * (coefficients[answers.scenario] || 1),
              max: null,
            },
    };
  }
  const finite = (value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  function recommend(context, state, config) {
    const s = F.normalizeState(state),
      opts = {
        usdToCnyRate: config.usdToCnyRate,
        platformCatalog: config.platformCatalog,
      };
    // Archived or paused products may be browsed, but aren't purchase recommendations.
    const offers = F.matchingOffers(
      context,
      {
        ...s,
        includeDiscontinued: false,
        platformStatusMax: s.platformStatusMax === "open" ? "open" : "limited",
      },
      opts,
    );
    const candidates = offers.flatMap((offer) => {
      const rowSets =
        offer.plan.billingMode === "payg"
          ? offer.rows.map((row) => [row])
          : [offer.rows];
      // Multi-model API costs cannot be added without knowing the traffic split.
      return rowSets.map((rows) => {
        const models = [...new Set(rows.map((row) => row.modelSlug))].map(
          (slug) => context.modelBySlug.get(slug),
        );
        const scored = models
          .map((model) => ({
            model,
            score: finite(
              model.scores?.artificialAnalysis?.scoreExact ??
                model.scores?.artificialAnalysis?.score,
            ),
          }))
          .filter((x) => x.score !== null)
          .sort((a, b) => b.score - a.score);
        const cost =
          offer.plan.billingMode === "payg"
            ? F.apiCost(rows[0], s)
            : offer.monthlyCost;
        const reasons = [];
        if (s.preference === "balanced" && finite(offer.platform.rating) !== null) reasons.push(`平台评分 ${offer.platform.rating}，按均衡偏好排序`);
        if (s.budgetCny?.max != null && cost !== null)
          reasons.push(
            `月支出 ${cost.toFixed(2)} 元，在 ${s.budgetCny.max} 元预算内`,
          );
        if (s.monthlyTokenRange)
          reasons.push(
            offer.plan.billingMode === "payg"
              ? `按每月 ${F.targetTokens(s) / 100} 亿 Token 估算`
              : `所选模型的参考额度达到每月 ${F.targetTokens(s) / 100} 亿 Token`,
          );
        if (scored.length)
          reasons.push(
            `最高 AA 分 ${scored[0].score.toFixed(1)}：${scored[0].model.name}`,
          );
        reasons.push(`${models.length} 个符合条件的模型`);
        if (s.tool !== "any")
          reasons.push(
            offer.platform.slug === s.tool
              ? "可在所选自家产品中使用"
              : "提供外部工具接入额度",
          );
        if (s.domesticNetworkOnly) reasons.push("无需境外网络");
        if (s.domesticPaymentOnly) reasons.push("无需境外支付方式");
        if (s.imageRequired) reasons.push("符合条件的模型支持图片输入");
        const cautions = [];
        if (offer.plan.billingMode === "payg" && context.workload) {
          const w = context.workload;
          if (finite(w.outputRatio) !== null && finite(w.cacheHitRate) !== null)
            cautions.push(`费用假设：输出占比 ${w.outputRatio * 100}%，输入缓存命中 ${w.cacheHitRate * 100}%；沿用价格页折算汇率`);
        }
        if (!scored.length) cautions.push("AA 能力分未评定");
        if (offer.platform.platformStatus === "limited")
          cautions.push("定时放量，购买前确认名额");
        if (offer.platform.requiresOverseasNetwork === true)
          cautions.push("需要境外网络条件");
        else if (offer.platform.requiresOverseasNetwork == null)
          cautions.push("网络要求待确认");
        if (offer.platform.requiresOverseasPayment === true)
          cautions.push("需要境外支付方式");
        else if (offer.platform.requiresOverseasPayment == null)
          cautions.push("支付要求待确认");
        if (offer.plan.billingMode === "payg")
          cautions.push(
            F.targetTokens(s) == null
              ? "填写月用量后才能估算月支出"
              : "费用按本站输入、输出与缓存假设估算，实际账单随用法变化",
          );
        else
          cautions.push(
            "额度按单个模型参考量展示，不代表多模型额度可相加或连续任务一定够用",
          );
        if (s.tool !== "any" && offer.platform.slug !== s.tool)
          cautions.push("具体工具配置及用途限制请查看平台说明");
        return {
          ...offer,
          rows,
          models,
          cost,
          score: scored[0]?.score ?? null,
          reasons,
          cautions,
          id:
            offer.plan.slug +
            (offer.plan.billingMode === "payg" ? ":" + rows[0].slug : ""),
          tier: [rows[0].serviceTier, rows[0].contextTier, rows[0].timeTier]
            .filter(Boolean)
            .join(" / "),
        };
      });
    });
    function compare(key, descending) {
      return (a, b) => {
        const x =
            key === "rating"
              ? finite(a.platform.rating)
              : key === "count"
                ? a.models.length
                : a[key],
          y =
            key === "rating"
              ? finite(b.platform.rating)
              : key === "count"
                ? b.models.length
                : b[key];
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        return descending ? y - x : x - y;
      };
    }
    const order =
      s.preference === "cost"
        ? compare("cost", false)
        : s.preference === "quality"
          ? compare("score", true)
          : s.preference === "variety"
            ? compare("count", true)
            : compare("rating", true);
    candidates.sort(order);
    const seen = new Set();
    function take(list, count) {
      const out = [];
      for (const item of list) {
        if (seen.has(item.plan.slug)) continue;
        seen.add(item.plan.slug);
        out.push(item);
        if (out.length === count) break;
      }
      return out;
    }
    const primary = take(candidates, 2);
    const baseline = primary.map((x) => x.cost).filter((x) => x !== null);
    const cheaper = take(
      candidates
        .filter(
          (x) =>
            x.cost !== null &&
            baseline.length &&
            x.cost < Math.min(...baseline),
        )
        .sort(compare("cost", false)),
      2,
    );
    const alternative = take(
      candidates.filter(
        (x) => !primary.some((p) => p.platform.slug === x.platform.slug),
      ),
      2,
    );
    const groups = [
      ["优先考虑", primary],
      ["更省钱的备选", cheaper],
      ["其他路线", alternative],
    ].filter(([, items]) => items.length);
    const conflicts = [];
    if (!candidates.length) {
      const changes = [
        ["platformSlugs", null, "平台范围"],
        ["modelSlugs", null, "指定模型"],
        ["modelGroup", "any", "模型档次"],
        ["budgetCny", null, "月预算"],
        ["monthlyTokenRange", null, "月用量"],
        ["tool", "any", "使用工具"],
        ["useCase", "any", "用途"],
        ["imageRequired", false, "图片能力"],
        ["domesticNetworkOnly", false, "网络要求"],
        ["domesticPaymentOnly", false, "支付要求"],
      ];
      for (const [key, value, label] of changes) {
        if (JSON.stringify(s[key]) === JSON.stringify(value)) continue;
        const relaxed = F.matchingOffers(
          context,
          {
            ...s,
            [key]: value,
            includeDiscontinued: false,
            platformStatusMax: s.platformStatusMax === "open" ? "open" : "limited",
          },
          opts,
        );
        if (relaxed.length)
          conflicts.push({ key, value, label, count: relaxed.length });
      }
    }
    return { candidates, groups, conflicts };
  }
  return {
    levels,
    coefficients,
    directAdvice,
    scenarioPatch,
    usagePatch,
    recommend,
  };
});
