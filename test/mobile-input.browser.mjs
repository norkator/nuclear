/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

// Shared by focused phone checks and the full browser regression. Native touch
// events drive camera input; native fullscreen state proves entry and exit.
export async function checkMobileInput({ consoleCode, page, ready, tap, viewport, screenshot }) {
    const before = await consoleCode('return c.simulation.snapshot();');
    let nextTouchId = 1;
    const select = async tab => {
        await consoleCode(`c.setPlantTab('${tab}');`);
        await waitForConsoleLayout(consoleCode, `${tab} touch viewport`);
    };
    const pinch = async (tab, expression) => {
        await select(tab);
        await ready(`${expression}?.visible`, `${tab} scene is actually visible`);
        const original = await consoleCode(`const v=${expression};return {zoom:v.zoom,yaw:v.yaw,pitch:v.pitch,target:v.target.toArray()};`);
        const center = await consoleCode(`const r=${expression}.renderer.domElement.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.55};`);
        const first = nextTouchId++, second = nextTouchId++;
        const points = distance => [{id:first,x:center.x-distance,y:center.y},{id:second,x:center.x+distance,y:center.y}];
        const touch = (type, point) => page('Input.dispatchTouchEvent', { type, touchPoints: [point] });
        // CDP's default multi-touch path uses changed points, as Puppeteer's
        // touch handles do; explicitly release each finger rather than leaving
        // a second native touch active after an empty end event.
        for (const point of points(40)) await touch('touchStart', point);
        for (const distance of [50, 60, 70]) {
            for (const point of points(distance)) await touch('touchMove', point);
        }
        const enlarged = await consoleCode(`return ${expression}.zoom;`);
        const touchState = await consoleCode(`const v=${expression};return {zoom:v.zoom,active:v.touchZoom.active,points:[...v.touchZoom.points],drag:v.drag?.id};`);
        assert.ok(enlarged > original.zoom, `${tab}: spreading fingers zooms into the model: ${JSON.stringify(touchState)}`);
        assert.deepEqual(await consoleCode(`const v=${expression};return [v.yaw,v.pitch];`), [original.yaw, original.pitch], 'A pinch never becomes orbit');
        for (const distance of [50, 35]) for (const point of points(distance)) await touch('touchMove', point);
        assert.ok(await consoleCode(`return ${expression}.zoom;`) < enlarged, `${tab}: closing fingers zooms out`);
        await touch('touchEnd', points(35)[1]);
        const remaining = {id:first,x:center.x-15,y:center.y+15};
        await touch('touchMove', remaining); await touch('touchEnd', remaining);
        assert.deepEqual(await consoleCode(`const v=${expression};return [v.yaw,v.pitch];`), [original.yaw, original.pitch], 'Lifting one finger cannot jump the remaining finger into orbit');
        assert.equal(await consoleCode('return c.floatingDialogs.some(d=>d.matches(":popover-open"));'), false, 'Pinch release cannot inspect a model part');
        assert.equal(await consoleCode('return c.plantTab;'), tab, 'Pinch release cannot navigate to equipment');
        assert.equal(await consoleCode('return visualViewport.scale;'), 1, 'The camera zooms without scaling the page');
        for (const point of points(40)) await touch('touchStart', point);
        await page('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        assert.equal(await consoleCode(`const v=${expression};return v.touchZoom.points.size===0 && !v.touchZoom.active && !v.drag;`), true);
        // A fresh one-finger drag continues to orbit after the cancelled pinch.
        const orbit = await consoleCode(`const canvas=${expression}.renderer.domElement,r=canvas.getBoundingClientRect();for(const [fx,fy] of [[.22,.35],[.28,.7],[.7,.25],[.5,.8]]){const x=r.left+r.width*fx,y=r.top+r.height*fy;if(s.elementFromPoint(x,y)===canvas && s.elementFromPoint(x+30,y)===canvas)return {x,y};}return null;`);
        assert.ok(orbit, 'One-finger orbit starts on exposed canvas; label taps retain their inspection action');
        const orbitId = nextTouchId++;
        await touch('touchStart', {id:orbitId,...orbit});
        const orbitEnd = {id:orbitId,x:orbit.x+30,y:orbit.y};
        await touch('touchMove', orbitEnd); await touch('touchEnd', orbitEnd);
        assert.notEqual(await consoleCode(`return ${expression}.yaw;`), original.yaw, 'One-finger orbit remains usable');
        await consoleCode(`const v=${expression};v.yaw=${original.yaw};v.pitch=${original.pitch};v.target.fromArray(${JSON.stringify(original.target)});v.setZoom(${original.zoom});`);
    };

    const overview = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];');
    await pinch('reactor', 'c.overviewScene');
    for (const tab of ['pumps', 'exchanger', 'turbine', 'condenser', 'electrical']) await pinch(tab, `c.equipmentStations.scenes.get('${tab}')`);
    await pinch('computers', 'c.computerConsole.scene');
    await select('reactor');
    assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];'), overview, 'Every equipment camera remains independent of the overview');
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), before, 'Touch cameras issue no plant commands or time advancement');

    assert.equal(await consoleCode('return document.fullscreenElement;'), null, 'Fullscreen is never entered on page load');
    assert.equal(await consoleCode('return c.fullscreen.supported;'), true, 'Test browser supports native fullscreen');
    await tap('[data-mobile-open="more"]');
    const menu = await consoleCode('return {kind:c.mobileLayout.kind,open:s.querySelector("#mobile-more").matches(":popover-open")};');
    assert.ok(menu.open && menu.kind === 'more', `More remains open before fullscreen: ${JSON.stringify(menu)}`);
    await tap('[data-fullscreen-toggle]');
    await ready('document.fullscreenElement===document.documentElement && !c.fullscreen.pending && !c.mobileLayout.current', 'A real touch enters fullscreen and returns to the model');
    assert.equal(await consoleCode('return s.querySelector("[data-fullscreen-toggle]").textContent;'), 'Exit full screen');
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), before, 'Fullscreen preserves plant state and Pause');
    await screenshot('phone-model-fullscreen');
    await tap('[data-mobile-open="more"]'); await tap('[data-fullscreen-toggle]');
    await ready('!document.fullscreenElement && !c.fullscreen.pending && !c.mobileLayout.current', 'The landscape exit control clears menu input ownership');
    await tap('[data-mobile-open="more"]'); await tap('[data-fullscreen-toggle]');
    await ready('!!document.fullscreenElement && !c.fullscreen.pending && !c.mobileLayout.current', 'Fullscreen re-enters from its toggle');
    await viewport(390, 844);
    assert.equal(await consoleCode('return c.mobileLayout.active;'), false);
    const portrait = await consoleCode('const b=s.querySelector("[data-fullscreen-toggle]"),r=b.getBoundingClientRect();return {width:r.width,height:r.height,scroll:s.querySelector(".header-settings").scrollWidth,client:s.querySelector(".header-settings").clientWidth};');
    assert.ok(portrait.width >= 44 && portrait.height >= 44 && portrait.scroll <= portrait.client, `Portrait fullscreen control fits: ${JSON.stringify(portrait)}`);
    await tap('[data-fullscreen-toggle]');
    await ready('!document.fullscreenElement && !c.fullscreen.pending', 'Portrait control leaves native fullscreen');
    await viewport(844, 390);
    await tap('[data-mobile-open="more"]'); await tap('[data-fullscreen-toggle]');
    await ready('!!document.fullscreenElement && !c.fullscreen.pending', 'Fullscreen can be entered again');
    await consoleCode('return document.exitFullscreen();');
    await ready('!document.fullscreenElement && s.querySelector("[data-fullscreen-toggle]").getAttribute("aria-pressed")==="false"', 'Native browser exit updates the control');
    await waitForConsoleLayout(consoleCode, 'Fullscreen exit');
    assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];'), overview, 'Fullscreen and rotation retain the camera');
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), before);
    assert.equal(await consoleCode('return s.querySelectorAll("[data-fullscreen-toggle]").length;'), 1);
}
