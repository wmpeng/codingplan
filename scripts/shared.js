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
