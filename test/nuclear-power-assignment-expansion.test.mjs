/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poweredSimulation } from './plant-fixtures.mjs';
import { CORE_CHANNELS } from '../src/simulation/nuclear-power-model.js';
import { FuelTransferAnimation } from '../src/simulation/nuclear-power-refuelling.js';
import { CompanyCareer, MISSIONS, assignmentSteps, validObjective, validateMissionCatalogue } from '../src/simulation/nuclear-power-missions.js';
import { captureCareer, restoreCareerBundle, CAREER_SAVE_VERSION } from '../src/simulation/nuclear-power-game-save.js';
import { COMPUTER_IDS } from '../src/simulation/nuclear-power-computers-model.js';
import { PUMPS } from '../src/simulation/nuclear-power-pumps.js';

const transfer = () => new FuelTransferAnimation(CORE_CHANNELS);
function advance(sim, career, seconds, operate = () => {}) {
    for (let i = 0; i < seconds * 4; i++) { operate(sim); sim.tick(.25); career?.advance(sim); }
}
function careerAt(id, sim, accept = true) {
    const definition = { ...structuredClone(MISSIONS.find(item => item.id === id)), requires: [] };
    assert.ok(definition.id, id);
    const career = new CompanyCareer(null, [definition], sim.autoAllowed ? 'easy' : 'hard');
    if (accept) career.accept(sim);
    return career;
}
function start(sim, career) {
    sim.setGridDispatchEnabled(false);
    if (!sim.pumpA) sim.togglePump('A');
    if (!sim.pumpB) sim.togglePump('B');
    advance(sim, career, 8); sim.start(); advance(sim, career, 150);
}
function roundTrip(sim, career) {
    const bundle = captureCareer(sim, transfer(), career);
    const restored = restoreCareerBundle(JSON.parse(JSON.stringify(bundle)));
    const resumed = new CompanyCareer(restored.state, career.catalogue);
    assert.deepEqual(captureCareer(restored.simulation, restored.transfer, resumed), bundle);
    return { sim: restored.simulation, career: resumed };
}
function service(sim, id) {
    const order = sim.createWorkOrder(id);
    assert.ok(order, id);
    for (const action of ['isolate', 'service', 'release']) assert.ok(sim.workOrderAction(order.id, action), `${id} ${action}: ${JSON.stringify(sim.work.readiness(sim, id))}`);
    return order;
}

test('the continuation keeps the eight original identities and adds sixteen reachable assignments', () => {
    assert.equal(MISSIONS.length, 24);
    assert.deepEqual(MISSIONS.slice(0, 8).map(item => item.id), ['startup.first-shift', 'operation.reliable-five',
        'monitoring.condition-rounds', 'maintenance.planned-service', 'water.quality-check', 'water.filter-service',
        'cooling.intake-service', 'operation.return-to-service']);
    validateMissionCatalogue(MISSIONS);
    for (const objective of [{ kind: 'pump-proof', seconds: 10, equipment: ['missing'], stopped: true, restoreMain: true },
        { kind: 'grid-following', seconds: 900, toleranceMw: 10, requests: -1 },
        { kind: 'fuel-selective', seconds: 1, count: 49, rate: 120 },
        { kind: 'pump-recovery', seconds: 60, warningSeconds: 0 }]) assert.equal(validObjective(objective), false);
});

