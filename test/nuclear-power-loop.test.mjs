/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { temperatureColor, loopTemperatures } from '../src/simulation/nuclear-power-temperature.js';
import { advanceProcessMotion, flowMarkerDistance, valveHandleAngle } from '../src/simulation/nuclear-power-motion.js';

const advance = (sim, seconds) => { for (let i = 0; i < seconds * 4; i++) sim.tick(.25); };
const operating = () => {
    const sim = new NuclearPowerSimulation();
    sim.setGridDispatchEnabled(false); // Compare cooling at one fixed operating point.
    sim.setFluctuations(false);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 6);
    sim.setAutoTargets(286, 100); sim.start(); advance(sim, 240);
    return sim;
};

test('loop colors share one absolute temperature scale rather than fixed hot/return colors', () => {
    const sim = operating();
    const temperatures = loopTemperatures(sim);
    assert.equal(temperatureColor(20), '#4faed3');
    assert.equal(temperatureColor(335), '#f05a52');
    assert.equal(temperatureColor(NaN), '#7b8b96');
    assert.equal(temperatureColor(-10), temperatureColor(20));
    assert.equal(temperatureColor(1000), temperatureColor(600));
    assert.notEqual(temperatureColor(temperatures.primaryReturn), temperatureColor(30));
    assert.equal(temperatureColor(temperatures.primaryHot), temperatureColor(temperatures.primaryBypass));
    assert.ok(temperatures.secondaryReturn < temperatures.secondaryHot);
    assert.equal(sim.snapshot().signals.secondaryReturnTemperature.value, sim.secondaryReturnTemperature);
});

test('full exchanger bypass removes the primary cooling drop while retaining gradual read-back', () => {
    const sim = operating();
    const initialDrop = sim.temperature - sim.returnTemperature;
    assert.ok(initialDrop > 10);
    sim.setComponentSetting('exchanger', 'bypass', 100);
    const before = sim.returnTemperature;
    assert.equal(sim.returnTemperature, before);
    advance(sim, 90);
    assert.ok(sim.components.items.exchanger.actual.bypass > 99.9);
    assert.ok(Math.abs(sim.temperature - sim.returnTemperature) < 5);
    assert.ok(sim.returnTemperature > 100, 'A hot bypass cannot report cold-blue return water');
    assert.notEqual(temperatureColor(sim.returnTemperature), temperatureColor(30));
});

test('closing condenser cooling removes the secondary return cooling drop', () => {
    const sim = operating();
    assert.ok(sim.secondaryTemperature - sim.secondaryReturnTemperature > 50);
    sim.setComponentSetting('condenser', 'coolingValve', 0);
    advance(sim, 90);
    assert.ok(Math.abs(sim.secondaryTemperature - sim.secondaryReturnTemperature) < 5);
});

test('open valve handles follow each pipe axis and closed handles are perpendicular', () => {
    for (const axis of [0, 90, 180]) {
        assert.equal(valveHandleAngle(100, axis), axis);
        assert.equal(valveHandleAngle(0, axis), axis + 90);
        assert.equal(valveHandleAngle(50, axis), axis + 45);
    }
    assert.equal(valveHandleAngle(200), 0);
    assert.equal(valveHandleAngle(-20), 90);
});

test('all sections of a coolant circuit move the same travel distance regardless of pipe length or steam temperature', () => {
    const previous = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0, secondaryTravel: 2 };
    const signals = { temperature: 286, secondaryTemperature: 184, primaryFlow: 50, secondaryFlow: 80, electricalOutput: 200, supplyFactor: 1 };
    const motion = advanceProcessMotion(previous, signals, .1);
    const shortTravel = flowMarkerDistance(motion.secondaryTravel, 0, 5, 6) - flowMarkerDistance(previous.secondaryTravel, 0, 5, 6);
    const longTravel = flowMarkerDistance(motion.secondaryTravel, 0, 20, 24) - flowMarkerDistance(previous.secondaryTravel, 0, 20, 24);
    assert.ok(Math.abs(shortTravel - longTravel) < 1e-10);
    assert.ok(Math.abs(shortTravel - .16) < 1e-10);
    const cold = advanceProcessMotion(previous, { ...signals, secondaryTemperature: 30 }, .1);
    assert.equal(cold.secondaryTravel, motion.secondaryTravel);
    const stopped = advanceProcessMotion(motion, { ...signals, secondaryFlow: 0 }, .1);
    assert.equal(stopped.secondaryTravel, motion.secondaryTravel);
    assert.equal(advanceProcessMotion(motion, signals, 0).secondaryTravel, motion.secondaryTravel);
});
