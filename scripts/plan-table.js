(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanTable = api;
})(globalThis, function (root) {
  'use strict';
  const UI = root.CodingPlanUI || require('./ui-core.js'), esc = UI.escapeHtml;
  const Filters = root.CodingPlanFilters || require('./filter-state.js');
  const Directory = root.PlanDirectory || require('./plan-directory.js');
  const Numbers = root.NumberDisplay || require('./number-display.js');
  const EntityData = root.EntityData || require('./entity-data.js');
  const Notices = root.ChangeNotices || require('./change-notices.js');
  const money = (plan, field) => {
    const value = Directory.priceValue(plan, field);
    return Numbers.monthlyFee(value, plan.currency || '¥', '未知');
  };
  const requests = (plan, field) => {
    const value = plan.requestQuota?.[field];
    if (value === 'unlimited') return '无限制';
    if (Numbers.finite(value) === null) return '未知';
    return (field === 'monthly' ? Numbers.tokens : Numbers.count)(value);
  };
  function chips(values) {
    const items = values || [], tag = value => `<span class="tool-tag">${esc(value)}</span>`;
    return items.slice(0, 4).map(tag).join('') + (items.length > 4 ? `<details class="plan-cell-more"><summary>另 ${items.length - 4} 项</summary>${items.slice(4).map(tag).join('')}</details>` : '');
  }
  const quotaId = plan => `plan-quota-${encodeURIComponent(plan.slug)}`;
  function rowsHtml(selection, context, options = {}) {
    const expandedQuotas = options.expandedQuotas || new Set();
    const expandedPlanNotes = options.expandedPlanNotes || new Set();
    const quotaContent = options.quotaContent || (() => '');
    return selection.visible.map(plan => {
          const status = plan.planStatus || 'open';
          const url = UI.sanitizeUrl(plan.action, '');
          const models = UI.prioritizeFeaturedModels(plan.supportedModels || [], context.modelGroups);
          const label = `${plan.platformName} ${plan.name}`;
          const scope = {type:'plan',platformSlug:plan.platformSlug,planSlug:plan.slug};
          const notice = key => Notices.forField(context.changes,scope,key);
          const modelNotice = notice('models');
          const modelList = UI.modelTags(models.map(model => model.name), {maxRows:2,ariaLabel:label+' 支持模型'});
          const title = status !== 'delisted' && url
            ? `<a class="plan-title" data-plan-link="${status}" data-collect-outbound data-collect-platform="${esc(plan.platformSlug)}" data-collect-plan="${esc(plan.slug)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${status === 'open' ? '开通' : '去官网查看'} ${esc(label)}">${esc(label)} ${UI.externalLinkIcon}</a>`
            : `<strong class="plan-title">${esc(label)}</strong>`;
          return `<tr data-plan-row="${esc(plan.slug)}" class="${[selection.featured.has(plan.slug) ? 'is-featured' : '', selection.pinned.has(plan.slug) ? 'is-pinned' : ''].filter(Boolean).join(' ')}">
            <td data-plan-col="identity"><div class="plan-identity">${UI.pinButton({pinned:selection.pinned.has(plan.slug), label:`${selection.pinned.has(plan.slug) ? '取消置顶' : '置顶'} ${label}`, attributes:{'data-plan-pin':plan.slug}})}<div class="plan-identity-copy"><div class="plan-identity-line">${title}${selection.featured.has(plan.slug) ? '<span class="platform-featured-badge" data-plan-featured-badge>精选</span>' : ''}${notice('general')}</div><div class="plan-meta">${status === 'open' ? '' : `<span class="tool-tag plan-status" data-plan-status="${status}">${esc(UI.statusLabels[status])}</span>`}${EntityData.harnessApiBadge(plan.supportsHarnessApi)}</div></div></div></td>
            <td data-plan-col="rating"><span class="plan-rating" aria-label="${plan.rating > 0 ? esc(plan.rating)+' 星' : '待评定'}">${plan.rating > 0 ? '★ '+Number(plan.rating).toFixed(1) : '待评定'}</span></td>
            ${['firstMonthPrice','monthlyPrice','quarterlyPrice','yearlyPrice'].map(key => `<td data-plan-col="${key}"${key === 'firstMonthPrice' ? '' : ' data-plan-extra'}>${esc(money(plan,key))}${key==='firstMonthPrice'?notice('price'):''}</td>`).join('')}
            <td data-plan-col="models">${modelNotice ? `<div class="plan-models-with-notice">${modelList}${modelNotice}</div>` : modelList}</td>
            <td data-plan-col="monthlyToken" class="monthly-token-cell"><button type="button" class="plan-quota-toggle" data-plan-quota="${esc(plan.slug)}" aria-expanded="${expandedQuotas.has(plan.slug)}" aria-controls="${quotaId(plan)}" aria-label="${esc(label)} 额度明细"><span>${esc(Filters.formatMonthlyTokens(plan,selection.effectiveState))}</span></button>${notice('quota')}</td>
            ${['fiveHours','weekly','monthly'].map(key => `<td data-plan-col="requestQuota.${key}" data-plan-extra>${esc(requests(plan,key))}</td>`).join('')}
            <td data-plan-col="benefits" data-plan-extra>${chips(plan.benefits)}</td><td class="plan-note" data-plan-col="note">${plan.note ? `<details class="usage-note-disclosure" data-plan-note="${esc(plan.slug)}"${expandedPlanNotes.has(plan.slug) ? ' open' : ''}><summary>用量口径与限制</summary><div>${esc(plan.note)}</div></details>` : '—'}</td>
          </tr><tr class="plan-quota-row" data-plan-quota-row="${esc(plan.slug)}"${expandedQuotas.has(plan.slug) ? '' : ' hidden'}><td colspan="${options.showAllColumns ? 13 : 6}"><section class="plan-quota-panel" id="${quotaId(plan)}" aria-label="${esc(label)} 额度明细">${expandedQuotas.has(plan.slug) ? quotaContent(plan) : ''}</section></td></tr>`;
        }).join('');
  }
  return {rowsHtml};
});
