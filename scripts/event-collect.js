/* 通用事件发送器。唯一维护源；网站通过构建同步此文件。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.EventCollect = factory(root);
})(globalThis, function createEventCollect(env) {
  'use strict';
  let config, queue = [], sending = false, timer, retryAt = 0, stopped = false;
  let pageId, session, visitor, disabled = false;
  const MAX_QUEUE = 200, MAX_BYTES = 32768, MAX_RETRIES = 2;
  const now = () => (env.Date || Date).now();
  const id = () => env.crypto.randomUUID ? env.crypto.randomUUID() :
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (Number(c) ^ env.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
  const storageKey = suffix => `eventCollect:${config.namespace}:${suffix}`;
  function read(suffix) { try { return JSON.parse(env.localStorage.getItem(storageKey(suffix))); } catch (_) { return null; } }
  function write(suffix, value) { try { env.localStorage.setItem(storageKey(suffix), JSON.stringify(value)); } catch (_) {} }
  function enabled() { return !!config && config.enabled !== false && read('disabled') !== true && !disabled && !stopped; }
  function identities() {
    const time = now();
    visitor = read('visitor') || visitor;
    if (!visitor || typeof visitor.id !== 'string' || visitor.expires <= time) {
      visitor = { id: id(), expires: time + 90 * 86400000 }; write('visitor', visitor);
    }
    session = read('session') || session;
    if (!session || typeof session.id !== 'string' || time - session.last >= 1800000) session = { id: id(), last: time };
    session.last = time; write('session', session);
    return { visitor_id: visitor.id, session_id: session.id, page_view_id: pageId };
  }
  function context() {
    const result = { sdk_version: '1.0.0', device_type: env.innerWidth < 768 ? 'mobile' : 'desktop' };
    try {
      const source = new URL(env.document.referrer);
      if (source.origin !== env.location.origin) result.referrer_host = source.hostname;
    } catch (_) {}
    const query = new URLSearchParams(env.location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
      const value = query.get(key); if (value) result[key] = value.slice(0, 128);
    }
    return { ...result, ...config.context };
  }
  const bytes = value => new TextEncoder().encode(value).length;
  function track(name, properties = {}) {
    if (!enabled()) return null;
    try {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) return null;
      // 快照业务参数，防止调用者后续修改影响排队中的事件。
      const params = JSON.parse(JSON.stringify(properties));
      const item = { event_id: id(), event_name: name, event_version: 1, occurred_at_ms: now(),
        ...identities(), page_path: env.location.pathname, context: context(), properties: params };
      if (bytes(JSON.stringify([item.context, item.properties])) > 8192) return null;
      if (queue.length >= MAX_QUEUE) queue.shift();
      queue.push({ item, attempts: 0 });
      if (config.debug && env.console) env.console.debug('[event_collect]', item);
      if (queue.length >= 10) void flush();
      return item;
    } catch (_) { return null; }
  }
  async function flush(urgent = false) {
    if (!enabled() || sending || !queue.length || now() < retryAt) return;
    const batch = [];
    let body;
    while (queue.length && batch.length < 50) {
      const next = queue[0];
      const candidate = JSON.stringify({ namespace: config.namespace, events: [...batch.map(x => x.item), next.item] });
      if (bytes(candidate) > MAX_BYTES) { if (!batch.length) queue.shift(); break; }
      batch.push(queue.shift()); body = candidate;
    }
    if (!batch.length) return;
    if (urgent) {
      try { if (env.navigator.sendBeacon(config.endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return; } catch (_) {}
    }
    sending = true;
    let retry = false, delay = 1000;
    const abort = new env.AbortController();
    const timeout = env.setTimeout(() => abort.abort(), 8000);
    try {
      const response = await env.fetch(config.endpoint, { method: 'POST', body, keepalive: true,
        credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, signal: abort.signal });
      retry = response.status === 429 || response.status >= 500;
      if (retry) {
        const seconds = Number(response.headers.get('Retry-After'));
        delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 120000) : 2000;
      }
    } catch (_) { retry = true; }
    finally { env.clearTimeout(timeout); sending = false; }
    if (retry && enabled()) {
      const remaining = batch.filter(entry => ++entry.attempts <= MAX_RETRIES);
      queue = [...remaining, ...queue].slice(-MAX_QUEUE);
      retryAt = now() + delay;
    }
  }
  function setEnabled(value) {
    if (!config) return;
    disabled = !value; write('disabled', !value);
    if (!value) queue = [];
  }
  function init(options) {
    if (config) return api;
    config = { enabled: true, context: {}, ...options };
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(config.namespace || '') || !config.endpoint) config.enabled = false;
    try { pageId = id(); } catch (_) { config.enabled = false; }
    timer = env.setInterval(() => { void flush(); }, 5000);
    env.document.addEventListener('visibilitychange', () => { if (env.document.visibilityState === 'hidden') void flush(true); });
    env.addEventListener('pagehide', () => { void flush(true); });
    env.addEventListener('pageshow', event => {
      if (event.persisted) { pageId = id(); track('page_view', { navigation: 'back_forward' }); }
    });
    env.addEventListener('storage', event => { if (event.key === storageKey('disabled') && !enabled()) queue = []; });
    return api;
  }
  function destroy() { stopped = true; queue = []; env.clearInterval(timer); }
  const api = { init, track, flush, setEnabled, isEnabled: enabled, destroy };
  return api;
});
