(function () {
    var DERIVED_FILE_PATH = './index-usage-derived.json';
    var panel = document.getElementById('planUsagePanel');
    var stateEl = document.getElementById('planUsageState');
    var valueChartEl = document.getElementById('planUsageValueChart');
    var costChartEl = document.getElementById('planUsageCostChart');
    var windowButtons = Array.prototype.slice.call(document.querySelectorAll('[data-usage-window]'));
    var valueMetricButtons = Array.prototype.slice.call(document.querySelectorAll('[data-usage-value-metric]'));
    var valueTitleEl = document.getElementById('planUsageValueTitle');
    var valueSubtitleEl = document.getElementById('planUsageValueSubtitle');
    var currentWindow = 'monthly';
    var currentValueMetric = 'tokenPerCny';
    var valueChart = null;
    var costChart = null;
    var usagePayload = null;
    var DEFAULT_USAGE_CHARTS_CONFIG = {
        valueYLog: true,
        costXLog: true,
        costYLog: true
    };

    function escapeHtmlSafe(text) {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(text);
        }
        var div = document.createElement('div');
        div.textContent = String(text == null ? '' : text);
        return div.innerHTML;
    }

    function formatDate(isoString) {
        if (!isoString) {
            return '未知';
        }
        var date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return isoString;
        }
        return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('.');
    }

    function formatInteger(value) {
        return Number(value || 0).toLocaleString('zh-CN');
    }

    function formatPrice(value) {
        var number = Number(value || 0);
        return Number.isInteger(number) ? String(number) : number.toFixed(2);
    }

    function getUsageChartsConfig() {
        var runtimeConfig = window.appConfig && window.appConfig.usageCharts;
        return {
            valueYLog: typeof (runtimeConfig && runtimeConfig.valueYLog) === 'boolean' ? runtimeConfig.valueYLog : DEFAULT_USAGE_CHARTS_CONFIG.valueYLog,
            costXLog: typeof (runtimeConfig && runtimeConfig.costXLog) === 'boolean' ? runtimeConfig.costXLog : DEFAULT_USAGE_CHARTS_CONFIG.costXLog,
            costYLog: typeof (runtimeConfig && runtimeConfig.costYLog) === 'boolean' ? runtimeConfig.costYLog : DEFAULT_USAGE_CHARTS_CONFIG.costYLog
        };
    }

    function isLogAxis(axisKey) {
        return Boolean(getUsageChartsConfig()[axisKey]);
    }

    function getAxisDisplayValue(value, useLog, floor, logBase) {
        var numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) {
            return useLog ? floor : 0;
        }
        if (!useLog) {
            return numeric;
        }
        return Math.log(Math.max(floor, numeric)) / Math.log(logBase);
    }

    function buildAxisBounds(values, options) {
        if (!values.length) {
            return {
                min: options.useLog ? options.floor : 0,
                max: options.useLog ? options.floor * 10 : Math.max(options.linearMaxPadding || 1, 1)
            };
        }

        var minValue = Math.min.apply(null, values);
        var maxValue = Math.max.apply(null, values);
        if (options.useLog) {
            return {
                min: minValue > 0 ? Math.max(options.floor, minValue * (options.minFactor || 0.65)) : options.floor,
                max: maxValue > 0 ? maxValue * (options.maxFactor || 1.18) : options.floor * 10
            };
        }

        var range = Math.max(maxValue - minValue, 0);
        var minPadding = Math.max(range * 0.12, Math.abs(maxValue) * 0.06, options.linearMinPadding || 1);
        var maxPadding = Math.max(range * 0.14, Math.abs(maxValue) * 0.08, options.linearMaxPadding || 1);
        var boundedMin = minValue - minPadding;
        if (options.clampZero) {
            boundedMin = Math.max(0, boundedMin);
        }
        return {
            min: boundedMin,
            max: maxValue + maxPadding
        };
    }

    function buildPlacementThreshold(values, options) {
        if (!values.length) {
            return options.useLog ? 0.08 : 1;
        }
        var mappedValues = values.map(function (value) {
            return getAxisDisplayValue(value, options.useLog, options.floor, options.logBase);
        }).sort(function (left, right) {
            return left - right;
        });
        var minValue = mappedValues[0];
        var maxValue = mappedValues[mappedValues.length - 1];
        var range = Math.max(maxValue - minValue, 0);
        var fallback = options.useLog ? 0.08 : Math.max(Math.abs(mappedValues[Math.floor(mappedValues.length / 2)]) * 0.015, 1);
        return Math.max(range * 0.035, fallback);
    }

    function getComparisonMonthlyPrice(item) {
        if (item && Number.isFinite(Number(item.comparisonMonthlyPriceCny))) {
            return Number(item.comparisonMonthlyPriceCny);
        }
        return Number(item && item.monthlyPrice || 0);
    }

    function formatMonthlyPriceLabel(data, compact) {
        var currency = (data && data.currency) || '¥';
        var price = formatPrice(data && data.monthlyPrice);
        if (currency === '$') {
            if (!compact) {
                var comparisonPrice = data && data.comparisonMonthlyPriceCny;
                if (comparisonPrice) {
                    return '$' + price + '（约 ¥' + formatPrice(comparisonPrice) + '）';
                }
            }
            return '$' + price;
        }
        return '¥' + price;
    }

    function getValueMetricNumber(windowMetrics) {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            var tokenPerCny = Number(windowMetrics.tokenPerCny || 0);
            if (tokenPerCny <= 0) {
                return 0;
            }
            return 1000000 / tokenPerCny;
        }
        return Number(windowMetrics.tokenPerCny || 0);
    }

    function formatValueMetric(value) {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return '¥' + formatPrice(value);
        }
        return formatCompactTokens(value);
    }

    function getValueMetricSeriesName() {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return '1M Token 价格';
        }
        return '每元 Token';
    }

    function getValueMetricTitle() {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return '不同平台不同套餐，买 1M Token 需要多少钱';
        }
        return '不同平台不同套餐，每 1 元人民币能换来多少 Token';
    }

    function getValueMetricSubtitle() {
        var logNote = isLogAxis('valueYLog') ? '纵轴为对数刻度，图上间距会被压缩，实际数值差距通常比视觉上更大。' : '';
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return '按平台看 1M Token 成本，纵轴越低，代表买到同等 token 所需预算越少。' + logNote;
        }
        return '按平台看性价比密度，纵轴越高，代表同样预算下可支持的 token 越多。' + logNote;
    }

    function getValueMetricTooltipLabel() {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return '1M Token 价格';
        }
        return getWindowLabel(currentWindow) + ' 每元 Token';
    }

    function getValueMetricYAxisName() {
        if (currentValueMetric === 'cnyPerMillionTokens') {
            return isLogAxis('valueYLog') ? '1M Token 价格（元，对数）' : '1M Token 价格（元）';
        }
        return isLogAxis('valueYLog') ? getWindowLabel(currentWindow) + ' 每元 Token（对数）' : getWindowLabel(currentWindow) + ' 每元 Token';
    }

    function getCostPriceAxisName() {
        return isLogAxis('costXLog') ? '包月价格（人民币折算，对数）' : '包月价格（人民币折算）';
    }

    function getCostTokenAxisName() {
        return isLogAxis('costYLog') ? getWindowLabel(currentWindow) + ' Token 上限（对数）' : getWindowLabel(currentWindow) + ' Token 上限';
    }

    function formatCompactTokens(value) {
        var numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) {
            return '-';
        }
        var absValue = Math.abs(numeric);
        if (absValue >= 100000000) {
            return (numeric / 100000000).toFixed(absValue >= 1000000000 ? 1 : 2).replace(/\.0$/, '') + '亿';
        }
        if (absValue >= 10000) {
            return (numeric / 10000).toFixed(absValue >= 1000000 ? 1 : 2).replace(/\.0$/, '') + '万';
        }
        return Math.round(numeric).toLocaleString('zh-CN');
    }

    function getWindowLabel(windowKey) {
        if (windowKey === 'weekly') {
            return '每周';
        }
        if (windowKey === 'monthly') {
            return '每月';
        }
        return '5 小时';
    }

    function buildVendorPalette(items) {
        var vendors = Array.from(new Set(items.map(function (item) {
            return item.groupLabel;
        })));
        var preferredColors = {
            '智谱AI': '#F5F527',
            'MiniMax': '#f97316',
            'Kimi': '#10C2B0',
            '字节·方舟 · Coding Plan': '#9E0000',
            '字节·方舟 · Token Plan': '#FF3B3B',
            '阿里·百炼 · Coding Plan': '#017011',
            '阿里·百炼 · Token Plan': '#6FF527',
            '小米·MiMo': '#2563eb',
            'DeepSeek Flash': '#71717B',
            'DeepSeek Pro': '#27272A',
            // '讯飞·星火': '#ec4899',
            // '联通云': '#0ea5e9',
            'Claude': '#ec4899',
            'Codex': '#A15CF6'
        };
        var palette = [
            '#22c55e',
            '#eab308',
            '#f43f5e',
            '#a855f7',
            '#ef4444',
            '#10b981',
            '#3b82f6',
            '#d946ef',
            '#84cc16',
            '#f97316',
            '#06b6d4'
        ];
        var colorMap = {};
        var paletteIndex = 0;
        vendors.forEach(function (vendor) {
            if (preferredColors[vendor]) {
                colorMap[vendor] = preferredColors[vendor];
                return;
            }
            colorMap[vendor] = palette[paletteIndex % palette.length];
            paletteIndex += 1;
        });
        return colorMap;
    }

    function buildMixedTypeVendorSet(items) {
        var vendorTypeMap = new Map();
        (items || []).forEach(function (item) {
            var vendor = item && item.vendor;
            if (!vendor) {
                return;
            }
            if (!vendorTypeMap.has(vendor)) {
                vendorTypeMap.set(vendor, new Set());
            }
            vendorTypeMap.get(vendor).add(item.type || '未知类型');
        });
        var mixedTypeVendors = new Set();
        vendorTypeMap.forEach(function (types, vendor) {
            if (types.size > 1) {
                mixedTypeVendors.add(vendor);
            }
        });
        return mixedTypeVendors;
    }

    function getPlatformGroupLabel(item, mixedTypeVendors) {
        var vendor = item && item.vendor ? item.vendor : '未知平台';
        if (!mixedTypeVendors || !mixedTypeVendors.has(vendor)) {
            return vendor;
        }
        return vendor + ' · ' + (item.type || '未知类型');
    }

    function computeThresholdPivot(values, direction) {
        if (!values.length) {
            return 0;
        }
        var sorted = values.slice().sort(function (left, right) {
            return left - right;
        });
        var middleIndex = Math.floor((sorted.length - 1) / 2);
        var fallbackStep = Math.max(Math.abs(sorted[middleIndex]) * 0.001, 0.001);

        if (direction === 'lower') {
            var lowerBaseIndex = Math.ceil((sorted.length - 1) / 2);
            var lowerBaseValue = sorted[lowerBaseIndex];
            for (var prevIndex = lowerBaseIndex - 1; prevIndex >= 0; prevIndex -= 1) {
                if (sorted[prevIndex] !== lowerBaseValue) {
                    return (sorted[prevIndex] + lowerBaseValue) / 2;
                }
            }
            return Math.max(0, lowerBaseValue - fallbackStep);
        }

        var higherBaseValue = sorted[middleIndex];
        for (var nextIndex = middleIndex + 1; nextIndex < sorted.length; nextIndex += 1) {
            if (sorted[nextIndex] !== higherBaseValue) {
                return (higherBaseValue + sorted[nextIndex]) / 2;
            }
        }
        return higherBaseValue + fallbackStep;
    }

    function buildCenteredOffsets(count, gap) {
        return Array.from({ length: count }, function (_, index) {
            return Math.round((index - (count - 1) / 2) * gap);
        });
    }

    function applyVerticalLabelStack(points, getY, threshold) {
        if (!points.length) {
            return;
        }

        var sorted = points.slice().sort(function (left, right) {
            return getY(left) - getY(right);
        });
        var clusters = [];
        var currentCluster = [];

        sorted.forEach(function (point) {
            if (!currentCluster.length) {
                currentCluster.push(point);
                return;
            }

            var previousPoint = currentCluster[currentCluster.length - 1];
            if (Math.abs(getY(point) - getY(previousPoint)) <= threshold) {
                currentCluster.push(point);
                return;
            }

            clusters.push(currentCluster);
            currentCluster = [point];
        });

        if (currentCluster.length) {
            clusters.push(currentCluster);
        }

        clusters.forEach(function (cluster) {
            var offsets = buildCenteredOffsets(cluster.length, 18);
            cluster.forEach(function (point, index) {
                point.label = {
                    position: 'right',
                    offset: [12, offsets[index]]
                };
            });
        });
    }

    function getScatterLabelPlacement(index) {
        var placements = [
            { position: 'right', offset: [12, -18] },
            { position: 'right', offset: [12, 18] },
            { position: 'top', offset: [0, -12] },
            { position: 'bottom', offset: [0, 12] },
            { position: 'left', offset: [-12, -18] },
            { position: 'left', offset: [-12, 18] },
            { position: 'right', offset: [12, 34] },
            { position: 'left', offset: [-12, 34] }
        ];
        return placements[index % placements.length];
    }

    function getCostScatterLabelPlacement(index) {
        var placements = [
            { position: 'right', offset: [12, -18] },
            { position: 'top', offset: [0, -14] },
            { position: 'left', offset: [-12, -18] },
            { position: 'right', offset: [12, -34] },
            { position: 'left', offset: [-12, -34] },
            { position: 'top', offset: [0, -28] },
            { position: 'right', offset: [12, 0] },
            { position: 'left', offset: [-12, 0] }
        ];
        return placements[index % placements.length];
    }

    function flipHorizontalPlacement(placement) {
        if (placement.position === 'right') {
            return {
                position: 'left',
                offset: [-Math.abs(placement.offset[0]), placement.offset[1]]
            };
        }
        if (placement.position === 'left') {
            return {
                position: 'right',
                offset: [Math.abs(placement.offset[0]), placement.offset[1]]
            };
        }
        return placement;
    }

    function flipVerticalPlacement(placement) {
        if (placement.position === 'top') {
            return {
                position: 'bottom',
                offset: [placement.offset[0], Math.abs(placement.offset[1])]
            };
        }
        if (placement.position === 'bottom') {
            return {
                position: 'top',
                offset: [placement.offset[0], -Math.abs(placement.offset[1])]
            };
        }
        return {
            position: placement.position,
            offset: [placement.offset[0], -placement.offset[1]]
        };
    }

    function applyScatterLabelPlacements(points, getX, getY, xThreshold, yThreshold, placementFactory) {
        if (!points.length) {
            return;
        }

        var xValues = points.map(function (point) {
            return getX(point);
        });
        var yValues = points.map(function (point) {
            return getY(point);
        });
        var minX = Math.min.apply(null, xValues);
        var maxX = Math.max.apply(null, xValues);
        var minY = Math.min.apply(null, yValues);
        var maxY = Math.max.apply(null, yValues);

        var clusters = [];

        points.forEach(function (point) {
            var pointX = getX(point);
            var pointY = getY(point);
            var matchedCluster = null;

            clusters.some(function (cluster) {
                var isNearCluster = cluster.points.some(function (clusterPoint) {
                    return Math.abs(getX(clusterPoint) - pointX) <= xThreshold
                        && Math.abs(getY(clusterPoint) - pointY) <= yThreshold;
                });
                if (isNearCluster) {
                    matchedCluster = cluster;
                    return true;
                }
                return false;
            });

            if (!matchedCluster) {
                matchedCluster = { points: [] };
                clusters.push(matchedCluster);
            }

            matchedCluster.points.push(point);
        });

        clusters.forEach(function (cluster) {
            if (cluster.points.length === 1) {
                var singlePointPlacement = {
                    position: 'right',
                    offset: [12, 0]
                };
                if (maxX - getX(cluster.points[0]) <= xThreshold * 1.25) {
                    singlePointPlacement = flipHorizontalPlacement(singlePointPlacement);
                }
                if (getY(cluster.points[0]) - minY <= yThreshold * 1.25 && singlePointPlacement.offset[1] > 0) {
                    singlePointPlacement = flipVerticalPlacement(singlePointPlacement);
                } else if (maxY - getY(cluster.points[0]) <= yThreshold * 1.25 && singlePointPlacement.offset[1] < 0) {
                    singlePointPlacement = flipVerticalPlacement(singlePointPlacement);
                }
                cluster.points[0].label = singlePointPlacement;
                return;
            }

            cluster.points.sort(function (left, right) {
                var yDiff = getY(right) - getY(left);
                if (yDiff !== 0) {
                    return yDiff;
                };
                return getX(left) - getX(right);
            });

            cluster.points.forEach(function (point, index) {
                var placement = (placementFactory || getScatterLabelPlacement)(index);
                if (maxX - getX(point) <= xThreshold * 1.25 && placement.position === 'right') {
                    placement = flipHorizontalPlacement(placement);
                } else if (getX(point) - minX <= xThreshold * 1.25 && placement.position === 'left') {
                    placement = flipHorizontalPlacement(placement);
                }
                if (getY(point) - minY <= yThreshold * 1.25) {
                    if (placement.position === 'bottom' || placement.offset[1] > 0) {
                        placement = flipVerticalPlacement(placement);
                    }
                } else if (maxY - getY(point) <= yThreshold * 1.25) {
                    if (placement.position === 'top' || placement.offset[1] < 0) {
                        placement = flipVerticalPlacement(placement);
                    }
                }
                point.label = {
                    position: placement.position,
                    offset: placement.offset
                };
            });
        });
    }

    function setState(message, isError) {
        if (!stateEl) {
            return;
        }
        if (!message) {
            stateEl.hidden = true;
            stateEl.textContent = '';
            stateEl.classList.remove('is-error');
            return;
        }
        stateEl.hidden = false;
        stateEl.textContent = message;
        stateEl.classList.toggle('is-error', Boolean(isError));
    }

    function setButtonState(nextWindow) {
        currentWindow = nextWindow;
        windowButtons.forEach(function (button) {
            var isActive = button.getAttribute('data-usage-window') === nextWindow;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function setValueMetricState(nextMetric) {
        currentValueMetric = nextMetric;
        valueMetricButtons.forEach(function (button) {
            var isActive = button.getAttribute('data-usage-value-metric') === nextMetric;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (valueTitleEl) {
            valueTitleEl.textContent = getValueMetricTitle();
        }
        if (valueSubtitleEl) {
            valueSubtitleEl.textContent = getValueMetricSubtitle();
        }
    }

    function getWindowMetrics(item, windowKey) {
        if (!item || !item.windows) {
            return null;
        }
        var metrics = item.windows[windowKey];
        if (!metrics) {
            return null;
        }
        var tokenLimit = Number(metrics.tokenLimit || 0);
        var tokenPerCny = Number(metrics.tokenPerCny || 0);
        if (!Number.isFinite(tokenLimit) || tokenLimit <= 0) {
            return null;
        }
        if (!Number.isFinite(tokenPerCny) || tokenPerCny <= 0) {
            return null;
        }
        return metrics;
    }

    function getActiveItemsForWindow(items) {
        return (items || []).filter(function (item) {
            return !item.discontinued && Boolean(getWindowMetrics(item, currentWindow));
        });
    }

    function buildTokenLimitRows(data) {
        return ['fiveHours', 'weekly', 'monthly'].reduce(function (rows, windowKey) {
            var metrics = getWindowMetrics(data, windowKey);
            if (!metrics) {
                return rows;
            }
            var label = windowKey === 'fiveHours' ? '5h Token 上限' : getWindowLabel(windowKey) + ' Token 上限';
            rows.push('<div><strong>' + escapeHtmlSafe(label) + '：</strong>' + escapeHtmlSafe(formatCompactTokens(metrics.tokenLimit)) + '</div>');
            return rows;
        }, []);
    }

    function formatGroupLabel(label) {
        return String(label || '').replace(' · ', '\n');
    }

    function getNegativeAxisPadding(minValue, maxValue, fallbackPadding) {
        var safeMin = Number.isFinite(minValue) ? minValue : 0;
        var safeMax = Number.isFinite(maxValue) ? maxValue : 0;
        var range = Math.max(safeMax - safeMin, 0);
        var padding = Math.max(range * 0.12, fallbackPadding);
        return -padding;
    }

    function buildValueSeries(items, colorMap, mixedTypeVendors) {
        var useLogY = isLogAxis('valueYLog');
        var valueFloor = currentValueMetric === 'cnyPerMillionTokens' ? 0.001 : 1;
        var vendors = Array.from(new Set(items.map(function (item) {
            return getPlatformGroupLabel(item, mixedTypeVendors);
        })));
        var points = items.map(function (item) {
            var windowMetrics = getWindowMetrics(item, currentWindow) || {};
            var metricValue = getValueMetricNumber(windowMetrics);
            var groupLabel = getPlatformGroupLabel(item, mixedTypeVendors);
            return {
                value: [groupLabel, metricValue],
                groupLabel: groupLabel,
                vendor: item.vendor,
                plan: item.plan,
                type: item.type,
                monthlyPrice: item.monthlyPrice,
                comparisonMonthlyPriceCny: item.comparisonMonthlyPriceCny,
                currency: item.currency,
                seedPlan: item.seedPlan,
                seedSourceNote: item.seedSourceNote,
                windows: item.windows,
                fiveHours: item.windows.fiveHours,
                weekly: item.windows.weekly,
                monthly: item.windows.monthly,
                itemStyle: {
                    color: colorMap[groupLabel],
                    borderColor: 'rgba(255,255,255,0.95)',
                    borderWidth: 1.5,
                    shadowBlur: 14,
                    shadowColor: 'rgba(23, 32, 51, 0.12)'
                }
            };
        });
        var tokenValues = points.map(function (point) {
            return Number(point.value[1] || 0);
        }).filter(function (value) {
            return value > 0;
        });
        var yBounds = buildAxisBounds(tokenValues, {
            useLog: useLogY,
            floor: valueFloor,
            logBase: 10,
            minFactor: 0.65,
            maxFactor: 1.18,
            linearMinPadding: currentValueMetric === 'cnyPerMillionTokens' ? 0.2 : 1,
            linearMaxPadding: currentValueMetric === 'cnyPerMillionTokens' ? 0.4 : 1,
            clampZero: true
        });
        var tokenThreshold = buildPlacementThreshold(tokenValues, {
            useLog: useLogY,
            floor: valueFloor,
            logBase: 10
        });

        vendors.forEach(function (vendor) {
            applyVerticalLabelStack(points.filter(function (point) {
                return point.groupLabel === vendor;
            }), function (point) {
                return getAxisDisplayValue(Number(point.value[1] || valueFloor), useLogY, valueFloor, 10);
            }, tokenThreshold);
        });

        return {
            vendors: vendors,
            points: points,
            yMin: yBounds.min,
            yMax: yBounds.max,
            useLogY: useLogY
        };
    }

    function buildCostSeries(items, colorMap, mixedTypeVendors) {
        var useLogX = isLogAxis('costXLog');
        var useLogY = isLogAxis('costYLog');
        var grouped = new Map();
        items.forEach(function (item) {
            var groupLabel = getPlatformGroupLabel(item, mixedTypeVendors);
            if (!grouped.has(groupLabel)) {
                grouped.set(groupLabel, []);
            }
            grouped.get(groupLabel).push(item);
        });

        var vendors = Array.from(grouped.keys());
        var priceValues = [];
        var tokenValues = [];
        var series = vendors.map(function (vendor) {
            var points = (grouped.get(vendor) || []).map(function (item) {
                var windowMetrics = getWindowMetrics(item, currentWindow) || {};
                var monthlyPrice = getComparisonMonthlyPrice(item);
                var tokenLimit = Number(windowMetrics.tokenLimit || 0);
                priceValues.push(monthlyPrice);
                tokenValues.push(tokenLimit);
                return {
                    value: [monthlyPrice, tokenLimit],
                    groupLabel: vendor,
                    vendor: item.vendor,
                    plan: item.plan,
                    type: item.type,
                    monthlyPrice: item.monthlyPrice,
                    comparisonMonthlyPriceCny: item.comparisonMonthlyPriceCny,
                    currency: item.currency,
                    seedPlan: item.seedPlan,
                    seedSourceNote: item.seedSourceNote,
                    windows: item.windows,
                    fiveHours: item.windows.fiveHours,
                    weekly: item.windows.weekly,
                    monthly: item.windows.monthly,
                    itemStyle: {
                        color: colorMap[vendor],
                        borderColor: 'rgba(255,255,255,0.95)',
                        borderWidth: 1.5,
                        shadowBlur: 14,
                        shadowColor: 'rgba(23, 32, 51, 0.12)'
                    }
                };
            }).sort(function (left, right) {
                var leftPrice = Number(left.value && left.value[0] || 0);
                var rightPrice = Number(right.value && right.value[0] || 0);
                if (leftPrice !== rightPrice) {
                    return leftPrice - rightPrice;
                }
                return Number(left.value && left.value[1] || 0) - Number(right.value && right.value[1] || 0);
            });
            return {
                name: vendor,
                type: 'line',
                color: colorMap[vendor],
                symbol: 'circle',
                symbolSize: 16,
                showSymbol: true,
                lineStyle: {
                    width: points.length > 1 ? 1.5 : 0,
                    opacity: points.length > 1 ? 0.3 : 0
                },
                label: {
                    show: true,
                    position: 'right',
                    distance: 8,
                    color: '#425065',
                    fontSize: 11,
                    fontWeight: 700,
                    formatter: function (params) {
                        var data = params.data || {};
                        return data.plan || '';
                    }
                },
                labelLayout: {
                    hideOverlap: true
                },
                itemStyle: {
                    color: colorMap[vendor],
                    borderColor: 'rgba(255,255,255,0.95)',
                    borderWidth: 1.5,
                    shadowBlur: 14,
                    shadowColor: 'rgba(23, 32, 51, 0.12)'
                },
                data: points,
                emphasis: {
                    scale: 1.18
                }
            };
        });

        var xBounds = buildAxisBounds(priceValues, {
            useLog: useLogX,
            floor: 1,
            logBase: 2,
            minFactor: 0.75,
            maxFactor: 1.12,
            linearMinPadding: 4,
            linearMaxPadding: 6,
            clampZero: true
        });
        var yBounds = buildAxisBounds(tokenValues, {
            useLog: useLogY,
            floor: 1,
            logBase: 10,
            minFactor: 0.65,
            maxFactor: 1.18,
            linearMinPadding: 1,
            linearMaxPadding: 1,
            clampZero: true
        });
        var medianPrice = computeThresholdPivot(priceValues, 'higher');
        var medianTokens = computeThresholdPivot(tokenValues, 'lower');
        var xThreshold = buildPlacementThreshold(priceValues, {
            useLog: useLogX,
            floor: 1,
            logBase: 2
        });
        var yThreshold = buildPlacementThreshold(tokenValues, {
            useLog: useLogY,
            floor: 1,
            logBase: 10
        });

        applyScatterLabelPlacements(series.reduce(function (result, seriesItem) {
            return result.concat(seriesItem.data || []);
        }, []), function (point) {
            return getAxisDisplayValue(Number(point.value[0] || 1), useLogX, 1, 2);
        }, function (point) {
            return getAxisDisplayValue(Number(point.value[1] || 1), useLogY, 1, 10);
        }, xThreshold, yThreshold, getCostScatterLabelPlacement);

        var helperSeries = {
            type: 'scatter',
            silent: true,
            animation: false,
            data: [],
            symbolSize: 0,
            tooltip: {
                show: false
            },
            itemStyle: {
                opacity: 0
            },
            markArea: {
                silent: true,
                label: {
                    show: false
                },
                data: [
                    [{ itemStyle: { color: 'rgba(16, 185, 129, 0.12)' }, xAxis: xBounds.min, yAxis: medianTokens }, { xAxis: medianPrice, yAxis: yBounds.max }],
                    [{ itemStyle: { color: 'rgba(59, 130, 246, 0.05)' }, xAxis: medianPrice, yAxis: medianTokens }, { xAxis: xBounds.max, yAxis: yBounds.max }],
                    [{ itemStyle: { color: 'rgba(59, 130, 246, 0.05)' }, xAxis: xBounds.min, yAxis: yBounds.min }, { xAxis: medianPrice, yAxis: medianTokens }],
                    [{ itemStyle: { color: 'rgba(239, 68, 68, 0.07)' }, xAxis: medianPrice, yAxis: yBounds.min }, { xAxis: xBounds.max, yAxis: medianTokens }]
                ]
            },
            markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: {
                    color: 'rgba(23, 32, 51, 0.18)',
                    type: 'dashed'
                },
                label: {
                    show: false
                },
                data: [
                    { xAxis: medianPrice },
                    { yAxis: medianTokens }
                ]
            }
        };

        return {
            vendors: vendors,
            series: series,
            helperSeries: helperSeries,
            xMin: xBounds.min,
            xMax: xBounds.max,
            yMin: yBounds.min,
            yMax: yBounds.max,
            medianPrice: medianPrice,
            medianTokens: medianTokens,
            useLogX: useLogX,
            useLogY: useLogY
        };
    }

    function ensureCharts() {
        if (!window.echarts) {
            return;
        }
        if (!valueChart && valueChartEl) {
            valueChart = window.echarts.init(valueChartEl, null, { renderer: 'canvas' });
        }
        if (!costChart && costChartEl) {
            costChart = window.echarts.init(costChartEl, null, { renderer: 'canvas' });
        }
    }

    function renderValueChart(activeItems, colorMap, mixedTypeVendors) {
        if (!valueChartEl || !valueChart) {
            return;
        }
        var built = buildValueSeries(activeItems, colorMap, mixedTypeVendors);
        valueChartEl.hidden = false;
        valueChart.setOption({
            animationDuration: 420,
            animationDurationUpdate: 220,
            grid: {
                left: 86,
                right: 24,
                top: 56,
                bottom: 66
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(255, 252, 246, 0.96)',
                borderColor: 'rgba(23, 32, 51, 0.08)',
                borderWidth: 1,
                textStyle: {
                    color: '#172033'
                },
                formatter: function (params) {
                    var data = params.data || {};
                    var currentMetrics = getWindowMetrics(data, currentWindow) || {};
                    return [
                        '<div style="min-width:220px">',
                        '<div style="font-size:14px;font-weight:800;margin-bottom:6px;">' + escapeHtmlSafe(data.vendor) + ' · ' + escapeHtmlSafe(data.plan) + '</div>',
                        '<div style="font-size:12px;line-height:1.7;">',
                        '<div><strong>类型：</strong>' + escapeHtmlSafe(data.type || '未知') + '</div>',
                        '<div><strong>月价：</strong>' + escapeHtmlSafe(formatMonthlyPriceLabel(data)) + '</div>',
                        '<div><strong>' + escapeHtmlSafe(getValueMetricTooltipLabel()) + '：</strong>' + escapeHtmlSafe(formatValueMetric(getValueMetricNumber(currentMetrics))) + '</div>',
                        '<div><strong>' + escapeHtmlSafe(getWindowLabel(currentWindow)) + ' Token 上限：</strong>' + escapeHtmlSafe(formatCompactTokens(currentMetrics.tokenLimit)) + '</div>',
                        '<div style="margin-top:6px;color:#5f6879;"><strong>数据参考：</strong>' + escapeHtmlSafe(data.seedSourceNote || '') + '</div>',
                        '</div>',
                        '</div>'
                    ].join('');
                }
            },
            xAxis: {
                type: 'category',
                data: built.vendors,
                boundaryGap: true,
                axisLabel: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 700,
                    interval: 0,
                    margin: 14,
                    formatter: function (value) {
                        return formatGroupLabel(value);
                    }
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.08)'
                    }
                },
                axisTick: {
                    alignWithLabel: true
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.16)'
                    }
                }
            },
            yAxis: {
                type: built.useLogY ? 'log' : 'value',
                logBase: built.useLogY ? 10 : undefined,
                min: built.yMin,
                max: built.yMax,
                splitNumber: 6,
                name: getValueMetricYAxisName(),
                nameTextStyle: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: [0, 0, 8, 0]
                },
                axisLabel: {
                    color: '#5f6879',
                    formatter: function (value) {
                        return formatValueMetric(value);
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.08)',
                        type: 'dashed'
                    }
                }
            },
            dataZoom: [],
            series: [{
                name: getValueMetricSeriesName(),
                type: 'scatter',
                symbolSize: 16,
                label: {
                    show: true,
                    position: 'right',
                    distance: 8,
                    color: '#425065',
                    fontSize: 11,
                    fontWeight: 700,
                    formatter: function (params) {
                        var data = params.data || {};
                        if (!data.plan) {
                            return '';
                        }
                        return data.plan + '  ' + formatMonthlyPriceLabel(data, true);
                    }
                },
                data: built.points,
                emphasis: {
                    scale: 1.18
                }
            }]
        }, true);
        valueChart.resize();
    }

    function renderCostChart(activeItems, colorMap, mixedTypeVendors) {
        if (!costChartEl || !costChart) {
            return;
        }
        var built = buildCostSeries(activeItems, colorMap, mixedTypeVendors);
        costChartEl.hidden = false;
        costChart.setOption({
            animationDuration: 450,
            animationDurationUpdate: 240,
            color: built.vendors.map(function (vendor) {
                return colorMap[vendor];
            }),
            grid: {
                left: 86,
                right: 28,
                top: 78,
                bottom: 72
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(255, 252, 246, 0.96)',
                borderColor: 'rgba(23, 32, 51, 0.08)',
                borderWidth: 1,
                textStyle: {
                    color: '#172033'
                },
                formatter: function (params) {
                    var data = params.data || {};
                    var tokenLimitRows = buildTokenLimitRows(data);

                    return [
                        '<div style="min-width:220px">',
                        '<div style="font-size:14px;font-weight:800;margin-bottom:6px;">' + escapeHtmlSafe(data.vendor) + ' · ' + escapeHtmlSafe(data.plan) + '</div>',
                        '<div style="font-size:12px;line-height:1.7;">',
                        '<div><strong>类型：</strong>' + escapeHtmlSafe(data.type || '未知') + '</div>',
                        '<div><strong>月价：</strong>' + escapeHtmlSafe(formatMonthlyPriceLabel(data)) + '</div>',
                        tokenLimitRows.join(''),
                        '<div style="margin-top:6px;color:#5f6879;"><strong>数据参考：</strong>' + escapeHtmlSafe(data.seedSourceNote || '') + '</div>',
                        '</div>',
                        '</div>'
                    ].join('');
                }
            },
            legend: {
                top: 10,
                left: 0,
                itemWidth: 10,
                itemHeight: 10,
                icon: 'circle',
                textStyle: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 600
                },
                formatter: function (value) {
                    return formatGroupLabel(value);
                }
            },
            xAxis: {
                type: built.useLogX ? 'log' : 'value',
                logBase: built.useLogX ? 2 : undefined,
                min: built.xMin,
                max: built.xMax,
                name: getCostPriceAxisName(),
                nameLocation: 'middle',
                nameGap: 42,
                nameTextStyle: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 700
                },
                splitNumber: 6,
                axisLabel: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 700,
                    formatter: function (value) {
                        return '¥' + formatPrice(value);
                    }
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.08)',
                        type: 'dashed'
                    }
                },
                axisTick: {
                    show: false
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.16)'
                    }
                }
            },
            yAxis: {
                type: built.useLogY ? 'log' : 'value',
                logBase: built.useLogY ? 10 : undefined,
                min: built.yMin,
                max: built.yMax,
                splitNumber: 6,
                name: getCostTokenAxisName(),
                nameTextStyle: {
                    color: '#5f6879',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: [0, 0, 8, 0]
                },
                axisLabel: {
                    color: '#5f6879',
                    formatter: function (value) {
                        return formatCompactTokens(value);
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(23, 32, 51, 0.08)',
                        type: 'dashed'
                    }
                }
            },
            graphic: [{
                type: 'text',
                left: 160,
                top: 56,
                silent: true,
                style: {
                    text: '更便宜且用量更高',
                    fill: '#0f766e',
                    fontSize: 13,
                    fontWeight: 700
                }
            }],
            series: [built.helperSeries].concat(built.series)
        }, true);
        costChart.resize();
    }

    function renderCharts() {
        if (!usagePayload) {
            return;
        }
        var activeItems = getActiveItemsForWindow(usagePayload.items || []);
        if (!activeItems.length) {
            setState('当前统计周期暂无可展示的套餐使用量数据。', false);
            if (valueChartEl) {
                valueChartEl.hidden = true;
            }
            if (costChartEl) {
                costChartEl.hidden = true;
            }
            return;
        }
        if (!window.echarts) {
            setState('图表组件加载失败，当前仅保留用量说明。', true);
            if (valueChartEl) {
                valueChartEl.hidden = true;
            }
            if (costChartEl) {
                costChartEl.hidden = true;
            }
            return;
        }

        ensureCharts();
        if (!valueChart || !costChart) {
            return;
        }
        if (stateEl) {
            stateEl.hidden = true;
        }
        var mixedTypeVendors = buildMixedTypeVendorSet(activeItems);
        var itemsWithGroupLabel = activeItems.map(function (item) {
            return Object.assign({}, item, {
                groupLabel: getPlatformGroupLabel(item, mixedTypeVendors)
            });
        });
        var colorMap = buildVendorPalette(itemsWithGroupLabel);
        setState('', false);
        renderValueChart(itemsWithGroupLabel, colorMap, mixedTypeVendors);
        renderCostChart(itemsWithGroupLabel, colorMap, mixedTypeVendors);
    }

    function applyPayload(payload) {
        usagePayload = payload;
        renderCharts();
    }

    function loadUsageData() {
        if (!panel) {
            return;
        }
        setState('', false);
        fetch(DERIVED_FILE_PATH)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                applyPayload(payload || {});
            })
            .catch(function (error) {
                console.warn('failed to load plan usage derived data', error);
                setState('套餐使用量数据加载失败，稍后可重新刷新页面查看。', true);
                if (valueChartEl) {
                    valueChartEl.hidden = true;
                }
                if (costChartEl) {
                    costChartEl.hidden = true;
                }
            });
    }

    windowButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var nextWindow = button.getAttribute('data-usage-window');
            if (!nextWindow || nextWindow === currentWindow) {
                return;
            }
            setButtonState(nextWindow);
            renderCharts();
        });
    });

    valueMetricButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var nextMetric = button.getAttribute('data-usage-value-metric');
            if (!nextMetric || nextMetric === currentValueMetric) {
                return;
            }
            setValueMetricState(nextMetric);
            renderCharts();
        });
    });

    setButtonState(currentWindow);
    setValueMetricState(currentValueMetric);
    window.addEventListener('resize', function () {
        if (valueChart) {
            valueChart.resize();
        }
        if (costChart) {
            costChart.resize();
        }
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadUsageData, { once: true });
    } else {
        loadUsageData();
    }
    window.addEventListener('codingplan:config-applied', function () {
        if (!usagePayload) {
            return;
        }
        renderCharts();
    });
})();
