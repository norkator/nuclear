/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { poweredSimulation } from './plant-fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation, CORE_CHANNELS } from '../src/simulation/nuclear-power-model.js';
import { CompanyCareer } from '../src/simulation/nuclear-power-missions.js';
import { FuelTransferAnimation } from '../src/simulation/nuclear-power-refuelling.js';
import { captureCareer, restoreCareerBundle } from '../src/simulation/nuclear-power-game-save.js';
import { captureSessionState, restoreSessionState, remoteSimulation } from '../src/simulation/nuclear-power-session-state.js';
import { applySessionCommand } from '../src/simulation/nuclear-power-session-protocol.js';
import { ComputerRackScene } from '../src/simulation/nuclear-power-computers-scene.js';
import { PlantComputers } from '../src/simulation/nuclear-power-computers-model.js';

function advance(sim, seconds) { for (let index = 0; index < seconds * 4; index++) sim.tick(.25); }
function operating() {
    const sim = poweredSimulation(); sim.setGridDispatchEnabled(false);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 8); sim.start(); advance(sim, 140);
    return sim;
}
const bundle = (sim, career = new CompanyCareer()) => captureCareer(sim, new FuelTransferAnimation(CORE_CHANNELS), career);

test('instrument server starts OFF, boots on plant time and requires the network independently of process duty', () => {
    const sim = new NuclearPowerSimulation(), systems = sim.computers;
    assert.equal(systems.instrumentsAvailable, false);
    assert.equal(sim.setComputerEnabled('instrumentServer', true), false, 'Cold server needs actual power');
    sim.supply.setGrid(sim, true);
    for (const id of ['rackCooling', 'rackSwitch', 'instrumentServer']) assert.ok(sim.setComputerEnabled(id, true));
    advance(sim, 4); assert.equal(systems.instrumentsAvailable, false);
    sim.togglePause(); advance(sim, 20); assert.equal(systems.units.instrumentServer.bootRemaining, 1);
    sim.togglePause(); advance(sim, 1);
    assert.equal(systems.instrumentsAvailable, true);
    assert.equal(systems.automationAvailable, false, 'Instrument server cannot replace a process server');
    assert.equal(sim.selectProcessServer('instrumentServer'), false);
    sim.setComputerEnabled('rackSwitch', false);
    assert.equal(systems.instrumentsAvailable, false);
    sim.setComputerEnabled('rackSwitch', true); advance(sim, 5);
    assert.equal(systems.instrumentsAvailable, true);
    sim.setComputerEnabled('serverA', true); advance(sim, 5);
    sim.setComputerEnabled('instrumentServer', false);
    assert.equal(systems.instrumentsAvailable, false);
    assert.equal(systems.automationAvailable, true, 'Instrument outage leaves regulation independent');
});

test('instrument server rides UPS, retains faults and supports explicit hardware service and online proof', () => {
    const sim = poweredSimulation(), systems = sim.computers;
    sim.supply.generators.forEach(generator => { generator.automatic = false; });
    sim.supply.setGrid(sim, false); advance(sim, 5);
    assert.equal(systems.source, 'UPS'); assert.equal(systems.instrumentsAvailable, true);
    advance(sim, 120); assert.equal(systems.instrumentsAvailable, false);
    sim.supply.setGrid(sim, true); advance(sim, 2);
    assert.equal(systems.instrumentsAvailable, false, 'Power restoration needs a fresh boot');
    advance(sim, 5); assert.equal(systems.instrumentsAvailable, true);
    systems.units.instrumentServer.fault = true; advance(sim, 1);
    assert.equal(systems.instrumentsAvailable, false);
    sim.setComputerEnabled('instrumentServer', false);
    const order = sim.createWorkOrder('instrumentServer');
    for (const action of ['isolate', 'service', 'release']) assert.ok(sim.workOrderAction(order.id, action));
    assert.ok(sim.setComputerEnabled('instrumentServer', true));
    advance(sim, 4); assert.equal(order.held, 0);
    advance(sim, 11); assert.equal(order.status, 'ready');
    assert.ok(sim.workOrderAction(order.id, 'complete'));
    assert.equal(systems.instrumentsAvailable, true);
    assert.equal(systems.units.instrumentServer.services, 1);
});

