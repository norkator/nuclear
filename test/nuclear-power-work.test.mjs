/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation, CORE_CHANNELS } from '../src/simulation/nuclear-power-model.js';
import { CompanyCareer, MISSIONS, assignmentSteps } from '../src/simulation/nuclear-power-missions.js';
import { FuelTransferAnimation } from '../src/simulation/nuclear-power-refuelling.js';
import { captureCareer, restoreCareerBundle } from '../src/simulation/nuclear-power-game-save.js';
import { MONITORED_EQUIPMENT } from '../src/simulation/nuclear-power-work.js';
import { applySessionCommand } from '../src/simulation/nuclear-power-session-protocol.js';
import { captureSessionState, restoreSessionState, remoteSimulation } from '../src/simulation/nuclear-power-session-state.js';

function advance(sim, seconds, career) {
    for (let i = 0; i < seconds * 4; i++) { sim.tick(.25); career?.advance(sim); }
}
function careerAt(id, sim = new NuclearPowerSimulation(), difficulty = 'easy') {
    const career = new CompanyCareer(null, MISSIONS, difficulty);
    const index = MISSIONS.findIndex(mission => mission.id === id);
    career.state.assignments = MISSIONS.slice(0, index).map(definition => ({ definition: structuredClone(definition), status: 'completed' }));
    career.state.capabilities = MISSIONS.slice(0, index).flatMap(mission => mission.grants);
    career.reconcile(); career.accept(sim);
    return career;
}
function service(sim, equipment) {
    const order = sim.createWorkOrder(equipment);
    assert.ok(order);
    for (const action of ['isolate', 'service', 'release']) assert.ok(sim.workOrderAction(order.id, action), `${equipment}: ${action}`);
    return order;
}
const capture = (sim, career) => captureCareer(sim, new FuelTransferAnimation(CORE_CHANNELS), career);

test('condition readings follow actual motion and retained condition; inspections do not repair equipment', () => {
    const sim = new NuclearPowerSimulation();
    const idle = sim.work.reading(sim, 'pumpA');
    assert.equal(idle.vibration, 0); assert.equal(idle.bearingTemperature, 30);
    sim.togglePump('A');
    assert.equal(sim.work.reading(sim, 'pumpA').vibration, 0, 'Requested start alone is not motion');
    advance(sim, 10);
    const healthy = sim.work.reading(sim, 'pumpA');
    sim.condition.components.A.parts.bearings = 20;
    sim.condition.components.A.damage = 20;
    assert.ok(sim.inspectEquipment('pumpA'));
    assert.ok(sim.work.inspections.pumpA.vibration > healthy.vibration);
    assert.ok(sim.work.inspections.pumpA.bearingTemperature > healthy.bearingTemperature);
    assert.equal(sim.work.inspections.pumpA.lubricant, 80);
    assert.equal(sim.condition.components.A.damage, 20);
    sim.togglePause(); const before = captureSessionState(sim); advance(sim, 10);
    assert.deepEqual(captureSessionState(sim), before);
});

test('work orders enforce real isolation, preserve state and block desktop/component/companion bypasses', () => {
    const sim = new NuclearPowerSimulation();
    sim.togglePump('A'); advance(sim, 10);
    const order = sim.createWorkOrder('pumpA');
    assert.equal(sim.createWorkOrder('pumpA'), false);
    assert.equal(sim.workOrderAction(order.id, 'service'), false);
    assert.equal(sim.workOrderAction(order.id, 'isolate'), false);
    sim.togglePump('A');
    assert.equal(sim.workOrderAction(order.id, 'isolate'), false, 'OFF request is not a stopped motor');
    advance(sim, 15);
    assert.ok(sim.workOrderAction(order.id, 'isolate'));
    sim.trip(); sim.condition.heatReserve = 12;
    sim.condition.components.A.parts.bearings = 8; sim.condition.components.A.damage = 8;
    const retained = { heat: sim.condition.heatReserve, fuel: structuredClone(sim.fuel.assemblies), hours: sim.components.items.pumpA.hours };
    sim.togglePump('A');
    applySessionCommand(sim, { method: 'setPumpEnabled', args: ['A', true] });
    assert.equal(sim.pumpA, false);
    assert.equal(sim.setComponentSetting('pumpA', 'dischargeValve', 30), false);
    assert.equal(sim.componentAction('pumpA', 'repair'), false);
    sim.repairComponents(); assert.equal(sim.condition.components.A.damage, 8);
    assert.ok(sim.workOrderAction(order.id, 'service'));
    assert.equal(sim.condition.components.A.damage, 0);
    assert.equal(sim.tripped, true); assert.equal(sim.running, false);
    assert.equal(sim.condition.heatReserve, retained.heat);
    assert.deepEqual(sim.fuel.assemblies, retained.fuel);
    assert.equal(sim.components.items.pumpA.hours, retained.hours);
    assert.ok(sim.work.locked('pumpA'));
    assert.ok(sim.workOrderAction(order.id, 'release'));
    assert.equal(sim.workOrderAction(order.id, 'complete'), false);
});

