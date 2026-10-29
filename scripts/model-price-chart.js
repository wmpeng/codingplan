(function (root, factory) {
    const api = factory(
        root.BenchmarkScores || (typeof require === 'function' ? require('./benchmark-scores.js') : null),
        root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null),
        root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null)
    );
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ModelPriceChart = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Scores, UI, Numbers) {
    'use strict';
    const esc = UI.escapeHtml;

    // Keep exact coordinates and every underlying offer. Different billing modes
    // retain their own symbols; no jitter, rounding or model-name rewriting.
    function groupPoints(points, benchmark) {
        const groups = new Map();
        for (const point of points) {
            const price = point.unitPriceCnyPerM;
            const score = Scores.value(point.scores?.[benchmark]);
            if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || score === null) continue;
            const key = JSON.stringify([price, score, point.billingMode]);
            if (!groups.has(key)) groups.set(key, {key, price, score, members: []});
            groups.get(key).members.push(point);
        }
        return [...groups.values()];
    }

    function paretoFrontier(groups) {
        const sorted = [...groups].sort((a, b) => a.price - b.price || b.score - a.score);
        const frontier = [];
        let best = -Infinity;
        for (const group of sorted) {
            if (group.score <= best) continue;
            frontier.push(group);
            best = group.score;
        }
        return frontier;
    }

    function cheapestModelLabels(groups) {
        const cheapest = new Map();
        for (const group of groups) {
            for (const member of group.members) {
                if (!cheapest.has(member.modelSlug) || group.price < cheapest.get(member.modelSlug).group.price) {
                    cheapest.set(member.modelSlug, {group, member});
                }
            }
        }
        const labels = new Map();
        for (const {group, member} of cheapest.values()) {
            if (!labels.has(group.key)) labels.set(group.key, []);
            const platforms = [...new Set(group.members.filter(point => point.modelSlug === member.modelSlug).map(point => point.platformName))];
            labels.get(group.key).push(`${member.modelName}\n${platforms.join('、')}`);
        }
        return labels;
    }

    function buildSeries(groups, options) {
        const {colors, colorMode, tokenUnit, compact, selectedSlug} = options;
        const selectedGroup = groups.find(group => group.members.some(point => point.slug === selectedSlug));
        const selected = selectedGroup?.members.find(point => point.slug === selectedSlug);
        const labels = cheapestModelLabels(groups);
        const frontier = paretoFrontier(groups);
        const frontierCoordinates = new Set(frontier.map(group => JSON.stringify([group.price, group.score])));
        const byColor = new Map();
        for (const group of groups) {
            const sameModel = selected && group.members.some(point => point.modelSlug === selected.modelSlug);
            const point = group.members.find(point => point.slug === selectedSlug)
                || (sameModel && group.members.find(point => point.modelSlug === selected.modelSlug))
                || group.members[0];
            const key = colorMode === 'model' ? point.modelSlug : point.platformSlug;
            if (!byColor.has(key)) byColor.set(key, []);
            const active = group === selectedGroup;
            byColor.get(key).push({
                value: [group.price * Numbers.tokenFactor(tokenUnit), group.score],
                meta: point, members: group.members, groupKey: group.key,
                symbol: point.billingMode === 'payg' ? 'diamond' : 'circle',
                symbolSize: active ? 16 : point.billingMode === 'payg' ? 13 : 11,
                itemStyle: {
                    color: colors[key], opacity: selected && !sameModel ? 0.14 : 0.86,
                    borderColor: '#fff', borderWidth: active ? 2 : 1.3
                },
                label: {
                    show: active || (!selected && !compact && labels.has(group.key)),
                    formatter: active ? `${selected.modelName}\n${selected.platformName}` : (labels.get(group.key) || []).join('\n'),
                    position: 'top', distance: 9, color: '#506178', fontSize: 11,
                    lineHeight: 15,
                    fontWeight: frontierCoordinates.has(JSON.stringify([group.price, group.score])) ? 600 : 400
                },
                emphasis: {label: {formatter: `${point.modelName}\n${point.platformName}`}}
            });
        }
        return [{
            id: 'intelligence-frontier', name: '价格—能力优势前沿', type: 'line',
            silent: true, symbol: 'none', z: 1,
            lineStyle: {color: '#7c8da2', type: 'dotted', width: 1.7, opacity: selected ? 0.5 : 0.9},
            data: frontier.map(group => [group.price * Numbers.tokenFactor(tokenUnit), group.score])
        }, ...[...byColor.entries()].map(([key, data]) => ({
            id: `intelligence:${key}`, name: key, type: 'scatter', z: 3, data,
            emphasis: {scale: 1.4, label: {show: true}, itemStyle: {opacity: 1}},
            labelLayout: {hideOverlap: true, moveOverlap: 'shiftY'}
        }))];
    }

    function metadataHtml(groups, benchmark, metadata, priceBasis, excluded) {
        const members = groups.flatMap(group => group.members);
        const label = Scores.definitions[benchmark].short;
        return `<span class="price-chart-count">${members.length} 个报价 · ${new Set(members.map(p => p.modelSlug)).size} 个模型 · ${new Set(members.map(p => p.platformSlug)).size} 个平台${excluded ? ` · ${excluded} 条缺评分或当前坐标无法绘制` : ''}</span>` +
            `<span>${esc(label)}${metadata?.version ? ` ${esc(metadata.version)}` : ''} · 订阅${priceBasis === 'monthly' ? '每月' : '首月'}价格折算</span>`;
    }

    function detailHtml(groups, selectedSlug, options) {
        const group = groups.find(item => item.members.some(point => point.slug === selectedSlug));
        const point = group?.members.find(item => item.slug === selectedSlug);
        if (!point) return '<div class="price-chart-placeholder">点击价格点，查看套餐详情并高亮同一模型在不同平台的报价。<small>重合报价可逐条切换；也可在下方价格明细中查看和选择方案。</small></div>';
        const {benchmark, tokenUnit, tooltipHtml} = options;
        const members = group.members.length > 1 ? `<label class="price-chart-members">此位置共 ${group.members.length} 个方案<select data-chart-member aria-label="查看重合报价">${group.members.map(member => `<option value="${esc(member.slug)}"${member.slug === selectedSlug ? ' selected' : ''}>${esc(`${member.platformName} · ${member.planName} · ${member.relationLabel}`)}</option>`).join('')}</select></label>` : '';
        return `<div class="price-chart-selection"><div class="price-chart-identity"><small>已选方案 · ${point.billingMode === 'payg' ? '按量 API' : '订阅参考折算'}</small><strong>${esc(point.relationLabel || point.modelName)}</strong><span>${esc(point.platformName)} · ${esc(point.planName)}</span>${point.planStatus !== 'open' ? `<span class="plan-status" data-price-status="${esc(point.planStatus)}">${esc(UI.statusLabels[point.planStatus] || point.planStatus)}</span>` : ''}</div>` +
            `<div class="price-chart-metric"><small>综合单价 / ${Numbers.tokenUnit(tokenUnit)} Token</small><strong>${Numbers.tokenPrice(point.unitPriceCnyPerM, tokenUnit)}</strong></div>` +
            `<div class="price-chart-metric"><small>${esc(Scores.definitions[benchmark].short)} 评分</small><strong>${esc(Scores.format(point.scores[benchmark], benchmark))}</strong></div>` +
            `<div class="price-chart-actions"><button type="button" class="tool-button" data-chart-locate="${esc(point.slug)}">查看价格明细 ↓</button><button type="button" class="price-chart-clear" data-chart-clear>取消高亮</button></div></div>${members}` +
            `<details class="price-chart-offer-note"><summary>价格、额度与适用条件</summary>${tooltipHtml(point)}${point.note ? `<p>${esc(point.note)}</p>` : ''}<p>评分来自对应模型的基准评测，平台实际配置与体验可能不同；优势前沿仅比较当前条件下的综合单价和评分。</p></details>`;
    }

    return {groupPoints, paretoFrontier, cheapestModelLabels, buildSeries, metadataHtml, detailHtml};
});
