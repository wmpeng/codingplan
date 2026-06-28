const fs = require('fs');
const path = require('path');

// 读取数据文件
const configPath = path.join(__dirname, '../../config.json');
const plansPath = path.join(__dirname, '../../plans.json');
const derivedPath = path.join(__dirname, '../../index-usage-derived.json');
const indexPath = path.join(__dirname, '../../index.html');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const allPlans = JSON.parse(fs.readFileSync(plansPath, 'utf8'));
const derivedUsage = JSON.parse(fs.readFileSync(derivedPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');
// 过滤掉已下线的套餐
const plans = allPlans.filter(plan => !plan.discontinued);

// 硬编码内容
const ONLINE_URL = 'https://www.codingplan.fyi';
const FOOTER = '由扣子编程开发';

// 生成星星
function generateStars(rating) {
    return '⭐️'.repeat(rating);
}

function getVendorActionUrl(vendorName) {
    const matchedPlan = allPlans.find(plan => plan.vendor === vendorName);
    return matchedPlan && matchedPlan.action ? matchedPlan.action : null;
}

function formatRecommendationName(name) {
    const url = getVendorActionUrl(name);
    return url ? `[${name}](${url})` : name;
}

// 生成单组推荐条目
function generateRecommendationItems(items) {
    let md = '';
    (items || []).forEach((rec, index) => {
        md += `${index + 1}. ${formatRecommendationName(rec.name)} ${generateStars(rec.rating)}\n`;
        (rec.reasons || []).forEach(reason => {
            md += `    - ${reason}\n`;
        });
    });
    return md;
}

// 生成平台推荐（平铺，向后兼容）
function generateRecommendations(recommendations) {
    return generateRecommendationItems(recommendations);
}

// 生成分组平台推荐（与 index.html 的 recommendationGroups 同步）
function generateRecommendationGroups(groups) {
    let md = '';
    (groups || []).forEach(group => {
        const title = group.title || '';
        md += `### ${title}\n\n`;
        if (group.subtitle) {
            md += `${group.subtitle}\n\n`;
        }
        md += generateRecommendationItems(group.items);
        md += '\n';
    });
    return md.trimEnd() + '\n';
}

function generateRecommendationsSection(config) {
    if (Array.isArray(config.recommendationGroups) && config.recommendationGroups.length > 0) {
        return generateRecommendationGroups(config.recommendationGroups);
    }
    if (Array.isArray(config.recommendations) && config.recommendations.length > 0) {
        return generateRecommendations(config.recommendations);
    }
    return '';
}

// 生成评分说明
function generateRatingGuide(ratingGuide) {
    if (!ratingGuide) return '';
    return `\n**评分标准**: ${ratingGuide}\n`;
}

function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function parseFeaturedArticle(html) {
    const articleMatch = html.match(/<article class="hero-summary-card hero-summary-card--reading">([\s\S]*?)<\/article>/);
    if (!articleMatch) return null;

    const articleHtml = articleMatch[1];
    const hrefMatch = articleHtml.match(/<a[^>]*class="hero-summary-readmore"[^>]*href="([^"]+)"/);
    const titleMatch = articleHtml.match(/<h2 class="hero-summary-title">([\s\S]*?)<\/h2>/);
    const bodyMatch = articleHtml.match(/<p class="hero-summary-body">([\s\S]*?)<\/p>/);
    const imgMatch = articleHtml.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/);

    if (!hrefMatch || !titleMatch) return null;

    return {
        href: hrefMatch[1],
        title: normalizeWhitespace(titleMatch[1]),
        body: bodyMatch ? normalizeWhitespace(bodyMatch[1]) : '',
        image: imgMatch ? imgMatch[1] : '',
        imageAlt: imgMatch ? normalizeWhitespace(imgMatch[2]) : ''
    };
}

function generateFeaturedArticle(article) {
    if (!article) return '';

    const imageLine = article.image
        ? `![${article.imageAlt || article.title}](${article.image})\n\n`
        : '';

    return `## 延伸阅读\n\n` +
        `- [${article.title}](${article.href})\n` +
        `${article.body}\n` +
        imageLine;
}

// 格式化价格
function formatPrice(price, currency = '¥') {
    if (price === '-') return '-';
    if (typeof price === 'number') {
        return `${currency}${price}`;
    }
    return price;
}

