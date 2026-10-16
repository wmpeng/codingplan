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
    const limit = options.limit == null ? models.length : Math.max(0, options.limit);
    const extra = Math.max(0, models.length - limit), expanded = !!options.expanded;
    const toggle = options.toggleAttribute || 'data-toggle-models';
    const tags = models.map((name, index) => `<span class="model-tag"${index >= limit ? ` data-extra-model${expanded ? '' : ' hidden'}` : ''}>${escapeHtml(name)}</span>`).join('');
    const button = extra ? `<button type="button" class="model-tag model-tag-more" ${toggle} data-extra-count="${extra}" aria-expanded="${expanded}"${options.id ? ` aria-controls="${escapeHtml(options.id)}"` : ''} aria-label="${expanded ? '收起额外模型' : `展开其余 ${extra} 个模型`}">${expanded ? '收起' : '+' + extra}</button>` : '';
    return `<div${options.id ? ` id="${escapeHtml(options.id)}"` : ''} class="ui-model-tags ${escapeHtml(options.className || '')}" data-model-tags aria-label="${escapeHtml(options.ariaLabel || '支持模型')}">${tags}${button}</div>`;
  }
  function setModelsExpanded(button, expanded) {
    button.closest('[data-model-tags]').querySelectorAll('[data-extra-model]').forEach(tag => { tag.hidden = !expanded; });
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? '收起额外模型' : `展开其余 ${button.dataset.extraCount} 个模型`);
    button.textContent = expanded ? '收起' : '+' + button.dataset.extraCount;
  }
  function toggleModels(event, selector = '[data-toggle-models]') {
    const button = event.target.closest(selector);
    if (!button) return false;
    event.preventDefault(); event.stopPropagation();
    setModelsExpanded(button, button.getAttribute('aria-expanded') !== 'true');
    return true;
  }
  return { escapeHtml, escapeHtmlPreserveBreaks, sanitizeUrl, route, statusLabels, externalLinkIcon, closeIcon, pinIcon, pinButton, modelTags, setModelsExpanded, toggleModels };
});