test('redundant servers preserve actual Auto generation; total computing loss holds targets without tripping', () => {
    const sim = operating(), systems = sim.computers;
    assert.equal(systems.activeServer, 'serverA');
    assert.ok(sim.selectProcessServer('serverB')); assert.equal(systems.activeServer, 'serverB');
    assert.ok(sim.setComputerEnabled('serverA', false)); advance(sim, 30);
    assert.equal(systems.automationAvailable, true);
    assert.ok(Math.abs(sim.electricalOutput - 200) <= 5);
    sim.setGridDispatchEnabled(true);
    sim.setComputerEnabled('serverB', false);
    const targets = sim.controlRods.map(rod => rod.target), speed = sim.pumpASpeed, countdown = sim.gridDispatch.remaining;
    advance(sim, 10);
    assert.equal(systems.automationAvailable, false); assert.equal(sim.tripped, false); assert.equal(sim.running, true);
    assert.deepEqual(sim.controlRods.map(rod => rod.target), targets); assert.equal(sim.pumpASpeed, speed);
    assert.equal(sim.gridDispatch.remaining, countdown);
    assert.match(sim.regulationLimit, /computers unavailable/);
    sim.setAutoMode(false); sim.setLoad(35); advance(sim, 15);
    assert.ok(sim.power < 40, 'Independent Manual controls still operate the plant');
    sim.trip(); assert.equal(sim.tripped, true); assert.equal(sim.running, false);
});

test('boot readiness needs actual plant time, and restore never resets trips or overrides Hard policy', () => {
    const sim = poweredSimulation();
    sim.setComputerEnabled('serverA', false); sim.setComputerEnabled('serverB', false);
    assert.equal(sim.setAutoMode(true), false);
    sim.setComputerEnabled('serverA', true);
    assert.equal(sim.computers.units.serverA.online, false);
    advance(sim, 2); const remaining = sim.computers.units.serverA.bootRemaining;
    sim.togglePause(); advance(sim, 30); assert.equal(sim.computers.units.serverA.bootRemaining, remaining);
    sim.togglePause(); sim.trip(); advance(sim, 4);
    assert.equal(sim.computers.units.serverA.online, true); assert.equal(sim.tripped, true); assert.equal(sim.running, false);
    sim.autoAllowed = false; sim.setAutoMode(false);
    assert.equal(applySessionCommand(sim, { method: 'setAutoMode', args: [true] }), false);
    assert.equal(sim.autoMode, false);
});

test('rack UPS bridges AC loss without powering pumps and expires/recharges only on the plant clock', () => {
    const sim = poweredSimulation();
    sim.supply.generators.forEach(generator => { generator.automatic = false; });
    sim.togglePump('A'); advance(sim, 10);
    sim.supply.setGrid(sim, false); advance(sim, 15);
    assert.equal(sim.computers.source, 'UPS'); assert.equal(sim.computers.automationAvailable, true);
    assert.ok(sim.computers.charge < 100); assert.ok(sim.components.items.pumpA.actual.speed < .5);
    sim.togglePause(); const charge = sim.computers.charge; advance(sim, 200); assert.equal(sim.computers.charge, charge);
    sim.togglePause(); advance(sim, 110);
    assert.equal(sim.computers.source, 'OFF'); assert.equal(sim.computers.automationAvailable, false);
    sim.supply.setGrid(sim, true); advance(sim, 2);
    assert.equal(sim.computers.automationAvailable, false, 'Restored AC does not skip boot');
    advance(sim, 5); assert.equal(sim.computers.automationAvailable, true);
    assert.ok(sim.computers.charge > 0); assert.equal(sim.running, false);
});

test('blocked cooling causes retained hardware faults and lost automation, never reactor emergency shutdown', () => {
    const sim = operating();
    sim.computers.filterLoad = 100;
    let peak = sim.computers.rackTemperature;
    for (let index = 0; index < 320; index++) { advance(sim, 1); peak = Math.max(peak, sim.computers.rackTemperature); }
    assert.ok(peak > 50);
    assert.ok(sim.computers.units.serverA.fault); assert.ok(sim.computers.units.serverB.fault);
    assert.equal(sim.computers.automationAvailable, false); assert.equal(sim.tripped, false);
    assert.ok(sim.diagnoseComputer('serverA'));
    assert.equal(sim.computers.diagnostics.at(-1).healthy, false);
    sim.computers.filterLoad = 0; advance(sim, 200);
    assert.equal(sim.computers.units.serverA.fault, true, 'Cooling never silently clears a hardware fault');
    assert.equal(sim.computers.automationAvailable, false);
});

