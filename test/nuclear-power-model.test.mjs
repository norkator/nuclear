/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_CHANNELS, NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { advancePumpMotion, advanceProcessMotion, advanceReactorMotion } from '../src/simulation/nuclear-power-motion.js';

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

const advance = (simulation, seconds) => {
    for (let i = 0; i < seconds * 4; i++) simulation.tick(0.25);
};

test('load and rod controls move the same plant state and temperatures respond gradually', () => {
    const sim = manualSimulation();
    sim.setFluctuations(false);
    sim.setLoad(85);
    assert.equal(sim.rodTarget, 15);
    assert.equal(sim.power, 64);
    advance(sim, 30);
    assert.ok(sim.power > 83);
    assert.ok(sim.temperature > 320);
    sim.setRods(75);
    assert.equal(sim.demand, 25);
    advance(sim, 45);
    assert.ok(sim.power < 26);
    assert.ok(sim.temperature < 160);
});

test('stopping preserves circulation, cools the plant, and allows a normal restart', () => {
    const sim = manualSimulation();
    sim.stop();
    advance(sim, 40);
    assert.equal(sim.pumpA, true);
    assert.equal(sim.pumpB, true);
    assert.ok(sim.rods > 99);
    assert.ok(sim.temperature < 100);
    sim.start();
    advance(sim, 30);
    assert.ok(sim.power > 62);
    assert.equal(sim.snapshot().status, 'RUNNING');
});

test('Auto primary flow loss keeps alarms active and leaves emergency shutdown to the operator', () => {
    const sim = manualSimulation();
    sim.setAutoMode(true);
    sim.togglePump('A');
    assert.equal(sim.alarms[0].id, 'primary');
    sim.acknowledge();
    assert.equal(sim.alarms[0].acknowledged, true);
    advance(sim, 5);
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, true);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'primary'));
    assert.equal(sim.alarms.some(alarm => alarm.id === 'trip'), false);
    sim.trip();
    assert.equal(sim.tripped, true);
    assert.equal(sim.rodTarget, 100);
    assert.equal(sim.alarms.find(alarm => alarm.id === 'trip').acknowledged, false);
    sim.start();
    assert.equal(sim.running, false);
    sim.reset();
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, false);
    assert.deepEqual(sim.alarms, []);
});

test('secondary pump changes electrical output and its alarm clears when circulation returns', () => {
    const sim = manualSimulation();
    const initial = sim.snapshot().signals.electricalOutput.value;
    sim.togglePump('B');
    advance(sim, 4);
    assert.ok(sim.snapshot().signals.electricalOutput.value < initial / 5);
    assert.equal(sim.alarms.some(alarm => alarm.id === 'secondary'), true);
    sim.togglePump('B');
    advance(sim, 2);
    assert.equal(sim.alarms.some(alarm => alarm.id === 'secondary'), false);
    advance(sim, 20);
    assert.ok(sim.snapshot().signals.electricalOutput.value > initial * 0.95);
});

test('emergency shutdown latches, pause freezes evolution, and independent sessions stay isolated', () => {
    const sim = manualSimulation();
    const other = manualSimulation();
    sim.trip();
    advance(sim, 5);
    assert.ok(sim.rods > 99.9);
    assert.ok(sim.power < 6);
    sim.togglePause();
    const before = sim.snapshot();
    advance(sim, 10);
    assert.deepEqual(sim.snapshot(), before);
    assert.equal(other.tripped, false);
    assert.equal(other.elapsed, 0);
});

test('inputs are bounded and all signals remain explicitly simulated with bounded history', () => {
    const sim = manualSimulation();
    sim.setLoad(500);
    assert.equal(sim.demand, 100);
    sim.setRods(-500);
    assert.equal(sim.rodTarget, 0);
    sim.setLoad(NaN);
    sim.setRods(Infinity);
    sim.togglePump('invalid');
    advance(sim, 180);
    assert.ok(sim.history.length <= 121);
    assert.ok(sim.events.length <= 200);
    for (const signal of Object.values(sim.snapshot().signals)) {
        assert.equal(signal.source, 'SIMULATED');
        assert.equal(signal.quality, 'GOOD');
        assert.ok(Number.isFinite(signal.value));
    }
});

