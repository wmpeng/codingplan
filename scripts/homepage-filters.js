(function (root) {
  "use strict";
  const Filters = root.CodingPlanFilters;
  if (!Filters) return;
  const escapeHtml = root.CodingPlanUI.escapeHtml;

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
  function buildRangePicker(key, state, subscriptionOnly = false) {
    const budget = key === "budget";
    const sliderMin = budget && subscriptionOnly ? 1 : 0;
    const id = budget ? "homeBudgetPicker" : "homeTokenPicker";
    const title = budget ? "月预算" : "月 Token 数";
    const factor = budget ? 1 : root.NumberDisplay.tokenFactor(state.tokenUnit);
    const unit = budget ? "元" : state.tokenUnit === "B" ? "B" : state.tokenUnit === "M" ? "M" : "亿";
    return `<details class="filter-picker" id="${id}"><summary><span class="range-picker-title">${title}</span><span class="filter-picker-value" ${budget ? "data-budget-label" : "data-token-label"}></span></summary>
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
  const platformShortcutKinds = {
    mainland: { fields: ["requiresOverseasNetwork", "requiresOverseasPayment"], label: "支持中国大陆" },
    // Keep old controller calls translatable; only mainland is rendered.
    network: { field: "requiresOverseasNetwork", label: "境内可用平台", legacy: "domesticNetworkOnly" },
    payment: { field: "requiresOverseasPayment", label: "境内可购买平台", legacy: "domesticPaymentOnly" },
  };
  function platformShortcutControls(id, labels = {}, notice = "") {
    return `<div class="platform-shortcut-tools model-multimodal-tools"><button type="button" class="model-multimodal-select" data-platform-shortcut="mainland">${escapeHtml(labels.mainland || platformShortcutKinds.mainland.label)}</button><span class="platform-shortcut-help"><button type="button" class="model-multimodal-info" data-platform-help aria-label="支持中国大陆说明" aria-expanded="false" aria-controls="${id}Help" aria-describedby="${id}Help"><span aria-hidden="true">?</span></button><span class="model-multimodal-tooltip" id="${id}Help" role="tooltip" hidden>选择已确认无需境外网络、且有境内支付途径的平台；未确认的不计入。工具账号与安装可能另有要求，购买状态请另行查看。<br>已选中不符合的平台时，仅保留其中符合的；否则选择全部符合的平台。之后仍可手动增减。</span></span></div><p class="model-multimodal-notice" data-platform-shortcut-notice role="status" ${notice ? "" : "hidden"}>${escapeHtml(notice)}</p>`;
  }
  function bindSelectionHelp(host) {
    const helpSelector = '[data-multimodal-help], [data-platform-help]';
    const wrapSelector = '.model-multimodal-help, .platform-shortcut-help';
    const triggers = () => [...host.querySelectorAll(helpSelector)];
    let closeTimer = null;
    const cancelClose = () => { root.clearTimeout(closeTimer); closeTimer = null; };
    const show = (button, visible) => {
      button.setAttribute('aria-expanded', String(visible));
      const tooltip = document.getElementById(button.getAttribute('aria-controls'));
      if (!tooltip) return;
      tooltip.hidden = !visible;
      if (visible) {
        tooltip.style.top = ''; tooltip.style.bottom = '';
        const viewport = root.visualViewport;
        const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || root.innerHeight);
        const panel = button.closest('.filter-picker-menu');
        const bottom = Math.min(viewportBottom - 8, panel ? panel.getBoundingClientRect().bottom - 8 : viewportBottom);
        if (tooltip.getBoundingClientRect().bottom > bottom) {
          tooltip.style.top = 'auto'; tooltip.style.bottom = 'calc(100% + 6px)';
        }
      }
    };
    const close = button => { cancelClose(); delete button.dataset.pinned; show(button, false); };
    const reposition = () => triggers().filter(button => button.getAttribute('aria-expanded') === 'true').forEach(button => show(button, true));
    host.addEventListener('scroll', reposition, true);
    root.addEventListener('resize', () => root.requestAnimationFrame(reposition));
    root.visualViewport?.addEventListener('resize', () => root.requestAnimationFrame(reposition));
    let restoringFocus = false;
    host.addEventListener('pointerover', event => {
      if (event.pointerType !== 'mouse') return;
      const wrap = event.target.closest(wrapSelector);
      if (wrap) { cancelClose(); show(wrap.querySelector('button'), true); }
    });
    host.addEventListener('pointerout', event => {
      if (event.pointerType !== 'mouse') return;
      const wrap = event.target.closest(wrapSelector);
      if (!wrap || wrap.contains(event.relatedTarget)) return;
      const button = wrap.querySelector('button');
      if (!button.dataset.pinned && !wrap.contains(document.activeElement)) {
        cancelClose(); closeTimer = root.setTimeout(() => show(button, false), 150);
      }
    });
    host.addEventListener('focusin', event => {
      if (!restoringFocus && event.target.matches(helpSelector)) { cancelClose(); show(event.target, true); }
    });
    host.addEventListener('focusout', event => {
      const wrap = event.target.closest(wrapSelector);
      if (wrap && !wrap.contains(event.relatedTarget) && !wrap.querySelector('button').dataset.pinned) close(wrap.querySelector('button'));
    });
    host.addEventListener('click', event => {
      const button = event.target.closest(helpSelector);
      if (!button) return;
      cancelClose();
      if (button.dataset.pinned) close(button);
      else { button.dataset.pinned = 'true'; show(button, true); }
    });
    host.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const button = triggers().find(button => button.getAttribute('aria-expanded') === 'true');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation(); close(button);
      restoringFocus = true; button.focus({preventScroll:true}); restoringFocus = false;
    });
    document.addEventListener('click', event => {
      for (const button of triggers()) if (!button.closest(wrapSelector).contains(event.target)) close(button);
    });
    host.addEventListener('toggle', event => {
      if (event.target.matches('[data-picker]') && !event.target.open) triggers().forEach(close);
    }, true);
  }

  function buildPicker({ id, label, key, items, state, groups }) {
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
      <summary><span>${escapeHtml(label)}</span><span class="filter-picker-count filter-picker-value" data-picker-count>${escapeHtml(countText)}</span>${model ? '<span class="model-match-warning" data-model-match-warning hidden>需同时支持所选模型</span>' : ""}</summary>
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
    return `<details class="filter-picker status-picker" id="homeStatusPicker">
      <summary aria-label="购买状态"><span class="status-picker-title">购买状态</span><span class="filter-picker-value" data-status-label>不限</span></summary>
      <div class="filter-picker-menu" role="group" aria-label="${includeHistory ? "购买状态筛选" : "排除购买状态"}"><div class="filter-picker-tools"><button type="button" data-clear-status aria-label="清除购买状态排除条件">清除</button></div>${Object.entries(statusExclusions).map(([value, label]) => `<label><input type="checkbox" data-status-exclude="${value}"><span>${label}${subject}</span></label>`).join("")}${includeHistory ? `<div class="status-picker-history"><label><input type="checkbox" ${planStatusOnly ? 'data-filter-field="includeDiscontinued"' : 'data-include-delisted'}><span>包含已下架${subject}</span></label></div>` : ""}</div>
    </details>`;
  }
  let presetPromise;
  function loadGroups(context) {
    if (!presetPromise) presetPromise = root.CodingPlanToolPage.loadPreset().catch(error => {
      presetPromise = null;
      throw error;
    });
    return presetPromise.then((doc) => {
      context.modelGroups = doc.groups || [];
      context.featuredPlatformSlugs = doc.platformSlugs || [];
      return context.modelGroups;
    });
  }
  function mount(options) {
    const opts = options || {}, policy = Filters.createViewPolicy(opts);
    const {full, pricing, plansPage, planStatusOnly, platformHub, purchaseTool} = policy;
    const featuredCatalog = platformHub || plansPage;
    const Url = root.CodingPlanFilterUrl;
    const host =
      opts.element || document.getElementById("homepageUnifiedFiltersMount");
    const context = opts.context || root.codingplanEntityContext;
    if (!host || !context || !root.EntityData) return false;
    if (host.filterController) return true;
    const config = opts.config || root.appConfig || {};
    const platforms = context.platforms,
      models = context.models;
    let state = policy.createDefaults(config, root.CodingPlanDisplaySettings?.getTokenUnit() || "yi");
    const defaults = Filters.cloneControlState(state);
    const urlSchema = Url.sharedSchema(context, policy);
    let resetUrl = false;
    let featuredOnly = false;
    if (opts.featuredPreset) {
      context.modelGroups = opts.featuredPreset.groups || [];
      context.featuredPlatformSlugs = opts.featuredPreset.platformSlugs || [];
    }
    let groupsReady = Array.isArray(context.modelGroups), initialPresetPending = !full || pricing, pendingAll = false, multimodalNotice = "", platformShortcutNotice = "";
    const platformCandidates = kind => platforms.filter(platform => (platformShortcutKinds[kind].fields || [platformShortcutKinds[kind].field]).every(field => platform[field] === false)).map(platform => platform.slug);
    function platformShortcutAction(kind) {
      const eligible = platformCandidates(kind);
      const selected = state.platformSlugs === null ? platforms.map(platform => platform.slug) : state.platformSlugs;
      const retain = selected.some(slug => !eligible.includes(slug));
      return { label: kind === "mainland" ? platformShortcutKinds.mainland.label : `${retain ? "仅保留" : "全部"}${platformShortcutKinds[kind].label}`, slugs: retain ? selected.filter(slug => eligible.includes(slug)) : eligible };
    }
    function selectPlatformShortcut(kind, source = "manual") {
      if (!Object.hasOwn(platformShortcutKinds, kind)) return false;
      const {slugs} = platformShortcutAction(kind);
      if (!slugs.length) {
        platformShortcutNotice = platformCandidates(kind).length ? "当前勾选没有符合项，已保留原选择。" : "目前没有确认符合该条件的平台，已保留原选择。";
        pendingAll = false; render(); return false;
      }
      state.platformSlugs = slugs;
      publish(source); return true;
    }
    const multimodalSlugs = models.filter(root.EntityData.isMultimodal).map(model => model.slug);
    const multimodalSet = new Set(multimodalSlugs);
    function multimodalAction() {
      const selected = state.modelSlugs === null ? models.map(model => model.slug) : state.modelSlugs;
      const retain = selected.some(slug => !multimodalSet.has(slug));
      return { label: retain ? "仅保留多模态模型" : "全部多模态模型", slugs: retain ? selected.filter(slug => multimodalSet.has(slug)) : [...multimodalSlugs] };
    }
    function selectMultimodalModels(source = "manual") {
      const {slugs} = multimodalAction();
      if (!slugs.length) {
        multimodalNotice = multimodalSlugs.length ? "当前所选模型中没有多模态模型，请先选择支持多模态的模型。" : "目前没有确认支持多模态的模型。";
        pendingAll = false; render(); return false;
      }
      state.modelSlugs = slugs; state.modelGroup = "any"; state.modelMatch = "any";
      publish(source); return true;
    }
    const presetSlugs = id => root.CodingPlanUI.modelPresetSlugs(context.modelGroups, id, models);
    const featuredPlatforms = () => (context.featuredPlatformSlugs || []).filter(slug => platforms.some(platform => platform.slug === slug));
    const canRestoreDefaults = () => groupsReady && featuredPlatforms().length > 0 && presetSlugs("featured").length > 0;
    function resetFilters(featured = false, updatePurpose = 'filter_reset') {
      if (featured && !canRestoreDefaults()) return false;
      state = Filters.cloneControlState(defaults);
      if (featuredCatalog) featuredOnly = false;
      if (featured) {
        state.platformSlugs = featuredPlatforms();
        state.modelSlugs = presetSlugs("featured");
      }
      resetModelList();
      resetUrl = !full || featured || featuredCatalog;
      publish(platformHub || plansPage ? "reset" : "manual", updatePurpose);
      return true;
    }
    const sameSelection = slugs => Array.isArray(state.modelSlugs) && slugs.length === state.modelSlugs.length && slugs.every(slug => state.modelSlugs.includes(slug));
    function selectionPreset() {
      if (state.modelSlugs === null) return "all";
      if (!state.modelSlugs.length) return "clear";
      if (groupsReady && sameSelection(presetSlugs("featured"))) return "featured";
      return (context.modelGroups || []).find(group => sameSelection(presetSlugs(group.id)))?.id || "custom";
    }
    function sortPickerOptions(key) {
      const picker = host.querySelector(`[data-picker="${key}"]`);
      if (!picker) return;
      const items = key === 'modelSlugs' ? models : platforms;
      const featured = key === 'modelSlugs' ? presetSlugs('featured') : featuredPlatforms();
      const positions = new Map(items.map((item, index) => [item.slug, index]));
      const featuredPositions = new Map(featured.map((slug, index) => [slug, index]));
      const selected = state[key], selectedPositions = new Map((selected?.length < items.length ? selected : []).map((slug, index) => [slug, index]));
      const rank = slug => selectedPositions.has(slug) ? selectedPositions.get(slug) - items.length
        : featuredPositions.has(slug) ? featuredPositions.get(slug) : featured.length + positions.get(slug);
      const list = picker.querySelector('[data-picker-options]');
      [...list.children].sort((a, b) => rank(a.querySelector('input').value) - rank(b.querySelector('input').value)).forEach(option => list.append(option));
    }
    function resetModelList() {
      const picker = host.querySelector('[data-picker="modelSlugs"]');
      picker.querySelector('[data-picker-search]').value = "";
      picker.querySelectorAll('[data-filter-option]').forEach(option => { option.hidden = false; });
      picker.querySelector('.filter-search-empty').hidden = true;
      const list = picker.querySelector('[data-picker-options]');
      list.scrollTop = 0;
      sortPickerOptions('modelSlugs');
    }
    function selectModelPreset(id, source = "manual") {
      if (id !== "all" && !groupsReady) return false;
      const slugs = id === "all" ? null : presetSlugs(id);
      if (slugs && !slugs.length) return false;
      state.modelSlugs = slugs;
      state.modelGroup = "any";
      state.modelMatch = "any";
      resetModelList();
      publish(source, source === 'manual' ? 'filter_featured_toggle' : undefined);
      return true;
    }
    const params = new URLSearchParams(location.search),
      platform = params.get("platform");
    const model = params.get("model");
    const validPlatform = platforms.some(x => x.slug === platform);
    const validModel = models.some(x => x.slug === model);
    const explicitSelection = validPlatform || validModel || (pricing && (
      context.planBySlug.has(params.get("plan")) || context.planModels.some(row => row.slug === params.get("relation"))
    ));
    function applyInitialPreset() {
      if (!initialPresetPending || !canRestoreDefaults()) return false;
      state.platformSlugs = featuredPlatforms();
      state.modelSlugs = presetSlugs("featured");
      initialPresetPending = false;
      return true;
    }
    const saved = Url.read(urlSchema);
    if (saved.snapshot) {
      initialPresetPending = false;
      const {snapshot, restricted, history, domestic, featuredOnly: featured, ...conditions} = saved;
      Object.assign(state, conditions);
      state[planStatusOnly ? 'excludedPlanStatuses' : 'excludedPlatformStatuses'] = restricted ? ['restricted'] : [];
      if (planStatusOnly) state.includeDiscontinued = history === true;
      else state.platformStatusMax = history ? 'delisted' : 'restricted';
      if (platformHub) state.domesticNetworkOnly = state.domesticPaymentOnly = domestic === true;
      featuredOnly = featuredCatalog && featured === true;
      if (!state.modelSlugs || state.modelSlugs.length < 2) state.modelMatch = 'any';
    } else {
      if (explicitSelection) initialPresetPending = false;
      else applyInitialPreset();
      if (validPlatform && !platformHub) state.platformSlugs = [platform];
      if (validModel) state.modelSlugs = [model];
      if (params.get("billing") === "payg" && !plansPage) state.apiOnly = true;
    }
    host.innerHTML = `<section class="filter-state-bar surface-panel${full ? "" : " home-filter-panel"}${platformHub ? " platform-hub-filters" : plansPage ? " plan-featured-filters" : ""}" aria-label="统一筛选">
      ${featuredCatalog ? `<div class="platform-filter-row"><fieldset class="platform-filter-fields" data-featured-filter-fields ${platformHub ? 'data-platform-filter-fields' : 'data-plan-filter-fields'}><legend class="sr-only">${platformHub ? '平台' : '套餐'}筛选条件</legend>` : ""}
      <div class="filter-state-grid">
      ${platformHub ? "" : buildPicker({ id: "homePlatformPicker", label: "平台", key: "platformSlugs", items: platforms, state })}
      ${buildPicker({ id: "homeModelPicker", label: "模型", key: "modelSlugs", items: models, state, groups: context.modelGroups })}
      ${buildRangePicker("budget", state, plansPage)}${buildRangePicker("token", state, plansPage)}
      ${buildStatusPicker(purchaseTool, planStatusOnly)}
      ${platformHub ? '<label class="platform-access-filter"><input type="checkbox" data-platform-domestic><span class="filter-control-text">支持中国大陆</span></label>' : ""}${plansPage ? '<label class="plan-harness-filter"><input type="checkbox" data-filter-field="harnessApiRequired"><span class="filter-control-text">需支持第三方工具</span></label>' : ""}</div>
      ${featuredCatalog ? `<\/fieldset><div class="platform-featured-control"><button type="button" class="platform-featured-button" data-catalog-featured ${platformHub ? 'data-platform-featured' : 'data-plan-featured'} aria-pressed="false">${platformHub ? '显示精选平台' : '显示精选'}</button><button type="button" data-hub-retry-featured hidden>重试精选名单</button></div></div>` : ""}
      <div class="filter-state-footer">
      ${full ? "" : `<div class="filter-state-controls"><div class="offer-sort"><span aria-hidden="true">排序</span><span data-select-fallback><select id="homeOfferSort" data-filter-field="preference" data-offer-sort aria-label="方案排序" aria-describedby="offerSortHelp">${root.PurchaseGuide.sortOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}</select></span></div><span class="offer-sort-help" id="offerSortHelp"></span>`}
      <div class="filter-state-actions"><button type="button" data-filter-action="reset"${purchaseTool && !platformHub && !plansPage ? ' title="显示全部平台与模型，已下架内容需单独勾选"' : ""}>${platformHub || plansPage ? "重置筛选" : full ? "显示全部" : "显示精选"}</button>${full && !platformHub && !plansPage ? `<button type="button" data-filter-action="restore-defaults" title="选择精选平台与精选模型，${purchaseTool ? "已下架内容需单独勾选" : "其他条件恢复不限"}">显示精选</button>` : ""}</div>${full ? "</div>" : "</div></div>"}
      </section>`;
    bindSelectionHelp(host);
    const offerSortSelect = host.querySelector('[data-offer-sort]');
    const offerSortPicker = offerSortSelect && root.CodingPlanSingleSelect?.mount(offerSortSelect, '方案排序', {showLabel:false});
    const controller = {
      getState: () => Filters.cloneState(state),
      context,
      config,
      isFeaturedOnly: () => featuredOnly,
      selectModelPreset,
      getModelPreset: selectionPreset,
      selectMultimodalModels,
      getMultimodalActionLabel: () => multimodalAction().label,
      getMultimodalNotice: () => multimodalNotice,
      selectPlatformShortcut,
      getPlatformShortcutLabels: () => Object.fromEntries(Object.keys(platformShortcutKinds).map(kind => [kind, platformShortcutAction(kind).label])),
      getPlatformShortcutNotice: () => platformShortcutNotice,
      setState: (patch, source = "guide") => {
        // Old guide calls map groups to actual picks; no hidden intersection remains.
        if (patch.modelGroup && patch.modelGroup !== "any") {
          if (!groupsReady) return;
          const slugs = presetSlugs(patch.modelGroup);
          if (!slugs.length) return;
          patch = {...patch, modelSlugs:slugs, modelMatch:"any", modelGroup:"any"};
        }
        const merged = { ...state, ...patch, modelGroup: "any", imageRequired: false };
        if (platformHub && (patch.domesticNetworkOnly !== undefined || patch.domesticPaymentOnly !== undefined)) {
          merged.domesticNetworkOnly = merged.domesticPaymentOnly = patch.domesticNetworkOnly === true || patch.domesticPaymentOnly === true;
        }
        state = Filters.cloneControlState(merged);
        // Translate legacy network/payment requests into visible picks, never hidden flags.
        const legacyKinds = Object.keys(platformShortcutKinds).filter(kind => platformShortcutKinds[kind].legacy && patch[platformShortcutKinds[kind].legacy] === true);
        let platformNotice = "";
        if (!platformHub && legacyKinds.length) {
          const selected = state.platformSlugs?.length ? state.platformSlugs : platforms.map(platform => platform.slug);
          const slugs = selected.filter(slug => legacyKinds.every(kind => platformCandidates(kind).includes(slug)));
          if (slugs.length) state.platformSlugs = slugs;
          else platformNotice = "当前勾选没有符合项，已保留原选择。";
        }
        // The legacy imageRequired field now selects the same multimodal inventory.
        let imageNotice = "";
        if (patch.imageRequired === true) {
          const selected = state.modelSlugs?.length ? state.modelSlugs : models.map(model => model.slug);
          const slugs = selected.filter(slug => multimodalSet.has(slug));
          if (slugs.length) { state.modelSlugs = slugs; state.modelMatch = "any"; }
          else imageNotice = "当前所选模型中没有多模态模型，请先选择支持多模态的模型。";
        }
        if (!state.modelSlugs || state.modelSlugs.length < 2) state.modelMatch = "any";
        if (Object.hasOwn(patch, "modelSlugs") || patch.imageRequired === true) resetModelList();
        publish(source);
        if (imageNotice) { multimodalNotice = imageNotice; render(); }
        if (platformNotice) { platformShortcutNotice = platformNotice; render(); }
      },
      reset: () => resetFilters(!full),
      restoreDefaults: () => resetFilters(true, 'filter_featured_toggle'),
    };
    host.filterController = controller;
    if (!full) root.CodingPlanHomeFilters = controller;
    function positionStatusPanel() {
      const picker = host.querySelector('#homeStatusPicker');
      if (!picker?.open) return;
      const menu = picker.querySelector('.filter-picker-menu');
      if (root.innerWidth <= 800) { menu.removeAttribute('style'); return; }
      const anchor = picker.querySelector('summary').getBoundingClientRect();
      const actions = host.querySelector('[data-filter-action="reset"]').getBoundingClientRect();
      const panelWidth = 240;
      const minTop = (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 8;
      Object.assign(menu.style, {position:'fixed', width:`${panelWidth}px`, right:'auto', bottom:'auto', maxHeight:`${Math.max(100, root.innerHeight - minTop - 14)}px`});
      menu.style.left = `${Math.max(14, Math.min(anchor.left, root.innerWidth - panelWidth - 14))}px`;
      menu.style.top = `${Math.max(minTop, Math.min(anchor.bottom + 8, root.innerHeight - menu.getBoundingClientRect().height - 14))}px`;
      // Keep the footer actions reachable when the menu extends over their row.
      const bounds = menu.getBoundingClientRect();
      if (bounds.left < actions.right && bounds.right > actions.left && bounds.top < actions.bottom && bounds.bottom > actions.top) {
        if (actions.left - panelWidth - 8 >= 14) menu.style.left = `${actions.left - panelWidth - 8}px`;
        else if (anchor.top - bounds.height - 8 >= minTop) menu.style.top = `${anchor.top - bounds.height - 8}px`;
      }
    }
    function positionSelectionPanels() {
      positionStatusPanel();
      host.querySelectorAll('[data-picker][open]').forEach(picker => {
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
      });
    }
    function render() {
      const restoreDefaults = host.querySelector(full ? '[data-filter-action="restore-defaults"]' : '[data-filter-action="reset"]');
      if (restoreDefaults) restoreDefaults.disabled = !canRestoreDefaults();
      for (const [key, items] of [
        ["platformSlugs", platforms],
        ["modelSlugs", models],
      ]) {
        const picker = host.querySelector(`[data-picker="${key}"]`),
          selected = state[key];
        if (!picker) continue;
        if (!picker.open) sortPickerOptions(key);
        picker.querySelector("[data-picker-count]").textContent =
          selected === null
            ? "全部"
            : selected.length
              ? `${selected.length} 项`
              : "不限";
        picker.querySelectorAll('[data-filter-option] input').forEach((el) => {
          el.checked = selected === null || selected.includes(el.value);
        });
        const count = picker.querySelector('[data-model-selected-count], [data-platform-selected-count]');
        const selectedCount = picker.querySelectorAll('[data-filter-option] input:checked').length;
        if (count.textContent !== String(selectedCount)) count.textContent = selectedCount;
      }
      const platformPicker = host.querySelector('[data-picker="platformSlugs"]');
      if (platformPicker) {
        platformPicker.querySelector('[data-picker-action="default"]').disabled = !Array.isArray(context.featuredPlatformSlugs);
        platformPicker.querySelectorAll('[data-platform-shortcut]').forEach(button => { button.textContent = platformShortcutAction(button.dataset.platformShortcut).label; });
        const platformNotice = platformPicker.querySelector('[data-platform-shortcut-notice]');
        platformNotice.hidden = !platformShortcutNotice; platformNotice.textContent = platformShortcutNotice;
      }
      if (featuredCatalog) {
        if (platformHub) host.querySelector('[data-platform-domestic]').checked = state.domesticNetworkOnly && state.domesticPaymentOnly;
        const available = plansPage ? canRestoreDefaults() : featuredPlatforms().length > 0;
        const toggle = host.querySelector('[data-catalog-featured]');
        toggle.disabled = !available;
        toggle.setAttribute('aria-pressed', String(featuredOnly));
        const fields = host.querySelector('[data-featured-filter-fields]');
        fields.disabled = featuredOnly;
        fields.inert = featuredOnly;
        fields.setAttribute('aria-disabled', String(featuredOnly));
        host.querySelector('[data-filter-action="reset"]').disabled = featuredOnly;
        fields.closest('.filter-state-bar').classList.toggle('is-featured-mode', featuredOnly);
        host.querySelector('[data-hub-retry-featured]').hidden = available;
      }
      const modelPicker = host.querySelector('[data-picker="modelSlugs"]');
      modelPicker.querySelector('[data-select-multimodal]').textContent = multimodalAction().label;
      const notice = modelPicker.querySelector('[data-multimodal-notice]');
      notice.hidden = !multimodalNotice; notice.textContent = multimodalNotice;
      const modelCount = state.modelSlugs === null ? models.length : state.modelSlugs.length;
      const strict = state.modelMatch === "all" && modelCount > 1;
      modelPicker.querySelector('[data-model-match-setting]').hidden = modelCount < 2;
      modelPicker.querySelector('[data-model-match-setting]').dataset.active = String(strict);
      modelPicker.querySelector('[data-model-require-all]').checked = strict || pendingAll;
      modelPicker.querySelector('[data-model-require-all]').setAttribute('aria-expanded', String(pendingAll));
      modelPicker.querySelector('[data-model-match-warning]').hidden = !strict;
      modelPicker.querySelector('[data-model-match-confirm]').hidden = !pendingAll;
      const preset = selectionPreset();
      modelPicker.querySelectorAll('[data-model-preset]').forEach(button => {
        button.disabled = !groupsReady;
        if (button.dataset.modelPreset !== 'featured') {
          const label = root.CodingPlanUI.modelGroupLabel(context.modelGroups, button.dataset.modelPreset);
          button.textContent = label; button.setAttribute('aria-label', label);
        }
        button.setAttribute('aria-pressed', String(button.dataset.modelPreset === preset));
      });
      modelPicker.querySelector('[data-picker-action="default"]').disabled = !groupsReady;
      host.querySelectorAll("[data-filter-field]").forEach((el) => {
        const v = state[el.dataset.filterField];
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = v;
      });
      const includeDelisted = host.querySelector('[data-include-delisted]');
      if (includeDelisted) includeDelisted.checked = state.platformStatusMax === "delisted";
      const sort = host.querySelector('[data-offer-sort]');
      if (sort) {
        const option = root.PurchaseGuide.sortOptions.find(option => option.value === state.preference);
        sort.title = option.help;
        host.querySelector('#offerSortHelp').textContent = option.help;
        offerSortPicker?.sync();
      }
      const statusPicker = host.querySelector('#homeStatusPicker');
      if (statusPicker) {
        const excluded = planStatusOnly ? state.excludedPlanStatuses : state.excludedPlatformStatuses;
        const labels = excluded.map(status => statusExclusions[status]);
        const hasPlatforms = !!includeDelisted && state.platformStatusMax === "delisted";
        const hasPlans = !!statusPicker.querySelector('[data-filter-field="includeDiscontinued"]') && state.includeDiscontinued;
        if (hasPlatforms || hasPlans) labels.push("包含已下架");
        const label = labels.join('、') || "不限";
        statusPicker.querySelector('[data-status-label]').textContent = label;
        statusPicker.querySelector('summary').setAttribute('aria-label', `购买状态：${label}`);
        statusPicker.querySelectorAll('[data-status-exclude]').forEach(el => { el.checked = excluded.includes(el.dataset.statusExclude); });
      }
      const factor = root.NumberDisplay.tokenFactor(state.tokenUnit);
      const budget = host.querySelector("[data-budget-part]"),
        tokens = host.querySelector("[data-token-part]");
      if (budget) {
        syncNumberInput(budget, state.budgetCny?.max);
        host.querySelector("[data-budget-label]").textContent =
          state.apiOnly ? `仅按量${state.budgetCny?.max != null ? ` · ≤¥${state.budgetCny.max}` : ""}` : state.budgetCny?.max != null ? `≤ ¥${state.budgetCny.max}` : "不限";
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
        slider.style.setProperty("--range-fill", `${(Number(slider.value) - Number(slider.min)) / (Number(slider.max) - Number(slider.min)) * 100}%`);
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
      positionSelectionPanels();
    }
    function publish(source = "manual", updatePurpose) {
      policy.constrain(state);
      if (!["init", "catalog", "display"].includes(source)) initialPresetPending = false;
      multimodalNotice = "";
      platformShortcutNotice = "";
      pendingAll = false;
      state.tokenUnit = root.CodingPlanDisplaySettings?.getTokenUnit() || state.tokenUnit;
      const clean = Filters.cloneState(state);
      root.dispatchEvent(new CustomEvent("codingplan:filters-changing", {detail:{state:clean,source,full}}));
      if (!full) {
        root.__codingplanUnifiedFiltersState = clean;
        root.__codingplanHomeApi?.setUnifiedFilters(clean);
      }
      if (opts.onChange) opts.onChange(clean, {source, featuredOnly});
      if (!["init", "catalog", "display"].includes(source)) {
        const remove = ['platform','model','billing'];
        if (resetUrl && !params.has('plan') && !params.has('relation')) Url.clear(urlSchema, remove);
        else Url.replace(urlSchema, {
          ...state, snapshot:true, featuredOnly,
          restricted:state[planStatusOnly ? 'excludedPlanStatuses' : 'excludedPlatformStatuses'].includes('restricted'),
          history:planStatusOnly ? state.includeDiscontinued : state.platformStatusMax === 'delisted',
          domestic:platformHub && state.domesticNetworkOnly
        }, {remove, delay:source === 'range'});
        resetUrl = false;
      }
      render();
      root.dispatchEvent(
        new CustomEvent("codingplan:filters-changed", {
          detail: { state: clean, source, full, updatePurpose },
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
        publish('range');
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
        positionSelectionPanels();
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
                  (root.NumberDisplay.tokenFactor(state.tokenUnit)),
                max: null,
              };
        publish();
      }
    });
    host.addEventListener("focusout", (event) => {
      const el = event.target;
      if (el.matches("[data-budget-part]")) el.value = state.budgetCny?.max ?? "";
      if (el.matches("[data-token-part]")) el.value = state.monthlyTokenRange?.min == null ? "" : state.monthlyTokenRange.min / (root.NumberDisplay.tokenFactor(state.tokenUnit));
    });
    host.addEventListener("change", (event) => {
      const el = event.target;
      if (platformHub && el.matches("[data-platform-domestic]")) {
        state.domesticNetworkOnly = state.domesticPaymentOnly = el.checked;
        publish();
      } else if (el.matches("[data-status-exclude]")) {
        state[planStatusOnly ? 'excludedPlanStatuses' : 'excludedPlatformStatuses'] = [...host.querySelectorAll('[data-status-exclude]:checked')].map(input => input.dataset.statusExclude);
        publish();
      } else if (el.matches("[data-include-delisted]")) {
        state.platformStatusMax = el.checked ? "delisted" : "restricted";
        publish();
      } else if (el.matches("[data-model-require-all]")) {
        if (!el.checked) { state.modelMatch = "any"; publish(); return; }
        pendingAll = true;
        const selected = state.modelSlugs === null ? models.map(m => m.slug) : state.modelSlugs;
        const count = match => {
          const offers = Filters.matchingOffers(context, {...state, modelSlugs:selected, modelMatch:match}, {usdToCnyRate:config.usdToCnyRate,platformCatalog:config.platformCatalog});
          if (full) return new Set(offers.filter(offer => opts.view !== "plans" || offer.plan.billingMode !== "payg").map(offer => offer.plan.slug)).size;
          return offers.length;
        };
        const before = count("any"), after = count("all");
        host.querySelector('[data-model-match-impact]').textContent = `开启后，${full ? "符合条件的套餐" : "匹配方案"}从 ${before} 个变为 ${after} 个。${after === 0 ? "当前没有同时满足条件的套餐。" : ""}确认后生效。`;
        render();
        host.querySelector('[data-model-match-action="confirm"]').focus({preventScroll:true});
      } else if (el.matches("[data-filter-field]")) {
        state[el.dataset.filterField] =
          el.type === "checkbox" ? el.checked : el.value;
        publish(el.dataset.filterField === "preference" ? "sort" : "manual");
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
      if (el.hasAttribute('data-catalog-featured')) {
        featuredOnly = !featuredOnly;
        host.querySelectorAll('details[open]').forEach(picker => { picker.open = false; });
        publish('featured-mode');
        return;
      }
      if (el.hasAttribute('data-select-multimodal')) { selectMultimodalModels(); return; }
      if (el.dataset.platformShortcut) { selectPlatformShortcut(el.dataset.platformShortcut); return; }
      if (el.hasAttribute('data-retry-model-presets') || el.hasAttribute('data-hub-retry-featured')) { refreshGroups(); return; }
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
        if (key === "platformSlugs" && el.dataset.pickerAction === "default") {
          const slugs = featuredPlatforms();
          if (!slugs.length) return;
          state.platformSlugs = slugs; publish('manual','filter_featured_toggle'); return;
        }
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
      else if (el.hasAttribute("data-clear-status")) {
        state[planStatusOnly ? 'excludedPlanStatuses' : 'excludedPlatformStatuses'] = [];
      } else if (el.dataset.filterAction === "reset") {
        controller.reset();
        return;
      } else if (el.dataset.filterAction === "restore-defaults") {
        controller.restoreDefaults();
        return;
      }
      else return;
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
      if (event.target.open) sortPickerOptions('modelSlugs');
      if (!event.target.open) {
        resetModelList();
        if (pendingAll) { pendingAll = false; render(); }
      }
      positionSelectionPanels();
    });
    host.querySelector('#homeStatusPicker')?.addEventListener('toggle', positionStatusPanel);
    host.querySelector('[data-picker="platformSlugs"]')?.addEventListener('toggle', () => {
      sortPickerOptions('platformSlugs');
      positionSelectionPanels();
    });
    root.addEventListener('resize', positionSelectionPanels);
    root.addEventListener('scroll', positionSelectionPanels, {passive:true});
    root.visualViewport?.addEventListener('resize', positionSelectionPanels);
    root.addEventListener("codingplan:token-unit-changed", () => publish("display"));
    host.dataset.mounted = "1";
    document.body.classList.add(
      full ? "tool-unified-active" : "homepage-unified-active",
    );
    resetModelList();
    publish("init");
    function refreshGroups() {
      host.querySelectorAll('[data-retry-model-presets]').forEach(button => { button.disabled = true; });
      loadGroups(context).then(() => {
        groupsReady = true;
        if (applyInitialPreset()) resetModelList();
        host.querySelector('[data-model-preset-error]').hidden = true;
        if (!platformHub) host.querySelector('[data-platform-preset-error]').hidden = true;
        publish("catalog");
        root.dispatchEvent(new Event("codingplan:filters-ready"));
      }).catch(() => {
        host.querySelector('[data-model-preset-error]').hidden = false;
        if (!platformHub) host.querySelector('[data-platform-preset-error]').hidden = false;
      }).finally(() => { host.querySelectorAll('[data-retry-model-presets]').forEach(button => { button.disabled = false; }); });
    }
    refreshGroups();
    return true;
  }
  root.CodingPlanFilterUI = { mount, loadGroups, multimodalControls, platformShortcutControls, bindSelectionHelp, bindMultimodalHelp: bindSelectionHelp };
  if (!document.getElementById("homepageUnifiedFiltersMount")) return;
  function start() {
    if (!mount()) root.setTimeout(start, 250);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})(globalThis);
