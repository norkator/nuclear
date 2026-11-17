/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { commissionPlant } from './plant-fixtures.mjs';
import { waitForConsoleLayout } from './console-layout.browser.mjs';
import { UI_SOUND_FILES } from '../src/simulation/nuclear-power-ui-sounds.js';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function checkPlantAudio(options) {
    const { consoleCode, action, page, advance, until, resetWithoutDispatch } = options;
    const tab = name => consoleCode(`s.querySelector('[data-plant-tab="${name}"]').click();`);
    const value = name => consoleCode(`return s.querySelector('[data-value="${name}"]').textContent;`);
    await consoleCode('c.setPlantTab("reactor");if(c.soundEnabled)c.act("sound");');
    await resetWithoutDispatch();
    await waitForConsoleLayout(consoleCode, 'Audio controls');
    await action('pumpA'); await action('pumpB'); await advance(6);
    const soundButton = await consoleCode(`const r=s.querySelector('[data-action="sound"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};`);
    await page('Input.dispatchMouseEvent', {type:'mousePressed',...soundButton,button:'left',clickCount:1});
    await page('Input.dispatchMouseEvent', {type:'mouseReleased',...soundButton,button:'left',clickCount:1});
    await consoleCode('return c.plantAudio.preloadUi();');
    await consoleCode('return c.plantAudio.preloadPlant();');
    await consoleCode('return c.plantAudio.preloadDiesels();');
    assert.equal(await consoleCode('return c.plantAudio.dieselState;'), 'ready');
    assert.equal(await consoleCode('return c.plantAudio.plantState;'), 'ready');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.plant).length;'), 0);
    assert.equal(await consoleCode('return c.plantAudio.uiBuffers.size;'), Object.keys(UI_SOUND_FILES).length);
    assert.equal(await consoleCode('return c.plantAudio.uiState;'), 'ready');
    assert.equal(await consoleCode('return c.plantAudio.uiGain;'), .26);
    await wait(400);
    assert.equal(await consoleCode('return c.alarmAudio.state;'), 'running');
    await checkControlSoundProfiles({ consoleCode, until });
    await tab('reactor');
    assert.ok(await consoleCode('return [...c.plantAudio.nodes].some(voice=>voice.ui);'));
    await wait(400);
    await action('start');
    await advance(10);
    await until(`document.querySelector('nuclear-power-console').plantAudio.nodes.size >= 2`, 'Operating loops did not start');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.plant && v.oscillator.loop).length;'), 2);
    // Inspect injected stages in the same turn, before the live simulation recalculates them.
    assert.ok(await consoleCode("c.simulation.condition.stage='STRAINED';c.update();return [...c.plantAudio.nodes].find(v=>v.plant==='fault').target > 0;"));
    assert.equal(await consoleCode("c.simulation.condition.stage='NORMAL';c.update();return [...c.plantAudio.nodes].find(v=>v.plant==='fault').target;"), 0);
    await tab('maintenance');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.plant||v.diesel).length;'), 0);
    await tab('reactor');
    await consoleCode('c.openDiesel("A");s.querySelector("[data-generator=A][data-generator-action=start]").click();');
    assert.equal(await consoleCode('return s.querySelector("[data-generator=A].diesel-run-switch").getAttribute("aria-checked");'), 'true');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="A")?.kind;'), 'startup');
    await advance(8);
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="A")?.kind;'), 'running-loop');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="A")?.target;'), .035);
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.plant).length;'), 2);
    await tab('maintenance');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.plant||v.diesel).length;'), 0);
    await tab('reactor');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="A")?.kind;'), 'running-loop');
    await consoleCode('c.openDiesel("B");');
    await consoleCode('s.querySelector("[data-generator=B][data-generator-action=start]").click();');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="B")?.kind;'), 'startup');
    await action('pause');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await action('pause');
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.diesel).length===2`, 'Diesels did not resume');
    await consoleCode("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));");
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await consoleCode("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));c.update();");
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.diesel).length===2`, 'Visible diesels did not resume');
    assert.equal(await consoleCode('const parent=c.parentElement;c.remove();const count=c.plantAudio.nodes.size;parent.append(c);return count;'), 0);
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.diesel).length===2`, 'Reattached diesels did not resume');
    await action('sound');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await action('sound');
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.diesel).length===2`, 'Unmuted diesels did not resume');
    await advance(8);
    await consoleCode('s.querySelector("[data-generator=A][data-generator-action=stop]").click();');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="A")?.kind;'), 'shutdown');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].find(v=>v.diesel==="B")?.kind;'), 'running-loop');
    await consoleCode('s.querySelector("[data-generator=B][data-generator-action=stop]").click();');
    await tab('maintenance');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.diesel || v.plant).length;'), 0);
    await tab('reactor');
    assert.equal(await consoleCode('return [...c.plantAudio.nodes].filter(v=>v.diesel).length;'), 0, 'No old shutdown on tab return');
    await tab('reactor');
    await consoleCode('c.intersecting=false;c.updateActivity();c.update();');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await consoleCode('c.intersecting=true;c.updateActivity();c.update();');
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.plant).length===2`, 'Operating loops did not resume');
    await consoleCode("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));");
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await consoleCode("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));c.update();");
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.plant).length===2`, 'Visible plant did not resume audio');
    assert.equal(await consoleCode('const parent=c.parentElement;c.remove();const count=c.plantAudio.nodes.size;parent.append(c);return count;'), 0);
    await until(`[...document.querySelector('nuclear-power-console').plantAudio.nodes].filter(v=>v.plant).length===2`, 'Reattached plant did not resume audio');
    await action('pause');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await action('pause');
    await action('stop');
    assert.ok(await consoleCode("s.querySelector('[data-action=pumpA]').click();return [...c.plantAudio.nodes].some(voice=>voice.ui && voice.oscillator.loop===false && voice.oscillator.buffer===c.plantAudio.uiBuffers.get('off'));"));
    assert.equal(await consoleCode('return s.querySelector("[data-action=pumpA]").getAttribute("aria-checked");'), 'false');
    assert.equal(await value('pumpA'), 'COASTING');
    assert.equal(await consoleCode('return s.querySelector("[data-pump-card=A]").dataset.lamp;'), 'running', 'Rocker OFF must not pretend the motor has already stopped');
    await action('sound');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await checkStationAudio(options);
}

