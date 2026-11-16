/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

export async function checkElectricalGrid({ consoleCode, action, page, until, screenshot, advance }) {
    const click = selector => consoleCode(`s.querySelector(${JSON.stringify(selector)}).click();`);
    const tab = name => click(`#${name}-tab`);
    const ready = (expression, message) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c.shadowRoot;return ${expression};})()`, message);
    const sceneReady = async () => {
        await waitForConsoleLayout(consoleCode, 'Electrical grid geometry');
        await ready('c.equipmentStations.canDraw("electrical") && c.equipmentStations.scenes.get("electrical")?.width===s.querySelector("#electrical-panel .station-scene").clientWidth', 'Electrical grid renderer visible and sized');
    };
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await tab('reactor'); await action('reset'); await action('pause');
    await waitForConsoleLayout(consoleCode, 'Grid overview before navigation');
    await ready('!!c.overviewScene?.width', 'Overview ready');
    assert.equal(await consoleCode('return s.querySelector("#maintenance-tab").nextElementSibling.id;'), 'electrical-tab');
    assert.equal(await consoleCode('return s.querySelector("#electrical-tab").nextElementSibling.id;'), 'computers-tab');
    const camera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom];');
    const frozen = await consoleCode('return c.simulation.snapshot();');
    await click('[data-scene-equipment=grid]'); await sceneReady();
    assert.equal(await consoleCode('return c.plantTab;'), 'electrical');
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), frozen, 'Opening grid management sends no plant commands');
    assert.ok(await consoleCode('return c.equipmentStations.scenes.get("electrical").renderer.info.render.calls>0;'));
    await click('#electrical-panel [data-station-overview]');
    await click('[data-scene-equipment=bus]'); assert.equal(await consoleCode('return c.plantTab;'), 'electrical');
    await tab('reactor'); await action('power-supply'); await sceneReady();
    assert.equal(await consoleCode('return s.querySelector(".electrical-supply-dialog").matches(":popover-open");'), false);
    await click('#station-grid-supply'); await click('#station-turbine-supply');
    assert.equal(await consoleCode('return c.simulation.supply.source;'), 'EXTERNAL GRID');
    assert.equal(await consoleCode('return s.querySelector("#grid-supply").checked && s.querySelector("#turbine-supply").checked;'), true);
    assert.equal(await consoleCode('return c.simulation.running || c.simulation.tripped;'), false);
    await click('#electrical-panel [data-station-part=grid]');
    assert.equal(await consoleCode('return s.activeElement.id;'), 'grid-supply');
    assert.equal(await consoleCode('return getComputedStyle(s.querySelector(".electrical-supply-dialog .auxiliary-power-diagram")).display;'), 'none');
    await click('.electrical-supply-dialog [data-electrical-close]');
    assert.equal(await consoleCode('return s.activeElement.dataset.stationPart;'), 'grid');
    // Pick a real switchgear triangle through the canvas.
    const point = await consoleCode('const v=c.equipmentStations.scenes.get("electrical"),p=v.groups.get("grid").localToWorld(v.target.clone().set(0,1.2,.64)).project(v.camera),r=v.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};');
    await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    assert.equal(await consoleCode('return s.querySelector(".electrical-supply-dialog").matches(":popover-open");'), true);
    await click('.electrical-supply-dialog [data-electrical-close]');
    await click('#electrical-panel [data-station-camera=in]');
    assert.ok(await consoleCode('return c.equipmentStations.scenes.get("electrical").zoom>1.1;'));
    await click('#electrical-panel [data-station-camera=home]');
    assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom];'), camera);
    await screenshot('electrical-grid-dark');
    await consoleCode('c.setTheme("light");'); await screenshot('electrical-grid-light');
    await click('#station-grid-supply');
    await click('#electrical-panel [data-station-part=dieselA]');
    await click('[data-generator=A].diesel-run-switch');
    assert.equal(await consoleCode('return c.simulation.supply.generators[0].state;'), 'STARTING');
    await action('pause'); await advance(9);
    await ready('c.equipmentStations.scenes.get("electrical").engines.get("A").fan.rotation.z!==0', 'Grid scene follows actual diesel motion');
    assert.equal(await consoleCode('return c.simulation.supply.source;'), 'BACKUP DIESEL A');
    assert.equal(await consoleCode('return c.simulation.running;'), false);
    await click('[data-diesel-dialog=A] [data-electrical-close]');
    assert.equal(await consoleCode('return s.activeElement.dataset.stationPart;'), 'dieselA');
    await action('pause');
    const fan = await consoleCode('return c.equipmentStations.scenes.get("electrical").engines.get("A").fan.rotation.z;');
    await screenshot('electrical-grid-diesel-paused');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("electrical").engines.get("A").fan.rotation.z;'), fan);
    const frames = await consoleCode('return c.equipmentStations.scenes.get("electrical").renderer.info.render.frame;');
    await tab('maintenance'); await advance(2);
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("electrical").renderer.info.render.frame;'), frames, 'Inactive grid does not render');
    await tab('electrical');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await action('pause');
    const reduced = await consoleCode('return c.dieselMotion.A;'); await advance(2);
    assert.equal(await consoleCode('return c.dieselMotion.A;'), reduced);
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitForConsoleLayout(consoleCode, 'Mobile electrical grid');
    await consoleCode('s.querySelector("#electrical-panel .station-viewport").scrollIntoView({block:"center"});'); await sceneReady();
    assert.ok(await consoleCode('return document.documentElement.scrollWidth<=innerWidth && s.querySelector(".plant-tabs").scrollWidth<=s.querySelector(".plant-tabs").clientWidth;'));
    await screenshot('electrical-grid-mobile');
    await consoleCode('s.querySelector(".console-footer").scrollIntoView({block:"end"});');
    await ready('!c.equipmentStations.canDraw("electrical")', 'Grid truly offscreen');
    const offscreen = await consoleCode('return c.equipmentStations.scenes.get("electrical").renderer.info.render.frame;'); await advance(2);
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("electrical").renderer.info.render.frame;'), offscreen);
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await consoleCode('window.scrollTo(0,0);'); await sceneReady();
    await consoleCode('window.gridBeforeDetach=c.equipmentStations.scenes.get("electrical");const parent=c.parentElement;c.remove();parent.append(c);');
    assert.equal(await consoleCode('return window.gridBeforeDetach.disposed;'), true);
    await ready('c.equipmentStations.scenes.get("electrical") && c.equipmentStations.scenes.get("electrical")!==window.gridBeforeDetach', 'Grid rebuilt after reconnect');
    await sceneReady();
    await consoleCode('c.equipmentStations.scenes.get("electrical").renderer.domElement.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.has("electrical");'), false);
    assert.equal(await consoleCode('return s.querySelector("#electrical-panel .station-view-status").hidden;'), false);
    await click('#station-grid-supply'); assert.equal(await consoleCode('return c.simulation.supply.gridAvailable;'), true);
    await click('#electrical-panel [data-station-part=bus]');
    assert.equal(await consoleCode('return s.querySelector(".electrical-supply-dialog").matches(":popover-open");'), true);
    await screenshot('electrical-grid-fallback'); await click('.electrical-supply-dialog [data-electrical-close]');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await tab('reactor'); await action('reset'); await consoleCode('c.setTheme("dark");');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await waitForConsoleLayout(consoleCode, 'Overview restored after grid check');
}
