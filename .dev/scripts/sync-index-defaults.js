const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../..');
const configPath = path.join(rootDir, 'config.json');
const plansPath = path.join(rootDir, 'plans.json');
const platformsPath = path.join(rootDir, 'platforms.json');
const modelsPath = path.join(rootDir, 'models.json');
const planModelsPath = path.join(rootDir, 'plan-models.json');
const indexPath = path.join(rootDir, 'index.html');
const EntityData = require(path.join(rootDir, 'scripts/entity-data.js'));

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const entityContext = EntityData.buildContext(
    JSON.parse(fs.readFileSync(platformsPath, 'utf8')),
    JSON.parse(fs.readFileSync(plansPath, 'utf8')),
    JSON.parse(fs.readFileSync(modelsPath, 'utf8')),
    JSON.parse(fs.readFileSync(planModelsPath, 'utf8'))
);
const allPlans = EntityData.hydratePlans(entityContext);
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const WATERMARK = config.header?.watermarkUrl || 'www.codingplan.fyi';
const LINK_ICON = '<svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatRecommendationText(text) {
    const linkPlaceholders = [];
    const withLinkPlaceholders = String(text).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
        if (!/^https?:\/\//i.test(url)) return match;
        const placeholder = `__RECOMMENDATION_LINK_${linkPlaceholders.length}__`;
        linkPlaceholders.push(
            `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        );
        return placeholder;
    });

    let formatted = escapeHtml(withLinkPlaceholders);
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__RECOMMENDATION_LINK_(\d+)__/g, (_, index) => linkPlaceholders[Number(index)] || '');
    return formatted;
}

function getPlatformActionUrl(platformSlug) {
    const platform = entityContext.platformBySlug.get(platformSlug);
    const matchedPlan = allPlans.find(plan => plan.platformSlug === platformSlug);
    return (matchedPlan && matchedPlan.action) || (platform && platform.action) || null;
}

function buildRecommendationCardHtml(rec) {
    const stars = '⭐️'.repeat(rec.rating || 0);
    const reasonsHtml = (rec.reasons || []).map(reason => `<li>${formatRecommendationText(reason)}</li>`).join('');
    const platform = entityContext.platformBySlug.get(rec.platformSlug);
    const displayName = platform ? platform.name : rec.platformSlug;
    const matchedPlanUrl = rec.action || getPlatformActionUrl(rec.platformSlug);
    const nameHtml = matchedPlanUrl
        ? `<a class="recommendation-name-link" href="${escapeHtml(matchedPlanUrl)}" target="_blank" rel="noopener noreferrer"><span class="recommendation-name">${escapeHtml(displayName)}</span>${LINK_ICON}</a>`
        : `<span class="recommendation-name">${escapeHtml(displayName)}</span>`;

    return `
                    <div class="recommendation-card">
                        <div class="card-watermark">${escapeHtml(WATERMARK)}</div>
                        <div class="recommendation-header">
                            ${nameHtml}
                            <span class="recommendation-rating">${stars}</span>
                        </div>
                        <ul class="recommendation-reasons">
                            ${reasonsHtml}
                        </ul>
                    </div>`;
}

function generateRecommendationGroupsHtml(groups) {
    return (groups || []).map(group => {
        const title = escapeHtml(group.title || '');
        const subtitle = group.subtitle
            ? `\n                    <p class="recommendation-group-subtitle">${escapeHtml(group.subtitle)}</p>`
            : '';
        const cardsHtml = (group.items || []).map(buildRecommendationCardHtml).join('\n');
        return `
            <section class="recommendation-group">
                <header class="recommendation-group-header">
                    <h3 class="recommendation-group-title">${title}</h3>${subtitle}
                </header>
                <div class="recommendations">${cardsHtml}
                </div>
            </section>`;
    }).join('\n');
}

function generateNotesHtml(notes) {
    const items = (notes || []).map(note => `                <li>${escapeHtml(note)}</li>`).join('\n');
    return `
            <h3>💡 说明</h3>
            <ul>
${items}
            </ul>`;
}

function generateUpdatesHtml(updates) {
    const items = (updates || []).map(update => {
        const updateItems = (update.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
        return `                <li class="update-item">
                    <div class="log-date">${escapeHtml(update.date)}</div>
                    <ul class="update-items">${updateItems}</ul>
                </li>`;
    }).join('\n');
    return `
            <h3>📝 更新日志</h3>
            <ul class="updates-list">
${items}
            </ul>`;
}

function processPrices(item, index) {
    const monthlyPrice = parseFloat(item.monthlyPrice) || 0;
    let firstMonthPrice = parseFloat(item.firstMonthPrice);
    let quarterlyPrice = parseFloat(item.quarterlyPrice);
    let yearlyPrice = parseFloat(item.yearlyPrice);

    if (Number.isNaN(firstMonthPrice) || item.firstMonthPrice === '-') firstMonthPrice = monthlyPrice;
    if (Number.isNaN(quarterlyPrice) || item.quarterlyPrice === '-') quarterlyPrice = monthlyPrice * 3;
    if (Number.isNaN(yearlyPrice) || item.yearlyPrice === '-') yearlyPrice = quarterlyPrice * 4;

    const preserveString = (value) => {
        if (value === '未公开' || value === '无限制') return value;
        const num = parseInt(value, 10);
        return Number.isNaN(num) ? 0 : num;
    };

    return {
        ...item,
        tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [],
        firstMonthPrice,
        monthlyPrice,
        quarterlyPrice,
        yearlyPrice,
        originalIndex: index
    };
}

function formatPrice(price) {
    if (Number.isInteger(price)) return String(price);
    return price.toFixed(2);
}

function formatRequestCount(value) {
    if (typeof value === 'number') return value.toLocaleString('en-US');
    return value;
}

function formatMeasuredToken(value) {
    if (typeof value !== 'number') return '-';
    return `${value.toLocaleString('en-US')}M Tokens`;
}

function getTagClass(tag) {
    if (tag === '模型强') return 'tag-strong';
    if (tag === '性价比高') return 'tag-value';
    return '';
}

function renderPlanTags(plan) {
    const tags = Array.isArray(plan.tags) ? plan.tags : [];
    if (!tags.length) return '';
    return `<div class="plan-tags">${tags.map(tag => `<span class="plan-tag ${getTagClass(tag)}">${escapeHtml(tag)}</span>`).join('')}</div>`;
}

function generateTableRowsHtml(plans) {
    return plans.map(plan => {
        const currency = plan.currency || '¥';
        const type = plan.type || 'Coding Plan';
        const tokenLimitHtml = typeof plan.tokenLimit === 'number'
            ? `${plan.tokenLimit}M <span class="unit">Tokens</span>`
            : escapeHtml(plan.tokenLimit || '无限制');
        const noteHtml = escapeHtml(plan.note || '').replace(/\n/g, '<br>');

        return `                        <tr class="plan-row${plan.discontinued ? ' discontinued' : ''}">
                    <td class="sticky-first"><span class="vendor-name">${escapeHtml(plan.vendor)}</span></td>
                    <td class="sticky-second"><span class="plan-name">${escapeHtml(plan.plan)}</span></td>
                    <td><span class="type-tag ${type === 'Token Plan' ? 'token-plan' : 'coding-plan'}">${escapeHtml(type)}</span></td>
                    <td>
                        <a href="${escapeHtml(plan.action)}" target="_blank" class="action-btn">
                            跳转开通
                        </a>
                    </td>
                    <td class="rating-stars">${'★'.repeat(plan.rating || 0)}${'☆'.repeat(5 - (plan.rating || 0))}</td>
                    <td class="plan-tags-cell">${renderPlanTags(plan)}</td>
                    <td><span class="price">${currency}${formatPrice(plan.firstMonthPrice)} <span class="unit">/ 首月</span></span></td>
                    <td><span class="price-monthly">${currency}${formatPrice(plan.monthlyPrice)} <span class="unit">/ 月</span></span></td>
                    <td><span class="price-normal">${currency}${formatPrice(plan.quarterlyPrice)} <span class="price-original">${currency}${formatPrice(plan.monthlyPrice * 3)}</span> <span class="unit">/ 季</span></span></td>
                    <td><span class="price-normal">${currency}${formatPrice(plan.yearlyPrice)} <span class="price-original">${currency}${formatPrice(plan.monthlyPrice * 12)}</span> <span class="unit">/ 年</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.fiveHoursRequests)} <span class="unit">/ 5小时</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.weeklyRequests)} <span class="unit">/ 周</span></span></td>
                    <td><span class="request-count">${formatRequestCount(plan.monthlyRequests)} <span class="unit">/ 月</span></span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredFiveHoursTokenLimit)}</span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredWeeklyTokenLimit)}</span></td>
                    <td><span class="request-count">${formatMeasuredToken(plan.measuredMonthlyTokenLimit)}</span></td>
                    <td><span class="request-count">${tokenLimitHtml}</span></td>
                    <td>${(plan.models || []).map(model => `<span class="model-tag">${escapeHtml(model)}</span>`).join('')}</td>
                    <td>${(plan.benefits || []).map(benefit => `<span class="benefit">${escapeHtml(benefit)}</span>`).join('')}</td>
                    <td>${plan.discontinued ? '<span class="status-offline">已下线</span>' : ''}</td>
                    <td><span class="note">${noteHtml}</span></td>
                </tr>`;
    }).join('\n');
}

function replaceSection(html, pattern, newContent) {
    if (!pattern.test(html)) {
        throw new Error(`Section pattern not found: ${pattern}`);
    }
    pattern.lastIndex = 0;
    return html.replace(pattern, (_, open, close) => `${open}${newContent}${close}`);
}

function replaceElementText(html, id, text) {
    const opener = new RegExp(`<([a-z][a-z0-9-]*)[^>]+id="${id}"[^>]*>`, 'i').exec(html);
    if (!opener) throw new Error(`Element #${id} not found`);
    const tag = opener[1];
    const pattern = new RegExp(`(<${tag}[^>]+id="${id}"[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i');
    if (!pattern.test(html)) throw new Error(`Element #${id} not found`);
    return html.replace(pattern, `$1${text}$3`);
}

