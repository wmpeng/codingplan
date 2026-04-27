const fs = require('fs');
const path = require('path');

// 读取数据文件
const configPath = path.join(__dirname, '../../config.json');
const plansPath = path.join(__dirname, '../../plans.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const allPlans = JSON.parse(fs.readFileSync(plansPath, 'utf8'));
// 过滤掉已下线的套餐
const plans = allPlans.filter(plan => !plan.discontinued);

// 硬编码内容
const ONLINE_URL = 'https://api.dreamfree.space/c/s/cpgh';
const FOOTER = '由扣子编程开发';

// 生成星星
function generateStars(rating) {
    return '⭐️'.repeat(rating);
}

// 生成平台推荐
function generateRecommendations(recommendations) {
    let md = '';
    recommendations.forEach((rec, index) => {
        md += `${index + 1}. ${rec.name} ${generateStars(rec.rating)}\n`;
        rec.reasons.forEach(reason => {
            md += `    - ${reason}\n`;
        });
    });
    return md;
}

// 生成评分说明
function generateRatingGuide(ratingGuide) {
    if (!ratingGuide) return '';
    return `\n**评分标准**: ${ratingGuide}\n`;
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
    // 将换行符替换为空格
    return String(text).replace(/\n/g, ' ').trim() || '-';
}

// 计算原始价格（包月×3 或 包月×12）
function getOriginalPrice(currentPrice, multiplier) {
    if (currentPrice === '-' || typeof currentPrice !== 'number') return null;
    return currentPrice * multiplier;
}

// 生成套餐对比表
function generateTable(plans) {
    let md = '| 平台 | 套餐 | 类型 | 链接 | 首月价格 | 连续包月 | 连续包季 | 连续包年 | 支持模型 | 5小时请求数 | 每周请求数 | 每月总请求数 | 其他权益 | 备注 |\n';
    md += '|------|------|------|---------|---------|---------|---------|---------|---------|-----------|-----------|-----------|---------|------|\n';
    
    plans.forEach(plan => {
        const vendor = plan.vendor;
        const planName = plan.plan;
        const type = plan.type || 'Coding Plan';
        const link = `[跳转](${plan.action})`;
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
        const models = plan.models.join(', ');
        const fiveHoursRequests = plan.fiveHoursRequests?.toLocaleString() || '未公开';
        const weeklyRequests = plan.weeklyRequests?.toLocaleString() || '-';
        const monthlyRequests = plan.monthlyRequests?.toLocaleString() || '未公开';
        const benefits = escapeTableCell(plan.benefits?.join(', '));
        const note = escapeTableCell(plan.note);

        md += `| ${vendor} | ${planName} | ${type} | ${link} | ${firstMonth} | ${monthly} | ${quarterly} | ${yearly} | ${models} | ${fiveHoursRequests} | ${weeklyRequests} | ${monthlyRequests} | ${benefits} | ${note} |\n`;
    });
    
    return md;
}

// 生成账号出售
function generateAccountSale(accountSale) {
    if (!accountSale || !accountSale.accounts || accountSale.accounts.length === 0) {
        return '';
    }
    
    let md = `# ${accountSale.title}\n\n`;
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

// 生成完整 README
function generateReadme() {
    const { recommendations, notes, accountSale } = config;
    
    let md = `# AI Coding Plan 对比工具

> ${config.header.updateDate}

## 📖 简介

${config.header.subtitle}

${config.header.models}

### 在线访问

直接访问：[${ONLINE_URL}](${ONLINE_URL})


## 平台推荐

${generateRecommendations(recommendations)}${generateRatingGuide(config.ratingGuide)}

## 📋 套餐对比表

${generateTable(plans)}

💡 **说明**

${notes.map(n => `- ${n}`).join('\n')}

${generateAccountSale(accountSale)}## 🤝 贡献

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