async function checkControlSoundProfiles({ consoleCode, until }) {
    const throttleReady = () => until(`(()=>{const c=document.querySelector('nuclear-power-console');return c.alarmAudio.currentTime-c.plantAudio.lastUiAt>=.08;})()`, 'Previous control click throttle expired');
    const check = async (code, profile, sample) => {
        await throttleReady();
        const voice = await consoleCode(`${code}const voice=[...c.plantAudio.nodes].find(v=>v.ui);return {profile:voice?.profile,sample:voice?.sample,loop:voice?.oscillator.loop};`);
        assert.deepEqual(voice, { profile, sample, loop: false }, `${profile} control uses its own one-shot`);
    };
    for (const [id, select, step, original] of [
        ['pumpA', '[data-pump-select=dischargeValve]', '[data-pump-step="-5"]', ['dischargeValve', 100]],
        ['exchanger', '[data-hx-select=bypass]', '[data-hx-step="5"]', ['bypass', 0]],
        ['turbine', '[data-generation-select=generatorLoading]', '[data-generation-step="-5"]', ['generatorLoading', 100]],
        ['condenser', '[data-generation-select=coolingValve]', '[data-generation-step="-5"]', ['coolingValve', 100]],
    ]) {
        await consoleCode(`c.inspect('${id}');s.querySelector('[data-component-dialog="${id}"] ${select}').click();`);
        await check(`s.querySelector('[data-component-dialog="${id}"] ${step}').click();`, id === 'pumpA' ? 'pumps' : id,
            { pumpA: 'adjust', exchanger: 'pluck_001', turbine: 'click_001', condenser: 'tick_004' }[id]);
        await consoleCode(`c.simulation.setComponentSetting('${id}',${JSON.stringify(original[0])},${original[1]});c.closeFloatingDialog(s.querySelector('[data-component-dialog="${id}"]'));`);
    }
    await consoleCode('c.openCoreMap();');
    await check('const select=s.querySelector("#rod-select");select.value="CR-02";select.dispatchEvent(new Event("change",{bubbles:true}));', 'core', 'tick_001');
    await consoleCode('c.closeCoreMap();c.openDiesel("A");');
    const standby = await consoleCode('return c.simulation.supply.generators[0].automatic;');
    if (standby) await consoleCode('s.querySelector("[data-diesel-auto=A]").click();');
    await check('s.querySelector("[data-diesel-auto=A]").click();', 'electrical', 'switch_001');
    await check('s.querySelector("[data-diesel-auto=A]").click();', 'electrical', 'switch_002');
    if (standby) await consoleCode('s.querySelector("[data-diesel-auto=A]").click();');
    await consoleCode('c.closeFloatingDialog(s.querySelector("[data-diesel-dialog=A]"));c.computerConsole.open("serverA");');
    await check('s.querySelector("[data-computer-diagnose]").click();', 'computers', 'click_002');
    await consoleCode('c.closeFloatingDialog(s.querySelector(".computer-dialog"));');
    await throttleReady();
}

