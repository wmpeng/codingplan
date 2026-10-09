(function (root) {
  "use strict";
  const Filters = root.CodingPlanFilters;
  if (!Filters) return;
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }

  function optionLabel(item, kind) {
    return item.name || item.slug;
  }

  function valuesFor(state, key) {
    return state[key] === null
      ? null
      : Array.isArray(state[key])
        ? state[key]
        : [];
  }

  const rangeKnots = {
    budget: [0, 50, 100, 200, 500, 1000, 2000],
    token: [0, 100, 500, 1000, 4000, 10000],
  };
  function rangeValue(key, position) {
    const knots = rangeKnots[key];
    const part = Math.min(knots.length - 2, Math.floor(position / 100));
    return Math.round(knots[part] + (knots[part + 1] - knots[part]) * (position / 100 - part));
  }
  function rangePosition(key, value) {
    const knots = rangeKnots[key];
    if (value == null || value <= 0) return 0;
    const part = knots.findIndex((n, i) => i < knots.length - 1 && value <= knots[i + 1]);
    if (part < 0) return (knots.length - 1) * 100;
    return Math.round((part + (value - knots[part]) / (knots[part + 1] - knots[part])) * 100);
  }
  // Keep a full interval between the last amount and the unlimited endpoint.
  // Numeric positions retain real zero and over-range direct input.
  const budgetNumericMax = (rangeKnots.budget.length - 1) * 100 + 1;
  const budgetSliderMax = budgetNumericMax + 100;
  // Token position 0 clears the threshold; position 1 retains a real zero.
  const tokenSliderMax = (rangeKnots.token.length - 1) * 100 + 1;
  function setBudget(value, apiOnly = false) {
    return { apiOnly, budgetCny: value == null ? null : { min: null, max: value } };
  }
  function syncNumberInput(input, value) {
    if (document.activeElement === input && input.value !== "" && Number(input.value) === value) return;
    input.value = value ?? "";
  }
  function buildRangePicker(key, state) {
    const budget = key === "budget";
    const id = budget ? "homeBudgetPicker" : "homeTokenPicker";
    const title = budget ? "月预算" : "月 Token 数";
    const factor = budget ? 1 : state.tokenUnit === "B" ? 1000 : state.tokenUnit === "M" ? 1 : 100;
    const unit = budget ? "元" : state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿";
    return `<details class="filter-picker" id="${id}"><summary><span class="range-picker-title">${title}</span><span ${budget ? "data-budget-label" : "data-token-label"}></span></summary>
      <div class="filter-picker-menu budget-menu" role="group" aria-label="${budget ? "每月预算" : "每月 Token 用量"}">
        <div class="range-picker-value"><label class="filter-inline"><span>${budget ? "不超过" : "至少"}</span><span class="range-picker-number">${budget ? '<span class="range-picker-unit" aria-hidden="true">¥</span>' : ""}<input type="number" inputmode="decimal" min="0" step="any" ${budget ? 'data-budget-part="max"' : 'data-token-part="min"'} aria-label="${budget ? "最高月预算（人民币）" : `最低月 Token 数（${unit}）`}" placeholder="不限">${budget ? "" : `<span class="range-picker-unit" data-token-unit-label aria-hidden="true">${unit}</span>`}</span></label></div>
        <div class="range-picker-slider"><input type="range" min="0" max="${budget ? budgetSliderMax : tokenSliderMax}" step="1" data-range-picker="${key}" aria-label="${title}滑块" aria-describedby="${id}Help">
          <div class="range-picker-ticks">${budget ? '<button type="button" class="range-picker-mode" data-budget-mode="api" style="--tick-position:0%" aria-label="仅按量 API"><span>仅 API</span></button>' : '<button type="button" class="range-picker-mode" data-range-clear="token" style="--tick-position:0%"><span>不限</span></button>'}${rangeKnots[key].map((n, i) => n === 0 ? "" : `<button type="button" data-range-knot="${key}" data-knot-value="${n}" style="--tick-position:${(i * 100 + 1) / (budget ? budgetSliderMax : tokenSliderMax) * 100}%" aria-label="${budget ? "预算上限" : "最低月用量"} ${n / factor} ${unit}"><span>${n / factor}</span></button>`).join("")}${budget ? '<button type="button" class="range-picker-mode" data-budget-mode="any" data-range-clear="budget" style="--tick-position:100%"><span>不限</span></button>' : ""}</div></div>
        <p class="filter-help" id="${id}Help">${budget ? "两端为仅按量 API / 不限，中间按金额筛选。按量 API 按月用量估算支出，未填用量时不判断预算。" : "按所选模型的月额度筛选，额度不相加；额度未明确的订阅不参与匹配。按量 API 按填写用量估算费用。"}</p>
      </div></details>`;
  }

  function buildPicker({ id, label, key, items, state }) {
    const model = key === "modelSlugs";
    const rawSelected = valuesFor(state, key);
    const selected =
      rawSelected === null ? items.map((item) => item.slug) : rawSelected || [];
    const allIds = items.map((item) => item.slug);
    const countText =
      rawSelected === null || selected.length === allIds.length
        ? "全部"
        : `${selected.length} 项`;
    const options = items
      .map((item) => {
        const value = String(item.slug);
        return `<label data-filter-option data-search-text="${escapeHtml(optionLabel(item, key))}"><input type="checkbox" value="${escapeHtml(value)}" ${selected.includes(value) ? "checked" : ""}><span>${escapeHtml(optionLabel(item, key))}</span></label>`;
      })
      .join("");
    return `<details class="filter-picker" data-picker="${escapeHtml(key)}" id="${escapeHtml(id)}">
      <summary><span>${escapeHtml(label)}</span><span class="filter-picker-count" data-picker-count>${escapeHtml(countText)}</span>${model ? '<span class="model-match-warning" data-model-match-warning hidden>需包含全部</span>' : ""}</summary>
      <div class="filter-picker-menu" role="group" aria-label="选择${escapeHtml(label)}">
        <input type="search" data-picker-search placeholder="搜索${escapeHtml(label)}" aria-label="搜索${escapeHtml(label)}">
        <div class="filter-picker-tools"><button type="button" data-picker-action="clear">清空</button><button type="button" data-picker-action="all">全选</button><button type="button" data-picker-action="default">恢复默认</button></div>
        ${model ? '<div class="model-preset-options" aria-label="模型快捷选择"><button type="button" data-model-preset="high-volume-models" aria-pressed="false" disabled>甜品级精选</button><button type="button" data-model-preset="sota-models" aria-pressed="false" disabled>顶尖与前沿精选</button><span data-model-selection-label></span></div><p class="model-preset-error" data-model-preset-error hidden>精选名单暂时无法加载。<button type="button" data-retry-model-presets>重试</button></p>' : ""}
        <div data-picker-options>${options}</div><p class="filter-search-empty" role="status" hidden>没有匹配结果，试试其他关键词。</p>
        ${model ? `<div class="model-match-setting" data-model-match-setting hidden><label class="model-match-check"><input type="checkbox" data-model-require-all aria-describedby="${id}MatchHelp" aria-controls="${id}MatchConfirm" aria-expanded="false"><span>需包含全部模型</span></label><p id="${id}MatchHelp">同一个套餐须包含全部所选模型，且每个模型都满足用量等条件，可能大幅减少匹配方案。</p><div class="model-match-confirm" id="${id}MatchConfirm" data-model-match-confirm hidden><p data-model-match-impact role="status" aria-live="polite"></p><div><button type="button" data-model-match-action="confirm">确认开启</button><button type="button" data-model-match-action="cancel">取消</button></div></div></div>` : ""}
      </div>
    </details>`;
  }

  const choices = {
    tool: [
      "使用工具",
      [
        ["any", "不限"],
        ["codex", "Codex"],
        ["claude", "Claude Code"],
        ["github", "GitHub Copilot"],
        ["other", "其他工具"],
      ],
    ],
    platformStatusMax: [
      "购买状态",
      [
        ["open", "开放购买"],
        ["limited", "含定时放量"],
        ["paused", "含暂停售"],
        ["delisted", "全部状态"],
      ],
    ],
    preference: [
      "方案排序",
      [
        ["balanced", "均衡：平台评分"],
        ["quality", "效果：最高 AA 分"],
        ["cost", "省钱：月支出"],
        ["variety", "多模型：模型数量"],
      ],
    ],
  };
  const checks = {
    imageRequired: "需要图片理解",
    domesticNetworkOnly: "无需境外网络",
    domesticPaymentOnly: "无需境外支付",
    includeDiscontinued: "包含下架套餐",
  };
  let presetPromise;
  function loadGroups(context) {
    if (!presetPromise)
      presetPromise = fetch("/model-comparison-presets.json")
        .then((r) => {
          if (!r.ok) throw new Error("模型分组加载失败");
          return r.json();
        })
        .catch((error) => {
          presetPromise = null;
          throw error;
        });
    return presetPromise.then((doc) => {
      context.modelGroups = doc.groups || [];
      return context.modelGroups;
    });
  }
  function mount(options) {
    const opts = options || {},
      full = opts.mode === "full";
    const host =
      opts.element || document.getElementById("homepageUnifiedFiltersMount");
    const context = opts.context || root.codingplanEntityContext;
    if (!host || !context || !root.EntityData) return false;
    if (host.filterController) return true;
    const config = opts.config || root.appConfig || {};
    const platforms = context.platforms.filter(
        (x) => x.catalogVisible !== false,
      ),
      models = context.models;
    let state = Filters.createDefaultState(config, {
      mode: full ? "full" : "home",
      featuredPreset: opts.featuredPreset,
    });
    state.tokenUnit = root.CodingPlanDisplaySettings?.getTokenUnit() || "yi";
    state.modelGroup = "any";
    state.modelMatch = "any";
    const defaults = Filters.cloneState(state);
    if (opts.featuredPreset) context.modelGroups = opts.featuredPreset.groups || [];
    let groupsReady = Array.isArray(context.modelGroups), pendingAll = false;
    const presetSlugs = id => [...new Set((context.modelGroups || [])
      .filter(group => group.enabled !== false && (id === "featured" || group.id === id))
      .flatMap(group => group.modelSlugs || []))].filter(slug => models.some(m => m.slug === slug));
    const sameSelection = slugs => Array.isArray(state.modelSlugs) && slugs.length === state.modelSlugs.length && slugs.every(slug => state.modelSlugs.includes(slug));
    function selectionPreset() {
      if (state.modelSlugs === null) return "all";
      if (!state.modelSlugs.length) return "clear";
      if (groupsReady && sameSelection(presetSlugs("featured"))) return "featured";
      return (context.modelGroups || []).find(group => sameSelection(presetSlugs(group.id)))?.id || "custom";
    }
    function resetModelList() {
      const picker = host.querySelector('[data-picker="modelSlugs"]');
      picker.querySelector('[data-picker-search]').value = "";
      picker.querySelectorAll('[data-filter-option]').forEach(option => { option.hidden = false; });
      picker.querySelector('.filter-search-empty').hidden = true;
      const list = picker.querySelector('[data-picker-options]');
      list.scrollTop = 0;
      const selected = state.modelSlugs;
      const options = [...list.children];
      options.sort((a, b) => {
        const av = a.querySelector('input').value, bv = b.querySelector('input').value;
        const rank = value => selected === null ? models.findIndex(m => m.slug === value)
          : selected.includes(value) ? selected.indexOf(value) - models.length : models.findIndex(m => m.slug === value);
        return rank(av) - rank(bv);
      }).forEach(option => list.append(option));
    }
    function selectModelPreset(id, source = "manual") {
      if (id !== "all" && !groupsReady) return false;
      const slugs = id === "all" ? null : presetSlugs(id);
      if (slugs && !slugs.length) return false;
      state.modelSlugs = slugs;
      state.modelGroup = "any";
      state.modelMatch = "any";
      resetModelList();
      publish(source);
      return true;
    }
    const params = new URLSearchParams(location.search),
      platform = params.get("platform");
    if (platform && platforms.some((x) => x.slug === platform))
      state.platformSlugs = [platform];
    const monitor = full && opts.view === "monitor";
    const model = params.get("model");
    if (model && models.some(x => x.slug === model)) state.modelSlugs = [model];
    if (params.get("billing") === "payg") state.apiOnly = true;
    host.innerHTML = `<section class="filter-state-bar surface-panel" aria-label="统一筛选">
      <div class="filter-state-grid">
      ${buildPicker({ id: "homePlatformPicker", label: "平台", key: "platformSlugs", items: platforms, state })}
      ${buildPicker({ id: "homeModelPicker", label: "模型", key: "modelSlugs", items: models, state })}
      ${
        monitor
          ? ""
          : `${buildRangePicker("budget", state)}${buildRangePicker("token", state)}`
      }
      </div>
      <div class="guide-filter-fields">${Object.entries(choices)
        .filter(([k]) => !monitor && (!full || k !== "preference"))
        .map(
          ([key, [label, items]]) =>
            `<label class="filter-inline filter-choice"><span>${label}</span><select data-filter-field="${key}">${items.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`,
        )
        .join("")}
      <div class="filter-checks">${
        monitor
          ? ""
          : Object.entries(checks)
              .filter(([key]) => full || key !== "includeDiscontinued")
              .map(
                ([key, label]) =>
                  `<label class="filter-inline"><input type="checkbox" data-filter-field="${key}">${label}</label>`,
              )
              .join("")
      }</div></div>
      <div class="filter-state-actions"><button type="button" data-filter-action="clear-all">清空全部</button><button type="button" data-filter-action="restore-all">${full ? "恢复全量" : "恢复默认"}</button></div>
      <p class="filter-state-hint" data-filter-hint>${monitor ? "监控只使用平台、模型条件；未监控项目没有统计。" : "条件同时生效；网络、支付要求未确认的方案不通过对应限制。"}</p>
      ${full ? "" : '<p class="home-monitor-filter-note">监控仅使用平台、模型条件。预算等购买条件已保留，返回对比时继续生效。</p>'}
      <div data-active-limits class="filter-active-limits" aria-live="polite"></div>
      </section>`;
    const controller = {
      getState: () => Filters.cloneState(state),
      context,
      config,
      selectModelPreset,
      getModelPreset: selectionPreset,
      setState: (patch, source = "guide") => {
        // Old guide calls map groups to actual picks; no hidden intersection remains.
        if (patch.modelGroup && patch.modelGroup !== "any") {
          if (!groupsReady) return;
          const slugs = presetSlugs(patch.modelGroup);
          if (!slugs.length) return;
          patch = {...patch, modelSlugs:slugs, modelMatch:"any", modelGroup:"any"};
        }
        state = Filters.normalizeState({ ...state, ...patch, modelGroup: "any" });
        if (!state.modelSlugs || state.modelSlugs.length < 2) state.modelMatch = "any";
        if (Object.hasOwn(patch, "modelSlugs")) resetModelList();
        publish(source);
      },
      reset: () => {
        state = Filters.cloneState(defaults);
        resetModelList();
        publish("manual");
      },
    };
    host.filterController = controller;
    if (!full) root.CodingPlanHomeFilters = controller;
    function positionModelPanel() {
      const picker = host.querySelector('[data-picker="modelSlugs"]');
      if (!picker.open) return;
      const menu = picker.querySelector('.filter-picker-menu');
      const viewport = root.visualViewport;
      const width = viewport?.width || root.innerWidth;
      const height = viewport?.height || root.innerHeight;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const mobile = root.innerWidth <= 800;
      const panelWidth = mobile ? width - 28 : Math.min(380, width - 28);
      const minTop = Math.max(top + 14, Math.min(top + height - 100, (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 8));
      Object.assign(menu.style, {position:"fixed", width:`${panelWidth}px`, maxHeight:`${Math.min(620, top + height - minTop - 14)}px`, right:"auto", bottom:"auto"});
      const anchor = picker.querySelector('summary').getBoundingClientRect();
      const panelHeight = menu.getBoundingClientRect().height;
      menu.style.left = `${mobile ? left + 14 : Math.max(left + 14, Math.min(anchor.left, left + width - panelWidth - 14))}px`;
      menu.style.top = `${Math.max(minTop, Math.min(mobile ? top + height - panelHeight - 18 : anchor.bottom + 8, top + height - panelHeight - 14))}px`;
    }
    function render() {
      for (const [key, items] of [
        ["platformSlugs", platforms],
        ["modelSlugs", models],
      ]) {
        const picker = host.querySelector(`[data-picker="${key}"]`),
          selected = state[key];
        picker.querySelector("[data-picker-count]").textContent =
          selected === null
            ? "全部"
            : selected.length
              ? `${selected.length} 项`
              : "不限";
        picker.querySelectorAll('[data-filter-option] input').forEach((el) => {
          el.checked = selected === null || selected.includes(el.value);
        });
      }
      const modelPicker = host.querySelector('[data-picker="modelSlugs"]');
      const modelCount = state.modelSlugs === null ? models.length : state.modelSlugs.length;
      const strict = state.modelMatch === "all" && modelCount > 1;
      modelPicker.querySelector('[data-model-match-setting]').hidden = modelCount < 2;
      modelPicker.querySelector('[data-model-require-all]').checked = strict || pendingAll;
      modelPicker.querySelector('[data-model-require-all]').setAttribute('aria-expanded', String(pendingAll));
      modelPicker.querySelector('[data-model-match-warning]').hidden = !strict;
      modelPicker.querySelector('[data-model-match-confirm]').hidden = !pendingAll;
      const preset = selectionPreset();
      modelPicker.querySelector('[data-model-selection-label]').textContent = ({featured:"所有精选",all:"全部模型",clear:"未勾选 · 模型不限",custom:"自定义"})[preset] || "";
      modelPicker.querySelectorAll('[data-model-preset]').forEach(button => {
        button.disabled = !groupsReady;
        button.setAttribute('aria-pressed', String(button.dataset.modelPreset === preset));
      });
      modelPicker.querySelector('[data-picker-action="default"]').disabled = !groupsReady;
      host.querySelectorAll("[data-filter-field]").forEach((el) => {
        const v = state[el.dataset.filterField];
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = v;
      });
      const factor = state.tokenUnit === "B" ? 1000 : state.tokenUnit === "M" ? 1 : 100;
      const budget = host.querySelector("[data-budget-part]"),
        tokens = host.querySelector("[data-token-part]");
      if (budget) {
        syncNumberInput(budget, state.budgetCny?.max);
        host.querySelector("[data-budget-label]").textContent =
          state.apiOnly ? `仅 API${state.budgetCny?.max != null ? ` · ≤¥${state.budgetCny.max}` : ""}` : state.budgetCny?.max != null ? `≤ ¥${state.budgetCny.max}` : "不限";
        budget.placeholder = state.apiOnly ? "金额不限" : "不限";
      }
      if (tokens) {
        syncNumberInput(tokens, state.monthlyTokenRange?.min == null ? null : state.monthlyTokenRange.min / factor);
        tokens.style.setProperty("--token-digits", String(Math.max(4, tokens.value.length)));
        host.querySelector("[data-token-unit-label]").textContent =
          state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿";
        tokens.setAttribute("aria-label", `最低月 Token 数（${state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿"}）`);
        host.querySelector("[data-token-label]").textContent =
          state.monthlyTokenRange
            ? `≥ ${Filters.targetTokens(state) / factor} ${state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿"}`
            : "不限";
      }
      host.querySelectorAll("[data-range-picker]").forEach((slider) => {
        const key = slider.dataset.rangePicker;
        const value = key === "budget" ? state.budgetCny?.max : state.monthlyTokenRange?.min;
        const unit = key === "budget" ? "元" : state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿";
        const displayFactor = key === "token" ? factor : 1;
        slider.value = key === "budget"
          ? state.apiOnly ? 0 : value == null ? budgetSliderMax : rangePosition(key, value) + 1
          : value == null ? 0 : rangePosition(key, value) + 1;
        slider.style.setProperty("--range-fill", `${Number(slider.value) / Number(slider.max) * 100}%`);
        slider.setAttribute("aria-valuetext", key === "budget" && state.apiOnly
          ? `仅按量 API，${value == null ? "金额不限" : `不超过 ${value} 元`}`
          : value == null ? "不限" : `${key === "budget" ? "不超过" : "至少"} ${value / displayFactor} ${unit}`);
        host.querySelectorAll(`[data-range-knot="${key}"]`).forEach((button) => {
          const n = Number(button.dataset.knotValue);
          button.querySelector("span").textContent = n / displayFactor;
          button.setAttribute("aria-label", `${key === "budget" ? "预算上限" : "最低月用量"} ${n / displayFactor} ${unit}`);
          button.setAttribute("aria-pressed", String(value === n && !(key === "budget" && state.apiOnly)));
        });
      });
      host.querySelectorAll("[data-budget-mode]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.budgetMode === "api" ? state.apiOnly : !state.apiOnly && !state.budgetCny));
      });
      host.querySelector('[data-range-clear="token"]')?.setAttribute("aria-pressed", String(!state.monthlyTokenRange));
      const tags = [];
      for (const key of ["platformSlugs", "modelSlugs"])
        if (state[key]?.length)
          tags.push([key, key === "platformSlugs" ? "已选平台" : "已选模型"]);
      if (state.modelMatch === "all") tags.push(["modelMatch", "需包含全部模型"]);
      if (state.budgetCny) tags.push(["budgetCny", "预算上限"]);
      if (state.apiOnly) tags.push(["apiOnly", "仅按量 API"]);
      if (state.monthlyTokenRange) tags.push(["monthlyTokenRange", "月用量"]);
      for (const [key, [label]] of Object.entries(choices))
        if (!["any", "balanced", "delisted"].includes(state[key]))
          tags.push([key, label]);
      for (const [key, label] of Object.entries(checks))
        if (state[key] && key !== "includeDiscontinued")
          tags.push([key, label]);
      host.querySelector("[data-active-limits]").innerHTML = tags
        .map(
          ([k, t]) =>
            `<button type="button" ${k === "modelMatch" ? 'class="model-match-warning"' : ""} data-remove-filter="${k}" aria-label="取消${t}限制">${t} ×</button>`,
        )
        .join("");
      positionModelPanel();
    }
    function publish(source = "manual") {
      if (!full) state.includeDiscontinued = false;
      pendingAll = false;
      state.tokenUnit = root.CodingPlanDisplaySettings?.getTokenUnit() || state.tokenUnit;
      const clean = Filters.cloneState(state);
      if (!full) {
        root.__codingplanUnifiedFiltersState = clean;
        root.__codingplanHomeApi?.setUnifiedFilters(clean);
      }
      if (opts.onChange) opts.onChange(clean);
      render();
      root.dispatchEvent(
        new CustomEvent("codingplan:filters-changed", {
          detail: { state: clean, source, full },
        }),
      );
    }
    host.addEventListener("input", (event) => {
      const el = event.target;
      if (el.matches("[data-range-picker]")) {
        const key = el.dataset.rangePicker;
        const position = Number(el.value);
        if (key === "budget") Object.assign(state, position === 0 ? setBudget(null, true)
          : position >= budgetNumericMax + 50 ? setBudget(null)
          : setBudget(rangeValue(key, Math.min(position, budgetNumericMax) - 1)));
        else state.monthlyTokenRange = position === 0 ? null : { min: rangeValue(key, position - 1), max: null };
        publish();
        return;
      }
      if (el.matches("[data-picker-search]")) {
        const q = el.value.trim().toLowerCase();
        el.closest(".filter-picker-menu")
          .querySelectorAll("[data-filter-option]")
          .forEach(
            (x) => (x.hidden = !x.dataset.searchText.toLowerCase().includes(q)),
          );
        const menu = el.closest(".filter-picker-menu");
        menu.querySelector('.filter-search-empty').hidden = [...menu.querySelectorAll('[data-filter-option]')].some(x => !x.hidden);
        positionModelPanel();
        return;
      }
      if (el.matches("[data-budget-part]")) {
        if (el.validity.badInput) return;
        state.apiOnly = false;
        state.budgetCny =
          el.value === ""
            ? null
            : { min: null, max: Math.max(0, Number(el.value)) };
        publish();
      }
      if (el.matches("[data-token-part]")) {
        if (el.validity.badInput) return;
        state.monthlyTokenRange =
          el.value === ""
            ? null
            : {
                min:
                  Math.max(0, Number(el.value)) *
                  (state.tokenUnit === "B" ? 1000 : state.tokenUnit === "M" ? 1 : 100),
                max: null,
              };
        publish();
      }
    });
    host.addEventListener("focusout", (event) => {
      const el = event.target;
      if (el.matches("[data-budget-part]")) el.value = state.budgetCny?.max ?? "";
      if (el.matches("[data-token-part]")) el.value = state.monthlyTokenRange?.min == null ? "" : state.monthlyTokenRange.min / (state.tokenUnit === "B" ? 1000 : state.tokenUnit === "M" ? 1 : 100);
    });
    host.addEventListener("change", (event) => {
      const el = event.target;
      if (el.matches("[data-model-require-all]")) {
        if (!el.checked) { state.modelMatch = "any"; publish(); return; }
        pendingAll = true;
        const selected = state.modelSlugs === null ? models.map(m => m.slug) : state.modelSlugs;
        const count = match => {
          const offers = Filters.matchingOffers(context, {...state, modelSlugs:selected, modelMatch:match}, {usdToCnyRate:config.usdToCnyRate,platformCatalog:config.platformCatalog});
          if (full) return new Set(offers.filter(offer => opts.view !== "plans" || offer.plan.billingMode !== "payg").map(offer => offer.plan.slug)).size;
          return offers.reduce((n, offer) => n + (offer.plan.billingMode === "payg" ? offer.rows.length : 1), 0);
        };
        const before = count("any"), after = count("all");
        host.querySelector('[data-model-match-impact]').textContent = `开启后，${full ? "符合条件的套餐" : "匹配方案"}从 ${before} 个变为 ${after} 个。${after === 0 ? "当前没有同时满足条件的套餐。" : ""}确认后生效。`;
        render();
        host.querySelector('[data-model-match-action="confirm"]').focus({preventScroll:true});
      } else if (el.matches("[data-filter-field]")) {
        state[el.dataset.filterField] =
          el.type === "checkbox" ? el.checked : el.value;
        publish();
      } else if (el.matches("[data-filter-option] input")) {
        const picker = el.closest("[data-picker]");
        state[picker.dataset.picker] = [
          ...picker.querySelectorAll('[data-filter-option] input:checked'),
        ].map((x) => x.value);
        if (picker.dataset.picker === "modelSlugs") {
          state.modelGroup = "any";
          if (state.modelSlugs.length < 2) state.modelMatch = "any";
        }
        publish();
      }
    });
    host.addEventListener("click", (event) => {
      const el = event.target.closest("button");
      if (!el) return;
      if (el.hasAttribute('data-retry-model-presets')) { refreshGroups(); return; }
      if (el.dataset.modelPreset) { selectModelPreset(el.dataset.modelPreset); return; }
      if (el.dataset.modelMatchAction) {
        const confirm = el.dataset.modelMatchAction === "confirm" && pendingAll;
        pendingAll = false;
        if (confirm) {
          if (state.modelSlugs === null) state.modelSlugs = models.map(m => m.slug);
          state.modelMatch = "all";
          publish();
        } else render();
        host.querySelector('[data-model-require-all]').focus({preventScroll:true});
        return;
      }
      if (el.dataset.pickerAction) {
        const key = el.closest("[data-picker]").dataset.picker;
        if (key === "modelSlugs" && el.dataset.pickerAction === "default") { selectModelPreset("featured"); return; }
        if (key === "modelSlugs") { state.modelMatch = "any"; state.modelGroup = "any"; }
        state[key] =
          el.dataset.pickerAction === "clear"
            ? []
            : el.dataset.pickerAction === "all"
              ? null
              : defaults[key];
        if (key === "modelSlugs") resetModelList();
      } else if (el.dataset.budgetMode) {
        Object.assign(state, setBudget(null, el.dataset.budgetMode === "api"));
      } else if (el.dataset.rangeKnot || el.dataset.rangeClear) {
        const key = el.dataset.rangeKnot || el.dataset.rangeClear;
        const value = el.dataset.rangeClear ? null : Number(el.dataset.knotValue);
        if (key === "budget") Object.assign(state, setBudget(value));
        else state.monthlyTokenRange = value == null ? null : { min: value, max: null };
      }
      else if (el.dataset.removeFilter) {
        if (el.dataset.removeFilter === "modelSlugs") state.modelMatch = "any";
        state[el.dataset.removeFilter] = Filters.createDefaultState(
          {},
          { mode: "full" },
        )[el.dataset.removeFilter];
      } else if (el.dataset.filterAction)
        state =
          el.dataset.filterAction === "restore-all"
            ? Filters.cloneState(defaults)
            : {
                ...Filters.createDefaultState({}, { mode: "full" }),
                tokenUnit: state.tokenUnit,
              };
      else return;
      if (el.dataset.filterAction || el.dataset.removeFilter === "modelSlugs") resetModelList();
      publish();
    });
    host.addEventListener("keydown", (event) => {
      if (event.target.matches('[data-range-picker="budget"]')) {
        const position = Number(event.target.value);
        const next = ["ArrowRight", "ArrowUp"].includes(event.key) && position === budgetNumericMax;
        const previous = ["ArrowLeft", "ArrowDown"].includes(event.key) && position === budgetSliderMax;
        if (next || previous) {
          event.preventDefault();
          Object.assign(state, setBudget(next ? null : rangeKnots.budget.at(-1)));
          publish();
          return;
        }
      }
      if (event.key === "Escape") {
        const d = event.target.closest("details[open]");
        if (d) {
          pendingAll = false; render();
          d.open = false;
          d.querySelector("summary").focus();
        }
      }
    });
    document.addEventListener("click", (event) => {
      host.querySelectorAll("details[open]").forEach((d) => {
        if (!d.contains(event.target)) { d.open = false; if (pendingAll) { pendingAll = false; render(); } }
      });
    });
    host.querySelector('[data-picker="modelSlugs"]').addEventListener('toggle', event => {
      if (!event.target.open) {
        resetModelList();
        if (pendingAll) { pendingAll = false; render(); }
      }
      positionModelPanel();
    });
    root.addEventListener('resize', positionModelPanel);
    root.addEventListener('scroll', positionModelPanel, {passive:true});
    root.visualViewport?.addEventListener('resize', positionModelPanel);
    root.addEventListener("codingplan:token-unit-changed", () => publish("display"));
    host.dataset.mounted = "1";
    document.body.classList.add(
      full ? "tool-unified-active" : "homepage-unified-active",
    );
    resetModelList();
    publish("init");
    function refreshGroups() {
      host.querySelector('[data-retry-model-presets]').disabled = true;
      loadGroups(context).then(() => {
        groupsReady = true;
        host.querySelector('[data-model-preset-error]').hidden = true;
        publish("catalog");
        root.dispatchEvent(new Event("codingplan:filters-ready"));
      }).catch(() => {
        host.querySelector('[data-model-preset-error]').hidden = false;
      }).finally(() => { host.querySelector('[data-retry-model-presets]').disabled = false; });
    }
    refreshGroups();
    return true;
  }
  root.CodingPlanFilterUI = { mount, loadGroups };
  if (!document.getElementById("homepageUnifiedFiltersMount")) return;
  function start() {
    if (!mount()) root.setTimeout(start, 250);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})(globalThis);
