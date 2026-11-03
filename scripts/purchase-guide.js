(function (root, factory) {
  const api = factory(
    root.CodingPlanFilters ||
      (typeof require === "function" ? require("./filter-state.js") : null),
    root.NumberDisplay || (typeof require === "function" ? require("./number-display.js") : null),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PurchaseGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (F, Numbers) {
  "use strict";
  const sortOptions = [
    { value: "balanced", label: "综合排序", help: "平台评分优先，同分按平台目录顺序；同平台按套餐评分、费用和套餐目录顺序。" },
    { value: "volume", label: "用量更大", help: "比较单个匹配模型最大的月参考额度，不相加共享额度；按量 API 不视为无限额度。" },
    { value: "cost", label: "价格更实惠", help: "比较订阅首月费用或按量 API 的最低已知估算月支出，未知费用排后。" },
    { value: "quality", label: "模型更强、更全面", help: "先比较匹配模型的最高 AA 分，同分再比较模型数量。" },
  ];
  const entryOptions = [
    {value:'any', label:'不限'}, {value:'codex', label:'Codex'},
    {value:'claude-code', label:'Claude Code'},
    {value:'third-party', label:'其他智能体框架（如Zcode，Kimi Code等）'},
    {value:'program', label:'自己的程序（API 调用）'},
  ];
  const finite = (value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  function offerCosts(offer, state) {
    const apiEstimates = offer.plan.billingMode === 'payg'
      ? offer.rows.map(row=>({relationSlug:row.slug,cost:F.apiCost(row,state)})) : null;
    const knownCosts = (apiEstimates || []).map(item=>item.cost).filter(cost=>cost!==null);
    const costRange = knownCosts.length ? {min:Math.min(...knownCosts),max:Math.max(...knownCosts),
      hasUnknown:apiEstimates.some(item=>item.cost===null)} : null;
    return {apiEstimates,costRange,cost:apiEstimates ? costRange?.min ?? null : offer.firstMonthCost};
  }
  function unconfirmedFacts(item, state) {
    const api = item.plan.billingMode === 'payg', unknown = [];
    if (item.toolSupport === null) unknown.push('工具兼容性');
    if (state.budgetCny && item.cost === null) unknown.push(api ? '月支出' : '首月费用');
    if (!api && state.monthlyTokenRange && item.rows.some(row=>row.usage?.monthlyTokenInM==null || row.usage.monthlyTokenInM==='unknown')) unknown.push('月额度');
    if (api && state.budgetCny && item.apiEstimates.some(item=>item.cost===null) && !unknown.includes('月支出')) unknown.push('部分档位月支出');
    return unknown;
  }
  function recommend(context, state, config, options = {}) {
    const s = F.normalizeState(state),
      opts = {
        usdToCnyRate: config.usdToCnyRate,
        platformCatalog: config.platformCatalog,
      };
    // Restricted or delisted products may be browsed, but aren't purchase recommendations.
    const offersFor = (extra = {}) => F.matchingOffers(
      context,
      {
        ...s,
        includeDiscontinued: options.allMatching ? s.includeDiscontinued : false,
        platformStatusMax: options.allMatching ? s.platformStatusMax : "open",
      },
      {...opts,...extra},
    ).filter(offer => options.allMatching || (offer.plan.planStatus || 'open') === 'open');
    const offers = offersFor();
    const evaluated = offers.map((offer) => {
      const rows = offer.rows;
      const api = offer.plan.billingMode === "payg";
      // Each estimate applies the entire target workload to one relation;
      // alternative models and billing tiers must never be added together.
      const {apiEstimates,costRange,cost} = offerCosts(offer,s);
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
      const reasons = [];
      if (s.priorities[0] === "balanced" && finite(offer.platform.rating) > 0) reasons.push(`平台评分 ${offer.platform.rating}；同平台内按套餐评分、费用排序`);
      if (s.budgetCny?.max != null && cost !== null)
        reasons.push(
          api
            ? `各匹配档位的月支出估算在 ${s.budgetCny.max} 元预算内`
            : `首月费用 ${Numbers.monthlyFee(cost, "")} 元，在 ${s.budgetCny.max} 元预算内`,
        );
      if (s.monthlyTokenRange)
        reasons.push(
          offer.plan.billingMode === "payg"
            ? `按每月 ${F.targetTokens(s) / (s.tokenUnit === "B" ? 1000 : s.tokenUnit === "M" ? 1 : 100)} ${s.tokenUnit === "B" ? "B" : s.tokenUnit === "M" ? "M" : "亿"} Token 估算`
            : `所选模型的参考额度达到每月 ${F.targetTokens(s) / (s.tokenUnit === "B" ? 1000 : s.tokenUnit === "M" ? 1 : 100)} ${s.tokenUnit === "B" ? "B" : s.tokenUnit === "M" ? "M" : "亿"} Token`,
        );
      if (scored.length)
        reasons.push(
          `最高 AA 分 ${scored[0].score.toFixed(1)}：${scored[0].model.name}`,
        );
      reasons.push(`${models.length} 个符合条件的模型`);
      if (s.domesticNetworkOnly || s.domesticPaymentOnly) reasons.push("支持境内使用");
      if (s.imageRequired) reasons.push("符合条件的模型支持多模态");
      const cautions = [];
      const unconfirmed=unconfirmedFacts({...offer,cost,apiEstimates},s);
      if (offer.toolSupport === null) cautions.push('尚未确认能否在所选工具中使用');
      if (s.usageEntry === 'third-party') cautions.push('支持通过 API Key 接入智能体框架，配置方法及用途限制见平台说明');
      if (offer.platform.platformStatus === 'restricted' || offer.plan.planStatus === 'restricted')
        cautions.push('购买受限，请在平台页面核实当前开放情况');
      if (offer.plan.billingMode === "payg" && context.workload) {
        const w = context.workload;
        if (finite(w.outputRatio) !== null && finite(w.cacheHitRate) !== null)
          cautions.push(`费用假设：输出占比 ${w.outputRatio * 100}%，输入缓存命中 ${w.cacheHitRate * 100}%；沿用价格页折算汇率`);
      }
      if (!scored.length) cautions.push("暂无 AA 评分");
      if (offer.platform.supportsDomestic === false)
        cautions.push("网络或支付需要境外条件");
      else if (offer.platform.supportsDomestic == null)
        cautions.push("境内使用支持情况待确认");
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
      if (offer.supportsHarnessApi === true)
        cautions.push("具体智能体框架的配置及用途限制请查看平台说明");
      if (api && F.targetTokens(s) !== null) {
        cautions.push("每个模型/档位按全部月用量独立估算，费用不相加；省钱排序按最低已知估算月支出");
        if (costRange?.hasUnknown) cautions.push("部分档位费用未知，估算范围仅包含已知费用");
      }
      return {
        ...offer,
        rows,
        models,
        cost,
        costRange,
        apiEstimates,
        score: scored[0]?.score ?? null,
        volume: api ? null : rows.some(row => row.usage?.monthlyTokenInM === 'unlimited') ? Infinity :
          rows.some(row => finite(row.usage?.monthlyTokenInM) !== null) ? Math.max(...rows.map(row => finite(row.usage?.monthlyTokenInM) ?? -Infinity)) : null,
        reasons,
        cautions,
        unconfirmed,
        id: offer.plan.slug,
        tier: [rows[0].serviceTier, rows[0].contextTier, rows[0].timeTier]
          .filter(Boolean)
          .join(" / "),
      };
    });
    const candidates=evaluated.filter(item=>!item.unconfirmed.length);
    function compare(key, descending) {
      return (a, b) => {
        const x =
            key === "rating"
              ? (finite(a.platform.rating) > 0 ? a.platform.rating : null)
              : key === "planRating"
                ? (finite(a.plan.rating) > 0 ? a.plan.rating : null)
              : key === "count"
                ? a.models.length
                : a[key],
          y =
            key === "rating"
              ? (finite(b.platform.rating) > 0 ? b.platform.rating : null)
              : key === "planRating"
                ? (finite(b.plan.rating) > 0 ? b.plan.rating : null)
              : key === "count"
                ? b.models.length
                : b[key];
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        return descending ? y - x : x - y;
      };
    }
    const priorities = s.priorities;
    const platformOrder = new Map(context.platforms.map((platform,index)=>[platform.slug,index]));
    const planOrder = new Map(context.plans.map((plan,index)=>[plan.slug,index]));
    const platformRating = compare('rating',true), planRating = compare('planRating',true), costOrder = compare('cost',false);
    const balanced = (a,b) => platformRating(a,b)
      || platformOrder.get(a.platform.slug)-platformOrder.get(b.platform.slug)
      || planRating(a,b) || costOrder(a,b)
      || planOrder.get(a.plan.slug)-planOrder.get(b.plan.slug);
    const comparators = {balanced, volume:compare('volume',true), cost:costOrder,
      quality:(a,b)=>compare('score',true)(a,b) || compare('count',true)(a,b)};
    const featuredModels = new Set((context.modelGroups || []).filter(group=>group.enabled!==false).flatMap(group=>group.modelSlugs));
    const featured = item => Number((context.featuredPlatformSlugs || []).includes(item.platform.slug)) + Number(item.models.some(model=>featuredModels.has(model.slug)));
    const order = (a,b) => {
      for (const key of priorities) { const diff = comparators[key](a,b); if(diff) return diff; }
      return priorities[0]==='balanced' ? 0 : featured(b)-featured(a);
    };
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
    if (!candidates.length && !options.internal) {
      const changes = [
        ["platformSlugs", null, "平台范围"],
        ["modelSlugs", null, "指定模型"],
        ["modelMatch", "any", "全部模型要求"],
        ["budgetCny", null, "月预算"],
        ["monthlyTokenRange", null, "月用量"],
        ["apiOnly", false, "仅按量 API"],
        ["imageRequired", false, "多模态能力"],
        ["domesticNetworkOnly", false, "网络要求"],
        ["domesticPaymentOnly", false, "支付要求"],
        ["excludedPlatformStatuses", [], "购买状态排除"],
      ];
      for (const [key, value, label] of changes) {
        if (JSON.stringify(s[key]) === JSON.stringify(value)) continue;
        const relaxed = F.matchingOffers(
          context,
          {
            ...s,
            [key]: value,
            includeDiscontinued: options.allMatching ? s.includeDiscontinued : false,
            platformStatusMax: options.allMatching ? s.platformStatusMax : "open",
          },
          opts,
        ).filter(offer => options.allMatching || (offer.plan.planStatus || 'open') === 'open');
        if (relaxed.length)
          conflicts.push({ key, value, label, count: relaxed.length });
      }
    }
    let modelConflict = "";
    if (!candidates.length && !options.internal && s.modelMatch === "all" && s.modelSlugs?.length > 1) {
      const missing = s.modelSlugs.filter(slug => !F.matchingOffers(context,
        {...s, modelSlugs:[slug], modelMatch:"any"}, opts).length);
      modelConflict = missing.length
        ? `在当前其他条件下，${missing.map(slug => context.modelBySlug.get(slug)?.name || slug).join("、")}没有匹配方案，因此无法包含全部所选模型。`
        : "所选模型各自有匹配方案，但没有同一个套餐同时满足全部模型的要求。";
    }
    let alternatives = [];
    if (!options.internal) {
      if (!candidates.length) {
        // Identify uncertain offers under the original requirements solely to
        // exclude them; relaxing a different requirement must not reintroduce them.
        const uncertainPlans = new Set(offersFor({allowUnknown:true,allowUnconfirmedTool:true})
          .filter(offer=>unconfirmedFacts({...offer,...offerCosts(offer,s)},s).length)
          .map(offer=>offer.plan.slug));
        // Preserve actual access constraints and selected platform scope. Relax only
        // budget, quantity and model range; each changed condition remains explicit.
        const changes = [
          {key:'budgetCny',value:null,label:'月预算',dimension:'cost'},
          {key:'monthlyTokenRange',value:null,label:'月用量',dimension:'volume'},
          {key:'modelSlugs',value:null,label:'模型范围',dimension:'quality'},
          {key:'modelMatch',value:'any',label:'同时支持全部所选模型',dimension:'quality'},
        ].filter(change=>JSON.stringify(s[change.key])!==JSON.stringify(change.value));
        const choices = new Map();
        for(let mask=1;mask<(1<<changes.length);mask++) {
          const relaxed=changes.filter((_,index)=>mask&(1<<index));
          const patch=Object.fromEntries(relaxed.map(change=>[change.key,change.value]));
          // A relaxed model selection still stays within text-output models.
          if(Object.hasOwn(patch,'modelSlugs')) patch.modelSlugs=context.models.filter(model=>model.modalities?.output?.includes('text')).map(model=>model.slug);
          const next=recommend(context,{...s,...patch},config,{...options,internal:true});
          const loss=priorities.map(key=>relaxed.some(change=>change.dimension===key)?1:0);
          for(const item of next.candidates) {
            // Relaxing a threshold must not turn unknown required facts into
            // a measurable compromise. Apply the original information needs.
            if(uncertainPlans.has(item.id) || unconfirmedFacts(item,s).length)continue;
            const candidate={...item,relaxedState:{...s,...patch},sacrifices:relaxed.map(change=>change.label),loss};
            const previous=choices.get(item.id);
            if(!previous || compareLoss(candidate,previous)<0) choices.set(item.id,candidate);
          }
        }
        function compareLoss(a,b) {
          for(let i=0;i<a.loss.length;i++){
            if(a.loss[i]!==b.loss[i])return a.loss[i]-b.loss[i];
            const diff=comparators[priorities[i]](a,b);if(diff)return diff;
          }
          return a.sacrifices.length-b.sacrifices.length || order(a,b);
        }
        alternatives=[...choices.values()].sort(compareLoss).slice(0,3);
      }
    }
    return { candidates, groups, conflicts, modelConflict, alternatives };
  }
  return {
    sortOptions,
    entryOptions,
    recommend,
  };
});
