/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

export async function checkTurbineOverload({ consoleCode, action, input, page, advance, until, screenshot, warmOperatingPoint, resetWithoutDispatch }) {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const previousOverview = await consoleCode('return c.overviewMode;');
    await resetWithoutDispatch(); await action('manual'); await action('overview-3d');
    await warmOperatingPoint();
    await consoleCode('c.simulation.setFluctuations(false);c.simulation.setLoad(92);');
    await advance(30);
    assert.equal(await consoleCode('return s.querySelector(".electrical-metric").dataset.integrity;'), 'warning');
    assert.equal(await consoleCode('return c.simulation.components.turbineIntegrity.damage;'), 0);
    await screenshot('turbine-near-rated-load');
    await consoleCode('c.inspect("turbine");s.querySelector("[data-generation-select=generatorLoading]").click();');
    await input('#turbine-generation-setting', 160);
    assert.equal(await consoleCode('return c.simulation.components.items.turbine.settings.generatorLoading;'), 160);
    await advance(12);
    const output = await consoleCode('return c.simulation.electricalOutput;');
    assert.ok(output > 410, `Actual output can exceed the former hard cap: ${output}`);
    assert.equal(await consoleCode('return s.querySelector(".electrical-metric").dataset.integrity;'), 'danger');
    await advance(15);
    assert.ok(await consoleCode('return c.simulation.electricalOutput;') < output, 'Broken blades reduce actual MW despite unchanged requests');
    assert.ok(await consoleCode('return c.simulation.components.turbineIntegrity.bladesLost;') > 0);
    assert.equal(await consoleCode('return c.simulation.tripped;'), false, 'Turbine damage never presses reactor emergency shutdown');
    assert.ok(await consoleCode('return c.overviewScene.turbineFragments.count;') > 0);
    assert.equal(await consoleCode('return c.overviewScene.turbineBlades.instanceMatrix.array[0];'), 0, 'Fractured 3D blades disappear from the rotor');
    assert.ok(await consoleCode('return [...s.querySelectorAll("[data-generation-blade]")].some(n=>n.style.visibility==="hidden");'));
    const fragment = () => consoleCode('return s.querySelector("[data-generation-fragment]").getAttribute("transform");');
    const before = await fragment();
    await until(`document.querySelector('nuclear-power-console').shadowRoot.querySelector('[data-generation-fragment]').getAttribute('transform') !== ${JSON.stringify(before)}`, 'Broken blades did not move');
    assert.notEqual(await fragment(), before, 'Broken blades animate away through the shared frame loop');
    await screenshot('turbine-blades-breaking-dark');
    await consoleCode('c.setTheme("light");'); await screenshot('turbine-blades-breaking-light');
    await action('pause');
    const paused = await fragment(); await wait(150); assert.equal(await fragment(), paused);
    await action('pause');
    await action('overview-schematic');
    assert.ok(await consoleCode('return [...s.querySelectorAll("[data-turbine-fragment]")].some(n=>n.style.visibility==="visible");'));
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await until(`document.querySelector('nuclear-power-console').animationFrame === null`, 'Reduced motion did not freeze turbine fragments');
    const reduced = await fragment(); await wait(200); assert.equal(await fragment(), reduced);
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await consoleCode('c.closeFloatingDialog(s.querySelector("[data-component-dialog=turbine]"));c.simulation.components.turbineIntegrity.wear=26;c.update();');
    await action('overview-3d');
    await consoleCode('c.setPlantTab("maintenance");');
    assert.equal(await consoleCode('return s.querySelector("[data-maintenance-component=turbine]").hidden;'), false);
    assert.match(await consoleCode('return s.querySelector("[data-maintenance-component=turbine] .maintenance-issue").textContent;'), /service wear.*maintenance due/);
    await consoleCode('c.setPlantTab("reactor");c.simulation.stop();'); await advance(30);
    await action('pause');
    await consoleCode('const sim=c.simulation;sim.temperature=100;sim.condition.fuelTemperature=100;sim.condition.zones.forEach(z=>z.temperature=100);c.update();c.inspect("turbine");');
    const fuel = await consoleCode('return JSON.stringify(c.simulation.fuel);');
    await consoleCode('s.querySelector("[data-component-dialog=turbine] [data-component-action=repair]").click();');
    assert.equal(await consoleCode('return c.simulation.components.turbineIntegrity.damage;'), 0);
    assert.equal(await consoleCode('return c.simulation.components.turbineIntegrity.wear;'), 0);
    assert.equal(await consoleCode('return JSON.stringify(c.simulation.fuel);'), fuel);
    assert.equal(await consoleCode('return c.simulation.running;'), false);
    assert.equal(await consoleCode('return c.overviewScene.turbineFragments.count;'), 0);
    await consoleCode('c.closeFloatingDialog(s.querySelector("[data-component-dialog=turbine]"));c.setTheme("dark");');
    await resetWithoutDispatch();
    await action(`overview-${previousOverview}`);
}