test('individual rods retain independent targets, positions and requested/reported snapshots', () => {
    const sim = manualSimulation();
    sim.fluctuationsEnabled = false;
    sim.setRod('CR-01', 84);
    assert.equal(sim.controlRods.find(rod => rod.id === 'CR-01').target, 84);
    assert.ok(sim.controlRods.filter(rod => rod.id !== 'CR-01').every(rod => rod.target === 36));
    assert.equal(sim.rods, 36);
    assert.equal(sim.rodTarget, 40);
    const requested = sim.snapshot();
    assert.equal(requested.commands.rods[0].insertionPercent, 84);
    assert.equal(requested.rods[0].insertion.value, 36);
    advance(sim, 20);
    assert.ok(sim.controlRods[0].position > 83);
    assert.equal(sim.controlRods[1].position, 36);
    assert.ok(sim.power < 61);
    sim.stop();
    advance(sim, 20);
    sim.start();
    assert.equal(sim.controlRods[0].target, 84);
    assert.equal(sim.controlRods[1].target, 36);
    sim.moveRods(5);
    assert.equal(sim.controlRods[0].target, 89);
    assert.equal(sim.controlRods[1].target, 41);
    assert.equal(new Set(CORE_CHANNELS.filter(channel => channel.rodId).map(channel => channel.rodId)).size, 12);
});

test('pump speed changes coast gradually and independently, including zero and restart', () => {
    const sim = manualSimulation();
    sim.fluctuationsEnabled = false;
    sim.setPumpSpeed('A', 55);
    sim.setPumpSpeed('B', 75);
    assert.equal(sim.snapshot().commands.pumps.A.speedPercent, 55);
    assert.equal(sim.snapshot().signals.pumpASpeed.value, 100);
    advance(sim, 10);
    assert.ok(Math.abs(sim.primaryFlow - 55) < 0.5);
    assert.ok(Math.abs(sim.secondaryFlow - 75) < 0.5);
    sim.stop();
    sim.setPumpSpeed('B', 0);
    advance(sim, 15);
    assert.ok(sim.secondaryFlow < 0.1);
    assert.ok(sim.primaryFlow > 54.9);
    sim.togglePump('A');
    advance(sim, 15);
    sim.togglePump('A');
    assert.equal(sim.pumpASpeed, 55);
    advance(sim, 15);
    assert.ok(sim.primaryFlow > 54.9);
});

test('pump and flow motion is proportional to actual speed and preserves phase', () => {
    const initial = { angle: 73, offset: -4 };
    const full = advancePumpMotion(initial, 100, 0.1);
    const half = advancePumpMotion(initial, 50, 0.1);
    assert.equal(full.angle - initial.angle, (half.angle - initial.angle) * 2);
    assert.ok(Math.abs((full.offset - initial.offset) - (half.offset - initial.offset) * 2) < 1e-9);
    assert.deepEqual(advancePumpMotion(initial, 0, 0.1), initial);
    assert.equal(advancePumpMotion(full, 25, 0.1).angle, full.angle + 4.5);
});

test('fluctuations do not create flow at zero speed or generation with every rod inserted', () => {
    const sim = manualSimulation();
    sim.setRods(100);
    sim.setPumpSpeed('A', 0);
    sim.setPumpSpeed('B', 0);
    advance(sim, 120);
    assert.ok(sim.primaryFlow < 0.001);
    assert.ok(sim.secondaryFlow < 0.001);
    assert.ok(sim.power < 0.001);
});

test('trip recovery preserves tuning and history and requires ready circulation, rods and cooling', () => {
    const sim = manualSimulation();
    sim.setRod('CR-01', 75);
    sim.setPumpSpeed('B', 70);
    sim.trip();
    sim.resetTrip();
    assert.equal(sim.tripped, true);
    advance(sim, 5);
    sim.togglePump('A');
    sim.resetTrip();
    assert.equal(sim.tripped, true);
    sim.togglePump('A');
    advance(sim, 5);
    sim.temperature = 350;
    sim.resetTrip();
    assert.equal(sim.tripped, true);
    advance(sim, 30);
    assert.equal(sim.tripRecovery().ready, true);
    const elapsed = sim.elapsed;
    sim.resetTrip();
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, false);
    assert.equal(sim.elapsed, elapsed);
    assert.equal(sim.pumpBSpeed, 70);
    assert.ok(sim.events.some(event => event.category === 'alarm'));
    sim.start();
    assert.equal(sim.running, true);
    assert.equal(sim.controlRods[0].target, 75);
});

