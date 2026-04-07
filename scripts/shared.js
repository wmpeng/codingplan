/* ── 公共工具函数，index.html 和 tools.html 共用 ── */

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// 超宽屏设置
(function () {
    const btn = document.getElementById('settingsBtn');
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('ultraWideToggle');

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
})();
