(function () {
  'use strict';

  let allRows = [];
  let sortKey = 'order';
  let sortDir = 'asc';
  const selectedPlatformIds = new Set();
  const selectedModelNames = new Set();
  let pricedOnly = false;

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${path} HTTP ${response.status}`);
    }
    return response.json();
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
      menu.classList.remove('show');
    });
    document.querySelectorAll('.filter-btn.active').forEach((btn) => {
      btn.classList.remove('active');
    });
  }

  function toggleDropdown(btn, menu) {
    const willOpen = !menu.classList.contains('show');
    closeAllDropdowns();
    if (willOpen) {
      menu.classList.add('show');
      btn.classList.add('active');
    }
  }

  function updateCountBadges() {
    const vendorCount = document.getElementById('paygVendorCount');
    const modelCount = document.getElementById('paygModelCount');
    if (vendorCount) {
      const n = selectedPlatformIds.size;
      vendorCount.textContent = String(n);
      vendorCount.style.display = n ? '' : 'none';
    }
    if (modelCount) {
      const n = selectedModelNames.size;
      modelCount.textContent = String(n);
      modelCount.style.display = n ? '' : 'none';
    }
  }

  function syncSelectionFromDom() {
    selectedPlatformIds.clear();
    selectedModelNames.clear();
    document.querySelectorAll('#paygVendorCheckboxes input:checked').forEach((input) => {
      selectedPlatformIds.add(input.value);
    });
    document.querySelectorAll('#paygModelCheckboxes input:checked').forEach((input) => {
      selectedModelNames.add(input.value);
    });
    const pricedEl = document.getElementById('paygPricedOnly');
    pricedOnly = !!(pricedEl && pricedEl.checked);
    updateCountBadges();
  }

  function updateSortHeaders() {
    document.querySelectorAll('#paygTable th.sortable').forEach((th) => {
      th.classList.remove('sort-asc', 'sort-desc');
      const key = th.getAttribute('data-sort-key');
      if (key === sortKey) {
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  function updateStickyColumns() {
    const firstCells = document.querySelectorAll('#paygTable td.sticky-first, #paygTable th.sticky-first');
    const secondCells = document.querySelectorAll('#paygTable td.sticky-second, #paygTable th.sticky-second');
    let firstWidth = 0;
    firstCells.forEach((cell) => {
      firstWidth = Math.max(firstWidth, cell.offsetWidth);
      cell.style.left = '0px';
    });
    secondCells.forEach((cell) => {
      cell.style.left = firstWidth + 'px';
    });
  }

  function formatRatingStars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function renderBody(rows) {
    const tbody = document.getElementById('paygTableBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML =
        `<tr><td colspan="7"><div class="empty-state">` +
        `<div class="empty-state-icon">📭</div>` +
        `<div class="empty-state-text">没有找到符合条件的行</div>` +
        `<div class="empty-state-hint">请调整筛选条件或重置筛选</div>` +
        `</div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const name = PlatformCatalog.escapeHtml(row.platformName);
        const nameHtml = row.action
          ? `<a class="vendor-name-link" href="${PlatformCatalog.escapeHtml(row.action)}" target="_blank" rel="noopener noreferrer"><span class="vendor-name">${name}</span></a>`
          : `<span class="vendor-name">${name}</span>`;
        const notes = (row.notes || [])
          .map((n) => PlatformCatalog.escapeHtml(n))
          .join('<br>');
        const currency = row.currency || '¥';
        return (
          `<tr>` +
          `<td class="sticky-first">${nameHtml}</td>` +
          `<td class="sticky-second"><span class="plan-name">${PlatformCatalog.escapeHtml(row.modelName)}</span></td>` +
          `<td><span class="price">${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.input, currency))}</span></td>` +
          `<td><span class="price-monthly">${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.cache, currency))}</span></td>` +
          `<td><span class="price-normal">${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.output, currency))}</span></td>` +
          `<td><span class="note">${notes || '—'}</span></td>` +
          `<td class="rating-stars">${formatRatingStars(row.rating)}</td>` +
          `</tr>`
        );
      })
      .join('');

    requestAnimationFrame(updateStickyColumns);
  }

  function applyAndRender() {
    syncSelectionFromDom();
    const filtered = PlatformCatalog.filterPaygRows(allRows, {
      platformIds: selectedPlatformIds.size ? [...selectedPlatformIds] : [],
      modelNames: selectedModelNames.size ? [...selectedModelNames] : [],
      pricedOnly
    });
    const sorted = PlatformCatalog.sortPaygRows(filtered, { key: sortKey, dir: sortDir });
    renderBody(sorted);
    const countEl = document.getElementById('paygResultCount');
    const totalEl = document.getElementById('paygTotalCount');
    if (countEl) countEl.textContent = String(sorted.length);
    if (totalEl) totalEl.textContent = String(allRows.length);
    updateSortHeaders();
  }

  function buildCheckboxItems(container, items, getValue, getLabel, selectedSet) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item) => {
      const value = getValue(item);
      const label = getLabel(item);
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      const id = `payg-cb-${container.id}-${value}`;
      div.innerHTML =
        `<input type="checkbox" id="${PlatformCatalog.escapeHtml(id)}" value="${PlatformCatalog.escapeHtml(value)}">` +
        `<label for="${PlatformCatalog.escapeHtml(id)}">${PlatformCatalog.escapeHtml(label)}</label>`;
      const input = div.querySelector('input');
      if (selectedSet.has(value)) input.checked = true;
      container.appendChild(div);
    });
  }

  function renderFilterOptions() {
    const { platforms, models } = PlatformCatalog.collectPaygFilterOptions(allRows);
    buildCheckboxItems(
      document.getElementById('paygVendorCheckboxes'),
      platforms,
      (p) => p.id,
      (p) => p.name,
      selectedPlatformIds
    );
    buildCheckboxItems(
      document.getElementById('paygModelCheckboxes'),
      models,
      (name) => name,
      (name) => name,
      selectedModelNames
    );
    updateCountBadges();
  }

  function clearFilters() {
    selectedPlatformIds.clear();
    selectedModelNames.clear();
    pricedOnly = false;
    sortKey = 'order';
    sortDir = 'asc';
    document.querySelectorAll('#paygVendorCheckboxes input, #paygModelCheckboxes input').forEach((input) => {
      input.checked = false;
    });
    const pricedEl = document.getElementById('paygPricedOnly');
    if (pricedEl) pricedEl.checked = false;
    closeAllDropdowns();
    applyAndRender();
  }

  function fillWatermark() {
    const host = typeof location !== 'undefined' ? location.host : '';
    document.querySelectorAll('#paygTableWatermark .table-watermark-line').forEach((el) => {
      el.textContent = host || 'codingplan';
    });
  }

  function bindEvents(root) {
    const scope = root || document;
    const vendorBtn = scope.querySelector('#paygVendorBtn') || document.getElementById('paygVendorBtn');
    const vendorMenu = scope.querySelector('#paygVendorDropdown') || document.getElementById('paygVendorDropdown');
    const modelBtn = scope.querySelector('#paygModelBtn') || document.getElementById('paygModelBtn');
    const modelMenu = scope.querySelector('#paygModelDropdown') || document.getElementById('paygModelDropdown');

    if (vendorBtn && vendorMenu) {
      vendorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(vendorBtn, vendorMenu);
      });
    }
    if (modelBtn && modelMenu) {
      modelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(modelBtn, modelMenu);
      });
    }

    document.getElementById('paygVendorDone')?.addEventListener('click', () => {
      applyAndRender();
      closeAllDropdowns();
    });
    document.getElementById('paygModelDone')?.addEventListener('click', () => {
      applyAndRender();
      closeAllDropdowns();
    });
    document.getElementById('paygVendorReset')?.addEventListener('click', () => {
      document.querySelectorAll('#paygVendorCheckboxes input').forEach((input) => {
        input.checked = false;
      });
      applyAndRender();
    });
    document.getElementById('paygModelReset')?.addEventListener('click', () => {
      document.querySelectorAll('#paygModelCheckboxes input').forEach((input) => {
        input.checked = false;
      });
      applyAndRender();
    });

    document.getElementById('paygPricedOnly')?.addEventListener('change', applyAndRender);
    document.getElementById('paygClearFilters')?.addEventListener('click', clearFilters);

    document.querySelectorAll('#paygTable th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-key');
        if (!key) return;
        if (sortKey === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDir = 'asc';
        }
        applyAndRender();
      });
    });

    if (!window.__paygDocClickBound) {
      window.__paygDocClickBound = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown')) {
          closeAllDropdowns();
        }
      });
      window.addEventListener('resize', updateStickyColumns);
    }
  }

  const PAYG_SHELL_HTML =
    `<p class="payg-intro">默认按模型顺序排列；可用平台 / 模型筛选，或只看已标价行。点表头可按输入 / 缓存 / 输出 / 评分排序。</p>` +
    `<div class="filter-bar surface-panel">` +
    `<div class="filter-dropdown"><button type="button" class="filter-btn" id="paygVendorBtn"><span>平台</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" id="paygVendorCount" style="display: none;">0</span></button><div class="dropdown-menu" id="paygVendorDropdown"><div class="dropdown-section"><div class="checkbox-group" id="paygVendorCheckboxes"></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" id="paygVendorReset">重置</button><button type="button" class="dropdown-btn primary" id="paygVendorDone">确定</button></div></div></div>` +
    `<div class="filter-dropdown"><button type="button" class="filter-btn" id="paygModelBtn"><span>模型</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" id="paygModelCount" style="display: none;">0</span></button><div class="dropdown-menu" id="paygModelDropdown"><div class="dropdown-section"><div class="checkbox-group" id="paygModelCheckboxes"></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" id="paygModelReset">重置</button><button type="button" class="dropdown-btn primary" id="paygModelDone">确定</button></div></div></div>` +
    `<div class="filter-checkbox"><label class="checkbox-label"><input type="checkbox" id="paygPricedOnly"><span class="checkbox-text">仅显示有标价</span></label></div>` +
    `<button type="button" class="reset-btn" id="paygClearFilters">重置筛选</button>` +
    `<div class="stats-bar">显示 <strong id="paygResultCount">0</strong> / <strong id="paygTotalCount">0</strong> 行</div></div>` +
    `<div class="table-wrapper surface-panel"><div class="table-watermark" id="paygTableWatermark" aria-hidden="true"><div class="table-watermark-line"></div><div class="table-watermark-line"></div><div class="table-watermark-line"></div></div>` +
    `<div class="table-scroll" id="paygTableScroll"><table id="paygTable"><thead><tr><th class="sticky-first">平台</th><th class="sticky-second">模型</th><th class="sortable" data-sort-key="input">输入</th><th class="sortable" data-sort-key="cache">缓存</th><th class="sortable" data-sort-key="output">输出</th><th>备注</th><th class="sortable" data-sort-key="rating">评分</th></tr></thead><tbody id="paygTableBody"><tr><td colspan="7"><div class="empty-state"><div class="empty-state-text">加载中…</div></div></td></tr></tbody></table></div></div>`;

  async function mountPaygView(root) {
    if (!root) return;
    if (root.dataset.paygMounted === '1') return;
    if (!root.querySelector('#paygTable')) {
      root.innerHTML = PAYG_SHELL_HTML;
    }
    fillWatermark();
    bindEvents(root);
    const tbody = document.getElementById('paygTableBody');
    try {
      const [platforms, paygPricing, plans] = await Promise.all([
        loadJson('./platforms.json'),
        loadJson('./payg-pricing.json'),
        loadJson('./plans.json').catch(() => [])
      ]);
      allRows = PlatformCatalog.flattenPaygRows(paygPricing, platforms, plans);
      renderFilterOptions();
      applyAndRender();
    } catch (error) {
      const message = PlatformCatalog.escapeHtml(String(error && error.message ? error.message : error));
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="7"><div class="empty-state">` +
          `<div class="empty-state-text">加载失败</div>` +
          `<div class="empty-state-hint">${message}</div>` +
          `</div></td></tr>`;
      }
    }
    root.dataset.paygMounted = '1';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const standaloneRoot = document.getElementById('paygPageRoot');
      if (!standaloneRoot) return;
      if (typeof renderPageNav === 'function') {
        renderPageNav('pageNavMount', {
          activeKey: 'payg',
          settings: {
            panelTitle: '显示设置',
            ultraWideLabel: '超宽屏模式'
          }
        });
      }
      void mountPaygView(standaloneRoot);
    });
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { mountPaygView };
  }
  if (typeof window !== 'undefined') {
    window.mountPaygView = mountPaygView;
  }
})();
