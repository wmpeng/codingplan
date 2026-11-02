(function (root) {
  "use strict";
  const escapeHtml = root.CodingPlanUI.escapeHtml;

  const mainlandLabel = "支持中国大陆";

  // Shared markup identity and directory summaries for the five existing pickers.
  const pickers = {
    platform: {id:"homePlatformPicker", label:"平台", key:"platformSlugs", summary:"data-picker-count"},
    model: {id:"homeModelPicker", label:"模型", key:"modelSlugs", summary:"data-picker-count"},
    budget: {id:"homeBudgetPicker", label:"月预算", key:"budgetCny", summary:"data-budget-label"},
    token: {id:"homeTokenPicker", label:"月 Token 数", key:"monthlyTokenRange", summary:"data-token-label"},
    status: {id:"homeStatusPicker", label:"购买状态", summary:"data-status-label"},
  };
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
  function buildRangePicker(key, state, subscriptionOnly = false) {
    const budget = key === "budget";
    const sliderMin = budget && subscriptionOnly ? 1 : 0;
    const {id, label:title, summary} = pickers[key];
    const factor = budget ? 1 : root.NumberDisplay.tokenFactor(state.tokenUnit);
    const unit = budget ? "元" : state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿";
    return `<details class="filter-picker" id="${id}"><summary><span class="range-picker-title">${title}</span><span class="filter-picker-value" ${summary}></span></summary>
      <div class="filter-picker-menu budget-menu" role="group" aria-label="${budget ? "每月预算" : "每月 Token 用量"}">
        <div class="range-picker-value"><label class="filter-inline"><span>${budget ? "不超过" : "至少"}</span><span class="range-picker-number">${budget ? '<span class="range-picker-unit" aria-hidden="true">¥</span>' : ""}<input type="number" inputmode="decimal" min="0" step="any" ${budget ? 'data-budget-part="max"' : 'data-token-part="min"'} aria-label="${budget ? "最高月预算（人民币）" : `最低月 Token 数（${unit}）`}" placeholder="不限">${budget ? "" : `<span class="range-picker-unit" data-token-unit-label aria-hidden="true">${unit}</span>`}</span></label></div>
        <div class="range-picker-slider"><input type="range" min="${sliderMin}" max="${budget ? budgetSliderMax : tokenSliderMax}" step="1" data-range-picker="${key}" aria-label="${title}滑块" aria-describedby="${id}Help">
          <div class="range-picker-ticks">${budget ? subscriptionOnly ? "" : '<button type="button" class="range-picker-mode" data-budget-mode="api" style="--tick-position:0%" aria-label="仅按量 API"><span>仅按量</span></button>' : '<button type="button" class="range-picker-mode" data-range-clear="token" style="--tick-position:0%"><span>不限</span></button>'}${rangeKnots[key].map((n, i) => n === 0 && !(budget && subscriptionOnly) ? "" : `<button type="button" data-range-knot="${key}" data-knot-value="${n}" style="--tick-position:${(i * 100 + 1 - sliderMin) / ((budget ? budgetSliderMax : tokenSliderMax) - sliderMin) * 100}%" aria-label="${budget ? "预算上限" : "最低月用量"} ${n / factor} ${unit}"><span>${n / factor}</span></button>`).join("")}${budget ? '<button type="button" class="range-picker-mode" data-budget-mode="any" data-range-clear="budget" style="--tick-position:100%"><span>不限</span></button>' : ""}</div></div>
        <p class="filter-help" id="${id}Help">${budget ? subscriptionOnly ? "按套餐月费折合人民币筛选。" : "两端为仅按量 API / 不限，中间按金额筛选。按量 API 按月用量估算支出，未填用量时不判断预算。" : subscriptionOnly ? "按所选模型的月额度筛选，额度不相加；额度未明确的套餐不参与匹配。" : "按所选模型的月额度筛选，额度不相加；额度未明确的订阅不参与匹配。按量 API 按填写用量估算费用。"}</p>
      </div></details>`;
  }

  const multimodalExplanation = "支持多模态：除文本外，还支持图片、音频或视频等非文本输入或输出。具体能力以模型说明为准；未确认的模型不计入。";
  function multimodalControls(id, label = "全部多模态模型", notice = "") {
    return `<div class="model-multimodal-tools"><button type="button" class="model-multimodal-select" data-select-multimodal>${escapeHtml(label)}</button><span class="model-multimodal-help"><button type="button" class="model-multimodal-info" data-multimodal-help aria-label="什么是多模态模型" aria-expanded="false" aria-controls="${id}Help" aria-describedby="${id}Help"><span aria-hidden="true">?</span></button><span class="model-multimodal-tooltip" id="${id}Help" role="tooltip" hidden>${multimodalExplanation}</span></span></div><p class="model-multimodal-notice" data-multimodal-notice role="status" ${notice ? "" : "hidden"}>${escapeHtml(notice)}</p>`;
  }
  function platformShortcutControls(id, labels = {}, notice = "") {
    return `<div class="platform-shortcut-tools model-multimodal-tools"><button type="button" class="model-multimodal-select" data-platform-shortcut="mainland">${escapeHtml(labels.mainland || mainlandLabel)}</button><span class="platform-shortcut-help"><button type="button" class="model-multimodal-info" data-platform-help aria-label="支持中国大陆说明" aria-expanded="false" aria-controls="${id}Help" aria-describedby="${id}Help"><span aria-hidden="true">?</span></button><span class="model-multimodal-tooltip" id="${id}Help" role="tooltip" hidden>选择已确认无需境外网络、且有境内支付途径的平台；未确认的不计入。工具账号与安装可能另有要求，购买状态请另行查看。<br>已选中不符合的平台时，仅保留其中符合的；否则选择全部符合的平台。之后仍可手动增减。</span></span></div><p class="model-multimodal-notice" data-platform-shortcut-notice role="status" ${notice ? "" : "hidden"}>${escapeHtml(notice)}</p>`;
  }
  function buildPicker({ id, label, key, summary, items, state, groups }) {
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
      <summary><span>${escapeHtml(label)}</span><span class="filter-picker-count filter-picker-value" ${summary}>${escapeHtml(countText)}</span>${model ? '<span class="model-match-warning" data-model-match-warning hidden>需同时支持所选模型</span>' : ""}</summary>
      <div class="filter-picker-menu" role="group" aria-label="选择${escapeHtml(label)}">
        <input type="search" data-picker-search placeholder="搜索${escapeHtml(label)}" aria-label="搜索${escapeHtml(label)}">
        <div class="filter-picker-tools"><button type="button" data-picker-action="clear">清空</button><button type="button" data-picker-action="all">全选</button>${model ? "" : '<button type="button" data-picker-action="default" disabled>精选平台</button>'}<span class="picker-selection-count" role="status" aria-live="polite" aria-atomic="true">已选 <strong ${model ? "data-model-selected-count" : "data-platform-selected-count"}>${selected.length}</strong><span class="picker-count-divider"> / </span>共 ${items.length}</span></div>
        ${model ? `<div class="model-preset-options" role="group" aria-label="精选模型"><div class="model-preset-segments"><button type="button" data-model-preset="featured" data-picker-action="default" aria-label="全部精选模型" aria-pressed="false" disabled>全部精选模型</button><span class="model-preset-divider" aria-hidden="true"></span><button type="button" data-model-preset="sota-models" aria-label="${escapeHtml(root.CodingPlanUI.modelGroupLabel(groups,'sota-models'))}" aria-pressed="false" disabled>${escapeHtml(root.CodingPlanUI.modelGroupLabel(groups,'sota-models'))}</button><button type="button" data-model-preset="high-volume-models" aria-label="${escapeHtml(root.CodingPlanUI.modelGroupLabel(groups,'high-volume-models'))}" aria-pressed="false" disabled>${escapeHtml(root.CodingPlanUI.modelGroupLabel(groups,'high-volume-models'))}</button></div></div><p class="model-preset-error" data-model-preset-error hidden>精选名单暂时无法加载。<button type="button" data-retry-model-presets>重试</button></p>` : ""}
        ${model ? multimodalControls(id) : `${platformShortcutControls(id)}<p class="model-preset-error" data-platform-preset-error hidden>精选名单暂时无法加载。<button type="button" data-retry-model-presets>重试</button></p>`}
        <div data-picker-options>${options}</div><p class="filter-search-empty" role="status" hidden>没有匹配结果，试试其他关键词。</p>
        ${model ? `<div class="model-match-setting" data-model-match-setting hidden><label class="model-match-check"><input type="checkbox" data-model-require-all aria-describedby="${id}MatchHelp" aria-controls="${id}MatchConfirm" aria-expanded="false"><span>需同时支持所选模型</span></label><p id="${id}MatchHelp">同一套餐需同时支持全部所选模型，且每个模型都满足用量等条件，可能大幅减少匹配方案。</p><div class="model-match-confirm" id="${id}MatchConfirm" data-model-match-confirm hidden><p data-model-match-impact role="status" aria-live="polite"></p><div><button type="button" data-model-match-action="confirm">确认开启</button><button type="button" data-model-match-action="cancel">取消</button></div></div></div>` : ""}
      </div>
    </details>`;
  }

  const statusExclusions = { restricted: "排除购买受限" };
  function buildStatusPicker(includeHistory = false, planStatusOnly = false) {
    const subject = planStatusOnly ? "套餐" : "平台";
    const {id, label, summary} = pickers.status;
    return `<details class="filter-picker status-picker" id="${id}">
      <summary aria-label="${label}"><span class="status-picker-title">${label}</span><span class="filter-picker-value" ${summary}>不限</span></summary>
      <div class="filter-picker-menu" role="group" aria-label="${includeHistory ? "购买状态筛选" : "排除购买状态"}"><div class="filter-picker-tools"><button type="button" data-clear-status aria-label="清除购买状态排除条件">清除</button></div>${Object.entries(statusExclusions).map(([value, label]) => `<label><input type="checkbox" data-status-exclude="${value}"><span>${label}${subject}</span></label>`).join("")}${includeHistory ? `<div class="status-picker-history"><label><input type="checkbox" ${planStatusOnly ? 'data-filter-field="includeDiscontinued"' : 'data-include-delisted'}><span>包含已下架${subject}</span></label></div>` : ""}</div>
    </details>`;
  }
  function render({policy, state, context}) {
    const {full, pricing, plansPage, planStatusOnly, platformHub, purchaseTool} = policy;
    const featuredCatalog = platformHub || plansPage || pricing;
    const {platforms, models} = context;
    return `<section class="filter-state-bar surface-panel${full ? "" : " home-filter-panel"}${platformHub ? " platform-hub-filters" : plansPage ? " plan-featured-filters" : pricing ? " pricing-featured-filters" : ""}" aria-label="统一筛选">
      ${featuredCatalog ? `<div class="platform-filter-row"><fieldset class="platform-filter-fields" data-featured-filter-fields ${platformHub ? 'data-platform-filter-fields' : plansPage ? 'data-plan-filter-fields' : 'data-pricing-filter-fields'}><legend class="sr-only">${platformHub ? '平台' : plansPage ? '套餐' : '价格与额度'}筛选条件</legend>` : ""}
      <div class="filter-state-grid">
      ${platformHub ? "" : buildPicker({ ...pickers.platform, items: platforms, state })}
      ${buildPicker({ ...pickers.model, items: models, state, groups: context.modelGroups })}
      ${buildRangePicker("budget", state, plansPage)}${buildRangePicker("token", state, plansPage)}
      ${buildStatusPicker(purchaseTool, planStatusOnly)}
      ${pricing ? `<div class="pricing-mainland-control"><label class="pricing-mainland-filter"><span>${mainlandLabel}</span><span class="toggle-switch"><input type="checkbox" role="switch" data-filter-field="mainlandRequired"><span class="toggle-slider" aria-hidden="true"></span></span></label></div>` : ''}
      ${platformHub ? `<label class="platform-access-filter"><span class="filter-control-text">${mainlandLabel}</span><span class="toggle-switch"><input type="checkbox" role="switch" data-platform-domestic><span class="toggle-slider" aria-hidden="true"></span></span></label>` : ""}${plansPage ? '<label class="plan-harness-filter"><input type="checkbox" data-filter-field="harnessApiRequired"><span class="filter-control-text">需支持第三方工具</span></label>' : ""}</div>
      ${featuredCatalog ? `<\/fieldset><div class="platform-featured-control"><button type="button" class="platform-featured-button" data-catalog-featured ${platformHub ? 'data-platform-featured' : plansPage ? 'data-plan-featured' : 'data-pricing-featured'} aria-pressed="false">${platformHub ? '显示精选平台' : '显示精选'}</button><button type="button" data-hub-retry-featured hidden>重试精选名单</button></div></div>` : ""}
      <div class="filter-state-footer">
      ${full ? "" : `<div class="filter-state-controls"><div class="offer-sort"><span aria-hidden="true">排序</span><span data-select-fallback><select id="homeOfferSort" data-filter-field="preference" data-offer-sort aria-label="方案排序" aria-describedby="offerSortHelp">${root.PurchaseGuide.sortOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}</select></span></div><span class="offer-sort-help" id="offerSortHelp"></span>`}
      <div class="filter-state-actions">${pricing ? "" : `<button type="button" data-filter-action="reset"${purchaseTool && !platformHub && !plansPage ? ' title="显示全部平台与模型，已下架内容需单独勾选"' : ""}>${platformHub || plansPage ? "重置筛选" : full ? "显示全部" : "显示精选"}</button>`}${full && !platformHub && !plansPage ? `<button type="button" data-filter-action="restore-defaults" title="选择精选平台与精选模型，${purchaseTool ? "已下架内容需单独勾选" : "其他条件恢复不限"}">${pricing ? "重置筛选" : "显示精选"}</button>` : ""}</div>${full ? "</div>" : "</div></div>"}
      </section>`;
  }
  function directoryControls(host, view, state) {
    const controls = [];
    function add(selector, label, read, options = {}) {
      const element = host.querySelector(selector) || document.querySelector(selector);
      if (element) controls.push({element, label, read, paused:true, ...options});
    }
    for (const [kind, descriptor] of Object.entries(pickers)) {
      const {id, label, key, summary} = descriptor;
      add('#' + id, label, el => {
        const value = el.querySelector('[' + summary + ']').textContent;
        const active = kind === 'status' ? value !== '不限'
          : kind === 'budget' ? state().apiOnly || state()[key] != null : state()[key] != null;
        return [active, value];
      }, {picker:true});
    }
    function segments(selector, label, display = false) {
      add(selector, label, el => { const buttons=[...el.querySelectorAll('button')], index=buttons.findIndex(button=>button.classList.contains('is-active')); return [index>0, buttons[index]?.textContent || '']; }, {display});
    }
    function checkbox(selector, label, options) {
      add(selector,label,el=>{const checked=el.querySelector('input').checked; return [checked,checked?'开启':'关闭'];},options);
    }
    if (view === 'pricing') segments('.price-billing-filter', '计费方式');
    checkbox('.pricing-mainland-control, .platform-access-filter', mainlandLabel, {paused:view !== 'pricing'});
    checkbox('.plan-harness-filter', '需支持第三方工具');
    add('.platform-featured-control','显示精选',el=>{const checked=el.querySelector('[data-catalog-featured]').getAttribute('aria-pressed')==='true';return [checked,checked?'开启':'关闭'];},{paused:false});
    segments('.usage-color-control', '颜色', true);
    segments('.usage-benchmark-control', '评分', true);
    segments('.usage-scale-control', '坐标轴', true);
    return controls;
  }
  root.CodingPlanFilterControls = {
    render, directoryControls, multimodalControls, platformShortcutControls, statusExclusions, mainlandLabel,
    range: {knots:rangeKnots, value:rangeValue, position:rangePosition, budgetNumericMax, budgetSliderMax, tokenSliderMax},
  };
})(globalThis);
