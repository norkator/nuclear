/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation, CORE_CHANNELS } from '../src/simulation/nuclear-power-model.js';
import { CompanyCareer } from '../src/simulation/nuclear-power-missions.js';
import { captureCareer, restoreCareerBundle } from '../src/simulation/nuclear-power-game-save.js';
import { FuelTransferAnimation } from '../src/simulation/nuclear-power-refuelling.js';
import { poweredSimulation } from './plant-fixtures.mjs';
import { stationSoundState } from '../src/simulation/nuclear-power-station-audio.js';

const advance = (sim, seconds) => { for (let index = 0; index < seconds * 4; index++) sim.tick(.25); };

test('new and reset plants stay electrically cold with every diesel and computer OFF until an operator acts', () => {
    const sim = new NuclearPowerSimulation(); sim.setFluctuations(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        assert.equal(sim.supply.gridAvailable, false); assert.equal(sim.supply.turbineConnected, false);
        assert.equal(sim.supply.source, 'NO AC SUPPLY'); assert.equal(sim.supply.factor, 0);
        assert.ok(sim.supply.generators.every(generator => generator.state === 'STOPPED' && !generator.automatic));
        assert.ok(Object.values(sim.computers.units).every(unit => !unit.enabled && !unit.online));
        assert.equal(sim.computers.fanSpeed, 0); assert.equal(sim.computers.automationAvailable, false);
        assert.equal(stationSoundState(sim, 'computers').activity, 0);
        assert.equal(sim.setComputerEnabled('serverA', true), false, 'A cold rack cannot be pre-armed without power');
        advance(sim, 30);
        assert.equal(sim.alarms.length, 0, 'Uncommissioned power/computers are OFF, not failed');
        sim.start();
        assert.equal(sim.running, false); assert.equal(sim.power, 0); assert.equal(sim.supply.factor, 0);
        assert.ok(sim.supply.generators.every(generator => generator.state === 'STOPPED'));
        assert.ok(Object.values(sim.computers.units).every(unit => !unit.enabled && !unit.online));
        sim.reset(); sim.setFluctuations(false);
    }
});

test('restoring AC never starts rack hardware; explicit switches and five plant seconds establish Auto readiness', () => {
    const sim = new NuclearPowerSimulation(); sim.setGridDispatchEnabled(false); sim.setFluctuations(false);
    sim.supply.setGrid(sim, true); advance(sim, 10);
    assert.ok(Object.values(sim.computers.units).every(unit => !unit.enabled && !unit.online));
    assert.equal(sim.computers.automationAvailable, false);
    for (const id of ['rackCooling', 'rackSwitch', 'serverA']) assert.equal(sim.setComputerEnabled(id, true), true);
    advance(sim, 4); assert.equal(sim.computers.automationAvailable, false);
    const remaining = sim.computers.units.serverA.bootRemaining;
    sim.togglePause(); advance(sim, 60); assert.equal(sim.computers.units.serverA.bootRemaining, remaining);
    sim.togglePause(); advance(sim, 1.5);
    assert.equal(sim.computers.automationAvailable, true);
    assert.equal(sim.computers.units.serverB.enabled, false); assert.equal(sim.computers.units.rackUps.enabled, false);
    assert.equal(sim.running, false);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 8);
    assert.equal(sim.startupReadiness().ready, true); sim.start();
    assert.equal(sim.running, true); assert.equal(sim.startSequence, 1);
});

test('manual diesel black start supplies AC without auto-starting the spare engine, computers or reactor', () => {
    const sim = new NuclearPowerSimulation();
    sim.supply.command(sim, 'A', 'start'); advance(sim, 7);
    assert.equal(sim.supply.factor, 0);
    advance(sim, 1.5); assert.equal(sim.supply.source, 'BACKUP DIESEL A'); assert.equal(sim.supply.factor, 1);
    assert.equal(sim.supply.generators[1].state, 'STOPPED');
    assert.ok(Object.values(sim.computers.units).every(unit => !unit.enabled));
    assert.equal(sim.running, false); assert.equal(sim.tripped, false);
    assert.equal(sim.setComputerEnabled('serverA', true), true);
});

test('Auto, Manual and Hard startup require an actual online server and control network after boot', () => {
    for (const mode of ['Auto', 'Manual', 'Hard']) {
        const sim = new NuclearPowerSimulation(); sim.setFluctuations(false);
        sim.setGridDispatchEnabled(false);
        if (mode !== 'Auto') sim.setAutoMode(false);
        if (mode === 'Hard') sim.autoAllowed = false;
        sim.supply.setGrid(sim, true); sim.togglePump('A'); sim.togglePump('B'); advance(sim, 8);
        const blocked = reason => {
            assert.equal(sim.circulationReady(), true);
            assert.equal(sim.startupReadiness().checks.find(check => check.id === 'computing').ready, false, `${mode}: ${reason}`);
            sim.start(); assert.equal(sim.running, false); assert.equal(sim.startSequence, 0);
            assert.equal(sim.tripped, false); assert.ok(sim.controlRods.every(rod => rod.target === 100));
        };
        blocked('rack OFF');
        sim.setComputerEnabled('rackCooling', true); sim.setComputerEnabled('serverA', true);
        advance(sim, 6); blocked('server online without network');
        sim.setComputerEnabled('rackSwitch', true); advance(sim, 4); blocked('network still booting');
        advance(sim, 2);
        sim.setComputerEnabled('serverA', false); blocked('network online without server');
        sim.setComputerEnabled('serverB', true); advance(sim, 4); blocked('server still booting');
        sim.togglePause(); advance(sim, 30); blocked('paused boot'); sim.togglePause();
        advance(sim, 2);
        assert.equal(sim.startupReadiness().ready, true); assert.equal(sim.running, false, 'Boot never starts the reactor');
        sim.start(); assert.equal(sim.running, true); assert.equal(sim.startSequence, 1);
        assert.equal(sim.autoMode, mode === 'Auto');
    }
});

