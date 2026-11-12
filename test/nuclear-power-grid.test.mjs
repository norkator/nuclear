/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { gridDispatchCapacity } from '../src/simulation/nuclear-power-grid.js';

const advance = (sim, seconds) => { for (let i = 0; i < seconds * 4; i++) sim.tick(.25); };
const operating = () => {
    const sim = new NuclearPowerSimulation();
    sim.setGridDispatchEnabled(false); // These scenarios deliver their own requests.
    sim.setFluctuations(false);
    sim.togglePump('A'); sim.togglePump('B');
    advance(sim, 6);
    sim.start();
    sim.setElectricalTarget(120);
    advance(sim, 240);
    assert.equal(sim.running, true);
    assert.equal(sim.tripped, false);
    return sim;
};

test('grid messages raise and lower the requested MW while actual output responds through the regulator', () => {
    const sim = operating();
    const initial = sim.electricalOutput;
    sim.setGridDispatchEnabled(true);
    const raise = sim.requestGridDispatch();
    assert.equal(raise.direction, 'RAISE');
    assert.equal(raise.targetMw, 160);
    assert.equal(sim.autoElectricalTarget, 160);
    assert.equal(sim.autoTemperature, raise.coreLimitC);
    assert.equal(sim.autoFlow, raise.circulationPercent);
    assert.equal(sim.electricalOutput, initial, 'A request cannot overwrite measured output');
    assert.equal(sim.snapshot().gridDispatch.lastRequest.id, 'GC-001');
    assert.equal(sim.snapshot().commands.followGridRequests, true);
    sim.setGridDispatchEnabled(false); // Hold this request while observing its response.
    advance(sim, 240);
    assert.ok(Math.abs(sim.electricalOutput - 160) < 2);
    sim.setGridDispatchEnabled(true);
    const lower = sim.requestGridDispatch();
    assert.equal(lower.direction, 'LOWER');
    assert.equal(lower.targetMw, 100);
    sim.setGridDispatchEnabled(false);
    advance(sim, 240);
    assert.ok(Math.abs(sim.electricalOutput - 100) < 2);
    assert.ok(sim.events.some(event => event.category === 'automation' && event.message.includes('GC-002')));
});

test('periodic grid requests follow simulated time and suspend during pause, stopped, Manual and temperature regulation', () => {
    const sim = new NuclearPowerSimulation();
    assert.equal(sim.gridDispatch.enabled, true);
    assert.equal(sim.snapshot().commands.followGridRequests, true);
    advance(sim, 60);
    assert.equal(sim.gridDispatch.remaining, 45);
    assert.equal(sim.gridDispatch.sequence, 0);
    assert.equal(sim.running, false);
    assert.equal(sim.requestGridDispatch(), null);
    sim.togglePump('A'); sim.togglePump('B'); advance(sim, 6); sim.start();
    advance(sim, 44);
    assert.equal(sim.gridDispatch.sequence, 0);
    advance(sim, 1);
    assert.equal(sim.gridDispatch.sequence, 1);
    assert.equal(sim.autoElectricalTarget, 240);
    const remaining = sim.gridDispatch.remaining;
    sim.togglePause(); advance(sim, 120);
    assert.equal(sim.gridDispatch.remaining, remaining);
    assert.equal(sim.requestGridDispatch(), null);
    sim.togglePause(); sim.setAutoMode(false); advance(sim, 20);
    assert.equal(sim.gridDispatch.remaining, remaining);
    assert.equal(sim.autoElectricalTarget, 240);
    sim.setAutoMode(true); sim.setAutoObjective('temperature'); advance(sim, 20);
    assert.equal(sim.gridDispatch.remaining, remaining);
    assert.equal(sim.requestGridDispatch(), null);
    sim.setAutoObjective('power'); advance(sim, 60);
    assert.equal(sim.gridDispatch.sequence, 2);
    assert.equal(sim.autoElectricalTarget, 180);
});

test('grid requests preserve trip recovery and Stop, and Reset demo restores following without restarting', () => {
    const sim = operating();
    sim.setGridDispatchEnabled(true);
    sim.requestGridDispatch();
    const sequence = sim.gridDispatch.sequence;
    const remaining = sim.gridDispatch.remaining;
    sim.trip(); advance(sim, 180);
    assert.equal(sim.requestGridDispatch(), null);
    assert.equal(sim.gridDispatch.sequence, sequence);
    assert.equal(sim.gridDispatch.remaining, remaining);
    assert.equal(sim.tripped, true);
    assert.equal(sim.running, false);
    sim.resetTrip(); advance(sim, 20);
    assert.equal(sim.tripped, false);
    assert.equal(sim.running, false);
    assert.equal(sim.requestGridDispatch(), null);
    sim.start(); sim.stop(); advance(sim, 20);
    assert.equal(sim.running, false);
    assert.equal(sim.gridDispatch.sequence, sequence);
    sim.setGridDispatchEnabled(false);
    sim.reset();
    assert.equal(sim.gridDispatch.enabled, true);
    assert.equal(sim.gridDispatch.lastRequest, null);
    assert.equal(sim.gridDispatch.remaining, 45);
    assert.equal(sim.gridDispatch.sequence, 0);
    assert.equal(sim.running, false);
    advance(sim, 60);
    assert.equal(sim.gridDispatch.sequence, 0);
    assert.equal(sim.autoElectricalTarget, 200);
});

