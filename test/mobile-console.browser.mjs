/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';
import { commissionPlant } from './plant-fixtures.mjs';
import { checkMobileInput } from './mobile-input.browser.mjs';

export async function checkMobileConsole({ consoleCode, page, until, screenshot, inputOnly = false }) {
    let nextTouchId = 0;
    const touchId = () => ++nextTouchId;
    const ready = (condition, label) => until(`(()=>{const c=document.querySelector('nuclear-power-console');const s=c?.shadowRoot;return ${condition};})()`, label);
    const viewport = async (width, height, touch = true) => {
        await page('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
        await waitForConsoleLayout(consoleCode, `Mobile viewport ${width}×${height}`);
    };
    const tap = async selector => {
        await waitForConsoleLayout(consoleCode, `Before touch ${selector}`);
        await consoleCode(`s.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',inline:'nearest'});`);
        await waitForConsoleLayout(consoleCode, `Scrolled touch target ${selector}`);
        const point = await consoleCode(`const n=s.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=s.elementFromPoint(x,y);return {x,y,disabled:!!n.disabled,inert:!!n.closest('[inert]'),width:r.width,height:r.height,covered:!n.contains(hit),hit:hit?.outerHTML.slice(0,150)};`);
        assert.ok(!point.disabled && !point.inert && !point.covered && point.width > 0 && point.height > 0, `Touch control reachable: ${selector}: ${JSON.stringify(point)}`);
        // Layout can settle before native touch click synthesis finishes.
        // Dedicated swipe handles deliberately use touchend instead of click.
        await consoleCode(`const n=s.querySelector(${JSON.stringify(selector)});window.mobileTapAbort?.abort();window.mobileTapAbort=new AbortController();window.mobileTapActivated=false;document.addEventListener(n.matches('.mobile-edge')?'touchend':'click',event=>{if(event.isTrusted&&event.composedPath().includes(n)){window.mobileTapActivated=true;window.mobileTapAbort.abort();}},{capture:true,signal:window.mobileTapAbort.signal});`);
        // Keep native contacts explicit across taps, swipes and pinches. CDP's
        // implicit ID 0 can retain cancelled-gesture click suppression.
        const finger = { id: touchId(), x: point.x, y: point.y };
        await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
        await consoleCode('return new Promise(requestAnimationFrame);');
        await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger] });
        await ready('window.mobileTapActivated', `Native touch activates ${selector}`);
        await waitForConsoleLayout(consoleCode, `After touch ${selector}`);
    };
    const close = async () => {
        await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await ready('!c.mobileLayout.current', 'Mobile surface closes');
    };
    const area = async name => {
        if (name === 'maintenance') { await tap('[data-mobile-open="more"]'); await tap('[data-mobile-tab="maintenance"]'); return; }
        await tap('.mobile-home');
        const equipment = name === 'pumps' ? await consoleCode('return c.equipmentStations.selectedPump;') : name === 'electrical' ? 'grid' : name;
        if (name !== 'reactor') await tap(`[data-scene-equipment="${equipment}"]`);
    };
    const paused = async value => {
        if (await consoleCode('return c.simulation.paused;') !== value) await tap('[data-mobile-pause] [data-action="pause"]');
        await ready(`c.simulation.paused===${value}`, 'Pause button reflects the requested state');
    };
    const swipe = async (selector, dx) => {
        await waitForConsoleLayout(consoleCode, `Swipe ${selector}`);
        const point = { id: touchId(), ...await consoleCode(`const r=s.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};`) };
        await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        for (const fraction of [.3, .65, 1]) {
            await consoleCode('return new Promise(requestAnimationFrame);');
            await page('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{...point,x:point.x+dx*fraction}] });
        }
        await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{...point,x:point.x+dx}] });
    };

    if (inputOnly) {
        await viewport(844, 390);
        await consoleCode('c.setPlantTab("reactor");c.setOverview("3d");if(!c.simulation.paused)c.act("pause");');
        await ready('c.mobileLayout.active && c.overviewScene?.visible', 'Phone input setup is visible');
        await checkMobileInput({ consoleCode, page, ready, tap, viewport, screenshot, touchId });
        return;
    }

    await viewport(1920, 1080, false);
    await consoleCode(`for(const d of [...c.floatingDialogs])c.closeFloatingDialog(d,false);c.setPlantTab('reactor');c.setOverview('3d');c.setSceneLabels('compact');c.inspect('pumpA2');c.closeFloatingDialog(s.querySelector('[data-component-dialog=pumpA2]'),false);c.act('reset');if(!c.simulation.paused)c.act('pause');window.mobilePlant=c.simulation;window.mobilePreferences=localStorage.getItem('porssiohjain.nuclear-power.panels');window.mobilePanelState={...s.querySelector('.console-layout').dataset};`);
    const before = await consoleCode('return c.simulation.snapshot();');
    await consoleCode('window.mobileGridController=s.querySelector(".grid-dispatch-panel");window.mobileSpentFuel=s.querySelector(".overview-toolbar [data-action=spent-fuel]");');
    const camera = await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];');
    await viewport(844, 390);
    await ready('c.mobileLayout.active && c.overviewIntersecting', 'Landscape touch layout activates');
    assert.equal(await consoleCode('return c.simulation===window.mobilePlant && !c.companion && c.dataset.screen==="desktop";'), true, 'Phone remains the same authoritative host');
    assert.deepEqual(await consoleCode('return c.simulation.snapshot();'), before, 'Layout entry issues no commands');

    for (const [width, height] of [[667, 375], [740, 360], [844, 390], [932, 430]]) {
        await viewport(width, height);
        for (const theme of ['dark', 'light']) {
            await consoleCode(`c.setTheme('${theme}',false);`);
            await waitForConsoleLayout(consoleCode, `${width} ${theme} mobile geometry`);
            const layout = await consoleCode(`const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {viewport:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth},scene:rect(s.querySelector('.diagram-viewport')),header:[...s.querySelectorAll('.mobile-header button')].map(rect)};`);
            assert.ok(layout.scene.height >= height - 65, `Overview uses landscape height: ${JSON.stringify(layout)}`);
            assert.ok(layout.viewport.scroll <= width && layout.scene.bottom <= height + 1, `No document overflow: ${JSON.stringify(layout)}`);
            for (let i = 0; i < layout.header.length; i++) {
                const r = layout.header[i];
                assert.ok(r.width >= 44 && r.height >= 44 && r.right <= width && r.y >= 0, `Header touch fit: ${JSON.stringify(layout)}`);
                if (i) assert.ok(layout.header[i - 1].right <= r.x + 1, 'Header controls do not overlap');
            }
            await screenshot(`phone-${width}-${theme}`);
            await tap('[data-mobile-open="grid-controller"]');
            assert.equal(await consoleCode('return c.mobileLayout.current===window.mobileGridController && s.querySelectorAll("#follow-grid").length===1;'), true, 'GC opens the original controller with a single Follow requests control');
            const grid = await consoleCode('const n=c.mobileLayout.current,r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:n.scrollWidth,width:n.clientWidth};');
            assert.ok(grid.x>=0 && grid.y>=0 && grid.right<=width && grid.bottom<=height && grid.scroll<=grid.width, `Grid controller fits the phone: ${JSON.stringify(grid)}`);
            await tap('.grid-dispatch-controls label');
            assert.equal(await consoleCode('return c.simulation.gridDispatch.enabled;'), false, 'Follow requests can be disabled through a native phone tap');
            await tap('.grid-dispatch-controls label');
            assert.equal(await consoleCode('return c.simulation.gridDispatch.enabled && c.simulation.paused;'), true, 'Following can resume without changing Pause');
            if (width===667) await screenshot(`phone-grid-controller-${theme}`);
            await close();
            assert.equal(await consoleCode('return s.activeElement.dataset.mobileOpen;'), 'grid-controller', 'Closing GC restores its visible header button');
            assert.equal(await consoleCode('return s.querySelector("[data-mobile-open=grid-controller]").getAttribute("aria-expanded");'), 'false');
            await tap('[data-mobile-open="more"]');
            const menu = await consoleCode(`const buttons=[...s.querySelectorAll('.mobile-primary-actions button')],rect=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {actions:buttons.map(n=>n.dataset.mobileTab||n.dataset.action),rects:buttons.map(rect),other:rect(s.getElementById('mobile-other-controls')),fallback:s.querySelector('[data-mobile-equipment-fallback]').hidden,spent:s.querySelector('.mobile-primary-actions [data-action=spent-fuel]')===window.mobileSpentFuel};`);
            assert.deepEqual(menu.actions, ['maintenance', 'spent-fuel'], 'Maintenance and spent fuel lead the plant menu');
            assert.ok(menu.fallback && menu.spent && menu.rects.every(r=>r.top>=0 && r.bottom<=height && r.width>=44 && r.height>=44 && r.bottom<=menu.other.top), `Primary actions fit above the separate other controls: ${JSON.stringify(menu)}`);
            if (width===667) await screenshot(`phone-plant-menu-${theme}`);
            await close();
        }
    }

    await viewport(844, 390);
    await tap('[data-mobile-open="instruments"]');
    assert.equal(await consoleCode('return c.mobileLayout.kind;'), 'instruments');
    assert.ok(await consoleCode('return s.querySelector("#plant-instruments .mobile-surface-heading").getBoundingClientRect().width>250;'), 'Instrument heading spans its drawer without implicit grid columns');
    assert.equal(await consoleCode('return s.querySelector(".control-column").inert;'), true);
    assert.equal(await consoleCode('return s.querySelector("#plant-instruments").contains(s.activeElement);'), true);
    await screenshot('phone-instruments');
    assert.equal(await consoleCode('return c.simulation.paused;'), true);
    // A real backdrop tap closes the drawer and cannot pick the scene behind it.
    const backdropTouch = {id:touchId(),x:750,y:160};
    await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [backdropTouch] });
    await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [backdropTouch] });
    await ready('!c.mobileLayout.current', 'Backdrop closes instruments');
    await ready('s.activeElement?.dataset.mobileOpen==="instruments"', 'Backdrop restores focus to its visible handle');
    assert.equal(await consoleCode('return c.plantTab;'), 'reactor');
    assert.equal(await consoleCode('return s.activeElement.dataset.mobileOpen;'), 'instruments');

    await tap('[data-mobile-open="operator"]');
    const emergency = await consoleCode('const r=s.querySelector(".emergency-station").getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewportHeight:innerHeight};');
    assert.ok(emergency.height > 0 && emergency.top >= 0 && emergency.bottom <= emergency.viewportHeight, `Covered ESD fits the first drawer screen: ${JSON.stringify(emergency)}`);
    assert.equal(await consoleCode('return s.querySelector("[data-action=trip]").disabled && !c.tripCoverOpen;'), true);
    await screenshot('phone-operator');
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 });
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 0 });
    assert.equal(await consoleCode('return c.mobileLayout.current.contains(s.activeElement);'), true, 'Keyboard focus remains in the surface');
    assert.ok(await consoleCode('const r=s.activeElement.getBoundingClientRect(),d=c.mobileLayout.current.getBoundingClientRect();return r.top>=d.top && r.bottom<=d.bottom;'), 'Keyboard focus scrolls a lower control into view');
    await close();
    assert.equal(await consoleCode('return localStorage.getItem("porssiohjain.nuclear-power.panels")===window.mobilePreferences;'), true, 'Mobile drawers never write desktop preferences');
    await swipe('.mobile-edge-left', 100);
    await ready('c.mobileLayout.kind==="instruments"', 'Handle swipe opens instruments');
    await swipe('#plant-instruments .mobile-surface-heading', -100);
    await ready('!c.mobileLayout.current', 'Header swipe closes instruments');
    assert.equal(await consoleCode('return c.plantTab;'), 'reactor', 'Drawer gestures never pick the scene');

    await tap('[data-mobile-open="more"]');
    await tap('.mobile-primary-actions [data-action="spent-fuel"]');
    assert.equal(await consoleCode('return c.mobileLayout.current===s.getElementById("spent-fuel-window");'), true, 'The primary spent-fuel action opens its retained inspection');
    await close(); await area('maintenance');
    assert.equal(await consoleCode('return c.plantTab;'), 'maintenance', 'The first menu action opens maintenance');
    await tap('.mobile-home');

    // Touch handles suppress compatibility clicks; their accepted gestures still
    // use the same opted-in, bounded UI audio as keyboard/mouse buttons.
    await paused(false);
    await tap('[data-mobile-open="more"]');
    if (!await consoleCode('return c.soundEnabled;')) await tap('#mobile-more [data-action="sound"]');
    await close();
    await consoleCode('return c.plantAudio.preloadUi();');
    for (const kind of ['instruments', 'operator']) {
        await ready('c.alarmAudio?.state==="running" && c.plantAudio.uiState==="ready" && c.alarmAudio.currentTime-c.plantAudio.lastUiAt>=.08', 'UI audio is ready for a native drawer tap');
        const sound = await consoleCode('return Number.isFinite(c.plantAudio.lastUiAt)?c.plantAudio.lastUiAt:-1;');
        await tap(`[data-mobile-open="${kind}"]`);
        const audio = await consoleCode('return {time:c.plantAudio.lastUiAt,enabled:c.soundEnabled,paused:c.simulation.paused,state:c.alarmAudio.state};');
        assert.ok(Number.isFinite(audio.time) && audio.time > sound, `${kind} touch opening plays an actual UI voice: ${JSON.stringify({before:sound,...audio})}`);
        await close();
    }
    await ready('c.alarmAudio.currentTime-c.plantAudio.lastUiAt>=.08', 'UI audio is ready for a drawer swipe');
    const swipeSound = await consoleCode('return c.plantAudio.lastUiAt;');
    await swipe('.mobile-edge-right', -100);
    await ready('c.mobileLayout.kind==="operator"', 'Controls opens through its swipe handle');
    assert.ok(await consoleCode('return c.plantAudio.lastUiAt;') > swipeSound, 'A drawer swipe plays an actual UI voice');
    await close(); await tap('[data-mobile-open="more"]');
    await tap('#mobile-more [data-action="sound"]'); await close();
    const mutedSound = await consoleCode('return c.plantAudio.lastUiAt;');
    await tap('[data-mobile-open="instruments"]');
    assert.equal(await consoleCode('return c.plantAudio.lastUiAt;'), mutedSound, 'Muted drawer openings remain silent');
    await close();

    // Exercise a complete cold startup through the actual touch controls.
    await paused(false);
    await area('electrical'); await tap('[data-mobile-open="parts"]');
    await tap('label[for="station-grid-supply"]'); await close();
    await area('computers'); await tap('[data-mobile-open="parts"]');
    for (const id of ['rackCooling', 'rackSwitch', 'serverA', 'instrumentServer']) await tap(`[data-computer-power="${id}"]`);
    await ready('c.simulation.computers.automationAvailable', 'Actual computer boot completes');
    await close(); await tap('[data-mobile-open="instruments"]'); await screenshot('phone-instruments-online'); await close();
    await tap('.mobile-back'); await tap('[data-mobile-open="operator"]');
    await tap('[data-action="pumpA"]'); await tap('[data-action="pumpB"]');
    await ready('!s.querySelector("[data-action=start]").disabled', 'Actual circulation permits Start');
    await tap('[data-action="start"]');
    assert.equal(await consoleCode('return c.simulation.running;'), true);
    await tap('[data-action="trip-cover"]'); await tap('[data-action="trip"]');
    assert.equal(await consoleCode('return c.simulation.tripped && !c.simulation.running;'), true);
    await close(); await area('reactor');
    await tap('[data-mobile-open="more"]'); await tap('#mobile-more [data-action="reset"]'); await close(); await paused(true);

    // Touch picking preserves the overview camera and the selected backup pump.
    await tap('[data-scene-equipment="pumpA2"]');
    assert.equal(await consoleCode('return c.plantTab;'), 'pumps');
    assert.equal(await consoleCode('return c.equipmentStations.selectedPump;'), 'pumpA2');
    await tap('[data-mobile-open="parts"]'); await tap('#pumps-panel [data-station-part="dischargeValve"]');
    assert.equal(await consoleCode('return c.mobileLayout.current===s.querySelector("[data-component-dialog=pumpA2]");'), true);
    assert.ok(await consoleCode('const r=c.mobileLayout.current.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;'), 'A sheet overrides retained desktop drag coordinates');
    const requested = await consoleCode('return c.simulation.components.items.pumpA2.settings.dischargeValve;');
    await consoleCode('const input=s.querySelector("[data-component-dialog=pumpA2] .pump-setting");input.value=20;input.dispatchEvent(new Event("input",{bubbles:true}));');
    await close();
    assert.equal(await consoleCode('return c.simulation.components.items.pumpA2.settings.dischargeValve;'), requested, 'Closing cancels the preview');
    assert.equal(await consoleCode('return c.pumpUI.pumpA2.preview;'), null);
    assert.equal(await consoleCode('return s.activeElement.dataset.mobileOpen;'), 'parts');
    await tap('.mobile-back');
    assert.deepEqual(await consoleCode('return [c.overviewScene.yaw,c.overviewScene.pitch,c.overviewScene.zoom,...c.overviewScene.target.toArray()];'), camera);

    await tap('[data-mobile-open="analysis"]');
    const frames = await consoleCode('return c.overviewScene.renderer.info.render.frame;');
    await consoleCode('c.updateOverview(true);c.drawMotion(.05);');
    assert.equal(await consoleCode('return c.overviewScene.renderer.info.render.frame;'), frames, 'A covering sheet stops actual scene rendering');
    assert.equal(await consoleCode('return c.simulation.paused;'), true, 'Opening trends preserves Pause');
    await screenshot('phone-trends'); await close();
    await paused(false); await tap('[data-mobile-open="analysis"]');
    const elapsed = await consoleCode('return c.simulation.elapsed;');
    const coveredFrames = await consoleCode('return c.overviewScene.renderer.info.render.frame;');
    await ready(`c.simulation.elapsed>${elapsed}`, 'Plant time continues behind a covering sheet');
    assert.equal(await consoleCode('return c.overviewScene.renderer.info.render.frame;'), coveredFrames);
    await close(); await paused(true);

    await checkMobileInput({ consoleCode, page, ready, tap, viewport, screenshot, touchId });

    // Career screens retain host ownership, pinned goals and the existing save path.
    await tap('[data-mobile-open="company"]');
    await tap('.game-difficulty label:has([value="easy"])');
    await tap('[data-game-action="begin"]');
    await ready('c.game.career && !c.game.busy', 'Career starts on the phone host');
    assert.equal(await consoleCode('return c.game.career.state.difficulty;'), 'easy');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'Unaccepted assignments have no overlay');
    await consoleCode('c.game.tab="assignments";c.game.open();');
    await tap('[data-game-action="accept"]'); await ready('!c.game.busy', 'Phone accepts assignment');
    await paused(true);
    await consoleCode('window.mobileTasks=s.querySelector(".game-tasks");');
    const checkTasks = async label => {
        await waitForConsoleLayout(consoleCode, label);
        const tasks = await consoleCode(`const p=s.querySelector('.game-tasks'),r=p.getBoundingClientRect(),scene=s.querySelector('.process-panel').getBoundingClientRect(),caption=s.getElementById(c.plantTab+'-panel').querySelector('.plant-scene-caption')?.getBoundingClientRect(),style=getComputedStyle(p),items=[...p.querySelectorAll('li')].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(n).fontSize),done:n.dataset.complete,marker:n.querySelector('.game-task-marker').textContent};});return {viewportWidth:innerWidth,same:p===window.mobileTasks,parent:p.parentElement.className,hidden:p.hidden,x:r.x,right:r.right,top:r.top,bottom:r.bottom,height:r.height,scene:{x:scene.x,top:scene.top,bottom:scene.bottom},caption:caption?{x:caption.x,bottom:caption.bottom}:null,background:style.backgroundColor,border:style.borderTopWidth,items};`);
        assert.ok(tasks.same && tasks.parent.includes('process-panel') && !tasks.hidden, `The original live checklist is in the mobile scene: ${JSON.stringify(tasks)}`);
        assert.equal(tasks.background, 'rgba(0, 0, 0, 0)', 'Assignment text has no card background');
        assert.equal(tasks.border, '0px', 'Assignment text has no card border');
        assert.ok(tasks.x>=tasks.scene.x && tasks.right<=tasks.viewportWidth && tasks.top>=tasks.scene.top && tasks.bottom<=tasks.scene.bottom && tasks.height>0, `Checklist fits the upper-left scene: ${JSON.stringify(tasks)}`);
        const inset=await consoleCode('return c.plantTab==="pumps" ? 60 : 16;');
        assert.ok(Math.abs(tasks.x-tasks.scene.x-inset)<1, `Checklist stays in the left caption area: ${JSON.stringify(tasks)}`);
        if (tasks.caption) assert.ok(tasks.top>=tasks.caption.bottom+4 && tasks.top<=tasks.caption.bottom+12, `Checklist sits directly below the scene caption: ${JSON.stringify(tasks)}`);
        const handle=await consoleCode('const r=s.querySelector(".mobile-edge-left").getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom};');
        assert.ok(tasks.x>=handle.right || tasks.right<=handle.x || tasks.bottom<=handle.top || tasks.top>=handle.bottom, `Assignment text clears Instruments: ${JSON.stringify({tasks,handle})}`);
        for (let i=0;i<tasks.items.length;i++) {
            assert.ok(tasks.items[i].font<=8 && tasks.items[i].top>=tasks.top && tasks.items[i].bottom<=tasks.bottom, `Small, visible assignment text: ${JSON.stringify(tasks)}`);
            if (i) assert.ok(tasks.items[i-1].bottom<=tasks.items[i].top, 'Steps occupy separate lines');
        }
        return tasks;
    };
    for (const [width,height] of [[667,375],[740,360],[844,390],[932,430]]) {
        await viewport(width,height);
        for (const theme of ['dark','light']) {
            await consoleCode(`c.setTheme('${theme}',false);`);
            const tasks=await checkTasks(`${width} ${theme} assignment text`);
            assert.ok(tasks.items.some(n=>n.done==='false'), 'Pending steps remain visible before verification');
            await screenshot(`phone-assignment-${width}-${theme}`);
        }
    }
    await viewport(844,390); await area('pumps');
    await checkTasks('Station assignment text');
    await screenshot('phone-assignment-station');
    const stationTasks=await consoleCode('const t=s.querySelector(".game-tasks").getBoundingClientRect(),b=s.querySelector(".mobile-back").getBoundingClientRect();return {textBottom:t.bottom,backTop:b.top};');
    assert.ok(stationTasks.textBottom<=stationTasks.backTop, 'Checklist clears the station return button');
    await tap('.mobile-home');
    await tap('[data-mobile-open="grid-controller"]');
    await viewport(390,844);
    assert.equal(await consoleCode('return !window.mobileGridController.matches(":popover-open") && !window.mobileGridController.hasAttribute("popover");'), true, 'Rotation closes GC and restores desktop presentation during a career');
    assert.equal(await consoleCode('return s.querySelector(".analysis-column > .game-tasks")===window.mobileTasks;'), true, 'Rotation restores the same desktop checklist');
    await viewport(844,390); await paused(false);
    await tap('[data-mobile-open="grid-controller"]'); await tap('.grid-dispatch-controls label');
    assert.equal(await consoleCode('return c.simulation.gridDispatch.enabled;'), false, 'A career operator can turn Follow requests off from GC');
    await close();
    await consoleCode(`(${commissionPlant.toString()})(c.simulation);c.simulation.togglePump('A');c.simulation.togglePump('B');for(let i=0;i<32;i++)c.simulation.tick(.25);c.simulation.start();for(let i=0;i<720;i++){c.simulation.tick(.25);c.game.career.advance(c.simulation);}c.update();`);
    await ready('c.game.career.current.status==="ready"', 'Actual plant verifies assignment');
    const verifiedTasks=await checkTasks('Verified assignment overlay');
    assert.ok(verifiedTasks.items.every(n=>n.done==='true' && n.marker==='✓'), 'Verified steps show completion marks');
    await screenshot('phone-assignment-verified');
    await tap('[data-mobile-open="analysis"]');
    assert.equal(await consoleCode('return !s.querySelector(".game-tasks").hidden && [...s.querySelectorAll(".game-task-list li")].every(n=>n.dataset.complete==="true");'), true);
    await close(); await tap('[data-mobile-open="company"]');
    await tap('[data-game-tab="assignments"]'); await tap('.game-page [data-game-action="report"]');
    await ready('c.game.career.state.achievements.length===1 && !c.game.busy', 'Phone reports verified assignment');
    await tap('[data-game-tab="save"]'); await tap('.game-page [data-game-action="return"]');
    await ready('!c.game.career && !c.game.busy', 'Phone saves and returns to free operation');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'Free operation removes the assignment overlay');
    if (await consoleCode('return !!c.mobileLayout.current;')) await close();

    await area('turbine');
    await ready('!!c.equipmentStations.scenes.get("turbine")', 'Turbine station built before fallback');
    await consoleCode('c.equipmentStations.scenes.get("turbine").renderer.domElement.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));');
    await ready('s.querySelector("#turbine-panel .station-part-list").dataset.mobileInline==="true"', 'WebGL loss reveals inline native parts immediately');
    await tap('#turbine-panel [data-station-part="admission"]');
    assert.equal(await consoleCode('return s.querySelector("[data-component-dialog=turbine]").matches(":popover-open");'), true);
    await close(); await tap('.mobile-back');

    await consoleCode('c.setOverview("schematic");');
    await tap('[data-mobile-open="more"]');
    assert.equal(await consoleCode('return s.querySelector("[data-mobile-equipment-fallback]").hidden;'), false, 'Native equipment access remains available without the 3D overview');
    await tap('[data-mobile-action="core-view"]');
    assert.equal(await consoleCode('return c.mobileLayout.current===s.getElementById("core-map-window");'), true, 'Fallback access opens the core map');
    await close(); await tap('[data-mobile-open="more"]'); await tap('[data-mobile-tab="electrical"]');
    assert.equal(await consoleCode('return c.plantTab;'), 'electrical', 'Fallback equipment navigation opens the electrical station');
    await tap('.mobile-home');
    await tap('[data-mobile-open="more"]'); await tap('[data-action="overview-3d"]'); await close();

    // Rotation cancels open panels and restores desktop DOM and preferences.
    await tap('[data-mobile-open="operator"]'); await viewport(390, 844);
    assert.equal(await consoleCode('return c.mobileLayout.active;'), false);
    assert.equal(await consoleCode('return s.querySelector(".operator-column").hasAttribute("popover");'), false);
    assert.equal(await consoleCode('return !!s.querySelector(".masthead .automation-strip") && !!s.querySelector(".console-footer [data-action=pause]");'), true);
    assert.equal(await consoleCode('return s.querySelector("#plant-instruments > .grid-dispatch-panel")===window.mobileGridController && !window.mobileGridController.hasAttribute("popover") && s.querySelector(".overview-toolbar [data-action=spent-fuel]")===window.mobileSpentFuel;'), true, 'Rotation restores the original grid controller and spent-fuel button to desktop');
    assert.equal(await consoleCode('return localStorage.getItem("porssiohjain.nuclear-power.panels")===window.mobilePreferences;'), true);
    await viewport(1024, 768); assert.equal(await consoleCode('return c.mobileLayout.active;'), false, 'Tablet keeps its existing layout');
    await viewport(844, 390, false); assert.equal(await consoleCode('return c.mobileLayout.active;'), false, 'A small mouse desktop retains its layout');
    await viewport(844, 390);
    await consoleCode('window.mobileRetained=c;const p=c.parentElement;c.remove();p.append(c);');
    await ready('c.mobileLayout.active && !!c.overviewScene', 'Mobile detach/reconnect recreates the renderer');
    assert.equal(await consoleCode('return s.querySelectorAll(".mobile-header").length;'), 1);
    assert.equal(await consoleCode('return c.soundChoice.dialog.open;'), false, 'Reconnect does not repeat the sound question');
    await tap('[data-mobile-open="instruments"]'); await close();
    await viewport(1920, 1080, false);
    await consoleCode('c.setTheme("dark",false);c.setPlantTab("reactor");c.act("reset");');
    await waitForConsoleLayout(consoleCode, 'Desktop restored after mobile');
    assert.deepEqual(await consoleCode('return {...s.querySelector(".console-layout").dataset};'), await consoleCode('return window.mobilePanelState;'));
    assert.equal(await consoleCode('return c.mobileLayout.current;'), null);
}
