/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';

// These scenarios explicitly exercise manual operation or opt into temperature Auto.
const manualSimulation = () => {
    const sim = new NuclearPowerSimulation();
    sim.setAutoMode(false);
    sim.setAutoObjective('temperature');
    // Explicitly prime circulation for this established operating-point fixture.
    sim.togglePump('A'); sim.togglePump('B');
    sim.primaryFlow = 100; sim.secondaryFlow = 100;
    for (const id of ['pumpA', 'pumpB']) {
        Object.assign(sim.components.items[id].actual, { speed: 100, flow: 100, available: true });
    }
    sim.start();
    Object.assign(sim, { power: 64, temperature: 286, returnTemperature: 258, secondaryTemperature: 184 });
    sim.controlRods.forEach(rod => { rod.position = 36; });
    Object.assign(sim.condition, { fuelTemperature: 323.3, heatReserve: 96, coolingMargin: 288 });
    sim.condition.zones.forEach(zone => { zone.temperature = 323.3; });
    sim.history = []; sim.sample();
    return sim;
};

const advance = (sim, seconds) => { for (let i = 0; i < seconds * 4; i++) sim.tick(.25); };

test('fuel consumes unequal exposure under load, acceleration affects fuel only, pause and shutdown freeze burn', () => {
    const normal = manualSimulation();
    const fast = manualSimulation();
    fast.fuel.setRate(fast, 60);
    const initial = normal.fuel.assemblies.map(a => a.remaining);
    assert.ok(new Set(initial).size > 20);
    advance(normal, 60); advance(fast, 60);
    const losses = fast.fuel.assemblies.map((a, i) => initial[i] - a.remaining);
    assert.ok(Math.max(...losses) > Math.min(...losses) * 1.1);
    assert.ok(initial[0] - fast.fuel.assemblies[0].remaining > (initial[0] - normal.fuel.assemblies[0].remaining) * 55);
    assert.equal(fast.elapsed, normal.elapsed);
    fast.stop(); advance(fast, 80);
    const stopped = structuredClone(fast.fuel.assemblies);
    advance(fast, 60);
    assert.deepEqual(fast.fuel.assemblies, stopped);
    fast.togglePause(); advance(fast, 60);
    assert.deepEqual(fast.fuel.assemblies, stopped);
});

test('depletion lowers capability and Auto compensates until constrained without replacing any fuel', () => {
    const sim = manualSimulation();
    sim.setFluctuations(false);
    sim.setAutoMode(true);
    advance(sim, 120);
    const insertion = sim.rodTarget;
    sim.fuel.assemblies.forEach(a => { a.remaining *= .6; });
    advance(sim, 180);
    assert.ok(sim.rodTarget < insertion - 10);
    assert.ok(Math.abs(sim.temperature - sim.autoTemperature) < 3);
    sim.fuel.assemblies.forEach(a => { a.remaining = 0; });
    advance(sim, 120);
    assert.equal(sim.regulationLimit, 'Fuel capability');
    assert.ok(sim.power < .01);
    assert.ok(sim.fuel.assemblies.every(a => a.remaining === 0 && a.replacements === 0));
    assert.ok(sim.alarms.some(a => a.id === 'fuel-reserve'));
});

test('manual replacement changes one cooled assembly and never erases heat, damage or trips', () => {
    const sim = manualSimulation();
    const id = sim.fuel.assemblies[0].id;
    sim.replaceFuel(id);
    assert.equal(sim.fuel.assemblies[0].replacements, 0);
    sim.trip(); advance(sim, 300);
    assert.equal(sim.fuel.replacementReadiness(sim).ready, true);
    sim.condition.zones[0].damage = 2;
    sim.replaceFuel(id);
    assert.equal(sim.fuel.assemblies[0].replacements, 0);
    const fuelBeforeRepair = structuredClone(sim.fuel.assemblies);
    sim.repairComponents();
    assert.deepEqual(sim.fuel.assemblies, fuelBeforeRepair);
    const others = structuredClone(sim.fuel.assemblies.slice(1));
    const heat = sim.condition.heatReserve;
    sim.replaceFuel(id);
    assert.equal(sim.fuel.assemblies[0].remaining, 100);
    assert.equal(sim.fuel.assemblies[0].exposure, 0);
    assert.equal(sim.fuel.assemblies[0].replacements, 1);
    assert.deepEqual(sim.fuel.assemblies.slice(1), others);
    assert.equal(sim.condition.heatReserve, heat);
    assert.equal(sim.tripped, true);
    assert.equal(sim.running, false);
    assert.ok(sim.events.some(e => e.message.includes('replaced manually')));
});

test('individual Auto override is held while remaining rods compensate; release, Stop and trip restore ownership', () => {
    const sim = manualSimulation();
    sim.setFluctuations(false); sim.setAutoMode(true);
    advance(sim, 120);
    const before = sim.controlRods[1].target;
    sim.setRod('CR-01', 0);
    assert.notEqual(sim.controlRods[0].target, 0);
    sim.setRodOverride('CR-01', true); sim.setRod('CR-01', 20);
    advance(sim, 150);
    assert.equal(sim.autoMode, true);
    assert.equal(sim.controlRods[0].target, 20);
    assert.ok(sim.controlRods[1].target > before);
    assert.ok(Math.abs(sim.temperature - 286) < 3);
    assert.equal(sim.snapshot().commands.rods[0].owner, 'MANUAL');
    assert.equal(sim.snapshot().commands.rods[1].owner, 'AUTO');
    sim.setRodOverride('CR-01', false); advance(sim, 5);
    assert.equal(sim.controlRods[0].manualOverride, false);
    assert.ok(sim.controlRods[0].target > 20);
    sim.controlRods.forEach(r => sim.setRodOverride(r.id, true));
    advance(sim, 2);
    assert.equal(sim.regulationLimit, 'All rods under manual override');
    sim.stop();
    assert.ok(sim.controlRods.every(r => !r.manualOverride && r.target === 100));
    advance(sim, 60); sim.start();
    sim.setRodOverride('CR-02', true); sim.setRod('CR-02', 0); sim.trip();
    assert.ok(sim.controlRods.every(r => !r.manualOverride && r.target === 100));
    sim.setRodOverride('CR-02', true); sim.setRod('CR-02', 0);
    assert.equal(sim.controlRods[1].target, 100);
});

