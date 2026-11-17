/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poweredSimulation } from './plant-fixtures.mjs';
import { AssignmentSoundTracker } from '../src/simulation/nuclear-power-game-audio.js';
import { CompanyCareer, MISSIONS } from '../src/simulation/nuclear-power-missions.js';

test('actual new steps sound once; requests, repeated updates and conditions returning to green stay quiet', () => {
    const sim = poweredSimulation(), career = new CompanyCareer(), sounds = new AssignmentSoundTracker();
    assert.equal(sounds.observe(career, sim), null);
    career.accept(sim); assert.equal(sounds.observe(career, sim), null, 'Accepting primes already satisfied steps');
    sim.setGridDispatchEnabled(false);
    assert.equal(sounds.observe(career, sim), 'step');
    assert.equal(sounds.observe(career, sim), null);
    sim.setGridDispatchEnabled(true); sounds.observe(career, sim);
    sim.setGridDispatchEnabled(false); assert.equal(sounds.observe(career, sim), null, 'Regained conditions cannot chatter');
    sim.togglePump('A'); sim.togglePump('B');
    assert.equal(sounds.observe(career, sim), null, 'Requested pumps are not actual circulation');
    for (let i = 0; i < 24; i++) sim.tick(.25);
    assert.equal(sounds.observe(career, sim), 'step', 'Multiple simultaneous steps coalesce');
    assert.equal(sounds.observe(career, sim), null);
});

test('verification sounds once before reporting, with completion priority; restoring active or ready work is silent', () => {
    const sim = poweredSimulation(), career = new CompanyCareer(), sounds = new AssignmentSoundTracker();
    career.accept(sim); sounds.reset(career, sim);
    sim.setGridDispatchEnabled(false); sim.togglePump('A'); sim.togglePump('B');
    for (let i = 0; i < 24; i++) { sim.tick(.25); career.advance(sim); }
    sim.start();
    for (let i = 0; i < 600; i++) { sim.tick(.25); career.advance(sim); }
    assert.equal(career.current.status, 'ready');
    assert.equal(sounds.observe(career, sim), 'complete', 'Final cue replaces newly green step cues');
    const before = structuredClone(career.state);
    assert.equal(sounds.observe(career, sim), null);
    assert.deepEqual(career.state, before, 'Observing cues cannot mutate saved progress');
    const restored = new CompanyCareer(career.state);
    assert.equal(sounds.observe(restored, sim), null);
    career.report(sim); assert.equal(sounds.observe(career, sim), null, 'Reporting cannot repeat verification');
    career.accept(sim); assert.equal(sounds.observe(career, sim), null, 'Next assignment is a fresh baseline');
    assert.equal(new AssignmentSoundTracker().observe(career, sim), null, 'Restored partial progress never replays');
    const fresh = new CompanyCareer(); fresh.accept(sim);
    assert.equal(sounds.observe(fresh, sim), null, 'Replacing a career cannot reuse the old sound history');
    assert.equal(sounds.observe(null, sim), null, 'Free operation never signals company work');
});

test('condition inspections and work-order stages use the issued objective evidence', () => {
    const sim = poweredSimulation();
    for (const mission of MISSIONS.filter(item => ['condition-rounds', 'work-order'].includes(item.objective.kind))) {
        const definition = structuredClone(mission); definition.requires = [];
        const career = new CompanyCareer(null, [definition]), sounds = new AssignmentSoundTracker();
        career.accept(sim); sounds.reset(career, sim);
        if (definition.objective.kind === 'condition-rounds') {
            assert.ok(sim.inspectEquipment('pumpA'));
        } else {
            assert.ok(sim.createWorkOrder(definition.objective.equipment));
        }
        assert.equal(sounds.observe(career, sim), 'step', mission.id);
        assert.equal(sounds.observe(career, sim), null);
    }
});
