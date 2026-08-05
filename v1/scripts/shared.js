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

function renderPageNav(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) {
        return false;
    }

    const tabs = Array.isArray(options.tabs) && options.tabs.length
        ? options.tabs
        : [
            { key: 'index', href: 'index.html', text: 'Coding Plan' },
            { key: 'plan-usage', href: 'plan-usage.html', text: 'Coding Plan用量提交' },
            { key: 'coding-agents', href: 'coding-agents.html', text: '编程 Agent' },
            { key: 'relays', href: 'relays.html', text: '中转站' },
            { key: 'relay-detect', href: 'relay-detect.html', text: '中转站检测' }
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
            <a href="../index.html" class="page-tab page-tab-new-edition" id="gotoNewEditionLink">体验新版</a>
            </nav>
            <div class="settings-wrapper">
                <button class="settings-btn" id="settingsBtn" title="${escapeHtml(settings.buttonTitle || '设置')}" aria-label="${escapeHtml(settings.buttonAriaLabel || settings.buttonTitle || '设置')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
                <div class="settings-panel" id="settingsPanel" hidden>
                    <div class="settings-panel-title"${settings.panelTitleId ? ` id="${escapeHtml(settings.panelTitleId)}"` : ''}>${escapeHtml(settings.panelTitle || '')}</div>
                    <div class="settings-toggle-row settings-edition-row">
                        <span class="settings-edition-label">站点版本</span>
                        <div class="settings-edition-actions" role="group" aria-label="站点版本">
                            <button type="button" class="settings-edition-btn" id="siteEditionV2Btn" data-edition="v2">新版</button>
                            <button type="button" class="settings-edition-btn" id="siteEditionClassicBtn" data-edition="classic">旧版</button>
                        </div>
                    </div>
                    <div class="settings-toggle-row">
                        <label for="ultraWideToggle"${settings.ultraWideLabelId ? ` id="${escapeHtml(settings.ultraWideLabelId)}"` : ''}>${escapeHtml(settings.ultraWideLabel || '')}</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="ultraWideToggle">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof window.initUltraWideSettings === 'function') {
        window.initUltraWideSettings();
    }
    return true;
}

// 站点版本 + 超宽屏设置
(function () {
    const SITE_EDITION_KEY = 'codingplanSiteEdition';

    function getSiteEdition() {
        try {
            return localStorage.getItem(SITE_EDITION_KEY) === 'classic' ? 'classic' : 'v2';
        } catch (e) {
            return 'v2';
        }
    }

    function setSiteEdition(edition) {
        try {
            localStorage.setItem(SITE_EDITION_KEY, edition === 'classic' ? 'classic' : 'v2');
        } catch (e) {}
    }

    function resolveEditionHome(edition) {
        const path = (location.pathname || '').replace(/\\/g, '/');
        const inClassic = /\/v1(?:\/|$)/.test(path);
        if (edition === 'classic') {
            return inClassic ? 'index.html' : 'v1/index.html';
        }
        return inClassic ? '../index.html' : 'index.html';
    }

    function switchEdition(edition) {
        const next = edition === 'classic' ? 'classic' : 'v2';
        setSiteEdition(next);
        const path = (location.pathname || '').replace(/\\/g, '/');
        const inClassic = /\/v1(?:\/|$)/.test(path);
        if ((next === 'v2' && !inClassic) || (next === 'classic' && inClassic)) {
            const v2Btn = document.getElementById('siteEditionV2Btn');
            const classicBtn = document.getElementById('siteEditionClassicBtn');
            if (v2Btn && classicBtn) {
                v2Btn.classList.toggle('is-active', next === 'v2');
                classicBtn.classList.toggle('is-active', next === 'classic');
                v2Btn.setAttribute('aria-pressed', next === 'v2' ? 'true' : 'false');
                classicBtn.setAttribute('aria-pressed', next === 'classic' ? 'true' : 'false');
            }
            return;
        }
        location.assign(resolveEditionHome(next));
    }

    function syncEditionButtons() {
        const v2Btn = document.getElementById('siteEditionV2Btn');
        const classicBtn = document.getElementById('siteEditionClassicBtn');
        if (!v2Btn || !classicBtn) {
            return;
        }
        const current = getSiteEdition();
        v2Btn.classList.toggle('is-active', current === 'v2');
        classicBtn.classList.toggle('is-active', current === 'classic');
        v2Btn.setAttribute('aria-pressed', current === 'v2' ? 'true' : 'false');
        classicBtn.setAttribute('aria-pressed', current === 'classic' ? 'true' : 'false');
    }

    function initSiteEditionSettings() {
        syncEditionButtons();

        const gotoLink = document.getElementById('gotoNewEditionLink');
        if (gotoLink && gotoLink.dataset.editionBound !== '1') {
            gotoLink.dataset.editionBound = '1';
            gotoLink.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchEdition('v2');
            });
        }

        const v2Btn = document.getElementById('siteEditionV2Btn');
        const classicBtn = document.getElementById('siteEditionClassicBtn');
        if (!v2Btn || !classicBtn) {
            return;
        }
        if (v2Btn.dataset.editionBound === '1') {
            return;
        }
        v2Btn.dataset.editionBound = '1';

        v2Btn.addEventListener('click', function (e) {
            e.stopPropagation();
            switchEdition('v2');
        });
        classicBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            switchEdition('classic');
        });
    }

    function initUltraWideSettings() {
        const btn = document.getElementById('settingsBtn');
        const panel = document.getElementById('settingsPanel');
        const toggle = document.getElementById('ultraWideToggle');

        initSiteEditionSettings();

        if (!btn || !panel || !toggle) {
            return;
        }
        if (btn.dataset.ultraWideBound === '1') {
            return;
        }
        btn.dataset.ultraWideBound = '1';

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

    if (typeof window !== 'undefined') {
        window.initUltraWideSettings = initUltraWideSettings;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUltraWideSettings, { once: true });
        return;
    }

    initUltraWideSettings();
})();
