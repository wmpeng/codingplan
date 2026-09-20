(function (root) {
  "use strict";
  const host = document.getElementById("purchaseGuide");
  if (!host) return;
  const G = root.PurchaseGuide,
    F = root.CodingPlanFilters;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let controller,
    active = false,
    step = 0,
    answers = {},
    collapsed = false,
    applied = false,
    pendingStart = false;
  try {
    collapsed = localStorage.getItem("purchase-guide-collapsed") === "1";
  } catch (_) {}
  const questions = [
    [
      "用途",
      "主要想用 AI 做什么？",
      "先选主要用途；不需要买套餐的需求，我们会直接给使用建议。",
    ],
    ["工具", "准备在哪里使用？", "已有工具就选对应入口，没有要求可以跳过。"],
    [
      "用量",
      "大概会用多少？",
      "参考月用量可以随时修改，实际消耗取决于任务和上下文。",
    ],
    [
      "预算",
      "每月愿意花多少钱？",
      "按正常月费比较；按量服务填写用量后估算月支出。",
    ],
    [
      "模型",
      "对模型有什么要求？",
      "可以选择模型档次，具体模型在下方筛选中选择。",
    ],
    [
      "偏好",
      "有什么使用条件和偏好？",
      "回答立即更新推荐；不确定的条件可以保持不限。",
    ],
  ];
  function buttons(key, items, current) {
    return `<div class="guide-options">${items.map(([v, t]) => `<button type="button" data-answer="${key}" data-value="${v}" aria-pressed="${String(current === v)}">${t}</button>`).join("")}</div>`;
  }
  function input(key, label, value, unit) {
    return `<label class="guide-number">${label}<input type="number" min="0" step="any" data-guide-number="${key}" value="${esc(value)}" aria-label="${label}"><span>${unit}</span></label>`;
  }
  function content(s) {
    if (step === 0)
      return (
        buttons(
          "scenario",
          [
            ["everyday", "问答 / 尝鲜 / 日常办公"],
            ["image", "生成或编辑图片"],
            ["coding", "项目编程 / Agent"],
            ["writing", "小说 / 文章写作"],
            ["professional", "专业工具协作"],
            ["api", "自己的应用 / API"],
          ],
          answers.scenario,
        ) +
        (answers.scenario === "writing"
          ? buttons(
              "writingMode",
              [
                ["web", "直接用网页 / App"],
                ["tools", "工具接入 / 大量生成"],
              ],
              answers.writingMode,
            )
          : "")
      );
    if (step === 1)
      return answers.scenario === "api"
        ? "<p>自己的应用或服务使用按量 API，不推荐订阅套餐。</p>"
        : buttons(
            "tool",
            [
              ["any", "没有要求"],
              ["codex", "Codex"],
              ["claude", "Claude Code"],
              ["github", "GitHub Copilot"],
              ["other", "OpenCode / 其他工具"],
            ],
            s.tool,
          );
    if (step === 2)
      return (
        buttons(
          "intensity",
          [
            ["trial", "先体验一下"],
            ["occasional", "有时使用"],
            ["daily", "每天间歇使用"],
            ["heavy", "每天高强度使用"],
          ],
          answers.intensity,
        ) +
        input(
          "tokens",
          "每月至少",
          s.monthlyTokenRange?.min == null ? "" : s.monthlyTokenRange.min / 100,
          "亿 Token",
        ) +
        '<p class="guide-note">估算基准：偶尔 1 亿、每天间歇 10 亿、高强度 40 亿；写作按一半估算。自填数量优先。不是官方用量保证。</p>'
      );
    if (step === 3)
      return (
        buttons(
          "budget",
          [
            ["free", "不想花钱"],
            ["cheap", "没概念，尽量便宜"],
            ["50", "50 元以内"],
            ["100", "100 元以内"],
            ["200", "200 元以内"],
            ["500", "500 元以内"],
            ["any", "不限"],
          ],
          answers.free
            ? "free"
            : s.budgetCny?.max != null
              ? String(s.budgetCny.max)
              : s.preference === "cost"
                ? "cheap"
                : "any",
        ) + input("budget", "每月不超过", s.budgetCny?.max ?? "", "元")
      );
    if (step === 4)
      return (
        buttons(
          "modelGroup",
          [
            ["any", "不限，按用途推荐"],
            ["sota-models", "SOTA：优先模型能力"],
            ["high-volume-models", "甜品级：轻快实惠"],
          ],
          s.modelGroup,
        ) +
        `<label class="guide-check"><input type="checkbox" data-guide-check="imageRequired" ${s.imageRequired ? "checked" : ""}>需要理解图片 / 截图</label>`
      );
    return (
      `<div class="guide-conditions"><label class="guide-check"><input type="checkbox" data-guide-check="domesticNetworkOnly" ${s.domesticNetworkOnly ? "checked" : ""}>只考虑无需境外网络的方案</label><label class="guide-check"><input type="checkbox" data-guide-check="domesticPaymentOnly" ${s.domesticPaymentOnly ? "checked" : ""}>只考虑无需境外支付的方案</label></div>` +
      buttons(
        "preference",
        [
          ["balanced", "均衡"],
          ["cost", "月费更低"],
          ["quality", "模型效果更好"],
          ["variety", "尝试更多模型"],
        ],
        s.preference,
      )
    );
  }
  function summary(s) {
    const parts = [];
    if (s.useCase !== "any")
      parts.push(
        { coding: "编程", general: "写作 / 通用任务", api: "自建应用 API" }[
          s.useCase
        ],
      );
    if (s.tool !== "any")
      parts.push(
        {
          codex: "Codex",
          claude: "Claude Code",
          github: "Copilot",
          other: "其他工具",
        }[s.tool],
      );
    if (s.budgetCny?.max != null) parts.push(`≤ ¥${s.budgetCny.max}/月`);
    if (s.monthlyTokenRange)
      parts.push(`≥ ${F.targetTokens(s) / 100} 亿 Token/月`);
    if (s.modelGroup !== "any")
      parts.push(s.modelGroup === "sota-models" ? "SOTA" : "甜品级");
    if (s.imageRequired) parts.push("图片输入");
    if (s.platformSlugs?.length)
      parts.push(`指定 ${s.platformSlugs.length} 家平台`);
    if (s.modelSlugs?.length) parts.push(`指定 ${s.modelSlugs.length} 个模型`);
    return parts.join(" · ") || "尚未限定需求，可先看看推荐再调整";
  }
  function safeUrl(value) {
    try {
      const u = new URL(value, location.origin);
      return ["https:", "http:"].includes(u.protocol) ? u.href : null;
    } catch (_) {
      return null;
    }
  }
  function card(item) {
    const url = safeUrl(item.plan.action || item.platform.action),
      guide = root.PlatformPages?.getUrl(item.platform.slug);
    const modelText =
      item.models
        .slice(0, 3)
        .map((x) => x.name)
        .join("、") +
      (item.models.length > 3 ? ` 等 ${item.models.length} 个模型` : "");
    return `<article class="guide-result-card"><span class="guide-eyebrow">${esc(item.platform.name)} · ${item.plan.billingMode === "payg" ? "按量 API" : "订阅"}</span><h4>${esc(item.plan.name)}</h4><p class="guide-price">${item.cost === null ? "月支出待估算" : `¥${item.cost.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}<small> / 月${item.plan.billingMode === "payg" ? "（估算）" : ""}</small>`}</p><p>${esc(modelText)}${item.plan.billingMode === "payg" && item.tier ? ` · ${esc(item.tier)}` : ""}</p><ul>${item.reasons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><details><summary>取舍与注意事项</summary><ul>${item.cautions.map((t) => `<li>${esc(t)}</li>`).join("")}${item.plan.billingMode === "payg" && item.rows[0].note ? `<li>${esc(item.rows[0].note)}</li>` : ""}</ul></details><div class="guide-card-links">${guide ? `<a href="${guide}">平台介绍</a>` : ""}<a href="/${item.plan.billingMode === "payg" ? "pricing" : "plans"}/?platform=${encodeURIComponent(item.platform.slug)}">查看完整${item.plan.billingMode === "payg" ? "价格" : "套餐"}</a>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">前往官网 ↗</a>` : ""}</div></article>`;
  }
  function results(s) {
    const advice = G.directAdvice(answers);
    if (advice)
      return `<div class="guide-advice"><h3>先直接使用，无需选购套餐</h3><p>${esc(advice)}</p><a href="https://www.doubao.com/" target="_blank" rel="noopener noreferrer">打开豆包 ↗</a><button type="button" data-guide-action="restart">我需要接入工具或 API</button></div>`;
    const result = G.recommend(controller.context, s, controller.config);
    if (!result.candidates.length)
      return `<div class="guide-advice"><h3>暂时没有同时满足条件的购买方案</h3><p>当前条件可能冲突，或所需额度、网络、支付资料尚未确认。条件没有被自动放宽。</p>${result.conflicts.length ? "<p>只调整下面一项，可以找到候选：</p>" : ""}<div class="guide-options">${result.conflicts.map((x) => `<button type="button" data-relax="${x.key}">取消${x.label}（${x.count} 个方案）</button>`).join("")}</div><button type="button" data-guide-action="filters">查看并调整全部条件</button></div>`;
    return `<div class="guide-result-heading"><h3>按当前需求，先考虑这些方案</h3><span>${result.candidates.length} 个候选 · 展示不同选择</span></div>${result.groups.map(([title, items]) => `<section class="guide-result-group"><h3>${title}</h3><div class="guide-result-grid">${items.map(card).join("")}</div></section>`).join("")}<p class="guide-note">AA 分数用于模型能力参考；多模型额度不相加。API 费用沿用价格页的工作负载假设，峰谷与上下文档位分别计算。完整结果可在下方四个视图继续比较。</p>`;
  }
  function render() {
    const ready = !!controller,
      s = ready ? controller.getState() : {};
    host.innerHTML = `<section class="purchase-guide-panel"><header class="guide-header"><div><span class="guide-eyebrow">选购助手</span><h2>${collapsed ? "需要帮忙选？" : "找到适合你的 AI 使用方案"}</h2>${collapsed ? "" : "<p>说说用途、用量和预算，看看哪些方案值得考虑。</p>"}</div><div class="guide-header-actions"><button type="button" data-guide-action="${collapsed ? "expand" : "collapse"}">${collapsed ? "展开选购助手" : "收起"}</button></div></header>
      ${collapsed ? "" : active && G.directAdvice(answers) ? "" : !active ? `<div class="guide-intro-actions"><button class="guide-primary" type="button" data-guide-action="start" ${ready ? "" : "disabled"}>${ready ? "帮我选" : "正在加载目录…"}</button><a href="#mainViewTabs">直接看对比 ↓</a></div>` : `<nav class="guide-progress" aria-label="选购步骤">${questions.map(([label], i) => `<button type="button" data-step="${i}" aria-current="${i === step ? "step" : "false"}">${i + 1} ${label}</button>`).join("")}</nav><div class="guide-question"><h3 tabindex="-1" id="guideQuestionTitle">${questions[step][1]}</h3><p>${questions[step][2]}</p>${content(s)}</div><footer class="guide-step-actions"><button type="button" data-guide-action="prev" ${step === 0 ? "disabled" : ""}>上一步</button><button type="button" data-guide-action="skip">不确定 / 跳过</button><button type="button" class="guide-primary" data-guide-action="next">${step === 5 ? "查看推荐 ↓" : "下一步"}</button></footer>`}
      ${active ? `<div class="guide-summary" data-guide-summary>${G.directAdvice(answers) ? "当前显示直接使用建议；原有筛选保持不变。" : esc(summary(s))}</div>` : ""}</section><div id="purchaseGuideResults" ${active && !collapsed ? "" : "hidden"}>${active && !collapsed ? results(s) : ""}</div>`;
  }
  function set(patch) {
    if (!applied) {
      applied = true;
      if (!controller.userChanged)
        patch = {
          platformSlugs: null,
          modelSlugs: null,
          platformStatusMax: "limited",
          includeDiscontinued: false,
          ...patch,
        };
    }
    controller.setState(patch, "guide");
  }
  function begin() {
    if (!controller) {
      pendingStart = true;
      return;
    }
    pendingStart = false;
    active = true;
    collapsed = false;
    // Drop editorial default picks, while retaining constraints explicitly changed by the user.
    // Opening the assistant alone never changes filters.
    render();
  }
  function applyAnswer(key, value) {
    if (key === "scenario") {
      answers.scenario = value;
      answers.writingMode = null;
      if (!G.directAdvice(answers)) {
        set({
          ...G.scenarioPatch(answers),
          ...(answers.intensity ? G.usagePatch(answers) : {}),
        });
      }
    } else if (key === "writingMode") {
      answers.writingMode = value;
      if (!G.directAdvice(answers)) set(G.scenarioPatch(answers));
    } else if (key === "intensity") {
      answers.intensity = value;
      if (!G.directAdvice(answers))
        set({
          ...G.usagePatch(answers),
          ...(value === "trial" ? { preference: "cost" } : {}),
        });
    } else if (key === "budget") {
      answers.free = value === "free";
      if (!answers.free)
        set(
          value === "cheap"
            ? { budgetCny: null, preference: "cost" }
            : {
                budgetCny:
                  value === "any" ? null : { min: null, max: Number(value) },
              },
        );
    } else if (!G.directAdvice(answers)) set({ [key]: value });
    render();
  }
  host.addEventListener("click", (event) => {
    const el = event.target.closest("button");
    if (!el) return;
    if (el.dataset.answer) {
      applyAnswer(el.dataset.answer, el.dataset.value);
      return;
    }
    if (el.dataset.step != null) {
      step = Number(el.dataset.step);
      render();
      host.querySelector("#guideQuestionTitle")?.focus({ preventScroll: true });
      return;
    }
    if (el.dataset.relax) {
      const k = el.dataset.relax;
      set({ [k]: F.createDefaultState({}, { mode: "full" })[k] });
      return;
    }
    const action = el.dataset.guideAction;
    if (action === "collapse" || action === "expand") {
      collapsed = action === "collapse";
      try {
        localStorage.setItem("purchase-guide-collapsed", collapsed ? "1" : "0");
      } catch (_) {}
      render();
    }
    if (action === "start") begin();
    if (action === "restart") {
      answers = {};
      step = 0;
      collapsed = false;
      active = true;
      render();
    }
    if (action === "prev" || action === "next" || action === "skip") {
      if (action === "skip") {
        if (step === 0) {
          answers.scenario = null;
          set({ useCase: "any" });
        } else if (step === 1) set({ tool: "any" });
        else if (step === 2) {
          answers.intensity = null;
          set({ monthlyTokenRange: null });
        } else if (step === 3) {
          answers.free = false;
          set({ budgetCny: null });
        } else if (step === 4) set({ modelGroup: "any", imageRequired: false });
        else
          set({
            domesticNetworkOnly: false,
            domesticPaymentOnly: false,
            preference: "balanced",
          });
      }
      if (step === 5 && action !== "prev") {
        host
          .querySelector("#purchaseGuideResults")
          .scrollIntoView({ behavior: "smooth" });
        return;
      }
      step = Math.max(0, Math.min(5, step + (action === "prev" ? -1 : 1)));
      render();
      host.querySelector("#guideQuestionTitle")?.focus({ preventScroll: true });
    }
    if (action === "filters")
      document
        .getElementById("homepageUnifiedFiltersMount")
        .scrollIntoView({ behavior: "smooth" });
  });
  host.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.guideCheck && !G.directAdvice(answers))
      set({ [el.dataset.guideCheck]: el.checked });
  });
  host.addEventListener("input", (event) => {
    const el = event.target,
      key = el.dataset.guideNumber;
    if (!key) return;
    if (key === "budget") {
      answers.free = false;
      set({
        budgetCny:
          el.value === ""
            ? null
            : { min: null, max: Math.max(0, Number(el.value)) },
      });
    } else if (!G.directAdvice(answers)) {
      answers.intensity = null;
      set({
        monthlyTokenRange:
          el.value === ""
            ? null
            : { min: Math.max(0, Number(el.value)) * 100, max: null },
      });
    }
  });
  root.addEventListener("codingplan:filters-changed", (event) => {
    if (event.detail.full) return;
    controller = root.CodingPlanHomeFilters;
    if (event.detail.source === "manual") {
      controller.userChanged = true;
      answers.intensity = null;
      answers.free = false;
      if (active) {
        answers.scenario =
          event.detail.state.useCase === "api"
            ? "api"
            : event.detail.state.useCase === "coding"
              ? "coding"
              : event.detail.state.useCase === "general"
                ? "professional"
                : null;
      }
    }
    // Updating numbers must not replace the focused input on each keystroke.
    if (
      host.contains(document.activeElement) &&
      document.activeElement.matches("[data-guide-number]")
    ) {
      host.querySelector("#purchaseGuideResults").innerHTML = active
        ? results(controller.getState())
        : "";
      const summaryEl = host.querySelector("[data-guide-summary]");
      if (summaryEl) summaryEl.textContent = summary(controller.getState());
    } else render();
  });
  root.addEventListener("codingplan:filters-ready", () => {
    controller = root.CodingPlanHomeFilters;
    if (pendingStart) begin();
    else render();
  });
  document.querySelector("[data-open-guide]")?.addEventListener("click", () => {
    begin();
  });
  controller = root.CodingPlanHomeFilters;
  render();
})(globalThis);