test('automatic control holds changing temperature/flow targets against fluctuations and respects trips', () => {
    const sim = manualSimulation();
    sim.setRod('CR-01', 56);
    const offset = sim.controlRods[0].target - sim.controlRods[1].target;
    sim.setAutoMode(true);
    advance(sim, 180);
    assert.equal(sim.tripped, false);
    assert.ok(Math.abs(sim.temperature - 286) < 3, `temperature ${sim.temperature}`);
    assert.ok(Math.abs(sim.primaryFlow - 85) < 4);
    assert.ok(Math.abs(sim.secondaryFlow - 85) < 4);
    assert.ok(Math.abs(sim.controlRods[0].target - sim.controlRods[1].target - offset) < 1e-8);
    sim.setAutoTargets(260, 75);
    advance(sim, 180);
    assert.ok(Math.abs(sim.temperature - 260) < 3, `new temperature ${sim.temperature}`);
    assert.ok(Math.abs(sim.primaryFlow - 75) < 4);
    let maxError = 0;
    for (let i = 0; i < 120 * 4; i++) {
        sim.tick(0.25);
        maxError = Math.max(maxError, Math.abs(sim.temperature - 260));
    }
    assert.ok(maxError < 3, `maximum settled error ${maxError}`);
    assert.ok(sim.events.some(event => event.category === 'automation'));
    assert.ok(sim.events.some(event => event.category === 'process'));
    sim.trip();
    advance(sim, 15);
    assert.ok(sim.rods > 99.9);
    assert.equal(sim.running, false);
    sim.setRod('CR-01', 0);
    assert.equal(sim.controlRods[0].target, 100);
    sim.resetTrip();
    assert.equal(sim.running, false);
});

test('fluctuations remain bounded and event retention does not grow without limit', () => {
    const sim = manualSimulation();
    sim.fuel.rate = 0; // Isolate disturbance settling from the separately tested fuel drift.
    advance(sim, 30);
    assert.notEqual(sim.power, 64);
    assert.ok(Math.abs(sim.power - 64) < 2);
    sim.setFluctuations(false);
    advance(sim, 180);
    assert.ok(Math.abs(sim.power - 64) < 0.01);
    assert.ok(Math.abs(sim.temperature - 286) < 0.1);
    for (let i = 0; i < 250; i++) sim.setLoad(i % 100);
    assert.equal(sim.events.length, 200);
    const lastEvent = sim.events[0];
    sim.setLoad(NaN);
    sim.setRod('unknown', 50);
    sim.setPumpSpeed('invalid', 50);
    assert.equal(sim.events[0], lastEvent);
});

test('grid-style automatic control follows electrical MW targets and can reduce output to zero', () => {
    const sim = manualSimulation();
    sim.setGridDispatchEnabled(false); // Hold the operator's fixed MW requests.
    sim.setAutoObjective('power');
    sim.setElectricalTarget(150);
    sim.setAutoMode(true);
    advance(sim, 240);
    assert.equal(sim.tripped, false);
    assert.ok(Math.abs(sim.snapshot().signals.electricalOutput.value - 150) < 2);
    assert.equal(sim.regulationLimit, '');
    sim.setElectricalTarget(200);
    advance(sim, 240);
    assert.ok(Math.abs(sim.snapshot().signals.electricalOutput.value - 200) < 2);
    assert.ok(sim.temperature < 290);
    assert.equal(sim.snapshot().commands.electricalTargetMw, 200);
    sim.setElectricalTarget(0);
    advance(sim, 120);
    assert.ok(sim.snapshot().signals.electricalOutput.value < 0.01);
});

test('unachievable electrical demand respects the core limit and reports the constraint', () => {
    const sim = manualSimulation();
    sim.setGridDispatchEnabled(false); // Keep the deliberately unachievable request.
    sim.setAutoObjective('power');
    sim.setElectricalTarget(400);
    sim.setAutoMode(true);
    advance(sim, 240);
    assert.equal(sim.tripped, false);
    assert.equal(sim.regulationLimit, 'Core temperature limit');
    assert.ok(sim.snapshot().signals.electricalOutput.value < 220);
    assert.ok(sim.temperature < 290);
    sim.setElectricalTarget(150);
    advance(sim, 240);
    assert.ok(Math.abs(sim.snapshot().signals.electricalOutput.value - 150) < 2);
    assert.equal(sim.regulationLimit, '');
    assert.ok(sim.events.some(event => event.message.includes('Core temperature limit')));
});