test('schema-4 completed careers keep every original report and achievement and receive continuation work', () => {
    const sim = poweredSimulation(), old = new CompanyCareer(null, MISSIONS.slice(0, 8));
    const base = old.current;
    old.state.assignments = MISSIONS.slice(0, 8).map(definition => ({ ...structuredClone(base), definition: structuredClone(definition),
        status: 'completed', acceptedAt: 0, completedAt: 0, held: definition.objective.seconds }));
    old.state.capabilities = MISSIONS.slice(0, 8).flatMap(item => item.grants);
    old.state.achievements = MISSIONS.slice(0, 8).map(item => ({ id: item.id, title: item.achievement, version: item.version, time: 0, heldSeconds: item.objective.seconds }));
    const bundle = captureCareer(sim, transfer(), old); bundle.schemaVersion = 4;
    bundle.career.assignments.forEach(item => { delete item.evidence; });
    const source = structuredClone(bundle), restored = restoreCareerBundle(bundle), resumed = new CompanyCareer(restored.state);
    assert.deepEqual(bundle, source, 'Migration does not mutate the supplied save');
    assert.equal(resumed.current.definition.id, 'pumps.acceptance-tests');
    const expected = source.career.assignments.map(item => ({ ...item, evidence: null }));
    assert.deepEqual(resumed.state.assignments.slice(0, 8), expected);
    assert.deepEqual(resumed.state.achievements, source.career.achievements);
    assert.deepEqual(resumed.state.capabilities, source.career.capabilities);
    assert.equal(captureCareer(restored.simulation, restored.transfer, resumed).schemaVersion, CAREER_SAVE_VERSION);
    resumed.reconcile(); assert.equal(resumed.state.assignments.length, 9, 'Continuation issues once');
});

test('schema-4 active and ready terms survive migration and catalogue changes without resetting progress', () => {
    for (const status of ['active', 'ready']) {
        const sim = poweredSimulation(), career = new CompanyCareer(null, MISSIONS.slice(0, 8));
        career.accept(sim); start(sim, career);
        career.current.status = status;
        career.current.held = status === 'ready' ? 30 : 12;
        const bundle = captureCareer(sim, transfer(), career); bundle.schemaVersion = 4;
        delete bundle.career.assignments[0].evidence;
        const changed = structuredClone(MISSIONS); changed[0].objective.seconds = 999;
        const restored = restoreCareerBundle(bundle), resumed = new CompanyCareer(restored.state, changed);
        assert.deepEqual(resumed.current.definition, bundle.career.assignments[0].definition);
        assert.equal(resumed.current.status, status); assert.equal(resumed.current.held, career.current.held);
        if (status === 'ready') {
            assert.ok(resumed.report(restored.simulation));
            assert.equal(resumed.state.achievements.length, 1);
        }
    }
});

test('pump proofs require real independent operation, retain partial results on Continue and require duty restoration', () => {
    let sim = poweredSimulation(), career = careerAt('pumps.acceptance-tests', sim);
    sim.togglePump('A'); career.advance(sim);
    assert.equal(career.current.evidence.proofs.pumpA.held, 0, 'A requested switch is not proof');
    advance(sim, career, 16);
    assert.equal(career.current.evidence.proofs.pumpA.done, true);
    sim.togglePump('A'); advance(sim, career, 15);
    sim.togglePump('A2'); advance(sim, career, 16);
    ({ sim, career } = roundTrip(sim, career));
    assert.equal(career.current.evidence.proofs.pumpA.done, true);
    sim.togglePump('A2'); advance(sim, career, 15);
    for (const key of ['B', 'B2']) {
        sim.togglePump(key); advance(sim, career, 16); sim.togglePump(key); advance(sim, career, 15);
    }
    assert.equal(career.current.status, 'active', 'Proofs alone do not restore duty');
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, career, 8);
    assert.equal(career.current.status, 'ready');
    assert.ok(assignmentSteps(career.current, sim).every(item => item.done));
});

test('primary and secondary transfer missions verify their own backup and require main restoration', () => {
    for (const [id, main, backup] of [['pumps.primary-backup', 'A', 'A2'], ['pumps.secondary-backup', 'B', 'B2']]) {
        const sim = poweredSimulation(), career = careerAt(id, sim);
        sim.togglePump(backup); advance(sim, career, 16);
        assert.equal(career.current.status, 'active');
        assert.equal(career.current.evidence.proofs[`pump${backup}`].done, true);
        sim.togglePump(backup); advance(sim, career, 15); sim.togglePump(main); advance(sim, career, 8);
        assert.equal(career.current.status, 'ready');
    }
});

