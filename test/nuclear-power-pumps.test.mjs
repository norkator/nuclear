/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { PUMPS, parallelFlow, PRESSURE_LIMIT } from '../src/simulation/nuclear-power-pumps.js';
import { maintenanceItems } from '../src/simulation/nuclear-power-maintenance.js';
import { leakSources, waterJetPoint } from '../src/simulation/nuclear-power-leaks.js';
import { advanceProcessMotion } from '../src/simulation/nuclear-power-motion.js';
import { gridDispatchCapacity } from '../src/simulation/nuclear-power-grid.js';
const advance = (sim, seconds) => { for (let i = 0; i < seconds * 4; i++) sim.tick(.25); };
const cold = () => { const sim = new NuclearPowerSimulation(); sim.setFluctuations(false); sim.setGridDispatchEnabled(false); return sim; };

test('all four pumps start cold and independent; either pump in each circuit permits explicit startup', () => {
    const sim = cold();
    for (const pump of PUMPS) {
        assert.equal(sim[pump.id], false); assert.equal(sim[`${pump.id}Speed`], 100);
        assert.equal(sim.components.items[pump.id].actual.speed, 0);
    }
    sim.togglePump('A2'); sim.togglePump('B2'); advance(sim, 8);
    assert.ok(sim.primaryFlow > 95 && sim.secondaryFlow > 95);
    assert.equal(sim.pumpA, false); assert.equal(sim.pumpB, false);
    assert.equal(sim.circulationReady(), true); assert.equal(sim.startupReadiness().ready, true);
    assert.equal(sim.running, false); sim.start(); assert.equal(sim.running, true);
    assert.equal(sim.snapshot().commands.pumps.A2.enabled, true);
    assert.ok(sim.readings().signals.pumpA2Speed.value > 95);
});

test('parallel pumps increase actual flow and pressure, consume additional AC, and retain independent speed/valves', () => {
    assert.equal(parallelFlow([100, 0]), 100); assert.equal(parallelFlow([100, 100]), 135);
    const sim = cold(); sim.togglePump('A'); sim.togglePump('A2'); advance(sim, 5);
    assert.ok(sim.primaryFlow > 120); assert.ok(sim.hydraulics.pipes.primary.pressure > PRESSURE_LIMIT);
    assert.equal(sim.hydraulics.pipes.primary.damage, 0, 'A short pressure transient must not instantly break pipes');
    assert.ok(Math.abs(sim.supply.demand - 7.2) < .01);
    const total = sim.components.items.pumpA.actual.flow + sim.components.items.pumpA2.actual.flow;
    assert.ok(Math.abs(total - sim.hydraulics.pipes.primary.suppliedFlow) < 1e-8);
    sim.setPumpSpeed('A2', 40); sim.setComponentSetting('pumpA2', 'dischargeValve', 50); advance(sim, 20);
    assert.ok(sim.components.items.pumpA2.actual.speed > 39 && sim.components.items.pumpA2.actual.speed < 41);
    assert.ok(sim.components.items.pumpA2.actual.flow < sim.components.items.pumpA.actual.flow);
    assert.ok(sim.hydraulics.pipes.primary.pressure < PRESSURE_LIMIT);
    assert.equal(sim.pumpASpeed, 100);
});

test('sustained overpressure damages pipes and pump internals, leaks reduce delivered flow, and pause freezes damage', () => {
    const sim = cold(); sim.togglePump('A'); sim.togglePump('A2'); advance(sim, 75);
    const pipe = sim.hydraulics.pipes.primary;
    assert.ok(pipe.damage > 0); assert.ok(pipe.leakRate > 0);
    assert.ok(sim.primaryFlow < pipe.suppliedFlow);
    for (const key of ['A', 'A2']) for (const part of ['blades', 'bearings', 'fittings']) assert.ok(sim.condition.components[key].parts[part] > 0, `${key} ${part}`);
    assert.equal(sim.condition.components.B2.damage, 0);
    assert.ok(sim.alarms.some(alarm => alarm.id === 'primary-leak'));
    assert.match(sim.condition.incident.cause, /overpressure/);
    const before = structuredClone(sim.hydraulics.pipes); sim.togglePause(); advance(sim, 60);
    assert.deepEqual(sim.hydraulics.pipes, before);
    sim.togglePause();
    assert.ok(maintenanceItems(sim).some(item => item.id === 'primaryPipes'));
});

test('pipe repair requires both pumps OFF and coast-down; preserves heat, fuel, settings and trip latches', () => {
    const sim = cold(); sim.togglePump('A'); sim.togglePump('A2'); advance(sim, 35); sim.trip();
    const damage = sim.hydraulics.pipes.primary.damage;
    assert.ok(damage > 0); assert.equal(sim.componentAction('primaryPipes', 'repair'), false);
    sim.setPumpSpeed('A', 0); sim.setPumpSpeed('A2', 0); advance(sim, 20);
    assert.equal(sim.hydraulics.pipes.primary.leakRate, 0);
    assert.equal(sim.componentAction('primaryPipes', 'repair'), false, 'Zero speed alone does not isolate an enabled pump');
    sim.togglePump('A'); sim.togglePump('A2');
    const fuel = structuredClone(sim.fuel), heat = sim.condition.heatReserve;
    sim.repairComponents();
    assert.equal(sim.hydraulics.pipes.primary.damage, 0);
    assert.equal(sim.condition.components.A2.damage, 0);
    assert.equal(sim.tripped, true); assert.equal(sim.running, false);
    assert.equal(sim.condition.heatReserve, heat); assert.deepEqual(structuredClone(sim.fuel), fuel);
    assert.equal(sim.pumpA2Speed, 0);
    sim.reset(); assert.equal(sim.pumpA2, false); assert.equal(sim.pumpB2, false);
    assert.equal(sim.hydraulics.pipes.primary.damage, 0);
});

