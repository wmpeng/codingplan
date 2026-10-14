// 模态外壳共用焦点、Escape、背景 inert 和滚动锁；内容由调用方维护。
(() => {
  'use strict';
  const stack = [];
  let previousOverflow;
  const backgrounds = new Map();
  const visible = element => !!element.getClientRects().length && !element.closest('[hidden],[inert]');
  function synchronize() {
    const top = stack.at(-1);
    for (const [node, value] of backgrounds) node.inert = value;
    backgrounds.clear();
    if (top) for (const node of document.body.children) {
      if (node === top.overlay || node.contains(top.overlay) || node.tagName === 'SCRIPT') continue;
      backgrounds.set(node, node.inert); node.inert = true;
    }
  }
  function activate(overlay, options = {}) {
    const existing = stack.find(entry => entry.overlay === overlay);
    if (existing) return existing.release;
    const dialog = options.dialog || overlay.querySelector('[role="dialog"]') || overlay;
    const entry = { overlay, dialog, trigger: options.trigger || document.activeElement, onClose: options.onClose };
    if (!stack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    stack.push(entry); synchronize();
    entry.release = (restoreFocus = true) => {
      const index = stack.indexOf(entry);
      if (index < 0) return;
      const wasTop = index === stack.length - 1;
      stack.splice(index, 1); synchronize();
      if (!stack.length) document.body.style.overflow = previousOverflow;
      if (restoreFocus && wasTop && entry.trigger?.isConnected && visible(entry.trigger)) entry.trigger.focus({ preventScroll: true });
    };
    const initial = options.initialFocus || dialog.querySelector('button, a[href], input, select, textarea, [tabindex]') || dialog;
    if (!initial.hasAttribute('tabindex') && initial === dialog) initial.tabIndex = -1;
    initial.focus({ preventScroll: true });
    return entry.release;
  }
  document.addEventListener('keydown', event => {
    const top = stack.at(-1);
    if (!top) return;
    if (event.key === 'Escape' && top.onClose) {
      event.preventDefault(); event.stopImmediatePropagation(); top.onClose();
    }
    if (event.key !== 'Tab') return;
    const elements = [...top.dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(visible);
    const first = elements[0] || top.dialog, last = elements.at(-1) || top.dialog;
    if (!elements.length || !top.dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }, true);
  document.addEventListener('focusin', event => {
    const top = stack.at(-1);
    if (top && !top.dialog.contains(event.target)) (top.dialog.querySelector('button:not(:disabled),input:not(:disabled),a[href]') || top.dialog).focus({ preventScroll: true });
  });
  window.CodingPlanDialogs = { activate };
})();