function replaceElementInnerHtml(html, id, innerHtml) {
    const opener = new RegExp(`<([a-z][a-z0-9-]*)[^>]+id="${id}"[^>]*>`, 'i').exec(html);
    if (!opener) throw new Error(`Element #${id} not found`);
    const tag = opener[1];
    const pattern = new RegExp(`(<${tag}[^>]+id="${id}"[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i');
    if (!pattern.test(html)) throw new Error(`Element #${id} not found`);
    return html.replace(pattern, `$1${innerHtml}$3`);
}

const header = config.header || {};
const activePlans = allPlans
    .map((item, index) => processPrices(item, index))
    .filter(plan => !plan.discontinued);

indexHtml = replaceElementText(indexHtml, 'updateDate', escapeHtml(header.updateDate || ''));
indexHtml = replaceElementInnerHtml(
    indexHtml,
    'subtitle',
    escapeHtml(header.subtitle || '').replace(/&lt;br\s*\/?&gt;/gi, '<br>').replace(/\n/g, '<br>')
);
indexHtml = replaceElementInnerHtml(
    indexHtml,
    'models',
    formatRecommendationText(header.models || '').replace(/\n/g, '<br>')
);

if (header.entry) {
    indexHtml = indexHtml.replace(
        /(<a[^>]*id="headerEntryLink"[^>]*href=")[^"]*(")/,
        `$1${escapeHtml(header.entry.url)}$2`
    );
    indexHtml = indexHtml.replace(
        /(<a[^>]*href=")[^"]*("[^>]*id="headerEntryLink")/,
        `$1${escapeHtml(header.entry.url)}$2`
    );
    indexHtml = replaceElementText(indexHtml, 'headerEntryText', escapeHtml(header.entry.text || 'GitHub 讨论'));
}

indexHtml = replaceSection(
    indexHtml,
    /(<div class="recommendation-groups" id="recommendationGroups">)[\s\S]*?(<\/div>\r?\n\r?\n        <div class="main-view-shell")/,
    generateRecommendationGroupsHtml(config.recommendationGroups)
);

indexHtml = replaceSection(
    indexHtml,
    /(<div class="notes-section" id="notesSection">)[\s\S]*?(<\/ul><\/div>)/,
    generateNotesHtml(config.notes)
);

indexHtml = replaceSection(
    indexHtml,
    /(<div class="updates-section" id="updatesSection">)[\s\S]*?(<\/div>\r?\n\r?\n        <!-- 账号出售区域)/,
    generateUpdatesHtml(config.updates)
);

indexHtml = replaceSection(
    indexHtml,
    /(<tbody id="tableBody">)[\s\S]*?(<\/tbody>)/,
    `\r\n${generateTableRowsHtml(activePlans)}\r\n                    `
);

indexHtml = replaceElementText(indexHtml, 'showingCount', String(activePlans.length));
indexHtml = replaceElementText(indexHtml, 'totalCount', String(activePlans.length));

if (config.ratingGuide) {
    indexHtml = replaceElementText(indexHtml, 'ratingGuide', escapeHtml(config.ratingGuide));
}

const fallbackHeader = {
    title: header.title || 'AI Coding Plan 对比',
    updateDate: header.updateDate || '',
    subtitle: header.subtitle || '',
    models: header.models || '',
    watermarkUrl: header.watermarkUrl || 'www.codingplan.fyi',
    entry: header.entry || {
        url: 'https://github.com/wmpeng/codingplan/discussions',
        text: 'Github 反馈'
    }
};

indexHtml = indexHtml.replace(
    /updateDate: "([^"\\]|\\.)*"/,
    `updateDate: ${JSON.stringify(fallbackHeader.updateDate)}`
);
indexHtml = indexHtml.replace(
    /subtitle: "([^"\\]|\\.)*"/,
    `subtitle: ${JSON.stringify(fallbackHeader.subtitle)}`
);
indexHtml = indexHtml.replace(
    /models: "([^"\\]|\\.)*"/,
    `models: ${JSON.stringify(fallbackHeader.models)}`
);

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`index.html 默认内容已同步：${activePlans.length} 条在售套餐，${(config.updates || []).length} 条更新记录`);