// 格式化划线价格
function formatStrikethrough(price, originalPrice, currency = '¥') {
    if (price === '-') return '-';
    if (typeof price === 'number' && typeof originalPrice === 'number') {
        const priceStr = Number.isInteger(price) ? price : price.toFixed(0);
        const originalStr = Number.isInteger(originalPrice) ? originalPrice : originalPrice.toFixed(0);
        if (price < originalPrice) {
            return `${currency}${priceStr} ~~${originalStr}~~`;
        }
        return `${currency}${priceStr}`;
    }
    return formatPrice(price, currency);
}

// 清理表格单元格内容（移除换行符，防止破坏表格格式）
function escapeTableCell(text) {
    if (!text) return '-';
    return String(text)
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' <br> ')
        .trim() || '-';
}

function formatSubtitle(text) {
    return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).join('  \n');
}

function normalizeLookupValue(value) {
    return String(value || '').trim().toLowerCase();
}

function buildPlanLookupKey(vendor, plan, type) {
    return [vendor, plan, type].map(normalizeLookupValue).join('::');
}

function buildDerivedUsageMap(items) {
    return new Map((items || []).map(item => [
        buildPlanLookupKey(item.vendor, item.plan, item.type || 'Coding Plan'),
        item
    ]));
}

const derivedUsageMap = buildDerivedUsageMap(derivedUsage.items);

function formatTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return '-';
    return escapeTableCell(tags.join(' / '));
}

function formatTokenLimit(value) {
    if (typeof value === 'number') return `${value.toLocaleString()}M Tokens`;
    if (value === undefined || value === null || value === '') return '-';
    return escapeTableCell(String(value));
}

function formatCompactTokens(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return '-';

    const absValue = Math.abs(numeric);
    if (absValue >= 100000000) {
        return `${(numeric / 100000000).toFixed(absValue >= 1000000000 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '')}亿`;
    }
    if (absValue >= 10000) {
        return `${(numeric / 10000).toFixed(absValue >= 1000000 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '')}万`;
    }
    return Math.round(numeric).toLocaleString('zh-CN');
}

function formatNumericPrice(value, currency = '¥') {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return '-';
    const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
    return `${currency}${formatted}`;
}

function getMonthlyUsageMetrics(plan) {
    const lookupKey = buildPlanLookupKey(plan.vendor, plan.plan, plan.type || 'Coding Plan');
    const derivedPlan = derivedUsageMap.get(lookupKey);
    const monthlyWindow = derivedPlan && derivedPlan.windows && derivedPlan.windows.monthly;
    const tokenPerCny = Number(monthlyWindow && monthlyWindow.tokenPerCny || 0);

    if (!Number.isFinite(tokenPerCny) || tokenPerCny <= 0) {
        return {
            tokenPerCny: '-',
            cnyPerMillionTokens: '-'
        };
    }

    return {
        tokenPerCny: formatCompactTokens(tokenPerCny),
        cnyPerMillionTokens: formatNumericPrice(1000000 / tokenPerCny)
    };
}

function formatStatus(discontinued) {
    return discontinued ? '已下线' : '在售';
}

// 计算原始价格（包月×3 或 包月×12）
function getOriginalPrice(currentPrice, multiplier) {
    if (currentPrice === '-' || typeof currentPrice !== 'number') return null;
    return currentPrice * multiplier;
}

