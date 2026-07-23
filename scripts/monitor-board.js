(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.mountMonitorBoard = api.mountMonitorBoard;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const mountedStates = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function getApiBase() {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    return (g.MONITOR_CONFIG && g.MONITOR_CONFIG.apiBase) || '';
  }

  function findPlatformSlug(platforms, initialPlatform) {
    if (!initialPlatform || !platforms) return null;
    const needle = String(initialPlatform).toLowerCase();
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      if ((platform.platform_slug || '').toLowerCase() === needle) {
        return platform.platform_slug;
      }
      if ((platform.platform_display_name || '').toLowerCase() === needle) {
        return platform.platform_slug;
      }
    }
    return null;
  }

  function applyInitialPlatform(state) {
    const initialPlatform = state.options.initialPlatform;
    if (!initialPlatform || !state.boardData || !state.boardData.platforms) return;

    const slug = findPlatformSlug(state.boardData.platforms, initialPlatform);
    if (!slug) return;

    state.selectedModelValue = '';
    state.updateModelFilterLabel();
    state.expandedPlatforms[slug] = true;
    state.renderBoard();

    requestAnimationFrame(function () {
      const row = state.rootEl.querySelector('[data-platform-slug="' + slug + '"]');
      if (row && row.scrollIntoView) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function createBoardState(rootEl, options) {
    const state = {
      rootEl: rootEl,
      options: options,
      config: {},
      boardData: null,
      expandedPlatforms: {},
      selectedModelValue: '',
      tooltipEl: null,
      boardRoot: null,
      sortCheckbox: null,
      modelDropdown: null,
      modelFilterTrigger: null,
      modelFilterMenu: null,
      modelFilterLabel: null,
      sortToggle: null,
      resizeHandler: null,
      docClickHandler: null,
      docKeydownHandler: null
    };

    function pickVisibleCount() {
      const targets = state.config.responsiveCells || [168, 144, 120, 96, 72, 48, 24];
      const breakpoints = [1400, 1280, 1200, 960, 768, 540];
      const width = window.innerWidth || 1400;
      for (let i = 0; i < breakpoints.length && i < targets.length - 1; i++) {
        if (width >= breakpoints[i]) return targets[i];
      }
      return targets[targets.length - 1];
    }

    function visibleHours(hours) {
      const count = pickVisibleCount();
      if (!hours || hours.length <= count) return hours || [];
      return hours.slice(hours.length - count);
    }

    function availabilityRateFromHours(hours) {
      const cells = hours || [];
      let withData = 0;
      let ok = 0;
      for (let i = 0; i < cells.length; i++) {
        const color = (cells[i] && cells[i].color) || 'gray';
        if (color === 'gray') continue;
        withData += 1;
        if (color === 'green' || color === 'yellow') ok += 1;
      }
      if (!withData) return 0;
      return Math.round((ok / withData) * 10000) / 10000;
    }

    function visibleAvailabilityRate(hours) {
      return availabilityRateFromHours(visibleHours(hours));
    }

    function displayModelName(name) {
      if (!state.boardData || !state.boardData.model_display_names) return name;
      return state.boardData.model_display_names[name] || name;
    }

    function formatRate(rate) {
      return ((rate || 0) * 100).toFixed(1) + '%';
    }

    function formatTps(value) {
      if (value === null || value === undefined) return '—';
      return String(value);
    }

    function formatTooltipDate(hourMs) {
      const d = new Date(hourMs);
      const datePart = d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      return datePart + ' ' + String(d.getHours()).padStart(2, '0') + ':00';
    }

    function cellStatusInfo(cell) {
      const color = cell.color || 'gray';
      if (color === 'gray') {
        return { color: 'gray', text: '无数据', icon: '—' };
      }
      if (color === 'green') {
        return { color: 'green', text: '运行正常', icon: '✓' };
      }
      if (color === 'yellow') {
        return { color: 'yellow', text: '部分不可用', icon: '!' };
      }
      return { color: 'red', text: '出现故障', icon: '✕' };
    }

    function buildTooltipDetail(cell) {
      const parts = [];
      if (cell.success_rate !== null && cell.success_rate !== undefined) {
        parts.push('成功率 ' + (cell.success_rate * 100).toFixed(1) + '%');
      }
      if (cell.avg_tps !== null && cell.avg_tps !== undefined) {
        parts.push(cell.avg_tps + ' ' + (state.config.toolbar && state.config.toolbar.tpsUnit || 'tok/s'));
      }
      return parts.join(' · ');
    }

    function showTooltip(hourMs, cell, targetEl) {
      const status = cellStatusInfo(cell);
      const detail = buildTooltipDetail(cell);

      state.tooltipEl.innerHTML =
        '<div class="monitor-tooltip-date">' + formatTooltipDate(hourMs) + '</div>' +
        '<div class="monitor-tooltip-status">' +
          '<span class="monitor-tooltip-icon monitor-tooltip-icon--' + status.color + '">' + status.icon + '</span>' +
          '<span>' + status.text + '</span>' +
        '</div>' +
        (detail ? '<div class="monitor-tooltip-detail">' + detail + '</div>' : '');

      state.tooltipEl.style.display = 'block';

      const rect = targetEl.getBoundingClientRect();
      const tipWidth = state.tooltipEl.offsetWidth;
      const tipHeight = state.tooltipEl.offsetHeight;
      let left = rect.left + rect.width / 2 - tipWidth / 2;
      let top = rect.top - tipHeight - 10;

      left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
      top = Math.max(8, top);

      state.tooltipEl.style.left = left + 'px';
      state.tooltipEl.style.top = top + 'px';
    }

    function hideTooltip() {
      state.tooltipEl.style.display = 'none';
      state.tooltipEl.innerHTML = '';
    }

    function syncSortToggle() {
      if (!state.sortToggle || !state.sortCheckbox) return;
      state.sortToggle.classList.toggle('is-active', state.sortCheckbox.checked);
    }

    function renderTimelineBar(hours) {
      const bar = document.createElement('div');
      bar.className = 'monitor-bar';
      visibleHours(hours).forEach(function (cell) {
        const el = document.createElement('div');
        el.className = 'timeline-cell timeline-cell--' + (cell.color || 'gray');
        el.addEventListener('mouseenter', function () {
          showTooltip(cell.hour_ms, cell, el);
        });
        el.addEventListener('mouseleave', hideTooltip);
        bar.appendChild(el);
      });
      return bar;
    }

    function formatRateDisplay(rate) {
      return formatRate(rate) + ' ' + (state.config.toolbar && state.config.toolbar.availableLabel || '可用');
    }

    function statusDotColor(hours) {
      const cells = visibleHours(hours);
      if (!cells.length) return 'gray';
      return cells[cells.length - 1].color || 'gray';
    }

    function renderStatusRow(options) {
      options = options || {};
      const row = document.createElement('div');
      row.className = 'monitor-row' + (options.nested ? ' monitor-row--nested' : '');

      const top = document.createElement('div');
      top.className = 'monitor-row-top' + (options.clickable ? ' monitor-row-top--clickable' : '');
      if (options.onClick) {
        top.addEventListener('click', options.onClick);
      }

      const title = document.createElement('div');
      title.className = 'monitor-row-title';

      const dot = document.createElement('span');
      dot.className = 'status-dot status-dot--' + statusDotColor(options.hours);
      title.appendChild(dot);

      if (options.compactPlatformName) {
        const platformName = document.createElement('span');
        platformName.className = 'monitor-name';
        platformName.textContent = options.compactPlatformName;
        const modelPart = document.createElement('span');
        modelPart.className = 'monitor-name-sub';
        modelPart.textContent = ' · ' + options.title;
        title.appendChild(platformName);
        title.appendChild(modelPart);
      } else {
        const nameEl = document.createElement('span');
        nameEl.className = 'monitor-name';
        nameEl.textContent = options.title;
        title.appendChild(nameEl);
      }

      if (options.meta) {
        const meta = document.createElement('span');
        meta.className = 'monitor-meta';
        meta.textContent = options.meta;
        title.appendChild(meta);
      }

      if (options.expanded !== undefined) {
        const chevron = document.createElement('span');
        chevron.className = 'monitor-chevron' + (options.expanded ? ' monitor-chevron--open' : '');
        title.appendChild(chevron);
      }

      const rate = document.createElement('span');
      rate.className = 'monitor-rate';
      rate.textContent = formatRateDisplay(options.rate);

      top.appendChild(title);
      top.appendChild(rate);
      row.appendChild(top);
      row.appendChild(renderTimelineBar(options.hours));
      return row;
    }

    function renderModelBlock(model, opts) {
      opts = opts || {};
      return renderStatusRow({
        nested: true,
        compactPlatformName: opts.compactPlatformName || null,
        title: displayModelName(model.model_slug),
        meta: formatTps(model.avg_tps) + ' ' + (state.config.toolbar && state.config.toolbar.tpsUnit || 'tok/s'),
        rate: visibleAvailabilityRate(model.hours),
        hours: model.hours
      });
    }

    function renderPlatformBlock(platform) {
      const block = document.createElement('div');
      block.className = 'monitor-platform';
      block.setAttribute('data-platform-slug', platform.platform_slug || '');

      block.appendChild(renderStatusRow({
        title: platform.platform_display_name || platform.platform_slug,
        meta: (platform.models ? platform.models.length : 0) + ' ' + (state.config.toolbar && state.config.toolbar.modelsLabel || '个模型'),
        rate: visibleAvailabilityRate(platform.hours),
        hours: platform.hours,
        clickable: true,
        expanded: !!state.expandedPlatforms[platform.platform_slug],
        onClick: function () {
          state.expandedPlatforms[platform.platform_slug] = !state.expandedPlatforms[platform.platform_slug];
          state.renderBoard();
        }
      }));

      if (state.expandedPlatforms[platform.platform_slug] && platform.models && platform.models.length) {
        const modelsWrap = document.createElement('div');
        modelsWrap.className = 'monitor-models';
        platform.models.forEach(function (model) {
          modelsWrap.appendChild(renderModelBlock(model));
        });
        block.appendChild(modelsWrap);
      }

      return block;
    }

    function renderSectionHead(label, count) {
      const head = document.createElement('div');
      head.className = 'monitor-section-head';
      const title = document.createElement('span');
      title.className = 'monitor-section-title';
      title.textContent = label;
      const meta = document.createElement('span');
      meta.className = 'monitor-section-count';
      meta.textContent = count;
      head.appendChild(title);
      head.appendChild(meta);
      return head;
    }

    function collectModelOptions(platforms) {
      const set = {};
      (platforms || []).forEach(function (platform) {
        (platform.models || []).forEach(function (model) {
          set[model.model_slug] = true;
        });
      });
      return Object.keys(set).sort();
    }

    function sortedPlatforms(platforms, sortByAvailability) {
      const copy = (platforms || []).slice();
      if (!sortByAvailability) return copy;
      copy.sort(function (a, b) {
        return visibleAvailabilityRate(b.hours) - visibleAvailabilityRate(a.hours);
      });
      return copy;
    }

    state.renderBoard = function renderBoard() {
      state.boardRoot.innerHTML = '';
      state.boardRoot.className = 'monitor-list';

      if (!state.boardData || !state.boardData.platforms || !state.boardData.platforms.length) {
        state.boardRoot.className = 'monitor-empty';
        state.boardRoot.textContent = state.config.emptyLabel || '暂无数据';
        return;
      }

      const selectedModel = state.selectedModelValue;
      const sortByAvailability = state.sortCheckbox.checked;

      if (selectedModel) {
        const rows = [];
        sortedPlatforms(state.boardData.platforms, sortByAvailability).forEach(function (platform) {
          (platform.models || []).forEach(function (model) {
            if (model.model_slug !== selectedModel) return;
            rows.push({
              platform: platform,
              model: model
            });
          });
        });
        if (!rows.length) {
          state.boardRoot.className = 'monitor-empty';
          state.boardRoot.textContent = state.config.emptyLabel || '暂无数据';
          return;
        }
        if (sortByAvailability) {
          rows.sort(function (a, b) {
            return visibleAvailabilityRate(b.model.hours) - visibleAvailabilityRate(a.model.hours);
          });
        }
        state.boardRoot.appendChild(renderSectionHead(
          displayModelName(selectedModel),
          rows.length + ' 个平台'
        ));
        rows.forEach(function (row) {
          state.boardRoot.appendChild(renderModelBlock(row.model, {
            compactPlatformName: row.platform.platform_display_name || row.platform.platform_slug
          }));
        });
        return;
      }

      const platforms = sortedPlatforms(state.boardData.platforms, sortByAvailability);
      state.boardRoot.appendChild(renderSectionHead('平台', platforms.length + ' 个'));
      platforms.forEach(function (platform) {
        state.boardRoot.appendChild(renderPlatformBlock(platform));
      });
    };

    function closeModelDropdown() {
      state.modelDropdown.classList.remove('is-open');
      state.modelFilterTrigger.setAttribute('aria-expanded', 'false');
    }

    function openModelDropdown() {
      state.modelDropdown.classList.add('is-open');
      state.modelFilterTrigger.setAttribute('aria-expanded', 'true');
    }

    function toggleModelDropdown() {
      if (state.modelDropdown.classList.contains('is-open')) {
        closeModelDropdown();
      } else {
        openModelDropdown();
      }
    }

    state.updateModelFilterLabel = function updateModelFilterLabel() {
      if (!state.selectedModelValue) {
        state.modelFilterLabel.textContent = (state.config.toolbar && state.config.toolbar.allModels) || '全部';
        return;
      }
      state.modelFilterLabel.textContent = displayModelName(state.selectedModelValue);
    };

    function setModelFilter(value) {
      state.selectedModelValue = value || '';
      state.updateModelFilterLabel();

      Array.prototype.forEach.call(state.modelFilterMenu.querySelectorAll('.monitor-dropdown-option'), function (btn) {
        btn.classList.toggle('is-selected', btn.getAttribute('data-value') === state.selectedModelValue);
      });

      closeModelDropdown();
      state.renderBoard();
    }

    function populateModelFilter(platforms) {
      const current = state.selectedModelValue || '';
      state.modelFilterMenu.innerHTML = '';

      function addOption(value, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'monitor-dropdown-option' + (value === current ? ' is-selected' : '');
        btn.setAttribute('data-value', value);
        btn.setAttribute('role', 'option');
        btn.textContent = label;
        btn.addEventListener('click', function () {
          setModelFilter(value);
        });
        state.modelFilterMenu.appendChild(btn);
      }

      addOption('', (state.config.toolbar && state.config.toolbar.allModels) || '全部');
      collectModelOptions(platforms).forEach(function (name) {
        addOption(name, displayModelName(name));
      });

      if (current && collectModelOptions(platforms).indexOf(current) < 0) {
        state.selectedModelValue = '';
      }
      state.updateModelFilterLabel();
    }

    state.applyStaticTexts = function applyStaticTexts() {
      const modelLabel = state.rootEl.querySelector('[data-monitor-model-label]');
      const sortLabel = state.rootEl.querySelector('[data-monitor-sort-label]');
      if (modelLabel) {
        modelLabel.textContent = (state.config.toolbar && state.config.toolbar.modelLabel) || '模型';
      }
      if (sortLabel) {
        sortLabel.textContent = (state.config.toolbar && state.config.toolbar.sortByAvailability) || '按可用率排序';
      }
      syncSortToggle();
    };

    state.fetchBoard = function fetchBoard() {
      state.boardRoot.className = 'monitor-loading';
      state.boardRoot.textContent = state.config.loadingLabel || '加载中...';

      return fetch(getApiBase() + '/monitor/board?days=7')
        .then(function (r) { return r.json(); })
        .then(function (resp) {
          state.boardData = (resp && resp.data) || resp;
          populateModelFilter(state.boardData.platforms || []);
          state.renderBoard();
          applyInitialPlatform(state);
        })
        .catch(function () {
          state.boardRoot.className = 'monitor-empty';
          state.boardRoot.textContent = state.config.errorLabel || '数据加载失败，请稍后重试';
        });
    };

    state.buildDom = function buildDom() {
      rootEl.innerHTML = '';

      const toolbar = document.createElement('div');
      toolbar.className = 'monitor-toolbar';

      const modelControl = document.createElement('div');
      modelControl.className = 'monitor-control';

      const modelLabel = document.createElement('span');
      modelLabel.className = 'monitor-control-label';
      modelLabel.setAttribute('data-monitor-model-label', '1');

      state.modelDropdown = document.createElement('div');
      state.modelDropdown.className = 'monitor-dropdown';
      state.modelDropdown.id = 'modelDropdown';

      state.modelFilterTrigger = document.createElement('button');
      state.modelFilterTrigger.type = 'button';
      state.modelFilterTrigger.className = 'monitor-dropdown-trigger';
      state.modelFilterTrigger.setAttribute('aria-haspopup', 'listbox');
      state.modelFilterTrigger.setAttribute('aria-expanded', 'false');

      state.modelFilterLabel = document.createElement('span');
      state.modelFilterLabel.className = 'monitor-dropdown-value';

      const chevron = document.createElement('span');
      chevron.className = 'monitor-dropdown-chevron';

      state.modelFilterMenu = document.createElement('div');
      state.modelFilterMenu.className = 'monitor-dropdown-menu';
      state.modelFilterMenu.setAttribute('role', 'listbox');

      state.modelFilterTrigger.appendChild(state.modelFilterLabel);
      state.modelFilterTrigger.appendChild(chevron);
      state.modelDropdown.appendChild(state.modelFilterTrigger);
      state.modelDropdown.appendChild(state.modelFilterMenu);

      modelControl.appendChild(modelLabel);
      modelControl.appendChild(state.modelDropdown);

      state.sortToggle = document.createElement('label');
      state.sortToggle.className = 'monitor-toggle';
      state.sortToggle.id = 'sortToggle';

      state.sortCheckbox = document.createElement('input');
      state.sortCheckbox.type = 'checkbox';
      state.sortCheckbox.id = 'sortByAvailability';

      const sortLabel = document.createElement('span');
      sortLabel.setAttribute('data-monitor-sort-label', '1');

      state.sortToggle.appendChild(state.sortCheckbox);
      state.sortToggle.appendChild(sortLabel);

      toolbar.appendChild(modelControl);
      toolbar.appendChild(state.sortToggle);

      state.boardRoot = document.createElement('div');
      state.boardRoot.className = 'monitor-loading';
      state.boardRoot.textContent = '加载中...';

      rootEl.appendChild(toolbar);
      rootEl.appendChild(state.boardRoot);

      state.tooltipEl = document.createElement('div');
      state.tooltipEl.className = 'monitor-tooltip';
      document.body.appendChild(state.tooltipEl);

      state.sortCheckbox.addEventListener('change', function () {
        syncSortToggle();
        state.renderBoard();
      });

      state.modelFilterTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleModelDropdown();
      });

      state.docClickHandler = function () {
        closeModelDropdown();
      };
      document.addEventListener('click', state.docClickHandler);

      state.modelDropdown.addEventListener('click', function (e) {
        e.stopPropagation();
      });

      state.docKeydownHandler = function (e) {
        if (e.key === 'Escape') {
          closeModelDropdown();
        }
      };
      document.addEventListener('keydown', state.docKeydownHandler);

      state.resizeHandler = function () {
        state.renderBoard();
      };
      window.addEventListener('resize', state.resizeHandler);
    };

    return state;
  }

  async function mountMonitorBoard(rootEl, options) {
    options = options || {};
    const configUrl = options.configUrl || 'monitor-config.json';

    if (!rootEl) {
      throw new Error('mountMonitorBoard requires a root element');
    }

    if (rootEl.dataset.monitorMounted === '1') {
      const existing = mountedStates && mountedStates.get(rootEl);
      if (existing) {
        existing.options = Object.assign({}, existing.options, options);
        if (options.initialPlatform) {
          applyInitialPlatform(existing);
        }
      }
      return existing ? existing.config : undefined;
    }

    const state = createBoardState(rootEl, options);
    state.buildDom();

    try {
      const response = await fetch(configUrl);
      state.config = response.ok ? await response.json() : {};
    } catch (err) {
      state.config = {};
    }

    state.applyStaticTexts();
    await state.fetchBoard();

    rootEl.dataset.monitorMounted = '1';
    if (mountedStates) {
      mountedStates.set(rootEl, state);
    }

    return state.config;
  }

  return {
    mountMonitorBoard: mountMonitorBoard
  };
});
