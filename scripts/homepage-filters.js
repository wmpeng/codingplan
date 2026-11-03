(function (root) {
  "use strict";
  const Filters = root.CodingPlanFilters;
  if (!Filters) return;
  const Controls = root.CodingPlanFilterControls;
  const Popovers = root.CodingPlanFilterPopovers;
  const {statusExclusions} = Controls;
  const {knots:rangeKnots, value:rangeValue, position:rangePosition, budgetNumericMax, budgetSliderMax} = Controls.range;

  function setBudget(value, apiOnly = false) {
    return { apiOnly, budgetCny: value == null ? null : { min: null, max: value } };
  }
  function syncNumberInput(input, value) {
    if (document.activeElement === input && input.value !== "" && Number(input.value) === value) return;
    input.value = value ?? "";
  }
  const platformShortcutKinds = {
    mainland: { label: Controls.mainlandLabel },
    // Keep old controller calls translatable; only mainland is rendered.
    network: { label: Controls.mainlandLabel, legacy: "domesticNetworkOnly" },
    payment: { label: Controls.mainlandLabel, legacy: "domesticPaymentOnly" },
  };
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
    const featuredCatalog = platformHub || plansPage || pricing;
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
    let groupsReady = Array.isArray(context.modelGroups), initialPresetPending = !full || pricing, pendingAll = false, multimodalNotice = "", mainlandModelNotice = "", platformShortcutNotice = "";
    const platformCandidates = () => platforms.filter(Filters.isMainlandPlatform).map(platform => platform.slug);
    function platformShortcutAction(kind) {
      const eligible = platformCandidates(kind);
      const selected = state.platformSlugs === null ? platforms.map(platform => platform.slug) : state.platformSlugs;
      const retain = selected.some(slug => !eligible.includes(slug));
      return { label: `${retain ? "仅保留" : "全部"}${platformShortcutKinds[kind].label}平台`, slugs: retain ? selected.filter(slug => eligible.includes(slug)) : eligible };
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
    const mainlandModelSlugs = models.filter(Filters.isMainlandModel).map(model => model.slug);
    function modelShortcutAction(eligibleSlugs, label) {
      const eligible = new Set(eligibleSlugs);
      const selected = state.modelSlugs === null ? models.map(model => model.slug) : state.modelSlugs;
      const retain = selected.some(slug => !eligible.has(slug));
      return { label: `${retain ? "仅保留" : "全部"}${label}`, slugs: retain ? selected.filter(slug => eligible.has(slug)) : [...eligibleSlugs] };
    }
    const multimodalAction = () => modelShortcutAction(multimodalSlugs, "多模态模型");
    const mainlandModelAction = () => modelShortcutAction(mainlandModelSlugs, `${Controls.mainlandLabel}模型`);
    function selectMultimodalModels(source = "manual") {
      const {slugs} = multimodalAction();
      if (!slugs.length) {
        multimodalNotice = multimodalSlugs.length ? "当前所选模型中没有多模态模型，请先选择支持多模态的模型。" : "目前没有确认支持多模态的模型。";
        pendingAll = false; render(); return false;
      }
      state.modelSlugs = slugs; state.modelGroup = "any"; state.modelMatch = "any";
      publish(source); return true;
    }
    function selectMainlandModels(source = "manual") {
      const {slugs} = mainlandModelAction();
      if (!slugs.length) {
        mainlandModelNotice = mainlandModelSlugs.length ? "当前所选模型中没有中国大陆可用模型，已保留原选择。" : "目前没有确认符合中国大陆可用条件的模型，已保留原选择。";
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
      if (!conditions.priorities) state.priorities = Filters.normalizeState({preference:conditions.preference}).priorities;
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
    host.innerHTML = Controls.render({policy, state, context});
    const singleSelects = root.CodingPlanSingleSelect.mountAll(host);
    Popovers.bindSelectionHelp(host);
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
      selectMainlandModels,
      selectPlatformShortcut,
      getPlatformShortcutLabels: () => Object.fromEntries(Object.keys(platformShortcutKinds).map(kind => [kind, platformShortcutAction(kind).label])),
      getPlatformShortcutNotice: () => platformShortcutNotice,
      setState: (patch, source = "guide") => {
        if (Object.hasOwn(patch,'preference') && !Object.hasOwn(patch,'priorities')) patch = {...patch,priorities:Filters.normalizeState({preference:patch.preference}).priorities};
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
          const slugs = selected.filter(slug => root.EntityData.supportsImageInput(context.modelBySlug.get(slug)));
          if (slugs.length) { state.modelSlugs = slugs; state.modelMatch = "any"; }
          else imageNotice = "所选模型暂未确认具备图片输入能力，已保留原选择。";
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
    const positionStatusPanel = () => Popovers.positionStatusPanel(host);
    const positionSelectionPanels = () => Popovers.positionSelectionPanels(host);
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
        const available = platformHub ? featuredPlatforms().length > 0 : canRestoreDefaults();
        const toggle = host.querySelector('[data-catalog-featured]');
        toggle.disabled = !available && !featuredOnly;
        toggle.setAttribute('aria-pressed', String(featuredOnly));
        const fields = host.querySelector('[data-featured-filter-fields]');
        fields.disabled = featuredOnly;
        fields.inert = featuredOnly;
        fields.setAttribute('aria-disabled', String(featuredOnly));
        host.querySelector('[data-filter-action="reset"], [data-filter-action="restore-defaults"]').disabled = featuredOnly || (pricing && !available);
        fields.closest('.filter-state-bar').classList.toggle('is-featured-mode', featuredOnly);
        host.querySelector('[data-hub-retry-featured]').hidden = available;
      }
      const modelPicker = host.querySelector('[data-picker="modelSlugs"]');
      modelPicker.querySelector('[data-select-multimodal]').textContent = multimodalAction().label;
      const notice = modelPicker.querySelector('[data-multimodal-notice]');
      notice.hidden = !multimodalNotice; notice.textContent = multimodalNotice;
      modelPicker.querySelector('[data-select-mainland-models]').textContent = mainlandModelAction().label;
      const mainlandNotice = modelPicker.querySelector('[data-mainland-model-notice]');
      mainlandNotice.hidden = !mainlandModelNotice; mainlandNotice.textContent = mainlandModelNotice;
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
      singleSelects.sync();
      const includeDelisted = host.querySelector('[data-include-delisted]');
      if (includeDelisted) includeDelisted.checked = state.platformStatusMax === "delisted";
      const priorityOptions = host.querySelector('[data-priority-options]');
      if (priorityOptions) {
        const priorities=state.priorities || ['balanced'];
        host.querySelector('[data-priority-summary]').innerHTML=priorities.length?priorities.map((key,index)=>`<span class="priority-summary-item"><span class="ui-priority-number" aria-hidden="true">${index+1}</span><span>${root.CodingPlanUI.escapeHtml(root.PurchaseGuide.sortOptions.find(option=>option.value===key).label)}</span></span>`).join(''):'精选优先';
        if(!priorityOptions.children.length)priorityOptions.innerHTML=root.PurchaseGuide.sortOptions.map(option=>{
          return `<div class="priority-option">${root.CodingPlanFilterControls.priorityChoice(option,priorities.indexOf(option.value))}</div>`;
        }).join('');
        root.PurchaseGuide.sortOptions.forEach(option=>{
          const index=priorities.indexOf(option.value),button=priorityOptions.querySelector(`[data-priority="${option.value}"]`);
          button.setAttribute('aria-checked',String(index>=0));
          button.setAttribute('aria-label',`${option.label}${index>=0?`，第${index+1}优先级`:''}`);
          button.querySelector('.ui-priority-number').textContent=index>=0?index+1:'';
        });
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
    function publish(source = "manual", updatePurpose, persist = false) {
      policy.constrain(state);
      if (!["init", "catalog", "display"].includes(source)) initialPresetPending = false;
      multimodalNotice = "";
      mainlandModelNotice = "";
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
      if (persist || !["init", "catalog", "display"].includes(source)) {
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
    host.addEventListener('click',event=>{
      const button=event.target.closest('[data-priority]');if(!button)return;
      const list=[...(state.priorities || ['balanced'])],key=button.dataset.priority,index=list.indexOf(key);
      if(index>=0)list.splice(index,1);else list.push(key);
      state.priorities=list;state.preference=list[0] || 'balanced';publish('sort');
      host.querySelector(`[data-priority="${key}"]`)?.focus({preventScroll:true});
    });
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
      if (el.hasAttribute('data-select-mainland-models')) { selectMainlandModels(); return; }
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
    function selectAllIfCleared(key) {
      if (!Array.isArray(state[key]) || state[key].length) return;
      state[key] = null;
      // Only normalize the checklist; keep display state and persist the selection.
      publish("display", undefined, true);
    }
    host.querySelector('[data-picker="modelSlugs"]').addEventListener('toggle', event => {
      if (event.target.open) sortPickerOptions('modelSlugs');
      if (!event.target.open) {
        resetModelList();
        if (pendingAll) { pendingAll = false; render(); }
        selectAllIfCleared('modelSlugs');
      }
      positionSelectionPanels();
    });
    host.querySelector('#homeStatusPicker')?.addEventListener('toggle', positionStatusPanel);
    host.querySelectorAll('#homeBudgetPicker, #homeTokenPicker').forEach(picker => {
      picker.addEventListener('toggle', positionSelectionPanels);
    });
    host.querySelector('[data-picker="platformSlugs"]')?.addEventListener('toggle', event => {
      if (!event.target.open) selectAllIfCleared('platformSlugs');
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
  root.CodingPlanFilterUI = { mount, loadGroups };
  if (!document.getElementById("homepageUnifiedFiltersMount")) return;
  function start() {
    if (!mount()) root.setTimeout(start, 250);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})(globalThis);
