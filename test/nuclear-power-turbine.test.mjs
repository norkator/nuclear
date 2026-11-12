/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TurbineIntegrity, TURBINE_RATING_MW, advanceTurbineFragments } from '../src/simulation/nuclear-power-turbine.js';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { maintenanceItems } from '../src/simulation/nuclear-power-maintenance.js';

const run = (rotor, mw, seconds, speed = 100) => { for (let i = 0; i < seconds; i++) rotor.advance(mw, speed, 1); };

test('ordinary turbine wear is slow, requires rotation, and eventually calls for scheduled maintenance', () => {
    const rotor = new TurbineIntegrity(() => .5);
    run(rotor, 410, 3600, 0);
    assert.equal(rotor.wear, 0);
    run(rotor, 410, 3600);
    assert.ok(rotor.wear > 1.9 && rotor.wear < 2.1);
    assert.equal(rotor.damage, 0);
    assert.equal(rotor.serviceDue, false);
    run(rotor, 330, 17 * 3600);
    assert.equal(rotor.serviceDue, true);
    assert.ok(rotor.factor < 1);
});

test('overload accelerates wear and samples a different fracture point without per-frame randomness', () => {
    const weak = new TurbineIntegrity(() => 0), strong = new TurbineIntegrity(() => 1);
    assert.ok(weak.strength < strong.strength);
    const between = (weak.strength + strong.strength) / 2;
    run(weak, between, 30); run(strong, between, 30);
    assert.ok(weak.damage > 0);
    assert.equal(strong.damage, 0);
    const normal = new TurbineIntegrity(() => .5), overloaded = new TurbineIntegrity(() => .5);
    run(normal, TURBINE_RATING_MW, 60); run(overloaded, 620, 60);
    assert.ok(overloaded.wear > normal.wear * 30);
    assert.ok(overloaded.damage > 0);
    assert.ok(overloaded.bladesLost > 0);
    assert.equal(overloaded.fragments.length, overloaded.bladesLost);
    assert.equal(overloaded.level, 'danger');
});

test('blade loss progressively reduces actual MW to destruction without an automatic trip', () => {
    const sim = new NuclearPowerSimulation();
    const rotor = sim.components.turbineIntegrity, turbine = sim.components.items.turbine;
    Object.assign(sim, { running: true, power: 100, secondaryFlow: 100 });
    turbine.actual.shaftSpeed = 100; turbine.actual.generatorLoading = 160;
    const healthy = sim.electricalOutput;
    assert.ok(healthy > 410);
    run(rotor, healthy, 25);
    assert.ok(sim.electricalOutput > 0 && sim.electricalOutput < healthy);
    const damaged = sim.electricalOutput;
    run(rotor, healthy, 25);
    assert.ok(sim.electricalOutput < damaged);
    run(rotor, healthy, 300);
    assert.equal(rotor.damage, 100);
    assert.equal(rotor.bladesLost, 40);
    assert.equal(sim.electricalOutput, 0);
    assert.equal(sim.tripped, false);
    assert.equal(sim.components.damaged, true);
    assert.ok(maintenanceItems(sim).some(item => item.id === 'turbine' && item.damage === 100));
});

test('wear/damage persist across unloading and Stop, and service preserves heat, fuel, settings, hours and trips', () => {
    const sim = new NuclearPowerSimulation(), rotor = sim.components.turbineIntegrity;
    const turbine = sim.components.items.turbine;
    run(rotor, 620, 30);
    const damage = rotor.damage, wear = rotor.wear;
    run(rotor, 0, 100, 0);
    assert.equal(rotor.damage, damage); assert.equal(rotor.wear, wear);
    turbine.actual.shaftSpeed = 100;
    assert.equal(sim.componentAction('turbine', 'repair'), false, 'Rotor must stop before maintenance');
    turbine.actual.shaftSpeed = 0;
    turbine.hours = 14; turbine.settings.generatorLoading = 150;
    sim.trip(); turbine.actual.tripped = true;
    const fuel = JSON.stringify(sim.fuel), heat = sim.condition.heatReserve;
    assert.equal(sim.componentAction('turbine', 'repair'), true);
    assert.equal(rotor.damage, 0); assert.equal(rotor.wear, 0); assert.deepEqual(rotor.fragments, []);
    assert.equal(turbine.hours, 14); assert.equal(turbine.settings.generatorLoading, 150);
    assert.equal(sim.condition.heatReserve, heat); assert.equal(JSON.stringify(sim.fuel), fuel);
    assert.equal(sim.tripped, true); assert.equal(turbine.actual.tripped, true); assert.equal(sim.running, false);
});

test('shared blade fragments fall once, freeze with zero frame time and settle without growing the pool', () => {
    const rotor = new TurbineIntegrity(() => .5); run(rotor, 620, 30);
    let fragments = advanceTurbineFragments([], rotor.fragments, 0);
    const first = fragments[0];
    for (let i = 0; i < 12; i++) fragments = advanceTurbineFragments(fragments, rotor.fragments, .1);
    assert.notEqual(fragments[0].y, first.y);
    assert.deepEqual(advanceTurbineFragments(fragments, rotor.fragments, 0), fragments);
    for (let i = 0; i < 40; i++) fragments = advanceTurbineFragments(fragments, rotor.fragments, .1);
    assert.equal(fragments[0].y, -2.5);
    assert.ok(fragments.length <= 40);
    assert.deepEqual(advanceTurbineFragments(fragments, [], .1), []);
});