test('electrical targets are bounded and selecting temperature regulation remains independent', () => {
    const sim = manualSimulation();
    sim.setElectricalTarget(10000);
    assert.equal(sim.autoElectricalTarget, 650);
    sim.setElectricalTarget(-100);
    assert.equal(sim.autoElectricalTarget, 0);
    sim.setElectricalTarget(NaN);
    sim.setAutoObjective('unknown');
    assert.equal(sim.autoObjective, 'temperature');
    sim.setAutoMode(true);
    advance(sim, 180);
    assert.ok(Math.abs(sim.temperature - 286) < 3);
    assert.ok(sim.snapshot().signals.electricalOutput.value > 180);
});


test('new and reset sessions start in Auto electrical output without bypassing trip recovery', () => {
    const sim = new NuclearPowerSimulation();
    assert.equal(sim.autoMode, true);
    assert.equal(sim.autoObjective, 'power');
    assert.equal(sim.history[0].electricalTarget, 200);
    assert.equal(sim.running, false);
    assert.equal(sim.snapshot().status, 'STOPPED');
    assert.equal(sim.power, 0);
    assert.equal(sim.rods, 100);
    assert.equal(sim.condition.heatReserve, 0);
    const assertStoppedPumps = () => {
        assert.equal(sim.startupReadiness().ready, false);
        assert.equal(sim.circulationReady(), false);
        assert.equal(sim.primaryFlow, 0);
        assert.equal(sim.secondaryFlow, 0);
        for (const id of ['pumpA', 'pumpB']) {
            assert.equal(sim[id], false);
            assert.equal(sim[`${id}Speed`], 100);
            assert.equal(sim.components.items[id].settings.speed, 100);
            assert.equal(sim.components.items[id].actual.speed, 0);
            assert.equal(sim.components.items[id].actual.flow, 0);
            assert.equal(sim.components.items[id].actual.available, false);
        }
    };
    assertStoppedPumps();
    sim.start();
    assert.equal(sim.running, false);
    const reserves = sim.fuel.assemblies.map(a => a.remaining);
    advance(sim, 180);
    assert.equal(sim.running, false);
    assert.equal(sim.power, 0);
    assert.equal(sim.rods, 100);
    assert.deepEqual(sim.fuel.assemblies.map(a => a.remaining), reserves);
    assertStoppedPumps();
    sim.togglePump('A');
    advance(sim, 6);
    sim.start();
    assert.equal(sim.running, false); // One circulating circuit is insufficient.
    sim.togglePump('B');
    sim.start();
    assert.equal(sim.running, false); // Enabled pumps must actually accelerate.
    advance(sim, 6);
    assert.equal(sim.startupReadiness().ready, true);
    assert.equal(sim.running, false);
    sim.start(); advance(sim, 180);
    assert.equal(sim.running, true);
    assert.ok(sim.power > 0);
    assert.equal(sim.tripped, false);
    assert.equal(sim.condition.damaged, false);
    sim.trip(); advance(sim, 120); sim.resetTrip();
    assert.equal(sim.running, false);
    sim.setAutoMode(false); sim.setAutoObjective('temperature'); sim.reset();
    assert.equal(sim.autoMode, true);
    assert.equal(sim.autoObjective, 'power');
    assert.equal(sim.running, false);
    assert.equal(sim.power, 0);
    assert.equal(sim.rods, 100);
    assertStoppedPumps();
});


test('startup requires actual motor speed, flow and AC independently of retained targets', () => {
    const sim = new NuclearPowerSimulation();
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 6);
    assert.equal(sim.startupReadiness().ready, true);
    const speed = sim.components.items.pumpA.actual.speed;
    sim.components.items.pumpA.actual.speed = 0;
    sim.start(); assert.equal(sim.running, false);
    sim.components.items.pumpA.actual.speed = speed;
    const flow = sim.secondaryFlow;
    sim.secondaryFlow = 0;
    sim.start(); assert.equal(sim.running, false);
    sim.secondaryFlow = flow;
    sim.supply.setGrid(sim, false);
    sim.start(); assert.equal(sim.running, false);
    sim.supply.setGrid(sim, true);
    assert.equal(sim.startupReadiness().ready, true);
    assert.equal(sim.running, false);
});

