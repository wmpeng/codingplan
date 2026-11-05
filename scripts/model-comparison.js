// Full pricing charts and interactions; the homepage uses only the shared core.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ModelComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const Core = root.ModelComparisonCore || require('./model-comparison-core.js');
    const UI = root.CodingPlanUI || require('./ui-core.js');
    const Numbers = root.NumberDisplay || require('./number-display.js');
    const Scores = root.BenchmarkScores || require('./benchmark-scores.js');
    const PriceChart = root.ModelPriceChart || require('./model-price-chart.js');
    const {
        BENCHMARKS, COMPARISON_TABLE_COLUMNS, escapeHtml, getPointPlatformKey, createDefaultFilterState,
        filterPoints, buildUsageChartPoints, buildIntelligenceChartPoints, buildUnitPriceVisualScale,
        buildUsageAttractiveZone, buildUsageAttractiveZoneSeries, buildVendorColorMap,
        buildModelColorMap, getPointColorKey, filterBySelectedColorKeys, getSoloPointLabelField,
        getPointLabelText, formatNumber, normalizeTokenUnit, tokenAmountInUnit, sortComparisonRows,
        comparisonTableColumns, unitPriceVisualHtml, comparisonTableRowHtml,
        normalizePresetPlatformScope, renderPresetComparisons, tooltipHtml, comparisonTableHtml
    } = Core;

    async function loadPresetConfig() {
        try {
            return await root.CodingPlanToolPage.loadPreset();
        } catch (error) {
            console.warn('常见对比配置加载失败:', error);
            return { groups: [] };
        }
    }

    function loadEcharts() {
        if (root.echarts) return Promise.resolve(root.echarts);
        if (root.__usageEchartsPromise) return root.__usageEchartsPromise;
        root.__usageEchartsPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-usage-echarts="1"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(root.echarts), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = '/vendor/echarts.min.js';
            script.dataset.usageEcharts = '1';
            script.onload = () => resolve(root.echarts);
            script.onerror = () => reject(new Error('ECharts 加载失败'));
            document.head.appendChild(script);
        });
        return root.__usageEchartsPromise;
    }

    function renderShell(container, compact, methodHost) {
        if (methodHost) methodHost.innerHTML = `<strong>统一口径：</strong>价格筛选和坐标统一按折合人民币计算，美元按当前站点汇率 USD 1 ≈ ¥${formatNumber(Number(root.appConfig && root.appConfig.usdToCnyRate) || 6.8, 2)}；表格保留原始币种。参考额度分别来自真实使用记录、官方 Token 额度、按扣减价格计算、请求估算或倍率换算，估算依据见备注。按价格计算时统一假设95%缓存命中率和0.5%的输出占比，未知额度不等于零。`;
        container.innerHTML = `
            <section class="usage-view" aria-labelledby="usageViewTitle">
                <header class="usage-heading">
                    <div><p class="usage-eyebrow">模型购买决策</p><h2 id="usageViewTitle">价格与额度</h2></div>
                    <p>把同一套餐下的不同模型拆成独立点，比较钱花在哪里、实际能换来多少额度和模型能力。 <a class="main-view-full-link" href="/pricing/">查看完整价格与额度 →</a></p>
                </header>

                <section class="usage-presets" data-presets aria-label="常见模型对比" hidden></section>
                <div class="usage-explorer-heading"><h3>完整对比</h3><p>使用筛选、图表与数据明细继续探索全部套餐和模型。</p></div>
                <div class="filter-bar surface-panel usage-filters" aria-label="图表筛选"${compact ? ' hidden' : ''}>
                    <div class="usage-color-control" aria-label="颜色区分方式"><span>颜色</span><div class="usage-segments" role="group" aria-label="颜色区分方式"><button type="button" data-color-mode="vendor" class="is-active" aria-pressed="true">按平台</button><button type="button" data-color-mode="model" aria-pressed="false">按模型</button></div></div>
                    <div class="usage-benchmark-control"><span>评分</span><div class="usage-segments" role="group" aria-label="评分指标">${Scores.keys.map((key,index) => `<button type="button" data-benchmark="${key}" class="${index === 0 ? 'is-active' : ''}" aria-pressed="${index === 0}">${BENCHMARKS[key].label}</button>`).join('')}</div></div>
                    <div class="price-billing-filter"><span>计费方式</span><div class="usage-segments" role="group" aria-label="计费方式"><button type="button" data-chart-billing="all" class="is-active" aria-pressed="true">全部</button><button type="button" data-chart-billing="subscription" aria-pressed="false">订阅</button><button type="button" data-chart-billing="payg" aria-pressed="false">按量 API</button></div></div>
                    <div class="usage-scale-control"><span>坐标轴</span><div class="usage-segments" data-scale="page" role="group" aria-label="坐标轴"><button type="button" data-scale-value="log" class="is-active" aria-pressed="true">对数</button><button type="button" data-scale-value="value" aria-pressed="false">线性</button></div></div>
                </div>
                <section class="pricing-chart-group" aria-label="价格与额度图表">
                <div class="tool-legend"><div class="usage-color-legend"><div data-color-legend></div></div></div>
                <article class="usage-chart-card price-intelligence-card">
                    <div class="usage-chart-head"><div><h3>模型能力与价格</h3><p>越靠左，综合单价越低；越靠上，模型评分越高。</p></div><button type="button" class="tool-button price-chart-export" data-chart-export>保存图表 ↓</button></div>
                    <div class="price-chart-key"><span class="price-chart-frontier" title="当前筛选下，不存在另一个价格不高、评分不低且至少一项更好的方案。仅比较综合单价与评分。">价格—能力优势前沿</span></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="intelligence" role="img" aria-label="模型能力和综合单价散点图"></div><div class="usage-empty" data-empty="intelligence" hidden>当前条件下没有可绘制的评分与价格；请调整上方筛选、计费方式或价格轴。</div></div>
                    <div class="price-chart-meta" data-chart-meta aria-live="polite"></div>
                    <div class="price-chart-detail" data-chart-detail></div>
                    <p class="price-chart-method">综合单价按全站显示设置的首月／每月价格口径计算，订阅按参考额度折算，不代表固定任务成本。<a href="/pricing/#pricingMethod">查看价格与用量口径</a></p>
                </article>
                <article class="usage-chart-card" data-usage-card>
                    <div class="usage-chart-head"><div><h3>首月价格 vs 月 Token</h3><p>一个点代表一个平台 × 套餐 × 模型；越靠左上越有吸引力。</p></div></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="usage" role="img" aria-label="首月价格和月 Token 散点图"></div><div class="usage-empty" data-empty="usage" hidden>当前条件下没有可绘制的首月价格与月额度。<button type="button" class="price-chart-clear" data-chart-reset>重置筛选</button></div></div>
                </article>
                </section>
                <article class="usage-chart-card usage-data-card">
                    <div class="usage-chart-head">${compact ? '' : '<div class="usage-detail-summary"><span class="usage-table-count" data-table-count="comparison"></span></div>'}</div>
                    ${comparisonTableHtml(compact)}
                </article>
            </section>`;
    }

    function chartBase(tooltipFormatter) {
        return {
            animation: !(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches),
            animationDuration: 250,
            grid: { left: 76, right: 28, top: 28, bottom: 58, containLabel: false },
            tooltip: { trigger: 'item', confine: true, appendToBody: false, formatter: tooltipFormatter },
            textStyle: { fontFamily: '"Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' }
        };
    }

    function mountStickyLegend(container) {
        const legend = container.querySelector('.pricing-chart-group > .tool-legend');
        const header = document.querySelector('.site-header');
        const filters = document.getElementById('toolFilters');
        let frame = 0;
        function update() {
            frame = 0;
            const top = Math.max(0, header?.getBoundingClientRect().bottom || 0,
                filters?.classList.contains('directory-filters-stuck') ? filters.getBoundingClientRect().bottom : 0) + 8;
            legend.style.setProperty('--chart-legend-top', `${top}px`);
            // A fully expanded model list must remain readable on short screens.
            const available = (root.visualViewport?.height || root.innerHeight) - top - legend.getBoundingClientRect().height;
            legend.classList.toggle('is-sticky', available >= 160);
            legend.classList.toggle('is-docked', available >= 160 && legend.getBoundingClientRect().top <= top + 1);
        }
        function schedule() {
            if (!frame) frame = root.requestAnimationFrame(update);
        }
        root.addEventListener('scroll', schedule, {passive:true});
        root.addEventListener('resize', schedule);
        root.visualViewport?.addEventListener('resize', schedule);
        const observer = new root.ResizeObserver(schedule);
        [legend, header, filters].filter(Boolean).forEach(element => observer.observe(element));
        if (filters) new root.MutationObserver(schedule).observe(filters, {attributes:true, attributeFilter:['class']});
        update();
    }

    function seriesByColor(points, colorMode, colors, mapPoint, seriesPrefix, pointLabelField) {
        const grouped = new Map();
        points.forEach((point) => {
            const key = getPointColorKey(point, colorMode);
            const label = colorMode === 'model' ? point.modelName : getPointLabelText(point, 'vendor');
            if (!grouped.has(key)) grouped.set(key, { label, data: [] });
            grouped.get(key).data.push(mapPoint(point));
        });
        return [...grouped.entries()].map(([key, group]) => ({
            id: `${seriesPrefix}:${key}`, name: group.label, type: 'scatter', symbolSize: 11, data: group.data,
            itemStyle: { color: colors[key], opacity: 0.82, borderColor: '#fff', borderWidth: 1 },
            emphasis: {
                focus: 'series', blurScope: 'coordinateSystem', scale: 1.5,
                itemStyle: { opacity: 1, borderWidth: 2 }
            },
            blur: { itemStyle: { opacity: 0.1 } },
            label: {
                show: Boolean(pointLabelField), position: 'right', distance: 6,
                color: '#475569', fontSize: 11,
                formatter: (params) => getPointLabelText(params.data.meta, pointLabelField)
            },
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' }
        }));
    }

    function enableClickPinnedTooltip(chart) {
        chart.on('click', (params) => {
            if (params.componentType !== 'series') return;
            chart.setOption({ tooltip: { alwaysShowContent: true } });
            chart.dispatchAction({
                type: 'showTip',
                seriesIndex: params.seriesIndex,
                dataIndex: params.dataIndex
            });
        });
        chart.getZr().on('click', (event) => {
            if (event.target) return;
            chart.setOption({ tooltip: { alwaysShowContent: false } });
            chart.dispatchAction({ type: 'hideTip' });
        });
    }

    async function mountModelComparisonView(container, options) {
        if (!container) return;
        if (container.__usageMounted) {
            requestAnimationFrame(() => {
                container.__usageCharts && container.__usageCharts.forEach((chart) => chart.resize());
            });
            return;
        }
        if (container.__usageMountPromise) return container.__usageMountPromise;
        const mountOptions = options || {};
        const snapshotKind = container.getAttribute('data-static-content');
        const snapshotHtml = snapshotKind ? container.innerHTML : null;
        container.__usageMountPromise = (async () => {
            const Directory = mountOptions.directory;
            container.classList.toggle('pricing-directory', Boolean(Directory));
            const [echarts, data, presetConfig] = await Promise.all([
                loadEcharts(),
                mountOptions.data || root.CodingPlanToolPage.load(),
                mountOptions.preset || loadPresetConfig()
            ]);
            root.StaticContent?.ready(container);
            renderShell(container, Boolean(Directory), mountOptions.methodHost);
            const context = data.context;
            context.modelGroups = presetConfig.groups || [];
            const rate = root.appConfig && root.appConfig.usdToCnyRate || 6.8;
            const originalPoints = root.EntityData.buildComparisonPoints(context, rate, { includeUnknown: true });
            let priceBasis = root.EntityData.displayPriceBasis();
            let points = root.EntityData.withComparisonPriceBasis(originalPoints,context,priceBasis);
            let pins = Directory ? Directory.readPins(root.localStorage, points) : [];
            let tableRenderKey = '', tableScaleType = null, selectionKey = '', pageIndex = 0;
            let featuredPointSlugs = new Set(), featuredStyleKey = '';
            const search = mountOptions.search;
            let renderFrame = 0;
            const platformMap = new Map();
            points.forEach((point) => {
                platformMap.set(getPointPlatformKey(point), point.platformName);
            });
            const platforms = [...platformMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
            const modelMap = new Map();
            points.forEach((point) => modelMap.set(point.modelSlug, point.modelName));
            const models = UI.prioritizeFeaturedModels([...modelMap.entries()]
                .map(([slug, name]) => ({slug, name})).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), context.modelGroups)
                .map(model => [model.slug, model.name]);
            const platformColors = buildVendorColorMap(platforms.map(([key]) => key));
            const modelColors = buildModelColorMap(models.map(([id]) => id));
            const focusRelationSlugs = new Set(mountOptions.focusRelationSlugs || []);
            container.classList.toggle('is-full-tool', mountOptions.mode === 'full');
            const state = Object.assign(createDefaultFilterState(points, mountOptions), {
                benchmark: 'artificialAnalysis', colorMode: 'vendor',
                axisScale: 'log', presetPlatformScope: 'featured',
                chartBilling: 'all', selectedChartSlug: null,
                tokenUnit: root.CodingPlanDisplaySettings?.getTokenUnit() || 'yi'
            });
            const colorControl = container.querySelector('.usage-color-control');
            if (mountOptions.colorControlHost) mountOptions.colorControlHost.append(colorControl);
            function onColorModeClick(event) {
                const button = event.target.closest('[data-color-mode]');
                if (!button || state.colorMode === button.dataset.colorMode) return;
                state.colorMode = button.dataset.colorMode;
                state.selectedColorKeys.clear();
                render();
            }
            colorControl.addEventListener('click', onColorModeClick);
            const benchmarkControl = container.querySelector('.usage-benchmark-control');
            if (mountOptions.benchmarkControlHost) mountOptions.benchmarkControlHost.append(benchmarkControl);
            function onBenchmarkClick(event) {
                const button = event.target.closest('[data-benchmark]');
                if (!button || state.benchmark === button.dataset.benchmark) return;
                state.benchmark = button.dataset.benchmark;
                if (Scores.keys.includes(tableSortState.comparison.key)) tableSortState.comparison.key = state.benchmark;
                render();
            }
            benchmarkControl.addEventListener('click', onBenchmarkClick);
            const billingControl = container.querySelector('.price-billing-filter');
            if (mountOptions.billingControlHost) mountOptions.billingControlHost.append(billingControl);
            function onBillingClick(event) {
                const button = event.target.closest('[data-chart-billing]');
                if (!button || state.featuredOnly || state.chartBilling === button.dataset.chartBilling) return;
                state.chartBilling = button.dataset.chartBilling;
                render();
            }
            billingControl.addEventListener('click', onBillingClick);
            const scaleControl = container.querySelector('.usage-scale-control');
            if (mountOptions.scaleControlHost) mountOptions.scaleControlHost.append(scaleControl);
            function onAxisScaleClick(event) {
                const button = event.target.closest('[data-scale-value]');
                if (!button || state.axisScale === button.dataset.scaleValue) return;
                state.axisScale = button.dataset.scaleValue;
                render();
            }
            scaleControl.addEventListener('click', onAxisScaleClick);
            const usageChart = echarts.init(container.querySelector('[data-chart="usage"]'));
            const intelligenceChart = echarts.init(container.querySelector('[data-chart="intelligence"]'));
            enableClickPinnedTooltip(usageChart);

            container.__usageCharts = [usageChart, intelligenceChart];
            const tableSortState = {
                comparison: { key: 'unitPriceCnyPerM', direction: 'asc' }
            };
            const Url = root.CodingPlanFilterUrl;
            const sortableKeys = COMPARISON_TABLE_COLUMNS.filter(column => column.sortable !== false).map(column => column.key);
            const urlSchema = Directory && {
                query:Url.text('q'), key:Url.choice('sort', sortableKeys, 'unitPriceCnyPerM'),
                direction:Url.choice('direction', ['asc','desc'], 'asc'),
                benchmark:Url.choice('benchmark', Scores.keys, 'artificialAnalysis'),
                colorMode:Url.choice('color', ['vendor','model'], 'vendor'),
                axisScale:Url.choice('scale', ['log','value'], 'log'),
                chartBilling:Url.choice('chartBilling', ['all','subscription','payg'], 'all'),
                extraColumns:Url.flag('extraColumns')
            };
            if (Directory) {
                const saved = Url.read(urlSchema);
                search.value = saved.query || '';
                state.benchmark = saved.benchmark || (Scores.keys.includes(saved.key) ? saved.key : 'artificialAnalysis');
                state.chartBilling = saved.chartBilling || 'all';
                mountOptions.columns.checked = saved.extraColumns === true || ['fiveHourTokenInM','weeklyTokenInM'].includes(saved.key);
                container.classList.toggle('show-all-columns', mountOptions.columns.checked);
                state.colorMode = saved.colorMode || 'vendor';
                state.axisScale = saved.axisScale || 'log';
                const requestedSort = new URLSearchParams(root.location.search).get('sort');
                const validSort = requestedSort === null || sortableKeys.includes(requestedSort);
                tableSortState.comparison = {key:saved.key || 'unitPriceCnyPerM', direction:validSort ? saved.direction || 'asc' : 'asc'};
                if (Scores.keys.includes(tableSortState.comparison.key)) tableSortState.comparison.key = state.benchmark;
            }
            const latestTableRows = { comparison: [] };
            let renderedPresetKey = null;
            let latestPriceGroups = [];

            function applyExternalFilter(external) {
                const view = mountOptions.getFilterView?.();
                // Only annotate rows; reuse the existing featured projection without changing selection or order.
                const styleKey = JSON.stringify(view?.featuredState);
                if (Directory && styleKey !== featuredStyleKey) {
                    featuredStyleKey = styleKey;
                    featuredPointSlugs = new Set(view?.featuredState
                        ? root.CodingPlanFilters.filterPoints(points, view.featuredState, {context, usdToCnyRate:rate}).map(point => point.slug) : []);
                }
                if (view) external = view.state;
                state.featuredOnly = view?.featuredOnly === true;
                if (!external) return;
                state.platforms = external.platformSlugs === null
                    ? new Set(platforms.map(([key]) => key))
                    : new Set(external.platformSlugs || []);
                state.models = external.modelSlugs === null
                    ? new Set(models.map(([key]) => key))
                    : new Set(external.modelSlugs || []);
                state.platformsSpecified = true;
                state.modelsSpecified = true;
                state.modelMatch = external.modelSlugs !== null && external.modelMatch === 'all' ? 'all' : 'any';
                state.includeDiscontinued = external.includeDiscontinued === true;
                state.multimodal = external.multimodal || 'all';
                state.aaScoreMin = external.aaScoreMin == null ? '' : external.aaScoreMin;
                state.deepSWEScoreMin = external.deepSWEScoreMin == null ? '' : external.deepSWEScoreMin;
                state.monthlyTokenRange = external.monthlyTokenRange;
                state.tokenUnit = normalizeTokenUnit(external.tokenUnit);
                const budget = external.budgetCny;
                state.priceRanges = external.priceRanges || {};
                state.filterContext = context;
                state.sharedFilters = external;
                const firstMonthRange = external.priceRanges && external.priceRanges.firstMonthPrice;
                const numericBounds = values => values
                    .filter(value => value !== null && value !== undefined && value !== '')
                    .map(value => Number(value)).filter(Number.isFinite);
                const minimums = numericBounds([budget && budget.min, firstMonthRange && firstMonthRange.min]);
                const maximums = numericBounds([budget && budget.max, firstMonthRange && firstMonthRange.max]);
                state.monthlyPriceMin = minimums.length ? Math.max(...minimums) : null;
                state.monthlyPriceMax = maximums.length ? Math.min(...maximums) : null;
            }

            // Chart loading can outlive a user's first filter change; read the current controller.
            const currentFilters = mountOptions.mode === 'full'
                ? document.getElementById('toolFilters')?.filterController?.getState()
                : root.__codingplanUnifiedFiltersState;
            applyExternalFilter(currentFilters || mountOptions.filterState);

            function colorContext(visiblePoints) {
                const byModel = state.colorMode === 'model';
                const colors = byModel ? modelColors : platformColors;
                const entries = new Map();
                visiblePoints.forEach((point) => {
                    const key = getPointColorKey(point, state.colorMode);
                    const label = byModel ? point.modelName : getPointLabelText(point, 'vendor');
                    entries.set(key, label);
                });
                return { colors, entries };
            }

            function layoutColorLegend() {
                const list = container.querySelector('[data-color-legend]');
                const toggle = list.querySelector('[data-legend-toggle]');
                if (!toggle || !list.clientWidth) return;
                const items = [...list.querySelectorAll('[data-color-key]')];
                items.forEach(item => { item.hidden = false; item.style.maxWidth = ''; });
                toggle.hidden = false;
                const available = list.getBoundingClientRect().width;
                const cssGap = parseFloat(root.getComputedStyle(list).columnGap) || 0;
                const scale = available / list.clientWidth;
                const gap = cssGap * scale;
                const total = items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + Math.max(0, items.length - 1) * gap;
                if (total <= available) { toggle.hidden = true; return; }
                if (state.legendExpanded) return;
                const spaceForItems = Math.max(0, available - toggle.getBoundingClientRect().width - gap);
                let used = 0;
                let filled = false;
                items.forEach((item, index) => {
                    item.style.maxWidth = `calc(100% - ${toggle.offsetWidth}px - ${cssGap + 2}px)`;
                    const width = item.getBoundingClientRect().width;
                    const next = used + (index ? gap : 0) + width;
                    // Fractional pixels and flex layout rounding can otherwise push the toggle onto a new line.
                    if (filled || next > spaceForItems - scale) { item.hidden = true; filled = true; }
                    else used = next;
                });
            }

            function renderColorLegend(context) {
                const entries = [...context.entries.entries()].map(([slug, name]) => ({slug, name}))
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                const ordered = state.colorMode === 'model' ? UI.prioritizeFeaturedModels(entries, presetConfig.groups) : entries;
                container.querySelector('[data-color-legend]').innerHTML = ordered
                    .map(({slug:key, name:label}) => {
                        const selected = state.selectedColorKeys.has(key);
                        const muted = state.selectedColorKeys.size && !selected;
                        return `<button type="button" class="usage-legend-item${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}" data-color-key="${escapeHtml(key)}" aria-pressed="${selected}"><i style="background:${context.colors[key]}"></i><span>${escapeHtml(label)}</span></button>`;
                    }).join('') + (ordered.length ? `<button type="button" class="usage-legend-toggle" data-legend-toggle aria-expanded="${state.legendExpanded}"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 5 4 4 4-4M5 10l4 4 4-4"/></svg>${state.legendExpanded ? '收起' : '展开全部'}</button>` : '');
                layoutColorLegend();
            }

            function renderDataTable(tableName, rows) {
                latestTableRows[tableName] = rows || [];
                const sort = tableSortState[tableName];
                if (Directory) Url.replace(urlSchema, {query:search.value, ...sort, benchmark:state.benchmark, colorMode:state.colorMode, axisScale:state.axisScale, chartBilling:state.chartBilling, extraColumns:mountOptions.columns.checked}, {remove:['allScores']});
                let sorted = Directory ? Directory.tableRows(rows, points, pins, sortComparisonRows, sort) : sortComparisonRows(rows, sort.key, sort.direction);
                const scale = buildUnitPriceVisualScale(sorted, state.axisScale);
                const colors = state.colorMode === 'model' ? modelColors : platformColors;
                let renderKey = '';
                if (Directory) {
                    const nextSelectionKey=JSON.stringify([sorted.map(point=>point.slug),priceBasis,pins,sort]);
                    if(selectionKey!==nextSelectionKey){pageIndex=0;selectionKey=nextSelectionKey;}
                    const pagination=Directory.paginate(sorted,[...pins,...focusRelationSlugs],pageIndex);pageIndex=pagination.page;
                    container.querySelector('.usage-data-card .usage-chart-head').hidden=pagination.pages===1;
                    sorted=pagination.rows;
                    container.querySelectorAll('[data-price-pagination]').forEach(pager=>{
                        pager.hidden=pagination.pages===1;
                        pager.querySelector('[data-price-page-label]').textContent=`${pageIndex+1} / ${pagination.pages} 页`;
                        pager.querySelectorAll('[data-price-page]').forEach(button=>button.disabled=button.dataset.pricePage==='next'?pageIndex>=pagination.pages-1:pageIndex===0);
                    });
                    renderKey = JSON.stringify([nextSelectionKey,pageIndex,state.tokenUnit,state.colorMode,state.benchmark,featuredStyleKey]);
                    const label = `${state.featuredOnly ? '精选 '+rows.length+' 条明细' : rows.length+' / '+points.length+' 条明细'}${pins.length ? ' · 置顶 '+pins.length+' 条' : ''}`;
                    mountOptions.count.textContent = label;
                    root.CodingPlanEvents?.results({result_count:rows.length,result_key:JSON.stringify(rows.map(x=>x.slug))});
                    if (tableRenderKey === renderKey) {
                        if (tableScaleType !== state.axisScale) {
                            const bySlug = new Map(sorted.map(point => [point.slug, point]));
                            container.querySelectorAll(`[data-table-body="${tableName}"] [data-point-id]`).forEach(row => {
                                const point = bySlug.get(row.dataset.pointId);
                                row.querySelector('.usage-table-price-visual').innerHTML = unitPriceVisualHtml(point, state.tokenUnit, {scale, color:colors[getPointColorKey(point, state.colorMode)]});
                            });
                            tableScaleType = state.axisScale;
                        }
                        return;
                    }
                    tableRenderKey = renderKey;
                }
                tableScaleType = state.axisScale;
                const body = container.querySelector(`[data-table-body="${tableName}"]`);
                const noticeSeen = new Set();
                body.innerHTML = sorted.length
                    ? sorted.map((point) => comparisonTableRowHtml(point, state.tokenUnit, {
                        scale,
                        changes:context.changes, noticeSeen,
                        focused: focusRelationSlugs.has(point.slug),
                        compactIdentity:Boolean(Directory), pinned:pins.includes(point.slug),
                        featured:featuredPointSlugs.has(point.slug),
                        color: colors[getPointColorKey(point, state.colorMode)]
                    })).join('')
                    : `<tr><td class="usage-table-empty" colspan="${comparisonTableColumns(Boolean(Directory)).length}">当前筛选下没有可展示的数据；请在上方下拉框调整条件，或点击“显示全部”。</td></tr>`;
                container.querySelectorAll('[data-comparison-col]').forEach(cell => {
                    const key = cell.dataset.comparisonCol;
                    cell.hidden = Scores.keys.includes(key) && key !== state.benchmark;
                });
                if (!Directory) container.querySelector(`[data-table-count="${tableName}"]`).textContent = `${sorted.length} 条`;
                container.querySelectorAll(`[data-table="${tableName}"] th[data-sort-key]`).forEach((header) => {
                    const active = header.dataset.sortKey === sort.key;
                    header.classList.toggle('sort-asc', active && sort.direction === 'asc');
                    header.classList.toggle('sort-desc', active && sort.direction === 'desc');
                    header.setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
                });
            }

            if (Directory) {
                mountOptions.columns.addEventListener('change', () => {
                    container.classList.toggle('show-all-columns', mountOptions.columns.checked);
                    if (!mountOptions.columns.checked && ['fiveHourTokenInM','weeklyTokenInM'].includes(tableSortState.comparison.key)) tableSortState.comparison={key:'unitPriceCnyPerM',direction:'asc'};
                    renderDataTable('comparison', latestTableRows.comparison);
                });
                const pagerHtml='<button class="tool-button" type="button" data-price-page="first">第一页</button><button class="tool-button" type="button" data-price-page="previous">上一页</button><span data-price-page-label aria-live="polite"></span><button class="tool-button" type="button" data-price-page="next">下一页</button>';
                const pager=document.createElement('div');pager.className='price-pagination';pager.dataset.pricePagination='';pager.innerHTML=pagerHtml;
                const card=container.querySelector('.usage-data-card');card.append(pager);
                const topPager=pager.cloneNode(true);card.querySelector('.usage-chart-head').append(topPager);
                search.addEventListener('input', () => { cancelAnimationFrame(renderFrame); renderFrame=requestAnimationFrame(render); });
                document.getElementById('toolFilters').addEventListener('click', event => {
                    if (event.target.closest('[data-filter-action="restore-defaults"]')) { state.benchmark='artificialAnalysis'; state.axisScale='log'; state.chartBilling='all'; state.selectedChartSlug=null; search.value=''; tableSortState.comparison={key:'unitPriceCnyPerM',direction:'asc'}; }
                }, true);
                root.addEventListener('storage', event => { if(event.key===Directory.pinKey || event.key===null){pins=Directory.readPins(root.localStorage,points);renderDataTable('comparison',latestTableRows.comparison);} });
            }

            const compactLayouts = new Map();
            function fitScatterLayout(chart, usage) {
                const compact = chart.getWidth() < 480;
                if (compactLayouts.get(chart) === compact) return;
                compactLayouts.set(chart, compact);
                chart.setOption({
                    grid: { left: compact ? 62 : 76, right: compact ? 16 : 28, top: 28, bottom: 58 },
                    xAxis: { axisLabel: { hideOverlap: true, fontSize: compact ? 10 : 12 } },
                    yAxis: { nameGap: compact ? 44 : usage ? 55 : 45, axisLabel: { hideOverlap: true, fontSize: compact ? 10 : 12 } }
                });
            }

            function setScatterOptions(chart, option, usage) {
                const compact=chart.getWidth()<480; compactLayouts.set(chart,compact);
                option.grid={left:compact?62:76,right:compact?16:28,top:28,bottom:58};
                Object.assign(option.xAxis.axisLabel,{hideOverlap:true,fontSize:compact?10:12});
                Object.assign(option.yAxis.axisLabel,{hideOverlap:true,fontSize:compact?10:12});
                option.yAxis.nameGap=compact?44:usage?55:45;
                chart.setOption(option,true);
            }

            function render() {
                scaleControl.querySelectorAll('[data-scale-value]').forEach(button => {
                    const active = button.dataset.scaleValue === state.axisScale;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                colorControl.querySelectorAll('[data-color-mode]').forEach(button => {
                    const active = button.dataset.colorMode === state.colorMode;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                benchmarkControl.querySelectorAll('[data-benchmark]').forEach(button => {
                    button.classList.toggle('is-active',button.dataset.benchmark === state.benchmark);
                    button.setAttribute('aria-pressed',String(button.dataset.benchmark === state.benchmark));
                });
                const presetRenderKey = `${state.tokenUnit}:${state.presetPlatformScope}`;
                if (renderedPresetKey !== presetRenderKey) {
                    if (!mountOptions.hidePresets) renderPresetComparisons(container.querySelector('[data-presets]'), presetConfig, points, state.tokenUnit, state.presetPlatformScope);
                    renderedPresetKey = presetRenderKey;
                }
                let filtered = state.featuredOnly && (!state.platforms.size || !state.models.size) ? [] : filterPoints(points, {
                    platforms: state.platforms, models: state.models, multimodal: state.multimodal,
                    aaScoreMin: state.aaScoreMin, deepSWEScoreMin: state.deepSWEScoreMin,
                    monthlyPriceMin: state.monthlyPriceMin, monthlyPriceMax: state.monthlyPriceMax,
                    platformsSpecified: state.platformsSpecified, modelsSpecified: state.modelsSpecified,
                    modelMatch: state.modelMatch, includeDiscontinued: state.includeDiscontinued,
                    monthlyTokenRange: state.monthlyTokenRange,
                    priceRanges: state.priceRanges, filterContext: state.filterContext, sharedFilters: state.sharedFilters
                });
                if (Directory) {
                    search.disabled = state.featuredOnly;
                    search.closest('.tool-result-bar').classList.toggle('is-search-paused', state.featuredOnly);
                    filtered = Directory.search(filtered, state.featuredOnly ? '' : search.value);
                }
                const chartBilling = state.featuredOnly ? 'all' : state.chartBilling;
                const billingFiltered = filtered.filter(point => chartBilling === 'all' || point.billingMode === chartBilling);
                const availableColorKeys = new Set(billingFiltered.map(point => getPointColorKey(point, state.colorMode)));
                state.selectedColorKeys = new Set([...state.selectedColorKeys].filter(key => availableColorKeys.has(key)));
                const visibleFiltered = filterBySelectedColorKeys(billingFiltered, state.colorMode, state.selectedColorKeys);
                const usageCard = container.querySelector('[data-usage-card]');
                const wasUsageHidden = usageCard.hidden;
                usageCard.hidden = chartBilling === 'payg';
                if (wasUsageHidden && !usageCard.hidden) usageChart.resize();
                const usagePoints = buildUsageChartPoints(visibleFiltered);
                const intelligencePoints = buildIntelligenceChartPoints(visibleFiltered, state.benchmark, state.axisScale);
                latestPriceGroups = PriceChart.groupPoints(intelligencePoints, state.benchmark);
                if (!latestPriceGroups.some(group => group.members.some(point => point.slug === state.selectedChartSlug))) state.selectedChartSlug = null;
                billingControl.querySelectorAll('[data-chart-billing]').forEach(button => {
                    const active = button.dataset.chartBilling === state.chartBilling;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                const pointLabelField = getSoloPointLabelField(visibleFiltered);
                const color = colorContext(billingFiltered);
                renderColorLegend(color);
                const counts = container.querySelector('[data-counts]');
                if (counts) {
                    const totalUsage = buildUsageChartPoints(points).length;
                    const totalIntelligence = buildIntelligenceChartPoints(points, state.benchmark, state.axisScale).length;
                    counts.textContent = `额度图 ${usagePoints.length}/${totalUsage} · 智力图 ${intelligencePoints.length}/${totalIntelligence} · 明细 ${visibleFiltered.length}/${points.length}`;
                }

                const tokenUnitLabel = Numbers.tokenUnit(state.tokenUnit);
                const usageZone = buildUsageAttractiveZone(usagePoints, state.tokenUnit, state.axisScale);
                setScatterOptions(usageChart, Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit)), {
                    xAxis: { type: state.axisScale, name: '首月价格（人民币）', nameLocation: 'middle', nameGap: 38, min: usageZone.xBounds.min, max: usageZone.xBounds.max, logBase: 10, axisLabel: { formatter: (v) => Numbers.monthlyFee(v) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: state.axisScale, name: `月 Token（${tokenUnitLabel}）`, nameLocation: 'middle', nameGap: 55, min: usageZone.yBounds.min, max: usageZone.yBounds.max, logBase: 10, axisLabel: { formatter: (v) => Numbers.tokens(v) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    series: [buildUsageAttractiveZoneSeries(usageZone), ...seriesByColor(usagePoints, state.colorMode, color.colors, (point) => ({ value: [point.monthlyFeeCny, tokenAmountInUnit(point.monthlyTokenInM, state.tokenUnit)], meta: point }), 'usage', pointLabelField)]
                }), true);

                const intelligenceSeries = PriceChart.buildSeries(latestPriceGroups, {
                    benchmark: state.benchmark, colors: color.colors, colorMode: state.colorMode,
                    tokenUnit: state.tokenUnit, compact: intelligenceChart.getWidth() < 800,
                    selectedSlug: state.selectedChartSlug
                });
                setScatterOptions(intelligenceChart, Object.assign(chartBase((params) => {
                    if (!params.data?.meta) return '';
                    return tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit)
                        + (params.data.members.length > 1 ? `<div class="price-chart-overlap">此位置共 ${params.data.members.length} 个方案，点击后可逐条查看。</div>` : '');
                }), {
                    xAxis: { type: state.axisScale, name: `综合单价（人民币 / ${tokenUnitLabel} Token）`, nameLocation: 'middle', nameGap: 38, min: state.axisScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: (v) => Numbers.unitPrice(v) }, splitLine: { lineStyle: { color: '#edf1f6', type: 'dashed' } } },
                    yAxis: { type: 'value', name: state.benchmark === 'arena' ? 'Arena 净改善（%）' : `${BENCHMARKS[state.benchmark].short} 评分`, nameLocation: 'middle', nameGap: 45, scale: true, axisLabel: { formatter: (v) => state.benchmark === 'arena' ? `${formatNumber(v,1)}%` : formatNumber(v,1) }, splitLine: { lineStyle: { color: '#edf1f6' } } },
                    series: intelligenceSeries
                }), false);
                container.querySelector('[data-chart-meta]').innerHTML = PriceChart.metadataHtml(latestPriceGroups, state.benchmark, context.benchmarks?.[state.benchmark], priceBasis, visibleFiltered.length - intelligencePoints.length);
                renderChartDetail();
                renderDataTable('comparison', billingFiltered);
                container.querySelector('[data-empty="usage"]').hidden = usagePoints.length > 0;
                container.querySelector('[data-empty="intelligence"]').hidden = intelligencePoints.length > 0;
            }

            let chartSelects;
            function renderChartDetail() {
                const host = container.querySelector('[data-chart-detail]');
                const disclosure = host.querySelector('.price-chart-offer-note');
                const wasOpen = disclosure?.open;
                chartSelects?.destroy();
                host.innerHTML = PriceChart.detailHtml(latestPriceGroups, state.selectedChartSlug, {
                    benchmark: state.benchmark, tokenUnit: state.tokenUnit,
                    tooltipHtml: point => tooltipHtml(point, state.benchmark, state.colorMode, state.tokenUnit)
                });
                if (wasOpen && host.querySelector('.price-chart-offer-note')) host.querySelector('.price-chart-offer-note').open = true;
                chartSelects = root.CodingPlanSingleSelect.mountAll(host);
            }
            intelligenceChart.on('click', params => {
                if (!params.data?.meta) return;
                state.selectedChartSlug = params.data.meta.slug;
                intelligenceChart.dispatchAction({type:'hideTip'});
                render();
            });
            intelligenceChart.getZr().on('click', event => {
                if (event.target || !state.selectedChartSlug) return;
                state.selectedChartSlug = null;
                render();
            });
            container.addEventListener('change', (event) => {
                const target = event.target;
                if (target.matches('[data-chart-member]')) {
                    state.selectedChartSlug = target.value;
                    render();
                    const select = container.querySelector('[data-chart-member]');
                    if (select) root.CodingPlanSingleSelect.mount(select,select.getAttribute('aria-label'),{showLabel:false}).focus();
                    return;
                }
            });
            function onSharedFilterChange(event) {
                // Business filters supersede the temporary legend restriction; display units do not.
                if (!event || !event.detail || event.detail.source !== 'display') { state.selectedColorKeys.clear(); state.selectedChartSlug = null; }
                if (event?.detail?.source === 'reset' || event?.detail?.source === 'preset') state.chartBilling = 'all';
                if (event?.detail?.source === 'reset') state.benchmark = 'artificialAnalysis';
                if (event?.detail?.source === 'reset') state.axisScale = 'log';
                applyExternalFilter(event && event.detail && event.detail.state);
                render();
            }
            root.addEventListener('codingplan:filters-changed', onSharedFilterChange);
            const onTokenUnitChange = event => { if(state.tokenUnit === event.detail.tokenUnit)return; state.tokenUnit = event.detail.tokenUnit; render(); };
            root.addEventListener('codingplan:token-unit-changed', onTokenUnitChange);
            const onPriceBasisChange = () => { priceBasis=root.EntityData.displayPriceBasis(); points=root.EntityData.withComparisonPriceBasis(originalPoints,context,priceBasis); render(); };
            root.addEventListener('codingplan:price-basis-changed',onPriceBasisChange);
            container.__usageCleanup = () => {
                chartSelects?.destroy();
                colorControl.removeEventListener('click', onColorModeClick);
                benchmarkControl.removeEventListener('click', onBenchmarkClick);
                billingControl.removeEventListener('click', onBillingClick);
                scaleControl.removeEventListener('click', onAxisScaleClick);
                root.removeEventListener('codingplan:filters-changed', onSharedFilterChange);
                root.removeEventListener('codingplan:token-unit-changed', onTokenUnitChange);
                root.removeEventListener('codingplan:price-basis-changed',onPriceBasisChange);
            };
            function setChartSeriesHighlight(chart, targetIds, active) {
                const series = (chart.getOption().series || []).filter((item) => item && item.id && !String(item.id).includes('attractive-zone'));
                const targets = new Set(targetIds);
                chart.dispatchAction({
                    type: 'downplay',
                    batch: series.map((item) => ({ seriesId: item.id }))
                });
                if (!active) return;
                const matched = series.filter((item) => targets.has(item.id));
                if (!matched.length) return;
                chart.dispatchAction({
                    type: 'highlight',
                    batch: matched.map((item) => ({ seriesId: item.id }))
                });
            }

            function setColorHighlight(key, active) {
                setChartSeriesHighlight(usageChart, [`usage:${key}`], active);
                setChartSeriesHighlight(intelligenceChart, [`intelligence:${key}`], active);
            }
            [usageChart].forEach((chart) => {
                chart.on('mouseover', (params) => {
                    if (params.componentType !== 'series' || !params.data || !params.data.meta) return;
                    setColorHighlight(getPointColorKey(params.data.meta, state.colorMode), true);
                });
                chart.on('mouseout', (params) => {
                    if (params.componentType !== 'series' || !params.data || !params.data.meta) return;
                    setColorHighlight(getPointColorKey(params.data.meta, state.colorMode), false);
                });
            });
            container.addEventListener('mouseover', (event) => {
                const item = event.target.closest('[data-color-key]');
                if (!item || item.contains(event.relatedTarget)) return;
                item.classList.add('is-hovered');
                setColorHighlight(item.dataset.colorKey, true);
            });
            container.addEventListener('mouseout', (event) => {
                const item = event.target.closest('[data-color-key]');
                if (!item || item.contains(event.relatedTarget)) return;
                item.classList.remove('is-hovered');
                setColorHighlight(item.dataset.colorKey, false);
            });
            container.addEventListener('click', (event) => {
                if (event.target.closest('[data-chart-reset]')) {
                    document.querySelector('#toolFilters [data-filter-action="restore-defaults"]')?.click();
                    return;
                }
                if (event.target.closest('[data-chart-clear]')) { state.selectedChartSlug = null; render(); return; }
                if (event.target.closest('[data-chart-export]')) {
                    const link = document.createElement('a');
                    link.download = `模型能力与价格-${BENCHMARKS[state.benchmark].short}.png`;
                    link.href = intelligenceChart.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#fff'});
                    link.click();
                    return;
                }
                const locate = event.target.closest('[data-chart-locate]');
                if (locate) {
                    const slug = locate.dataset.chartLocate;
                    if (Directory) {
                        const sorted = Directory.tableRows(latestTableRows.comparison,points,pins,sortComparisonRows,tableSortState.comparison);
                        const ordinary = sorted.filter(point => !pins.includes(point.slug) && !focusRelationSlugs.has(point.slug));
                        const index = ordinary.findIndex(point => point.slug === slug);
                        if (index >= 0) pageIndex = Math.floor(index / 200);
                        renderDataTable('comparison',latestTableRows.comparison);
                    }
                    const row = [...container.querySelectorAll('[data-point-id]')].find(row => row.dataset.pointId === slug);
                    container.querySelectorAll('.price-chart-focus-row').forEach(row => row.classList.remove('price-chart-focus-row'));
                    if (row) { row.classList.add('price-chart-focus-row'); row.tabIndex=-1; row.focus({preventScroll:true}); row.scrollIntoView({block:'center',behavior:'smooth'}); }
                    return;
                }
                const pageButton=event.target.closest('[data-price-page]');
                if(Directory && pageButton){
                    pageIndex=pageButton.dataset.pricePage==='first'?0:pageIndex+(pageButton.dataset.pricePage==='next'?1:-1);
                    renderDataTable('comparison',latestTableRows.comparison);
                    if(pageButton.parentElement===container.querySelector('.usage-data-card > .price-pagination'))container.querySelector('.usage-data-card').scrollIntoView({block:'start'});
                    return;
                }
                const pin = event.target.closest('[data-price-pin]');
                if (Directory && pin) {
                    const slug=pin.dataset.pricePin; pins=pins.includes(slug)?pins.filter(id=>id!==slug):[slug,...pins];
                    Directory.writePins(root.localStorage,pins); renderDataTable('comparison',latestTableRows.comparison);
                    root.CodingPlanEvents?.track('pin_change', {entity_type:'price_row',entity_slug:slug,pinned:pins.includes(slug),placement:'pricing'});
                    [...container.querySelectorAll('[data-price-pin]')].find(button=>button.dataset.pricePin===slug)?.focus({preventScroll:true}); return;
                }
                if (event.target.closest('.ui-help')) return;
                const sortHeader = event.target.closest('[data-table-sort][data-sort-key]');
                if (sortHeader) {
                    const tableName = sortHeader.dataset.tableSort;
                    const sort = tableSortState[tableName];
                    const key = sortHeader.dataset.sortKey;
                    if (Directory) tableSortState[tableName] = Directory.cycleSort(sort,key);
                    else { sort.direction = sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc'; sort.key = key; }
                    renderDataTable(tableName, latestTableRows[tableName]);
                    return;
                }
                if (event.target.closest('[data-legend-toggle]')) {
                    state.legendExpanded = !state.legendExpanded;
                    render();
                    container.querySelector('[data-legend-toggle]')?.focus({preventScroll:true});
                    return;
                }
                const colorLegendItem = event.target.closest('[data-color-key]');
                if (colorLegendItem) {
                    const key = colorLegendItem.dataset.colorKey;
                    if (state.selectedColorKeys.has(key)) state.selectedColorKeys.delete(key); else state.selectedColorKeys.add(key);
                    render();
                    container.querySelectorAll('[data-color-key]').forEach(item => { if (item.dataset.colorKey === key) item.focus({preventScroll:true}); });
                    return;
                }
                const presetPlatformScopeButton = event.target.closest('[data-preset-platform-scope]');
                if (presetPlatformScopeButton) {
                    state.presetPlatformScope = normalizePresetPlatformScope(presetPlatformScopeButton.dataset.presetPlatformScope);
                    render();
                    return;
                }
            });
            container.addEventListener('keydown', (event) => {
                if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-table-sort][data-sort-key]')) {
                    event.preventDefault();
                    event.target.click();
                }
            });
            let resizeFrame=0;
            let compactPriceLabels = intelligenceChart.getWidth() < 800;
            const resize = () => {
                if(resizeFrame)return;
                resizeFrame=requestAnimationFrame(()=>{
                    resizeFrame=0;
                    [usageChart,intelligenceChart].forEach((chart,index)=>{
                        const element=chart.getDom();
                        if(element.clientWidth===chart.getWidth() && element.clientHeight===chart.getHeight())return;
                        chart.resize(); fitScatterLayout(chart,index===0);
                    });
                    const nextCompact = intelligenceChart.getWidth() < 800;
                    if (compactPriceLabels !== nextCompact) { compactPriceLabels = nextCompact; render(); }
                });
            };
            root.addEventListener('resize', resize);
            if (root.ResizeObserver) { const observer=new root.ResizeObserver(resize); [usageChart,intelligenceChart].forEach(chart=>observer.observe(chart.getDom())); }
            if (root.ResizeObserver) {
                let legendWidth = 0;
                const legendObserver = new root.ResizeObserver(entries => {
                    const width = entries[0].contentRect.width;
                    if (width !== legendWidth) { legendWidth = width; layoutColorLegend(); }
                });
                legendObserver.observe(container.querySelector('[data-color-legend]'));
            }
            document.fonts?.ready.then(layoutColorLegend);
            render();
            if (Directory) mountStickyLegend(container);
            container.__usageMounted = true;
        })().catch((error) => {
            if (snapshotHtml !== null) {
                container.innerHTML = snapshotHtml;
                container.setAttribute('data-static-content', snapshotKind);
            } else container.innerHTML = `<div class="usage-load-error">价格与额度加载失败，请稍后刷新重试。<br><small>${escapeHtml(error.message)}</small></div>`;
            container.__usageMountPromise = null;
            throw error;
        });
        return container.__usageMountPromise;
    }

    return { mountModelComparisonView };
});
