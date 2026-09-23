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

  function pickerHeading(label) {
    return `<div class="filter-menu-heading"><strong>${escapeHtml(label)}</strong><button type="button" data-picker-close>完成</button></div>`;
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
      <div class="filter-picker-menu">
        ${pickerHeading("选择" + label)}
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
        ["sota-models", "SOTA"],
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
      "推荐排序",
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
    });
    const defaults = Filters.cloneState(state);
    const params = new URLSearchParams(location.search),
      platform = params.get("platform");
    if (platform && platforms.some((x) => x.slug === platform))
      state.platformSlugs = [platform];
    const monitor = full && opts.view === "monitor";
    host.innerHTML = `<section class="filter-state-bar surface-panel" aria-label="统一筛选">
      <div class="filter-state-grid">
      ${buildPicker({ id: "homePlatformPicker", label: "平台", key: "platformSlugs", items: platforms, state })}
      ${buildPicker({ id: "homeModelPicker", label: "模型", key: "modelSlugs", items: models, state })}
      ${
        monitor
          ? ""
          : `<details class="filter-picker" id="homeBudgetPicker"><summary>月预算 <span data-budget-label></span></summary><div class="filter-picker-menu budget-menu">${pickerHeading("每月预算")}
        <label class="filter-inline">不超过 ¥<input type="number" min="0" step="any" data-budget-part="max" aria-label="最高月预算（人民币）" placeholder="不限"></label>
        <div class="budget-presets">${[50, 100, 200, 500].map((n) => `<button type="button" data-budget-preset="${n}">${n} 元以内</button>`).join("")}<button type="button" data-budget-action="clear">不限</button></div>
        <p class="filter-help">按量 API 在填写月用量后估算月支出；未填写时不判断其月预算。</p></div></details>
      <details class="filter-picker" id="homeTokenPicker"><summary>月 Token 数 <span data-token-label></span></summary><div class="filter-picker-menu budget-menu">${pickerHeading("每月 Token 用量")}
        <label class="filter-inline">至少<input type="number" min="0" step="any" data-token-part="min" aria-label="最低月 Token 数" placeholder="不限"><span data-token-unit-label></span></label>
        <button type="button" data-token-clear>不限</button>
        <p class="filter-help">订阅按所选模型额度判断，不相加；未知额度排除。按量 API 按此用量估算费用。</p></div></details><div class="global-token-unit" aria-label="Token 显示单位"><button type="button" data-global-token-unit="yi">亿</button><button type="button" data-global-token-unit="M">M</button></div>`
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
        budget.value = state.budgetCny?.max ?? "";
        host.querySelector("[data-budget-label]").textContent =
          state.budgetCny?.max != null ? `≤ ¥${state.budgetCny.max}` : "不限";
      }
      if (tokens) {
        tokens.value =
          state.monthlyTokenRange?.min == null
            ? ""
            : state.monthlyTokenRange.min / factor;
        host.querySelector("[data-token-unit-label]").textContent =
          state.tokenUnit === "M" ? "M" : "亿";
        host.querySelector("[data-token-label]").textContent =
          state.monthlyTokenRange
            ? `≥ ${Filters.targetTokens(state) / factor} ${state.tokenUnit === "M" ? "M" : "亿"}`
            : "不限";
      }
      host
        .querySelectorAll("[data-global-token-unit]")
        .forEach((el) =>
          el.setAttribute(
            "aria-pressed",
            String(el.dataset.globalTokenUnit === state.tokenUnit),
          ),
        );
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
        state.budgetCny =
          el.value === ""
            ? null
            : { min: null, max: Math.max(0, Number(el.value)) };
        publish();
      }
      if (el.matches("[data-token-part]")) {
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
      if (el.hasAttribute("data-picker-close")) {
        const picker = el.closest("details");
        picker.open = false;
        picker.querySelector("summary").focus();
        return;
      }
      if (el.dataset.pickerAction) {
        const key = el.closest("[data-picker]").dataset.picker;
        state[key] =
          el.dataset.pickerAction === "clear"
            ? []
            : el.dataset.pickerAction === "all"
              ? null
              : defaults[key];
      } else if (el.hasAttribute("data-budget-preset"))
        state.budgetCny = { min: null, max: Number(el.dataset.budgetPreset) };
      else if (el.hasAttribute("data-budget-action")) state.budgetCny = null;
      else if (el.hasAttribute("data-token-clear"))
        state.monthlyTokenRange = null;
      else if (el.dataset.globalTokenUnit)
        state.tokenUnit = el.dataset.globalTokenUnit;
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