test('functional proof requires actual valid time, resets interrupted tests and freezes on pause', () => {
    const sim = new NuclearPowerSimulation(), order = service(sim, 'pumpA');
    advance(sim, 20); assert.equal(order.held, 0);
    sim.togglePump('A'); advance(sim, 7);
    assert.ok(order.held > 0 && order.held < 10);
    sim.togglePause(); const held = order.held; advance(sim, 100); assert.equal(order.held, held);
    sim.togglePause(); sim.togglePump('A'); advance(sim, 2);
    assert.equal(order.held, 0);
    sim.togglePump('A'); advance(sim, 20);
    assert.equal(order.status, 'ready');
    assert.ok(sim.workOrderAction(order.id, 'complete'));
    assert.equal(sim.workOrderAction(order.id, 'complete'), false);
    assert.equal(sim.running, false);
});

test('unrelated core repairs remain possible while a work order owns pump service', () => {
    const sim = new NuclearPowerSimulation();
    sim.condition.zones[0].damage = 10;
    sim.condition.components.A.parts.bearings = 8; sim.condition.components.A.damage = 8;
    sim.createWorkOrder('pumpA'); sim.trip();
    sim.repairComponents();
    assert.equal(sim.condition.coreDamage, 0);
    assert.equal(sim.condition.components.A.damage, 8, 'Bulk repair cannot bypass the managed service');
    assert.equal(sim.tripped, true);
    const order = sim.work.current('pumpA');
    for (const action of ['isolate', 'service', 'release']) assert.ok(sim.workOrderAction(order.id, action));
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 10); sim.resetTrip(); advance(sim, 12);
    assert.ok(sim.workOrderAction(order.id, 'complete'));
    assert.equal(sim.tripped, false); assert.equal(sim.running, false);
});

test('water treatment needs actual AC, recovers impurities without cleaning retained fouling and affects cooling', () => {
    const sim = new NuclearPowerSimulation();
    sim.water.conductivity = 10; sim.water.filterLoad = 10;
    sim.power = 20; sim.condition.heatReserve = 10;
    sim.components.items.exchanger.settings.fouling = 7;
    sim.water.intakeDebris = 60;
    sim.components.prepare(.25);
    assert.equal(sim.components.items.condenser.actual.coolingFactor, .5);
    sim.water.basinLevel = 12.5; sim.components.prepare(.25);
    assert.equal(sim.components.items.condenser.actual.coolingFactor, .25);
    sim.water.advance(sim, 1);
    assert.ok(sim.components.items.exchanger.settings.fouling > 7);
    const before = sim.water.conductivity;
    advance(sim, 80);
    assert.ok(sim.water.conductivity < before);
    assert.ok(sim.components.items.exchanger.settings.fouling >= 7);
    sim.supply.setGrid(sim, false); advance(sim, 1);
    assert.equal(sim.water.purification, 0); assert.equal(sim.water.makeup, 0);
    const sample = sim.sampleWater(); assert.equal(sample.conductivity, sim.water.conductivity);
});