test('Manual keeps shutdown under operator control across low flow and high coolant/fuel temperatures', () => {
    const sim = manualSimulation();
    sim.togglePump('A'); sim.togglePump('B');
    advance(sim, 40);
    assert.ok(sim.primaryFlow < 15);
    assert.ok(sim.temperature > 360);
    assert.ok(sim.condition.peakTemperature > 470);
    assert.equal(sim.condition.meltdown, false);
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, true);
    assert.equal(sim.rodTarget, 36);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'temperature'));
    sim.trip();
    assert.equal(sim.tripped, true);
    assert.equal(sim.running, false);
    assert.equal(sim.rodTarget, 100);
    sim.setAutoMode(true); sim.setAutoMode(false);
    assert.equal(sim.tripped, true);
});

test('switching a degraded Manual session to Auto never activates emergency shutdown', () => {
    const sim = manualSimulation();
    sim.togglePump('A'); sim.togglePump('B');
    advance(sim, 20);
    assert.equal(sim.tripped, false);
    sim.setAutoMode(true); sim.tick();
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, true);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'primary'));
    sim.trip();
    assert.equal(sim.tripped, true);
    sim.setAutoMode(false); sim.setAutoMode(true);
    assert.equal(sim.tripped, true, 'Mode switching cannot clear an explicit emergency shutdown');
});

test('high Auto output, temperature and circulation targets never latch emergency shutdown', () => {
    for (const objective of ['power', 'temperature']) {
        const sim = manualSimulation();
        sim.setAutoMode(true); sim.setAutoObjective(objective);
        sim.setGridDispatchEnabled(false); sim.setFluctuations(false);
        sim.setElectricalTarget(400); sim.setAutoTargets(1000, 100);
        let hottest = sim.temperature;
        for (let i = 0; i < 120 * 4; i++) {
            sim.tick(.25);
            hottest = Math.max(hottest, sim.temperature);
            assert.equal(sim.tripped, false, `${objective} target must not trip at T+${sim.elapsed}`);
        }
        assert.equal(sim.condition.meltdown, false);
        assert.equal(sim.running, true);
        assert.ok(hottest > 360, 'Exercise the former high-temperature trip threshold');
        assert.ok(sim.alarms.some(alarm => alarm.id === 'temperature'));
        assert.ok(sim.regulationLimit, 'Auto still reports regulation limits');
        sim.condition.fuelTemperature = 520;
        sim.condition.zones.forEach(zone => { zone.temperature = 520; });
        sim.tick(.25);
        assert.ok(sim.condition.peakTemperature > 470);
        assert.equal(sim.tripped, false, 'A local fuel hot spot raises alarms without pressing emergency shutdown');
        assert.ok(sim.alarms.some(alarm => alarm.id === 'fuel'));
        sim.trip();
        assert.equal(sim.tripped, true);
        assert.equal(sim.running, false);
    }
});


test('process animation follows heat and generation with phase-preserving coast-down', () => {
    const initial = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
    const cold = { temperature: 30, secondaryTemperature: 28, primaryFlow: 100, secondaryFlow: 100, electricalOutput: 0, supplyFactor: 1 };
    const still = advanceProcessMotion(initial, cold, .1);
    assert.equal(still.angle, 0);
    assert.equal(still.steam, 0);
    assert.equal(still.steamPhase, 0);
    assert.ok(still.supplyPhase > 0); // External grid supplies pumps even while cold.
    const hot = { ...cold, temperature: 286, secondaryTemperature: 184, electricalOutput: 260 };
    let motion = initial;
    for (let i=0; i<100; i++) motion = advanceProcessMotion(motion, hot, .1);
    assert.ok(motion.speed > .6 && motion.speed < 1);
    assert.ok(motion.steam > .8);
    assert.ok(motion.heat > .7);
    const coast = advanceProcessMotion(motion, { ...hot, electricalOutput: 0 }, .1);
    assert.ok(coast.speed > 0 && coast.speed < motion.speed);
    assert.ok(coast.angle !== motion.angle);
    const blackout = advanceProcessMotion(motion, { ...hot, primaryFlow: 0, secondaryFlow: 0, electricalOutput: 0, supplyFactor: 0 }, .1);
    assert.equal(blackout.steam, 0);
    assert.equal(blackout.heat, 0);
    assert.equal(blackout.supplyPhase, motion.supplyPhase);
    assert.equal(blackout.steamPhase, motion.steamPhase);
    assert.deepEqual(advanceProcessMotion(motion, hot, 0), { ...motion, steam: coast.steam, heat: coast.heat });
    assert.deepEqual(advanceProcessMotion(motion, hot, 30), advanceProcessMotion(motion, hot, .1));
});