test('server maintenance uses redundancy, real isolation, boot and functional proof while plant state is preserved', () => {
    const sim = operating();
    const order = sim.createWorkOrder('serverA');
    assert.equal(sim.workOrderAction(order.id, 'isolate'), false);
    sim.setComputerEnabled('serverA', false); advance(sim, 1);
    assert.equal(sim.computers.activeServer, 'serverB');
    assert.ok(sim.workOrderAction(order.id, 'isolate'));
    assert.equal(sim.setComputerEnabled('serverA', true), false);
    const retained = { heat: sim.condition.heatReserve, fuel: structuredClone(sim.fuel.assemblies), starts: sim.startSequence };
    assert.equal(sim.computers.service(sim, 'serverA', 'wrong-order'), false);
    assert.ok(sim.workOrderAction(order.id, 'service'));
    assert.equal(sim.condition.heatReserve, retained.heat); assert.deepEqual(sim.fuel.assemblies, retained.fuel);
    assert.equal(sim.startSequence, retained.starts); assert.equal(sim.running, true); assert.equal(sim.tripped, false);
    assert.ok(sim.workOrderAction(order.id, 'release'));
    sim.setComputerEnabled('serverA', true); advance(sim, 4);
    assert.equal(order.held, 0, 'Power request and boot do not count as functional proof');
    advance(sim, 12); assert.equal(order.status, 'ready');
    assert.ok(sim.workOrderAction(order.id, 'complete'));
    assert.equal(sim.computers.units.serverA.services, 1);
    assert.equal(sim.computers.activeServer, 'serverA');
});

test('network, UPS and cooling service have separate readiness and cannot bypass work orders', () => {
    const sim = operating();
    sim.setComputerEnabled('rackSwitch', false);
    const network = sim.createWorkOrder('rackSwitch');
    assert.equal(sim.workOrderAction(network.id, 'isolate'), false, 'Network work needs explicit Manual or a stopped plant');
    sim.setAutoMode(false); assert.ok(sim.workOrderAction(network.id, 'isolate'));
    const cold = poweredSimulation(); cold.computers.filterLoad = 85;
    const cooling = cold.createWorkOrder('rackCooling');
    cold.setComputerEnabled('rackCooling', false);
    assert.equal(cold.workOrderAction(cooling.id, 'isolate'), false, 'Fan request alone is not coast-down');
    advance(cold, 10);
    assert.ok(cold.workOrderAction(cooling.id, 'isolate')); assert.ok(cold.workOrderAction(cooling.id, 'service'));
    assert.equal(cold.computers.filterLoad, 0); assert.ok(cold.workOrderAction(cooling.id, 'release'));
    cold.setComputerEnabled('rackCooling', true); advance(cold, 16);
    assert.equal(cooling.status, 'ready');
    cold.workOrderAction(cooling.id, 'complete');
    const ups = cold.createWorkOrder('rackUps'); cold.setComputerEnabled('rackUps', false);
    cold.computers.acAvailable = false;
    assert.equal(cold.workOrderAction(ups.id, 'isolate'), false);
});

test('schema-2 and schema-1 saves migrate without changing old progress, difficulty, heat or sampled rotor data', () => {
    const sim = operating(), career = new CompanyCareer(); career.accept(sim);
    const current = bundle(sim, career), source = structuredClone(current);
    source.schemaVersion = 2; delete source.plant.computers;
    const restored = restoreCareerBundle(source);
    assert.deepEqual(restored.state, source.career);
    assert.equal(restored.simulation.condition.heatReserve, sim.condition.heatReserve);
    assert.equal(restored.simulation.components.turbineIntegrity.strength, sim.components.turbineIntegrity.strength);
    assert.deepEqual(restored.simulation.computers, new PlantComputers(), 'Legacy careers retain the original powered healthy rack');
    source.schemaVersion = 1; delete source.plant.autoAllowed; delete source.plant.work; delete source.plant.water;
    delete source.career.difficulty;
    const oldest = restoreCareerBundle(source);
    assert.equal(oldest.state.difficulty, 'easy'); assert.equal(oldest.simulation.computers.automationAvailable, true);
    assert.deepEqual(oldest.state.assignments[0].definition, career.current.definition);
});

