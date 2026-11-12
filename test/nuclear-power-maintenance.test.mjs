/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { maintenanceItems } from '../src/simulation/nuclear-power-maintenance.js';

test('maintenance consolidates damage, wear and fouling without counting temporary stress or fuel depletion', () => {
    const sim = new NuclearPowerSimulation();
    assert.deepEqual(maintenanceItems(sim), []);
    sim.condition.components.B.stress = 80;
    sim.fuel.assemblies[0].remaining = 0;
    assert.deepEqual(maintenanceItems(sim), []);
    sim.condition.components.A.damage = .05;
    sim.components.items.pumpA.wear = 14;
    sim.components.items.exchanger.settings.fouling = 25;
    sim.components.items.turbine.wear = 7;
    sim.condition.zones[0].damage = 18;
    sim.condition.zones[1].damage = 30;
    const items = maintenanceItems(sim);
    assert.equal(items.length, 4);
    assert.deepEqual(items.find(item => item.id === 'reactor'), { id: 'reactor', damage: 30, zones: 2 });
    assert.deepEqual(items.find(item => item.id === 'pumpA'), { id: 'pumpA', damage: .05, wear: 14, fouling: 0 });
    assert.equal(items.find(item => item.id === 'exchanger').fouling, 25);
    assert.equal(items.some(item => item.id === 'pumpB'), false);
});

test('maintenance readiness and repair share running, fault, temperature and meltdown guards', () => {
    const cases = [
        ['stopped', sim => { sim.running = true; }],
        ['faults', sim => sim.injectFault('primary-restriction')],
        ['faults', sim => sim.componentAction('condenser', 'fault')],
        ['coolant', sim => { sim.temperature = 150; }],
        ['fuel', sim => { sim.condition.zones[0].temperature = 200; }],
        ['meltdown', sim => { sim.condition.meltdown = true; }]
    ];
    for (const [id, change] of cases) {
        const sim = new NuclearPowerSimulation();
        sim.components.items.pumpA.wear = 20;
        change(sim);
        const readiness = sim.condition.repairReadiness(sim);
        assert.equal(readiness.ready, false, id);
        assert.equal(readiness.checks.find(check => check.id === id).ready, false, id);
        sim.repairComponents();
        assert.equal(sim.components.items.pumpA.wear, 20, id);
    }
});

test('repairing the maintenance list clears every retained issue while preserving heat, fuel, settings and trips', () => {
    const sim = new NuclearPowerSimulation();
    sim.trip();
    sim.condition.heatReserve = 12;
    sim.condition.components.A.damage = 5;
    sim.condition.zones[0].damage = 8;
    sim.components.items.exchanger.wear = 6;
    sim.components.items.exchanger.settings.fouling = 20;
    sim.components.items.pumpB.wear = 9;
    sim.components.items.turbine.hours = 42;
    sim.components.items.turbine.actual.tripped = true;
    sim.components.items.turbine.settings.breaker = false;
    const fuel = structuredClone(sim.fuel);
    const rods = structuredClone(sim.controlRods);
    assert.equal(sim.condition.repairReadiness(sim).ready, true);
    assert.equal(maintenanceItems(sim).length, 4);
    sim.repairComponents();
    assert.deepEqual(maintenanceItems(sim), []);
    assert.equal(sim.condition.heatReserve, 12);
    assert.deepEqual(structuredClone(sim.fuel), fuel);
    assert.deepEqual(sim.controlRods, rods);
    assert.equal(sim.tripped, true);
    assert.equal(sim.running, false);
    assert.equal(sim.components.items.turbine.actual.tripped, true);
    assert.equal(sim.components.items.turbine.settings.breaker, false);
    assert.equal(sim.components.items.turbine.hours, 42);
});

test('any number of cooled, non-melted damaged core channels can be repaired before fuel replacement', () => {
    for (const count of [1, 6, 12]) {
        const sim = new NuclearPowerSimulation();
        sim.trip();
        for (const [index, zone] of sim.condition.zones.slice(0, count).entries()) zone.damage = 10 + index;
        assert.equal(maintenanceItems(sim).find(item => item.id === 'reactor').zones, count);
        assert.equal(sim.fuel.replacementReadiness(sim).ready, false);
        assert.equal(sim.condition.repairReadiness(sim).ready, true);
        sim.repairComponents();
        assert.equal(sim.condition.zones.some(zone => zone.damage > 0), false);
        assert.equal(sim.fuel.replacementReadiness(sim).ready, true);
        assert.equal(sim.tripped, true);
        assert.equal(sim.running, false);
    }
});
