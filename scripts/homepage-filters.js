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
  function syncNumberInput(input, value) {
    if (document.activeElement === input && input.value !== "" && Number(input.value) === value) return;
    input.value = value ?? "";
  }
  function buildRangePicker(key, state) {
    const budget = key === "budget";
    const id = budget ? "homeBudgetPicker" : "homeTokenPicker";
    const title = budget ? "月预算" : "月 Token 数";
    const factor = !budget && state.tokenUnit !== "M" ? 100 : 1;
    const unit = budget ? "元" : state.tokenUnit === "M" ? "M" : "亿";
    return `<details class="filter-picker" id="${id}"><summary>${title} <span ${budget ? "data-budget-label" : "data-token-label"}></span></summary>
      <div class="filter-picker-menu budget-menu" role="group" aria-label="${budget ? "每月预算" : "每月 Token 用量"}">
        <div class="range-picker-value"><label class="filter-inline"><span>${budget ? "不超过" : "至少"}</span><span class="range-picker-number">${budget ? '<span class="range-picker-unit" aria-hidden="true">¥</span>' : ""}<input type="number" inputmode="decimal" min="0" step="any" ${budget ? 'data-budget-part="max"' : 'data-token-part="min"'} aria-label="${budget ? "最高月预算（人民币）" : `最低月 Token 数（${unit}）`}" placeholder="不限">${budget ? "" : `<span class="range-picker-unit" data-token-unit-label aria-hidden="true">${unit}</span>`}</span></label><button type="button" data-range-clear="${key}">不限</button></div>
        <div class="range-picker-slider"><input type="range" min="0" max="${(rangeKnots[key].length - 1) * 100}" step="1" data-range-picker="${key}" aria-label="${title}滑块" aria-describedby="${id}Help">
          <div class="range-picker-ticks">${rangeKnots[key].map((n, i, knots) => `<button type="button" data-range-knot="${key}" data-knot-value="${n}" style="--tick-position:${i / (knots.length - 1) * 100}%" aria-label="${budget ? "预算上限" : "最低月用量"} ${n / factor} ${unit}">${n / factor}</button>`).join("")}</div></div>
        <p class="range-picker-hint">拖动或点击刻度，也可直接输入其他数值。</p>
        <p class="filter-help" id="${id}Help">${budget ? "按量 API 在填写月用量后估算月支出；未填写时不判断其月预算。" : "订阅按所选模型额度判断，不相加；未知额度排除。按量 API 按此用量估算费用。"}</p>
      </div></details>`;
  }

  function buildPicker({ id, label, key, items, state }) {
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
      <summary><span>${escapeHtml(label)}</span><span class="filter-picker-count" data-picker-count>${escapeHtml(countText)}</span></summary>
      <div class="filter-picker-menu" role="group" aria-label="选择${escapeHtml(label)}">
        <input type="search" data-picker-search placeholder="搜索${escapeHtml(label)}" aria-label="搜索${escapeHtml(label)}">
        <div class="filter-picker-tools"><button type="button" data-picker-action="clear">清空</button><button type="button" data-picker-action="all">全选</button><button type="button" data-picker-action="default">恢复默认</button></div>
        <div data-picker-options>${options}</div><p class="filter-search-empty" role="status" hidden>没有匹配结果，试试其他关键词。</p>
      </div>
    </details>`;
  }

  const choices = {
    useCase: [
      "用途",
      [
        ["any", "不限"],
        ["coding", "编程"],
        ["general", "写作 / 通用任务"],
        ["api", "自建应用 API"],
      ],
    ],
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
    modelGroup: [
      "模型档次",
      [
        ["any", "不限"],
        ["sota-models", "顶尖与前沿"],
        ["high-volume-models", "甜品级"],
      ],
    ],
    modelMatch: [
      "模型匹配",
      [
        ["any", "任意所选"],
        ["all", "同时支持全部"],
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
    const defaults = Filters.cloneState(state);
    const params = new URLSearchParams(location.search),
      platform = params.get("platform");
    if (platform && platforms.some((x) => x.slug === platform))
      state.platformSlugs = [platform];
    const monitor = full && opts.view === "monitor";
    const model = params.get("model");
    if (model && models.some(x => x.slug === model)) state.modelSlugs = [model];
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
        .filter(([k]) => (!monitor || k === "modelMatch") && (!full || k !== "preference"))
        .map(
          ([key, [label, items]]) =>
            `<label class="filter-inline filter-choice"><span>${label}</span><select data-filter-field="${key}">${items.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`,
        )
        .join("")}
      <div class="filter-checks">${
        monitor
          ? ""
          : Object.entries(checks)
              .map(
                ([key, label]) =>
                  `<label class="filter-inline"><input type="checkbox" data-filter-field="${key}">${label}</label>`,
              )
              .join("")
      }</div></div>
      <div class="filter-state-actions"><button type="button" data-filter-action="clear-all">清空全部</button><button type="button" data-filter-action="restore-all">${full ? "恢复全量" : "恢复默认"}</button></div>
      <p class="filter-state-hint" data-filter-hint>${monitor ? "监控只使用平台、模型条件；未监控项目没有统计。" : "条件同时生效；网络、支付要求未确认的方案不通过对应限制。"}</p>
      ${full ? "" : '<p class="home-monitor-filter-note">监控仅使用平台、模型与模型匹配条件。预算等购买条件已保留，返回对比时继续生效。</p>'}
      <div data-active-limits class="filter-active-limits" aria-live="polite"></div>
      </section>`;
    const controller = {
      getState: () => Filters.cloneState(state),
      context,
      config,
      setState: (patch, source = "guide") => {
        state = Filters.normalizeState({ ...state, ...patch });
        publish(source);
      },
      reset: () => {
        state = Filters.cloneState(defaults);
        publish("manual");
      },
    };
    host.filterController = controller;
    if (!full) root.CodingPlanHomeFilters = controller;
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
        picker.querySelectorAll('input[type="checkbox"]').forEach((el) => {
          el.checked = selected === null || selected.includes(el.value);
        });
      }
      host.querySelectorAll("[data-filter-field]").forEach((el) => {
        const v = state[el.dataset.filterField];
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = v;
      });
      const factor = state.tokenUnit === "M" ? 1 : 100;
      const budget = host.querySelector("[data-budget-part]"),
        tokens = host.querySelector("[data-token-part]");
      if (budget) {
        syncNumberInput(budget, state.budgetCny?.max);
        host.querySelector("[data-budget-label]").textContent =
          state.budgetCny?.max != null ? `≤ ¥${state.budgetCny.max}` : "不限";
      }
      if (tokens) {
        syncNumberInput(tokens, state.monthlyTokenRange?.min == null ? null : state.monthlyTokenRange.min / factor);
        host.querySelector("[data-token-unit-label]").textContent =
          state.tokenUnit === "M" ? "M" : "亿";
        tokens.setAttribute("aria-label", `最低月 Token 数（${state.tokenUnit === "M" ? "M" : "亿"}）`);
        host.querySelector("[data-token-label]").textContent =
          state.monthlyTokenRange
            ? `≥ ${Filters.targetTokens(state) / factor} ${state.tokenUnit === "M" ? "M" : "亿"}`
            : "不限";
      }
      host.querySelectorAll("[data-range-picker]").forEach((slider) => {
        const key = slider.dataset.rangePicker;
        const value = key === "budget" ? state.budgetCny?.max : state.monthlyTokenRange?.min;
        const unit = key === "budget" ? "元" : state.tokenUnit === "M" ? "M" : "亿";
        const displayFactor = key === "token" ? factor : 1;
        slider.value = rangePosition(key, value);
        slider.style.setProperty("--range-fill", `${Number(slider.value) / Number(slider.max) * 100}%`);
        slider.setAttribute("aria-valuetext", value == null ? "不限" : `${key === "budget" ? "不超过" : "至少"} ${value / displayFactor} ${unit}`);
        host.querySelectorAll(`[data-range-knot="${key}"]`).forEach((button) => {
          const n = Number(button.dataset.knotValue);
          button.textContent = n / displayFactor;
          button.setAttribute("aria-label", `${key === "budget" ? "预算上限" : "最低月用量"} ${n / displayFactor} ${unit}`);
          button.setAttribute("aria-pressed", String(value === n));
        });
      });
      const tags = [];
      for (const key of ["platformSlugs", "modelSlugs"])
        if (state[key]?.length)
          tags.push([key, key === "platformSlugs" ? "已选平台" : "已选模型"]);
      if (state.budgetCny) tags.push(["budgetCny", "预算上限"]);
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
            `<button type="button" data-remove-filter="${k}" aria-label="取消${t}限制">${t} ×</button>`,
        )
        .join("");
    }
    function publish(source = "manual") {
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
        const value = rangeValue(key, Number(el.value));
        if (key === "budget") state.budgetCny = { min: null, max: value };
        else state.monthlyTokenRange = { min: value, max: null };
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
        return;
      }
      if (el.matches("[data-budget-part]")) {
        if (el.validity.badInput) return;
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
                  (state.tokenUnit === "M" ? 1 : 100),
                max: null,
              };
        publish();
      }
    });
    host.addEventListener("focusout", (event) => {
      const el = event.target;
      if (el.matches("[data-budget-part]")) el.value = state.budgetCny?.max ?? "";
      if (el.matches("[data-token-part]")) el.value = state.monthlyTokenRange?.min == null ? "" : state.monthlyTokenRange.min / (state.tokenUnit === "M" ? 1 : 100);
    });
    host.addEventListener("change", (event) => {
      const el = event.target;
      if (el.matches("[data-filter-field]")) {
        state[el.dataset.filterField] =
          el.type === "checkbox" ? el.checked : el.value;
        publish();
      } else if (el.matches("[data-filter-option] input")) {
        const picker = el.closest("[data-picker]");
        state[picker.dataset.picker] = [
          ...picker.querySelectorAll('input[type="checkbox"]:checked'),
        ].map((x) => x.value);
        publish();
      }
    });
    host.addEventListener("click", (event) => {
      const el = event.target.closest("button");
      if (!el) return;
      if (el.dataset.pickerAction) {
        const key = el.closest("[data-picker]").dataset.picker;
        state[key] =
          el.dataset.pickerAction === "clear"
            ? []
            : el.dataset.pickerAction === "all"
              ? null
              : defaults[key];
      } else if (el.dataset.rangeKnot || el.dataset.rangeClear) {
        const key = el.dataset.rangeKnot || el.dataset.rangeClear;
        const value = el.dataset.rangeClear ? null : Number(el.dataset.knotValue);
        if (key === "budget") state.budgetCny = value == null ? null : { min: null, max: value };
        else state.monthlyTokenRange = value == null ? null : { min: value, max: null };
      }
      else if (el.dataset.removeFilter)
        state[el.dataset.removeFilter] = Filters.createDefaultState(
          {},
          { mode: "full" },
        )[el.dataset.removeFilter];
      else if (el.dataset.filterAction)
        state =
          el.dataset.filterAction === "restore-all"
            ? Filters.cloneState(defaults)
            : {
                ...Filters.createDefaultState({}, { mode: "full" }),
                tokenUnit: state.tokenUnit,
              };
      else return;
      publish();
    });
    host.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const d = event.target.closest("details[open]");
        if (d) {
          d.open = false;
          d.querySelector("summary").focus();
        }
      }
    });
    document.addEventListener("click", (event) => {
      host.querySelectorAll("details[open]").forEach((d) => {
        if (!d.contains(event.target)) d.open = false;
      });
    });
    root.addEventListener("codingplan:token-unit-changed", () => publish("display"));
    host.dataset.mounted = "1";
    document.body.classList.add(
      full ? "tool-unified-active" : "homepage-unified-active",
    );
    publish("init");
    loadGroups(context)
      .then(() => {
        publish("catalog");
        root.dispatchEvent(new Event("codingplan:filters-ready"));
      })
      .catch(() => {
        host.querySelector("[data-filter-hint]").textContent =
          "模型分组加载失败，请刷新重试；未选择分组的筛选仍可使用。";
      });
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
