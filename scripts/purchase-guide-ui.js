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
      "先选一组精选模型，再到下方模型面板自由增减；快捷选择会替换当前名单。",
    ],
    [
      "偏好",
      "有什么使用条件和偏好？",
      "回答立即更新方案；不确定的条件可以保持不限。",
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
            ["api", "自己的系统 / 服务 / 自动化"],
          ],
          answers.scenario,
        ) +
        (answers.scenario === "writing"
          ? buttons(
              "writingMode",
              [
                ["web", "直接用网页 / App"],
                ["tools", "个人在工具中交互写作"],
                ["automation", "程序批量生成 / 自动化"],
              ],
              answers.writingMode,
            )
          : "")
      );
    if (step === 1)
      return s.apiOnly
        ? "<p>系统、服务或自动化调用仅推荐按量 API；订阅套餐按个人交互使用考虑。</p>"
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
          s.monthlyTokenRange?.min == null ? "" : s.monthlyTokenRange.min / (s.tokenUnit === "B" ? 1000 : s.tokenUnit === "M" ? 1 : 100),
          s.tokenUnit === "B" ? "B Token" : s.tokenUnit === "M" ? "M Token" : "亿 Token",
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
            ["api", "仅按量 API"],
            ["any", s.apiOnly ? "金额不限（仅 API）" : "不限"],
          ],
          answers.free
            ? "free"
            : s.budgetCny?.max != null
              ? String(s.budgetCny.max)
              : s.apiOnly ? "api" : s.preference === "cost"
                ? "cheap"
                : "any",
        ) + input("budget", "每月不超过", s.budgetCny?.max ?? "", "元") +
        (s.apiOnly ? '<p class="guide-note">当前仅推荐按量 API。此处填写预算保留 API 限制；手动预算滑块的中间金额会同时包含订阅和 API。</p>' : "")
      );
    if (step === 4)
      return (
        buttons(
          "modelPreset",
          [
            ["all", "不限，查看全部模型"],
            ["featured", "所有精选模型"],
            ["sota-models", "顶尖与前沿：优先模型能力"],
            ["high-volume-models", "甜品级：轻快实惠"],
          ],
          controller.getModelPreset(),
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
    if (s.apiOnly) parts.push("仅按量 API");
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
      parts.push(`≥ ${F.targetTokens(s) / (s.tokenUnit === "B" ? 1000 : s.tokenUnit === "M" ? 1 : 100)} ${s.tokenUnit === "B" ? "B" : s.tokenUnit === "M" ? "M" : "亿"} Token/月`);

    if (s.imageRequired) parts.push("图片输入");
    if (s.platformSlugs?.length)
      parts.push(`指定 ${s.platformSlugs.length} 家平台`);
    if (s.modelSlugs?.length) parts.push(`指定 ${s.modelSlugs.length} 个模型`);
    return parts.join(" · ") || "尚未限定需求，可先看看全部方案再调整";
  }
  function render() {
    const ready = !!controller,
      s = ready ? controller.getState() : {};
    host.dataset.active = String(active);
    host.hidden = !active || collapsed;
    const advice = G.directAdvice(answers);
    root.dispatchEvent(new CustomEvent('codingplan:guide-advice', {detail: advice}));
    if (host.hidden) { host.innerHTML = ''; return; }
    host.innerHTML = `<section class="purchase-guide-panel"><header class="guide-header"><div><span class="guide-eyebrow">一起整理你的需求</span><h2>不确定怎么填？一步步来</h2><p>回答会直接更新下方“我的需求”，也可以随时手动调整。</p></div><div class="guide-header-actions"><button type="button" data-guide-action="collapse">完成 / 收起</button></div></header>
      ${advice ? '<button type="button" data-guide-action="restart">改为工具接入或 API</button>' : `<nav class="guide-progress" aria-label="选购步骤">${questions.map(([label], i) => `<button type="button" data-step="${i}" aria-current="${i === step ? 'step' : 'false'}">${i + 1} ${label}</button>`).join('')}</nav><div class="guide-question"><h3 tabindex="-1" id="guideQuestionTitle">${questions[step][1]}</h3><p>${questions[step][2]}</p>${content(s)}</div><footer class="guide-step-actions"><button type="button" data-guide-action="prev" ${step === 0 ? 'disabled' : ''}>上一步</button><button type="button" data-guide-action="skip">不确定 / 跳过</button><button type="button" class="guide-primary" data-guide-action="next">${step === 5 ? '完成，查看方案 ↓' : '下一步'}</button></footer>`}
      <div class="guide-summary" data-guide-summary>${advice ? '下方已给出直接使用建议；购买需求保持不变。' : esc(summary(s))}${!advice && s.modelMatch === 'all' ? '<span class="model-match-warning">需同时支持所选模型</span>' : ''}</div></section>`;
  }

  function set(patch) {
    if (!applied) {
      applied = true;
      if (!controller.userChanged)
        patch = {
          platformSlugs: null,
          modelSlugs: null,
          platformStatusMax: "paused",
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
    const current = controller.getState();
    if (!G.directAdvice(answers) && G.scenarioPatch(answers).apiOnly !== current.apiOnly) {
      answers.scenario = current.apiOnly ? 'api' : null;
      answers.writingMode = null;
    }
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
      if (value !== "writing" && !G.directAdvice(answers)) {
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
          value === "api" ? { apiOnly: true, budgetCny: null, tool: "any" }
          : value === "cheap"
            ? { budgetCny: null, preference: "cost" }
            : {
                budgetCny:
                  value === "any" ? null : { min: null, max: Number(value) },
              },
        );
    } else if (key === "modelPreset" && !G.directAdvice(answers)) {
      controller.selectModelPreset(value, "guide");
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
          set({ apiOnly: false });
        } else if (step === 1) set({ tool: "any" });
        else if (step === 2) {
          answers.intensity = null;
          set({ monthlyTokenRange: null });
        } else if (step === 3) {
          answers.free = false;
          set({ budgetCny: null });
        } else if (step === 4) set({ modelGroup: "any", modelSlugs: null, modelMatch: "any", imageRequired: false });
        else
          set({
            domesticNetworkOnly: false,
            domesticPaymentOnly: false,
            preference: "balanced",
          });
      }
      if (step === 5 && action !== "prev") {
        collapsed = true;
        render();
        document
          .getElementById("purchaseGuideResults")
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
            : { min: Math.max(0, Number(el.value)) * (controller.getState().tokenUnit === "B" ? 1000 : controller.getState().tokenUnit === "M" ? 1 : 100), max: null },
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
      if (active && G.scenarioPatch(answers).apiOnly !== event.detail.state.apiOnly) {
        answers.scenario = event.detail.state.apiOnly ? "api" : null;
        answers.writingMode = null;
      }
    }
    if (event.detail.source === "display") {
      const field = host.contains(document.activeElement) ? document.activeElement.dataset.guideNumber : null;
      render();
      if (field) host.querySelector(`[data-guide-number="${field}"]`)?.focus({preventScroll: true});
      return;
    }
    // Updating numbers must not replace the focused input on each keystroke.
    if (
      host.contains(document.activeElement) &&
      document.activeElement.matches("[data-guide-number]")
    ) {
      const summaryEl = host.querySelector("[data-guide-summary]");
      if (summaryEl) summaryEl.textContent = summary(controller.getState());
    } else render();
  });
  root.addEventListener("codingplan:filters-ready", () => {
    controller = root.CodingPlanHomeFilters;
    if (pendingStart) begin();
    else render();
  });
  document.querySelectorAll("[data-open-guide]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      begin();
      host.scrollIntoView({behavior: "smooth", block: "start"});
      host.querySelector("#guideQuestionTitle")?.focus({ preventScroll: true });
    });
  });
  root.addEventListener('codingplan:guide-restart', () => {
    answers = {}; step = 0; begin(); host.scrollIntoView({behavior: 'smooth'});
  });
  controller = root.CodingPlanHomeFilters;
  render();
})(globalThis);
