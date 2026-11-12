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

const advance = (sim, seconds) => { for (let i = 0; i < seconds * 4; i++) sim.tick(0.25); };
const loseCooling = sim => { sim.togglePump('A'); sim.togglePump('B'); };

test('retained heat rises after an explicit cooling-loss shutdown in Auto, with warning time before damage', () => {
    const sim = manualSimulation();
    sim.setAutoMode(true);
    const fuel = sim.condition.fuelTemperature;
    loseCooling(sim);
    advance(sim, 3);
    assert.equal(sim.tripped, false);
    sim.trip();
    advance(sim, 20);
    assert.equal(sim.tripped, true);
    assert.ok(sim.condition.heatReserve > 50);
    assert.ok(sim.condition.fuelTemperature > fuel);
    assert.equal(sim.condition.coreDamage, 0);
    assert.equal(sim.condition.meltdown, false);
    assert.ok(sim.events.some(event => event.message.includes('STRAINED')));
    sim.togglePump('A'); sim.togglePump('B');
    advance(sim, 120);
    assert.equal(sim.condition.coreDamage, 0);
    assert.ok(sim.condition.peakTemperature < 200);
    assert.ok(sim.temperature < 150);
    assert.equal(sim.tripRecovery().ready, true);
});

test('continued cooling loss progresses through overheating and damage before a slow meltdown', () => {
    const sim = manualSimulation();
    loseCooling(sim);
    let firstDamage;
    while (!sim.condition.meltdown && sim.elapsed < 360) {
        sim.tick(0.25);
        if (sim.condition.coreDamage >= 1 && !firstDamage) firstDamage = sim.elapsed;
    }
    assert.equal(sim.condition.meltdown, true);
    assert.ok(firstDamage > 20);
    assert.ok(sim.elapsed - firstDamage > 20);
    assert.equal(sim.snapshot().status, 'MELTDOWN');
    assert.equal(sim.running, false);
    assert.equal(sim.tripped, false, 'Terminal core failure does not press the operator emergency button');
    assert.equal(sim.electricalOutput, 0);
    assert.equal(sim.condition.stage, 'MELTDOWN');
    assert.ok(sim.events.some(event => event.message.includes('OVERHEATING')));
    assert.ok(sim.events.some(event => event.message.includes('CORE DAMAGE')));
    assert.ok(sim.condition.meltProgress < 0.05);
    advance(sim, 20);
    assert.ok(sim.condition.meltProgress > 0.7);
    sim.resetTrip(); sim.repairComponents(); sim.start();
    assert.equal(sim.running, false);
    assert.equal(sim.condition.meltdown, true);
    const initialEvent = sim.condition.incident.timeline[0];
    for (let i = 0; i < 250; i++) sim.record(`Later event ${i}`);
    assert.equal(sim.events.length, 200);
    assert.equal(sim.condition.incident.timeline.length, 160);
    assert.equal(sim.condition.incident.timeline[0], initialEvent);
    assert.match(sim.condition.incident.cause, /pump A/);
    sim.reset();
    assert.equal(sim.condition.meltdown, false);
    assert.equal(sim.condition.coreDamage, 0);
    assert.equal(sim.condition.incident, null);
});

test('fault restriction develops gradually and early intervention prevents damage', () => {
    const sim = manualSimulation();
    sim.setAutoMode(true);
    sim.injectFault('primary-restriction');
    assert.equal(sim.primaryFlow, 100);
    advance(sim, 10);
    assert.ok(sim.primaryFlow > 50 && sim.primaryFlow < 95);
    assert.equal(sim.condition.coreDamage, 0);
    sim.injectFault('none');
    advance(sim, 180);
    assert.equal(sim.condition.damaged, false);
    assert.equal(sim.condition.meltdown, false);
    assert.ok(sim.primaryFlow > 80);
});

test('component wear survives fault clearing and trip reset; explicit cool repair restores it', () => {
    const sim = manualSimulation();
    sim.injectFault('pump-wear');
    while (sim.condition.components.A.damage < 2 && sim.elapsed < 150) sim.tick(0.25);
    assert.ok(sim.condition.components.A.stress > 60);
    assert.ok(sim.condition.components.A.damage >= 2);
    sim.injectFault('none');
    const damage = sim.condition.components.A.damage;
    sim.trip(); sim.resetTrip();
    assert.ok(sim.condition.components.A.damage >= damage);
    assert.equal(sim.tripped, true);
    sim.repairComponents();
    assert.ok(sim.condition.components.A.damage >= damage);
    advance(sim, 180);
    assert.equal(sim.condition.canRepair(sim), false, 'Damaged pump internals require the motor to be stopped');
    sim.togglePump('A'); advance(sim, 15);
    assert.equal(sim.condition.canRepair(sim), true);
    const reserve = sim.condition.heatReserve;
    sim.repairComponents();
    assert.equal(sim.condition.damaged, false);
    assert.equal(sim.condition.heatReserve, reserve);
    sim.togglePump('A'); advance(sim, 8);
    sim.resetTrip();
    assert.equal(sim.running, false);
    sim.start();
    assert.equal(sim.running, true);
});

test('individual rod imbalance reveals a local hot spot before average coolant overheats', () => {
    const sim = manualSimulation();
    sim.setRod('CR-01', 0);
    advance(sim, 40);
    assert.ok(sim.condition.zones[0].temperature > 410);
    assert.ok(sim.temperature < 335);
    assert.equal(sim.condition.coreDamage, 0);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'fuel'));
    sim.setAutoMode(true);
    advance(sim, 180);
    assert.equal(sim.condition.meltdown, false);
    assert.equal(sim.condition.coreDamage, 0);
});

test('normal automatic generation remains protected and pause freezes failure evolution', () => {
    const sim = manualSimulation();
    sim.setAutoObjective('power'); sim.setElectricalTarget(400); sim.setAutoMode(true);
    advance(sim, 900);
    assert.equal(sim.condition.damaged, false);
    assert.equal(sim.condition.meltdown, false);
    sim.injectFault('secondary-loss');
    advance(sim, 10);
    sim.togglePause();
    const before = JSON.stringify(sim.condition);
    advance(sim, 120);
    assert.equal(JSON.stringify(sim.condition), before);
});

test('Auto reduces output during cooling loss while retained heat and alarms remain active without a trip', () => {
    const sim = manualSimulation();
    sim.setAutoMode(true);
    const fuel = sim.condition.fuelTemperature;
    loseCooling(sim);
    advance(sim, 3);
    assert.ok(sim.power < 64);
    assert.equal(sim.condition.coreDamage, 0);
    assert.ok(sim.condition.heatReserve > 50);
    advance(sim, 20);
    assert.ok(sim.condition.fuelTemperature > fuel);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'primary'));
    assert.equal(sim.autoMode, true);
    assert.equal(sim.running, true);
    assert.equal(sim.tripped, false);
});

test('terminal core failure stops generation in both modes without activating the emergency button', () => {
    for (const auto of [false, true]) {
        const sim = manualSimulation();
        sim.setAutoMode(auto);
        sim.condition.fuelTemperature = 700;
        sim.condition.zones.forEach(zone => { zone.temperature = 700; zone.damage = 100; });
        sim.tick(.25);
        assert.equal(sim.condition.meltdown, true);
        assert.equal(sim.running, false);
        assert.equal(sim.tripped, false);
        assert.equal(sim.rodTarget, 100);
        assert.equal(sim.electricalOutput, 0);
        sim.resetTrip(); sim.start();
        assert.equal(sim.running, false);
        assert.equal(sim.condition.meltdown, true);
        assert.equal(sim.tripped, false);
    }
});
