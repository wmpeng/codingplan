(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ModelComparison = api;
    root.ModelComparisonCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const EntityData = root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null);
    const UI = root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null);
    const Numbers = root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null);
    const Help = root.CodingPlanHelp || (typeof require === 'function' ? require('./ui-help.js') : null);
    const Notices = root.ChangeNotices || (typeof require === 'function' ? require('./change-notices.js') : null);

    const Scores = root.BenchmarkScores || (typeof require === 'function' ? require('./benchmark-scores.js') : null);
    const BENCHMARKS = Scores.definitions;
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
        { key: 'plan', label: '套餐', sortable: false },
        { key: 'price', label: '首月价格' },
        { key: 'model', label: '模型' },
        { key: 'unitPriceCnyPerM', label: '综合单价' },
        { key: 'unitPriceVisual', label: '单价对比', sortable: false },
        { key: 'tokenConsumptionRate', label: 'token消耗率' },
        { key: 'priceIndexCnyPerM', label: '价格指数' },
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
            monthlyPriceMax: null, selectedColorKeys: new Set(), legendExpanded: true, tokenUnit: 'yi'
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

    function buildUnitPriceVisualScale(points, type = 'log') {
        const values = (points || [])
            .map((point) => finitePositive(point && point.unitPriceCnyPerM))
            .filter((value) => value !== null);
        return values.length
            ? { min: Math.min(...values), max: Math.max(...values), type }
            : { min: null, max: null, type };
    }

    function getUnitPriceVisualPercent(value, scale) {
        if (value === null || value === undefined || value === '') return null;
        const price = Number(value);
        if (!Number.isFinite(price) || price < 0) return null;
        if (price === 0) return 0;
        const min = scale && Number(scale.min);
        const max = scale && Number(scale.max);
        if (scale?.type === 'value') return Number.isFinite(max) && max > 0 ? Math.max(0, Math.min(100, price / max * 100)) : null;
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

    function filterBySelectedColorKeys(points, colorMode, selectedColorKeys) {
        if (!selectedColorKeys.size) return points || [];
        return (points || []).filter((point) => selectedColorKeys.has(getPointColorKey(point, colorMode)));
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
        if (key === 'priceIndexCnyPerM') return priceIndexCnyPerM(point);
        if (Scores.keys.includes(key)) return getPointScore(point, key);
        if (key === 'vendor') return point.platformName || '';
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

    function comparisonTableColumns(compact) {
        return COMPARISON_TABLE_COLUMNS.filter(column => (compact || !['tokenConsumptionRate','priceIndexCnyPerM'].includes(column.key)) && (!compact || column.key !== 'plan'));
    }

    function comparisonTableHeadHtml(tableName, compact) {
        return `<tr>${comparisonTableColumns(compact).map((column) => {
            const sortable = column.sortable !== false;
            const classes = column.key === 'vendor' ? 'sticky-first' : '';
            const sorting = sortable
                ? ` aria-sort="none" data-table-sort="${tableName}" data-sort-key="${column.key}"`
                : '';
            const label = compact && column.key === 'vendor' ? '平台 / 套餐' : compact && column.key === 'price' ? '首月价格' : column.hint
                ? `<span class="usage-table-heading"><span>${column.label}</span><small>${column.hint}</small></span>`
                : column.label;
            const helpText = column.key === 'tokenConsumptionRate'
                ? '该模型比平均多或少消耗多少输出 Token：正数为多，负数为少，0% 为平均。基于本站模型的 AA 评测（含思考与答案），不代表完成质量。'
                : column.key === 'priceIndexCnyPerM'
                ? '价格指数 = 当前口径综合单价 × token消耗倍率。例如 +50% 对应 1.5 倍，-20% 对应 0.8 倍。数值越低，考虑 Token 消耗后的参考成本越低；不代表实际账单或完成质量。单价或消耗倍率未知时显示“—”。'
                : column.key === 'unitPriceVisual'
                ? '横条按当前结果比较，并跟随上方坐标轴的对数或线性尺度；条越短，综合单价越低。线性尺度下，条长与单价成正比。'
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
            : `综合单价 ${formatUnitPrice(value, tokenUnit)} Token；当前筛选结果中的相对条长采用${visualOptions?.scale?.type === 'value' ? '线性' : '对数'}尺度`;
        return `<span class="usage-price-bar" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">` +
            `<span class="usage-price-bar-track"><span class="usage-price-bar-fill" style="--usage-price-bar-width:${formatNumber(percent, 2)}%;--usage-price-bar-color:${color}"></span></span>` +
            `</span>`;
    }

    function formatTokenConsumptionRate(value) {
        const rate = finiteNonnegative(value);
        if (rate === null) return '—';
        // Remove floating-point noise from the ratio-to-percentage conversion.
        const percent = Number(((rate - 1) * 100).toPrecision(12));
        return `${percent > 0 ? '+' : ''}${Numbers.amount(percent)}%`;
    }

    function priceIndexCnyPerM(point) {
        const price = finiteNonnegative(point?.unitPriceCnyPerM), rate = finiteNonnegative(point?.tokenConsumptionRate);
        if (price === null || rate === null) return null;
        const index = price * rate;
        return Number.isFinite(index) ? index : null;
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
        const featuredBadge = compact && visualOptions.featured ? '<span class="platform-featured-badge">精选</span>' : '';
        const identity = compact ? `<div class="price-identity">${pin}<div><div class="price-identity-title">${platformCellHtml(point)}<span>${escapeHtml(point.planName || (subscription ? '订阅' : '按量 API'))}</span>${featuredBadge}</div><div class="price-identity-meta">${statusHtml}${EntityData.harnessApiBadge(point.supportsHarnessApi)}</div></div>${generalNotice}</div>` : platformCellHtml(point) + generalNotice;
        const deepSWEInterval = deepSWEScore && Number.isFinite(Number(deepSWEScore.confidenceInterval))
            ? ` ±${formatNumber(deepSWEScore.confidenceInterval, 0)}` : '';
        const rowClasses = [visualOptions?.focused ? 'price-focus-row' : '', visualOptions?.pinned ? 'is-pinned' : '', compact && visualOptions.featured ? 'is-featured' : ''].filter(Boolean).join(' ');
        return `<tr data-point-id="${escapeHtml(point.slug)}"${rowClasses ? ` class="${rowClasses}"` : ''}>` +
            `<td class="sticky-first" data-comparison-col="vendor">${identity}</td>` +
            (compact ? '' : `<td>${escapeHtml(point.planName || (subscription ? '订阅' : '按量 API'))}<div class="plan-capabilities">${EntityData.harnessApiBadge(point.supportsHarnessApi)}</div></td>`) +
            `<td class="numeric">${price}${notice('price')}</td>` +
            `<td class="usage-table-model">${point.modelSlug ? `<a class="price-chart-model-link" href="/models/?q=${encodeURIComponent(point.modelSlug)}">${escapeHtml(point.relationLabel || point.modelName)}</a>` : escapeHtml(point.relationLabel || point.modelName)}${notice('models')}</td>` +
            `<td class="numeric usage-table-unit-price">${unitPrice}</td>` +
            `<td class="usage-table-price-visual">${unitPriceVisualHtml(point, tokenUnit, visualOptions)}</td>` +
            (compact ? `<td class="numeric" data-comparison-col="tokenConsumptionRate" title="${escapeHtml(aaScore?.configuration || '')}">${escapeHtml(formatTokenConsumptionRate(point.tokenConsumptionRate))}</td>` : '') +
            (compact ? `<td class="numeric" data-comparison-col="priceIndexCnyPerM">${formatUnitPrice(priceIndexCnyPerM(point), tokenUnit)}</td>` : '') +
            `<td class="numeric" data-comparison-col="fiveHourTokenInM">${subscription ? formatTokenAmount(point.fiveHourTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric" data-comparison-col="weeklyTokenInM">${subscription ? formatTokenAmount(point.weeklyTokenInM, tokenUnit) : '—'}</td>` +
            `<td class="numeric">${subscription ? formatTokenAmount(point.monthlyTokenInM, tokenUnit) : '—'}${notice('quota')}</td>` +
            `<td class="usage-table-api-pricing" data-comparison-col="apiPricing">${subscription ? '—' : escapeHtml(formatApiPricing(point.apiPricing))}</td>` +
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
        const fee = point.billingMode === 'subscription'
            ? `<div>首月价格：${formatSubscriptionMonthlyPrice(point)}</div><div>月额度：${formatTokenAmount(point.monthlyTokenInM, tokenUnit)} Token</div>`
            : '';
        const apiPricing = point.billingMode === 'payg'
            ? `<div>API 单价：${escapeHtml(formatApiPricing(point.apiPricing))}</div>`
            : '';
        const heading = colorMode === 'model'
            ? `<strong>${modelLine}</strong><div>${platformLine}</div>`
            : `<strong>${platformLine}</strong><div>${modelLine}</div>`;
        const unitPrice = formatUnitPrice(point.unitPriceCnyPerM, tokenUnit)
            .replace(/^([^/]+?)(?= \/)/, '<b class="usage-tooltip-price">$1</b>');
        return `<div class="usage-tooltip">${heading}` +
            `<div>单位价格：${unitPrice} Token</div>` +
            `<div class="usage-tooltip-secondary">${status}<div>${modality}</div>${fee}${apiPricing}` +
            `<div>${scoreText(point, benchmark)}</div></div></div>`;
    }

    return {
        BENCHMARKS, ATTRACTIVE_UNIT_PRICE_CNY_PER_YI, ATTRACTIVE_UNIT_PRICE_CNY_PER_M, PLATFORM_COLORS,
        DEFAULT_PLATFORM_SLUGS, DEFAULT_MODEL_SLUGS, COMPARISON_TABLE_COLUMNS, PRESET_TABLE_COLUMNS, escapeHtml,
        finitePositive, finiteNonnegative, getPointScore, getPointPlatformKey, getDefaultPlatformSelectionKeys,
        createDefaultFilterState, getMonthlyPriceBounds, priceToPercent, percentToPrice, filterPoints,
        buildUsageChartPoints, buildIntelligenceChartPoints, buildUnitPriceVisualScale,
        getUnitPriceVisualPercent, getAttractiveUnitPriceThreshold, getChartAxisBounds,
        clipRectangleAboveUnitPriceLine, getUnitPriceBoundaryPoints, buildUsageAttractiveZone,
        attractiveZoneLabel, buildUsageAttractiveZoneSeries, buildVendorColorMap, hslToHex, buildModelColorMap,
        getPointColorKey, filterBySelectedColorKeys, getSoloPointLabelField, getPointLabelText,
        platformCellHtml, formatNumber, normalizeTokenUnit, tokenAmountInUnit, unitPriceInTokenUnit,
        formatTokenAmount, formatUnitPrice, formatApiPricing, currencySymbol, formatSubscriptionMonthlyPrice,
        comparisonSortValue, sortComparisonRows, comparisonTableColumns, comparisonTableHeadHtml,
        unitPriceVisualHtml, formatTokenConsumptionRate, priceIndexCnyPerM, comparisonTableRowHtml,
        normalizePresetConfig, normalizePresetPlatformScope, buildPresetComparisonRows, getPresetModelQualifier,
        presetComparisonTableHtml, renderPresetComparisons, scoreText, tooltipHtml
    };
});
