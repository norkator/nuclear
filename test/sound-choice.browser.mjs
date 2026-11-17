/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

export async function checkSoundChoice({ consoleCode, page, until, screenshot }) {
    const ready = (condition, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');return ${condition};})()`, label);
    for (const [width, height, touch] of [[844, 390, true], [1440, 1120, false]]) {
        await page('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
        for (const choice of ['no', 'yes']) {
            const generation = await consoleCode('return performance.timeOrigin;');
            await page('Page.reload');
            await ready(`performance.timeOrigin!==${generation} && c?.initialized && c.soundChoice?.dialog.open`, 'Initial sound question appears');
            const rect = await consoleCode('const r=c.soundChoice.dialog.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};');
            assert.ok(rect.x>=0 && rect.y>=0 && rect.right<=width && rect.bottom<=height, `Sound question fits ${width}: ${JSON.stringify(rect)}`);
            assert.equal(await consoleCode('return c.simulation.paused;'), false, 'The sound question never changes Pause');
            if (choice === 'no') await screenshot(`sound-choice-${touch ? 'phone' : 'desktop'}`);
            const point = await consoleCode(`const r=s.querySelector('[data-sound-choice="${choice}"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};`);
            if (touch) {
                await page('Input.dispatchTouchEvent', { type:'touchStart',touchPoints:[point] });
                await consoleCode('return new Promise(requestAnimationFrame);');
                await page('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
            } else {
                await page('Input.dispatchMouseEvent', { type:'mousePressed',...point,button:'left',clickCount:1 });
                await page('Input.dispatchMouseEvent', { type:'mouseReleased',...point,button:'left',clickCount:1 });
            }
            await ready('!c.soundChoice.dialog.open', 'Sound choice closes its dialog');
            assert.equal(await consoleCode('return !!c.soundEnabled;'), choice === 'yes');
            if (choice === 'yes') {
                await ready('c.alarmAudio?.state==="running" && c.plantAudio?.uiState==="ready"', 'Yes unlocks and loads sound from the user gesture');
                await consoleCode('c.act("sound");');
            } else assert.equal(await consoleCode('return !!c.alarmAudio;'), false, 'No creates no audio context');
            await consoleCode('c.act("reset");');
            assert.equal(await consoleCode('return c.soundChoice.dialog.open;'), false, 'Reset does not repeat the initial question');
        }
    }
    // Leave subsequent shared scenarios on a fresh, never-enabled console.
    const generation = await consoleCode('return performance.timeOrigin;');
    await page('Page.reload');
    await ready(`performance.timeOrigin!==${generation} && c?.soundChoice?.dialog.open`, 'Fresh console offers the initial choice');
    const point = await consoleCode('const r=s.querySelector("[data-sound-choice=no]").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};');
    await page('Input.dispatchMouseEvent', { type:'mousePressed',...point,button:'left',clickCount:1 });
    await page('Input.dispatchMouseEvent', { type:'mouseReleased',...point,button:'left',clickCount:1 });
    await ready('!c.soundChoice.dialog.open', 'Fresh console remains muted');
    assert.equal(await consoleCode('return !!c.alarmAudio;'), false);
}