test('filter and intake work require switched-off controls, keep isolation and prove actual restored operation', () => {
    const sim = new NuclearPowerSimulation();
    sim.water.filterLoad = 90;
    const filter = sim.createWorkOrder('waterFilter');
    assert.equal(sim.workOrderAction(filter.id, 'isolate'), false);
    sim.setWaterControl('purificationEnabled', false);
    assert.ok(sim.workOrderAction(filter.id, 'isolate'));
    assert.equal(sim.setWaterControl('purificationEnabled', true), false);
    assert.ok(sim.workOrderAction(filter.id, 'service')); assert.equal(sim.water.filterLoad, 0);
    assert.ok(sim.workOrderAction(filter.id, 'release'));
    sim.setWaterControl('purificationEnabled', true); advance(sim, 12);
    assert.ok(sim.workOrderAction(filter.id, 'complete'));
    sim.water.intakeDebris = 60;
    sim.setWaterControl('makeupEnabled', false);
    const intake = service(sim, 'intake');
    assert.equal(sim.water.intakeDebris, 0);
    sim.setWaterControl('makeupEnabled', true); sim.togglePump('B'); advance(sim, 15);
    assert.ok(sim.workOrderAction(intake.id, 'complete'));
});

test('new mission kinds require post-acceptance inspection, sample and completed-order evidence', () => {
    const sim = new NuclearPowerSimulation();
    MONITORED_EQUIPMENT.forEach(id => sim.inspectEquipment(id));
    const career = careerAt('monitoring.condition-rounds', sim);
    advance(sim, 2, career); assert.equal(career.current.held, 0);
    MONITORED_EQUIPMENT.forEach(id => sim.inspectEquipment(id));
    advance(sim, 1, career); assert.equal(career.current.status, 'ready');
    assert.ok(assignmentSteps(career.current, sim).every(step => step.done));
    career.report(sim); career.accept(sim);
    const order = service(sim, 'pumpA'); sim.togglePump('A'); advance(sim, 15, career);
    assert.equal(career.current.status, 'active', 'A proven test still requires explicit return to service');
    assert.ok(sim.workOrderAction(order.id, 'complete')); advance(sim, 1, career);
    assert.equal(career.current.status, 'ready'); career.report(sim);
    sim.sampleWater(); career.accept(sim); advance(sim, 15, career);
    assert.equal(career.current.held, 0, 'A sample taken before acceptance is not evidence');
    sim.sampleWater(); advance(sim, 11, career); assert.equal(career.current.status, 'ready');
});

test('hard Manual objectives accumulate qualifying actual output without losing progress or verified success', () => {
    const sim = new NuclearPowerSimulation(); sim.autoAllowed = false; sim.setAutoMode(false);
    const career = new CompanyCareer(null, MISSIONS, 'hard'); career.accept(sim);
    assert.equal(career.current.definition.objective.manualOnly, true);
    assert.equal(sim.setAutoMode(true), false);
    applySessionCommand(sim, { method: 'setAutoMode', args: [true] }); assert.equal(sim.autoMode, false);
    sim.setGridDispatchEnabled(false); sim.setLoad(49); sim.togglePump('A'); sim.togglePump('B');
    advance(sim, 8, career); sim.start(); advance(sim, 100, career);
    // Avoid prematurely finishing the 30 s brief: use a longer pinned manual test.
    assert.equal(career.current.status, 'ready');
    const completed = career.current;
    sim.stop(); sim.setLoad(0); advance(sim, 10, career);
    assert.equal(completed.status, 'ready'); assert.equal(completed.held, 30);
    career.report(sim); career.accept(sim);
    sim.setLoad(49); sim.start(); advance(sim, 100, career);
    assert.ok(career.current.held > 20 && career.current.held < 300);
    const held = career.current.held;
    sim.setLoad(30); advance(sim, 80, career);
    assert.ok(career.current.held >= held && career.current.held < 300, 'Missing the target pauses, never fails or erases Manual progress');
    const stored = career.current.held;
    sim.togglePause(); advance(sim, 100, career); assert.equal(career.current.held, stored);
    sim.togglePause(); sim.setLoad(49); advance(sim, 400, career);
    assert.equal(career.current.status, 'ready');
    assert.equal(career.current.held, 300);
});

