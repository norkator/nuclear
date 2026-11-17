/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
(() => {
    const key = 'porssiohjain.nuclear-power.theme';
    const root = document.documentElement;
    const readTheme = () => {
        try { return localStorage.getItem(key) === 'light' ? 'light' : 'dark'; }
        catch { return root.dataset.siteTheme || 'dark'; }
    };
    const applyTheme = theme => {
        root.dataset.siteTheme = theme === 'light' ? 'light' : 'dark';
        document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f1f5f7' : '#101923';
        const toggle = document.querySelector('[data-site-theme-toggle]');
        if (toggle) toggle.checked = theme === 'light';
    };

    // Apply the saved palette in the head, before the stylesheet and page content.
    applyTheme(readTheme());
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.querySelector('[data-site-theme-toggle]');
        toggle.checked = root.dataset.siteTheme === 'light';
        toggle.closest('.site-theme-toggle').hidden = false;
        toggle.addEventListener('change', () => {
            const theme = toggle.checked ? 'light' : 'dark';
            applyTheme(theme);
            try { localStorage.setItem(key, theme); } catch { /* Theme works without storage. */ }
        });
    }, { once: true });
    // Restore the preference when returning from a console through browser Back.
    window.addEventListener('pageshow', () => applyTheme(readTheme()));
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) applyTheme(readTheme());
    });
})();