test('diesel proof observes real running time and ends with fuelled automatic standby on normal AC', () => {
    const sim = poweredSimulation(), career = careerAt('diesel.standby-proof', sim);
    for (const id of ['A', 'B']) {
        sim.supply.command(sim, id, 'start'); advance(sim, career, 7);
        assert.equal(career.current.evidence.proofs[id].held, 0);
        advance(sim, career, 11);
        sim.supply.command(sim, id, 'stop'); sim.supply.command(sim, id, 'auto');
        advance(sim, career, 1);
    }
    assert.equal(career.current.status, 'ready');
    assert.ok(sim.supply.generators.every(item => item.state === 'STANDBY'));
});

test('rack rounds reject old and unhealthy diagnostics and service assignments use actual work-order proof', () => {
    const sim = poweredSimulation(); COMPUTER_IDS.forEach(id => sim.diagnoseComputer(id));
    const career = careerAt('computers.redundancy-check', sim);
    advance(sim, career, 1); assert.equal(career.current.status, 'active');
    sim.setComputerEnabled('serverA', false); sim.diagnoseComputer('serverA');
    COMPUTER_IDS.filter(id => id !== 'serverA').forEach(id => sim.diagnoseComputer(id));
    advance(sim, career, 1); assert.equal(career.current.status, 'active');
    sim.setComputerEnabled('serverA', true); advance(sim, career, 5); sim.diagnoseComputer('serverA');
    advance(sim, career, 1); assert.equal(career.current.status, 'ready');
    for (const [mission, id] of [['computers.server-service', 'serverA'], ['computers.ups-service', 'rackUps'], ['computers.cooling-service', 'rackCooling']]) {
        const next = careerAt(mission, sim);
        sim.setComputerEnabled(id, false); advance(sim, next, 15);
        const order = service(sim, id);
        advance(sim, next, 12); assert.equal(next.current.status, 'active', 'OFF equipment does not prove its test');
        sim.setComputerEnabled(id, true); advance(sim, next, 20);
        assert.equal(order.status, 'ready');
        assert.equal(next.current.status, 'active', 'Explicit return is still required');
        sim.workOrderAction(order.id, 'complete'); advance(sim, next, 1);
        assert.equal(next.current.status, 'ready');
    }
});

test('low and high demand targets are reachable through actual Auto generation', () => {
    for (const [id, target] of [['operation.low-demand', 100], ['operation.high-demand', 250]]) {
        const sim = poweredSimulation(), career = careerAt(id, sim);
        sim.setElectricalTarget(target); sim.setAutoTargets(330, 100);
        start(sim, career); advance(sim, career, 400);
        assert.equal(career.current.status, 'ready', `${id}: ${career.current.reason}; ${sim.electricalOutput} MW`);
        assert.equal(career.current.held, 120);
    }
});

test('Auto dispatch earns actual delivery time across new requests, survives Continue and freezes when paused', () => {
    let sim = poweredSimulation(), career = careerAt('grid.first-contract', sim, false);
    start(sim, career); career.accept(sim); sim.setGridDispatchEnabled(true);
    assert.equal(sim.requestGridDispatch(), null, 'Request now cannot skip an exercise interval');
    advance(sim, career, 120);
    assert.ok(career.current.held > 0);
    ({ sim, career } = roundTrip(sim, career));
    const held = career.current.held, sequence = sim.gridDispatch.sequence;
    sim.togglePause(); advance(sim, career, 120);
    assert.equal(career.current.held, held); assert.equal(sim.gridDispatch.sequence, sequence);
    sim.togglePause(); sim.setGridDispatchEnabled(false); advance(sim, career, 30);
    assert.equal(career.current.held, held, 'Turning off following cannot earn time');
    sim.setGridDispatchEnabled(true); advance(sim, career, 1500);
    assert.equal(career.current.status, 'ready', career.current.reason);
    assert.equal(career.current.held, 180); assert.equal(career.current.evidence.requestIds.length, 3);
});

