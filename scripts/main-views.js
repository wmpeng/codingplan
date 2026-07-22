(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.MainViews = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAIN_VIEW_KEYS = ['platforms', 'plans', 'payg', 'monitor'];
  const MAIN_VIEW_LABELS = {
    platforms: '平台对比',
    plans: '套餐大表',
    payg: '按量计价',
    monitor: '可用性监控'
  };

  function normalizeMainView(raw) {
    const key = String(raw || '').trim();
    return MAIN_VIEW_KEYS.includes(key) ? key : 'platforms';
  }

  function readMainViewFromSearch(search) {
    const q = String(search || '');
    const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    return normalizeMainView(params.get('view'));
  }

  function buildMainViewUrl(view, options) {
    const opts = options || {};
    const pathname = opts.pathname == null ? '' : String(opts.pathname);
    const currentSearch = String(opts.currentSearch || '');
    const params = new URLSearchParams(
      currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
    );
    const normalized = normalizeMainView(view);
    if (normalized === 'platforms') {
      params.delete('view');
    } else {
      params.set('view', normalized);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname || '?';
  }

  function applyMainViewDom(options) {
    const opts = options || {};
    const view = normalizeMainView(opts.view);
    const panels = opts.panels || {};
    MAIN_VIEW_KEYS.forEach((key) => {
      const el = panels[key];
      if (el) el.hidden = key !== view;
    });
    const tabsRoot = opts.tabsRoot;
    if (tabsRoot) {
      tabsRoot.querySelectorAll('[data-main-view]').forEach((btn) => {
        const key = btn.getAttribute('data-main-view');
        const active = key === view;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    return view;
  }

  function mountHomepageViews(options) {
    const opts = options || {};
    const tabsRoot = opts.tabsRoot;
    const getPanels = typeof opts.getPanels === 'function' ? opts.getPanels : () => opts.panels || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    const historyApi = opts.history || (typeof history !== 'undefined' ? history : null);
    const locationApi = opts.location || (typeof location !== 'undefined' ? location : { search: '', pathname: '' });

    let current = readMainViewFromSearch(locationApi.search);

    function apply(view, meta) {
      current = applyMainViewDom({
        view,
        panels: getPanels(),
        tabsRoot
      });
      onChange(current, meta || {});
      if (tabsRoot && typeof tabsRoot.scrollIntoView === 'function' && meta && meta.scroll !== false) {
        try {
          tabsRoot.scrollIntoView({ block: 'start', behavior: 'instant' });
        } catch (_) {
          tabsRoot.scrollIntoView(true);
        }
      }
      return current;
    }

    function setView(view, setOpts) {
      const next = normalizeMainView(view);
      const push = !(setOpts && setOpts.replace);
      const url = buildMainViewUrl(next, {
        pathname: locationApi.pathname || '',
        currentSearch: locationApi.search || ''
      });
      if (historyApi) {
        const state = { mainView: next };
        if (push && typeof historyApi.pushState === 'function') {
          historyApi.pushState(state, '', url);
        } else if (typeof historyApi.replaceState === 'function') {
          historyApi.replaceState(state, '', url);
        }
      }
      if (locationApi && typeof locationApi === 'object') {
        // keep fake location in sync for tests
        try {
          const u = new URL(url, 'http://local.test');
          locationApi.search = u.search;
          locationApi.pathname = u.pathname;
        } catch (_) { /* ignore */ }
      }
      return apply(next, { reason: (setOpts && setOpts.reason) || 'set', scroll: !(setOpts && setOpts.scroll === false) });
    }

    apply(current, { reason: 'init', scroll: false });

    if (tabsRoot) {
      tabsRoot.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-main-view]');
        if (!btn || !tabsRoot.contains(btn)) return;
        e.preventDefault();
        setView(btn.getAttribute('data-main-view'), { reason: 'tab' });
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        const view = readMainViewFromSearch(location.search);
        apply(view, { reason: 'popstate' });
      });
    }

    return {
      getView: () => current,
      setView,
      apply
    };
  }

  return {
    MAIN_VIEW_KEYS,
    MAIN_VIEW_LABELS,
    normalizeMainView,
    readMainViewFromSearch,
    buildMainViewUrl,
    applyMainViewDom,
    mountHomepageViews
  };
});
