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
    const visibleCount = Number.isFinite(options.visibleCount) ? Math.max(0, options.visibleCount) : 3;
    const renderDate = typeof options.renderDate === 'function'
        ? options.renderDate
        : (value) => escapeHtml(value);
    const renderItem = typeof options.renderItem === 'function'
        ? options.renderItem
        : (value) => escapeHtml(value);

    const hiddenCount = Math.max(0, updates.length - visibleCount);
    const hasMore = hiddenCount > 0;

    container.hidden = false;
    container.innerHTML = `
        <${titleTag}${titleClass}>${title}</${titleTag}>
        <ul${listClass}>
            ${updates.map((update, updateIndex) => {
                const collapsed = updateIndex >= visibleCount;
                const collapsedClass = collapsed ? ' is-collapsed' : '';
                const hiddenAttr = collapsed ? ' hidden' : '';
                return `
                <li class="update-item${collapsedClass}"${hiddenAttr}>
                    <div class="log-date">${renderDate(update && update.date, update, updateIndex)}</div>
                    <ul class="update-items">
                        ${((update && Array.isArray(update.items)) ? update.items : []).map((item, itemIndex) => `<li>${renderItem(item, itemIndex, update, updateIndex)}</li>`).join('')}
                    </ul>
                </li>`;
            }).join('')}
        </ul>
        ${hasMore
            ? `<button type="button" class="updates-toggle" aria-expanded="false">展开更多（${hiddenCount}）</button>`
            : ''}
    `;

    if (hasMore) {
        const toggle = container.querySelector('.updates-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                const nextExpanded = !expanded;
                container.querySelectorAll('.update-item.is-collapsed').forEach(function (el) {
                    el.hidden = !nextExpanded;
                });
                toggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
                toggle.textContent = nextExpanded ? '收起' : `展开更多（${hiddenCount}）`;
            });
        }
    }
    return true;
}

function renderSettingsControls(settings = {}) {
    const buttonLabel = settings.buttonLabel || settings.label || '';
    const labelHtml = buttonLabel
        ? `<span class="settings-btn-label">${escapeHtml(buttonLabel)}</span>`
        : '';
    return `
            <div class="settings-wrapper">
                <button class="settings-btn" id="settingsBtn" title="${escapeHtml(settings.buttonTitle || buttonLabel || '设置')}" aria-label="${escapeHtml(settings.buttonAriaLabel || settings.buttonTitle || buttonLabel || '设置')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    ${labelHtml}
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
            { key: 'platforms', href: 'index.html?view=platforms', text: '平台对比' },
            { key: 'plans', href: 'index.html?view=plans', text: '套餐对比' },
            { key: 'monitor', href: 'index.html?view=monitor', text: '可用性监控' },
            { key: 'payg', href: 'index.html?view=payg', text: '按量计费价格' }
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

    function initSiteEditionSettings() {
        const v2Btn = document.getElementById('siteEditionV2Btn');
        const classicBtn = document.getElementById('siteEditionClassicBtn');
        if (!v2Btn || !classicBtn) {
            return false;
        }
        if (v2Btn.dataset.editionBound === '1') {
            return true;
        }
        v2Btn.dataset.editionBound = '1';

        const current = getSiteEdition();
        v2Btn.classList.toggle('is-active', current === 'v2');
        classicBtn.classList.toggle('is-active', current === 'classic');
        v2Btn.setAttribute('aria-pressed', current === 'v2' ? 'true' : 'false');
        classicBtn.setAttribute('aria-pressed', current === 'classic' ? 'true' : 'false');

        function switchEdition(edition) {
            const next = edition === 'classic' ? 'classic' : 'v2';
            setSiteEdition(next);
            const path = (location.pathname || '').replace(/\\/g, '/');
            const inClassic = /\/v1(?:\/|$)/.test(path);
            if ((next === 'v2' && !inClassic) || (next === 'classic' && inClassic)) {
                v2Btn.classList.toggle('is-active', next === 'v2');
                classicBtn.classList.toggle('is-active', next === 'classic');
                v2Btn.setAttribute('aria-pressed', next === 'v2' ? 'true' : 'false');
                classicBtn.setAttribute('aria-pressed', next === 'classic' ? 'true' : 'false');
                return true;
            }
            location.assign(resolveEditionHome(next));
            return true;
        }

        v2Btn.addEventListener('click', function (e) {
            e.stopPropagation();
            switchEdition('v2');
        });
        classicBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            switchEdition('classic');
        });
        return true;
    }

    function initUltraWideSettings() {
        const btn = document.getElementById('settingsBtn');
        const panel = document.getElementById('settingsPanel');
        const toggle = document.getElementById('ultraWideToggle');

        initSiteEditionSettings();

        if (!btn || !panel || !toggle) {
            return false;
        }
        if (btn.dataset.ultraWideBound === '1') {
            return true;
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
            if (!panel.hidden && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                panel.hidden = true;
                btn.classList.remove('active');
            }
        });
        return true;
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