async function checkStationAudio({ consoleCode, action, page, advance, until, resetWithoutDispatch, warmOperatingPoint, send }) {
    const ready = (condition, message) => until(`(()=>{const c=document.querySelector('nuclear-power-console'),s=c?.shadowRoot;return ${condition};})()`, message);
    const tab = name => consoleCode(`s.querySelector('#${name}-tab').click();`);
    const station = scene => ready(`c.plantAudio?.nodes.size && [...c.plantAudio.nodes].some(v=>v.station==='${scene}')`, `${scene} ambience follows actual operation`);
    const silent = () => consoleCode('return [...c.plantAudio.nodes].filter(v=>!v.ui).length;');
    const voices = () => consoleCode('return [...c.plantAudio.nodes].filter(v=>v.station).map(v=>({scene:v.station,equipment:v.equipment,target:v.target,rate:v.rate,cutoff:v.cutoff,frames:v.oscillator.buffer.length,sampleRate:v.oscillator.buffer.sampleRate,channels:v.oscillator.buffer.numberOfChannels}));');
    await resetWithoutDispatch();
    assert.equal(await consoleCode('return c.soundEnabled;'), false);
    assert.equal(await consoleCode('return c.plantAudio.stationBuffers.size;'), 0, 'No room assets were fetched before opt-in/visiting');
    await tab('computers'); await waitForConsoleLayout(consoleCode, 'Server-room sound viewport');
    const point = await consoleCode('const r=s.querySelector("[data-action=sound]").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};');
    await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await station('computers');
    assert.equal(await consoleCode('return c.simulation.running;'), false, 'A powered rack has its own ambience in a cold plant');
    assert.deepEqual(await consoleCode('return [...c.plantAudio.stationBuffers.keys()];'), ['computers'], 'Only the visited room downloads');
    const serverVoice = (await voices())[0];
    // Decoding the 48 kHz WAV at the context's sample rate can round down one frame.
    assert.ok(Math.abs(serverVoice.frames - 8 * serverVoice.sampleRate) <= 1,
        `Expected eight seconds within one decoded frame, got ${serverVoice.frames} frames at ${serverVoice.sampleRate} Hz`);
    assert.equal(serverVoice.channels, 2);
    assert.ok(serverVoice.target > 0 && serverVoice.target <= .08);
    await consoleCode('c.stopAlarmSound(false);c.simulation.trip();c.update();');
    assert.ok(await consoleCode('return c.alarmNodes.length>0;'), 'An actual ESD sounds an alert');
    const unacknowledged = await consoleCode('return c.simulation.alarms.filter(a=>!a.acknowledged).length;');
    await consoleCode('s.querySelector("#mute-alert-sounds").click();');
    assert.equal(await consoleCode('return c.alarmNodes.length;'), 0, 'Alert mute stops the current alert immediately');
    assert.ok(await consoleCode('return c.soundEnabled && [...c.plantAudio.nodes].some(v=>v.station==="computers");'), 'Server ambience stays audible with alerts muted');
    assert.equal(await consoleCode('return c.simulation.alarms.filter(a=>!a.acknowledged).length;'), unacknowledged, 'Muting never acknowledges alarms');
    assert.equal(await consoleCode('return c.simulation.tripped;'), true);
    await consoleCode('s.querySelector("#mute-alert-sounds").click();');
    assert.ok(await consoleCode('return c.alarmNodes.length>0;'), 'Unmuting resumes pending alerts');
    await consoleCode('for(const id of Object.keys(c.simulation.computers.units))c.simulation.setComputerEnabled(id,false);');
    await advance(12);
    assert.equal(await silent(), 0, 'Stopped rack fans/electronics are silent');
    await consoleCode('c.simulation.setComputerEnabled("rackCooling",true);c.simulation.setComputerEnabled("serverA",true);');
    await advance(8); await station('computers');
    await tab('maintenance'); assert.equal(await silent(), 0, 'Maintenance has no machinery ambience');
    await tab('pumps');
    await consoleCode('s.querySelector("[data-station-pump=pumpA]").click();');
    await ready('c.plantAudio.stationStates.get("pumps")==="ready"', 'Pump loop loaded');
    assert.equal(await silent(), 0, 'Speed targets cannot make a stopped pump audible');
    await action('pumpA'); await advance(8); await station('pumps');
    assert.equal((await voices())[0].equipment, 'pumpA');
    await action('pumpA');
    await consoleCode('s.querySelector("[data-station-pump=pumpA2]").click();');
    assert.equal(await silent(), 0, 'An OFF backup does not use the other pump sound');
    await action('pumpA2'); await advance(8); await station('pumps');
    assert.equal((await voices())[0].equipment, 'pumpA2');
    await tab('reactor'); await resetWithoutDispatch(); await warmOperatingPoint(); await advance(12);
    for (const scene of ['exchanger', 'turbine', 'condenser']) {
        await tab(scene); await station(scene);
        const current = await voices(); assert.equal(current.length, 1); assert.equal(current[0].scene, scene);
        assert.ok(current[0].target > 0 && current[0].target <= .08);
        assert.ok(await consoleCode('return [...c.plantAudio.nodes].every(v=>!v.plant&&!v.diesel);'), 'Equipment rooms do not layer the reactor/diesels behind them');
    }
    await tab('turbine'); await action('stop');
    assert.ok(await consoleCode('return c.simulation.components.items.turbine.actual.shaftSpeed>0 && [...c.plantAudio.nodes].some(v=>v.station==="turbine");'), 'Actual shaft coast-down remains audible after Stop');
    await tab('computers'); await station('computers');
    await action('pause'); assert.equal(await silent(), 0); await action('pause'); await station('computers');
    await action('reset');
    assert.equal(await silent(), 0, 'Reset switches all rack hardware OFF');
    await consoleCode(`(${commissionPlant.toString()})(c.simulation);c.update();`);
    await station('computers');
    await action('sound'); assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await action('sound'); await station('computers');
    // Real viewport intersection: whole console stays visible while its rack is offscreen.
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitForConsoleLayout(consoleCode, 'Audio mobile shell before scrolling');
    await consoleCode('s.querySelector(".console-footer").scrollIntoView({block:"end"});');
    await ready('!c.computerConsole.visible && c.intersecting', 'Rack actually outside the viewport');
    assert.equal(await silent(), 0, 'Offscreen room ambience stops without changing plant time');
    await consoleCode('s.querySelector(".computer-rack-viewport").scrollIntoView({block:"center"});');
    await ready('c.computerConsole.visible', 'Rack actually visible again'); await station('computers');
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await waitForConsoleLayout(consoleCode, 'Audio desktop shell restored');
    await consoleCode('window.scrollTo(0,0);');
    await station('computers');
    await consoleCode('const parent=c.parentElement;c.remove();window.detachedAudioVoices=c.plantAudio.nodes.size;parent.append(c);');
    assert.equal(await consoleCode('return window.detachedAudioVoices;'), 0); await station('computers');
    // Bring a real second tab to the foreground instead of assigning visibility flags.
    const other = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: other.targetId, flatten: true });
    try {
        await send('Page.bringToFront', {}, attached.sessionId);
        await ready('document.hidden', 'Sound tab actually backgrounded');
        assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    } finally { await send('Target.closeTarget', { targetId: other.targetId }); await page('Page.bringToFront'); }
    await ready('!document.hidden', 'Sound tab foregrounded again'); await station('computers');
    await tab('reactor'); await resetWithoutDispatch();
    assert.equal(await silent(), 0, 'Reset returns stopped plant machinery to silence');
    await action('sound'); assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0);
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await waitForConsoleLayout(consoleCode, 'Overview restored after audio checks');
}