test('partial boot, diagnostics, UPS inventory and work proof hydrate exactly; malformed computer saves are rejected', () => {
    const sim = poweredSimulation(); sim.computers.charge = 42; sim.computers.filterLoad = 30;
    sim.diagnoseComputer('serverB'); sim.setComputerEnabled('serverB', false);
    const order = sim.createWorkOrder('serverB');
    for (const action of ['isolate', 'service', 'release']) assert.ok(sim.workOrderAction(order.id, action));
    sim.setComputerEnabled('serverB', true); advance(sim, 3);
    const source = bundle(sim), restored = restoreCareerBundle(source), career = new CompanyCareer(restored.state);
    assert.deepEqual(bundle(restored.simulation, career), source);
    advance(sim, 5); advance(restored.simulation, 5);
    assert.deepEqual(bundle(restored.simulation, career), bundle(sim, career));
    for (const mutate of [b => { b.plant.computers.charge = -1; }, b => { b.plant.computers.preferredServer = 'bad'; },
        b => { b.plant.computers.units.serverA.bootRemaining = 100; }, b => { b.plant.computers.diagnostics[0].id = 'bad'; },
        b => { delete b.plant.computers; }, b => { delete b.plant.computers.units.instrumentServer; }]) { const invalid = structuredClone(source); mutate(invalid); assert.throws(() => restoreCareerBundle(invalid)); }
});

test('schema-3 migration adds only the instrument server and preserves exact paused, damaged and active career state', () => {
    const sim = operating(), career = new CompanyCareer(); career.accept(sim);
    sim.trip(); sim.togglePause(); sim.computers.units.serverB.fault = true;
    sim.computers.units.serverB.online = false; sim.computers.charge = 37;
    const current = bundle(sim, career), source = structuredClone(current);
    source.schemaVersion = 3; delete source.plant.computers.units.instrumentServer;
    const restored = restoreCareerBundle(source), saved = bundle(restored.simulation, new CompanyCareer(restored.state));
    const expected = structuredClone(current);
    expected.plant.computers.units.instrumentServer = new PlantComputers().units.instrumentServer;
    assert.deepEqual(saved, expected);
    assert.equal(source.plant.computers.units.instrumentServer, undefined, 'Migration never mutates its input');
    assert.equal(saved.schemaVersion, 4);
    const cold = bundle(new NuclearPowerSimulation()); cold.schemaVersion = 3;
    delete cold.plant.computers.units.instrumentServer;
    const oldCold = restoreCareerBundle(cold).simulation;
    assert.equal(oldCold.computers.units.instrumentServer.online, false);
    assert.equal(oldCold.computers.instrumentsAvailable, false);
    assert.equal(oldCold.paused, false);
});

test('companion hydration retains computer methods and status but cannot service or toggle rack equipment', () => {
    const host = poweredSimulation(); host.setComputerEnabled('rackSwitch', false); advance(host, 1);
    const copy = restoreSessionState(captureSessionState(host));
    assert.equal(copy.computers.automationAvailable, false); assert.equal(typeof copy.computers.status, 'function');
    assert.equal(copy.computers.instrumentsAvailable, false);
    host.setComputerEnabled('rackSwitch', true); advance(host, 5);
    restoreSessionState(captureSessionState(host), copy);
    assert.equal(copy.computers.instrumentsAvailable, true);
    host.setComputerEnabled('instrumentServer', false);
    restoreSessionState(captureSessionState(host), copy);
    assert.equal(copy.computers.instrumentsAvailable, false);
    const sent = [], remote = remoteSimulation(copy, command => sent.push(command));
    remote.setComputerEnabled('rackSwitch', true); remote.diagnoseComputer('serverA'); remote.selectProcessServer('serverB');
    assert.equal(copy.computers.units.rackSwitch.enabled, true); assert.equal(sent.length, 0);
    host.setComputerEnabled('rackSwitch', false);
    assert.equal(applySessionCommand(host, { method: 'setAutoMode', args: [true] }), false);
    applySessionCommand(host, { method: 'setAutoMode', args: [false] }); assert.equal(host.autoMode, false);
    applySessionCommand(host, { method: 'trip', args: [] }); assert.equal(host.tripped, true);
});

test('rack renderer skips hidden work and disposes GPU resources and observers once', () => {
    let draws = 0, geometries = 0, materials = 0, aborts = 0, disconnects = 0, renderer = 0;
    const view = Object.assign(Object.create(ComputerRackScene.prototype), { disposed: false, visible: false,
        width: 300, host: { hidden: false }, renderer: { render() { draws++; }, dispose() { renderer++; }, domElement: { remove() {} } },
        geometries: new Set([{ dispose() { geometries++; } }]), materials: new Set([{ dispose() { materials++; } }]),
        abort: { abort() { aborts++; } }, observer: { disconnect() { disconnects++; } } });
    view.render(); assert.equal(draws, 0);
    view.dispose(); view.dispose();
    assert.deepEqual([geometries, materials, aborts, disconnects, renderer], [1, 1, 1, 1, 1]);
});