test('Hard grid requests are read-only, keep saved cadence and award Manual actual delivery', () => {
    let sim = poweredSimulation(); sim.autoAllowed = false; sim.setAutoMode(false); sim.setLoad(49);
    let career = careerAt('grid.first-contract', sim, false);
    start(sim, career); career.accept(sim); sim.setGridDispatchEnabled(true);
    const controls = () => ({ demand: sim.demand, rods: sim.controlRods.map(item => item.target),
        speeds: PUMPS.map(item => sim[`${item.id}Speed`]), core: sim.autoTemperature, mw: sim.autoElectricalTarget });
    const before = controls(); advance(sim, career, 46);
    assert.deepEqual(controls(), before, 'A Manual request writes no plant settings');
    assert.ok(sim.gridDispatch.lastRequest);
    assert.equal(sim.autoMode, false); assert.equal(sim.setAutoMode(true), false);
    ({ sim, career } = roundTrip(sim, career));
    assert.equal(sim.gridDispatch.manualRequests, true);
    const operate = plant => {
        const target = plant.gridDispatch.lastRequest?.targetMw;
        if (target != null) plant.setLoad(Math.max(0, Math.min(75, target / (4.1 * plant.fuel.capability))));
    };
    advance(sim, career, 1200, operate);
    assert.equal(career.current.status, 'ready', `${career.current.reason}; ${career.current.held}`);
    assert.equal(sim.autoMode, false);
});

test('the fifteen-minute exercise verifies 900 qualifying seconds rather than wall time or target changes', () => {
    const sim = poweredSimulation(), career = careerAt('grid.load-following', sim, false);
    start(sim, career); career.accept(sim); sim.setGridDispatchEnabled(true);
    advance(sim, career, 900);
    assert.ok(career.current.held < 900, 'Ramps outside tolerance do not count');
    advance(sim, career, 2700);
    assert.equal(career.current.status, 'ready', `${career.current.reason}; ${career.current.held}`);
    assert.equal(career.current.held, 900); assert.equal(career.current.evidence.requestIds.length, 10);
    sim.stop(); advance(sim, career, 1);
    assert.equal(career.current.status, 'ready', 'Verified delivery remains reportable');
});

test('selective fuel evidence pins random IDs, wears only those faster, requires depletion then replacement and survives reload', () => {
    let sim = poweredSimulation(), career = careerAt('fuel.selective-outage', sim, false);
    start(sim, career); career.accept(sim);
    const targets = career.current.evidence.targets.map(item => item.id);
    const old = new Map(sim.fuel.assemblies.map(item => [item.id, item.remaining]));
    advance(sim, career, 30);
    assert.equal(sim.fuel.rate, 1);
    assert.ok(sim.fuel.assemblies.filter(item => !targets.includes(item.id)).every(item => old.get(item.id) - item.remaining < 1));
    assert.ok(targets.every(id => old.get(id) - sim.fuel.assemblies.find(item => item.id === id).remaining > 1));
    ({ sim, career } = roundTrip(sim, career));
    assert.deepEqual(career.current.evidence.targets.map(item => item.id), targets);
    advance(sim, career, 500);
    assert.ok(career.current.evidence.targets.every(item => item.depleted));
    assert.equal(career.current.status, 'active');
    assert.equal(sim.fuel.replace(sim, targets[0]), false, 'Hot running replacement remains blocked');
    sim.stop(); advance(sim, career, 600);
    sim.fuel.replace(sim, sim.fuel.assemblies.find(item => !targets.includes(item.id)).id);
    advance(sim, career, 1); assert.equal(career.current.status, 'active', 'Wrong fuel cannot complete the assignment');
    for (const id of targets) assert.ok(sim.fuel.replace(sim, id));
    advance(sim, career, 1);
    assert.equal(career.current.status, 'ready');
    const reserve = targets.map(id => sim.fuel.assemblies.find(item => item.id === id).remaining);
    sim.start(); advance(sim, career, 10);
    assert.ok(targets.every((id, i) => reserve[i] - sim.fuel.assemblies.find(item => item.id === id).remaining < 1), 'Extra wear stops after depletion');
});

