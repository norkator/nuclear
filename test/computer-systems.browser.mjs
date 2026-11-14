/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

export async function checkComputerSystems({ consoleCode, action, input, page, until, screenshot }) {
    const ready = (expression, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${expression};})()`, label);
    const tab = name => consoleCode(`s.querySelector('[data-plant-tab="${name}"]').click();`);
    const click = selector => consoleCode(`s.querySelector(${JSON.stringify(selector)}).click();`);
    const advance = seconds => consoleCode(`for(let i=0;i<${seconds * 4};i++)c.simulation.tick(.25);c.update();`);
    const open = id => click(`.computer-unit-list [data-computer-open="${id}"]`);
    assert.equal(await consoleCode('return !!c.computerConsole.scene;'), false, 'Rack renderer is lazy');
    const mainCamera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom];');
    await tab('maintenance');
    await consoleCode('s.querySelector("#maintenance-tab").focus();s.querySelector("#maintenance-tab").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));');
    assert.equal(await consoleCode('return c.plantTab;'), 'computers');
    assert.equal(await consoleCode('return s.activeElement.id;'), 'computers-tab');
    assert.equal(await consoleCode('return s.querySelector("[data-computer-view], .computer-rack-diagram");'), null, 'Rack has only the 3D presentation');
    await ready('c.computerConsole.scene?.width>0 && c.computerConsole.visible', '3D rack sized and visible');
    assert.ok(await consoleCode('return c.computerConsole.scene.renderer.info.render.calls>0;'), 'Real rack meshes rendered');
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
            const geometry = await consoleCode('const rect=n=>{const r=s.querySelector(n).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {panel:rect("#computers-panel"),rack:rect(".computer-rack-viewport"),list:rect(".computer-unit-list"),footer:rect(".console-footer")};');
            assert.ok(geometry.rack.width > 100 && geometry.rack.height > 200);
            assert.ok(geometry.rack.right <= geometry.list.left, 'Rack and unit controls do not overlap');
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
    await action('pause'); const pausedPhase = await consoleCode('return c.computerConsole.phase;'); await advance(10);
    assert.equal(await consoleCode('return c.computerConsole.phase;'), pausedPhase);
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
