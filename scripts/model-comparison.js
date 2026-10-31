(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ModelComparison = api;
    root.mountModelComparisonView = api.mountModelComparisonView;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const EntityData = root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null);
    const UI = root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null);
    const Numbers = root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null);
    const Help = root.CodingPlanHelp || (typeof require === 'function' ? require('./ui-help.js') : null);
    const Notices = root.ChangeNotices || (typeof require === 'function' ? require('./change-notices.js') : null);

    const Scores = root.BenchmarkScores || (typeof require === 'function' ? require('./benchmark-scores.js') : null);
    const BENCHMARKS = Scores.definitions;
    const PriceChart = root.ModelPriceChart || (typeof require === 'function' ? require('./model-price-chart.js') : null);
    const ATTRACTIVE_UNIT_PRICE_CNY_PER_YI = 15;
    const ATTRACTIVE_UNIT_PRICE_CNY_PER_M = ATTRACTIVE_UNIT_PRICE_CNY_PER_YI / 100;
    const PLATFORM_COLORS = [
        '#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2',
        '#db2777', '#4f46e5', '#65a30d', '#9333ea', '#ea580c', '#0f766e',
        '#475569', '#a16207', '#be123c', '#0369a1'
    ];
    // Featured entities come only from featured-catalog.json.
    const DEFAULT_PLATFORM_SLUGS = [];
    const DEFAULT_MODEL_SLUGS = [];
    const COMPARISON_TABLE_COLUMNS = [
        { key: 'vendor', label: '平台' },
        { key: 'plan', label: '套餐' },
        { key: 'price', label: '首月价格' },
        { key: 'model', label: '模型' },
        { key: 'tokenConsumptionRate', label: 'token消耗率' },
        { key: 'unitPriceCnyPerM', label: '综合单价' },
        { key: 'unitPriceVisual', label: '对数', sortable: false },
        { key: 'fiveHourTokenInM', label: '5h用量' },
        { key: 'weeklyTokenInM', label: '周用量' },
        { key: 'monthlyTokenInM', label: '月用量' },
        { key: 'apiPricing', label: 'API 单价（输入 / 缓存 / 输出）', sortable: false },
        ...Scores.keys.map(key => ({key, label:BENCHMARKS[key].label})),
        { key: 'note', label: '备注' }
    ];
    const PRESET_TABLE_COLUMNS = {
        single: [
            { key: 'identity', label: '平台 / 套餐' },
            { key: 'metrics', label: '综合单价 / 月用量' }
        ],
        multi: [
            { key: 'identity', label: '平台 / 模型 / 套餐' },
            { key: 'metrics', label: '综合单价 / 月用量' }
        ]
    };

    function finitePositive(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : null;
    }

    function finiteNonnegative(value) {
        if (value == null || value === '' || typeof value === 'boolean') return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
    }

    function getPointScore(point, benchmark) {
        return Scores.value(point?.scores?.[benchmark]);
    }

    function getPointPlatformKey(point) {
        return String(point.platformSlug || point.platformName || '');
    }

    function getDefaultPlatformSelectionKeys(slugs) {
        return new Set(slugs || []);
    }

    function createDefaultFilterState(points, options) {
        const availablePlatforms = new Set((points || []).map(getPointPlatformKey));
        const availableModels = new Set((points || []).map((point) => point.modelSlug));
        const full = options && options.mode === 'full';
        const configured = !full && root.CodingPlanFilters && typeof root.CodingPlanFilters.createDefaultState === 'function'
            ? root.CodingPlanFilters.createDefaultState(root.appConfig || {})
            : null;
        const defaultPlatforms = configured && configured.platformSlugs !== null
            ? configured.platformSlugs
            : [...availablePlatforms];
        const defaultModels = configured && configured.modelSlugs !== null
            ? configured.modelSlugs
            : [...availableModels];
        return {
            platforms: new Set((full ? [...availablePlatforms] : defaultPlatforms)
                .filter((key) => availablePlatforms.has(key))),
        models: new Set((full ? [...availableModels] : defaultModels).filter((slug) => availableModels.has(slug))),
        platformsSpecified: true,
            modelsSpecified: true,
            modelMatch: 'any',
            includeDiscontinued: full ? true : !!(configured && configured.includeDiscontinued),
        multimodal: 'all', aaScoreMin: '', deepSWEScoreMin: '', monthlyPriceMin: null,
            monthlyPriceMax: null, soloColorKey: null, tokenUnit: 'yi'
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
        // Share the same filtering rules with the homepage and standalone tools.
        const shared = root.CodingPlanFilters || (typeof require === 'function' ? require('./filter-state.js') : null);
        const selected = (values, specified) => specified || values.size ? [...values] : null;
        return shared.filterPoints(points, shared.normalizeState({
            ...(state.sharedFilters || {}),
            platformSlugs: state.sharedFilters ? state.sharedFilters.platformSlugs : selected(platforms, state.platformsSpecified),
            modelSlugs: state.sharedFilters ? state.sharedFilters.modelSlugs : selected(models, state.modelsSpecified),
            modelMatch: state.modelMatch === 'all' && state.modelsSpecified ? 'all' : 'any',
            includeDiscontinued: state.includeDiscontinued !== false,
            multimodal: state.multimodal,
            aaScoreMin: state.aaScoreMin,
            deepSWEScoreMin: state.deepSWEScoreMin,
            budgetCny: { min: state.monthlyPriceMin, max: state.monthlyPriceMax },
            monthlyTokenRange: state.monthlyTokenRange,
            priceRanges: state.priceRanges
        }, { mode: 'full' }), { context: state.filterContext, usdToCnyRate: root.appConfig && root.appConfig.usdToCnyRate });
    }

    function buildUsageChartPoints(points) {
        return (points || []).filter((point) =>
            point.billingMode === 'subscription' &&
            finitePositive(point.monthlyFeeCny) !== null &&
            finitePositive(point.monthlyTokenInM) !== null
        );
    }

    function buildIntelligenceChartPoints(points, benchmark, scale = 'log') {
        return (points || []).filter((point) =>
            (scale === 'value' ? finiteNonnegative(point.unitPriceCnyPerM) : finitePositive(point.unitPriceCnyPerM)) !== null &&
            getPointScore(point, benchmark) !== null
        );
    }

    function buildUnitPriceVisualScale(points) {
        const values = (points || [])
            .map((point) => finitePositive(point && point.unitPriceCnyPerM))
            .filter((value) => value !== null);
        return values.length
            ? { min: Math.min(...values), max: Math.max(...values) }
            : { min: null, max: null };
    }

    function getUnitPriceVisualPercent(value, scale) {
        if (value === null || value === undefined || value === '') return null;
        const price = Number(value);
        if (!Number.isFinite(price) || price < 0) return null;
        if (price === 0) return 0;
        const min = scale && Number(scale.min);
        const max = scale && Number(scale.max);
        if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(max) || max <= 0) return null;
        if (max <= min) return 100;
        const percent = Math.log1p(price / min) / Math.log1p(max / min) * 100;
        return Math.max(0, Math.min(100, percent));
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
            tokenUnit,
            xBounds,
            yBounds,
            polygon: clipRectangleAboveUnitPriceLine(xBounds, yBounds, threshold),
            boundary: getUnitPriceBoundaryPoints(xBounds, yBounds, threshold)
        };
    }

    function attractiveZoneLabel(unit) {
        return `≤ ${formatUnitPrice(ATTRACTIVE_UNIT_PRICE_CNY_PER_M, unit)} Token`;
    }

    function buildUsageAttractiveZoneSeries(zone) {
        return {
            id: 'usage-attractive-zone', type: 'custom', coordinateSystem: 'cartesian2d',
            silent: true, clip: true, z: 0, data: [0],
            renderItem: function (params, api) {
                const children = [];
                const polygonPoints = zone.polygon.map((point) => api.coord(point));
                if (polygonPoints.length >= 3) {
                    children.push({ type: 'polygon', shape: { points: polygonPoints }, style: { fill: 'rgba(34, 197, 94, 0.07)' } });
                }
                const boundaryPoints = zone.boundary.map((point) => api.coord(point));
                if (boundaryPoints.length === 2) {
                    children.push({ type: 'polyline', shape: { points: boundaryPoints }, style: { stroke: '#22a447', lineWidth: 1.5, lineDash: [6, 4] } });
                    children.push({ type: 'text', style: { x: params.coordSys.x + params.coordSys.width / 2, y: params.coordSys.y + 12, textAlign: 'center', text: attractiveZoneLabel(zone.tokenUnit), fill: '#15803d', font: '600 11px sans-serif', backgroundColor: 'rgba(240, 253, 244, 0.9)', padding: [3, 5], borderRadius: 4 } });
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

    function buildModelColorMap(modelSlugs) {
        const map = {};
        [...new Set(modelSlugs || [])].sort().forEach((modelSlug, index) => {
            const hue = Math.round((index * 137.508) % 360);
            const saturation = 62 + (index % 3) * 5;
            const lightness = 42 + (index % 4) * 4;
            map[modelSlug] = hslToHex(hue, saturation, lightness);
        });
        return map;
    }

    function getPointColorKey(point, colorMode) {
        return colorMode === 'model' ? point.modelSlug : getPointPlatformKey(point);
    }

    function filterBySoloColorKey(points, colorMode, soloColorKey) {
        if (!soloColorKey) return points || [];
        return (points || []).filter((point) => getPointColorKey(point, colorMode) === soloColorKey);
    }

    function getSoloPointLabelField(points) {
        const visible = points || [];
        const modelSlugs = new Set(visible.map((point) => point.modelSlug));
        const platforms = new Set(visible.map(getPointPlatformKey));
        if (modelSlugs.size === 1) return 'vendor';
        if (platforms.size === 1) return 'model';
        return null;
    }

    function getPointLabelText(point, pointLabelField) {
        if (pointLabelField === 'vendor') {
            return point.platformName;
        }
        if (pointLabelField === 'model') return point.relationLabel || point.modelName;
        return '';
    }

    const escapeHtml = UI.escapeHtml;

    function platformCellHtml(point) {
        const vendor = escapeHtml(point.platformName);
        const actionUrl = String(point.actionUrl || '').trim();
        if (point.planStatus === 'delisted' || !/^https?:\/\//i.test(actionUrl)) return `<strong>${vendor}</strong>`;
        return `<a class="usage-platform-link" data-collect-outbound data-collect-platform="${escapeHtml(point.platformSlug || '')}" data-collect-plan="${escapeHtml(point.planSlug || '')}" href="${escapeHtml(UI.sanitizeUrl(actionUrl))}" target="_blank" rel="noopener noreferrer"><strong>${vendor}</strong>${UI.externalLinkIcon}</a>`;
    }

    function formatNumber(value, maximumFractionDigits) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        return number.toLocaleString('zh-CN', { maximumFractionDigits });
    }

    function normalizeTokenUnit(unit) {
        return unit === 'B' ? 'B' : unit === 'yi' ? 'yi' : 'M';
    }

    function tokenAmountInUnit(value, unit) {
        if (value == null || value === '' || typeof value === 'boolean') return null;
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return number / Numbers.tokenFactor(normalizeTokenUnit(unit));
    }

    function unitPriceInTokenUnit(value, unit) {
        if (value == null || value === '' || typeof value === 'boolean') return null;
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return number * Numbers.tokenFactor(normalizeTokenUnit(unit));
    }

    function formatTokenAmount(value, unit) {
        if (value === 'unlimited') return '不限量';
        if (value === null || value === undefined || value === '') return '—';
        const normalized = normalizeTokenUnit(unit);
        const number = tokenAmountInUnit(value, normalized);
        if (!Number.isFinite(number)) return '—';
        return `${Numbers.tokens(number)}${Numbers.tokenUnit(normalized)}`;
    }

    function formatUnitPrice(value, unit) {
        const normalized = normalizeTokenUnit(unit);
        const number = unitPriceInTokenUnit(value, normalized);
        if (!Number.isFinite(number) || number < 0) return '—';
        return `${Numbers.unitPrice(number)} / ${Numbers.tokenUnit(normalized)}`;
    }

    function formatApiPricing(pricing) {
        if (!pricing || typeof pricing !== 'object') return '—';
        const currency = String(pricing.currency || '¥');
        const format = (value) => {
            return Numbers.unitPrice(value, currency);
        };
        const write = pricing.cacheWritePerM === undefined ? '' : ` · 缓存写入 ${format(pricing.cacheWritePerM)}`;
        const cacheLabel = pricing.cacheWritePerM === undefined ? '缓存' : '缓存读取';
        return `输入 ${format(pricing.inputPerM)}${write} · ${cacheLabel} ${format(pricing.cachePerM)} · 输出 ${format(pricing.outputPerM)} / M`;
    }

    function currencySymbol(currency) {
        const normalized = String(currency || '').trim().toUpperCase();
        if (['$', 'USD', 'US$'].includes(normalized)) return '$';
        if (['¥', '￥', 'CNY', 'RMB'].includes(normalized)) return '¥';
        return String(currency || '¥');
    }

    function formatSubscriptionMonthlyPrice(point) {
        const original = finiteNonnegative(point && point.originalMonthlyFee);
        const cny = finiteNonnegative(point && point.monthlyFeeCny);
        if (original === null && cny === null) return '未公开';
        const originalCurrency = currencySymbol(point && point.originalCurrency);
        const originalText = original === null
            ? Numbers.monthlyFee(cny)
            : Numbers.monthlyFee(original, originalCurrency);
        const isCny = originalCurrency === '¥';
        const converted = !isCny && cny !== null ? `（约 ${Numbers.monthlyFee(cny)}）` : '';
        return `${originalText}${converted} / 首月`;
    }

    function comparisonSortValue(point, key) {
        if (key === 'price') return finiteNonnegative(point.monthlyFeeCny);
        if (Scores.keys.includes(key)) return getPointScore(point, key);
        if (key === 'vendor') return point.platformName || '';
        if (key === 'plan') return point.planName || '';
        if (key === 'note') return point[key] || '';
        if (key === 'model') return point.relationLabel || point.modelName || '';
        return finiteNonnegative(point[key]);
    }

    function sortComparisonRows(points, key, direction) {
        const multiplier = direction === 'desc' ? -1 : 1;
        return [...(points || [])].sort((left, right) => {
            const a = comparisonSortValue(left, key);
            const b = comparisonSortValue(right, key);
            const aMissing = a === null || a === '';
            const bMissing = b === null || b === '';
            if (aMissing !== bMissing) return aMissing ? 1 : -1;
            let compared = 0;
            if (typeof a === 'number' && typeof b === 'number') {
                compared = (a - b) * multiplier;
            } else if (!aMissing || !bMissing) {
                compared = String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' }) * multiplier;
            }
            if (compared) return compared;
            if (key === 'unitPriceCnyPerM') {
                const aPrice = comparisonSortValue(left, 'price');
                const bPrice = comparisonSortValue(right, 'price');
                const aPriceMissing = aPrice === null || aPrice === '';
                const bPriceMissing = bPrice === null || bPrice === '';
                if (aPriceMissing !== bPriceMissing) return aPriceMissing ? 1 : -1;
                if (!aPriceMissing && !bPriceMissing && aPrice !== bPrice) return aPrice - bPrice;
            }
            return String(left.slug || '').localeCompare(String(right.slug || ''), 'zh-CN');
        });
    }

    function comparisonTableHeadHtml(tableName, compact) {
        return `<tr>${COMPARISON_TABLE_COLUMNS.filter(column => (compact || column.key !== 'tokenConsumptionRate') && (!compact || column.key !== 'plan')).map((column) => {
            const sortable = column.sortable !== false;
            const classes = column.key === 'vendor' ? 'sticky-first' : '';
            const sorting = sortable
                ? ` aria-sort="none" data-table-sort="${tableName}" data-sort-key="${column.key}"`
                : '';
            const label = compact && column.key === 'vendor' ? '平台 / 套餐' : compact && column.key === 'price' ? '首月价格' : column.hint
                ? `<span class="usage-table-heading"><span>${column.label}</span><small>${column.hint}</small></span>`
                : column.label;
            const helpText = column.key === 'tokenConsumptionRate'
                ? '基于 AA 默认评测的每任务输出 Token（含思考与答案），相对本站有效模型样本的算术平均值。×1 为平均，×1.5 表示多消耗 50%，越低越省。采用该模型 AA 评分对应配置；标注“估算”的值按参考模型倍率推算，不参与平均值计算。仅反映输出消耗，不代表相同完成质量。'
                : column.key === 'unitPriceVisual'
                ? '横条按当前结果采用对数尺度比较；条越短，综合单价越低。'
                : ['fiveHourTokenInM', 'weeklyTokenInM', 'monthlyTokenInM'].includes(column.key)
                    ? '按量 API 没有周期额度时显示“—”；订阅的未知额度不表示零。' : '';
            const help = helpText ? Help.html(`${tableName}-${column.key}-help`, `${column.label}说明`, helpText) : '';
            const heading = sortable ? `<button type="button" class="table-sort-button" aria-label="${column.label}排序">${label}</button>` : column.key === 'unitPriceVisual' ? '' : label;
            return `<th scope="col" data-comparison-col="${column.key}"${classes ? ` class="${classes}"` : ''}${sorting}>${heading}${help}</th>`;
        }).join('')}</tr>`;
    }

    function unitPriceVisualHtml(point, tokenUnit, visualOptions) {
        const value = point && point.unitPriceCnyPerM;
        const percent = getUnitPriceVisualPercent(value, visualOptions && visualOptions.scale);
        if (percent === null) return '<span class="usage-price-bar-empty">—</span>';
        const color = visualOptions && /^#[0-9a-f]{6}$/i.test(visualOptions.color || '')
            ? visualOptions.color
            : '#2563eb';
        const label = value === 0
            ? `综合单价为 ¥0 / ${normalizeTokenUnit(tokenUnit) === 'B' ? 'B' : normalizeTokenUnit(tokenUnit) === 'yi' ? '亿' : 'M'} Token`
            : `综合单价 ${formatUnitPrice(value, tokenUnit)} Token；当前筛选结果中的相对条长采用对数尺度`;
        return `<span class="usage-price-bar" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">` +
            `<span class="usage-price-bar-track"><span class="usage-price-bar-fill" style="--usage-price-bar-width:${formatNumber(percent, 2)}%;--usage-price-bar-color:${color}"></span></span>` +
            `</span>`;
    }

    function comparisonTableRowHtml(point, tokenUnit, visualOptions) {
        const notice = key => Notices.forField(visualOptions?.changes,{...point,type:'point'},key,{seen:visualOptions?.noticeSeen});
        const subscription = point.billingMode === 'subscription';
        const price = subscription ? (point.monthlyFeeCny === 0 ? '¥0 / 首月' : finitePositive(point.monthlyFeeCny) !== null
            ? formatSubscriptionMonthlyPrice(point) : '未公开') : '按量';
        const unitPrice = formatUnitPrice(point.unitPriceCnyPerM, tokenUnit);
        const aaScore = point.scores && point.scores.artificialAnalysis;
        const deepSWEScore = point.scores && point.scores.deepSWE;
        const compact = visualOptions?.compactIdentity;
        const status = point.planStatus || 'open';
        const statusHtml = status === 'open' ? '' : `<span class="tool-tag plan-status" data-price-status="${escapeHtml(status)}">${escapeHtml(UI.statusLabels[status] || status)}</span>`;
        const pin = compact ? UI.pinButton({pinned:visualOptions.pinned, label:`${visualOptions.pinned ? '取消置顶' : '置顶'} ${point.platformName} ${point.planName} ${point.relationLabel || point.modelName}`, attributes:{'data-price-pin':point.slug}}) : '';
        const generalNotice = notice('general');
        const identity = compact ? `<div class="price-identity">${pin}<div><div class="price-identity-title">${platformCellHtml(point)}<span>${escapeHtml(point.planName || (subscription ? '订阅' : '按量 API'))}</span></div><div class="price-identity-meta">${statusHtml}${EntityData.harnessApiBadge(point.supportsHarnessApi)}</div></div>${generalNotice}</div>` : platformCellHtml(point) + generalNotice;
        const deepSWEInterval = deepSWEScore && Number.isFinite(Number(deepSWEScore.confidenceInterval))
            ? ` ±${formatNumber(deepSWEScore.confidenceInterval, 0)}` : '';
        return `<tr data-point-id="${escapeHtml(point.slug)}"${[visualOptions?.focused ? 'price-focus-row' : '', visualOptions?.pinned ? 'is-pinned' : ''].filter(Boolean).length ? ` class="${[visualOptions?.focused ? 'price-focus-row' : '', visualOptions?.pinned ? 'is-pinned' : ''].filter(Boolean).join(' ')}"` : ''}>` +
            `<td class="sticky-first" data-comparison-col="vendor">${identity}</td>` +
            (compact ? '' : `<td>${escapeHtml(point.planName || (subscription ? '订阅' : '按量 API'))}<div class="plan-capabilities">${EntityData.harnessApiBadge(point.supportsHarnessApi)}</div></td>`) +
            `<td class="numeric">${price}${notice('price')}</td>` +
            `<td class="usage-table-model">${point.modelSlug ? `<a class="price-chart-model-link" href="/models/?q=${encodeURIComponent(point.modelSlug)}">${escapeHtml(point.relationLabel || point.modelName)}</a>` : escapeHtml(point.relationLabel || point.modelName)}${notice('models')}</td>` +
            (compact ? `<td class="numeric" data-comparison-col="tokenConsumptionRate" title="${escapeHtml(point.tokenConsumptionEstimated ? '按参考模型的输出消耗倍率估算' : aaScore?.configuration || '')}">${finiteNonnegative(point.tokenConsumptionRate) === null ? '—' : '×' + Numbers.amount(point.tokenConsumptionRate) + (point.tokenConsumptionEstimated ? '（估算）' : '')}</td>` : '') +
            `<td class="numeric usage-table-unit-price">${unitPrice}</td>` +
            `<td class="usage-table-price-visual">${unitPriceVisualHtml(point, tokenUnit, visualOptions)}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.fiveHourTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.weeklyTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.monthlyTokenInM, tokenUnit) : '—'}${notice('quota')}</td>` +
            `<td class="usage-table-api-pricing">${subscription ? '—' : escapeHtml(formatApiPricing(point.apiPricing))}</td>` +
            Scores.keys.map(key => `<td class="numeric" data-comparison-col="${key}" title="${escapeHtml(Scores.details(point.scores?.[key],key))}">${escapeHtml(Scores.format(point.scores?.[key],key))}${key === 'deepSWE' && deepSWEScore ? deepSWEInterval : ''}</td>`).join('') +
            `<td class="usage-table-note">${point.note ? `<details class="usage-note-disclosure"><summary>用量口径与限制</summary><div>${escapeHtml(point.note)}</div></details>` : '—'}</td></tr>`;
    }

    function normalizePresetConfig(config) {
        const source = config && typeof config === 'object' ? config : {};
        const seenIds = new Set();
        const groups = (Array.isArray(source.groups) ? source.groups : []).flatMap((group) => {
            if (!group || group.enabled === false) return [];
            const id = String(group.id || '').trim();
            const title = String(group.title || '').trim();
            const kind = group.kind === 'multi' ? 'multi' : group.kind === 'single' ? 'single' : '';
            const modelSlugs = [...new Set((Array.isArray(group.modelSlugs) ? group.modelSlugs : [])
                .map((value) => String(value || '').trim()).filter(Boolean))];
            if (!id || !title || !kind || !modelSlugs.length || seenIds.has(id)) return [];
            if (kind === 'single' && modelSlugs.length !== 1) return [];
            seenIds.add(id);
            return [{ id, title, kind, modelSlugs }];
        });
        return {
            platformSlugs: [...new Set(source.platformSlugs || [])],
            title: String(source.title || '').trim() || '常见对比',
            description: String(source.description || '').trim(),
            groups
        };
    }

    function normalizePresetPlatformScope(value) {
        return value === 'all' ? 'all' : 'featured';
    }

    function buildPresetComparisonRows(points, group, platformScope, platformSlugs) {
        const modelSlugs = new Set(group && Array.isArray(group.modelSlugs) ? group.modelSlugs : []);
        const defaultPlatformKeys = getDefaultPlatformSelectionKeys(platformSlugs);
        const scope = normalizePresetPlatformScope(platformScope);
        return sortComparisonRows((points || []).filter((point) =>
            (point.billingMode === 'subscription' || point.billingMode === 'payg') &&
            (scope === 'all' || defaultPlatformKeys.has(getPointPlatformKey(point))) &&
            modelSlugs.has(point.modelSlug) && point.planStatus !== 'delisted' && point.available !== false
        ), 'unitPriceCnyPerM', 'asc');
    }

    function getPresetModelQualifier(point) {
        return String(point && point.tierLabel || '').trim();
    }

    function presetComparisonTableHtml(group, points, tokenUnit, platformScope, options = {}) {
        const kind = group && group.kind === 'multi' ? 'multi' : 'single';
        const columns = PRESET_TABLE_COLUMNS[kind];
        const selectedModels = new Set(options.modelFilter && Array.isArray(options.selectedModelSlugs)
            ? options.selectedModelSlugs.filter(slug => group.modelSlugs.includes(slug)) : []);
        const rows = buildPresetComparisonRows(points, group, platformScope, options.platformSlugs)
            .filter(point => !selectedModels.size || selectedModels.has(point.modelSlug));
        const modelNamesBySlug = new Map((points || []).map((point) => [point.modelSlug, point.modelName]));
        const includedModels = kind === 'multi'
            ? group.modelSlugs.map((slug) => modelNamesBySlug.get(slug) || slug).join('、')
            : '';
        const modelOption = (slug, label) => `<button type="button" data-preset-model="${escapeHtml(slug)}" aria-pressed="${slug ? selectedModels.has(slug) : !selectedModels.size}">${escapeHtml(label)}</button>`;
        const subtitle = includedModels ? options.modelFilter
            ? `<div class="preset-model-filters" role="group" aria-label="${escapeHtml(group.title)}表格的模型筛选，可多选">${modelOption('', '全部')}${group.modelSlugs.map(slug => modelOption(slug, modelNamesBySlug.get(slug) || slug)).join('')}</div>`
            : `<p class="preset-model-list" aria-label="包含模型">${escapeHtml(includedModels)}</p>` : '';
        const head = `<tr>${columns.map((column) => `<th scope="col">${column.label}</th>`).join('')}</tr>`;
        const limit = options.limit || rows.length;
        const body = rows.length ? rows.map((point, index) => {
            const qualifier = kind === 'single' ? getPresetModelQualifier(point) : '';
            const planName = point.planName || (point.billingMode === 'payg' ? '按量 API' : '订阅');
            const plan = `<span class="usage-preset-plan">${escapeHtml(planName)}</span>${qualifier ? `<small class="usage-preset-qualifier">${escapeHtml(qualifier)}</small>` : ''}`;
            const price = point.billingMode === 'payg' ? '按量' : formatSubscriptionMonthlyPrice(point);
            const model = `<span class="usage-table-model">${escapeHtml(point.relationLabel || point.modelName || '—')}</span>`;
            const separator = '<span class="usage-preset-separator">·</span>';
            const primaryDetail = kind === 'multi' ? model : `<span class="usage-preset-price">${price}</span>`;
            const secondaryDetail = kind === 'multi' ? `${separator}<span class="usage-preset-price">${price}</span>` : '';
            const values = {
                identity: `<div class="usage-preset-primary-line">${platformCellHtml(point)}${primaryDetail}</div>` +
                    `<div class="usage-preset-secondary-line">${plan}${secondaryDetail}</div>`,
                metrics: `<div class="usage-preset-metric-primary${point.unitPriceCnyPerM == null ? ' is-unknown' : ''}">${formatUnitPrice(point.unitPriceCnyPerM, tokenUnit)}</div>` +
                    `<div class="usage-preset-secondary-line usage-preset-metric-secondary"><span>月用量</span><span>${point.billingMode === 'payg' ? '—' : point.monthlyTokenInM == null ? '未知' : formatTokenAmount(point.monthlyTokenInM, tokenUnit)}</span></div>`
            };
            return `<tr data-point-id="${escapeHtml(point.slug)}"${index >= limit ? ' hidden data-preset-extra' : ''}>${columns.map((column) => {
                return `<td class="${column.key === 'metrics' ? 'usage-preset-metrics' : 'usage-preset-identity'}">${values[column.key]}</td>`;
            }).join('')}</tr>`;
        }).join('') : `<tr><td class="usage-table-empty" colspan="${columns.length}">当前暂无可比较的套餐。</td></tr>`;
        return `<article class="usage-preset-card usage-preset-card--${kind}" data-preset-id="${escapeHtml(group.id)}">` +
            `<header><div><h4>${escapeHtml(group.title)}</h4>${subtitle}</div></header>` +
            `<div class="usage-preset-table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(group.title)}价格与额度"><table class="usage-preset-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>` +
            `<footer class="preset-footer"><span class="preset-total"${options.modelFilter?' data-preset-count aria-live="polite" aria-atomic="true"':''}>共 ${rows.length} 条</span>` +
            (rows.length > limit ? `<button type="button" class="preset-expand" data-preset-expand aria-expanded="false"><span>展开全部</span></button>` : '') + '</footer></article>';
    }

    function renderPresetComparisons(host, config, points, tokenUnit, platformScope, options = {}) {
        if (!host) return [];
        const normalized = normalizePresetConfig(config);
        const scope = normalizePresetPlatformScope(platformScope);
        const singles = normalized.groups.filter((group) => group.kind === 'single');
        const multis = normalized.groups.filter((group) => group.kind === 'multi');
        if (!normalized.groups.length) {
            host.hidden = true;
            host.innerHTML = '';
            return [];
        }
        host.hidden = false;
        host.innerHTML = (options.hideHeading ? '' : `<div class="usage-preset-heading"><div><h3>${escapeHtml(normalized.title)}</h3>${normalized.description && !options.hideDescription ? `<p>${escapeHtml(normalized.description)}</p>` : ''}</div></div>`) +
            (singles.length ? `<div class="usage-preset-grid usage-preset-grid--single">${singles.map((group) => presetComparisonTableHtml(group, points, tokenUnit, scope, {...options, platformSlugs: normalized.platformSlugs})).join('')}</div>` : '') +
            (multis.length ? `<div class="usage-preset-grid usage-preset-grid--multi">${multis.map((group) => presetComparisonTableHtml(group, points, tokenUnit, scope, {...options, selectedModelSlugs: options.selectedModels?.[group.id], platformSlugs: normalized.platformSlugs})).join('')}</div>` : '');
        return normalized.groups;
    }

    async function loadPresetConfig() {
        try {
            return await root.CodingPlanToolPage.loadPreset();
        } catch (error) {
            console.warn('常见对比配置加载失败:', error);
            return { groups: [] };
        }
    }

    function scoreText(point, benchmark) {
        const score = point.scores && point.scores[benchmark];
        if (!score) return '暂无评分';
        const ci = benchmark === 'deepSWE' && Number.isFinite(score.confidenceIntervalExact)
            ? ` ±${formatNumber(score.confidenceIntervalExact, 1)}` : benchmark === 'arena' ? ` [${formatNumber(score.confidenceLowerExact,2)}%, ${formatNumber(score.confidenceUpperExact,2)}%]` : '';
        const config = score.configuration ? ` · ${escapeHtml(score.configuration)}` : '';
        const date = score.publishedAt ? ` · ${escapeHtml(score.publishedAt)}` : '';
        return `${BENCHMARKS[benchmark].short} ${Scores.format(score,benchmark)}${ci}${config}${date}`;
    }

    function tooltipHtml(point, benchmark, colorMode, tokenUnit) {
        const modality = point.multimodal === true ? '多模态' : point.multimodal === false ? '纯文本' : '多模态状态未知';
        const billing = point.billingMode === 'subscription' ? escapeHtml(point.planName || '订阅') : '按量 API';
        const platformLine = `${escapeHtml(point.platformName)} · ${billing}`;
        const modelLine = escapeHtml(point.relationLabel);
        const status = point.planStatus && point.planStatus !== 'open' ? `<div>${escapeHtml(UI.statusLabels[point.planStatus] || point.planStatus)}</div>` : '';
        const basis = point.unitPriceBasis === 'firstMonth' ? `<div>综合单价按首月价格计算：${Numbers.monthlyFee(point.firstMonthPrice, currencySymbol(point.originalCurrency))}</div>` : '';
        const fee = point.billingMode === 'subscription'
            ? `<div>首月价格：${formatSubscriptionMonthlyPrice(point)}</div><div>月额度：${formatTokenAmount(point.monthlyTokenInM, tokenUnit)} Token</div>`
            : '';
        const apiPricing = point.billingMode === 'payg'
            ? `<div>API 单价：${escapeHtml(formatApiPricing(point.apiPricing))}</div>`
            : '';
        const heading = colorMode === 'model'
            ? `<strong>${modelLine}</strong><div>${platformLine}</div>`
            : `<strong>${platformLine}</strong><div>${modelLine}</div>`;
        return `<div class="usage-tooltip">${heading}${status}<div>${modality}</div>${fee}${apiPricing}${basis}` +
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
            script.src = '/vendor/echarts.min.js';
            script.dataset.usageEcharts = '1';
            script.onload = () => resolve(root.echarts);
            script.onerror = () => reject(new Error('ECharts 加载失败'));
            document.head.appendChild(script);
        });
        return root.__usageEchartsPromise;
    }

    function renderShell(container, compact) {
        container.innerHTML = `
            <section class="usage-view" aria-labelledby="usageViewTitle">
                <header class="usage-heading">
                    <div><p class="usage-eyebrow">模型购买决策</p><h2 id="usageViewTitle">价格与额度</h2></div>
                    <p>把同一套餐下的不同模型拆成独立点，比较钱花在哪里、实际能换来多少额度和模型能力。 <a class="main-view-full-link" href="/pricing/">查看完整价格与额度 →</a></p>
                </header>
                <div class="usage-method-note"><strong>统一口径：</strong>价格筛选和坐标统一按折合人民币计算，美元按当前站点汇率 USD 1 ≈ ¥${formatNumber(Number(root.appConfig && root.appConfig.usdToCnyRate) || 6.8, 2)}；表格保留原始币种。参考额度分别来自真实使用记录、官方 Token 额度、按扣减价格计算、请求估算或倍率换算，估算依据见备注。按价格计算时统一假设95%缓存命中率和0.5%的输出占比，未知额度不等于零。</div>
                <section class="usage-presets" data-presets aria-label="常见模型对比" hidden></section>
                <div class="usage-explorer-heading"><h3>完整对比</h3><p>使用筛选、图表与数据明细继续探索全部套餐和模型。</p></div>
                <div class="filter-bar surface-panel usage-filters" aria-label="图表筛选"${compact ? ' hidden' : ''}>
                    <div class="filter-dropdown" data-picker="vendors"><button type="button" class="filter-btn" data-picker-toggle><span>平台</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <div class="filter-dropdown" data-picker="models"><button type="button" class="filter-btn" data-picker-toggle><span>模型</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-count hidden>0</span></button><div class="dropdown-menu usage-model-menu"><input class="usage-search" type="search" data-model-search placeholder="搜索模型" aria-label="搜索模型"><div class="dropdown-section"><div class="checkbox-group" data-options></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-picker-reset>重置</button><button type="button" class="dropdown-btn primary" data-picker-done>确定</button></div></div></div>
                    <div class="filter-dropdown" data-picker="monthly-price"><button type="button" class="filter-btn" data-picker-toggle><span>套餐价格</span><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span><span class="count" data-price-count hidden>●</span></button><div class="dropdown-menu usage-price-menu"><div class="dropdown-section"><div class="dropdown-title">首月价格区间（人民币）</div><div class="price-slider-container"><div class="price-slider" data-price-slider><div class="slider-track"></div><div class="slider-range" data-price-range></div><div class="slider-thumb" data-price-thumb="min" role="slider" tabindex="0" aria-label="最低套餐价格"></div><div class="slider-thumb" data-price-thumb="max" role="slider" tabindex="0" aria-label="最高套餐价格"></div></div><div class="slider-values"><span class="slider-value" data-price-value="min">¥0</span><span class="slider-value" data-price-value="max">¥0</span></div></div></div><div class="dropdown-actions"><button type="button" class="dropdown-btn secondary" data-price-reset>重置</button><button type="button" class="dropdown-btn primary" data-price-apply>确定</button></div></div></div>
                    <label class="filter-btn usage-inline-filter"><span>多模态</span><select data-filter="multimodal" aria-label="多模态"><option value="all">全部</option><option value="multimodal">多模态</option><option value="text">纯文本</option></select></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>AA 最低分</span><input data-filter="aaScoreMin" aria-label="AA 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <label class="filter-btn usage-inline-filter usage-score-filter"><span>DeepSWE 最低分</span><input data-filter="deepSWEScoreMin" aria-label="DeepSWE 最低分" type="number" min="0" max="100" step="1" placeholder="不限"></label>
                    <div class="usage-color-control" aria-label="颜色区分方式"><span>颜色</span><div class="usage-segments" role="group" aria-label="颜色区分方式"><button type="button" data-color-mode="vendor" class="is-active" aria-pressed="true">按平台</button><button type="button" data-color-mode="model" aria-pressed="false">按模型</button></div></div>
                    ${compact ? '' : '<div class="filter-trailing"><button type="button" class="reset-btn" data-action="restore-defaults">恢复默认</button><div class="stats-bar usage-counts" data-counts aria-live="polite"></div></div>'}
                </div>
                <div class="price-billing-filter"><span>计费方式</span><div class="usage-segments" role="group" aria-label="计费方式"><button type="button" data-chart-billing="all" class="is-active" aria-pressed="true">全部</button><button type="button" data-chart-billing="subscription" aria-pressed="false">订阅</button><button type="button" data-chart-billing="payg" aria-pressed="false">按量 API</button></div></div>
                <article class="usage-chart-card price-intelligence-card">
                    <div class="usage-chart-head"><div><h3>模型能力与价格</h3><p>越靠左，综合单价越低；越靠上，模型评分越高。</p></div><button type="button" class="tool-button price-chart-export" data-chart-export>保存图表 ↓</button></div>
                    <div class="price-chart-toolbar">
                        <div class="usage-segments" role="group" aria-label="评分指标">${Scores.keys.map((key,index) => `<button type="button" data-benchmark="${key}" class="${index === 0 ? 'is-active' : ''}" aria-pressed="${index === 0}">${BENCHMARKS[key].label}</button>`).join('')}</div>
                        <div class="usage-scale-control"><span>价格轴</span><div class="usage-segments" data-scale="price" role="group" aria-label="价格轴"><button type="button" data-scale-value="log" class="is-active" aria-pressed="true">对数</button><button type="button" data-scale-value="value" aria-pressed="false">线性</button></div></div>
                    </div>
                    <div class="usage-color-legend"><div data-color-legend></div></div>
                    <div class="price-chart-key"><span class="price-chart-frontier" title="当前筛选下，不存在另一个价格不高、评分不低且至少一项更好的方案。仅比较综合单价与评分。">价格—能力优势前沿</span></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="intelligence" role="img" aria-label="模型能力和综合单价散点图"></div><div class="usage-empty" data-empty="intelligence" hidden>当前条件下没有可绘制的评分与价格；请调整上方筛选、计费方式或价格轴。</div></div>
                    <div class="price-chart-meta" data-chart-meta aria-live="polite"></div>
                    <div class="price-chart-detail" data-chart-detail></div>
                    <p class="price-chart-method">综合单价按全站显示设置的首月／每月价格口径计算，订阅按参考额度折算，不代表固定任务成本。<a href="/pricing/#pricingMethod">查看价格与用量口径</a></p>
                </article>
                <article class="usage-chart-card" data-usage-card>
                    <div class="usage-chart-head"><div><h3>首月价格 vs 月 Token</h3><p>一个点代表一个平台 × 套餐 × 模型；越靠左上越有吸引力。</p></div><div class="usage-scale-control"><span>坐标轴</span><div class="usage-segments" data-scale="tokens" role="group" aria-label="坐标轴"><button type="button" data-scale-value="log" class="is-active" aria-pressed="true">对数</button><button type="button" data-scale-value="value" aria-pressed="false">线性</button></div></div></div>
                    <div class="usage-chart-stage"><div class="usage-chart" data-chart="usage" role="img" aria-label="首月价格和月 Token 散点图"></div><div class="usage-empty" data-empty="usage" hidden>当前条件下没有可绘制的首月价格与月额度。<button type="button" class="price-chart-clear" data-chart-reset>重置筛选</button></div></div>
                </article>
                <article class="usage-chart-card usage-data-card">
                    <div class="usage-chart-head"><div><h3>综合单价与数据明细</h3></div><div class="usage-detail-summary"><span class="usage-table-count" data-table-count="comparison"></span><label class="usage-score-columns-control"><input type="checkbox" role="switch" data-all-scores aria-controls="pricingComparisonTable"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5"/><path d="M7.5 4v12M12.5 4v12"/></svg><span class="usage-score-columns-text">显示全部评分</span><span class="usage-score-columns-switch" aria-hidden="true"></span></label></div></div>
                    <section class="usage-table-section" aria-label="价格与额度数据明细"><div class="usage-table-scroll"><table class="usage-data-table" id="pricingComparisonTable" data-table="comparison"><thead>${comparisonTableHeadHtml('comparison', compact)}</thead><tbody data-table-body="comparison"></tbody></table></div></section>
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
        container.__usageMountPromise = (async () => {
            const Directory = mountOptions.directory;
            renderShell(container, Boolean(Directory));
            container.classList.toggle('pricing-directory', Boolean(Directory));
            const [echarts, data, presetConfig] = await Promise.all([
                loadEcharts(),
                mountOptions.data || root.CodingPlanToolPage.load(),
                mountOptions.preset || loadPresetConfig()
            ]);
            const context = data.context;
            context.modelGroups = presetConfig.groups || [];
            const rate = root.appConfig && root.appConfig.usdToCnyRate || 6.8;
            const originalPoints = root.EntityData.buildComparisonPoints(context, rate, { includeUnknown: true });
            let priceBasis = root.EntityData.displayPriceBasis();
            let points = root.EntityData.withComparisonPriceBasis(originalPoints,context,priceBasis);
            let pins = Directory ? Directory.readPins(root.localStorage, points) : [];
            let tableRenderKey = '', selectionKey = '', pageIndex = 0;
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
                allScores:false, benchmark: 'artificialAnalysis', colorMode: 'vendor',
                tokensScale: 'log', priceScale: 'log', presetPlatformScope: 'featured',
                chartBilling: 'all', selectedChartSlug: null,
                tokenUnit: root.CodingPlanDisplaySettings?.getTokenUnit() || 'yi'
            });
            const colorControl = container.querySelector('.usage-color-control');
            if (mountOptions.colorControlHost) mountOptions.colorControlHost.append(colorControl);
            function onColorModeClick(event) {
                const button = event.target.closest('[data-color-mode]');
                if (!button || state.colorMode === button.dataset.colorMode) return;
                state.colorMode = button.dataset.colorMode;
                state.soloColorKey = null;
                colorControl.querySelectorAll('[data-color-mode]').forEach(item => {
                    item.classList.toggle('is-active', item === button);
                    item.setAttribute('aria-pressed', String(item === button));
                });
                render();
            }
            colorControl.addEventListener('click', onColorModeClick);
            const usageChart = echarts.init(container.querySelector('[data-chart="usage"]'));
            const intelligenceChart = echarts.init(container.querySelector('[data-chart="intelligence"]'));
            enableClickPinnedTooltip(usageChart);

            container.__usageCharts = [usageChart, intelligenceChart];
            const tableSortState = {
                comparison: { key: 'unitPriceCnyPerM', direction: 'asc' }
            };
            const Url = root.CodingPlanFilterUrl;
            const urlSchema = Directory && {
                query:Url.text('q'), key:Url.choice('sort', COMPARISON_TABLE_COLUMNS.filter(column => column.sortable !== false).map(column => column.key), 'unitPriceCnyPerM'),
                direction:Url.choice('direction', ['asc','desc'], 'asc'),
                benchmark:Url.choice('benchmark', Scores.keys, 'artificialAnalysis'), allScores:Url.flag('allScores'),
                chartBilling:Url.choice('chartBilling', ['all','subscription','payg'], 'all')
            };
            if (Directory) {
                const saved = Url.read(urlSchema);
                search.value = saved.query || '';
                state.benchmark = saved.allScores !== true && Scores.keys.includes(saved.key)
                    ? saved.key : saved.benchmark || 'artificialAnalysis';
                state.allScores = saved.allScores === true;
                state.chartBilling = saved.chartBilling || 'all';
                tableSortState.comparison = {key:saved.key || 'unitPriceCnyPerM', direction:saved.direction || 'asc'};
            }
            const latestTableRows = { comparison: [] };
            const priceBounds = getMonthlyPriceBounds(points);
            const priceSlider = { min: priceBounds.min, max: priceBounds.max };
            let renderedPresetKey = null;
            let latestPriceGroups = [];

            function applyExternalFilter(external) {
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
                syncFilterControls();
            }

            // Chart loading can outlive a user's first filter change; read the current controller.
            const currentFilters = mountOptions.mode === 'full'
                ? document.getElementById('toolFilters')?.filterController?.getState()
                : root.__codingplanUnifiedFiltersState;
            applyExternalFilter(currentFilters || mountOptions.filterState);

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
                    const label = byModel ? point.modelName : getPointLabelText(point, 'vendor');
                    entries.set(key, label);
                });
                return { colors, entries };
            }

            function renderColorLegend(context) {
                const entries = [...context.entries.entries()].map(([slug, name]) => ({slug, name}))
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                const ordered = state.colorMode === 'model' ? UI.prioritizeFeaturedModels(entries, presetConfig.groups) : entries;
                container.querySelector('[data-color-legend]').innerHTML = ordered
                    .map(({slug:key, name:label}) => {
                        const solo = state.soloColorKey === key;
                        const muted = state.soloColorKey && !solo;
                        const subject = state.colorMode === 'model' ? '模型' : '平台';
                        return `<button type="button" class="usage-legend-item${solo ? ' is-solo' : ''}${muted ? ' is-muted' : ''}" data-color-key="${escapeHtml(key)}" aria-pressed="${solo ? 'true' : 'false'}" title="${solo ? '点击恢复显示全部' : `点击只显示此${subject}`}；悬停高亮"><i style="background:${context.colors[key]}"></i><span>${escapeHtml(label)}</span></button>`;
                    }).join('');
            }

            function renderDataTable(tableName, rows) {
                latestTableRows[tableName] = rows || [];
                const sort = tableSortState[tableName];
                if (Directory) Url.replace(urlSchema, {query:search.value, ...sort, benchmark:state.benchmark, allScores:state.allScores, chartBilling:state.chartBilling});
                let sorted = Directory ? Directory.tableRows(rows, points, pins, sortComparisonRows, sort) : sortComparisonRows(rows, sort.key, sort.direction);
                const scale = buildUnitPriceVisualScale(sorted);
                let renderKey = '';
                if (Directory) {
                    const nextSelectionKey=JSON.stringify([sorted.map(point=>point.slug),priceBasis,pins,sort]);
                    if(selectionKey!==nextSelectionKey){pageIndex=0;selectionKey=nextSelectionKey;}
                    const pagination=Directory.paginate(sorted,[...pins,...focusRelationSlugs],pageIndex);pageIndex=pagination.page;
                    sorted=pagination.rows;
                    container.querySelectorAll('[data-price-pagination]').forEach(pager=>{
                        pager.hidden=pagination.pages===1;
                        pager.querySelector('[data-price-page-label]').textContent=`${pageIndex+1} / ${pagination.pages} 页`;
                        pager.querySelectorAll('[data-price-page]').forEach(button=>button.disabled=button.dataset.pricePage==='next'?pageIndex>=pagination.pages-1:pageIndex===0);
                    });
                    renderKey = JSON.stringify([nextSelectionKey,pageIndex,state.tokenUnit,state.colorMode,state.benchmark,state.allScores]);
                    const label = `${rows.length} / ${points.length} 条明细${pins.length ? ' · 置顶 '+pins.length+' 条' : ''}`;
                    mountOptions.count.textContent = label;
                    root.CodingPlanEvents?.results({result_count:rows.length,result_key:JSON.stringify(rows.map(x=>x.slug))});
                    container.querySelector('[data-table-count]').textContent = label;
                    sortSelect.value = sort.key; sortPicker.sync();
                    directionButton.textContent = sort.direction === 'asc' ? '↑' : '↓';
                    directionButton.setAttribute('aria-label', sort.direction === 'asc' ? '改为降序' : '改为升序');
                    if (tableRenderKey === renderKey) return;
                    tableRenderKey = renderKey;
                }
                const colors = state.colorMode === 'model' ? modelColors : platformColors;
                const body = container.querySelector(`[data-table-body="${tableName}"]`);
                const noticeSeen = new Set();
                body.innerHTML = sorted.length
                    ? sorted.map((point) => comparisonTableRowHtml(point, state.tokenUnit, {
                        scale,
                        changes:context.changes, noticeSeen,
                        focused: focusRelationSlugs.has(point.slug),
                        compactIdentity:Boolean(Directory), pinned:pins.includes(point.slug),
                        color: colors[getPointColorKey(point, state.colorMode)]
                    })).join('')
                    : `<tr><td class="usage-table-empty" colspan="${COMPARISON_TABLE_COLUMNS.length - 1}">当前筛选下没有可展示的数据；请在上方下拉框调整条件，或点击“显示全部”。</td></tr>`;
                container.querySelectorAll('[data-comparison-col]').forEach(cell => {
                    const key = cell.dataset.comparisonCol;
                    cell.hidden = Scores.keys.includes(key) && !state.allScores && key !== state.benchmark;
                });
                if (!Directory) container.querySelector(`[data-table-count="${tableName}"]`).textContent = `${sorted.length} 条`;
                container.querySelectorAll(`[data-table="${tableName}"] th[data-sort-key]`).forEach((header) => {
                    const active = header.dataset.sortKey === sort.key;
                    header.classList.toggle('sort-asc', active && sort.direction === 'asc');
                    header.classList.toggle('sort-desc', active && sort.direction === 'desc');
                    header.setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
                });
            }

            let sortSelect, sortPicker, directionButton;
            if (Directory) {
                const tools = document.createElement('div'); tools.className = 'usage-detail-tools';
                tools.innerHTML = `<label data-select-fallback>排序 <select id="pricingSort" aria-label="明细排序">${COMPARISON_TABLE_COLUMNS.filter(column => column.sortable !== false).map(column => `<option value="${column.key}">${column.key === 'unitPriceCnyPerM' ? '默认（综合单价）' : column.key === 'price' ? '首月价格' : column.label}</option>`).join('')}</select></label><button class="tool-button price-sort-direction" type="button" aria-label="改为降序">↑</button>`;
                container.querySelector('.usage-detail-summary').before(tools);
                const pagerHtml='<button class="tool-button" type="button" data-price-page="first">第一页</button><button class="tool-button" type="button" data-price-page="previous">上一页</button><span data-price-page-label aria-live="polite"></span><button class="tool-button" type="button" data-price-page="next">下一页</button>';
                const pager=document.createElement('div');pager.className='price-pagination';pager.dataset.pricePagination='';pager.innerHTML=pagerHtml;
                const card=container.querySelector('.usage-data-card');card.append(pager);
                const topPager=pager.cloneNode(true);card.querySelector('.usage-chart-head').append(topPager);
                sortSelect = tools.querySelector('select'); sortSelect.value = tableSortState.comparison.key;
                sortPicker = root.CodingPlanSingleSelect.mount(sortSelect, '明细排序', {showLabel:false});
                directionButton = tools.querySelector('button.price-sort-direction');
                sortSelect.addEventListener('change', () => { tableSortState.comparison = {key:sortSelect.value,direction:'asc'}; if(Scores.keys.includes(sortSelect.value))state.benchmark=sortSelect.value; render(); });
                directionButton.addEventListener('click', () => { const sort=tableSortState.comparison; sort.direction=sort.direction==='asc'?'desc':'asc'; renderDataTable('comparison',latestTableRows.comparison); });
                search.addEventListener('input', () => { cancelAnimationFrame(renderFrame); renderFrame=requestAnimationFrame(render); });
                document.getElementById('toolFilters').addEventListener('click', event => {
                    if (event.target.closest('[data-filter-action]')) { state.chartBilling='all'; state.selectedChartSlug=null; search.value=''; tableSortState.comparison={key:'unitPriceCnyPerM',direction:'asc'}; }
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
                container.querySelectorAll('[data-benchmark]').forEach(button => {
                    button.classList.toggle('is-active',button.dataset.benchmark === state.benchmark);
                    button.setAttribute('aria-pressed',String(button.dataset.benchmark === state.benchmark));
                });
                container.querySelector('[data-all-scores]').checked = state.allScores;
                const presetRenderKey = `${state.tokenUnit}:${state.presetPlatformScope}`;
                if (renderedPresetKey !== presetRenderKey) {
                    if (!mountOptions.hidePresets) renderPresetComparisons(container.querySelector('[data-presets]'), presetConfig, points, state.tokenUnit, state.presetPlatformScope);
                    renderedPresetKey = presetRenderKey;
                }
                let filtered = filterPoints(points, {
                    platforms: state.platforms, models: state.models, multimodal: state.multimodal,
                    aaScoreMin: state.aaScoreMin, deepSWEScoreMin: state.deepSWEScoreMin,
                    monthlyPriceMin: state.monthlyPriceMin, monthlyPriceMax: state.monthlyPriceMax,
                    platformsSpecified: state.platformsSpecified, modelsSpecified: state.modelsSpecified,
                    modelMatch: state.modelMatch, includeDiscontinued: state.includeDiscontinued,
                    monthlyTokenRange: state.monthlyTokenRange,
                    priceRanges: state.priceRanges, filterContext: state.filterContext, sharedFilters: state.sharedFilters
                });
                if (Directory) filtered = Directory.search(filtered, search.value);
                const billingFiltered = filtered.filter(point => state.chartBilling === 'all' || point.billingMode === state.chartBilling);
                if (state.soloColorKey && !billingFiltered.some(point => getPointColorKey(point, state.colorMode) === state.soloColorKey)) state.soloColorKey = null;
                const visibleFiltered = filterBySoloColorKey(billingFiltered, state.colorMode, state.soloColorKey);
                const usageCard = container.querySelector('[data-usage-card]');
                const wasUsageHidden = usageCard.hidden;
                usageCard.hidden = state.chartBilling === 'payg';
                if (wasUsageHidden && !usageCard.hidden) usageChart.resize();
                const usagePoints = buildUsageChartPoints(visibleFiltered);
                const intelligencePoints = buildIntelligenceChartPoints(visibleFiltered, state.benchmark, state.priceScale);
                latestPriceGroups = PriceChart.groupPoints(intelligencePoints, state.benchmark);
                if (!latestPriceGroups.some(group => group.members.some(point => point.slug === state.selectedChartSlug))) state.selectedChartSlug = null;
                container.querySelectorAll('[data-chart-billing]').forEach(button => {
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
                    const totalIntelligence = buildIntelligenceChartPoints(points, state.benchmark, state.priceScale).length;
                    counts.textContent = `额度图 ${usagePoints.length}/${totalUsage} · 智力图 ${intelligencePoints.length}/${totalIntelligence} · 明细 ${visibleFiltered.length}/${points.length}`;
                }

                const tokenUnitLabel = Numbers.tokenUnit(state.tokenUnit);
                const usageZone = buildUsageAttractiveZone(usagePoints, state.tokenUnit, state.tokensScale);
                setScatterOptions(usageChart, Object.assign(chartBase((params) => tooltipHtml(params.data.meta, state.benchmark, state.colorMode, state.tokenUnit)), {
                    xAxis: { type: state.tokensScale, name: '首月价格（人民币）', nameLocation: 'middle', nameGap: 38, min: usageZone.xBounds.min, max: usageZone.xBounds.max, logBase: 10, axisLabel: { formatter: (v) => Numbers.monthlyFee(v) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
                    yAxis: { type: state.tokensScale, name: `月 Token（${tokenUnitLabel}）`, nameLocation: 'middle', nameGap: 55, min: usageZone.yBounds.min, max: usageZone.yBounds.max, logBase: 10, axisLabel: { formatter: (v) => Numbers.tokens(v) }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
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
                    xAxis: { type: state.priceScale, name: `综合单价（人民币 / ${tokenUnitLabel} Token）`, nameLocation: 'middle', nameGap: 38, min: state.priceScale === 'log' ? undefined : 0, logBase: 10, axisLabel: { formatter: (v) => Numbers.unitPrice(v) }, splitLine: { lineStyle: { color: '#edf1f6', type: 'dashed' } } },
                    yAxis: { type: 'value', name: state.benchmark === 'arena' ? 'Arena 净改善（%）' : `${BENCHMARKS[state.benchmark].short} 评分`, nameLocation: 'middle', nameGap: 45, scale: true, axisLabel: { formatter: (v) => state.benchmark === 'arena' ? `${formatNumber(v,1)}%` : formatNumber(v,1) }, splitLine: { lineStyle: { color: '#edf1f6' } } },
                    series: intelligenceSeries
                }), false);
                container.querySelector('[data-chart-meta]').innerHTML = PriceChart.metadataHtml(latestPriceGroups, state.benchmark, context.benchmarks?.[state.benchmark], priceBasis, visibleFiltered.length - intelligencePoints.length);
                renderChartDetail();
                renderDataTable('comparison', billingFiltered);
                container.querySelector('[data-empty="usage"]').hidden = usagePoints.length > 0;
                container.querySelector('[data-empty="intelligence"]').hidden = intelligencePoints.length > 0;
            }

            function renderChartDetail() {
                const host = container.querySelector('[data-chart-detail]');
                const disclosure = host.querySelector('details');
                const wasOpen = disclosure?.open;
                host.innerHTML = PriceChart.detailHtml(latestPriceGroups, state.selectedChartSlug, {
                    benchmark: state.benchmark, tokenUnit: state.tokenUnit,
                    tooltipHtml: point => tooltipHtml(point, state.benchmark, state.colorMode, state.tokenUnit)
                });
                if (wasOpen && host.querySelector('details')) host.querySelector('details').open = true;
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
                    container.querySelector('[data-chart-member]')?.focus({preventScroll:true});
                    return;
                }
                if (target.matches('[data-all-scores]')) {
                    state.allScores = target.checked;
                    render();
                    return;
                }
                if (target.matches('[data-option-kind="platform"]')) {
                    target.checked ? state.platforms.add(target.value) : state.platforms.delete(target.value);
                    updatePickerCount('vendors', state.platforms);
                } else if (target.matches('[data-option-kind="model"]')) {
                    target.checked ? state.models.add(target.value) : state.models.delete(target.value);
                    updatePickerCount('models', state.models);
                } else if (target.matches('[data-filter="multimodal"]')) state.multimodal = target.value;
                else if (target.matches('[data-filter="aaScoreMin"]')) state.aaScoreMin = target.value;
                else if (target.matches('[data-filter="deepSWEScoreMin"]')) state.deepSWEScoreMin = target.value;
                else return;
                render();
            });
            function onSharedFilterChange(event) {
                // Business filters supersede the temporary legend restriction; display units do not.
                if (!event || !event.detail || event.detail.source !== 'display') { state.soloColorKey = null; state.selectedChartSlug = null; }
                if (event?.detail?.source === 'reset' || event?.detail?.source === 'preset') state.chartBilling = 'all';
                applyExternalFilter(event && event.detail && event.detail.state);
                render();
            }
            root.addEventListener('codingplan:filters-changed', onSharedFilterChange);
            const onTokenUnitChange = event => { if(state.tokenUnit === event.detail.tokenUnit)return; state.tokenUnit = event.detail.tokenUnit; render(); };
            root.addEventListener('codingplan:token-unit-changed', onTokenUnitChange);
            const onPriceBasisChange = () => { priceBasis=root.EntityData.displayPriceBasis(); points=root.EntityData.withComparisonPriceBasis(originalPoints,context,priceBasis); render(); };
            root.addEventListener('codingplan:price-basis-changed',onPriceBasisChange);
            container.__usageCleanup = () => {
                colorControl.removeEventListener('click', onColorModeClick);
                root.removeEventListener('codingplan:filters-changed', onSharedFilterChange);
                root.removeEventListener('codingplan:token-unit-changed', onTokenUnitChange);
                root.removeEventListener('codingplan:price-basis-changed',onPriceBasisChange);
            };
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
                    if (Directory) {
                        document.querySelector('#toolFilters [data-filter-action="restore-defaults"]').click();
                    } else {
                        container.querySelector('[data-action="restore-defaults"]').click();
                    }
                    return;
                }
                const billingButton = event.target.closest('[data-chart-billing]');
                if (billingButton) { state.chartBilling = billingButton.dataset.chartBilling; render(); return; }
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
                const scaleButton = event.target.closest('[data-scale-value]');
                if (scaleButton) {
                    const group = scaleButton.closest('[data-scale]');
                    const key = group.dataset.scale === 'tokens' ? 'tokensScale' : 'priceScale';
                    if (state[key] === scaleButton.dataset.scaleValue) return;
                    state[key] = scaleButton.dataset.scaleValue;
                    group.querySelectorAll('button').forEach(button => {
                        const selected = button === scaleButton;
                        button.classList.toggle('is-active', selected);
                        button.setAttribute('aria-pressed', String(selected));
                    });
                    render();
                    return;
                }
                const benchmarkButton = event.target.closest('[data-benchmark]');
                if (benchmarkButton) {
                    state.benchmark = benchmarkButton.dataset.benchmark;
                    if(Scores.keys.includes(tableSortState.comparison.key))tableSortState.comparison.key=state.benchmark;
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
                const presetPlatformScopeButton = event.target.closest('[data-preset-platform-scope]');
                if (presetPlatformScopeButton) {
                    state.presetPlatformScope = normalizePresetPlatformScope(presetPlatformScopeButton.dataset.presetPlatformScope);
                    render();
                    return;
                }
                if (event.target.closest('[data-action="restore-defaults"]')) {
                    if (mountOptions.mode !== 'full' && root.__codingplanHomeApi && root.CodingPlanFilters) {
                        const sharedDefaults = root.CodingPlanFilters.createDefaultState(root.appConfig || {});
                        root.__codingplanHomeApi.setUnifiedFilters(sharedDefaults);
                        root.dispatchEvent(new CustomEvent('codingplan:filters-changed', { detail: { state: sharedDefaults } }));
                        return;
                    }
                    Object.assign(state, createDefaultFilterState(points, mountOptions));
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
            render();
            container.__usageMounted = true;
        })().catch((error) => {
            container.innerHTML = `<div class="usage-load-error">价格与额度加载失败，请稍后刷新重试。<br><small>${escapeHtml(error.message)}</small></div>`;
            container.__usageMountPromise = null;
            throw error;
        });
        return container.__usageMountPromise;
    }

    return { ATTRACTIVE_UNIT_PRICE_CNY_PER_YI, DEFAULT_PLATFORM_SLUGS, DEFAULT_MODEL_SLUGS, COMPARISON_TABLE_COLUMNS, PRESET_TABLE_COLUMNS, getPointScore, getPointPlatformKey, createDefaultFilterState, getMonthlyPriceBounds, priceToPercent, percentToPrice, filterPoints, buildUsageChartPoints, buildIntelligenceChartPoints, buildUnitPriceVisualScale, getUnitPriceVisualPercent, getAttractiveUnitPriceThreshold, getChartAxisBounds, clipRectangleAboveUnitPriceLine, getUnitPriceBoundaryPoints, buildUsageAttractiveZone, buildVendorColorMap, buildModelColorMap, getPointColorKey, filterBySoloColorKey, getSoloPointLabelField, getPointLabelText, sortComparisonRows, normalizePresetConfig, normalizePresetPlatformScope, buildPresetComparisonRows, getPresetModelQualifier, presetComparisonTableHtml, renderPresetComparisons, normalizeTokenUnit, tokenAmountInUnit, unitPriceInTokenUnit, formatTokenAmount, formatUnitPrice, formatApiPricing, platformCellHtml, unitPriceVisualHtml, comparisonTableRowHtml, tooltipHtml, mountModelComparisonView };
});
