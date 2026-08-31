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
    const ATTRACTIVE_UNIT_PRICE_CNY_PER_YI = 15;
    const ATTRACTIVE_UNIT_PRICE_CNY_PER_M = ATTRACTIVE_UNIT_PRICE_CNY_PER_YI / 100;
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
        'claude-opus-5', 'claude-sonnet-5', 'muse-spark-1-2',
        'minimax-m3', 'deepseek-v4-flash-vision-exp'
    ];
    const COMPARISON_TABLE_COLUMNS = [
        { key: 'vendor', label: '平台' },
        { key: 'platformType', label: '类型' },
        { key: 'plan', label: '套餐' },
        { key: 'price', label: '价格' },
        { key: 'model', label: '模型' },
        { key: 'unitPriceCnyPerM', label: '综合单价' },
        { key: 'fiveHourTokenInM', label: '5h用量' },
        { key: 'weeklyTokenInM', label: '周用量' },
        { key: 'monthlyTokenInM', label: '月用量' },
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
            multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '', monthlyPriceMin: null,
            monthlyPriceMax: null, soloColorKey: null, tokenUnit: 'M'
        };
    }

    function getMonthlyPriceBounds(points) {
        const prices = (points || []).map((point) => finitePositive(point.monthlyFeeCny)).filter((value) => value !== null);
        if (!prices.length) return { min: 1, max: 1000 };
        const min = Math.max(1, Math.floor(Math.min(...prices)));
        const max = Math.max(min + 1, Math.ceil(Math.max(...prices)));
        return { min, max };
    }

    function priceToPercent(value, bounds) {
        const minLog = Math.log10(bounds.min);
        const maxLog = Math.log10(bounds.max);
        const clamped = Math.max(bounds.min, Math.min(bounds.max, Number(value)));
        return ((Math.log10(clamped) - minLog) / (maxLog - minLog || 1)) * 100;
    }

    function percentToPrice(percent, bounds) {
        const clamped = Math.max(0, Math.min(100, Number(percent)));
        const minLog = Math.log10(bounds.min);
        const maxLog = Math.log10(bounds.max);
        return Math.pow(10, minLog + (clamped / 100) * (maxLog - minLog));
    }

    function filterPoints(points, filters) {
        const state = filters || {};
        const platforms = state.platforms instanceof Set ? state.platforms : new Set(state.platforms || []);
        const models = state.models instanceof Set ? state.models : new Set(state.models || []);
        const aaScoreMin = Number(state.aaScoreMin);
        const deepSWEScoreMin = Number(state.deepSWEScoreMin);
        const hasAaScoreMin = state.aaScoreMin !== '' && state.aaScoreMin !== null && Number.isFinite(aaScoreMin);
        const hasDeepSWEScoreMin = state.deepSWEScoreMin !== '' && state.deepSWEScoreMin !== null && Number.isFinite(deepSWEScoreMin);
        const hasMonthlyPriceFilter = finitePositive(state.monthlyPriceMin) !== null && finitePositive(state.monthlyPriceMax) !== null;
        return (points || []).filter((point) => {
            if (platforms.size && !platforms.has(getPointPlatformKey(point))) return false;
            if (models.size && !models.has(point.canonicalModelId)) return false;
            if (state.multimodal === 'multimodal' && point.multimodal !== true) return false;
            if (state.multimodal === 'text' && point.multimodal !== false) return false;
            const aaScore = getPointScore(point, 'artificialAnalysis');
            const deepSWEScore = getPointScore(point, 'deepSWE');
            if (hasAaScoreMin && (aaScore === null || aaScore < aaScoreMin)) return false;
            if (hasDeepSWEScoreMin && (deepSWEScore === null || deepSWEScore < deepSWEScoreMin)) return false;
            if (hasMonthlyPriceFilter) {
                const monthlyFee = finitePositive(point.monthlyFeeCny);
                if (monthlyFee === null || monthlyFee < state.monthlyPriceMin || monthlyFee > state.monthlyPriceMax) return false;
            }
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

    function buildUnitPriceBarChartPoints(points) {
        return (points || []).filter((point) =>
            finitePositive(point.unitPriceCnyPerM) !== null
        ).slice().sort((a, b) => {
            const byPrice = Number(a.unitPriceCnyPerM) - Number(b.unitPriceCnyPerM);
            if (byPrice !== 0) return byPrice;
            const byVendor = String(a.vendor || '').localeCompare(String(b.vendor || ''), 'zh-CN');
            if (byVendor !== 0) return byVendor;
            const byPlan = String(a.plan || '').localeCompare(String(b.plan || ''), 'zh-CN');
            if (byPlan !== 0) return byPlan;
            return String(a.model || a.canonicalModel || '').localeCompare(String(b.model || b.canonicalModel || ''), 'zh-CN');
        });
    }

    function getAttractiveUnitPriceThreshold(tokenUnit) {
        return unitPriceInTokenUnit(ATTRACTIVE_UNIT_PRICE_CNY_PER_M, tokenUnit);
    }

    function getChartAxisBounds(values, scale) {
        const valid = (values || []).map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (!valid.length) return scale === 'log' ? { min: 1, max: 10 } : { min: 0, max: 1 };
        const minValue = Math.min(...valid);
        const maxValue = Math.max(...valid);
        if (scale === 'log') {
            let min = Math.pow(10, Math.floor(Math.log10(minValue)));
            let max = Math.pow(10, Math.ceil(Math.log10(maxValue)));
            if (max <= min) max = min * 10;
            return { min, max };
        }
        return { min: 0, max: Math.max(1, maxValue * 1.05) };
    }

    function clipRectangleAboveUnitPriceLine(xBounds, yBounds, threshold) {
        let polygon = [
            [xBounds.min, yBounds.min], [xBounds.max, yBounds.min],
            [xBounds.max, yBounds.max], [xBounds.min, yBounds.max]
        ];
        const signedDistance = (point) => point[1] - point[0] / threshold;
        const output = [];
        polygon.forEach((current, index) => {
            const previous = polygon[(index + polygon.length - 1) % polygon.length];
            const currentDistance = signedDistance(current);
            const previousDistance = signedDistance(previous);
            const currentInside = currentDistance >= -1e-10;
            const previousInside = previousDistance >= -1e-10;
            if (currentInside !== previousInside) {
                const ratio = previousDistance / (previousDistance - currentDistance);
                output.push([
                    previous[0] + ratio * (current[0] - previous[0]),
                    previous[1] + ratio * (current[1] - previous[1])
                ]);
            }
            if (currentInside) output.push(current);
        });
        return output;
    }

    function getUnitPriceBoundaryPoints(xBounds, yBounds, threshold) {
        const candidates = [
            [xBounds.min, xBounds.min / threshold],
            [xBounds.max, xBounds.max / threshold],
            [yBounds.min * threshold, yBounds.min],
            [yBounds.max * threshold, yBounds.max]
        ];
        const points = [];
        candidates.forEach((point) => {
            if (point[0] < xBounds.min - 1e-10 || point[0] > xBounds.max + 1e-10) return;
            if (point[1] < yBounds.min - 1e-10 || point[1] > yBounds.max + 1e-10) return;
            if (!points.some((existing) => Math.abs(existing[0] - point[0]) < 1e-8 && Math.abs(existing[1] - point[1]) < 1e-8)) {
                points.push(point);
            }
        });
        return points.sort((a, b) => a[0] - b[0]).slice(0, 2);
    }

    function buildUsageAttractiveZone(points, tokenUnit, scale) {
        const threshold = getAttractiveUnitPriceThreshold(tokenUnit);
        const xBounds = getChartAxisBounds((points || []).map((point) => point.monthlyFeeCny), scale);
        const yBounds = getChartAxisBounds((points || []).map((point) => tokenAmountInUnit(point.monthlyTokenInM, tokenUnit)), scale);
        return {
            threshold,
            xBounds,
            yBounds,
            polygon: clipRectangleAboveUnitPriceLine(xBounds, yBounds, threshold),
            boundary: getUnitPriceBoundaryPoints(xBounds, yBounds, threshold)
        };
    }

    function attractiveZoneLabel() {
        return `≤ ¥${ATTRACTIVE_UNIT_PRICE_CNY_PER_YI} / 亿 Token`;
    }

    function buildUsageAttractiveZoneSeries(zone) {
        return {
            id: 'usage-attractive-zone', type: 'custom', coordinateSystem: 'cartesian2d',
            silent: true, clip: true, z: 0, data: [0],
            renderItem: function (_params, api) {
                const children = [];
                const polygonPoints = zone.polygon.map((point) => api.coord(point));
                if (polygonPoints.length >= 3) {
                    children.push({ type: 'polygon', shape: { points: polygonPoints }, style: { fill: 'rgba(34, 197, 94, 0.11)' } });
                }
                const boundaryPoints = zone.boundary.map((point) => api.coord(point));
                if (boundaryPoints.length === 2) {
                    children.push({ type: 'polyline', shape: { points: boundaryPoints }, style: { stroke: '#22a447', lineWidth: 1.5, lineDash: [6, 4] } });
                    const midpoint = [(boundaryPoints[0][0] + boundaryPoints[1][0]) / 2, (boundaryPoints[0][1] + boundaryPoints[1][1]) / 2];
                    children.push({ type: 'text', style: { x: midpoint[0] + 8, y: midpoint[1] - 10, text: attractiveZoneLabel(), fill: '#15803d', font: '600 11px sans-serif', backgroundColor: 'rgba(240, 253, 244, 0.9)', padding: [3, 5], borderRadius: 4 } });
                }
                return { type: 'group', children };
            }
        };
    }

    function buildIntelligenceAttractiveZoneSeries(threshold, scoreReference) {
        return {
            id: 'intelligence-attractive-zone', type: 'custom', coordinateSystem: 'cartesian2d',
            silent: true, clip: true, z: 0, data: [[threshold, scoreReference]],
            renderItem: function (params, api) {
                const coord = api.coord([threshold, scoreReference]);
                const left = params.coordSys.x;
                const right = params.coordSys.x + params.coordSys.width;
                const boundaryX = Math.max(left, Math.min(right, coord[0]));
                const children = [];
                if (boundaryX > left) {
                    children.push({ type: 'rect', shape: { x: left, y: params.coordSys.y, width: boundaryX - left, height: params.coordSys.height }, style: { fill: 'rgba(34, 197, 94, 0.11)' } });
                }
                if (boundaryX > left && boundaryX < right) {
                    children.push({ type: 'line', shape: { x1: boundaryX, y1: params.coordSys.y, x2: boundaryX, y2: params.coordSys.y + params.coordSys.height }, style: { stroke: '#22a447', lineWidth: 1.5, lineDash: [6, 4] } });
                    children.push({ type: 'text', style: { x: boundaryX - 8, y: params.coordSys.y + 14, text: attractiveZoneLabel(), textAlign: 'right', fill: '#15803d', font: '600 11px sans-serif', backgroundColor: 'rgba(240, 253, 244, 0.9)', padding: [3, 5], borderRadius: 4 } });
                }
                return { type: 'group', children };
            }
        };
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

    function platformCellHtml(point) {
        const vendor = escapeHtml(point.vendor);
        const actionUrl = String(point.actionUrl || '').trim();
        if (!/^https?:\/\//i.test(actionUrl)) return `<strong>${vendor}</strong>`;
        return `<a class="usage-platform-link" href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer"><strong>${vendor}</strong><span aria-hidden="true">↗</span></a>`;
    }

    function formatNumber(value, maximumFractionDigits) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        return number.toLocaleString('zh-CN', { maximumFractionDigits });
    }

    function normalizeTokenUnit(unit) {
        return unit === 'yi' ? 'yi' : 'M';
    }

    function tokenAmountInUnit(value, unit) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return normalizeTokenUnit(unit) === 'yi' ? number / 100 : number;
    }

    function unitPriceInTokenUnit(value, unit) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return normalizeTokenUnit(unit) === 'yi' ? number * 100 : number;
    }

    function formatTokenAmount(value, unit) {
        if (value === null || value === undefined || value === '') return '—';
        const normalized = normalizeTokenUnit(unit);
        const number = tokenAmountInUnit(value, normalized);
        if (!Number.isFinite(number)) return '—';
        const digits = number < 1 ? 3 : number < 10 ? 2 : 1;
        return `${formatNumber(number, digits)}${normalized === 'yi' ? '亿' : 'M'}`;
    }

    function formatUnitPrice(value, unit) {
        const normalized = normalizeTokenUnit(unit);
        const number = unitPriceInTokenUnit(value, normalized);
        if (!Number.isFinite(number) || number <= 0) return '—';
        return `¥${formatNumber(number, 4)} / ${normalized === 'yi' ? '亿' : 'M'}`;
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

    function comparisonTableRowHtml(point, tokenUnit) {
        const subscription = point.billingType === 'subscription';
        const price = subscription && finitePositive(point.monthlyFeeCny) !== null
            ? `¥${formatNumber(point.monthlyFeeCny, 2)} / 月` : '按量';
        const unitPrice = formatUnitPrice(point.unitPriceCnyPerM, tokenUnit);
        const aaScore = point.scores && point.scores.artificialAnalysis;
        const deepSWEScore = point.scores && point.scores.deepSWE;
        const deepSWEInterval = deepSWEScore && Number.isFinite(Number(deepSWEScore.confidenceInterval))
            ? ` ±${formatNumber(deepSWEScore.confidenceInterval, 0)}` : '';
        return `<tr data-point-id="${escapeHtml(point.id)}">` +
            `<td class="sticky-first">${platformCellHtml(point)}</td>` +
            `<td>${escapeHtml(point.platformType || '—')}</td>` +
            `<td>${escapeHtml(point.plan || (subscription ? '订阅' : '按量 API'))}</td>` +
            `<td class="numeric">${price}</td>` +
            `<td class="usage-table-model">${escapeHtml(point.model || point.canonicalModel)}</td>` +
            `<td class="numeric usage-table-unit-price">${unitPrice}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.fiveHourTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.weeklyTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.monthlyTokenInM, tokenUnit) : '—'}</td>` +
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

    function tooltipHtml(point, benchmark, colorMode, tokenUnit) {
        const modality = point.multimodal === true ? '多模态' : point.multimodal === false ? '纯文本' : '多模态状态未知';
        const billing = point.billingType === 'subscription' ? escapeHtml(point.plan || '订阅') : '按量 API';
        const platformLine = `${escapeHtml(point.vendor)} · ${billing}`;
        const modelLine = escapeHtml(point.model);
        const fee = point.billingType === 'subscription'
            ? `<div>月费：¥${formatNumber(point.monthlyFeeCny, 2)}</div><div>月额度：${formatTokenAmount(point.monthlyTokenInM, tokenUnit)} Token</div>`
            : '';
        const heading = colorMode === 'model'
            ? `<strong>${modelLine}</strong><div>${platformLine}</div>`
            : `<strong>${platformLine}</strong><div>${modelLine}</div>`;
        return `<div class="usage-tooltip">${heading}<div>${modality}</div>${fee}` +
            `<div>单位价格：${formatUnitPrice(point.unitPriceCnyPerM, tokenUnit)} Token</div>` +
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
                <div class="usage-method-note"><strong>统一口径：</strong>订阅价是“月费 ÷ 可用月额度”的摊薄成本，假设额度得到充分利用；按量价是统一工作负载下的边际调用成本。用量和单位价格可统一切换为 M Token 或亿 Token。</div>
                <div class="filter-bar surface-panel usage-filters" aria-label="图表筛选">
                    <div class="filter-dropdown" data-picker="vendors"><button type="button" class="filter-btn" data-picker-toggle><span>平台</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <div class="filter-dropdown" data-picker="models"><button type="button" class="filter-btn" data-picker-toggle><span>模型</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu usage-model-menu"><input class="usage-search" type="search" data-model-search placeholder="搜索模型" aria-label="搜索模型"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <div class="filter-dropdown" data-picker="monthly-price"><button type="button" class="filter-btn" data-picker-toggle><span>套餐价格</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-price-count hidden>●</span></button><div class="dropdown-menu usage-price-menu"><div class="dropdown-section"><div class="dropdown-title">包月价格区间（人民币）</div><div class="price-slider-container"><div class="price-slider" data-price-slider><div class="slider-track"></div><div class="slider-range" data-price-range></div><div class="slider-thumb" data-price-thumb="min" role="slider" tabindex="0" aria-label="最低套餐价格"></div><div class="slider-thumb" data-price-thumb="max" role="slider" tabindex="0" aria-label="最高套餐价格"></div></div><div class="slider-values"><span class="slider-value" data-price-value="min">¥0</span><span class="slider-value" data-price-value="max">¥0</span></div></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-price-reset>重置</button><button type="button" class="dropdown-btn primary" data-price-apply>确定</button></div></div></div>
                    <label class="filter-btn usage-inline-filter"><span>多模态</span><select data-filter="multimodal" aria-label="多模态"><option value="all">全部</option><option value="multimodal">多模态</option><option value="text">纯文本</option></select></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>AA 最低分</span><input data-filter="aaScoreMin" aria-label="AA 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>DeepSWE 最低分</span><input data-filter="deepSWEScoreMin" aria-label="DeepSWE 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <div class="usage-color-control" aria-label="颜色区分方式"><span>颜色</span><div class="usage-segments"><button type="button" data-color-mode="vendor" class="is-active">按平台</button><button type="button" data-color-mode="model">按模型</button></div></div>
                    <div class="usage-unit-control" aria-label="Token 单位"><span>单位</span><div class="usage-segments"><button type="button" data-token-unit="M" class="is-active">M</button><button type="button" data-token-unit="yi">亿</button></div></div>
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
                <article class="usage-chart-card">
                    <div class="usage-chart-head"><div><h3>综合单价</h3><p>按当前筛选结果从低到高排列；横向滚动查看全部平台 × 套餐 × 模型。</p></div></div>
                    <div class="usage-chart-stage usage-bar-chart-stage"><div class="usage-unit-price-scroll"><div class="usage-unit-price-chart" data-chart="unit-price" role="img" aria-label="各平台套餐模型综合单价柱状图"></div></div><div class="usage-empty" data-empty="unit-price" hidden>当前筛选下没有可绘制的综合单价数据。</div></div>
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

    function getUnitPriceBarAxisLabel(point) {
        const plan = point.billingType === 'subscription' ? (point.plan || '订阅') : '按量 API';
        return `${point.vendor || '未知平台'} · ${plan} · ${point.model || point.canonicalModel || '未知模型'}`;
    }

    function buildUnitPriceBarSeries(points, colorMode, colors, tokenUnit) {
        const categories = points.map(getUnitPriceBarAxisLabel);
        const grouped = new Map();
        points.forEach((point, index) => {
            const key = getPointColorKey(point, colorMode);
            const label = colorMode === 'model' ? point.canonicalModel : getPointLabelText(point, 'vendor');
            if (!grouped.has(key)) grouped.set(key, { label, data: Array(points.length).fill(null) });
            grouped.get(key).data[index] = {
                value: unitPriceInTokenUnit(point.unitPriceCnyPerM, tokenUnit),
                meta: point
            };
        });
        return {
            categories,
            series: [...grouped.entries()].map(([key, group]) => ({
                id: `unit-price:${key}`,
                name: group.label,
                type: 'bar',
                data: group.data,
                barMaxWidth: 24,
                barGap: '-100%',
                itemStyle: { color: colors[key], borderRadius: [4, 4, 0, 0] },
                emphasis: { focus: 'series', blurScope: 'coordinateSystem', itemStyle: { opacity: 1 } },
                blur: { itemStyle: { opacity: 0.1 } },
                label: {
                    show: true,
                    position: 'top',
                    distance: 4,
                    color: '#475569',
                    fontSize: 9,
                    fontWeight: 600,
                    formatter: (params) => `¥${formatNumber(params.value, params.value < 0.1 ? 3 : 2)}`
                }
            }))
        };
    }

    function sizeUnitPriceBarChart(chartElement, itemCount) {
        if (!chartElement) return;
        const scrollHost = chartElement.parentElement;
        const hostWidth = scrollHost && scrollHost.clientWidth ? scrollHost.clientWidth : 0;
        chartElement.style.width = `${Math.max(hostWidth, itemCount * 46 + 90)}px`;
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
            const unitPriceBarElement = container.querySelector('[data-chart="unit-price"]');
            const unitPriceBarChart = echarts.init(unitPriceBarElement);
            enableClickPinnedTooltip(usageChart);
            enableClickPinnedTooltip(intelligenceChart);
            enableClickPinnedTooltip(unitPriceBarChart);
            container.__usageCharts = [usageChart, intelligenceChart, unitPriceBarChart];
            const tableSortState = {
                comparison: { key: 'unitPriceCnyPerM', direction: 'asc' }
            };
            const latestTableRows = { comparison: [] };
            const priceBounds = getMonthlyPriceBounds(points);
            const priceSlider = { min: priceBounds.min, max: priceBounds.max };

            function updatePriceSliderVisuals(minValue, maxValue) {
                const first = Math.max(priceBounds.min, Math.min(priceBounds.max, Math.round(minValue)));
                const second = Math.max(priceBounds.min, Math.min(priceBounds.max, Math.round(maxValue)));
                priceSlider.min = Math.min(first, second);
                priceSlider.max = Math.max(first, second);
                const minPercent = priceToPercent(priceSlider.min, priceBounds);
                const maxPercent = priceToPercent(priceSlider.max, priceBounds);
                const minThumb = container.querySelector('[data-price-thumb="min"]');
                const maxThumb = container.querySelector('[data-price-thumb="max"]');
                const range = container.querySelector('[data-price-range]');
                minThumb.style.left = `${minPercent}%`;
                maxThumb.style.left = `${maxPercent}%`;
                range.style.left = `${minPercent}%`;
                range.style.width = `${maxPercent - minPercent}%`;
                container.querySelector('[data-price-value="min"]').textContent = `¥${formatNumber(priceSlider.min, 0)}`;
                container.querySelector('[data-price-value="max"]').textContent = `¥${formatNumber(priceSlider.max, 0)}`;
                minThumb.setAttribute('aria-valuemin', String(priceBounds.min));
                minThumb.setAttribute('aria-valuemax', String(priceSlider.max));
                minThumb.setAttribute('aria-valuenow', String(priceSlider.min));
                maxThumb.setAttribute('aria-valuemin', String(priceSlider.min));
                maxThumb.setAttribute('aria-valuemax', String(priceBounds.max));
                maxThumb.setAttribute('aria-valuenow', String(priceSlider.max));
            }

            function syncPriceSliderFromState() {
                updatePriceSliderVisuals(
                    state.monthlyPriceMin === null ? priceBounds.min : state.monthlyPriceMin,
                    state.monthlyPriceMax === null ? priceBounds.max : state.monthlyPriceMax
                );
            }

            function syncPriceFilterControl() {
                const active = state.monthlyPriceMin !== null && state.monthlyPriceMax !== null;
                const picker = container.querySelector('[data-picker="monthly-price"]');
                picker.querySelector('[data-picker-toggle]').classList.toggle('active', active);
                picker.querySelector('[data-price-count]').hidden = !active;
            }

            function bindPriceSlider() {
                const slider = container.querySelector('[data-price-slider]');
                let dragging = null;
                const move = (event) => {
                    if (!dragging) return;
                    const pointer = event.touches ? event.touches[0] : event;
                    const rect = slider.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(100, ((pointer.clientX - rect.left) / rect.width) * 100));
                    const value = percentToPrice(percent, priceBounds);
                    if (dragging === 'min') updatePriceSliderVisuals(Math.min(value, priceSlider.max), priceSlider.max);
                    else updatePriceSliderVisuals(priceSlider.min, Math.max(value, priceSlider.min));
                };
                const stop = () => {
                    dragging = null;
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', stop);
                    document.removeEventListener('touchmove', move);
                    document.removeEventListener('touchend', stop);
                };
                container.querySelectorAll('[data-price-thumb]').forEach((thumb) => {
                    const start = (event) => {
                        event.preventDefault();
                        dragging = thumb.dataset.priceThumb;
                        document.addEventListener('mousemove', move);
                        document.addEventListener('mouseup', stop);
                        document.addEventListener('touchmove', move, { passive: false });
                        document.addEventListener('touchend', stop);
                    };
                    thumb.addEventListener('mousedown', start);
                    thumb.addEventListener('touchstart', start, { passive: false });
                    thumb.addEventListener('keydown', (event) => {
                        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1
                            : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0;
                        if (!direction) return;
                        event.preventDefault();
                        const step = Math.max(1, Math.round((priceBounds.max - priceBounds.min) / 100));
                        if (thumb.dataset.priceThumb === 'min') updatePriceSliderVisuals(priceSlider.min + direction * step, priceSlider.max);
                        else updatePriceSliderVisuals(priceSlider.min, priceSlider.max + direction * step);
                    });
                });
                updatePriceSliderVisuals(priceBounds.min, priceBounds.max);
            }

            bindPriceSlider();

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
                container.querySelectorAll('[data-token-unit]').forEach((button) => button.classList.toggle('is-active', button.dataset.tokenUnit === state.tokenUnit));
                syncPriceSliderFromState();
                syncPriceFilterControl();
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
                    ? sorted.map((point) => comparisonTableRowHtml(point, state.tokenUnit)).join('')
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
                    aaScoreMin: state.aaScoreMin, deepSWEScoreMin: state.deepSWEScoreMin,
                    monthlyPriceMin: state.monthlyPriceMin, monthlyPriceMax: state.monthlyPriceMax
                });
                const visibleFiltered = filterBySoloColorKey(filtered, state.colorMode, state.soloColorKey);
                const usagePoints = buildUsageChartPoints(visibleFiltered);
                const intelligencePoints = buildIntelligenceChartPoints(visibleFiltered, state.benchmark);
                const unitPriceBarPoints = buildUnitPriceBarChartPoints(visibleFiltered);
                const pointLabelField = getSoloPointLabelField(visibleFiltered);
                const color = colorContext(filtered);
                renderColorLegend(color);
                const totalUsage = buildUsageChartPoints(points).length;
                const totalIntelligence = buildIntelligenceChartPoints(points, state.benchmark).length;
                const totalUnitPrice = buildUnitPriceBarChartPoints(points).length;
                container.querySelector('[data-counts]').textContent = `额度图 ${usagePoints.length}/${totalUsage} · 智力图 ${intelligencePoints.length}/${totalIntelligence} · 单价图 ${unitPriceBarPoints.length}/${totalUnitPrice}`;

                const tokenUnitLabel = state.tokenUnit === 'yi' ? '亿' : 'M';
                const usageZone = buildUsageAttractiveZone(usagePoints, state.tokenUnit, state.tokensScale);
                usageChart.setOption(Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit)), {
                    xAxis: { type: state.tokensScale, name: '月费（人民币）', nameLocation: 'middle', nameGap: 38, min: usageZone.xBounds.min, max: usageZone.xBounds.max, logBase: 10, axisLabel: { formatter: (v) => `¥${formatNumber(v, 0)}` }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: state.tokensScale, name: `月 Token（${tokenUnitLabel}）`, nameLocation: 'middle', nameGap: 55, min: usageZone.yBounds.min, max: usageZone.yBounds.max, logBase: 10, axisLabel: { formatter: (v) => formatNumber(v, v < 1 ? 3 : v < 10 ? 2 : 1) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    series: [buildUsageAttractiveZoneSeries(usageZone), ...seriesByColor(usagePoints, state.colorMode, color.colors, (point) => ({ value: [point.monthlyFeeCny, tokenAmountInUnit(point.monthlyTokenInM, state.tokenUnit)], meta: point }), 'usage', pointLabelField)]
                }), true);

                const intelligenceSeries = seriesByColor(
                    intelligencePoints,
                    state.colorMode,
                    color.colors,
                    (point) => ({ value: [unitPriceInTokenUnit(point.unitPriceCnyPerM, state.tokenUnit), getPointScore(point, state.benchmark)], meta: point }),
                    'intelligence',
                    pointLabelField
                );
                const intelligenceScores = intelligencePoints
                    .map((point) => getPointScore(point, state.benchmark))
                    .filter((value) => value !== null);
                const intelligenceScoreReference = intelligenceScores.length ? Math.min(...intelligenceScores) : 0;
                intelligenceChart.setOption(Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit)), {
                    xAxis: { type: state.priceScale, name: `人民币 / ${tokenUnitLabel} Token`, nameLocation: 'middle', nameGap: 38, min: state.priceScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: (v) => `¥${formatNumber(v, v < 1 ? 2 : 1)}` }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: 'value', name: `${BENCHMARKS[state.benchmark].short} 评分`, nameLocation: 'middle', nameGap: 45, scale: true, axisLabel: { formatter: (v) => formatNumber(v, 0) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    series: [
                        buildIntelligenceAttractiveZoneSeries(
                            getAttractiveUnitPriceThreshold(state.tokenUnit),
                            intelligenceScoreReference
                        ),
                        ...intelligenceSeries
                    ]
                }), true);
                const unitPriceBar = buildUnitPriceBarSeries(unitPriceBarPoints, state.colorMode, color.colors, state.tokenUnit);
                sizeUnitPriceBarChart(unitPriceBarElement, unitPriceBarPoints.length);
                unitPriceBarChart.resize();
                unitPriceBarChart.setOption({
                    animationDuration: 420,
                    grid: { left: 62, right: 20, top: 42, bottom: 205 },
                    tooltip: { trigger: 'item', confine: true, appendToBody: false, formatter: (params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit) },
                    textStyle: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
                    xAxis: {
                        type: 'category', data: unitPriceBar.categories,
                        axisTick: { alignWithLabel: true },
                        axisLabel: { interval: 0, rotate: 58, hideOverlap: false, color: '#64748b', fontSize: 10 },
                        axisLine: { lineStyle: { color: '#cbd5e1' } }
                    },
                    yAxis: {
                        type: 'value', name: `人民币 / ${tokenUnitLabel} Token`, nameLocation: 'end', nameGap: 10,
                        axisLabel: { color: '#64748b', formatter: (value) => `¥${formatNumber(value, value < 1 ? 2 : 1)}` },
                        splitLine: { lineStyle: { color: '#e5e7eb' } }
                    },
                    series: unitPriceBar.series
                }, true);
                renderDataTable('comparison', visibleFiltered);
                container.querySelector('[data-empty="usage"]').hidden = usagePoints.length > 0;
                container.querySelector('[data-empty="intelligence"]').hidden = intelligencePoints.length > 0;
                container.querySelector('[data-empty="unit-price"]').hidden = unitPriceBarPoints.length > 0;
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
                setChartSeriesHighlight(unitPriceBarChart, [`unit-price:${key}`], active);
            }
            [usageChart, intelligenceChart, unitPriceBarChart].forEach((chart) => {
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
                    if (willOpen && picker.dataset.picker === 'monthly-price') syncPriceSliderFromState();
                    closeUsageDropdowns(picker);
                    menu.classList.toggle('show', willOpen);
                    pickerToggle.classList.toggle('active', willOpen);
                    return;
                }
                if (event.target.closest('.dropdown-menu')) event.stopPropagation();
                const priceReset = event.target.closest('[data-price-reset]');
                if (priceReset) {
                    updatePriceSliderVisuals(priceBounds.min, priceBounds.max);
                    return;
                }
                const priceApply = event.target.closest('[data-price-apply]');
                if (priceApply) {
                    const fullRange = priceSlider.min === priceBounds.min && priceSlider.max === priceBounds.max;
                    state.monthlyPriceMin = fullRange ? null : priceSlider.min;
                    state.monthlyPriceMax = fullRange ? null : priceSlider.max;
                    closeUsageDropdowns();
                    syncPriceFilterControl();
                    render();
                    return;
                }
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
                const tokenUnitButton = event.target.closest('[data-token-unit]');
                if (tokenUnitButton) {
                    state.tokenUnit = normalizeTokenUnit(tokenUnitButton.dataset.tokenUnit);
                    container.querySelectorAll('[data-token-unit]').forEach((button) => button.classList.toggle('is-active', button === tokenUnitButton));
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
            const resize = () => {
                usageChart.resize();
                intelligenceChart.resize();
                sizeUnitPriceBarChart(unitPriceBarElement, buildUnitPriceBarChartPoints(filterBySoloColorKey(filterPoints(points, state), state.colorMode, state.soloColorKey)).length);
                unitPriceBarChart.resize();
            };
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

    return { ATTRACTIVE_UNIT_PRICE_CNY_PER_YI, DEFAULT_PLATFORM_SELECTIONS, DEFAULT_MODEL_IDS, COMPARISON_TABLE_COLUMNS, getPointScore, getPointPlatformKey, createDefaultFilterState, getMonthlyPriceBounds, priceToPercent, percentToPrice, filterPoints, buildUsageChartPoints, buildIntelligenceChartPoints, buildUnitPriceBarChartPoints, buildUnitPriceBarSeries, getUnitPriceBarAxisLabel, getAttractiveUnitPriceThreshold, getChartAxisBounds, clipRectangleAboveUnitPriceLine, getUnitPriceBoundaryPoints, buildUsageAttractiveZone, buildVendorColorMap, buildModelColorMap, getPointColorKey, filterBySoloColorKey, getSoloPointLabelField, getPointLabelText, sortComparisonRows, normalizeTokenUnit, tokenAmountInUnit, unitPriceInTokenUnit, formatTokenAmount, formatUnitPrice, platformCellHtml, comparisonTableRowHtml, tooltipHtml, mountModelComparisonView };
});