test('version-1 migration preserves pinned terms, heat, damage, latches and achievements; later missions catch up', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    sim.condition.heatReserve = 15; sim.condition.zones[0].damage = 7; sim.trip();
    const source = capture(sim, career);
    source.schemaVersion = 1; delete source.plant.water; delete source.plant.work; delete source.plant.autoAllowed;
    delete source.career.difficulty;
    for (const assignment of source.career.assignments) {
        delete assignment.baselineInspections; delete assignment.baselineOrders; delete assignment.baselineSamples;
        delete assignment.definition.objective.manualAllowed;
    }
    const old = structuredClone(source), restored = restoreCareerBundle(source);
    assert.deepEqual(source, old, 'Import never mutates its input');
    assert.equal(restored.state.difficulty, 'easy');
    assert.equal(restored.simulation.condition.heatReserve, 15);
    assert.equal(restored.simulation.condition.coreDamage, 7); assert.equal(restored.simulation.tripped, true);
    assert.deepEqual(restored.state.assignments[0].definition, old.career.assignments[0].definition);
    assert.equal(restored.simulation.components.turbineIntegrity.strength, source.plant.components.turbineIntegrity.strength);
    const completed = new CompanyCareer();
    completed.state.assignments = MISSIONS.slice(0, 2).map(definition => ({ ...structuredClone(career.current),
        definition: structuredClone(definition), status: 'completed', held: definition.objective.seconds }));
    completed.state.capabilities = ['commissioned', 'reliable-operation'];
    completed.state.achievements = [{ id: 'startup.first-shift', title: 'First generation', time: 10, heldSeconds: 30 }];
    const caughtUp = new CompanyCareer(completed.state);
    assert.equal(caughtUp.current.definition.id, 'monitoring.condition-rounds');
    assert.deepEqual(caughtUp.state.achievements, completed.state.achievements);
});

test('partial work tests, water samples and Hard policy survive exact career and companion hydration', () => {
    const sim = new NuclearPowerSimulation(); sim.autoAllowed = false; sim.setAutoMode(false);
    const career = new CompanyCareer(null, MISSIONS, 'hard');
    const order = service(sim, 'pumpA'); sim.togglePump('A'); advance(sim, 6);
    sim.sampleWater(); sim.inspectEquipment('pumpA');
    const bundle = capture(sim, career), restored = restoreCareerBundle(bundle);
    assert.deepEqual(capture(restored.simulation, new CompanyCareer(restored.state)), bundle);
    advance(sim, 3); advance(restored.simulation, 3);
    assert.deepEqual(capture(restored.simulation, new CompanyCareer(restored.state)), capture(sim, career));
    assert.ok(order.held > 0);
    const copy = restoreSessionState(captureSessionState(sim)), remote = remoteSimulation(copy, () => true);
    assert.equal(copy.autoAllowed, false); assert.equal(copy.work.orders[0].held, order.held);
    assert.equal(typeof copy.water.advance, 'function'); assert.equal(typeof copy.work.locked, 'function');
    const before = captureSessionState(copy);
    remote.createWorkOrder('intake'); remote.workOrderAction(order.id, 'complete'); remote.setWaterControl('makeupEnabled', false); remote.sampleWater();
    assert.deepEqual(captureSessionState(copy), before, 'Companions cannot mutate desktop-owned maintenance records');
    for (const change of [b => { b.plant.water.basinLevel = -1; }, b => { b.plant.work.orders[0].equipment = 'wrong'; },
        b => { b.plant.work.orders[0].status = 'completed'; }, b => { b.plant.autoAllowed = true; }, b => { b.plant.autoMode = true; },
        b => { b.career.assignments[0].definition.objective.kind = 'unknown'; }]) {
        const invalid = structuredClone(bundle); change(invalid); assert.throws(() => restoreCareerBundle(invalid));
    }
});
