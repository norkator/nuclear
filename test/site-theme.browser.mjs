/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { pages } from '../site/pages.mjs';

export async function checkSiteThemes({ evaluate, page, until, screenshot, baseUrl }) {
    const navigate = async path => {
        await page('Page.navigate', { url: new URL(path, baseUrl).href });
        await until(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!document.querySelector('[data-site-theme-toggle]') && !document.querySelector('.site-theme-toggle').hidden`, 'Search page theme switch did not become ready');
    };
    const toggle = async () => {
        await evaluate(`document.querySelector('[data-site-theme-toggle]').focus()`);
        await page('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        await page('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    };
    const assertTheme = async theme => {
        assert.deepEqual(await evaluate(`({
            theme: document.documentElement.dataset.siteTheme,
            checked: document.querySelector('[data-site-theme-toggle]').checked,
            scheme: getComputedStyle(document.documentElement).colorScheme,
            background: getComputedStyle(document.documentElement).backgroundColor,
            chrome: document.querySelector('meta[name="theme-color"]').content
        })`), {
            theme, checked: theme === 'light', scheme: theme,
            background: theme === 'light' ? 'rgb(241, 245, 247)' : 'rgb(16, 25, 35)',
            chrome: theme === 'light' ? '#f1f5f7' : '#101923',
        });
    };

    await navigate('/');
    await assertTheme('dark');
    for (const entry of pages) {
        await navigate(entry.path);
        if (entry.path !== '/') await assertTheme('light');
        if (await evaluate(`document.querySelector('[data-site-theme-toggle]').checked`)) await toggle();
        for (const theme of ['dark', 'light']) {
            if (theme === 'light') await toggle();
            await assertTheme(theme);
            assert.equal(await evaluate(`localStorage.getItem('porssiohjain.nuclear-power.theme')`), theme === 'light' ? 'light' : (entry.path === '/' ? null : 'dark'));
            assert.equal(await evaluate(`!!customElements.get('nuclear-power-console')`), false, 'Search pages must not load the simulator');
            for (const width of [1440, 390]) {
                await page('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 1120, deviceScaleFactor: 1, mobile: width === 390 });
                await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
                const layout = await evaluate(`(() => {
                    const control = document.querySelector('.site-theme-toggle');
                    const r = control.getBoundingClientRect();
                    const sibling = control.previousElementSibling.getBoundingClientRect();
                    const styles = getComputedStyle(document.documentElement);
                    const luminance = color => {
                        const rgb = color.match(/[\\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
                        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
                    };
                    const background = luminance(styles.backgroundColor);
                    const contrast = color => { const foreground = luminance(color); return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05); };
                    const probe = document.createElement('span');
                    probe.style.color = 'var(--site-muted)';document.body.append(probe);
                    const mutedContrast = contrast(getComputedStyle(probe).color);probe.remove();
                    return {
                        fits: document.documentElement.scrollWidth <= innerWidth && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
                        overlaps: r.left < sibling.right && r.right > sibling.left && r.top < sibling.bottom && r.bottom > sibling.top,
                        targetHeight: r.height, textContrast: contrast(styles.color), mutedContrast,
                        card: document.querySelector('.launcher-card') ? getComputedStyle(document.querySelector('.launcher-card')).backgroundImage : null
                    };
                })()`);
                assert.ok(layout.fits, `${entry.path} ${theme} ${width}: page and switch fit the viewport`);
                assert.equal(layout.overlaps, false, 'Theme switch must not overlap branding or breadcrumbs');
                assert.ok(layout.targetHeight >= 44, 'Theme label remains a usable touch target');
                assert.ok(layout.textContrast >= 4.5 && layout.mutedContrast >= 4.5, 'Body and secondary text remain readable');
                if (entry.path === '/') {
                    assert.ok(layout.card.includes(theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(27, 48, 58)'), 'Launcher cards follow the theme');
                    if (theme === 'light') await screenshot(`landing-light-${width}`);
                }
                if (entry.path === '/guides/startup/' && theme === 'light' && width === 390) await screenshot('startup-guide-light-mobile');
            }
        }
        await page('Page.reload');
        await until(`document.readyState === 'complete' && document.documentElement.dataset.siteTheme === 'light' && document.querySelector('[data-site-theme-toggle]')?.checked`, 'Light theme did not survive reload');
    }

    // The console reads the same preference, and its choice is restored on Back.
    await navigate('/');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    const history = await page('Page.getNavigationHistory');
    const landingEntry = history.entries[history.currentIndex].id;
    await page('Page.navigate', { url: new URL('/reactor/', baseUrl).href });
    await until(`document.querySelector('nuclear-power-console')?.dataset.theme === 'light'`, 'Simulator did not inherit the landing page theme');
    await evaluate(`document.querySelector('nuclear-power-console').shadowRoot.querySelector('[data-sound-choice="no"]')?.click()`);
    await evaluate(`document.querySelector('nuclear-power-console').shadowRoot.querySelector('#light-theme').click()`);
    await page('Page.navigateToHistoryEntry', { entryId: landingEntry });
    await until(`location.pathname === '/' && document.documentElement.dataset.siteTheme === 'dark' && !!document.querySelector('[data-site-theme-toggle]') && !document.querySelector('.site-theme-toggle').hidden`, 'Returning from the simulator did not restore its theme choice');
    await assertTheme('dark');

    const blocked = await page('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });` });
    try {
        await navigate('/guides/startup/');
        await assertTheme('dark');
        await toggle();
        await assertTheme('light');
        await toggle();
        await assertTheme('dark');
    } finally {
        await page('Page.removeScriptToEvaluateOnNewDocument', { identifier: blocked.identifier });
    }
    await navigate('/');
    await evaluate(`localStorage.removeItem('porssiohjain.nuclear-power.theme')`);
}
