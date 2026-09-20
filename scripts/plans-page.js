(function (root) {
  'use strict';
  const Filters = root.CodingPlanFilters;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '未公开';
  const money = (plan, field) => {
    const value = plan && plan[field];
    return typeof value === 'number' && Number.isFinite(value) ? `${plan.currency || '¥'}${number(value)}` : '未公开';
  };

  function chips(values) {
    const items = values || [];
    const tag = value => `<span class="tool-tag">${esc(value)}</span>`;
    return items.slice(0, 4).map(tag).join('') + (items.length > 4 ? `<details class="plan-cell-more"><summary>另 ${items.length - 4} 项</summary>${items.slice(4).map(tag).join('')}</details>` : '');
  }

  function boot() {
    const host = document.getElementById('plansPage');
    if (!host || !Filters || !root.EntityData) return;
    root.CodingPlanToolPage.load().then(({ context, config }) => {
      const allPlans = root.EntityData.buildPlanCatalog(context, { includeHidden: true }).filter(plan => plan.billingMode === 'subscription' && plan.planTableVisible !== false);
      let state = Filters.createDefaultState(config, { mode: 'full' });
      const pinned = new Set();
      let sort = { key: 'monthlyPrice', direction: 'asc' };

      const tableBody = host.querySelector('[data-plan-body]');
      const count = host.querySelector('[data-plan-count]');

      function apply() {
        const filtered = Filters.filterPlans(allPlans, state, { usdToCnyRate: config.usdToCnyRate, context, platformCatalog: config.platformCatalog });
        const valueForSort = plan => {
          if (sort.key === 'monthlyToken') {
            const values = (plan.monthlyTokenOptions || []).filter(row => !state.modelSlugs || state.modelSlugs.includes(row.modelSlug)).map(row => row.value === 'unlimited' ? Infinity : row.value).filter(value => typeof value === 'number');
            return values.length ? Math.min(...values) : null;
          }
          const value = plan[sort.key];
          if (sort.key.endsWith('Price')) return Filters.toCny(value, plan.currency, config.usdToCnyRate);
          if (sort.key.endsWith('Requests')) return value === '无限制' ? Infinity : typeof value === 'number' ? value : null;
          if (sort.key === 'rating') return value > 0 ? value : null;
          return Array.isArray(value) ? value.join('、') : value;
        };
        filtered.sort((a, b) => {
          if (pinned.has(a.slug) !== pinned.has(b.slug)) return pinned.has(a.slug) ? -1 : 1;
          const left = valueForSort(a); const right = valueForSort(b);
          if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
          const result = left === right ? 0 : typeof left === 'number' && typeof right === 'number'
            ? left - right : String(left).localeCompare(String(right), 'zh-CN');
          return sort.direction === 'asc' ? result : -result;
        });
        host.querySelectorAll('[data-plan-sort]').forEach(button => {
          button.closest('th').setAttribute('aria-sort', button.dataset.planSort === sort.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
        });
        count.textContent = `${filtered.length} / ${allPlans.length} 个套餐`;
        tableBody.innerHTML = filtered.length ? filtered.map(plan => `<tr>
          <td><button type="button" class="table-sort-button" data-plan-pin="${esc(plan.slug)}" aria-pressed="${pinned.has(plan.slug)}" aria-label="${pinned.has(plan.slug) ? '取消置顶' : '置顶'} ${esc(plan.name)}">${pinned.has(plan.slug) ? '★' : '☆'}</button> <strong>${esc(plan.platformName)}</strong></td>
          <td>${esc(plan.name)}${plan.discontinued ? '<span class="tool-tag">已下架</span>' : ''}</td>
          ${['firstMonthPrice', 'monthlyPrice', 'quarterlyPrice', 'yearlyPrice'].map(key => `<td>${esc(money(plan, key))}</td>`).join('')}
          ${['fiveHoursRequests', 'weeklyRequests', 'monthlyRequests'].map(key => `<td>${esc(plan[key] == null ? '未公开' : plan[key])}</td>`).join('')}
          <td>${chips(plan.modelLabels)}</td>
          <td class="monthly-token-cell" title="所选模型各档位的月 Token 参考范围，不相加；详细口径见额度/价格对比">${esc(Filters.formatMonthlyTokens(plan, state))}</td>
          <td>${plan.rating > 0 ? esc(plan.rating) + ' / 5' : '待评定'}</td>
          <td>${chips(plan.benefits)}</td>
          <td class="plan-note">${esc(plan.note || '')}</td>
          <td>${plan.discontinued ? '已下架' : `<a href="${esc(plan.action || '#')}" target="_blank" rel="noopener noreferrer">开通 ↗</a>`}</td>
        </tr>`).join('') : '<tr><td colspan="15"><div class="tool-empty">当前条件下没有套餐；可调整上方条件，或恢复全量。</div></td></tr>';
      }

      host.addEventListener('click', event => {
        const pin = event.target.closest('[data-plan-pin]');
        if (pin) {
          const slug = pin.dataset.planPin;
          if (pinned.has(slug)) pinned.delete(slug); else pinned.add(slug);
          apply();
          return;
        }
        const header = event.target.closest('[data-plan-sort]');
        if (header) {
          const key = header.getAttribute('data-plan-sort');
          sort = { key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc' };
          apply();
        }
      });
      host.querySelector('[data-plan-columns]').addEventListener('change', event => host.classList.toggle('show-all-columns', event.target.checked));
      root.CodingPlanToolPage.filters({ context, config }, 'plans', next => { state = next; apply(); });
    }).catch(error => root.CodingPlanToolPage.error(host, error.message));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
