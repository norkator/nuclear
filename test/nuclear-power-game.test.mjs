/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation, CORE_CHANNELS } from '../src/simulation/nuclear-power-model.js';
import { FuelTransferAnimation } from '../src/simulation/nuclear-power-refuelling.js';
import { assignmentSteps, CompanyCareer, MISSIONS, validateMissionCatalogue } from '../src/simulation/nuclear-power-missions.js';
import { captureCareer, restoreCareerBundle } from '../src/simulation/nuclear-power-game-save.js';

function advance(sim, career, seconds) {
    for (let i = 0; i < seconds * 4; i++) { sim.tick(.25); career.advance(sim); }
}
function startup(sim, career) {
    sim.setGridDispatchEnabled(false);
    sim.togglePump('A'); sim.togglePump('B');
    advance(sim, career, 6); sim.start();
}
function firstReport() {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    career.accept(sim); startup(sim, career); advance(sim, career, 150);
    assert.equal(career.current.status, 'ready');
    assert.ok(career.report(sim));
    return { sim, career };
}

test('assignment steps appear after acceptance and use actual circulation and post-acceptance startup evidence', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    const steps = () => Object.fromEntries(assignmentSteps(career.current, sim).map(step => [step.id, step.done]));
    assert.deepEqual(assignmentSteps(career.current, sim), []);
    startup(sim, career); advance(sim, career, 120);
    career.accept(sim);
    assert.equal(steps().start, false, 'Starting before acceptance cannot complete the startup step');
    assert.equal(steps().circulation, true);
    assert.equal(steps().regulation, true);
    assert.equal(steps().hold, false);
    const state = structuredClone(career.state);
    assignmentSteps(career.current, sim);
    assert.deepEqual(career.state, state, 'Rendering never changes saved evidence or grants hold time');
    sim.stop(); advance(sim, career, 20); sim.start(); advance(sim, career, 150);
    assert.equal(career.current.status, 'ready');
    assert.ok(Object.values(steps()).every(Boolean));
    sim.stop(); sim.setGridDispatchEnabled(true);
    assert.ok(Object.values(steps()).every(Boolean), 'Verified steps stay complete after plant changes');
    career.report(sim);
    assert.deepEqual(assignmentSteps(career.current, sim), [], 'New work stays hidden until accepted');

    const cold = new NuclearPowerSimulation(), freshCareer = new CompanyCareer();
    freshCareer.accept(cold);
    cold.togglePump('A'); cold.togglePump('B');
    assert.equal(assignmentSteps(freshCareer.current, cold).find(step => step.id === 'circulation').done, false,
        'Requested pump switches alone do not prove circulation');
});

test('assignment steps retain pinned terms and restore partial progress without marking the hold complete', () => {
    const { sim, career } = firstReport();
    career.accept(sim); advance(sim, career, 40);
    const transfer = new FuelTransferAnimation(CORE_CHANNELS);
    const restored = restoreCareerBundle(captureCareer(sim, transfer, career));
    const changed = structuredClone(MISSIONS);
    changed[1].objective.targetMw = 240; changed[1].objective.seconds = 600;
    const resumed = new CompanyCareer(restored.state, changed);
    assert.equal(resumed.current.held, career.current.held);
    const steps = assignmentSteps(resumed.current, restored.simulation);
    assert.match(steps.find(step => step.id === 'hold').label, /200 ± 5 MW for 5 min/);
    assert.equal(steps.find(step => step.id === 'hold').done, false);
    assert.ok(steps.filter(step => step.id !== 'hold').every(step => step.done));
    restored.simulation.stop(); advance(restored.simulation, resumed, 1);
    assert.equal(resumed.current.held, 0);
    assert.equal(assignmentSteps(resumed.current, restored.simulation).find(step => step.id === 'start').done, false);
});

test('company issues work without starting equipment and accepts verified reports once', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    assert.equal(career.state.messages[0].sender, 'Elena Ward · Plant manager');
    assert.equal(sim.running, false);
    advance(sim, career, 200);
    assert.equal(career.current.held, 0);
    assert.equal(career.report(sim), false);
    assert.ok(career.accept(sim));
    startup(sim, career); advance(sim, career, 150);
    assert.equal(career.current.status, 'ready');
    assert.ok(career.report(sim));
    assert.equal(career.report(sim), false);
    assert.equal(career.state.achievements.length, 1);
    assert.equal(career.current.definition.id, 'operation.reliable-five');
});

test('startup evidence must follow acceptance and blocked or repeated starts do not count', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    sim.start(); assert.equal(sim.startSequence, 0);
    startup(sim, career); advance(sim, career, 120);
    career.accept(sim); sim.start(); advance(sim, career, 90);
    assert.equal(sim.startSequence, 1);
    assert.equal(career.current.held, 0);
    sim.stop(); advance(sim, career, 20); sim.start(); advance(sim, career, 150);
    assert.equal(career.current.status, 'ready');
});

