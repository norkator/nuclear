/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { formatNumber, formatPercent, formatReading, hasPlantMotion } from '../src/simulation/nuclear-power-presentation.js';

test('cached live-reading formatters preserve English grouping, precision and nonnumeric readings', () => {
    for (const value of [-1234.567, 0, .05, 123456.789]) {
        for (const decimals of [0, 1, 2]) assert.equal(formatNumber(value, decimals), value.toLocaleString('en-US', {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        }));
        assert.equal(formatPercent(value), `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);
        assert.equal(formatReading(value), value.toLocaleString('en-US', { maximumFractionDigits: 2 }));
    }
    assert.equal(formatReading(null), '—');
    assert.equal(formatReading('RUNNING'), 'RUNNING');
});

test('cold settings do not animate, but circulation, coast-down, retained heat, rod travel and diesels do', () => {
    const sim = new NuclearPowerSimulation();
    assert.equal(hasPlantMotion(sim), false);
    sim.pumpA = true; sim.pumpASpeed = 100;
    assert.equal(hasPlantMotion(sim), false, 'An enable request without actual rotation or flow stays still');
    for (const change of [
        s => { s.primaryFlow = 20; },
        s => { s.components.items.pumpB.actual.speed = 10; },
        s => { s.components.items.turbine.actual.shaftSpeed = 5; },
        s => { s.controlRods[0].target = 50; },
        s => { s.condition.zones[0].temperature = 180; },
        s => { s.condition.meltProgress = .1; },
        s => { s.supply.generators[0].state = 'STARTING'; },
        s => { s.supply.generators[1].state = 'RUNNING'; },
    ]) {
        const cold = new NuclearPowerSimulation(); change(cold);
        assert.equal(hasPlantMotion(cold), true);
    }
});

test('lightweight readings match full snapshots without cloning component histories', () => {
    const sim = new NuclearPowerSimulation();
    sim.togglePump('A'); sim.togglePump('B');
    for (let i = 0; i < 30; i++) sim.tick(.25);
    sim.start();
    for (let i = 0; i < 200; i++) sim.tick(.25);
    for (const change of [() => {}, () => sim.stop(), () => sim.trip()]) {
        change();
        const readings = sim.readings(), full = sim.snapshot();
        assert.deepEqual(readings, { elapsed: full.elapsed, status: full.status, signals: full.signals });
        // Non-cloneable history metadata must not be consulted by instrument reads.
        sim.components.items.pumpA.presentationProbe = () => {};
        assert.deepEqual(sim.readings(), readings);
        delete sim.components.items.pumpA.presentationProbe;
    }
});
