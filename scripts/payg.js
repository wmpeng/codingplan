(function () {
  'use strict';

  let allRows = [];
  let sortKey = 'input';
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

  function readCheckedValues(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(
      (input) => input.value
    );
  }

  function syncSelectionFromDom() {
    selectedPlatformIds.clear();
    selectedModelNames.clear();
    readCheckedValues(document.getElementById('paygPlatformFilters')).forEach((id) => {
      selectedPlatformIds.add(id);
    });
    readCheckedValues(document.getElementById('paygModelFilters')).forEach((name) => {
      selectedModelNames.add(name);
    });
    const pricedEl = document.getElementById('paygPricedOnly');
    pricedOnly = !!(pricedEl && pricedEl.checked);
  }

  function updateSortButtons() {
    document.querySelectorAll('.payg-sort-btn').forEach((btn) => {
      const key = btn.getAttribute('data-sort-key');
      const active = key === sortKey;
      btn.setAttribute('data-active', active ? 'true' : 'false');
      btn.setAttribute('data-dir', active ? sortDir : '');
    });
  }

  function renderBody(rows) {
    const tbody = document.getElementById('paygTableBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="payg-empty">无匹配行</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const name = PlatformCatalog.escapeHtml(row.platformName);
        const link = row.action
          ? `<a class="payg-platform-link" href="${PlatformCatalog.escapeHtml(row.action)}" target="_blank" rel="noopener noreferrer">${name}</a>`
          : `<span>${name}</span>`;
        const notes = (row.notes || [])
          .map((n) => PlatformCatalog.escapeHtml(n))
          .join('；');
        const currency = row.currency || '¥';
        return (
          `<tr>` +
          `<td class="payg-col-platform">${link}</td>` +
          `<td>${PlatformCatalog.escapeHtml(row.modelName)}</td>` +
          `<td>${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.input, currency))}</td>` +
          `<td>${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.cache, currency))}</td>` +
          `<td>${PlatformCatalog.escapeHtml(PlatformCatalog.formatPaygPrice(row.output, currency))}</td>` +
          `<td class="payg-col-notes">${notes || '—'}</td>` +
          `<td>${PlatformCatalog.escapeHtml(String(row.rating ?? ''))}</td>` +
          `</tr>`
        );
      })
      .join('');
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
    if (countEl) countEl.textContent = String(sorted.length);
    updateSortButtons();
  }

  function renderFilterOptions() {
    const { platforms, models } = PlatformCatalog.collectPaygFilterOptions(allRows);
    const platformBox = document.getElementById('paygPlatformFilters');
    const modelBox = document.getElementById('paygModelFilters');
    if (platformBox) {
      platformBox.innerHTML = platforms
        .map(
          (p) =>
            `<label class="payg-filter-chip"><input type="checkbox" value="${PlatformCatalog.escapeHtml(p.id)}"><span>${PlatformCatalog.escapeHtml(p.name)}</span></label>`
        )
        .join('');
    }
    if (modelBox) {
      modelBox.innerHTML = models
        .map(
          (name) =>
            `<label class="payg-filter-chip"><input type="checkbox" value="${PlatformCatalog.escapeHtml(name)}"><span>${PlatformCatalog.escapeHtml(name)}</span></label>`
        )
        .join('');
    }
  }

  function clearFilters() {
    selectedPlatformIds.clear();
    selectedModelNames.clear();
    pricedOnly = false;
    sortKey = 'input';
    sortDir = 'asc';
    document.querySelectorAll('#paygPlatformFilters input, #paygModelFilters input').forEach((input) => {
      input.checked = false;
    });
    const pricedEl = document.getElementById('paygPricedOnly');
    if (pricedEl) pricedEl.checked = false;
    applyAndRender();
  }

  function bindEvents() {
    const platformBox = document.getElementById('paygPlatformFilters');
    const modelBox = document.getElementById('paygModelFilters');
    if (platformBox) platformBox.addEventListener('change', applyAndRender);
    if (modelBox) modelBox.addEventListener('change', applyAndRender);

    const pricedEl = document.getElementById('paygPricedOnly');
    if (pricedEl) pricedEl.addEventListener('change', applyAndRender);

    const clearBtn = document.getElementById('paygClearFilters');
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    document.querySelectorAll('.payg-sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-sort-key');
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
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof renderPageNav === 'function') {
      renderPageNav('pageNavMount', {
        activeKey: 'payg',
        settings: {
          panelTitle: '显示设置',
          ultraWideLabel: '超宽屏模式'
        }
      });
    }

    bindEvents();

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
        tbody.innerHTML = `<tr><td colspan="7" class="payg-empty">加载失败：${message}</td></tr>`;
      }
    }
  });
})();
