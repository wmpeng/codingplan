(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CodingPlanUI = api;
})(globalThis, function () {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escapeHtmlPreserveBreaks = value => escapeHtml(String(value ?? '').replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');
  function sanitizeUrl(value, fallback = null) {
    const url = typeof value === 'string' ? value.trim() : '';
    return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : fallback;
  }
  function route(page, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value != null && value !== '') query.set(key, value);
    return `/${page}/${query.size ? '?' + query : ''}`;
  }
  const statusLabels = Object.freeze({ open: '可以购买', restricted: '购买受限', delisted: '已下架' });
  function modelGroupLabel(groups, id) {
    const group = (groups || []).find(group => group.id === id);
    return group?.label || group?.title || '精选分组';
  }
  function modelPresetSlugs(groups = [], id = 'featured', models) {
    const order = { 'sota-models': 0, 'high-volume-models': 1 };
    const valid = models ? new Set(models.map(model => model.slug)) : null;
    return [...new Set(groups
      .filter(group => group.enabled !== false && (id === 'featured' || group.id === id))
      .sort((a, b) => (order[a.id] ?? 2) - (order[b.id] ?? 2))
      .flatMap(group => group.modelSlugs || []))].filter(slug => !valid || valid.has(slug));
  }
  function prioritizeFeaturedModels(models, groups = []) {
    const featured = new Set(modelPresetSlugs(groups));
    return [...models.filter(model => featured.has(model.slug)), ...models.filter(model => !featured.has(model.slug))];
  }
  const externalLinkIcon = '<svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
  function pinIcon(pinned = false) {
    return `<svg viewBox="0 0 24 24" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
  }
  function pinButton({ pinned = false, label, className = '', attributes = {} } = {}) {
    const action = pinned ? '取消置顶' : '置顶';
    const data = Object.entries(attributes).map(([key, value]) => {
      if (!/^data-[a-z][a-z0-9-]*$/.test(key)) throw new Error(`不支持的置顶按钮属性: ${key}`);
      return ` ${key}="${escapeHtml(value)}"`;
    }).join('');
    return `<button type="button" class="ui-icon-button ui-pin-button ${escapeHtml(className)}${pinned ? ' is-pinned' : ''}"${data} aria-pressed="${!!pinned}" aria-label="${escapeHtml(label || action)}" title="${action}">${pinIcon(pinned)}</button>`;
  }
  function modelTags(labels, options = {}) {
    const models = Array.isArray(labels) ? labels.filter(name => typeof name === 'string' && name.trim()) : [];
    if (!models.length) return '';
    const modelLimit = options.limit == null ? models.length : Math.max(0, options.limit);
    const maxRows = Number.isInteger(options.maxRows) && options.maxRows > 0 ? options.maxRows : null;
    // Reserve a row for the toggle in the static fallback; layout restores fitting tags.
    const limit = maxRows && models.length > maxRows ? Math.min(modelLimit, Math.max(0, maxRows - 1)) : modelLimit;
    const extra = Math.max(0, models.length - limit), expanded = !!options.expanded;
    const toggle = options.toggleAttribute || 'data-toggle-models';
    const tags = models.map((name, index) => `<span class="model-tag"${index >= limit ? ` data-extra-model${expanded ? '' : ' hidden'}` : ''}>${escapeHtml(name)}</span>`).join('');
    const button = extra ? `<button type="button" class="model-tag model-tag-more" ${toggle} data-extra-count="${extra}" aria-expanded="${expanded}"${options.id ? ` aria-controls="${escapeHtml(options.id)}"` : ''} aria-label="${expanded ? '收起额外模型' : `展开其余 ${extra} 个模型`}">${expanded ? '收起' : '+' + extra}</button>` : '';
    return `<div${options.id ? ` id="${escapeHtml(options.id)}"` : ''} class="ui-model-tags ${escapeHtml(options.className || '')}" data-model-tags${maxRows ? ` data-model-max-rows="${maxRows}" data-model-limit="${modelLimit}"` : ''} aria-label="${escapeHtml(options.ariaLabel || '支持模型')}">${tags}${button}</div>`;
  }
  const modelTagLayouts = new WeakMap();
  function fitModelTagRows(groups, force = false) {
    // Read widths first, then fit all changed groups in shared layout passes.
    const jobs = [];
    for (const group of groups) {
      const maxRows = Number(group.dataset.modelMaxRows), width = group.clientWidth;
      if (!maxRows || !width) continue;
      const tags = [...group.querySelectorAll('span.model-tag')], button = group.querySelector('.model-tag-more');
      if (!button || !tags.length) continue;
      const style = getComputedStyle(tags[0]), groupStyle = getComputedStyle(group);
      const signature = [width, maxRows, style.font, style.letterSpacing, groupStyle.columnGap, groupStyle.rowGap].join('|');
      if (!force && modelTagLayouts.get(group) === signature) continue;
      modelTagLayouts.set(group, signature);
      if (button.getAttribute('aria-expanded') === 'true') continue;
      const high = Math.min(tags.length, Number(group.dataset.modelLimit));
      jobs.push({tags, button, maxRows, low:0, high, shown:high});
    }
    function apply(job) {
      const {tags, button, shown} = job;
      tags.forEach((tag, index) => {
        const hidden = index >= shown;
        if (tag.hidden !== hidden) tag.hidden = hidden;
        if (tag.hasAttribute('data-extra-model') !== hidden) tag.toggleAttribute('data-extra-model', hidden);
      });
      const extra = tags.length - shown;
      button.hidden = !extra;
      button.dataset.extraCount = extra;
      if (button.textContent !== '+' + extra) button.textContent = '+' + extra;
      button.setAttribute('aria-label', `展开其余 ${extra} 个模型`);
    }
    function fits(job) {
      let rows = 0, bottom = -Infinity;
      for (const item of [...job.tags, job.button].filter(item => !item.hidden)) {
        const box = item.getBoundingClientRect();
        if (box.top >= bottom - 1) rows++;
        bottom = Math.max(bottom, box.bottom);
        if (rows > job.maxRows) return false;
      }
      return true;
    }
    // Binary search the largest fitting prefix; never alternate writes and reads per tag.
    let pending = jobs;
    while (pending.length) {
      pending.forEach(apply);
      const results = pending.map(fits);
      pending = pending.filter((job, index) => {
        if (results[index]) job.low = job.shown;
        else job.high = job.shown - 1;
        job.shown = Math.ceil((job.low + job.high) / 2);
        return job.low < job.high;
      });
    }
    jobs.forEach(apply);
  }
  function observeModelTagRows(host) {
    const observed = new Set();
    const refresh = (force = false) => {
      const groups = new Set(host.querySelectorAll('[data-model-max-rows]'));
      if (observer) {
        for (const group of observed) if (!groups.has(group)) { observer.unobserve(group); observed.delete(group); }
        for (const group of groups) if (!observed.has(group)) { observer.observe(group); observed.add(group); }
      }
      fitModelTagRows(groups, force);
    };
    const observer = globalThis.ResizeObserver ? new ResizeObserver(entries => {
      fitModelTagRows(entries.map(entry => entry.target));
    }) : null;
    const resize = () => refresh();
    const fontsChanged = () => refresh(true);
    if (!observer) globalThis.addEventListener('resize', resize);
    globalThis.document?.fonts?.addEventListener('loadingdone', fontsChanged);
    refresh();
    return {refresh:resize, disconnect: () => {
      if (observer) observer.disconnect();
      else globalThis.removeEventListener('resize', resize);
      globalThis.document?.fonts?.removeEventListener('loadingdone', fontsChanged);
    }};
  }
  function setModelsExpanded(button, expanded) {
    button.closest('[data-model-tags]').querySelectorAll('[data-extra-model]').forEach(tag => { tag.hidden = !expanded; });
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? '收起额外模型' : `展开其余 ${button.dataset.extraCount} 个模型`);
    button.textContent = expanded ? '收起' : '+' + button.dataset.extraCount;
    fitModelTagRows([button.closest('[data-model-tags]')], true);
  }
  function toggleModels(event, selector = '[data-toggle-models]') {
    const button = event.target.closest(selector);
    if (!button) return false;
    event.preventDefault(); event.stopPropagation();
    setModelsExpanded(button, button.getAttribute('aria-expanded') !== 'true');
    return true;
  }
  return { escapeHtml, escapeHtmlPreserveBreaks, sanitizeUrl, route, statusLabels, modelGroupLabel, modelPresetSlugs, prioritizeFeaturedModels, externalLinkIcon, closeIcon, pinIcon, pinButton, modelTags, setModelsExpanded, toggleModels, observeModelTagRows };
});
