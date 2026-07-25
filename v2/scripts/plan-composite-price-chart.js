(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PlanCompositePriceChart = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_USD_TO_CNY_RATE = 6.8;
  const VENDOR_COLOR_PALETTE = [
    '#0f766e',
    '#173753',
    '#b45309',
    '#7c3aed',
    '#0369a1',
    '#be123c',
    '#047857',
    '#c2410c',
    '#4338ca',
    '#0e7490',
    '#a16207',
    '#9f1239',
    '#15803d',
    '#1d4ed8',
    '#86198f',
    '#0f172a'
  ];

  let chartInstance = null;
  let lastItems = [];

  function resolveUsdToCnyRate(rate) {
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
      ? rate
      : DEFAULT_USD_TO_CNY_RATE;
  }

  /** 与套餐表「每 M Token 综合价格」同口径：月费(人民币) / 实测月 Token(M) */
  function getPlanCompositePriceCny(plan, usdToCnyRate) {
    if (!plan || typeof plan !== 'object') return null;
    const monthly = plan.monthlyPrice;
    const limit = plan.measuredMonthlyTokenLimit;
    if (typeof monthly !== 'number' || !Number.isFinite(monthly)) return null;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return null;
    const rate = resolveUsdToCnyRate(usdToCnyRate);
    const cny = plan.currency === '$' ? monthly * rate : monthly;
    if (!Number.isFinite(cny) || cny < 0) return null;
    return cny / limit;
  }

  function buildVendorColorMap(vendors) {
    const unique = [];
    const seen = new Set();
    for (const raw of Array.isArray(vendors) ? vendors : []) {
      const vendor = String(raw == null ? '' : raw).trim();
      if (!vendor || seen.has(vendor)) continue;
      seen.add(vendor);
      unique.push(vendor);
    }
    unique.sort((a, b) => a.localeCompare(b, 'zh'));
    const map = new Map();
    unique.forEach((vendor, index) => {
      map.set(vendor, VENDOR_COLOR_PALETTE[index % VENDOR_COLOR_PALETTE.length]);
    });
    return map;
  }

  function formatCompositePriceLabel(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
    return `¥${value.toFixed(2)}`;
  }

  function buildAxisLabel(plan) {
    const vendor = String((plan && plan.vendor) || '').trim() || '未知平台';
    const name = String((plan && plan.plan) || '').trim() || '未知套餐';
    return `${vendor} ${name}`;
  }

  /**
   * 全部可计算综合价的套餐，按价格升序。
   * 不受表格筛选影响。
   */
  function buildCompositePriceChartItems(plans, options = {}) {
    const rate = resolveUsdToCnyRate(options.usdToCnyRate);
    const list = Array.isArray(plans) ? plans : [];
    const prepared = [];
    for (let i = 0; i < list.length; i++) {
      const plan = list[i];
      if (plan && plan.discontinued) continue;
      const price = getPlanCompositePriceCny(plan, rate);
      if (price == null) continue;
      prepared.push({
        vendor: String((plan && plan.vendor) || '').trim() || '未知平台',
        plan: String((plan && plan.plan) || '').trim() || '未知套餐',
        type: String((plan && plan.type) || 'Coding Plan').trim() || 'Coding Plan',
        discontinued: false,
        price,
        originalIndex: Number.isFinite(plan && plan.originalIndex)
          ? plan.originalIndex
          : i,
        axisLabel: buildAxisLabel(plan)
      });
    }
    const colorMap = buildVendorColorMap(prepared.map((item) => item.vendor));
    prepared.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      const byVendor = a.vendor.localeCompare(b.vendor, 'zh');
      if (byVendor !== 0) return byVendor;
      const byPlan = a.plan.localeCompare(b.plan, 'zh');
      if (byPlan !== 0) return byPlan;
      return a.originalIndex - b.originalIndex;
    });
    return prepared.map((item) => ({
      ...item,
      color: colorMap.get(item.vendor) || VENDOR_COLOR_PALETTE[0],
      label: formatCompositePriceLabel(item.price)
    }));
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getDomRefs() {
    return {
      panel: document.getElementById('planCompositePricePanel'),
      chartEl: document.getElementById('planCompositePriceChart'),
      emptyEl: document.getElementById('planCompositePriceEmpty'),
      countEl: document.getElementById('planCompositePriceCount')
    };
  }

  function ensureChart(chartEl) {
    if (!chartEl || typeof window === 'undefined' || !window.echarts) return null;
    if (!chartInstance) {
      chartInstance = window.echarts.init(chartEl, null, { renderer: 'canvas' });
    }
    return chartInstance;
  }

  function buildChartOption(items) {
    const categories = items.map((item) => item.axisLabel);
    const values = items.map((item) => ({
      value: item.price,
      vendor: item.vendor,
      plan: item.plan,
      type: item.type,
      discontinued: item.discontinued,
      itemStyle: {
        color: item.color,
        borderRadius: [8, 8, 0, 0]
      }
    }));
    return {
      animationDuration: 420,
      grid: {
        left: 58,
        right: 18,
        top: 36,
        bottom: 108
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 252, 246, 0.96)',
        borderColor: 'rgba(23, 32, 51, 0.08)',
        borderWidth: 1,
        textStyle: { color: '#172033' },
        formatter(params) {
          const data = (params && params.data) || {};
          const offline = data.discontinued
            ? '<div style="margin-top:4px;color:#9f1239;">已下线</div>'
            : '';
          return (
            `<div style="min-width:180px">` +
            `<div style="font-size:14px;font-weight:800;margin-bottom:6px;">${escapeHtml(data.vendor)} · ${escapeHtml(data.plan)}</div>` +
            `<div style="color:#425065;margin-bottom:4px;">${escapeHtml(data.type || '')}</div>` +
            `<div>每 M Token 综合价格：<strong>${escapeHtml(formatCompositePriceLabel(data.value))}</strong></div>` +
            offline +
            `</div>`
          );
        }
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: 'rgba(23, 32, 51, 0.18)' } },
        axisLabel: {
          interval: 0,
          rotate: 60,
          hideOverlap: false,
          color: '#425065',
          fontSize: 10,
          lineHeight: 13
        }
      },
      yAxis: {
        type: 'value',
        name: '¥ / M',
        nameTextStyle: { color: '#64748b', fontSize: 12, padding: [0, 0, 0, 8] },
        axisLabel: {
          color: '#64748b',
          formatter(value) {
            return Number(value).toFixed(2);
          }
        },
        splitLine: { lineStyle: { color: 'rgba(23, 32, 51, 0.08)' } }
      },
      series: [
        {
          type: 'bar',
          name: '每 M Token 综合价格',
          data: values,
          barMaxWidth: 44,
          label: {
            show: true,
            position: 'top',
            distance: 4,
            color: '#334155',
            fontSize: 10,
            fontWeight: 600,
            formatter(params) {
              return formatCompositePriceLabel(params.value);
            }
          }
        }
      ]
    };
  }

  function updateMeta(countEl, emptyEl, chartEl, count) {
    if (countEl) countEl.textContent = String(count);
    if (emptyEl) emptyEl.hidden = count > 0;
    if (chartEl) chartEl.hidden = count === 0;
  }

  function sizeChartCanvas(chartEl, itemCount) {
    if (!chartEl) return;
    const host = chartEl.parentElement;
    const hostWidth = host && host.clientWidth ? host.clientWidth : 0;
    const needed = Math.max(hostWidth, itemCount * 56 + 80);
    chartEl.style.width = `${needed}px`;
  }

  function renderPlanCompositePriceChart(plans, options = {}) {
    const refs = typeof document !== 'undefined' ? getDomRefs() : {};
    const items = buildCompositePriceChartItems(plans, options);
    lastItems = items;

    if (refs.countEl || refs.emptyEl || refs.chartEl) {
      updateMeta(refs.countEl, refs.emptyEl, refs.chartEl, items.length);
    }
    if (!refs.chartEl || items.length === 0) {
      if (chartInstance) {
        chartInstance.clear();
      }
      return items;
    }
    if (refs.panel) refs.panel.hidden = false;

    sizeChartCanvas(refs.chartEl, items.length);
    const chart = ensureChart(refs.chartEl);
    if (!chart) return items;
    chart.setOption(buildChartOption(items), true);
    requestAnimationFrame(() => {
      try {
        chart.resize();
      } catch (_) {
        /* ignore */
      }
    });
    return items;
  }

  function resizePlanCompositePriceChart() {
    if (!chartInstance) return;
    try {
      const refs = getDomRefs();
      if (refs.chartEl && lastItems.length) {
        sizeChartCanvas(refs.chartEl, lastItems.length);
      }
      chartInstance.resize();
    } catch (_) {
      /* ignore */
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizePlanCompositePriceChart);
  }

  return {
    DEFAULT_USD_TO_CNY_RATE,
    VENDOR_COLOR_PALETTE,
    resolveUsdToCnyRate,
    getPlanCompositePriceCny,
    buildVendorColorMap,
    buildCompositePriceChartItems,
    formatCompositePriceLabel,
    renderPlanCompositePriceChart,
    resizePlanCompositePriceChart,
    /** @deprecated alias */
    getLastItems() {
      return lastItems.slice();
    }
  };
});
