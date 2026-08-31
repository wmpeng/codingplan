(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ModelComparison = api;
    root.mountModelComparisonView = api.mountModelComparisonView;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const BENCHMARKS = {
        artificialAnalysis: { label: 'AA 智力', short: 'AA' },
        deepSWE: { label: 'DeepSWE', short: 'DeepSWE' }
    };
    const PLATFORM_COLORS = [
        '#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2',
        '#db2777', '#4f46e5', '#65a30d', '#9333ea', '#ea580c', '#0f766e',
        '#475569', '#a16207', '#be123c', '#0369a1'
    ];
    const DEFAULT_PLATFORM_SELECTIONS = [
        ['阿里·百炼', 'Token Plan'],
        ['智谱AI', 'Token Plan'],
        ['字节·方舟', 'Coding Plan'],
        ['Codex', 'Token Plan'],
        ['Claude', 'Token Plan'],
        ['DeepSeek', 'API'],
        ['Kimi', 'Coding Plan'],
        ['MiniMax', 'Token Plan'],
        ['OpenCode', 'Token Plan']
    ];
    const DEFAULT_MODEL_IDS = [
        'deepseek-v4-pro-0813', 'deepseek-v4-flash-0731', 'qwen-3-8-max',
        'glm-5-3', 'glm-5-3-flash', 'kimi-k3', 'gpt-5-6-sol', 'gpt-5-6-luna',
        'claude-opus-5', 'claude-sonnet-5', 'grok-4-6', 'muse-spark-1-2'
    ];
    const COMPARISON_TABLE_COLUMNS = [
        { key: 'vendor', label: '平台' },
        { key: 'platformType', label: '类型' },
        { key: 'plan', label: '套餐' },
        { key: 'price', label: '价格' },
        { key: 'model', label: '模型' },
        { key: 'fiveHourTokenInM', label: '5h用量' },
        { key: 'weeklyTokenInM', label: '周用量' },
        { key: 'monthlyTokenInM', label: '月用量' },
        { key: 'unitPriceCnyPerM', label: '综合单价' },
        { key: 'artificialAnalysis', label: 'AA分数' },
        { key: 'deepSWE', label: 'DeepSWE分数' },
        { key: 'note', label: '备注' }
    ];

    function finitePositive(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : null;
    }

    function getPointScore(point, benchmark) {
        const score = point && point.scores && point.scores[benchmark];
        const exact = score && Number(score.scoreExact);
        return Number.isFinite(exact) ? exact : null;
    }

    function getPointPlatformKey(point) {
        return JSON.stringify([String(point.vendor || ''), String(point.platformType || '')]);
    }

    function createDefaultFilterState(points) {
        const availablePlatforms = new Set((points || []).map(getPointPlatformKey));
        const availableModels = new Set((points || []).map((point) => point.canonicalModelId));
        return {
            platforms: new Set(DEFAULT_PLATFORM_SELECTIONS
                .map(([vendor, platformType]) => getPointPlatformKey({ vendor, platformType }))
                .filter((key) => availablePlatforms.has(key))),
            models: new Set(DEFAULT_MODEL_IDS.filter((id) => availableModels.has(id))),
            multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '', soloColorKey: null
        };
    }

    function filterPoints(points, filters) {
        const state = filters || {};
        const platforms = state.platforms instanceof Set ? state.platforms : new Set(state.platforms || []);
        const models = state.models instanceof Set ? state.models : new Set(state.models || []);
        const aaScoreMin = Number(state.aaScoreMin);
        const deepSWEScoreMin = Number(state.deepSWEScoreMin);
        const hasAaScoreMin = state.aaScoreMin !== '' && state.aaScoreMin !== null && Number.isFinite(aaScoreMin);
        const hasDeepSWEScoreMin = state.deepSWEScoreMin !== '' && state.deepSWEScoreMin !== null && Number.isFinite(deepSWEScoreMin);
        return (points || []).filter((point) => {
            if (platforms.size && !platforms.has(getPointPlatformKey(point))) return false;
            if (models.size && !models.has(point.canonicalModelId)) return false;
            if (state.multimodal === 'multimodal' && point.multimodal !== true) return false;
            if (state.multimodal === 'text' && point.multimodal !== false) return false;
            const aaScore = getPointScore(point, 'artificialAnalysis');
            const deepSWEScore = getPointScore(point, 'deepSWE');
            if (hasAaScoreMin && (aaScore === null || aaScore < aaScoreMin)) return false;
            if (hasDeepSWEScoreMin && (deepSWEScore === null || deepSWEScore < deepSWEScoreMin)) return false;
            return true;
        });
    }

    function buildUsageChartPoints(points) {
        return (points || []).filter((point) =>
            point.billingType === 'subscription' &&
            finitePositive(point.monthlyFeeCny) !== null &&
            finitePositive(point.monthlyTokenInM) !== null
        );
    }

    function buildIntelligenceChartPoints(points, benchmark) {
        return (points || []).filter((point) =>
            finitePositive(point.unitPriceCnyPerM) !== null &&
            getPointScore(point, benchmark) !== null
        );
    }

    function buildVendorColorMap(vendors) {
        const map = {};
        const used = new Set();
        [...new Set(vendors || [])].sort((a, b) => a.localeCompare(b, 'zh-CN')).forEach((vendor, index) => {
            let color = PLATFORM_COLORS[index];
            let seed = index;
            while (!color || used.has(color)) {
                const hue = Math.round((seed * 137.508) % 360);
                color = hslToHex(hue, 68 + (seed % 3) * 4, 42 + (seed % 4) * 3);
                seed += 1;
            }
            map[vendor] = color;
            used.add(color);
        });
        return map;
    }

    function hslToHex(hue, saturation, lightness) {
        const s = saturation / 100;
        const l = lightness / 100;
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
        const match = l - chroma / 2;
        let rgb;
        if (hue < 60) rgb = [chroma, x, 0];
        else if (hue < 120) rgb = [x, chroma, 0];
        else if (hue < 180) rgb = [0, chroma, x];
        else if (hue < 240) rgb = [0, x, chroma];
        else if (hue < 300) rgb = [x, 0, chroma];
        else rgb = [chroma, 0, x];
        return `#${rgb.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
    }

    function buildModelColorMap(modelIds) {
        const map = {};
        [...new Set(modelIds || [])].sort().forEach((modelId, index) => {
            const hue = Math.round((index * 137.508) % 360);
            const saturation = 62 + (index % 3) * 5;
            const lightness = 42 + (index % 4) * 4;
            map[modelId] = hslToHex(hue, saturation, lightness);
        });
        return map;
    }

    function getPointColorKey(point, colorMode) {
        return colorMode === 'model' ? point.canonicalModelId : getPointPlatformKey(point);
    }

    function filterBySoloColorKey(points, colorMode, soloColorKey) {
        if (!soloColorKey) return points || [];
        return (points || []).filter((point) => getPointColorKey(point, colorMode) === soloColorKey);
    }

    function getSoloPointLabelField(points) {
        const visible = points || [];
        const modelIds = new Set(visible.map((point) => point.canonicalModelId));
        const platforms = new Set(visible.map(getPointPlatformKey));
        if (modelIds.size === 1) return 'vendor';
        if (platforms.size === 1) return 'model';
        return null;
    }

    function getPointLabelText(point, pointLabelField) {
        if (pointLabelField === 'vendor') {
            return point.platformType ? `${point.vendor} · ${point.platformType}` : point.vendor;
        }
        if (pointLabelField === 'model') return point.model || point.canonicalModel;
        return '';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatNumber(value, maximumFractionDigits) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        return number.toLocaleString('zh-CN', { maximumFractionDigits });
    }

    function compactNumber(value) {
        if (value === null || value === undefined || value === '') return '—';
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        if (number >= 1000000) return `${formatNumber(number / 1000000, 1)}T`;
        if (number >= 1000) return `${formatNumber(number / 1000, 1)}B`;
        return `${formatNumber(number, number < 10 ? 2 : 1)}M`;
    }

    function comparisonSortValue(point, key) {
        if (key === 'price') return finitePositive(point.monthlyFeeCny);
        if (key === 'artificialAnalysis' || key === 'deepSWE') return getPointScore(point, key);
        if (key === 'vendor' || key === 'platformType' || key === 'plan' || key === 'note') return point[key] || '';
        if (key === 'model') return point.model || point.canonicalModel || '';
        return finitePositive(point[key]);
    }

    function sortComparisonRows(points, key, direction) {
        const multiplier = direction === 'desc' ? -1 : 1;
        return [...(points || [])].sort((left, right) => {
            const a = comparisonSortValue(left, key);
            const b = comparisonSortValue(right, key);
            const aMissing = a === null || a === '';
            const bMissing = b === null || b === '';
            if (aMissing !== bMissing) return aMissing ? 1 : -1;
            if (aMissing && bMissing) return String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN');
            if (typeof a === 'number' && typeof b === 'number') {
                const delta = (a - b) * multiplier;
                return delta || String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN');
            }
            const compared = String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' }) * multiplier;
            return compared || String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN');
        });
    }

    function comparisonTableHeadHtml(tableName) {
        return `<tr>${COMPARISON_TABLE_COLUMNS.map((column) =>
            `<th scope="col" class="sortable${column.key === 'vendor' ? ' sticky-first' : ''}" tabindex="0" aria-sort="none" data-table-sort="${tableName}" data-sort-key="${column.key}">${column.label}</th>`
        ).join('')}</tr>`;
    }

    function comparisonTableRowHtml(point) {
        const subscription = point.billingType === 'subscription';
        const price = subscription && finitePositive(point.monthlyFeeCny) !== null
            ? `¥${formatNumber(point.monthlyFeeCny, 2)} / 月` : '按量';
        const unitPrice = finitePositive(point.unitPriceCnyPerM) !== null
            ? `¥${formatNumber(point.unitPriceCnyPerM, 4)} / M` : '—';
        const aaScore = point.scores && point.scores.artificialAnalysis;
        const deepSWEScore = point.scores && point.scores.deepSWE;
        const deepSWEInterval = deepSWEScore && Number.isFinite(Number(deepSWEScore.confidenceInterval))
            ? ` ±${formatNumber(deepSWEScore.confidenceInterval, 0)}` : '';
        return `<tr data-point-id="${escapeHtml(point.id)}">` +
            `<td class="sticky-first"><strong>${escapeHtml(point.vendor)}</strong></td>` +
            `<td>${escapeHtml(point.platformType || '—')}</td>` +
            `<td>${escapeHtml(point.plan || (subscription ? '订阅' : '按量 API'))}</td>` +
            `<td class="numeric">${price}</td>` +
            `<td class="usage-table-model">${escapeHtml(point.model || point.canonicalModel)}</td>` +
            `<td class="numeric">${subscription ? compactNumber(point.fiveHourTokenInM) : '—'}</td>` +
            `<td class="numeric">${subscription ? compactNumber(point.weeklyTokenInM) : '—'}</td>` +
            `<td class="numeric">${subscription ? compactNumber(point.monthlyTokenInM) : '—'}</td>` +
            `<td class="numeric usage-table-unit-price">${unitPrice}</td>` +
            `<td class="numeric">${aaScore ? formatNumber(aaScore.score, 0) : '—'}</td>` +
            `<td class="numeric">${deepSWEScore ? `${formatNumber(deepSWEScore.score, 0)}${deepSWEInterval}` : '—'}</td>` +
            `<td class="usage-table-note">${escapeHtml(point.note || '—')}</td></tr>`;
    }

    function scoreText(point, benchmark) {
        const score = point.scores && point.scores[benchmark];
        if (!score) return '暂无评分';
        const ci = benchmark === 'deepSWE' && Number.isFinite(Number(score.confidenceInterval))
            ? ` ±${formatNumber(score.confidenceInterval, 0)}` : '';
        const config = score.configuration ? ` · ${escapeHtml(score.configuration)}` : '';
        return `${BENCHMARKS[benchmark].short} ${formatNumber(score.score, 0)}${ci}${config}`;
    }

    function tooltipHtml(point, benchmark, colorMode) {
        const modality = point.multimodal === true ? '多模态' : point.multimodal === false ? '纯文本' : '多模态状态未知';
        const billing = point.billingType === 'subscription' ? escapeHtml(point.plan || '订阅') : '按量 API';
        const platformLine = `${escapeHtml(point.vendor)} · ${billing}`;
        const modelLine = escapeHtml(point.model);
        const fee = point.billingType === 'subscription'
            ? `<div>月费：¥${formatNumber(point.monthlyFeeCny, 2)}</div><div>月额度：${compactNumber(point.monthlyTokenInM)} Token</div>`
            : '';
        const heading = colorMode === 'model'
            ? `<strong>${modelLine}</strong><div>${platformLine}</div>`
            : `<strong>${platformLine}</strong><div>${modelLine}</div>`;
        return `<div class="usage-tooltip">${heading}<div>${modality}</div>${fee}` +
            `<div>单位价格：¥${formatNumber(point.unitPriceCnyPerM, 4)} / M Token</div>` +
            `<div>${scoreText(point, benchmark)}</div></div>`;
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
            script.src = 'vendor/echarts.min.js';
            script.dataset.usageEcharts = '1';
            script.onload = () => resolve(root.echarts);
            script.onerror = () => reject(new Error('ECharts 加载失败'));
            document.head.appendChild(script);
        });
        return root.__usageEchartsPromise;
    }

    function renderShell(container) {
        container.innerHTML = `
            <section class="usage-view" aria-labelledby="usageViewTitle">
                <header class="usage-heading">
                    <div><p class="usage-eyebrow">模型购买决策</p><h2 id="usageViewTitle">额度 / 价格对比</h2></div>
                    <p>把同一套餐下的不同模型拆成独立点，比较钱花在哪里、实际能换来多少额度和模型能力。</p>
                </header>
                <div class="usage-method-note"><strong>统一口径：</strong>订阅价是“月费 ÷ 可用月额度”的摊薄成本，假设额度得到充分利用；按量价是统一工作负载下的边际调用成本。两者单位均为人民币 / M Token。</div>
                <div class="filter-bar surface-panel usage-filters" aria-label="图表筛选">
                    <div class="filter-dropdown" data-picker="vendors"><button type="button" class="filter-btn" data-picker-toggle><span>平台</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <div class="filter-dropdown" data-picker="models"><button type="button" class="filter-btn" data-picker-toggle><span>模型</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu usage-model-menu"><input class="usage-search" type="search" data-model-search placeholder="搜索模型" aria-label="搜索模型"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <label class="filter-btn usage-inline-filter"><span>多模态</span><select data-filter="multimodal" aria-label="多模态"><option value="all">全部</option><option value="multimodal">多模态</option><option value="text">纯文本</option></select></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>AA 最低分</span><input data-filter="aaScoreMin" aria-label="AA 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>DeepSWE 最低分</span><input data-filter="deepSWEScoreMin" aria-label="DeepSWE 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <div class="usage-color-control" aria-label="颜色区分方式"><span>颜色</span><div class="usage-segments"><button type="button" data-color-mode="vendor" class="is-active">按平台</button><button type="button" data-color-mode="model">按模型</button></div></div>
                    <div class="filter-trailing"><button type="button" class="reset-btn" data-action="restore-defaults">恢复默认</button><div class="stats-bar usage-counts" data-counts aria-live="polite"></div></div>
                </div>
                <div class="usage-color-legend"><strong data-color-legend-title>平台颜色</strong><div data-color-legend></div></div>
                <article class="usage-chart-card">
                    <div class="usage-chart-head"><div><h3>月费 vs 月 Token</h3><p>一个点代表一个平台 × 套餐 × 模型；越靠左上越有吸引力。</p></div><label>坐标轴<select data-scale="tokens"><option value="log">对数</option><option value="value">线性</option></select></label></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="usage" role="img" aria-label="月费和月 Token 散点图"></div><div class="usage-empty" data-empty="usage" hidden>当前筛选下没有可绘制的月费与月额度数据。</div></div>
                </article>
                <article class="usage-chart-card">
                    <div class="usage-chart-head"><div><h3>单位价格 vs 智力</h3><p>同时纳入订阅套餐与按量 API；越靠左上越有吸引力。</p></div><div class="usage-chart-controls"><div class="usage-segments" role="group" aria-label="评分指标"><button type="button" data-benchmark="artificialAnalysis" class="is-active">AA</button><button type="button" data-benchmark="deepSWE">DeepSWE</button></div><label>价格轴<select data-scale="price"><option value="log">对数</option><option value="value">线性</option></select></label></div></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="intelligence" role="img" aria-label="单位价格和智力评分散点图"></div><div class="usage-empty" data-empty="intelligence" hidden>当前筛选与评分指标下没有可绘制的数据。</div></div>
                </article>
                <article class="usage-chart-card usage-data-card">
                    <div class="usage-chart-head"><div><h3>数据明细</h3><p>汇总当前筛选下的平台 × 套餐 × 模型；按量 API 没有周期额度时显示“—”。</p></div><span class="usage-table-count" data-table-count="comparison"></span></div>
                    <section class="usage-table-section" aria-label="额度和价格数据明细"><div class="usage-table-scroll"><table class="usage-data-table" data-table="comparison"><thead>${comparisonTableHeadHtml('comparison')}</thead><tbody data-table-body="comparison"></tbody></table></div></section>
                </article>
            </section>`;
    }

    function chartBase(tooltipFormatter) {
        return {
            animationDuration: 350,
            grid: { left: 76, right: 28, top: 28, bottom: 58, containLabel: false },
            tooltip: { trigger: 'item', confine: true, appendToBody: false, formatter: tooltipFormatter },
            textStyle: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
        };
    }

    function seriesByColor(points, colorMode, colors, mapPoint, seriesPrefix, pointLabelField) {
        const grouped = new Map();
        points.forEach((point) => {
            const key = getPointColorKey(point, colorMode);
            const label = colorMode === 'model' ? point.canonicalModel : getPointLabelText(point, 'vendor');
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

    async function mountModelComparisonView(container) {
        if (!container) return;
        if (container.__usageMounted) {
            requestAnimationFrame(() => {
                container.__usageCharts && container.__usageCharts.forEach((chart) => chart.resize());
            });
            return;
        }
        if (container.__usageMountPromise) return container.__usageMountPromise;
        container.__usageMountPromise = (async () => {
            renderShell(container);
            const [echarts, response] = await Promise.all([loadEcharts(), fetch('model-comparison.json')]);
            if (!response.ok) throw new Error(`对比数据加载失败：HTTP ${response.status}`);
            const dataset = await response.json();
            const points = Array.isArray(dataset.points) ? dataset.points : [];
            const platformMap = new Map();
            points.forEach((point) => {
                const label = point.platformType ? `${point.vendor} · ${point.platformType}` : point.vendor;
                platformMap.set(getPointPlatformKey(point), label);
            });
            const platforms = [...platformMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
            const modelMap = new Map();
            points.forEach((point) => modelMap.set(point.canonicalModelId, point.canonicalModel));
            const models = [...modelMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
            const platformColors = buildVendorColorMap(platforms.map(([key]) => key));
            const modelColors = buildModelColorMap(models.map(([id]) => id));
            const state = Object.assign(createDefaultFilterState(points), {
                benchmark: 'artificialAnalysis', colorMode: 'vendor',
                tokensScale: 'log', priceScale: 'log'
            });
            const usageChart = echarts.init(container.querySelector('[data-chart="usage"]'));
            const intelligenceChart = echarts.init(container.querySelector('[data-chart="intelligence"]'));
            enableClickPinnedTooltip(usageChart);
            enableClickPinnedTooltip(intelligenceChart);
            container.__usageCharts = [usageChart, intelligenceChart];
            const tableSortState = {
                comparison: { key: 'unitPriceCnyPerM', direction: 'asc' }
            };
            const latestTableRows = { comparison: [] };

            function optionCheckbox(value, label, kind) {
                return `<label class="checkbox-item"><input type="checkbox" data-option-kind="${kind}" value="${escapeHtml(value)}"><span>${escapeHtml(label)}</span></label>`;
            }
            container.querySelector('[data-picker="vendors"] [data-options]').innerHTML = platforms.map(([key, label]) => optionCheckbox(key, label, 'platform')).join('');
            container.querySelector('[data-picker="models"] [data-options]').innerHTML = models.map(([id, name]) => optionCheckbox(id, name, 'model')).join('');

            function updatePickerCount(kind, set) {
                const label = container.querySelector(`[data-picker="${kind}"] [data-count]`);
                label.textContent = String(set.size);
                label.hidden = set.size === 0;
            }

            function syncFilterControls() {
                container.querySelectorAll('[data-option-kind="platform"]').forEach((input) => {
                    input.checked = state.platforms.has(input.value);
                });
                container.querySelectorAll('[data-option-kind="model"]').forEach((input) => {
                    input.checked = state.models.has(input.value);
                });
                container.querySelector('[data-filter="multimodal"]').value = state.multimodal;
                container.querySelector('[data-filter="aaScoreMin"]').value = state.aaScoreMin;
                container.querySelector('[data-filter="deepSWEScoreMin"]').value = state.deepSWEScoreMin;
                updatePickerCount('vendors', state.platforms);
                updatePickerCount('models', state.models);
            }

            syncFilterControls();

            function closeUsageDropdowns(except) {
                container.querySelectorAll('[data-picker]').forEach((picker) => {
                    if (picker === except) return;
                    picker.querySelector('.dropdown-menu').classList.remove('show');
                    picker.querySelector('[data-picker-toggle]').classList.remove('active');
                });
            }

            function colorContext(visiblePoints) {
                const byModel = state.colorMode === 'model';
                const colors = byModel ? modelColors : platformColors;
                const entries = new Map();
                visiblePoints.forEach((point) => {
                    const key = getPointColorKey(point, state.colorMode);
                    const label = byModel ? point.canonicalModel : getPointLabelText(point, 'vendor');
                    entries.set(key, label);
                });
                return { colors, entries };
            }

            function renderColorLegend(context) {
                container.querySelector('[data-color-legend-title]').textContent = state.colorMode === 'model' ? '模型颜色' : '平台颜色';
                container.querySelector('[data-color-legend]').innerHTML = [...context.entries.entries()]
                    .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
                    .map(([key, label]) => {
                        const solo = state.soloColorKey === key;
                        const muted = state.soloColorKey && !solo;
                        const subject = state.colorMode === 'model' ? '模型' : '平台';
                        return `<button type="button" class="usage-legend-item${solo ? ' is-solo' : ''}${muted ? ' is-muted' : ''}" data-color-key="${escapeHtml(key)}" aria-pressed="${solo ? 'true' : 'false'}" title="${solo ? '点击恢复显示全部' : `点击只显示此${subject}`}；悬停高亮"><i style="background:${context.colors[key]}"></i><span>${escapeHtml(label)}</span></button>`;
                    }).join('');
            }

            function renderDataTable(tableName, rows) {
                latestTableRows[tableName] = rows || [];
                const sort = tableSortState[tableName];
                const sorted = sortComparisonRows(rows, sort.key, sort.direction);
                const body = container.querySelector(`[data-table-body="${tableName}"]`);
                body.innerHTML = sorted.length
                    ? sorted.map(comparisonTableRowHtml).join('')
                    : `<tr><td class="usage-table-empty" colspan="${COMPARISON_TABLE_COLUMNS.length}">当前筛选下没有可展示的数据。</td></tr>`;
                container.querySelector(`[data-table-count="${tableName}"]`).textContent = `${sorted.length} 条`;
                container.querySelectorAll(`[data-table="${tableName}"] th[data-sort-key]`).forEach((header) => {
                    const active = header.dataset.sortKey === sort.key;
                    header.classList.toggle('sort-asc', active && sort.direction === 'asc');
                    header.classList.toggle('sort-desc', active && sort.direction === 'desc');
                    header.setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
                });
            }

            function render() {
                const filtered = filterPoints(points, {
                    platforms: state.platforms, models: state.models, multimodal: state.multimodal,
                    aaScoreMin: state.aaScoreMin, deepSWEScoreMin: state.deepSWEScoreMin
                });
                const visibleFiltered = filterBySoloColorKey(filtered, state.colorMode, state.soloColorKey);
                const usagePoints = buildUsageChartPoints(visibleFiltered);
                const intelligencePoints = buildIntelligenceChartPoints(visibleFiltered, state.benchmark);
                const pointLabelField = getSoloPointLabelField(visibleFiltered);
                const color = colorContext(filtered);
                renderColorLegend(color);
                const totalUsage = buildUsageChartPoints(points).length;
                const totalIntelligence = buildIntelligenceChartPoints(points, state.benchmark).length;
                container.querySelector('[data-counts]').textContent = `额度图 ${usagePoints.length}/${totalUsage} · 智力图 ${intelligencePoints.length}/${totalIntelligence}`;

                usageChart.setOption(Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode)), {
                    xAxis: { type: state.tokensScale, name: '月费（人民币）', nameLocation: 'middle', nameGap: 38, min: state.tokensScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: (v) => `¥${formatNumber(v, 0)}` }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: state.tokensScale, name: '月 Token', nameLocation: 'middle', nameGap: 55, min: state.tokensScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: compactNumber }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    series: seriesByColor(usagePoints, state.colorMode, color.colors, (point) => ({ value: [point.monthlyFeeCny, point.monthlyTokenInM], meta: point }), 'usage', pointLabelField)
                }), true);

                const intelligenceSeries = seriesByColor(
                    intelligencePoints,
                    state.colorMode,
                    color.colors,
                    (point) => ({ value: [point.unitPriceCnyPerM, getPointScore(point, state.benchmark)], meta: point }),
                    'intelligence',
                    pointLabelField
                );
                intelligenceChart.setOption(Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode)), {
                    xAxis: { type: state.priceScale, name: '人民币 / M Token', nameLocation: 'middle', nameGap: 38, min: state.priceScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: (v) => `¥${formatNumber(v, v < 1 ? 2 : 1)}` }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: 'value', name: `${BENCHMARKS[state.benchmark].short} 评分`, nameLocation: 'middle', nameGap: 45, scale: true, axisLabel: { formatter: (v) => formatNumber(v, 0) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    series: intelligenceSeries
                }), true);
                renderDataTable('comparison', visibleFiltered);
                container.querySelector('[data-empty="usage"]').hidden = usagePoints.length > 0;
                container.querySelector('[data-empty="intelligence"]').hidden = intelligencePoints.length > 0;
            }

            container.addEventListener('change', (event) => {
                const target = event.target;
                if (target.matches('[data-option-kind="platform"]')) {
                    target.checked ? state.platforms.add(target.value) : state.platforms.delete(target.value);
                    updatePickerCount('vendors', state.platforms);
                } else if (target.matches('[data-option-kind="model"]')) {
                    target.checked ? state.models.add(target.value) : state.models.delete(target.value);
                    updatePickerCount('models', state.models);
                } else if (target.matches('[data-filter="multimodal"]')) state.multimodal = target.value;
                else if (target.matches('[data-filter="aaScoreMin"]')) state.aaScoreMin = target.value;
                else if (target.matches('[data-filter="deepSWEScoreMin"]')) state.deepSWEScoreMin = target.value;
                else if (target.matches('[data-scale="tokens"]')) state.tokensScale = target.value;
                else if (target.matches('[data-scale="price"]')) state.priceScale = target.value;
                render();
            });
            container.querySelector('[data-model-search]').addEventListener('input', (event) => {
                const query = event.target.value.trim().toLocaleLowerCase('zh-CN');
                container.querySelectorAll('[data-picker="models"] [data-options] label').forEach((label) => {
                    label.hidden = query && !label.textContent.toLocaleLowerCase('zh-CN').includes(query);
                });
            });
            container.querySelectorAll('[data-filter="aaScoreMin"], [data-filter="deepSWEScoreMin"]').forEach((input) => {
                input.addEventListener('input', () => {
                    state.aaScoreMin = container.querySelector('[data-filter="aaScoreMin"]').value;
                    state.deepSWEScoreMin = container.querySelector('[data-filter="deepSWEScoreMin"]').value;
                    render();
                });
            });
            function setChartSeriesHighlight(chart, targetIds, active) {
                const series = (chart.getOption().series || []).filter((item) => item && item.id);
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
            [usageChart, intelligenceChart].forEach((chart) => {
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
                const sortHeader = event.target.closest('[data-table-sort][data-sort-key]');
                if (sortHeader) {
                    const tableName = sortHeader.dataset.tableSort;
                    const sort = tableSortState[tableName];
                    const key = sortHeader.dataset.sortKey;
                    sort.direction = sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
                    sort.key = key;
                    renderDataTable(tableName, latestTableRows[tableName]);
                    return;
                }
                const pickerToggle = event.target.closest('[data-picker-toggle]');
                if (pickerToggle) {
                    event.stopPropagation();
                    const picker = pickerToggle.closest('[data-picker]');
                    const menu = picker.querySelector('.dropdown-menu');
                    const willOpen = !menu.classList.contains('show');
                    closeUsageDropdowns(picker);
                    menu.classList.toggle('show', willOpen);
                    pickerToggle.classList.toggle('active', willOpen);
                    return;
                }
                if (event.target.closest('.dropdown-menu')) event.stopPropagation();
                const pickerDone = event.target.closest('[data-picker-done]');
                if (pickerDone) {
                    closeUsageDropdowns();
                    return;
                }
                const pickerReset = event.target.closest('[data-picker-reset]');
                if (pickerReset) {
                    const picker = pickerReset.closest('[data-picker]');
                    const kind = picker.dataset.picker;
                    const set = kind === 'vendors' ? state.platforms : state.models;
                    set.clear();
                    picker.querySelectorAll('[data-option-kind]').forEach((input) => { input.checked = false; });
                    updatePickerCount(kind, set);
                    render();
                    return;
                }
                const benchmarkButton = event.target.closest('[data-benchmark]');
                if (benchmarkButton) {
                    state.benchmark = benchmarkButton.dataset.benchmark;
                    container.querySelectorAll('[data-benchmark]').forEach((button) => button.classList.toggle('is-active', button === benchmarkButton));
                    render();
                    return;
                }
                const colorLegendItem = event.target.closest('[data-color-key]');
                if (colorLegendItem) {
                    const key = colorLegendItem.dataset.colorKey;
                    state.soloColorKey = state.soloColorKey === key ? null : key;
                    render();
                    return;
                }
                const colorModeButton = event.target.closest('[data-color-mode]');
                if (colorModeButton) {
                    state.colorMode = colorModeButton.dataset.colorMode;
                    state.soloColorKey = null;
                    container.querySelectorAll('[data-color-mode]').forEach((button) => button.classList.toggle('is-active', button === colorModeButton));
                    render();
                    return;
                }
                if (event.target.closest('[data-action="restore-defaults"]')) {
                    Object.assign(state, createDefaultFilterState(points));
                    syncFilterControls();
                    container.querySelector('[data-model-search]').value = '';
                    container.querySelectorAll('[data-picker="models"] [data-options] label').forEach((label) => { label.hidden = false; });
                    closeUsageDropdowns();
                    render();
                }
            });
            container.addEventListener('keydown', (event) => {
                if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-table-sort][data-sort-key]')) {
                    event.preventDefault();
                    event.target.click();
                }
            });
            document.addEventListener('click', () => closeUsageDropdowns());
            const resize = () => { usageChart.resize(); intelligenceChart.resize(); };
            root.addEventListener('resize', resize);
            if (root.ResizeObserver) new root.ResizeObserver(resize).observe(container);
            render();
            container.__usageMounted = true;
        })().catch((error) => {
            container.innerHTML = `<div class="usage-load-error">额度/价格对比加载失败，请稍后刷新重试。<br><small>${escapeHtml(error.message)}</small></div>`;
            container.__usageMountPromise = null;
            throw error;
        });
        return container.__usageMountPromise;
    }

    return { DEFAULT_PLATFORM_SELECTIONS, DEFAULT_MODEL_IDS, getPointScore, getPointPlatformKey, createDefaultFilterState, filterPoints, buildUsageChartPoints, buildIntelligenceChartPoints, buildVendorColorMap, buildModelColorMap, getPointColorKey, filterBySoloColorKey, getSoloPointLabelField, getPointLabelText, sortComparisonRows, comparisonTableRowHtml, tooltipHtml, mountModelComparisonView };
});
