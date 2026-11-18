/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

// Shared by focused and full checks. Fullscreen access must not depend on a
// phone-sized viewport or a browser's classification of the pointing device.
export async function checkBrowserFullscreen({ consoleCode, page, until, screenshot }) {
    const ready = (condition, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${condition};})()`, label);
    const originallyPaused = await consoleCode('return c.simulation.paused;');
    await consoleCode('if(!c.simulation.paused)c.act("pause");');
    const before = await consoleCode('return c.simulation.snapshot();');
    const camera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];');
    const click = async () => {
        await waitForConsoleLayout(consoleCode, 'Fullscreen button');
        const point = await consoleCode(`const n=s.querySelector('[data-fullscreen-toggle]'),r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,width:r.width,height:r.height,disabled:n.disabled,covered:!n.contains(s.elementFromPoint(x,y)),viewport:[innerWidth,innerHeight],coarse:matchMedia('(any-pointer:coarse)').matches,supported:c.fullscreen.supported};`);
        assert.ok(point.width > 0 && point.height > 0 && !point.disabled && !point.covered,
            `Fullscreen control is visible and reachable: ${JSON.stringify(point)}`);
        assert.ok(point.x >= 0 && point.y >= 0 && point.x < point.viewport[0] && point.y < point.viewport[1], 'Fullscreen button fits the visible viewport');
        if (point.coarse) assert.ok(point.height >= 44, 'Tablet fullscreen control retains a full touch target');
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
    };
    assert.equal(await consoleCode('return document.fullscreenElement;'), null, 'The page does not enter fullscreen automatically');
    for (const [width, height, touch] of [[1440, 900, false], [1000, 800, false], [1280, 800, true]]) {
        await page('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
        await waitForConsoleLayout(consoleCode, `Fullscreen viewport ${width}×${height}`);
        assert.equal(await consoleCode('return c.fullscreen.supported;'), true, 'Chrome permits fullscreen on this origin');
        for (const theme of ['dark', 'light']) {
            await consoleCode(`c.setTheme('${theme}',false);`);
            await click();
            await ready('document.fullscreenElement===document.documentElement && !c.fullscreen.pending', 'A real Chrome click enters page fullscreen');
            assert.equal(await consoleCode('return s.querySelector("[data-fullscreen-toggle]").textContent;'), 'Exit full screen');
            await click();
            await ready('!document.fullscreenElement && !c.fullscreen.pending', 'The visible button exits fullscreen');
            assert.equal(await consoleCode('return s.querySelector("[data-fullscreen-toggle]").textContent;'), 'Full screen');
        }
        assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), before, 'Fullscreen never changes the plant or Pause');
        assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];'), camera, 'Fullscreen preserves the overview camera');
    }
    await page('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await consoleCode('c.setTheme("dark",false);');
    await waitForConsoleLayout(consoleCode, 'Fullscreen desktop restoration');
    await screenshot('chrome-fullscreen-control');
    if (!originallyPaused) await consoleCode('c.act("pause");');
}
