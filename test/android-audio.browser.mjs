/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

// Chromium models the native bootstrap and WebView's gesture-free media policy.
// Real Android playback is covered by NuclearMobile's WebViewSmokeTest.
export async function checkAndroidAudio({ consoleCode, page, until, screenshot }) {
    const ready = (condition, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${condition};})()`, label);
    const click = async selector => {
        await consoleCode(`s.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});`);
        await waitForConsoleLayout(consoleCode, `Android audio control ${selector}`);
        const point = await consoleCode(`const n=s.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:r.width,height:r.height,covered:!n.contains(s.elementFromPoint(x,y)),disabled:n.disabled,inert:!!n.closest('[inert]')};`);
        assert.ok(point.width>0 && point.height>0 && !point.covered && !point.disabled && !point.inert, `Audio control reachable: ${JSON.stringify(point)}`);
        await page('Input.dispatchMouseEvent', {type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
        await page('Input.dispatchMouseEvent', {type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    };
    await ready('c.soundChoice?.asked && c.soundEnabled && c.alarmAudio?.state==="running" && c.plantAudio?.uiState==="ready"', 'Native audio starts and loads before any gesture');
    assert.equal(await consoleCode('return navigator.userActivation.hasBeenActive;'), false, 'Automatic audio needs no prior page interaction');
    assert.equal(await consoleCode('return c.soundChoice.dialog.open;'), false, 'Android skips the sound-choice dialog');
    assert.equal(await consoleCode('return c.simulation.paused;'), false, 'Automatic audio never changes Pause');
    assert.equal(await consoleCode('return s.querySelector("[data-action=sound]").textContent;'), 'Mute plant sounds');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0, 'A cold stopped plant remains quiet');
    await consoleCode('window.nativeAudioContext=c.alarmAudio;');
    await screenshot('android-audio-default');

    await click('[data-action="sound"]');
    await ready('!c.soundEnabled && c.alarmAudio.state==="suspended" && c.plantAudio.nodes.size===0', 'Mute remains available and suspends audio');
    await consoleCode('c.act("reset");');
    assert.equal(await consoleCode('return c.soundEnabled || c.soundChoice.dialog.open;'), false, 'Reset preserves mute without asking again');
    await page('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:false});
    await waitForConsoleLayout(consoleCode, 'Native audio compact layout');
    assert.equal(await consoleCode('return c.soundEnabled || c.soundChoice.dialog.open;'), false, 'Resizing preserves mute');
    await consoleCode('const parent=c.parentElement;c.remove();parent.append(c);');
    await ready('c.isConnected && !!c.overviewScene && c.soundChoice.asked', 'Retained Android console reconnects');
    assert.equal(await consoleCode('return c.soundEnabled || c.soundChoice.dialog.open;'), false, 'Reconnect preserves mute');
    assert.equal(await consoleCode('return c.alarmAudio===window.nativeAudioContext;'), true, 'Reconnect retains a single audio context');

    await click('[data-mobile-open="more"]');
    await click('[data-action="sound"]');
    await ready('c.soundEnabled && c.alarmAudio.state==="running"', 'The existing sound control can unmute');
    await consoleCode('c.mobileLayout.close();c.act("pause");');
    await ready('c.simulation.paused && c.alarmAudio.state==="suspended"', 'Pause suspends automatically enabled audio');
    await consoleCode('c.act("pause");');
    await ready('!c.simulation.paused && c.alarmAudio.state==="running"', 'Resume restores the chosen audio state');
    await consoleCode('c.style.display="none";');
    await ready('!c.timer && c.alarmAudio.state==="suspended" && c.plantAudio.nodes.size===0', 'Hidden Android console releases all audio voices');
    await consoleCode('c.style.display="";');
    await ready('!!c.timer && c.alarmAudio.state==="running"', 'Visible Android console resumes audio');
    assert.equal(await consoleCode('return c.alarmAudio===window.nativeAudioContext && !c.soundChoice.dialog.open;'), true, 'Visibility changes neither recreate audio nor ask again');
    await consoleCode('c.act("sound");');
}
