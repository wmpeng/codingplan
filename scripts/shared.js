/* ── codingplan 公共工具函数 ── */

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function escapeHtmlPreserveBreaks(raw) {
    const normalized = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return escapeHtml(normalized).replace(/\n/g, '<br>');
}

function sanitizeHttpUrl(url, fallback = null) {
    if (typeof url !== 'string' || !url.trim()) {
        return fallback;
    }

    try {
        const parsedUrl = new URL(url, window.location.origin);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            return parsedUrl.href;
        }
    } catch (error) {
        return fallback;
    }

    return fallback;
}

function renderNotesSection(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) {
        return false;
    }

    const items = Array.isArray(options.items) ? options.items : [];
    const emptyBehavior = options.emptyBehavior === 'hide' ? 'hide' : 'clear';

    if (!items.length) {
        if (emptyBehavior === 'hide') {
            container.hidden = true;
        } else {
            container.innerHTML = '';
        }
        return false;
    }

    const title = escapeHtml(options.title || '');
    const titleTag = options.titleTag || 'h3';
    const titleClass = options.titleClass ? ` class="${escapeHtml(options.titleClass)}"` : '';
    const listClass = options.listClass ? ` class="${escapeHtml(options.listClass)}"` : '';
    const renderItem = typeof options.renderItem === 'function'
        ? options.renderItem
        : (item) => escapeHtml(item);

    container.hidden = false;
    container.innerHTML = `
        <${titleTag}${titleClass}>${title}</${titleTag}>
        <ul${listClass}>${items.map((item, index) => `<li>${renderItem(item, index)}</li>`).join('')}</ul>
    `;
    return true;
}

function renderUpdatesSection(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) {
        return false;
    }

    const updates = Array.isArray(options.updates) ? options.updates : [];
    const emptyBehavior = options.emptyBehavior === 'hide' ? 'hide' : 'clear';

    if (!updates.length) {
        if (emptyBehavior === 'hide') {
            container.hidden = true;
        } else {
            container.innerHTML = '';
        }
        return false;
    }

    const title = escapeHtml(options.title || '');
    const titleTag = options.titleTag || 'h3';
    const titleClass = options.titleClass ? ` class="${escapeHtml(options.titleClass)}"` : '';
    const listClass = options.listClass ? ` class="${escapeHtml(options.listClass)}"` : ' class="updates-list"';
    const renderDate = typeof options.renderDate === 'function'
        ? options.renderDate
        : (value) => escapeHtml(value);
    const renderItem = typeof options.renderItem === 'function'
        ? options.renderItem
        : (value) => escapeHtml(value);

    container.hidden = false;
    container.innerHTML = `
        <${titleTag}${titleClass}>${title}</${titleTag}>
        <ul${listClass}>
            ${updates.map((update, updateIndex) => `
                <li class="update-item">
                    <div class="log-date">${renderDate(update && update.date, update, updateIndex)}</div>
                    <ul class="update-items">
                        ${((update && Array.isArray(update.items)) ? update.items : []).map((item, itemIndex) => `<li>${renderItem(item, itemIndex, update, updateIndex)}</li>`).join('')}
                    </ul>
                </li>
            `).join('')}
        </ul>
    `;
    return true;
}

function renderSettingsControls(settings = {}) {
    return `
            <div class="settings-wrapper">
                <button class="settings-btn" id="settingsBtn" title="${escapeHtml(settings.buttonTitle || '设置')}" aria-label="${escapeHtml(settings.buttonAriaLabel || settings.buttonTitle || '设置')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
                <div class="settings-panel" id="settingsPanel" hidden>
                    <div class="settings-panel-title"${settings.panelTitleId ? ` id="${escapeHtml(settings.panelTitleId)}"` : ''}>${escapeHtml(settings.panelTitle || '')}</div>
                    <div class="settings-toggle-row">
                        <label for="ultraWideToggle"${settings.ultraWideLabelId ? ` id="${escapeHtml(settings.ultraWideLabelId)}"` : ''}>${escapeHtml(settings.ultraWideLabel || '')}</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="ultraWideToggle">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>`;
}

function renderSettingsOnly(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) {
        return false;
    }
    const settings = options.settings || {};
    container.innerHTML = `
        <div class="page-nav-cluster page-nav-cluster--settings-only">
            ${renderSettingsControls(settings)}
        </div>
    `;
    return true;
}

function renderPageNav(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) {
        return false;
    }

    const tabs = Array.isArray(options.tabs) && options.tabs.length
        ? options.tabs
        : [
            { key: 'index', href: 'index.html', text: 'Coding Plan' },
            { key: 'payg', href: 'payg.html', text: '按量计价' },
            { key: 'plan-usage', href: 'plan-usage.html', text: 'Coding Plan用量提交' },
            { key: 'coding-agents', href: 'coding-agents.html', text: '编程 Agent' },
            { key: 'relays', href: 'relays.html', text: '中转站' },
            { key: 'relay-detect', href: 'relay-detect.html', text: '中转站检测' },
            { key: 'monitor', href: 'monitor/index.html', text: '可用性监控' }
        ];
    const activeKey = options.activeKey || '';
    const settings = options.settings || {};

    function renderTab(tab) {
        const href = escapeHtml(tab.href || '#');
        const classes = ['page-tab'];
        if (tab.key === activeKey) {
            classes.push('active');
        }

        const idAttr = tab.id ? ` id="${escapeHtml(tab.id)}"` : '';
        const text = tab.text ? escapeHtml(tab.text) : '';
        return `<a href="${href}" class="${classes.join(' ')}"${idAttr}>${text}</a>`;
    }

    container.innerHTML = `
        <div class="page-nav-cluster">
            <nav class="page-nav" aria-label="站点导航">
            ${tabs.map(renderTab).join('')}
            </nav>
            ${renderSettingsControls(settings)}
        </div>
    `;
    return true;
}

// 超宽屏设置
(function () {
    function initUltraWideSettings() {
        const btn = document.getElementById('settingsBtn');
        const panel = document.getElementById('settingsPanel');
        const toggle = document.getElementById('ultraWideToggle');

        if (!btn || !panel || !toggle) {
            return;
        }

        function applyUltraWide(on) {
            document.body.classList.toggle('ultra-wide', on);
            toggle.checked = on;
            localStorage.setItem('ultraWide', on ? '1' : '0');
        }

        if (localStorage.getItem('ultraWide') === '1') {
            applyUltraWide(true);
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            panel.hidden = !panel.hidden;
            btn.classList.toggle('active', !panel.hidden);
        });

        toggle.addEventListener('change', function () {
            applyUltraWide(toggle.checked);
        });

        document.addEventListener('click', function (e) {
            if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
                panel.hidden = true;
                btn.classList.remove('active');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUltraWideSettings, { once: true });
        return;
    }

    initUltraWideSettings();
})();
