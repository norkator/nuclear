/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';
import { waitForConsoleLayout } from './console-layout.browser.mjs';

// Shared by the focused company journey and the full browser regression. Exercise
// actual plant commands/time; never replace mission evidence or force readiness.
export async function checkAssignmentExpansion({ consoleCode, action, advance, acceptNext, reportNext, gameAction, ready, screenshot }) {
    const command = code => consoleCode(`${code}c.update();`);
    const expected = async id => assert.equal(await consoleCode('return c.game.career.current.definition.id;'), id);
    const follow = enabled => command(`const control=s.querySelector('#follow-grid');control.checked=${enabled};control.dispatchEvent(new Event('change',{bubbles:true}));`);
    const proveOrder = async id => {
        assert.ok(await consoleCode(`const order=c.simulation.createWorkOrder('${id}');c.update();return !!order;`));
        for (const stage of ['isolate', 'service', 'release']) assert.ok(await consoleCode(`const order=c.simulation.work.current('${id}');const result=c.simulation.workOrderAction(order.id,'${stage}');c.update();return result;`), `${id}: ${stage}`);
    };
    const returnOrder = async id => {
        assert.equal(await consoleCode(`return c.simulation.work.current('${id}').status;`), 'ready');
        assert.equal(await consoleCode('return c.game.career.current.status;'), 'active', 'A service test still requires explicit return');
        assert.ok(await consoleCode(`const order=c.simulation.work.current('${id}');return c.simulation.workOrderAction(order.id,'complete');`));
        await advance(2); await reportNext();
    };
    const original = await consoleCode('return {reports:c.game.career.state.assignments.slice(0,8),achievements:c.game.career.state.achievements.slice(0,8)};');
    await expected('pumps.acceptance-tests'); await acceptNext();
    await action('stop'); await advance(600);
    await action('pumpA'); await action('pumpB'); await advance(15);
    for (const key of ['A', 'A2', 'B', 'B2']) {
        await action(`pump${key}`); await advance(16); await action(`pump${key}`); await advance(15);
    }
    await action('pumpA'); await action('pumpB'); await advance(8); await reportNext();

    await expected('grid.first-contract'); await acceptNext(); await follow(true); await action('start');
    assert.equal(await consoleCode('return s.querySelector("[data-action=grid-request]").disabled;'), true);
    await advance(120);
    assert.match(await consoleCode('return s.querySelector(".game-task-timer").textContent;'), /Qualifying time/);
    assert.equal(await consoleCode('return s.querySelector(".game-task-hold").hidden;'), false);
    await advance(1500); await reportNext();

    await expected('operation.low-demand'); await acceptNext(); await follow(false);
    await command('c.simulation.setElectricalTarget(100);c.simulation.setAutoTargets(330,100);');
    await advance(450); await reportNext();
    for (const [id, main, backup] of [['pumps.primary-backup', 'A', 'A2'], ['pumps.secondary-backup', 'B', 'B2']]) {
        await expected(id); await acceptNext(); await action('stop'); await advance(600);
        await action(`pump${main}`); await advance(15); await action(`pump${backup}`); await advance(16);
        assert.equal(await consoleCode('return c.game.career.current.status;'), 'active');
        await action(`pump${backup}`); await advance(15); await action(`pump${main}`); await advance(8); await reportNext();
    }

    await expected('diesel.standby-proof'); await acceptNext();
    for (const id of ['A', 'B']) {
        await command(`c.simulation.supply.command(c.simulation,'${id}','start');`); await advance(19);
        await command(`c.simulation.supply.command(c.simulation,'${id}','stop');c.simulation.supply.command(c.simulation,'${id}','auto');`);
    }
    await advance(2); await reportNext();

    await expected('computers.redundancy-check'); await acceptNext();
    await command('for(const id of Object.keys(c.simulation.computers.units))c.simulation.diagnoseComputer(id);');
    await advance(2); await reportNext();
    for (const [id, unit] of [['computers.server-service', 'serverA'], ['computers.ups-service', 'rackUps'], ['computers.cooling-service', 'rackCooling']]) {
        await expected(id); await acceptNext();
        await command(`c.simulation.setComputerEnabled('${unit}',false);`); await advance(20);
        await proveOrder(unit);
        await command(`c.simulation.setComputerEnabled('${unit}',true);`); await advance(20); await returnOrder(unit);
    }

    await expected('exchanger.planned-clean'); await acceptNext();
    await action('pumpA'); await action('pumpB'); await advance(15); await proveOrder('exchanger');
    await action('pumpA'); await action('pumpB'); await advance(8); await action('start'); await advance(150);
    await returnOrder('exchanger');

    await expected('turbine.service-window'); await acceptNext(); await action('stop');
    await command("c.simulation.components.setSetting('turbine','breaker',false);"); await advance(600); await proveOrder('turbine');
    await command("c.simulation.components.action('turbine','start');"); await action('start'); await advance(180);
    assert.ok(await consoleCode("return c.simulation.components.setSetting('turbine','breaker',true);"));
    await advance(180); await returnOrder('turbine');

    await expected('operation.high-demand'); await acceptNext();
    await command('c.simulation.setElectricalTarget(250);c.simulation.setAutoTargets(330,100);');
    await advance(450); await reportNext();

    await expected('fuel.selective-outage'); await acceptNext();
    const fuelIds = await consoleCode('return c.game.career.current.evidence.targets.map(item=>item.id);');
    assert.equal(fuelIds.length, 2); assert.notEqual(fuelIds[0], fuelIds[1]);
    assert.ok(await consoleCode('return c.game.career.current.evidence.targets.every(item=>s.querySelector(`.game-task-list [data-step="spent-${item.id}"]`));'));
    await advance(30);
    const fuelBefore = await consoleCode('return c.game.career.current.evidence;');
    await gameAction('return'); await ready('!c.game.career', 'Selective fuel work saved');
    await gameAction('continue'); await ready('c.game.career && !c.game.busy', 'Selective fuel work continued');
    assert.deepEqual(await consoleCode('return c.game.career.current.evidence.targets.map(item=>item.id);'), fuelIds);
    assert.deepEqual(await consoleCode('return c.game.career.current.evidence.targets.map(item=>item.replacements);'), fuelBefore.targets.map(item => item.replacements));
    await gameAction('close'); await advance(500);
    assert.ok(await consoleCode('return c.game.career.current.evidence.targets.every(item=>item.depleted);'));
    await action('stop'); await advance(600);
    for (const id of fuelIds) assert.ok(await consoleCode(`return c.simulation.replaceFuel('${id}');`));
    await advance(2); await reportNext();

    await expected('maintenance.warned-pump-failure'); await acceptNext();
    const incident = await consoleCode('return c.game.career.current.evidence;');
    await action('start'); await advance(65);
    assert.ok(await consoleCode('return c.game.career.current.evidence.failedAt!==null;'));
    await action(incident.backup); await action(incident.pump); await advance(25);
    assert.equal(await consoleCode('return c.game.career.current.evidence.backupProven;'), true);
    await action('stop'); await advance(600); await proveOrder(incident.pump);
    await action(incident.backup); await advance(15); await action(incident.pump); await advance(20);
    assert.ok(await consoleCode(`return c.simulation.workOrderAction(c.simulation.work.current('${incident.pump}').id,'complete');`));
    await action('start'); await advance(180); await reportNext();

    await expected('grid.load-following'); await acceptNext(); await follow(true); await advance(120);
    await waitForConsoleLayout(consoleCode, 'Extended assignment checklist');
    assert.ok(await consoleCode('const panel=s.querySelector(".game-tasks");return panel.scrollWidth<=panel.clientWidth;'));
    await screenshot('career-extended-grid-shift');
    await advance(3400); await reportNext();
    assert.equal(await consoleCode('return c.game.career.state.achievements.length;'), 24);
    assert.equal(await consoleCode('return c.game.career.current;'), undefined);
    assert.deepEqual(await consoleCode('return {reports:c.game.career.state.assignments.slice(0,8),achievements:c.game.career.state.achievements.slice(0,8)};'), original,
        'Every original completion and achievement survives the entire continuation');
}
