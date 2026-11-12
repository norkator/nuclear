/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

// Runs against the shipped app using the shared Chrome session and real pointer capture.
export async function checkGenerationConsoles({ consoleCode, action, input, page, advance, until, screenshot, warmOperatingPoint, resetWithoutDispatch }) {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const dialog = id => `[data-component-dialog="${id}"]`;
    const setting = id => `#${id}-generation-setting`;
    const select = (id, key) => consoleCode(`s.querySelector('${dialog(id)} [data-generation-select="${key}"]').click();`);
    const key = (id, part, key, shiftKey = false) => consoleCode(`s.querySelector('${dialog(id)} [data-generation-part="${part}"]').dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},shiftKey:${shiftKey},bubbles:true}));`);
    const requested = (id, key) => consoleCode(`return c.simulation.components.items.${id}.settings.${key};`);
    const actual = (id, key) => consoleCode(`return c.simulation.components.items.${id}.actual.${key};`);
    // Reduced motion freezes travel, while live heat/cooling may still change intensity.
    const motion = id => consoleCode(`return [...s.querySelectorAll('${dialog(id)} [data-generation-rotor], ${dialog(id)} [data-generation-drop], ${dialog(id)} [data-generation-steam], ${dialog(id)} [data-generation-flow]')].map(n=>[n.getAttribute('transform'),n.getAttribute('cx'),n.getAttribute('cy'),n.style.strokeDashoffset]);`);
    const valvePoint = id => consoleCode(`const r=s.querySelector('${dialog(id)} .generation-valve-body').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};`);
    const drag = async (id, dx, finish) => {
        const point = await valvePoint(id);
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + dx, y: point.y, button: 'left', buttons: 1 });
        await finish(point);
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + dx, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
    };

    await resetWithoutDispatch();
    await action('pause');
    for (const id of ['turbine', 'condenser']) {
        await consoleCode(`c.inspect('${id}');`);
        assert.equal(await consoleCode(`return s.querySelectorAll('${dialog(id)} input[type=number], ${dialog(id)} input[type=text]').length;`), 0);
        assert.equal(await consoleCode(`return s.querySelector('${setting(id)}').type;`), 'range');
        assert.ok(await consoleCode(`return s.querySelector('${dialog(id)} .generation-console').getBoundingClientRect().width > 0;`));
    }
    assert.equal(await actual('turbine', 'shaftSpeed'), 0);
    assert.ok(await consoleCode(`return [...s.querySelectorAll('${dialog('condenser')} [data-generation-drop]')].every(n=>Number(n.getAttribute('opacity'))===0);`));
    const coldTurbine = await motion('turbine'), coldCondenser = await motion('condenser');
    await wait(150);
    assert.deepEqual(await motion('turbine'), coldTurbine);
    assert.deepEqual(await motion('condenser'), coldCondenser);
    await consoleCode(`c.closeFloatingDialog(s.querySelector('${dialog('condenser')}'));`);

    await key('turbine', 'governorResponse', 'ArrowRight');
    assert.equal(await requested('turbine', 'governorResponse'), 2.1);
    await key('turbine', 'governorResponse', 'ArrowUp', true);
    assert.equal(await requested('turbine', 'governorResponse'), 3.1);
    await key('turbine', 'governorResponse', 'Home');
    assert.equal(await requested('turbine', 'governorResponse'), .1);
    await key('turbine', 'governorResponse', 'End');
    assert.equal(await requested('turbine', 'governorResponse'), 30);
    await input(setting('turbine'), 2);
    await key('turbine', 'loadRamp', 'Home');
    assert.equal(await requested('turbine', 'loadRamp'), 1);
    await key('turbine', 'loadRamp', 'End');
    assert.equal(await requested('turbine', 'loadRamp'), 400);
    await select('turbine', 'admission');
    await input(setting('turbine'), 60);
    await drag('turbine', 36, async () => {
        assert.equal(await requested('turbine', 'admission'), 60, 'Dragging previews without sending a command');
        assert.equal(await consoleCode(`return c.generationUI.turbine.preview;`), 80);
    });
    assert.equal(await requested('turbine', 'admission'), 80);
    assert.equal(await actual('turbine', 'admission'), 100, 'Actual admission does not jump to its request');
    assert.notEqual(await consoleCode(`return s.querySelector('${dialog('turbine')} [data-generation-request]').getAttribute('transform');`), await consoleCode(`return s.querySelector('${dialog('turbine')} [data-generation-valve]').getAttribute('transform');`));
    await drag('turbine', -36, async () => {
        await consoleCode(`c.closeFloatingDialog(s.querySelector('${dialog('turbine')}'));`);
    });
    assert.equal(await requested('turbine', 'admission'), 80, 'Closing cancels the pending drag');
    assert.equal(await consoleCode('return c.generationUI.turbine.preview;'), null);
    await consoleCode(`c.inspect('turbine');`);
    await input(setting('turbine'), 100);
    // A cancelled native slider preview must not survive reopening either.
    await consoleCode(`const n=s.querySelector('${setting('turbine')}');n.value=20;n.dispatchEvent(new Event('input',{bubbles:true}));c.closeFloatingDialog(s.querySelector('${dialog('turbine')}'));c.inspect('turbine');`);
    assert.equal(await requested('turbine', 'admission'), 100);
    assert.equal(await consoleCode(`return s.querySelector('${setting('turbine')}').value;`), '100');

    await consoleCode(`s.querySelector('#turbine-generator-breaker').click();`);
    assert.equal(await requested('turbine', 'breaker'), false);
    assert.equal(await consoleCode(`return s.querySelector('#turbine-generator-breaker').disabled;`), true, 'Cold shaft blocks breaker closing');
    await consoleCode(`s.querySelector('${dialog('turbine')} [data-component-action=trip]').click();`);
    assert.equal(await actual('turbine', 'tripped'), true);
    assert.equal(await consoleCode(`return s.querySelector('${setting('turbine')}').disabled;`), true);
    await key('turbine', 'admission', 'End');
    assert.equal(await requested('turbine', 'admission'), 0, 'Keyboard cannot bypass a latched turbine trip');
    assert.equal(await consoleCode(`return s.querySelector('${dialog('turbine')} [data-component-action=start]').disabled;`), true);
    await consoleCode(`s.querySelector('${dialog('turbine')} [data-component-action=reset]').click();`);
    assert.equal(await actual('turbine', 'tripped'), false);
    assert.equal(await requested('turbine', 'admission'), 0);
    assert.equal(await requested('turbine', 'breaker'), false);
    assert.equal(await consoleCode('return c.simulation.running;'), false);
    await consoleCode(`s.querySelector('${dialog('turbine')} [data-component-action=start]').click();c.closeFloatingDialog(s.querySelector('${dialog('turbine')}'));c.inspect('condenser');`);

    await key('condenser', 'inletTemperature', 'End');
    assert.equal(await requested('condenser', 'inletTemperature'), 60);
    assert.equal(await actual('condenser', 'inletTemperature'), 20);
    await key('condenser', 'inletTemperature', 'Home');
    assert.equal(await requested('condenser', 'inletTemperature'), 0);
    await input(setting('condenser'), 20);
    await select('condenser', 'coolingValve');
    await input(setting('condenser'), 60);
    await drag('condenser', 36, async () => {
        assert.equal(await requested('condenser', 'coolingValve'), 60);
        assert.equal(await consoleCode('return c.generationUI.condenser.preview;'), 80);
    });
    assert.equal(await requested('condenser', 'coolingValve'), 80);
    await drag('condenser', -36, async () => {
        await consoleCode(`const d=c.generationUI.condenser.drag;d.node.dispatchEvent(new PointerEvent('pointercancel',{pointerId:d.pointer,bubbles:true}));`);
    });
    assert.equal(await requested('condenser', 'coolingValve'), 80, 'Pointer cancellation discards the condenser preview');
    await input(setting('condenser'), 100);
    await consoleCode(`s.querySelector('${dialog('condenser')} [data-generation-step="-5"]').click();`);
    assert.equal(await requested('condenser', 'coolingValve'), 95);
    await input(setting('condenser'), 100);

    await warmOperatingPoint();
    await action('pause');
    await advance(15);
    await consoleCode(`c.inspect('turbine');`);
    assert.equal(await consoleCode(`return s.querySelector('#turbine-generator-breaker').disabled;`), false);
    assert.equal(await requested('turbine', 'breaker'), false, 'Automation never closes the breaker');
    await consoleCode(`s.querySelector('#turbine-generator-breaker').click();`);
    await advance(6);
    assert.ok(await consoleCode('return c.simulation.electricalOutput;') > 1);
    const turning = await motion('turbine');
    await until(`document.querySelector('nuclear-power-console').shadowRoot.querySelector('[data-generation-rotor="turbine"]').getAttribute('transform') !== ${JSON.stringify(await consoleCode(`return s.querySelector('[data-generation-rotor="turbine"]').getAttribute('transform');`))}`, 'Turbine rotor did not advance');
    assert.notDeepEqual(await motion('turbine'), turning);
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const id of ['turbine', 'condenser']) {
        await consoleCode(`c.closeFloatingDialog(s.querySelector('${dialog(id === 'turbine' ? 'condenser' : 'turbine')}'));c.inspect('${id}');`);
        const layout = await consoleCode(`const d=s.querySelector('${dialog(id)}'),b=d.querySelector('.equipment-dialog-body');return {right:d.querySelector('.generation-console').getBoundingClientRect().right,trend:d.querySelector('.component-trends').getBoundingClientRect().left,width:b.clientWidth,scrollWidth:b.scrollWidth,height:b.clientHeight,scrollHeight:b.scrollHeight};`);
        assert.ok(layout.trend >= layout.right, 'Local trends sit beside the cutaway');
        assert.ok(layout.scrollWidth <= layout.width, 'The dialog fits its viewport');
        assert.ok(layout.scrollHeight <= layout.height + 1, `${id} default view fits without vertical scrolling: ${JSON.stringify(layout)}`);
        await screenshot(`equipment-${id}-dark`);
        await consoleCode('c.setTheme("light");');
        await screenshot(`equipment-${id}-light`);
        await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
        assert.ok(await consoleCode(`const b=s.querySelector('${dialog(id)} .equipment-dialog-body');return b.scrollWidth<=b.clientWidth;`), 'Horizontal scrolling stays inside the cutaway');
        await select(id, id === 'turbine' ? 'governorResponse' : 'inletTemperature');
        await input(setting(id), id === 'turbine' ? 3 : 25);
        assert.equal(await requested(id, id === 'turbine' ? 'governorResponse' : 'inletTemperature'), id === 'turbine' ? 3 : 25);
        await screenshot(`equipment-${id}-mobile`);
        await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        await consoleCode('c.setTheme("dark");');
    }
    assert.ok(await consoleCode(`return [...s.querySelectorAll('${dialog('condenser')} [data-generation-drop]')].some(n=>Number(n.getAttribute('opacity'))>0);`), 'Warm cooling produces condensate');
    await consoleCode(`c.inspect('turbine');`);
    await action('pause');
    const pausedTurbine = await motion('turbine'), pausedCondenser = await motion('condenser');
    await wait(200);
    assert.deepEqual(await motion('turbine'), pausedTurbine);
    assert.deepEqual(await motion('condenser'), pausedCondenser);
    await action('pause');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await until(`document.querySelector('nuclear-power-console').animationFrame === null`, 'Reduced motion freezes generation cutaways');
    const reducedTurbine = await motion('turbine'), reducedCondenser = await motion('condenser');
    await wait(250);
    assert.deepEqual(await motion('turbine'), reducedTurbine);
    assert.deepEqual(await motion('condenser'), reducedCondenser);
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await consoleCode(`s.querySelector('#turbine-generator-breaker').click();`);
    assert.equal(await consoleCode('return c.simulation.electricalOutput;'), 0);
    assert.ok(await actual('turbine', 'shaftSpeed') > 0);
    assert.equal(await consoleCode(`return s.querySelector('${dialog('turbine')} .generation-electric-flow').style.opacity;`), '0');
    await action('stop');
    assert.ok(await actual('turbine', 'shaftSpeed') > 0, 'Stop preserves shaft coast-down');
    const coasting = await motion('turbine');
    await until(`document.querySelector('nuclear-power-console').shadowRoot.querySelector('[data-generation-rotor="turbine"]').getAttribute('transform') !== ${JSON.stringify(await consoleCode(`return s.querySelector('[data-generation-rotor="turbine"]').getAttribute('transform');`))}`, 'Turbine coast-down did not advance');
    assert.notDeepEqual(await motion('turbine'), coasting);
    await consoleCode(`c.closeFloatingDialog(s.querySelector('${dialog('turbine')}'));c.closeFloatingDialog(s.querySelector('${dialog('condenser')}'));`);
    const closed = await motion('turbine');
    await wait(150);
    assert.deepEqual(await motion('turbine'), closed, 'Closed windows stop rendering');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
}
