// 生成的默认正文先可读；有自定义状态时，等对应组件完成首次渲染再展示。
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;
  const get = key => { try { return root.localStorage.getItem(key); } catch (_) { return null; } };
  const pinned = key => { if (!key) return false; try { const value = JSON.parse(get(key)); return Array.isArray(value) && value.length > 0; } catch (_) { return false; } };
  const page = root.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  const pinKeys = {'/plans':'codingplanPinnedPlans', '/pricing':'codingplanPinnedPriceRows', '/models':'codingplanPinnedModels', '/platforms':'platformCatalogPinnedIds'};
  const customResults = Boolean(root.location.search) || pinned(pinKeys[page]);
  if (customResults) doc.documentElement.classList.add('static-custom-results');
  if (['M','B'].includes(get('codingplanTokenUnit')) || get('codingplanPriceBasis') === 'monthly') doc.documentElement.classList.add('static-custom-prices');
  if (pinned('platformCatalogPinnedIds')) doc.documentElement.classList.add('static-custom-platforms');
  const nodes = host => [...(host.matches?.('[data-static-content]') ? [host] : []), ...host.querySelectorAll('[data-static-content]')];
  function ready(host = doc) {
    for (const node of nodes(host)) {
      node.removeAttribute('data-static-content');
      node.removeAttribute('data-static-fallback');
      if (node.previousElementSibling?.matches('[data-static-note]')) node.previousElementSibling.remove();
      node.querySelectorAll('[data-static-disabled]').forEach(control => {
        control.disabled = false; control.removeAttribute('data-static-disabled');
      });
    }
  }
  function fail(host = doc) {
    for (const node of nodes(host)) {
      if (node.hasAttribute('data-static-fallback')) continue;
      node.setAttribute('data-static-fallback', '');
      const note = doc.createElement('p');
      note.className = 'tool-muted static-fallback-note';
      note.setAttribute('data-static-note', '');
      note.textContent = '当前显示发布时的默认内容，尚未应用筛选与个人显示设置。';
      node.before(note);
    }
  }
  root.StaticContent = {ready, fail};
  // 核心脚本下载失败时不能让自定义链接一直隐藏已有正文。
  root.addEventListener('error', event => {
    if (event.target !== root && event.target?.tagName !== 'SCRIPT') return;
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => fail(), {once:true});
    else fail();
  }, true);
  // 在目录数据到达前切换显示单位时，同样不能继续展示旧口径。
  for (const name of ['codingplan:token-unit-changed','codingplan:price-basis-changed']) root.addEventListener(name, () => doc.documentElement.classList.add('static-custom-prices'));
})(globalThis);