// 生成套餐对比表
function generateTable(plans) {
    let md = '| 平台 | 套餐 | 类型 | 链接 | 评分 | 标签 | 首月价格 | 连续包月 | 连续包季 | 连续包年 | 5小时请求数 | 每周请求数 | 每月总请求数 | 实测5h Token | 实测周Token | 实测月Token | 每元Token数（月） | 1M Token价格（月） | Token上限 | 支持模型 | 其他权益 | 状态 | 备注 |\n';
    md += '|------|------|------|------|------|------|---------|---------|---------|---------|-----------|-----------|-----------|-------------|------------|------------|----------------|------------------|-----------|---------|---------|------|------|\n';
    
    plans.forEach(plan => {
        const vendor = plan.vendor;
        const planName = plan.plan;
        const type = plan.type || 'Coding Plan';
        const link = `[跳转](${plan.action})`;
        const rating = plan.rating ? `${generateStars(plan.rating)}` : '-';
        const tags = formatTags(plan.tags);
        const currency = plan.currency || '¥';
        const firstMonth = formatPrice(plan.firstMonthPrice, currency);
        const monthly = formatPrice(plan.monthlyPrice, currency);
        // 包季：有值时加 " / 季"
        const quarterly = plan.quarterlyPrice !== '-' 
            ? formatStrikethrough(plan.quarterlyPrice, getOriginalPrice(plan.monthlyPrice, 3), currency) + ' / 季'
            : '- / 季';
        // 包年：有值时加 " / 年"
        const yearly = plan.yearlyPrice !== '-'
            ? formatStrikethrough(plan.yearlyPrice, getOriginalPrice(plan.monthlyPrice, 12), currency) + ' / 年'
            : '- / 年';
        const tokenLimit = formatTokenLimit(plan.tokenLimit);
        const measuredFiveHours = formatTokenLimit(plan.measuredFiveHoursTokenLimit);
        const measuredWeekly = formatTokenLimit(plan.measuredWeeklyTokenLimit);
        const measuredMonthly = formatTokenLimit(plan.measuredMonthlyTokenLimit);
        const monthlyUsageMetrics = getMonthlyUsageMetrics(plan);
        const models = escapeTableCell(plan.models.join(', '));
        const fiveHoursRequests = plan.fiveHoursRequests?.toLocaleString() || '未公开';
        const weeklyRequests = plan.weeklyRequests?.toLocaleString() || '-';
        const monthlyRequests = plan.monthlyRequests?.toLocaleString() || '未公开';
        const benefits = escapeTableCell(plan.benefits?.join(' / '));
        const status = formatStatus(plan.discontinued);
        const note = escapeTableCell(plan.note);

        md += `| ${vendor} | ${planName} | ${type} | ${link} | ${rating} | ${tags} | ${firstMonth} | ${monthly} | ${quarterly} | ${yearly} | ${fiveHoursRequests} | ${weeklyRequests} | ${monthlyRequests} | ${measuredFiveHours} | ${measuredWeekly} | ${measuredMonthly} | ${monthlyUsageMetrics.tokenPerCny} | ${monthlyUsageMetrics.cnyPerMillionTokens} | ${tokenLimit} | ${models} | ${benefits} | ${status} | ${note} |\n`;
    });
    
    return md;
}

// 生成账号出售
function generateAccountSale(accountSale) {
    if (!accountSale || !accountSale.accounts || accountSale.accounts.length === 0) {
        return '';
    }
    
    let md = `## ${accountSale.title}\n\n`;
    md += `${accountSale.description}\n\n`;
    
    accountSale.accounts.forEach(acc => {
        md += `* 低价出一个${acc.platform}账号，${acc.detail}，${acc.price}。\n\n`;
    });
    
    md += `感兴趣联系 微信：${accountSale.contact.id}\n\n`;
    if (accountSale.qrcode) {
        md += `![微信二维码](${accountSale.qrcode})\n\n`;
    }
    
    return md;
}

function generateUpdates(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
        return '';
    }

    let md = '## 📝 更新日志\n\n';
    updates.forEach(update => {
        md += `### ${update.date}\n\n`;
        (update.items || []).forEach(item => {
            md += `- ${item}\n`;
        });
        md += '\n';
    });
    return md;
}

// 生成完整 README
function generateReadme() {
    const { notes, accountSale, updates, header } = config;
    const featuredArticle = parseFeaturedArticle(indexHtml);
    
    let md = `# ${header.title}

> ${header.updateDate}

## 📖 简介

${formatSubtitle(header.subtitle)}

${header.models}

### 在线访问

直接访问：[${ONLINE_URL}](${ONLINE_URL})


${generateFeaturedArticle(featuredArticle)}

## 平台推荐

${generateRecommendationsSection(config)}${generateRatingGuide(config.ratingGuide)}

## 📋 套餐对比表

${generateTable(plans)}

💡 **说明**

${notes.map(n => `- ${n}`).join('\n')}

${generateUpdates(updates)}${generateAccountSale(accountSale)}## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来完善本项目的数据和功能。

---

> ${FOOTER}
`;

    return md;
}

// 主函数
function main() {
    const readme = generateReadme();
    
    // 直接输出到 README.md
    const outputPath = path.join(__dirname, '../../README.md');
    fs.writeFileSync(outputPath, readme, 'utf8');
    
    console.log('README.md 已生成');
}

main();