test('computing loss during Manual operation preserves independent controls and ESD, but blocks another Start', () => {
    const sim = poweredSimulation(); sim.setAutoMode(false); sim.setGridDispatchEnabled(false);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 8); sim.start(); advance(sim, 45);
    for (const id of Object.keys(sim.computers.units)) sim.setComputerEnabled(id, false);
    advance(sim, 1); assert.equal(sim.computers.automationAvailable, false);
    assert.equal(sim.running, true); assert.equal(sim.tripped, false);
    sim.setRod('CR-01', 70); assert.equal(sim.controlRods[0].target, 70);
    sim.stop(); sim.start(); assert.equal(sim.running, false); assert.equal(sim.startSequence, 1);
    sim.trip(); assert.equal(sim.tripped, true); assert.ok(sim.controlRods.every(rod => rod.target === 100));
});

test('cold/off and partially booted schema-3 career saves restore exact power state without powering hardware', () => {
    const sim = new NuclearPowerSimulation(), career = new CompanyCareer();
    const capture = () => captureCareer(sim, new FuelTransferAnimation(CORE_CHANNELS), career);
    let restored = restoreCareerBundle(capture()).simulation;
    assert.deepEqual(restored.supply, sim.supply); assert.deepEqual(restored.computers, sim.computers);
    sim.supply.setGrid(sim, true); sim.setComputerEnabled('serverA', true); advance(sim, 2);
    restored = restoreCareerBundle(capture()).simulation;
    assert.deepEqual(restored.supply, sim.supply); assert.deepEqual(restored.computers, sim.computers);
    assert.equal(restored.computers.units.serverA.online, false);
    assert.ok(Object.values(restored.computers.units).filter(unit => !unit.enabled).length === 4);
});


test('AC warnings distinguish a cold plant from requested or lost pump power', () => {
    const sim = new NuclearPowerSimulation(); advance(sim, 10);
    assert.equal(sim.alarms.length, 0);
    sim.togglePump('A');
    assert.ok(sim.alarms.some(alarm => alarm.id === 'ac-supply'));
    sim.supply.setGrid(sim, true); advance(sim, 3);
    assert.ok(!sim.alarms.some(alarm => alarm.id === 'ac-supply'));
    sim.supply.setGrid(sim, false); advance(sim, .25);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'ac-supply'));
    assert.equal(sim.running, false); assert.equal(sim.tripped, false);
});

test('explicit post-trip rod withdrawal produces heat while the latch, stopped turbine and Auto suspension remain intact', () => {
    const sim = poweredSimulation(); sim.setGridDispatchEnabled(false); sim.setFluctuations(false);
    sim.trip(); advance(sim, 10);
    assert.equal(sim.power, 0, 'ESD still inserts all rods before any manual command');
    for (const rod of sim.controlRods) sim.setRod(rod.id, 0);
    const saved = captureCareer(sim, new FuelTransferAnimation(CORE_CHANNELS), new CompanyCareer());
    const restored = restoreCareerBundle(saved).simulation;
    assert.equal(restored.manualTripWithdrawal, true);
    sim.togglePause(); advance(sim, 20); assert.equal(sim.power, 0);
    sim.togglePause(); advance(sim, 20);
    assert.ok(sim.rods < 1 && sim.power > 95 && sim.temperature > 150);
    assert.equal(sim.tripped, true); assert.equal(sim.running, false); assert.equal(sim.startSequence, 0);
    assert.equal(sim.components.items.turbine.actual.shaftSpeed, 0);
    assert.equal(sim.tripRecovery().checks.find(check => check.id === 'rods').ready, false);
    assert.equal(sim.components.serviceReady, false);
    sim.start(); sim.resetTrip(); assert.equal(sim.tripped, true); assert.equal(sim.running, false);
    sim.trip(); assert.ok(sim.controlRods.every(rod => rod.target === 100));
    advance(sim, 20); assert.ok(sim.power < 1);
    sim.setRod('CR-01', 0); sim.stop();
    assert.ok(sim.controlRods.every(rod => rod.target === 100)); assert.equal(sim.tripped, true);
    sim.condition.meltdown = true; sim.setRod('CR-01', 0); assert.equal(sim.controlRods[0].target, 100);
});
