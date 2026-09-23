/* 首页需求与方案的呈现层；候选资格和推荐排序继续由原规则维护。 */
(function (root) {
  'use strict';
  const host = document.getElementById('purchaseGuideResults');
  const bar = document.getElementById('offerComparison');
  const focusHost = document.getElementById('offerFocusContext');
  if (!host || !bar || !focusHost) return;
  const W = root.OfferWorkspace, G = root.PurchaseGuide, F = root.CodingPlanFilters;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let controller, result, pool = [], chosen = [], focus = null, only = false, advice = null;
  let picks = new Map(), custom = [], excluded = new Set(), notice = '';
  let addPlatform = '', addPlan = '', pendingLocate = false;
  const label = x => `${x.item.platform.name} · ${x.item.plan.name} · ${x.model.name}${tier(x) ? ' · ' + tier(x) : ''}`;
  const tier = x => [x.row.serviceTier, x.row.contextTier, x.row.timeTier].filter(Boolean).join(' / ');
  const chosenHas = x => chosen.some(c => c.key === x.key);
  const selected = item => pool.find(x => x.item.id === item.id && x.row.slug === picks.get(item.id)) || W.preferredOption(item, pool);
  function amount(value) {
    if (value === 'unlimited') return '不限量';
    if (typeof value !== 'number') return '用量未知';
    const unit = controller.getState().tokenUnit;
    return `${(value / (unit === 'M' ? 1 : 100)).toLocaleString('zh-CN', {maximumFractionDigits: 3})} ${unit === 'M' ? 'M' : '亿'} Token / 月`;
  }
  function quota(x) {
    return x.item.plan.billingMode === 'payg'
      ? (F.targetTokens(controller.getState()) == null ? '按量计费 · 填写月用量后估算支出' : `按 ${amount(F.targetTokens(controller.getState()))} 估算`)
      : x.row.usage?.monthlyTokenInM == null || x.row.usage?.monthlyTokenInM === 'unknown' ? '参考额度未公开' : `参考额度 ${amount(x.row.usage?.monthlyTokenInM)}`;
  }
  function rebuild() {
    // Seed the visible primary recommendations; alternatives are added explicitly.
    const recommendations = (result.groups[0]?.[1] || []).map(selected).filter(Boolean);
    chosen = [...recommendations.filter(x => !excluded.has(x.item.id)), ...custom.map(k => pool.find(x => x.key === k)).filter(Boolean)];
    chosen = [...new Map(chosen.map(x => [x.key, x])).values()];
    if (focus && (!pool.some(x => x.key === focus) || (only && !chosen.some(x => x.key === focus)))) {
      focus = null;
      notice = '需求已更新，原先查看的方案已退出当前比较。';
    }
    if (only && !chosen.length) {
      only = false;
      notice = '当前没有待比较方案，已显示所有符合需求的候选。';
    }
  }
  function update() {
    controller = root.CodingPlanHomeFilters;
    if (!controller) return;
    result = G.recommend(controller.context, controller.getState(), controller.config);
    pool = W.options(result.candidates, controller.context);
    const retained = W.reconcile(custom, pool);
    if (retained.length < custom.length) notice = '已移除不再符合当前需求的自选方案。';
    custom = retained;
    rebuild();
    render();
    refresh();
  }
  function card(item, group) {
    const x = selected(item);
    if (!x) return '';
    const rows = pool.filter(p => p.item.id === item.id);
    return `<article class="guide-result-card${x.key === focus ? ' is-focused' : ''}" data-offer-card="${esc(x.key)}">
      <div class="offer-card-top"><span>${esc(group)}</span><span>${esc(item.platform.name)}</span></div>
      <h3>${esc(item.plan.name)}</h3>
      <label class="offer-model-label">用于比较的模型 / 档位<select data-offer-model="${esc(item.id)}" aria-label="${esc(item.platform.name + ' ' + item.plan.name)} 的比较模型">${rows.map(p => `<option value="${esc(p.row.slug)}" ${p.key === x.key ? 'selected' : ''}>${esc(p.model.name)}${tier(p) ? ' · ' + esc(tier(p)) : ''}</option>`).join('')}</select></label>
      <p class="guide-price">${item.cost === null ? '月支出待估算' : `¥${item.cost.toLocaleString('zh-CN', {maximumFractionDigits: 2})}<small> / 月${item.plan.billingMode === 'payg' ? '（估算）' : ''}</small>`}</p>
      <p class="offer-quota">${esc(quota(x))}</p>
      <p class="offer-rationale">${esc(item.reasons[0] || '符合当前需求')}。</p>
      <details><summary>推荐依据与取舍${item.models.length > 1 ? ` · ${item.models.length} 个模型符合条件` : ''}</summary><ul>${item.reasons.concat(item.cautions).map(t => `<li>${esc(t)}</li>`).join('')}</ul>${x.row.note ? `<p>${esc(x.row.note)}</p>` : ''}<p>切换比较模型不改变需求；套餐内各模型额度不相加。</p></details>
      <div class="offer-card-actions"><button type="button" data-offer-focus="${esc(x.key)}">查看对比依据 ↓</button><button type="button" data-offer-toggle="${esc(x.key)}" aria-pressed="${chosenHas(x)}">${chosenHas(x) ? '已加入比较 ✓' : '加入比较 +'}</button></div>
    </article>`;
  }
  function renderRecommendations() {
    if (advice) {
      host.innerHTML = `<div class="guide-advice"><h3>先直接使用，无需选购套餐</h3><p>${esc(advice)}</p><a href="https://www.doubao.com/" target="_blank" rel="noopener noreferrer">打开豆包 ↗</a><button type="button" data-workspace-restart>改为工具接入或 API</button><p class="guide-note">下方仍保留原有需求与对比，可随时继续选购。</p></div>`;
      return;
    }
    if (!result.candidates.length) {
      host.innerHTML = `<section class="guide-advice"><h3>暂时没有同时满足需求的购买方案</h3><p>可以调整上方需求；我们不会自动放宽条件。</p><div class="guide-options">${result.conflicts.map(x => `<button type="button" data-offer-relax="${x.key}">取消${esc(x.label)}（${x.count} 个候选）</button>`).join('')}</div></section>`;
      return;
    }
    const [primary, ...other] = result.groups;
    host.innerHTML = `<div class="guide-result-heading"><div><p class="home-eyebrow">YOUR OPTIONS</p><h2>按当前需求，先看这几个方案</h2></div><span>${result.candidates.length} 个候选 · 推荐随需求更新</span></div>
      <div class="guide-result-grid">${primary[1].map(x => card(x, primary[0])).join('')}</div>
      ${other.length ? `<details class="offer-alternatives"><summary>其他推荐 · 更省钱或换一种选择（${other.reduce((n, [, items]) => n + items.length, 0)}）</summary><div class="guide-result-grid">${other.flatMap(([group, items]) => items.map(x => card(x, group))).join('')}</div></details>` : ''}`;
  }
  function renderBar() {
    const addOpen = bar.querySelector('.offer-add')?.open || false;
    const current = pool.find(x => x.key === focus);
    const view = document.body.dataset.homeView || 'platforms';
    const relevant = current && (view !== 'plans' || current.item.plan.billingMode !== 'payg');
    bar.hidden = view === 'monitor';
    focusHost.hidden = view === 'monitor';
    bar.innerHTML = `<div class="offer-comparison-heading"><div><h3>对比这些方案</h3><p>从平台、价格与套餐三个角度核对。查看方案不会改变上方需求。</p></div><label class="offer-only"><input type="checkbox" data-offer-only ${only ? 'checked' : ''} ${!chosen.length ? 'disabled' : ''}>只比较已选方案（${chosen.length}）</label></div>
      <div class="offer-chips">${chosen.map(x => `<div class="offer-chip${focus === x.key ? ' is-focused' : ''}"><button type="button" data-offer-focus="${esc(x.key)}" aria-pressed="${focus === x.key}">${esc(label(x))}</button><button type="button" data-offer-toggle="${esc(x.key)}" aria-label="移除 ${esc(label(x))}">×</button></div>`).join('')}${!chosen.length ? '<span>还未选择方案，可从推荐中加入，也可添加其他候选。</span>' : ''}</div>
      <details class="offer-add"><summary>添加其他候选方案</summary><div data-offer-add-fields></div></details>
      `;
    focusHost.innerHTML = `<div class="offer-focus-status" role="status">${notice ? `<p>${esc(notice)}</p>` : ''}${current ? `<strong>正在查看：${esc(label(current))}</strong><p>${esc(quota(current))}${view === 'plans' && !relevant ? '。这是按量方案，没有订阅套餐；请到额度 / 价格查看具体计费。' : view === 'platforms' ? '。平台卡片下方标出了对应的具体方案。' : view === 'plans' ? '。套餐行标出了对应模型；套餐的其他权益可展开查看。' : '。对应模型与档位已在明细中标出；未知额度或单价保留空值，不能参与对应图表。'}</p>${relevant ? '<button type="button" data-offer-locate>定位对应内容 ↓</button>' : '<button type="button" data-offer-price>查看额度 / 价格 →</button>'}<button type="button" data-offer-unfocus>取消定位</button>` : ''}</div>`;
    renderAdd();
    bar.querySelector('.offer-add').open = addOpen;
  }
  function renderAdd() {
    const platforms = [...new Map(pool.map(x => [x.item.platform.slug, x.item.platform])).values()];
    if (!platforms.some(x => x.slug === addPlatform)) addPlatform = platforms[0]?.slug || '';
    const plans = [...new Map(pool.filter(x => x.item.platform.slug === addPlatform).map(x => [x.item.plan.slug, x.item.plan])).values()];
    if (!plans.some(x => x.slug === addPlan)) addPlan = plans[0]?.slug || '';
    const rows = pool.filter(x => x.item.platform.slug === addPlatform && x.item.plan.slug === addPlan);
    bar.querySelector('[data-offer-add-fields]').innerHTML = pool.length ? `<label>平台<select data-add-platform>${platforms.map(x => `<option value="${esc(x.slug)}" ${x.slug === addPlatform ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><label>套餐 / 计费方案<select data-add-plan>${plans.map(x => `<option value="${esc(x.slug)}" ${x.slug === addPlan ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><label>模型 / 档位<select data-add-option>${rows.map(x => `<option value="${esc(x.key)}">${esc(x.model.name)}${tier(x) ? ' · ' + esc(tier(x)) : ''}</option>`).join('')}</select></label><button type="button" data-offer-add>加入比较</button>` : '<p>当前没有符合需求的在售候选，请先调整需求。</p>';
  }
  function render() {
    const alternativesOpen = host.querySelector('.offer-alternatives')?.open;
    const openCards = [...host.querySelectorAll('[data-offer-card] details[open]')].map(el => el.closest('[data-offer-card]').dataset.offerCard);
    renderRecommendations(); renderBar();
    if (alternativesOpen && host.querySelector('.offer-alternatives')) host.querySelector('.offer-alternatives').open = true;
    host.querySelectorAll('[data-offer-card]').forEach(el => { if (openCards.includes(el.dataset.offerCard)) el.querySelector('details').open = true; });
  }
  function refresh() {
    root.__codingplanHomeApi?.setUnifiedFilters(controller.getState());
    root.dispatchEvent(new Event('codingplan:comparison-changed'));
    decorate();
  }
  function decorate() {
    const nodes = document.querySelectorAll('#platformCardGrid .platform-card[data-platform-id], #tableBody [data-plan-slug], #view-usage [data-table-body="comparison"] [data-point-id]');
    const current = pool.find(x => x.key === focus);
    nodes.forEach(el => {
      const matches = x => el.hasAttribute('data-platform-id') ? x.item.platform.slug === el.dataset.platformId : el.hasAttribute('data-plan-slug') ? x.item.plan.slug === el.dataset.planSlug : x.row.slug === el.dataset.pointId;
      const items = chosen.filter(matches);
      if (current && matches(current) && !items.some(x => x.key === current.key)) items.unshift(current);
      el.classList.toggle('offer-highlight', !!current && matches(current));
      let note = el.querySelector('.offer-evidence');
      if (!items.length) { note?.remove(); return; }
      if (!note) {
        note = document.createElement('div'); note.className = 'offer-evidence';
        (el.tagName === 'TR' ? el.cells[1] : el).append(note);
      }
      note.textContent = items.map(x => `${x.key === focus ? '正在查看' : '已选方案'}：${x.item.plan.name} · ${x.model.name}${tier(x) ? ' · ' + tier(x) : ''}`).join('；');
    });
  }
  function locate() {
    const node = document.querySelector('[data-main-view-panel]:not([hidden]) .offer-highlight');
    pendingLocate = !node;
    if (node) {
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
      node.focus({preventScroll: true});
      node.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }
  function viewFocus(key) {
    const x = pool.find(x => x.key === key);
    if (!x) return;
    focus = key;
    if (only && !chosenHas(x)) { excluded.delete(x.item.id); custom.push(x.key); }
    rebuild(); render(); refresh();
    document.getElementById('mainViewTabs').scrollIntoView({behavior: 'smooth', block: 'start'});
    if (document.body.dataset.homeView === 'plans' && x.item.plan.billingMode === 'payg') {
      focusHost.querySelector('[data-offer-price]')?.focus({preventScroll: true});
    } else locate();
  }
  [host, bar, focusHost].forEach(el => el.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    const d = button.dataset;
    if (d.offerFocus) { viewFocus(d.offerFocus); return; }
    if ('offerLocate' in d) { locate(); return; }
    if ('offerPrice' in d) { root.__mainViewsController.setView('usage'); return; }
    if ('workspaceRestart' in d) { root.dispatchEvent(new Event('codingplan:guide-restart')); return; }
    if (d.offerRelax) { controller.setState({[d.offerRelax]: F.createDefaultState({}, {mode:'full'})[d.offerRelax]}, 'manual'); return; }
    if ('offerUnfocus' in d) focus = null;
    if (d.offerToggle) {
      const x = pool.find(p => p.key === d.offerToggle); if (!x) return;
      if (chosenHas(x)) { if (selected(x.item).key === x.key) excluded.add(x.item.id); custom = custom.filter(k => k !== x.key); if (focus === x.key) focus = null; }
      else { excluded.delete(x.item.id); custom.push(x.key); }
    }
    if ('offerAdd' in d) {
      const key = bar.querySelector('[data-add-option]')?.value;
      if (!key) return;
      custom.push(key); notice = '已加入比较，需求条件保持不变。';
    }
    rebuild(); render(); refresh();
    // Replacing a card or the comparison bar must not strand keyboard focus on body.
    const restored = [...el.querySelectorAll('button')].find(next =>
      d.offerToggle ? next.dataset.offerToggle === d.offerToggle :
      'offerAdd' in d ? next.hasAttribute('data-offer-add') :
      'offerUnfocus' in d ? next.hasAttribute('data-offer-unfocus') : false);
    (restored || bar.querySelector('.offer-add > summary'))?.focus({preventScroll: true});
  }));
  host.addEventListener('change', event => {
    const id = event.target.dataset.offerModel;
    if (!id) return;
    const old = selected(result.candidates.find(x => x.id === id));
    picks.set(id, event.target.value);
    custom = custom.map(key => key === old.key ? selected(old.item).key : key);
    if (old?.key === focus) focus = selected(old.item).key;
    rebuild(); render(); refresh();
    host.querySelectorAll('[data-offer-model]').forEach(el => { if (el.dataset.offerModel === id) el.focus({preventScroll: true}); });
  });
  bar.addEventListener('change', event => {
    if (event.target.hasAttribute('data-offer-only')) {
      only = event.target.checked;
      if (only && !chosen.some(x => x.key === focus)) focus = null;
      renderBar(); refresh(); bar.querySelector('[data-offer-only]').focus({preventScroll: true});
    }
    if (event.target.hasAttribute('data-add-platform')) { addPlatform = event.target.value; renderAdd(); bar.querySelector('[data-add-platform]')?.focus({preventScroll: true}); }
    if (event.target.hasAttribute('data-add-plan')) { addPlan = event.target.value; renderAdd(); bar.querySelector('[data-add-plan]')?.focus({preventScroll: true}); }
  });
  root.CodingPlanOfferWorkspace = {
    filter: (values, kind) => W.project(values, chosen, kind, only), decorate,
    planDisplay: plan => {
      if (!only) return plan;
      const items = chosen.filter(x => x.item.plan.slug === plan.slug);
      return {...plan, monthlyTokenOptions: items.map(x => ({modelSlug:x.row.modelSlug, value:x.row.usage?.monthlyTokenInM})), modelLabels:[...new Set(items.map(x => x.model.name + (tier(x) ? ' · ' + tier(x) : '')))]};
    },
    getState: () => ({only, focus, chosen: chosen.map(x => ({key:x.key, platformSlug:x.item.platform.slug, planSlug:x.item.plan.slug, modelSlug:x.row.modelSlug, rowSlug:x.row.slug}))})
  };
  root.addEventListener('codingplan:filters-changed', e => { if (!e.detail.full) { notice = ''; update(); } });
  root.addEventListener('codingplan:filters-ready', update);
  root.addEventListener('codingplan:guide-advice', e => { if (advice === e.detail) return; advice = e.detail; if (result) renderRecommendations(); });
  root.addEventListener('codingplan:view-ready', () => { if (result) { renderBar(); decorate(); if (pendingLocate && focus) locate(); } });
  if (root.CodingPlanHomeFilters) update();
})(globalThis);
