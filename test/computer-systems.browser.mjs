/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { commissionPlant } from './plant-fixtures.mjs';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

export async function checkComputerSystems({ consoleCode, action, input, page, until, screenshot }) {
    const ready = (expression, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${expression};})()`, label);
    const tab = name => consoleCode(`s.querySelector('[data-plant-tab="${name}"]').click();`);
    const click = selector => consoleCode(`s.querySelector(${JSON.stringify(selector)}).click();`);
    const advance = seconds => consoleCode(`for(let i=0;i<${seconds * 4};i++)c.simulation.tick(.25);c.update();`);
    const open = id => click(`.computer-unit-list [data-computer-open="${id}"]`);
    assert.equal(await consoleCode('return !!c.computerConsole.scene;'), false, 'Rack renderer is lazy');
    await ready('c.overviewScene?.width>0', 'Overview ready before independent camera check');
    await checkColdRack({ consoleCode, action, tab, click, advance });
    await checkComputerSwitchSounds({ consoleCode, action, page, ready, tab, click, advance });
    const mainCamera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom];');
    await tab('maintenance');
    await consoleCode('s.querySelector("#maintenance-tab").focus();s.querySelector("#maintenance-tab").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));s.querySelector("#electrical-tab").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));');
    assert.equal(await consoleCode('return c.plantTab;'), 'computers');
    assert.equal(await consoleCode('return s.activeElement.id;'), 'computers-tab');
    assert.equal(await consoleCode('return s.querySelector("[data-computer-view], .computer-rack-diagram");'), null, 'Rack has only the 3D presentation');
    await ready('c.computerConsole.scene?.width>0 && c.computerConsole.visible', '3D rack sized and visible');
    assert.ok(await consoleCode('return c.computerConsole.scene.renderer.info.render.calls>0;'), 'Real rack meshes rendered');
    for (const id of ['serverA', 'serverB', 'instrumentServer', 'rackSwitch', 'rackUps']) {
        const lamps = await consoleCode(`return c.computerConsole.scene.units.get('${id}').activity.map(lamp=>lamp.emissiveIntensity);`);
        await ready(`JSON.stringify(c.computerConsole.scene.units.get('${id}').activity.map(lamp=>lamp.emissiveIntensity))!==${JSON.stringify(JSON.stringify(lamps))}`, `${id} activity lights blink on the shared frame clock`);
    }
    await open('instrumentServer');
    assert.equal(await consoleCode('return s.querySelector("[data-computer-prefer]").hidden;'), true, 'Instrument server has no process-duty control');
    await click('[data-computer-close]');
    // Rack activity continues with fans stopped, without its own animation timer.
    await click('[data-computer-power=rackCooling]'); await advance(12);
    const lightTime = await consoleCode('return c.computerConsole.activityTime;');
    await ready(`c.computerConsole.activityTime>${lightTime}`, 'Activity lights animate with stopped rack fans');
    await click('[data-computer-power=rackCooling]');
    await waitForConsoleLayout(consoleCode, 'Rack drag geometry');
    const rackPose = () => consoleCode('const view=c.computerConsole.scene,point=view.units.get("serverA").group.position.clone();point.z=1.04;point.project(view.camera);return {x:point.x,y:point.y,pitch:view.pitch};');
    for (const [dx, dy] of [[80, 0], [-80, 0], [0, 40]]) {
        await click('[data-computer-camera=home]');
        const before = await rackPose();
        const start = await consoleCode('const r=s.querySelector(".computer-rack-canvas").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};');
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + dx, y: start.y + dy, button: 'left', buttons: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: start.x + dx, y: start.y + dy, button: 'left', clickCount: 1 });
        const after = await rackPose();
        if (dx) assert.ok((after.x - before.x) * dx > 0, 'Rack front follows horizontal mouse drag, matching the plant view');
        else assert.ok(after.pitch > before.pitch && after.y < before.y, 'Vertical drag keeps its existing direction');
        assert.equal(await consoleCode('return s.querySelector(".computer-dialog").matches(":popover-open");'), false, 'Orbit drags do not inspect equipment');
    }
    await click('[data-computer-camera=home]');
    for (const [width, height] of [[1440, 900], [1920, 1080], [3440, 1440]]) {
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        for (const theme of ['dark', 'light']) {
            await consoleCode(`c.setTheme('${theme}');`);
            await waitForConsoleLayout(consoleCode, 'Computer rack shell');
            await ready('c.computerConsole.scene.width===s.querySelector(".computer-rack-scene").clientWidth', 'Rack renderer resized');
            const geometry = await consoleCode('const rect=n=>{const r=s.querySelector(n).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {panel:rect("#computers-panel"),rack:rect(".computer-rack-viewport"),list:rect(".computer-unit-list"),note:rect(".computer-note"),footer:rect(".console-footer")};');
            assert.ok(geometry.rack.width > 100 && geometry.rack.height > 200);
            assert.ok(geometry.rack.right <= geometry.list.left, 'Rack and unit controls do not overlap');
            assert.ok(geometry.rack.bottom <= geometry.note.top && geometry.list.bottom <= geometry.note.top, `Rack and scrollable unit list stay above the instructions: ${JSON.stringify(geometry)}`);
            assert.ok(await consoleCode('const list=s.querySelector(".computer-unit-list");list.scrollTop=list.scrollHeight;const last=list.lastElementChild.getBoundingClientRect(),r=list.getBoundingClientRect();const reachable=last.bottom<=r.bottom+1;list.scrollTop=0;return reachable;'), 'All six rack unit controls remain reachable');
            assert.ok(await consoleCode('return [...s.querySelectorAll(".computer-quick-power")].every(button=>{const r=button.getBoundingClientRect();return r.width>=44 && r.height>=44 && button.querySelector(".pump-rocker-face .rocker-on") && button.querySelector(".rocker-off") && getComputedStyle(button).backgroundImage!=="none";});'), 'Rack controls have physical rocker faces and usable touch targets in both themes');
            assert.ok(geometry.panel.bottom <= geometry.footer.top, 'Computer tab fits the remaining viewport');
            await screenshot(`computer-rack-${width}-${theme}`);
        }
    }
    // Pick an actual server mesh through the canvas, rather than its navigation button.
    const pick = await consoleCode('const view=c.computerConsole.scene,point=view.units.get("serverA").group.position.clone();point.z=1.04;point.project(view.camera);const r=view.renderer.domElement.getBoundingClientRect();return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};');
    await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...pick, button: 'left', clickCount: 1 });
    await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pick, button: 'left', clickCount: 1 });
    assert.equal(await consoleCode('return s.querySelector(".computer-dialog").matches(":popover-open");'), true);
    assert.match(await consoleCode('return s.querySelector("#computer-title").textContent;'), /Process server A/);
    assert.equal(await consoleCode('return s.querySelectorAll(".computer-unit-list [aria-expanded=true]").length;'), 1, 'Only the inspected unit is marked expanded');
    await click('[data-computer-diagnose]');
    assert.match(await consoleCode('return s.querySelector(".computer-diagnostic").textContent;'), /Passed/);
    await click('[data-computer-order]');
    assert.equal(await consoleCode('return s.querySelector("[data-computer-work=isolate]").disabled;'), true);
    await click('[data-computer-toggle]'); await advance(1);
    assert.equal(await consoleCode('return c.simulation.computers.activeServer;'), 'serverB');
    await click('[data-computer-work=isolate]');
    assert.equal(await consoleCode('return s.querySelector("[data-computer-toggle]").disabled;'), true);
    await click('[data-computer-work=service]'); await click('[data-computer-work=release]'); await click('[data-computer-toggle]');
    await advance(4); assert.equal(await consoleCode('return c.simulation.work.current("serverA").held;'), 0);
    await advance(12); await click('[data-computer-work=complete]');
    assert.equal(await consoleCode('return c.simulation.work.current("serverA");'), undefined);
    assert.equal(await consoleCode('return c.simulation.computers.units.serverA.services;'), 1);
    await screenshot('computer-server-maintained');
    await click('[data-computer-close]');
    assert.equal(await consoleCode('return s.activeElement.dataset.computerOpen;'), 'serverA', 'Inspection restores focus to selected rack unit');
    await action('pumpA'); await action('pumpB'); await advance(8);
    await consoleCode('c.simulation.setGridDispatchEnabled(false);c.update();');
    await action('start'); await advance(150);
    await click('[data-computer-power=instrumentServer]');
    assert.equal(await consoleCode('return c.simulation.computers.automationAvailable && c.simulation.running;'), true, 'Instrument shutdown does not stop generation or process computing');
    assert.ok(await consoleCode('return [...s.querySelectorAll(".metrics .metric-reading [data-value]")].every(node=>node.textContent==="OFF");'), 'All six main instruments show OFF, without stale readings');
    assert.ok(await consoleCode('return c.computerConsole.scene.units.get("instrumentServer").activity.every(lamp=>lamp.emissiveIntensity===0);'), 'OFF server has no activity lights');
    const offMotion = await consoleCode('return {...c.instrumentMotion};'); await advance(3);
    assert.deepEqual(await consoleCode('return {...c.instrumentMotion};'), offMotion, 'Unpowered instruments stop their motion');
    for (const theme of ['dark', 'light']) {
        await consoleCode(`c.setTheme('${theme}');`);
        assert.ok(await consoleCode('return getComputedStyle(s.querySelector(".thermal-metric .metric-motion")).visibility==="hidden" && getComputedStyle(s.querySelector(".core-temperature-metric")).animationName==="none";'), 'OFF screen hides machinery motion and status animations');
        await screenshot(`computer-instruments-off-${theme}`);
    }
    await click('[data-computer-power=instrumentServer]');
    assert.equal(await consoleCode('return c.dataset.instruments;'), 'false', 'Instruments wait for boot');
    await advance(6);
    assert.equal(await consoleCode('return c.dataset.instruments;'), 'true');
    assert.ok(await consoleCode('return [...s.querySelectorAll(".metrics .metric-reading [data-value]")].every(node=>node.textContent!=="OFF");'), 'Online instruments restore current actual readings');
    await open('rackSwitch'); await click('[data-computer-toggle]'); await advance(1);
    assert.equal(await consoleCode('return s.querySelector("[data-action=auto]").disabled;'), true);
    assert.equal(await consoleCode('return c.simulation.running && !c.simulation.tripped;'), true);
    await action('manual'); await input('#load', 35); await advance(25);
    assert.ok(await consoleCode('return c.simulation.power<40 && !c.simulation.autoMode;'), 'Manual operation stays live through computer-network loss');
    await click('[data-computer-toggle]'); await advance(6); await click('[data-computer-close]');
    await tab('reactor');
    assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom];'), mainCamera, 'Rack camera does not alter plant camera');
    const frames = await consoleCode('return c.computerConsole.scene.renderer.info.render.frame;');
    await advance(2);
    assert.equal(await consoleCode('return c.computerConsole.scene.renderer.info.render.frame;'), frames, 'Hidden rack does not render');
    await tab('computers');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const phase = await consoleCode('return c.computerConsole.phase;'); await advance(2);
    assert.equal(await consoleCode('return c.computerConsole.phase;'), phase, 'Reduced motion keeps rack fan pose still');
    assert.ok(await consoleCode('return [...c.computerConsole.scene.units.values()].every(unit=>unit.activity.every(lamp=>lamp.emissiveIntensity>.5));'), 'Reduced motion uses steady activity lamps');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitForConsoleLayout(consoleCode, 'Mobile computer rack');
    await consoleCode('s.querySelector(".computer-rack-viewport").scrollIntoView({block:"center"});');
    await ready('c.computerConsole.visible', 'Mobile rack actually visible');
    assert.ok(await consoleCode('return document.documentElement.scrollWidth<=innerWidth && s.querySelector(".plant-tabs").scrollWidth<=s.querySelector(".plant-tabs").clientWidth;'), 'Rack and tabs fit mobile');
    await screenshot('computer-rack-mobile-light');
    await consoleCode('s.querySelector(".console-footer").scrollIntoView({block:"end"});');
    await ready('!c.computerConsole.visible', 'Offscreen rack suspended');
    const hiddenFrames = await consoleCode('return c.computerConsole.scene.renderer.info.render.frame;'); await advance(2);
    assert.equal(await consoleCode('return c.computerConsole.scene.renderer.info.render.frame;'), hiddenFrames);
    await consoleCode('s.querySelector(".computer-rack-viewport").scrollIntoView({block:"center"});');
    await ready('c.computerConsole.visible', 'Rack resumes on return');
    await action('pause'); const pausedPhase = await consoleCode('return c.computerConsole.phase;');
    const pausedLights = await consoleCode('return c.computerConsole.activityTime;'); await advance(10);
    assert.equal(await consoleCode('return c.computerConsole.phase;'), pausedPhase);
    assert.equal(await consoleCode('return c.computerConsole.activityTime;'), pausedLights, 'Pause freezes light activity');
    await consoleCode('window.oldRack=c.computerConsole.scene;window.retainedRackConsole=c;c.remove();document.querySelector(".nuclear-power-view").append(c);');
    assert.equal(await consoleCode('return window.oldRack.disposed;'), true);
    await ready('c.computerConsole.scene && c.computerConsole.scene!==window.oldRack', 'Reconnection rebuilds disposed rack resources');
    // Context loss leaves native inspection/maintenance controls available without a diagram.
    await consoleCode('c.computerConsole.scene.renderer.domElement.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));');
    assert.equal(await consoleCode('return c.computerConsole.scene;'), null);
    assert.ok(await consoleCode('return !s.querySelector(".computer-view-status").hidden && s.querySelector(".computer-view-status").textContent.includes("3D rack unavailable");'));
    assert.equal(await consoleCode('return s.querySelector(".computer-camera-tools").hidden;'), true);
    assert.equal(await consoleCode('return s.querySelector(".computer-rack-diagram");'), null);
    await open('rackUps'); await click('[data-computer-diagnose]');
    assert.match(await consoleCode('return s.querySelector("#computer-title").textContent;'), /Rack UPS/);
    await screenshot('computer-rack-unavailable-inspection'); await click('[data-computer-close]');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await consoleCode('c.setTheme("dark");'); await tab('reactor'); await action('reset');
    await waitForConsoleLayout(consoleCode, 'Plant restored after rack checks');
}

async function checkComputerSwitchSounds({ consoleCode, action, page, ready, tab, click, advance }) {
    await tab('computers');
    await waitForConsoleLayout(consoleCode, 'Computer power switches');
    const wasEnabled = await consoleCode('return !!c.soundEnabled;');
    if (!wasEnabled) {
        const point = await consoleCode('const r=s.querySelector("[data-action=sound]").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};');
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
    await consoleCode('return c.plantAudio.preloadUi();');
    await ready('c.alarmAudio.state==="running"', 'Opted-in computer audio ready');
    await consoleCode('window.rackButtonCues=[];window.originalRackUi=c.plantAudio.ui.bind(c.plantAudio);c.plantAudio.ui=(kind,profile)=>{const played=window.originalRackUi(kind,profile);if(played)window.rackButtonCues.push({kind,profile,sample:[...c.plantAudio.nodes].find(v=>v.ui)?.sample});return played;};');
    const throttleReady = () => ready('c.alarmAudio.currentTime-c.plantAudio.lastUiAt>=.08', 'Computer switch sound throttle expired');
    const check = async (selector, enabled) => {
        await throttleReady();
        const result = await consoleCode(`s.querySelector('${selector}').click();const voice=[...c.plantAudio.nodes].find(v=>v.ui);return {enabled:c.simulation.computers.units.serverA.enabled,checked:s.querySelector('${selector}').getAttribute('aria-checked'),profile:voice?.profile,sample:voice?.sample};`);
        assert.deepEqual(result, { enabled, checked: String(enabled), profile: 'computers', sample: enabled ? 'click_004' : 'click_005' });
    };
    await check('[data-computer-power=serverA]', false);
    await throttleReady();
    await consoleCode('s.querySelector("[data-computer-power=serverA]").focus();');
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    assert.deepEqual(await consoleCode('return window.rackButtonCues.at(-1);'), { kind: 'on', profile: 'computers', sample: 'click_004' }, 'Keyboard power ON plays the matching computer button sample');
    assert.match(await consoleCode('return s.querySelector("[data-computer-state=serverA]").textContent;'), /BOOT/);
    assert.equal(await consoleCode('return c.simulation.computers.units.serverA.online;'), false, 'Rocker request and actual boot remain separate');
    await click('[data-computer-open=serverA]');
    await check('[data-computer-toggle]', false);
    await check('[data-computer-toggle]', true);
    await action('sound');
    await click('[data-computer-toggle]');
    assert.equal(await consoleCode('return c.plantAudio.nodes.size;'), 0, 'Muted rack switching stays quiet');
    await click('[data-computer-toggle]');
    await advance(6); await click('[data-computer-close]');
    if (wasEnabled) await action('sound');
    await consoleCode('c.plantAudio.ui=window.originalRackUi;delete window.originalRackUi;delete window.rackButtonCues;');
    await tab('reactor');
}

async function checkColdRack({ consoleCode, action, tab, click, advance }) {
    assert.equal(await consoleCode('return c.simulation.supply.factor;'), 0, JSON.stringify(await consoleCode('return {supply:c.simulation.supply,events:c.simulation.events.slice(-8)};')));
    assert.ok(await consoleCode('return c.simulation.supply.generators.every(g=>g.state==="STOPPED"&&!g.automatic) && Object.values(c.simulation.computers.units).every(u=>!u.enabled&&!u.online);'));
    assert.equal(await consoleCode('return c.simulation.alarms.length;'), 0, 'Cold OFF systems are not failed systems');
    assert.equal(await consoleCode('return c.dataset.instruments;'), 'false');
    assert.equal(await consoleCode('return s.querySelectorAll(".metrics .metric-reading [data-value]").length;'), 6);
    assert.ok(await consoleCode('return [...s.querySelectorAll(".metrics .metric-reading [data-value]")].every(node=>node.textContent==="OFF");'), 'New sessions start with all instrument displays OFF');
    await action('pause');
    await tab('computers');
    assert.equal(await consoleCode('return s.querySelectorAll(".computer-quick-power:disabled").length;'), 6, 'Cold rack switches wait for an actual power source');
    await consoleCode('c.simulation.supply.setGrid(c.simulation,true);c.update();');
    assert.equal(await consoleCode('return s.querySelectorAll(".computer-quick-power:disabled").length;'), 0);
    assert.equal(await consoleCode('return s.querySelectorAll(".computer-quick-power[aria-checked=true]").length;'), 0, 'Restoring AC never starts computers');
    for (const id of ['rackCooling', 'rackSwitch', 'serverA', 'serverB', 'instrumentServer', 'rackUps']) await click(`[data-computer-power="${id}"]`);
    assert.equal(await consoleCode('return s.querySelector(".computer-dialog").matches(":popover-open");'), false, 'Quick power does not open a dialog');
    assert.equal(await consoleCode('return s.querySelectorAll(".computer-quick-power[aria-checked=true]").length;'), 6);
    assert.equal(await consoleCode('return c.simulation.computers.automationAvailable;'), false);
    await action('pause'); await advance(6);
    assert.equal(await consoleCode('return c.simulation.computers.automationAvailable;'), true, 'Native card switches boot real hardware on plant time');
    await click('[data-computer-power=serverA]');
    assert.equal(await consoleCode('return c.simulation.computers.units.serverA.enabled;'), false);
    assert.equal(await consoleCode('return c.simulation.computers.activeServer;'), 'serverB');
    await click('[data-computer-power=serverA]'); await advance(6);
    await tab('reactor');
}
