(function (root, factory) {
  const api = factory(root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null), root.NumberDisplay || (typeof require === 'function' ? require('./number-display.js') : null), root.EntityData || (typeof require === 'function' ? require('./entity-data.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanQuota = api;
})(globalThis, function (UI, Numbers, EntityData) {
  'use strict';
  const esc = UI.escapeHtml;
  const methods = {measured:'实测参考', officialQuota:'官方 Token 额度', calculated:'扣减估算', calculatedRequests:'请求估算', multiplied:'倍率估算', unknown:'待确认'};
  const windows = [['fiveHourTokenInM','5 小时'], ['weeklyTokenInM','每周'], ['monthlyTokenInM','每月']];
  const known = value => value === 'unlimited' || Numbers.finite(value) !== null;
  function rows(plan, context, state) {
    const selected = state.modelSlugs;
    const models = UI.prioritizeFeaturedModels(plan.supportedModels || EntityData.supportedModels(context, [plan]), context.modelGroups);
    const order = new Map(models.map((model, index) => [model.slug, index]));
    const rank = row => order.get(row.modelSlug) ?? order.size;
    return (context.relationsByPlanSlug.get(plan.slug) || [])
      .filter(row => !selected?.length || selected.includes(row.modelSlug))
      .sort((a, b) => rank(a) - rank(b));
  }
  function render(plan, context, state, {notesOpen = false} = {}) {
    const items = rows(plan, context, state);
    const columns = windows.filter(([key]) => key === 'monthlyTokenInM' || items.some(row => known(row.usage?.[key])));
    const labels = [...new Set(items.map(row => methods[row.method] || methods.unknown))];
    const mixed = labels.length > 1;
    const requestQuota = ['fiveHours','weekly','monthly'].map((key, index) => {
      const value = plan.requestQuota?.[key];
      return known(value) ? `<span>${windows[index][1]} <strong>${esc(value === 'unlimited' ? '无限制' : Numbers.count(value))}</strong> 次</span>` : '';
    }).filter(Boolean).join('');
    const notes = new Map();
    const body = items.map(row => {
      const presentation = EntityData.billingPresentation(context.modelBySlug.get(row.modelSlug), row);
      const note = (row.note || '').trim();
      if (note && note !== (plan.note || '').trim()) {
        if (!notes.has(note)) notes.set(note, []);
        notes.get(note).push(presentation.relationLabel);
      }
      return `<tr data-quota-relation="${esc(row.slug)}"><th scope="row"><span>${esc(presentation.modelName)}</span>${presentation.tierLabel ? `<small>${esc(presentation.tierLabel)}</small>` : ''}</th>${columns.map(([key]) => `<td>${esc(Numbers.tokenAmount(row.usage?.[key], state.tokenUnit, '未知'))}</td>`).join('')}${mixed ? `<td class="plan-quota-method">${esc(methods[row.method] || methods.unknown)}</td>` : ''}</tr>`;
    }).join('');
    const table = items.length ? `<table class="plan-quota-table"><caption>Token 参考额度（${esc(Numbers.tokenUnit(state.tokenUnit))} Token）</caption><thead><tr><th scope="col">模型 / 档位</th>${columns.map(([,label]) => `<th scope="col">${label}</th>`).join('')}${mixed ? '<th scope="col">口径</th>' : ''}</tr></thead><tbody>${body}</tbody></table>` : '<p class="plan-quota-empty">暂无所选模型的 Token 额度明细。</p>';
    const explanation = [plan.note ? `<p>${esc(plan.note)}</p>` : '', ...[...notes].map(([note, names]) => `<div><strong>${esc(names.join('、'))}</strong><p>${esc(note)}</p></div>`)].join('');
    return `<div class="plan-quota-heading"><h2>${esc(plan.platformName + ' ' + plan.name)} · 额度明细</h2>${!mixed && labels.length ? `<span class="plan-quota-basis">${esc(labels[0])}</span>` : ''}</div>${requestQuota ? `<div class="plan-quota-requests"><span>请求额度</span>${requestQuota}</div>` : ''}${table}<div class="plan-quota-footer">${items.length ? '<span>各模型参考额度不相加。</span>' : ''}<a href="${esc(UI.route('pricing', {platform:plan.platformSlug, plan:plan.slug}))}">完整价格与额度 →</a></div>${explanation ? `<details class="plan-quota-notes" data-plan-quota-notes="${esc(plan.slug)}"${notesOpen ? ' open' : ''}><summary>额度说明与限制</summary><div>${explanation}</div></details>` : ''}`;
  }
  return { rows, render };
});