test('Auto controls enabled pumps without starting backups; manual overrides persist, AC loss coasts all four', () => {
    const sim = cold(); sim.togglePump('A'); sim.togglePump('B'); advance(sim, 8); sim.start(); advance(sim, 20);
    assert.equal(sim.pumpA2, false); assert.equal(sim.pumpB2, false); assert.equal(sim.pumpA2Speed, 100);
    sim.togglePump('A2'); sim.setComponentOverride('pumpA2', true); sim.setPumpSpeed('A2', 72); advance(sim, 20);
    assert.equal(sim.pumpA2Speed, 72); assert.equal(sim.components.items.pumpA2.override, true);
    sim.stop(); sim.supply.command(sim, 'A', 'stop'); sim.supply.command(sim, 'B', 'stop'); sim.supply.setGrid(sim, false);
    advance(sim, 20);
    for (const pump of PUMPS) assert.ok(sim.components.items[pump.id].actual.speed < .1);
    assert.equal(sim.running, false); assert.equal(sim.pumpA2, true);
    sim.supply.setGrid(sim, true); advance(sim, 10);
    assert.ok(sim.components.items.pumpA2.actual.speed > 60); assert.equal(sim.running, false);
});

test('individual pump deterioration does not damage its redundant peer; full bearing failure stops that motor', () => {
    const sim = cold(); sim.injectFault('pump-wear'); advance(sim, 60);
    assert.ok(sim.condition.flowFactor('A') < .5);
    assert.equal(sim.condition.flowFactor('A2'), 1);
    sim.injectFault('none'); sim.togglePump('A2'); sim.togglePump('B2'); advance(sim, 10);
    assert.ok(sim.primaryFlow > 90); assert.equal(sim.condition.components.A2.damage, 0);
    sim.condition.components.A2.parts.bearings = 100; sim.condition.components.A2.damage = 100; advance(sim, 20);
    assert.ok(sim.components.items.pumpA2.actual.speed < .1);
    assert.equal(sim.components.items.pumpA2.actual.available, false);
    assert.equal(sim.pumpA2, true, 'A failed motor must not pretend that its requested switch was turned off');
});

test('water spray follows retained damage and actual flow, uses falling drops, and freezes without frame time', () => {
    const sim = cold(); sim.hydraulics.pipes.primary.damage = 20;
    assert.equal(leakSources(sim).find(source => source.id === 'primaryPipes').rate, 0);
    sim.togglePump('A'); advance(sim, 8);
    assert.ok(leakSources(sim).find(source => source.id === 'primaryPipes').rate > 0);
    const signals = { primaryFlow: 135, secondaryFlow: 135, leakActivity: 10, temperature: 30, secondaryTemperature: 28, electricalOutput: 0, supplyFactor: 1 };
    const initial = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
    const next = advanceProcessMotion(initial, signals, .1);
    assert.ok(next.leakPhase > 0); assert.equal(next.primaryTravel, .27);
    assert.equal(advanceProcessMotion(next, signals, 0).leakPhase, next.leakPhase);
    assert.equal(advanceProcessMotion(next, { ...signals, leakActivity: 0 }, .1).leakPhase, next.leakPhase);
    const drop = waterJetPoint(.8, 0, 14, 180);
    assert.ok(drop.x > 0 && drop.y < 0, 'A pressurized jet travels outward and falls');
});

test('grid dispatch and Auto use the shared circulation target with four enabled pumps and derate damaged branches', () => {
    const sim = cold(); for (const pump of PUMPS) sim.togglePump(pump.key);
    advance(sim, 6); sim.start(); advance(sim, 180);
    assert.ok(Math.abs(sim.primaryFlow - sim.autoFlow) < 2);
    assert.ok(Math.abs(sim.secondaryFlow - sim.autoFlow) < 2);
    assert.equal(sim.hydraulics.damaged, false, 'Normal Auto operation must trim the enabled pump pairs before sustained damage');
    const capacity = gridDispatchCapacity(sim);
    assert.ok(capacity > 200 && capacity <= 300);
    sim.setGridDispatchEnabled(true); const request = sim.requestGridDispatch(); sim.setGridDispatchEnabled(false);
    assert.ok(request.targetMw <= capacity); advance(sim, 180);
    assert.ok(Math.abs(sim.electricalOutput - request.targetMw) < 5);
    for (const key of ['B', 'B2']) {
        sim.setComponentOverride(`pump${key}`, true); sim.setPumpSpeed(key, 25);
        sim.condition.components[key].parts.bearings = 30; sim.condition.components[key].damage = 30;
    }
    assert.ok(gridDispatchCapacity(sim) < capacity / 2);
});