test('zero generation transfers pump power to grid, backup starts on loss of normal supply and does not restart reactor', () => {
    const sim = manualSimulation();
    sim.setFluctuations(false);
    sim.stop(); advance(sim, 60);
    assert.ok(sim.power < .01 && sim.primaryFlow > 99);
    assert.equal(sim.supply.source, 'EXTERNAL GRID');
    sim.supply.setGrid(sim, false);
    assert.equal(sim.supply.source, 'NO AC SUPPLY');
    assert.ok(sim.supply.generators.every(g => g.state === 'STARTING'));
    advance(sim, 4);
    assert.ok(sim.primaryFlow < 20);
    advance(sim, 12);
    assert.equal(sim.supply.source, 'BACKUP DIESEL A + B');
    assert.ok(sim.primaryFlow > 98);
    assert.equal(sim.running, false);
    assert.ok(sim.supply.generators.every(g => g.fuel < 95 && g.load > 0));
    sim.supply.setGrid(sim, true); advance(sim, 1);
    assert.equal(sim.supply.source, 'EXTERNAL GRID');
    assert.ok(sim.supply.generators.every(g => g.state === 'RUNNING' && g.load === 0));
});

test('manual diesel stop persists, refuelling requires stopped engine and blackout feeds the retained-heat incident', () => {
    const sim = manualSimulation();
    sim.setAutoMode(true);
    sim.setFluctuations(false);
    sim.supply.command(sim, 'A', 'start'); advance(sim, 9);
    const fuel = sim.supply.generators[0].fuel;
    sim.supply.command(sim, 'A', 'refuel');
    assert.equal(sim.supply.generators[0].fuel, fuel);
    sim.supply.command(sim, 'A', 'stop'); sim.supply.command(sim, 'A', 'refuel');
    assert.equal(sim.supply.generators[0].fuel, 100);
    sim.supply.command(sim, 'B', 'auto');
    sim.supply.setGrid(sim, false); sim.supply.setTurbine(sim, false);
    advance(sim, 12);
    assert.equal(sim.supply.source, 'NO AC SUPPLY');
    assert.equal(sim.tripped, false, 'Blackout leaves emergency shutdown to the operator');
    assert.equal(sim.supply.generators[0].state, 'STOPPED');
    assert.equal(sim.supply.generators[1].state, 'STANDBY');
    assert.equal(sim.condition.incident.cause, 'Auxiliary AC power lost');
    assert.ok(sim.alarms.some(a => a.id === 'ac-supply'));
    sim.supply.command(sim, 'B', 'start'); advance(sim, 20);
    assert.equal(sim.supply.source, 'BACKUP DIESEL B');
    assert.ok(Math.abs(sim.primaryFlow - sim.autoFlow) < 3, 'Restored AC resumes the running Auto circulation target');
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, true);
    sim.trip();
    advance(sim, 2);
    assert.equal(sim.tripped, true);
    assert.equal(sim.running, false);
});

test('diesel exhaustion removes supply and one running diesel can carry both pumps', () => {
    const sim = manualSimulation();
    sim.stop(); sim.supply.command(sim, 'B', 'auto');
    sim.supply.setGrid(sim, false); advance(sim, 10);
    assert.equal(sim.supply.source, 'BACKUP DIESEL A');
    assert.ok(sim.supply.factor === 1);
    sim.supply.generators[0].fuel = .001;
    advance(sim, 2);
    assert.equal(sim.supply.generators[0].state, 'EMPTY');
    assert.equal(sim.supply.source, 'NO AC SUPPLY');
    assert.ok(sim.supply.generators[0].fuel === 0);
    sim.supply.command(sim, 'A', 'refuel'); advance(sim, 9);
    assert.equal(sim.supply.source, 'BACKUP DIESEL A');
});


test('replace all fuel is atomic, manual and preserves stopped/tripped plant state', () => {
    const sim = manualSimulation();
    const initial = structuredClone(sim.fuel.assemblies);
    assert.equal(sim.replaceAllFuel(), false);
    assert.deepEqual(sim.fuel.assemblies, initial);
    sim.trip(); advance(sim, 300);
    sim.condition.zones[0].damage = 1;
    assert.equal(sim.replaceAllFuel(), false);
    assert.deepEqual(sim.fuel.assemblies, initial);
    sim.repairComponents();
    sim.condition.meltdown = true;
    assert.equal(sim.replaceAllFuel(), false);
    sim.condition.meltdown = false;
    const heat = sim.condition.heatReserve;
    const temperature = sim.temperature;
    const rods = structuredClone(sim.controlRods);
    assert.equal(sim.replaceAllFuel(), true);
    assert.ok(sim.fuel.assemblies.every(a => a.remaining === 100 && a.exposure === 0 && a.replacements === 1));
    assert.equal(sim.running, false);
    assert.equal(sim.tripped, true);
    assert.equal(sim.condition.heatReserve, heat);
    assert.equal(sim.temperature, temperature);
    assert.deepEqual(sim.controlRods, rods);
    assert.ok(sim.events.some(e => /All .* fuel assemblies replaced manually/.test(e.message)));
});
