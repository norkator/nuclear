/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { commissionPlant } from './plant-fixtures.mjs';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

export async function checkEquipmentStations({ consoleCode, page, action, input, until, screenshot }) {
    const ready = (expression, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${expression};})()`, label);
    const click = selector => consoleCode(`s.querySelector(${JSON.stringify(selector)}).click();`);
    const tab = id => click(`#${id}-tab`);
    const sceneReady = async id => {
        await waitForConsoleLayout(consoleCode, `${id} station geometry`);
        await ready(`c.equipmentStations.canDraw('${id}') && c.equipmentStations.scenes.get('${id}')?.width === s.querySelector('#${id}-panel .station-scene').clientWidth`, `${id} station renderer sized and visible`);
    };
    const pointer = async point => {
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    };
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await tab('reactor'); await action('reset'); await action('pause');
    await waitForConsoleLayout(consoleCode, 'Station navigation overview');
    await ready('c.overviewIntersecting', 'Overview actually visible');
    assert.equal(await consoleCode('return [...c.equipmentStations.scenes.keys()].filter(id=>id!=="electrical").length;'), 0, 'Unvisited process equipment renderers are lazy');
    const original = await consoleCode('return c.simulation.snapshot();');
    const camera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];');
    assert.ok(await consoleCode('return c.overviewScene.groups.get("computers").position.x < c.overviewScene.coolingTower.group.position.x;'), 'Server warehouse sits left of the tower');
    await screenshot('server-warehouse-overview');
    const serverPoint = await consoleCode(`const v=c.overviewScene,p=v.groups.get('computers').position.clone();p.y+=1.4;p.z+=.46;p.project(v.camera);const r=v.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};`);
    await pointer(serverPoint);
    assert.equal(await consoleCode('return c.plantTab;'), 'computers', 'Clicking a server warehouse mesh navigates to the rack');
    await tab('reactor');
    await click('[data-scene-equipment="computers"]');
    assert.equal(await consoleCode('return s.activeElement.id;'), 'computers-tab');
    await tab('reactor');

    for (const [id, station, part] of [['pumpA2', 'pumps', 'dischargeValve'], ['exchanger', 'exchanger', 'secondaryValve'], ['turbine', 'turbine', 'generatorLoading'], ['condenser', 'condenser', 'coolingValve']]) {
        await click(`[data-scene-equipment="${id}"]`);
        assert.equal(await consoleCode('return c.plantTab;'), station);
        assert.equal(await consoleCode(`return s.querySelector('[data-component-dialog="${id}"]').matches(':popover-open');`), false, 'Overview opens a station first');
        await sceneReady(station);
        assert.ok(await consoleCode(`return c.equipmentStations.scenes.get('${station}').renderer.info.render.calls>0;`), 'Actual 3D cutaway renders');
        await click(`#${station}-panel [data-station-part="${part}"]`);
        assert.equal(await consoleCode(`return s.querySelector('[data-component-dialog="${id}"]').matches(':popover-open');`), true);
        assert.equal(await consoleCode(`return s.querySelector('[data-component-dialog="${id}"]').dataset.stationControls;`), 'true');
        const prefix = station === 'pumps' ? 'pump' : station === 'exchanger' ? 'hx' : 'generation';
        assert.equal(await consoleCode(`return s.querySelector('[data-component-dialog="${id}"] [data-${prefix}-select="${part}"]').getAttribute('aria-pressed');`), 'true');
        assert.equal(await consoleCode(`return getComputedStyle(s.querySelector('[data-component-dialog="${id}"] .${prefix === 'hx' ? 'hx' : prefix}-model-scroll')).display;`), 'none', 'Station controls use the 3D model instead of a second 2D cutaway');
        await click(`[data-component-close="${id}"]`);
        assert.equal(await consoleCode('return s.activeElement.dataset.stationPart;'), part, 'Closing returns focus to the selected part');
        for (const theme of ['dark', 'light']) {
            await consoleCode(`c.setTheme('${theme}');`);
            await screenshot(`station-${station}-${theme}`);
        }
        await click(`#${station}-panel [data-station-camera="in"]`);
        assert.ok(await consoleCode(`return c.equipmentStations.scenes.get('${station}').zoom>1.1;`));
        await click(`#${station}-panel [data-station-camera="home"]`);
        await click(`#${station}-panel [data-station-overview]`);
        assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];'), camera, 'Station cameras preserve the plant camera');
    }
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), original, 'Navigation and inspection cannot change the plant');
    await tab('pumps'); await sceneReady('pumps');
    for (const id of ['pumpA', 'pumpB', 'pumpB2', 'pumpA2']) {
        const old = await consoleCode('window.oldPumpStation=c.equipmentStations.scenes.get("pumps");return window.oldPumpStation.stationId;');
        await click(`[data-station-pump="${id}"]`); await sceneReady('pumps');
        assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps").stationId;'), id);
        if (old !== id) assert.equal(await consoleCode('return window.oldPumpStation.disposed;'), true, 'Changing pump disposes the previous cutaway');
    }
    // Real triangle picking selects the valve and opens its native slider.
    const valvePoint = await consoleCode(`const v=c.equipmentStations.scenes.get('pumps'),p=v.valves[0].handle.getWorldPosition(v.target.clone()).project(v.camera),r=v.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};`);
    await pointer(valvePoint);
    assert.equal(await consoleCode('return c.pumpUI.pumpA2.selected;'), 'dischargeValve');
    assert.equal(await consoleCode('return s.querySelector("[data-component-dialog=pumpA2]").matches(":popover-open");'), true);
    await input('#pumpA2-setting', 65);
    assert.equal(await consoleCode('return c.simulation.components.items.pumpA2.settings.dischargeValve;'), 65);
    assert.equal(await consoleCode('return c.simulation.components.items.pumpA.settings.dischargeValve;'), 100, 'Station controls address only the selected pump');
    assert.equal(await consoleCode('return c.simulation.components.items.pumpA2.actual.dischargeValve;'), 100, 'Requested and actual valve positions remain separate');
    assert.ok(await consoleCode('const v=c.equipmentStations.scenes.get("pumps").valves[0];return v.handle.rotation.y!==v.request.rotation.y;'));
    await click('[data-component-close="pumpA2"]');
    await consoleCode(`(${commissionPlant.toString()})(c.simulation);c.update();`);
    await action('pause'); await action('pumpA2');
    await ready('c.equipmentStations.scenes.get("pumps").pumps.pumpA2.rotation.z!==0', 'Actual motor motion drives the station');
    await action('pause');
    const frozen = await consoleCode('return c.equipmentStations.scenes.get("pumps").pumps.pumpA2.rotation.z;');
    await screenshot('station-pump-paused');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps").pumps.pumpA2.rotation.z;'), frozen);
    const frames = await consoleCode('return c.equipmentStations.scenes.get("pumps").renderer.info.render.frame;');
    await tab('maintenance'); await consoleCode('c.update();');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps").renderer.info.render.frame;'), frames, 'Inactive stations do not render');

    await tab('pumps'); await sceneReady('pumps');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await action('pause');
    const reduced = await consoleCode('return c.equipmentStations.scenes.get("pumps").pumps.pumpA2.rotation.z;');
    await screenshot('station-pump-reduced-motion');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps").pumps.pumpA2.rotation.z;'), reduced);
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitForConsoleLayout(consoleCode, 'Mobile station before scrolling');
    await consoleCode('s.querySelector("#pumps-panel .station-viewport").scrollIntoView({block:"center"});');
    await sceneReady('pumps');
    assert.ok(await consoleCode('return document.documentElement.scrollWidth<=innerWidth && s.querySelector(".plant-tabs").scrollWidth<=s.querySelector(".plant-tabs").clientWidth;'), 'Stations and tabs fit a phone');
    await screenshot('station-pumps-mobile');
    await consoleCode('s.querySelector(".console-footer").scrollIntoView({block:"end"});');
    await ready('!c.equipmentStations.canDraw("pumps")', 'Offscreen station suspended');
    const hiddenFrames = await consoleCode('return c.equipmentStations.scenes.get("pumps").renderer.info.render.frame;');
    await consoleCode('c.update();');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps").renderer.info.render.frame;'), hiddenFrames);
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await page('Emulation.setEmulatedMedia', { features: [] });
    await waitForConsoleLayout(consoleCode, 'Desktop station restored');
    await consoleCode('window.scrollTo(0,0);');
    await tab('pumps'); await sceneReady('pumps');
    await consoleCode('window.oldStation=c.equipmentStations.scenes.get("pumps");const parent=c.parentElement;c.remove();parent.append(c);');
    assert.equal(await consoleCode('return window.oldStation.disposed;'), true);
    await sceneReady('pumps');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.get("pumps")!==window.oldStation;'), true);
    await tab('turbine'); await sceneReady('turbine');
    await consoleCode('c.equipmentStations.scenes.get("turbine").renderer.domElement.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));');
    assert.equal(await consoleCode('return c.equipmentStations.scenes.has("turbine");'), false);
    assert.equal(await consoleCode('return s.querySelector("#turbine-panel .station-view-status").hidden;'), false);
    await click('#turbine-panel [data-station-part="generatorLoading"]');
    await input('#turbine-generation-setting', 110);
    assert.equal(await consoleCode('return c.simulation.components.items.turbine.settings.generatorLoading;'), 110, 'Native controls remain usable after WebGL loss');
    await screenshot('station-turbine-fallback');
    await click('[data-component-close="turbine"]');
    await tab('reactor'); await action('overview-schematic');
    await consoleCode('s.querySelector("[data-equipment=exchanger]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));');
    assert.equal(await consoleCode('return c.plantTab;'), 'exchanger', 'Schematic keyboard activation uses the station route');
    await tab('reactor'); await action('overview-3d'); await action('reset');
    await consoleCode('c.setTheme("dark");');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await waitForConsoleLayout(consoleCode, 'Overview restored after equipment stations');
}