test('a warned failure waits for eligible operation, occurs once, requires backup proof and a new completed repair order', () => {
    let sim = poweredSimulation(), career = careerAt('maintenance.warned-pump-failure', sim);
    advance(sim, career, 100); assert.equal(career.current.evidence.failedAt, null, 'Cold plant does not fail');
    start(sim, null);
    advance(sim, career, 20);
    ({ sim, career } = roundTrip(sim, career));
    const { pump, backup } = career.current.evidence;
    sim.stop(); advance(sim, career, 20);
    assert.equal(career.current.evidence.failedAt, null);
    sim.start(); advance(sim, career, 30);
    assert.notEqual(career.current.evidence.failedAt, null);
    assert.equal(sim.condition.components[PUMPS.find(item => item.id === pump).key].parts.bearings, 100);
    sim.togglePump(PUMPS.find(item => item.id === backup).key);
    sim.togglePump(PUMPS.find(item => item.id === pump).key);
    advance(sim, career, 25);
    assert.equal(career.current.evidence.backupProven, true);
    const failedAt = career.current.evidence.failedAt;
    ({ sim, career } = roundTrip(sim, career));
    sim.stop(); advance(sim, career, 600);
    const order = service(sim, pump);
    sim.togglePump(PUMPS.find(item => item.id === backup).key); advance(sim, career, 15);
    sim.togglePump(PUMPS.find(item => item.id === pump).key); advance(sim, career, 20);
    assert.equal(order.status, 'ready'); assert.equal(career.current.status, 'active');
    sim.workOrderAction(order.id, 'complete');
    sim.components.setSetting('turbine', 'breaker', false); sim.start(); advance(sim, career, 120);
    assert.equal(career.current.held, 0, 'Running with no actual generation cannot prove return to generation');
    assert.ok(sim.components.setSetting('turbine', 'breaker', true)); advance(sim, career, 180);
    assert.equal(career.current.status, 'ready', career.current.reason);
    assert.equal(career.current.evidence.failedAt, failedAt);
    assert.equal(career.state.messages.filter(item => item.id.startsWith('failure:')).length, 1);
});

test('a cold restart establishes actual generation before the warned bearing clock advances', () => {
    const sim = poweredSimulation(), career = careerAt('maintenance.warned-pump-failure', sim);
    sim.setGridDispatchEnabled(false); sim.setElectricalTarget(250); sim.setAutoTargets(330, 100);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, career, 8);
    assert.equal(career.current.evidence.warned, 0);
    sim.start(); advance(sim, career, 65);
    assert.notEqual(career.current.evidence.failedAt, null, `${career.current.evidence.warned} eligible seconds; ${sim.electricalOutput} MW`);
});

test('malformed new objective evidence is rejected before hydration', () => {
    for (const [id, mutate] of [
        ['fuel.selective-outage', e => { e.targets[1].id = e.targets[0].id; }],
        ['maintenance.warned-pump-failure', e => { e.backup = e.pump; }],
        ['grid.first-contract', e => { e.requestIds = ['GC-999']; }],
        ['pumps.acceptance-tests', e => { e.proofs.pumpA.held = -1; }],
        ['computers.redundancy-check', e => { e.baselineDiagnostics = 999; }],
    ]) {
        const sim = poweredSimulation(), career = careerAt(id, sim), bundle = captureCareer(sim, transfer(), career);
        mutate(bundle.career.assignments[0].evidence);
        assert.throws(() => restoreCareerBundle(bundle), /assignment/);
    }
    const sim = poweredSimulation(), career = new CompanyCareer(), bundle = captureCareer(sim, transfer(), career);
    delete bundle.career.assignments[0].evidence;
    assert.throws(() => restoreCareerBundle(bundle), /assignment/, 'Missing schema-5 fields are not silently migrated');
});