test('reliability requires five continuous actual minutes, freezes on pause and resets on Stop', () => {
    const { sim, career } = firstReport();
    career.accept(sim); advance(sim, career, 50);
    assert.ok(career.current.held >= 45);
    sim.togglePause(); const held = career.current.held;
    advance(sim, career, 600); assert.equal(career.current.held, held);
    sim.togglePause(); sim.stop(); advance(sim, career, 1);
    assert.equal(career.current.held, 0);
    advance(sim, career, 20); sim.start(); advance(sim, career, 450);
    assert.equal(career.current.status, 'ready'); career.report(sim);
    assert.equal(career.current, undefined);
    assert.equal(career.state.achievements.length, 2);
    assert.equal(career.state.assignments.filter(item => item.status === 'completed').length, 2);
});

test('new intermediate missions queue after active work and never revoke earned progress', () => {
    const { sim, career } = firstReport();
    career.accept(sim);
    const original = structuredClone(career.current.definition);
    const inserted = { ...structuredClone(MISSIONS[1]), id: 'cooling.readiness-inspection', order: 15,
        title: 'Condenser inspection', requires: ['commissioned'], grants: ['condenser-checked'] };
    const changed = structuredClone(MISSIONS);
    changed[1].requires.push('condenser-checked'); changed[1].objective.seconds = 999;
    const resumed = new CompanyCareer(career.state, [changed[0], inserted, changed[1]]);
    assert.deepEqual(resumed.current.definition, original, 'Issued terms stay pinned');
    advance(sim, resumed, 310); resumed.report(sim);
    assert.equal(resumed.current.definition.id, inserted.id);
    assert.ok(resumed.state.capabilities.includes('reliable-operation'));
    const messages = resumed.state.messages.length;
    resumed.reconcile(); resumed.reconcile();
    assert.equal(resumed.state.messages.length, messages);
    assert.equal(resumed.state.achievements.length, 2);
});

test('retired active definitions can finish and invalid prerequisite graphs fail authoring', () => {
    const { career } = firstReport();
    const restored = new CompanyCareer(career.state, []);
    assert.equal(restored.current.definition.id, 'operation.reliable-five');
    assert.throws(() => validateMissionCatalogue([MISSIONS[1]]), /prerequisites/);
    assert.throws(() => validateMissionCatalogue([MISSIONS[0], MISSIONS[0]]), /duplicate/);
});

test('full career restore preserves plant evolution, sampled tolerance, pool and objective evidence', () => {
    const { sim, career } = firstReport();
    career.accept(sim); advance(sim, career, 40);
    const transfer = new FuelTransferAnimation(CORE_CHANNELS);
    transfer.setPoolTime(sim.elapsed); transfer.start('FA-03', 3, true);
    const bundle = captureCareer(sim, transfer, career);
    const restored = restoreCareerBundle(JSON.parse(JSON.stringify(bundle)));
    const secondCareer = new CompanyCareer(restored.state);
    assert.deepEqual(captureCareer(restored.simulation, restored.transfer, secondCareer), bundle);
    assert.equal(restored.simulation.condition.pipes, restored.simulation.hydraulics.pipes);
    assert.equal(restored.simulation.components.items.turbine.integrity, restored.simulation.components.turbineIntegrity);
    advance(sim, career, 30); advance(restored.simulation, secondCareer, 30);
    assert.deepEqual(captureCareer(restored.simulation, restored.transfer, secondCareer), captureCareer(sim, transfer, career));
});

test('saved heat, component damage and trip latches survive hydration', () => {
    const { sim, career } = firstReport();
    sim.condition.zones[2].damage = 7;
    sim.condition.components.A.parts.bearings = 12;
    sim.trip(); sim.components.items.turbine.actual.tripped = true;
    const restored = restoreCareerBundle(captureCareer(sim, new FuelTransferAnimation(CORE_CHANNELS), career));
    assert.equal(restored.simulation.tripped, true);
    assert.equal(restored.simulation.components.items.turbine.actual.tripped, true);
    assert.equal(restored.simulation.condition.zones[2].damage, 7);
    assert.equal(restored.simulation.condition.components.A.parts.bearings, 12);
    assert.equal(restored.simulation.condition.heatReserve, sim.condition.heatReserve);
});

test('foreign, incomplete and mismatched saves fail before replacing the live plant', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer(), transfer = new FuelTransferAnimation(CORE_CHANNELS);
    const source = captureCareer(sim, transfer, career);
    for (const change of [bundle => { bundle.schemaVersion = 99; }, bundle => { delete bundle.plant.condition; },
        bundle => { bundle.plant.controlRods[0].id = 'wrong'; }, bundle => { bundle.transfer.samples.pop(); },
        bundle => { bundle.plant.temperature = Infinity; }, bundle => { bundle.career.assignments.push(bundle.career.assignments[0]); },
        bundle => { bundle.transfer.samples[0] = 'broken'; }, bundle => { bundle.career.messages[0].body = null; },
        bundle => { bundle.career.assignments[0].definition.objective.targetMw = '200'; }]) {
        const bundle = structuredClone(source); change(bundle); assert.throws(() => restoreCareerBundle(bundle));
    }
});