test('grid targets remain bounded and preserve the core ceiling, rod overrides and explicit breaker ownership', () => {
    const sim = operating();
    sim.setGridDispatchEnabled(true);
    sim.setElectricalTarget(400);
    for (let i = 0; i < 30; i++) {
        const request = sim.requestGridDispatch();
        assert.ok(request.targetMw >= 0 && request.targetMw <= 400);
        assert.notEqual(request.targetMw, request.previousTargetMw);
        assert.equal(request.direction, request.targetMw > request.previousTargetMw ? 'RAISE' : 'LOWER');
    }
    sim.setElectricalTarget(400);
    sim.requestGridDispatch();
    // Operator overrides between messages still act as the regulator's ceiling.
    sim.setAutoTargets(150, 85);
    sim.gridDispatch.remaining = 1000;
    advance(sim, 240);
    assert.equal(sim.tripped, false);
    assert.ok(sim.temperature < 155);
    assert.ok(sim.electricalOutput < 160);
    assert.equal(sim.regulationLimit, 'Core temperature limit');
    assert.match(sim.gridDispatch.status(sim), /Limited: Core temperature limit/);
    sim.setRodOverride('CR-01', true); sim.setRod('CR-01', 85);
    sim.requestGridDispatch();
    assert.equal(sim.controlRods[0].manualOverride, true);
    assert.equal(sim.controlRods[0].target, 85);
    sim.setComponentSetting('turbine', 'breaker', false);
    sim.gridDispatch.remaining = 1000; advance(sim, 20);
    assert.equal(sim.components.items.turbine.settings.breaker, false);
    assert.equal(sim.electricalOutput, 0);
    assert.equal(sim.requestGridDispatch(), null);
});

test('normal grid requests fit available capacity and coordinate temperature and circulation for 240 MW', () => {
    const sim = operating();
    sim.setElectricalTarget(200);
    sim.setAutoTargets(286, 85);
    sim.setGridDispatchEnabled(true);
    const request = sim.requestGridDispatch();
    assert.equal(request.targetMw, 240);
    assert.equal(request.capacityMw, 300);
    assert.ok(request.circulationPercent > 85);
    assert.ok(request.coreLimitC > 286);
    sim.gridDispatch.remaining = 1000;
    advance(sim, 300);
    assert.ok(Math.abs(sim.electricalOutput - 240) < 2);
    assert.equal(sim.tripped, false);
    assert.ok(sim.temperature < 335);
    assert.equal(sim.gridDispatch.status(sim), 'Requested output reached');
    sim.setAutoTargets(1000, 100);
    assert.equal(sim.autoTemperature, 1000, 'Manual temperature entry has no 330 C cap');
    sim.setElectricalTarget(400);
    const reduced = sim.requestGridDispatch();
    assert.ok(reduced.targetMw <= 300);
    assert.equal(reduced.direction, 'LOWER');
});

test('dispatch capacity derates for equipment, fuel and operator-owned pumps/rods instead of issuing impossible demands', () => {
    const sim = operating();
    sim.setGridDispatchEnabled(true);
    const full = gridDispatchCapacity(sim);
    sim.components.items.exchanger.actual.transferFactor = .6;
    const restricted = gridDispatchCapacity(sim);
    assert.ok(restricted < full);
    sim.setElectricalTarget(300);
    assert.ok(sim.requestGridDispatch().targetMw <= restricted);
    sim.components.items.exchanger.actual.transferFactor = 1;
    sim.setComponentOverride('pumpA', true);
    sim.setComponentSetting('pumpA', 'speed', 40);
    assert.ok(gridDispatchCapacity(sim) < full);
    sim.setComponentOverride('pumpA', false);
    for (const rod of sim.controlRods) { rod.manualOverride = true; rod.target = 90; }
    assert.ok(gridDispatchCapacity(sim) < 50);
    sim.controlRods.forEach(rod => { rod.manualOverride = false; });
    sim.fuel.assemblies.forEach(assembly => { assembly.remaining = 0; });
    assert.equal(gridDispatchCapacity(sim), 0);
    assert.equal(sim.requestGridDispatch(), null);
});
