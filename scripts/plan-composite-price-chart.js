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
  let renderGeneration = 0;
  let echartsLoadPromise = null;

  const ECHARTS_SRC = 'vendor/echarts.min.js?v=5.6.0';
  const EMPTY_NO_DATA = '暂无足够的月费与实测 Token 数据，无法绘制综合价格图。';
  const EMPTY_LOADING = '图表库加载中…';
  const EMPTY_FAILED = '图表库加载失败，其它内容不受影响。可刷新重试。';

  function resolveUsdToCnyRate(rate) {
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
      ? rate
      : DEFAULT_USD_TO_CNY_RATE;
  }

  /** 与套餐表「综合单价」同口径：月费(人民币) / 实测月 Token(M) */
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
    return `￥${value.toFixed(2)}`;
  }

  function buildAxisLabel(plan) {
    const platformName = String((plan && plan.platformName) || '').trim() || '未知平台';
    const planName = String((plan && plan.name) || '').trim() || '未知套餐';
    return `${platformName} ${planName}`;
  }

  const PIN_BOOKMARK_ICON =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 14">' +
        '<path fill="#b45309" d="M2.2 1.2h7.6c.55 0 1 .45 1 1V12.4c0 .4-.44.64-.78.43L6 10.05 2.98 12.83c-.34.21-.78-.03-.78-.43V2.2c0-.55.45-1 1-1z"/>' +
        '</svg>'
    );

  /**
   * 可计算综合价的套餐，按价格升序。
   * 是否包含某条由调用方传入的 plans 决定（可与筛选/pin 结果对齐）。
   * options.isPinned(plan) 为真时标记 pinned，仅影响展示，不改变排序。
   */
  function buildCompositePriceChartItems(plans, options = {}) {
    const rate = resolveUsdToCnyRate(options.usdToCnyRate);
    const isPinned =
      typeof options.isPinned === 'function' ? options.isPinned : () => false;
    const list = Array.isArray(plans) ? plans : [];
    const prepared = [];
    for (let i = 0; i < list.length; i++) {
      const plan = list[i];
      const price = getPlanCompositePriceCny(plan, rate);
      if (price == null) continue;
      prepared.push({
        platformName: String((plan && plan.platformName) || '').trim() || '未知平台',
        planName: String((plan && plan.name) || '').trim() || '未知套餐',
        type: String((plan && plan.type) || 'Coding Plan').trim() || 'Coding Plan',
        discontinued: !!(plan && plan.discontinued),
        pinned: !!isPinned(plan),
        price,
        originalIndex: Number.isFinite(plan && plan.originalIndex)
          ? plan.originalIndex
          : i,
        axisLabel: buildAxisLabel(plan)
      });
    }
    const colorMap = buildVendorColorMap(prepared.map((item) => item.platformName));
    prepared.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      const byVendor = a.platformName.localeCompare(b.platformName, 'zh');
      if (byVendor !== 0) return byVendor;
      const byPlan = a.planName.localeCompare(b.planName, 'zh');
      if (byPlan !== 0) return byPlan;
      return a.originalIndex - b.originalIndex;
    });
    return prepared.map((item) => ({
      ...item,
      color: colorMap.get(item.platformName) || VENDOR_COLOR_PALETTE[0],
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
      emptyEl: document.getElementById('planCompositePriceEmpty')
    };
  }

  function ensureChart(chartEl) {
    if (!chartEl || typeof window === 'undefined' || !window.echarts) return null;
    if (!chartInstance) {
      chartInstance = window.echarts.init(chartEl, null, { renderer: 'canvas' });
    }
    return chartInstance;
  }

  function loadEchartsLibrary() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('no window'));
    }
    if (window.echarts) {
      return Promise.resolve(window.echarts);
    }
    if (echartsLoadPromise) {
      return echartsLoadPromise;
    }
    echartsLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-echarts-vendor="1"]');
      const settle = () => {
        if (window.echarts) {
          resolve(window.echarts);
          return;
        }
        echartsLoadPromise = null;
        reject(new Error('echarts global missing after script load'));
      };
      if (existing) {
        if (existing.dataset.loaded === '1') {
          settle();
          return;
        }
        existing.addEventListener(
          'load',
          () => {
            existing.dataset.loaded = '1';
            settle();
          },
          { once: true }
        );
        existing.addEventListener(
          'error',
          () => {
            echartsLoadPromise = null;
            reject(new Error('Failed to load echarts'));
          },
          { once: true }
        );
        return;
      }
      const script = document.createElement('script');
      script.src = ECHARTS_SRC;
      script.async = true;
      script.dataset.echartsVendor = '1';
      script.onload = () => {
        script.dataset.loaded = '1';
        settle();
      };
      script.onerror = () => {
        echartsLoadPromise = null;
        reject(new Error('Failed to load echarts'));
      };
      document.head.appendChild(script);
    });
    return echartsLoadPromise;
  }

  function setEmptyState(refs, visible, message) {
    if (!refs.emptyEl) return;
    refs.emptyEl.hidden = !visible;
    if (visible && message) {
      refs.emptyEl.textContent = message;
    }
  }

  function paintChart(items) {
    const refs = typeof document !== 'undefined' ? getDomRefs() : {};
    if (!refs.chartEl || !items.length) return false;
    if (refs.panel) refs.panel.hidden = false;
    sizeChartCanvas(refs.chartEl, items.length);
    const chart = ensureChart(refs.chartEl);
    if (!chart) return false;
    setEmptyState(refs, false, EMPTY_NO_DATA);
    refs.chartEl.hidden = false;
    chart.setOption(buildChartOption(items), true);
    requestAnimationFrame(() => {
      try {
        chart.resize();
      } catch (_) {
        /* ignore */
      }
    });
    return true;
  }

  function buildChartOption(items) {
    const categories = items.map((item) => item.axisLabel);
    const values = items.map((item) => ({
      value: item.price,
      platformName: item.platformName,
      planName: item.planName,
      type: item.type,
      discontinued: item.discontinued,
      pinned: item.pinned,
      itemStyle: {
        color: item.color,
        borderRadius: [4, 4, 0, 0]
      }
    }));
    return {
      animationDuration: 420,
      grid: {
        left: 48,
        right: 14,
        top: 36,
        bottom: 92
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
          const pinned = data.pinned
            ? '<div style="margin-top:4px;color:#b45309;">已固定</div>'
            : '';
          return (
            `<div style="min-width:180px">` +
            `<div style="font-size:14px;font-weight:800;margin-bottom:6px;">${escapeHtml(data.platformName)} · ${escapeHtml(data.planName)}</div>` +
            `<div style="color:#425065;margin-bottom:4px;">${escapeHtml(data.type || '')}</div>` +
            `<div>综合单价：<strong>${escapeHtml(formatCompositePriceLabel(data.value))}/M Token</strong></div>` +
            pinned +
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
          lineHeight: 13,
          formatter(value, index) {
            const item = items[index];
            if (item && item.pinned) {
              return '{pin|}{lbl|' + value + '}';
            }
            return value;
          },
          rich: {
            pin: {
              width: 10,
              height: 12,
              backgroundColor: {
                image: PIN_BOOKMARK_ICON
              },
              align: 'center',
              padding: [0, 2, 0, 0]
            },
            lbl: {
              color: '#425065',
              fontSize: 10,
              lineHeight: 13
            }
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '￥/ M Token',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: '#64748b', fontSize: 11, align: 'left', padding: [0, 0, 0, 0] },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter(value) {
            return Number(value).toFixed(2);
          }
        },
        splitLine: { lineStyle: { color: 'rgba(23, 32, 51, 0.08)' } }
      },
      series: [
        {
          type: 'bar',
          name: '综合单价',
          data: values,
          barMaxWidth: 22,
          label: {
            show: true,
            position: 'top',
            distance: 4,
            color: '#334155',
            fontSize: 9,
            fontWeight: 600,
            formatter(params) {
              return formatCompositePriceLabel(params.value);
            }
          }
        }
      ]
    };
  }

  function sizeChartCanvas(chartEl, itemCount) {
    if (!chartEl) return;
    const host = chartEl.parentElement;
    const hostWidth = host && host.clientWidth ? host.clientWidth : 0;
    const needed = Math.max(hostWidth, itemCount * 28 + 48);
    chartEl.style.width = `${needed}px`;
  }

  function renderPlanCompositePriceChart(plans, options = {}) {
    const refs = typeof document !== 'undefined' ? getDomRefs() : {};
    const items = buildCompositePriceChartItems(plans, options);
    lastItems = items;
    const generation = ++renderGeneration;

    if (!refs.chartEl || items.length === 0) {
      if (chartInstance) {
        chartInstance.clear();
      }
      if (refs.chartEl) refs.chartEl.hidden = true;
      setEmptyState(refs, true, EMPTY_NO_DATA);
      return items;
    }

    if (refs.panel) refs.panel.hidden = false;

    if (typeof window !== 'undefined' && window.echarts) {
      paintChart(items);
      return items;
    }

    setEmptyState(refs, true, EMPTY_LOADING);
    refs.chartEl.hidden = true;

    loadEchartsLibrary()
      .then(() => {
        if (generation !== renderGeneration) return;
        if (!lastItems.length) {
          setEmptyState(refs, true, EMPTY_NO_DATA);
          return;
        }
        paintChart(lastItems);
      })
      .catch((error) => {
        if (generation !== renderGeneration) return;
        console.warn('ECharts load failed:', error);
        setEmptyState(getDomRefs(), true, EMPTY_FAILED);
        const chartEl = document.getElementById('planCompositePriceChart');
        if (chartEl) chartEl.hidden = true;
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
    ECHARTS_SRC,
    resolveUsdToCnyRate,
    getPlanCompositePriceCny,
    buildVendorColorMap,
    buildCompositePriceChartItems,
    formatCompositePriceLabel,
    loadEchartsLibrary,
    renderPlanCompositePriceChart,
    resizePlanCompositePriceChart,
    /** @deprecated alias */
    getLastItems() {
      return lastItems.slice();
    }
  };
});