test('generator rotates whenever output is reported even below the steam visual threshold', () => {
    let motion = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
    const signals = { temperature: 90, secondaryTemperature: 35.6, primaryFlow: 100, secondaryFlow: 100, electricalOutput: 203, supplyFactor: 1 };
    for (let i=0; i<40; i++) motion = advanceProcessMotion(motion, signals, .1);
    assert.ok(motion.speed > .4);
    assert.ok(motion.angle > 0);
    assert.equal(motion.steam, 0);
    assert.equal(motion.steamPhase, 0);
});

test('reaction illustration follows actual core power independently of steam, shaft and retained heat', () => {
    const initial = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0, reactionPhase: 0 };
    const cold = { temperature: 30, secondaryTemperature: 28, primaryFlow: 0, secondaryFlow: 0, fuelTemperature: 30, electricalOutput: 0, reactorPower: 0, supplyFactor: 1 };
    assert.equal(advanceProcessMotion(initial, cold, .1).reactionPhase, 0);
    const active = advanceProcessMotion(initial, { ...cold, reactorPower: 50 }, .1);
    assert.ok(active.reactionPhase > 0);
    assert.equal(active.steam, 0);
    assert.equal(active.speed, 0);
    const stopped = advanceProcessMotion(active, { ...cold, fuelTemperature: 500 }, .1);
    assert.equal(stopped.reactionPhase, active.reactionPhase);
    assert.ok(stopped.thermalPhase > 0, 'Retained-heat illustration stays independent');
    assert.equal(advanceProcessMotion(active, { ...cold, reactorPower: 50 }, 0).reactionPhase, active.reactionPhase);
});

test('higher actual reaction activity speeds particle travel and fuel pulses, with faster withdrawn channels', () => {
    const initial = { reactionPhase: .2, reactionChannels: [{phase:.2},{phase:.2}] };
    const low = advanceReactorMotion(initial, { reactorActive: true, reactorPower: 10, reactorFuelCapability: 1,
        reactorRods: [{ position: 90, target: 0 }, { position: 90, target: 0 }] }, .1);
    const high = advanceReactorMotion(initial, { reactorActive: true, reactorPower: 80, reactorFuelCapability: 1,
        reactorRods: [{ position: 20, target: 100 }, { position: 20, target: 100 }] }, .1);
    assert.ok(high.reactionRate > low.reactionRate * 3);
    assert.ok(high.reactionPhase - initial.reactionPhase > (low.reactionPhase - initial.reactionPhase) * 3);
    const uneven = advanceReactorMotion(initial, { reactorActive: true, reactorPower: 50,
        reactorRods: [{ position: 90 }, { position: 20 }] }, .1);
    assert.ok(uneven.reactionChannels[1].rate > uneven.reactionChannels[0].rate);
    assert.ok(uneven.reactionChannels[1].phase > uneven.reactionChannels[0].phase);
    // A new request by itself must not change read-back-driven motion.
    const targetOnly = advanceReactorMotion(initial, { reactorActive: true, reactorPower: 10, reactorFuelCapability: 1,
        reactorRods: [{ position: 90, target: 100 }, { position: 90, target: 100 }] }, .1);
    assert.deepEqual(targetOnly, low);
});

test('reaction speed changes preserve phase, and Stop or depleted fuel freeze every channel', () => {
    const previous = { reactionPhase: .42, reactionChannels: [{ phase: .63 }] };
    const signals = { reactorActive: true, reactorPower: 80, reactorFuelCapability: 1, reactorRods: [{ position: 20 }] };
    const paused = advanceReactorMotion(previous, signals, 0);
    assert.equal(paused.reactionPhase, previous.reactionPhase);
    assert.equal(paused.reactionChannels[0].phase, previous.reactionChannels[0].phase);
    for (const override of [{reactorActive:false}, {reactorFuelCapability:0}]) {
        const stopped = advanceReactorMotion(previous, {...signals, ...override, fuelTemperature:600}, .1);
        assert.equal(stopped.reactionActivity, 0);
        assert.equal(stopped.reactionRate, 0);
        assert.equal(stopped.reactionPhase, previous.reactionPhase);
        assert.equal(stopped.reactionChannels[0].phase, previous.reactionChannels[0].phase);
        assert.equal(stopped.reactionChannels[0].rate, 0);
    }
});
