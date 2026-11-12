/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { ComponentProcesses, COMPONENT_SETTINGS, COMPONENT_ACTIONS, COMPONENT_OBJECTIVES, COMPONENT_SCENARIOS } from '../src/simulation/nuclear-power-components.js';

const advance = (s, seconds) => { for (let n = 0; n < seconds * 4; n++) s.tick(0.25); };
const startPumps = s => { s.togglePump('A'); s.togglePump('B'); advance(s, 6); };
const manual = () => {
    const s = new NuclearPowerSimulation();
    s.setFluctuations(false); s.setAutoMode(false); startPumps(s); s.start(); advance(s, 60);
    return s;
};
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} expected near ${expected}`);

test('schema and independent cold sessions expose a usable default checklist and unchanged transfer', () => {
    const a = new NuclearPowerSimulation(), b = new NuclearPowerSimulation();
    assert.ok(a.components instanceof ComponentProcesses);
    assert.deepEqual(Object.keys(COMPONENT_SETTINGS).sort(), ['condenser', 'exchanger', 'primaryPipes', 'pumpA', 'pumpA2', 'pumpB', 'pumpB2', 'secondaryPipes', 'turbine']);
    for (const [id, fields] of Object.entries(COMPONENT_SETTINGS)) {
        assert.ok(COMPONENT_ACTIONS[id].length >= 5);
        for (const field of fields) assert.ok(field.key && field.label && field.type);
        assert.equal(typeof a.components.items[id].response, 'string');
        assert.equal(typeof a.components.items[id].tau, 'number');
    }
    assert.equal(a.components.transferFactor, 1);
    assert.equal(a.startupReadiness().ready, false);
    assert.equal(a.electricalOutput, 0);
    advance(a, 20);
    assert.equal(a.components.items.turbine.actual.shaftSpeed, 0);
    assert.equal(a.running, false);
    a.setComponentSetting('pumpA', 'dischargeValve', 20);
    assert.equal(b.components.items.pumpA.settings.dischargeValve, 100);
    assert.equal(a.setComponentSetting('unknown', 'speed', 40), false);
    assert.equal(a.setComponentSetting('pumpA', 'speed', NaN), false);
    assert.equal(a.setComponentSetting('pumpA', 'speed', Infinity), false);
    a.setComponentSetting('pumpA', 'trim', 100); assert.equal(a.components.items.pumpA.settings.trim, 25);
});

test('pump discharge controls flow independently from speed, while AC remains authoritative', () => {
    const s = manual();
    const p = s.components.items.pumpA;
    s.setComponentSetting('pumpA', 'dischargeValve', 40);
    assert.equal(p.actual.dischargeValve, 100);
    advance(s, 15);
    assert.ok(s.primaryFlow < 44 && s.primaryFlow > 35);
    assert.ok(p.actual.speed > 99);
    s.supply.setGrid(s, false); s.supply.setTurbine(s, false);
    for (const g of s.supply.generators) s.supply.command(s, g.id, 'stop');
    advance(s, 20);
    assert.ok(p.actual.speed < 1); assert.ok(s.primaryFlow < 1);
    assert.equal(p.actual.available, false);
});

test('Auto pump override holds a speed target, trim changes actuation, legacy guard stays intact', () => {
    const s = new NuclearPowerSimulation(); s.setFluctuations(false); startPumps(s); s.start(); advance(s, 80);
    assert.equal(s.setComponentSetting('pumpA', 'speed', 60), false);
    const before = s.pumpASpeed; s.setPumpSpeed('A', 40); assert.equal(s.pumpASpeed, before);
    assert.equal(s.setComponentOverride('pumpA', true), true);
    s.setPumpSpeed('A', 72); assert.equal(s.pumpASpeed, 72); assert.equal(s.components.items.pumpA.settings.speed, 72);
    assert.equal(s.setComponentSetting('pumpA', 'speed', 70), true);
    s.setComponentSetting('pumpA', 'trim', -5);
    advance(s, 20);
    assert.equal(s.pumpASpeed, 70); near(s.primaryFlow, 65, 0.1);
    s.togglePump('A'); advance(s, 2); assert.equal(s.pumpA, false);
    s.setComponentOverride('pumpA', false); advance(s, 1); assert.equal(s.pumpA, false);
});

test('each exchanger setting has a gradual, causal effect on transfer and reported output', () => {
    for (const [key, value] of [['bypass', 50], ['secondaryValve', 50], ['effectiveness', 50], ['fouling', 50]]) {
        const s = manual(); const before = s.electricalOutput;
        s.setComponentSetting('exchanger', key, value);
        assert.equal(s.components.items.exchanger.actual.transferFactor, 1);
        advance(s, 12);
        assert.ok(s.components.items.exchanger.actual.transferFactor < 0.52, key);
        assert.ok(s.electricalOutput < before * 0.56, key);
        assert.ok(s.condition.coolingMargin < 0, key);
    }
});

test('condenser valve and warmer inlet reduce cooling without overwriting requested values', () => {
    const s = manual();
    s.setComponentSetting('condenser', 'coolingValve', 50);
    s.setComponentSetting('condenser', 'inletTemperature', 60);
    assert.equal(s.components.items.condenser.actual.inletTemperature, 20);
    advance(s, 15);
    near(s.components.items.condenser.actual.coolingFactor, 0.25, 0.01);
    assert.ok(s.temperature > 300);
    assert.equal(s.components.items.condenser.settings.inletTemperature, 60);
});

test('authoritative electrical output feeds supply, snapshot, history and incident records', () => {
    const s = manual();
    assert.ok(s.electricalOutput > 200);
    s.setComponentSetting('turbine', 'breaker', false);
    assert.equal(s.electricalOutput, 0);
    s.supply.advance(s, 0);
    assert.equal(s.supply.source, 'EXTERNAL GRID');
    s.condition.beginIncident(s, 'Test output loss'); s.record('Sample'); s.sample();
    assert.equal(s.snapshot().signals.electricalOutput.value, 0);
    assert.equal(s.history.at(-1).electricalOutput, 0);
    assert.equal(s.condition.incident.timeline.at(-1).electricalMw, 0);
    advance(s, 10);
    assert.ok(s.components.items.turbine.actual.shaftSpeed > 95);
    assert.equal(s.turbineReadiness().ready, true);
    assert.equal(s.setComponentSetting('turbine', 'breaker', true), true);
    assert.ok(s.electricalOutput > 200);
    const snapshot = s.snapshot(); snapshot.components.items.pumpA.settings.speed = 0;
    assert.notEqual(s.components.items.pumpA.settings.speed, 0);
});

test('Auto can establish shaft readiness with an open breaker, but never closes it', () => {
    const s = new NuclearPowerSimulation();
    s.setGridDispatchEnabled(false); // Isolate breaker readiness at the fixed target.
    assert.equal(s.setComponentSetting('turbine', 'breaker', false), true);
    assert.equal(s.setComponentSetting('turbine', 'breaker', true), false);
    startPumps(s); s.start(); advance(s, 60);
    assert.equal(s.running, true);
    assert.equal(s.components.items.turbine.settings.breaker, false);
    assert.equal(s.electricalOutput, 0);
    assert.ok(s.components.items.turbine.actual.shaftSpeed > 90);
    assert.equal(s.turbineReadiness().ready, true);
    assert.equal(s.setComponentSetting('turbine', 'breaker', true), true);
    advance(s, 100); near(s.electricalOutput, 200, 5);
});

test('governor response and load ramp bound actuator/output changes; admission affects shaft', () => {
    const s = manual();
    s.setComponentSetting('turbine', 'governorResponse', 10);
    s.setComponentSetting('turbine', 'admission', 50);
    advance(s, 1);
    assert.ok(s.components.items.turbine.actual.admission > 90);
    advance(s, 40);
    assert.ok(s.components.items.turbine.actual.shaftSpeed < 60);
    s.setComponentSetting('turbine', 'loadRamp', 1);
    s.setComponentSetting('turbine', 'admission', 100);
    const before = s.electricalOutput;
    advance(s, 1);
    assert.ok(s.electricalOutput <= before + 1.01);
    assert.ok(s.electricalOutput > before);
});

test('turbine trip and reset cannot restart either machine or close the breaker', () => {
    const s = manual(); const t = s.components.items.turbine;
    assert.equal(s.componentAction('turbine', 'trip'), true);
    assert.equal(t.settings.admission, 0); assert.equal(s.electricalOutput, 0);
    assert.equal(s.setComponentSetting('turbine', 'admission', 100), false);
    assert.equal(s.componentAction('turbine', 'start'), false);
    assert.equal(s.componentAction('turbine', 'reset'), false);
    s.trip(); advance(s, 180);
    assert.equal(s.componentAction('turbine', 'reset'), true);
    assert.equal(s.tripped, true); assert.equal(s.running, false);
    assert.equal(t.settings.breaker, false); assert.equal(t.settings.admission, 0);
    advance(s, 2); assert.ok(t.actual.shaftSpeed < 1);
    s.resetTrip(); s.start(); advance(s, 20);
    assert.equal(t.actual.shaftSpeed < 1, true);
    assert.equal(s.componentAction('turbine', 'start'), true);
    advance(s, 60); assert.ok(t.actual.shaftSpeed > 90);
    assert.equal(t.settings.breaker, false);
});

test('pulse expires and continuous period/amplitude control repeatable component disturbances', () => {
    const s = manual(); const d = s.components.items.pumpB.disturbance;
    s.setComponentSetting('pumpB', 'disturbanceAmplitude', 40);
    s.setComponentSetting('pumpB', 'disturbancePeriod', 4);
    s.componentAction('pumpB', 'pulse'); advance(s, 1);
    near(d.value, 0.4); assert.ok(s.secondaryFlow < 90);
    advance(s, 5); assert.equal(d.value, 0);
    s.componentAction('pumpB', 'oscillate'); advance(s, 2); near(d.value, 0.4);
    advance(s, 2); near(d.value, 0);
    s.componentAction('pumpB', 'clear'); assert.equal(d.enabled, false);
});

test('progressive fault clearing preserves wear, cooldown service preserves heat, fuel and trip', () => {
    const s = manual(); const i = s.components.items.pumpA;
    s.componentAction('pumpA', 'fault'); advance(s, 45);
    assert.ok(i.disturbance.severity > 0.45); assert.ok(i.wear > 1);
    const wear = i.wear; s.componentAction('pumpA', 'clear');
    assert.equal(i.wear, wear);
    assert.equal(s.componentAction('pumpA', 'repair'), false);
    s.trip(); advance(s, 240);
    const heat = s.condition.heatReserve, reserve = s.fuel.remaining, hours = i.hours;
    assert.equal(s.componentAction('pumpA', 'repair'), true);
    assert.equal(i.wear, 0); assert.equal(s.condition.heatReserve, heat);
    assert.equal(s.fuel.remaining, reserve); assert.equal(s.tripped, true); assert.equal(s.running, false);
    assert.equal(i.hours, hours);
    assert.ok(s.components.maintenance.some(m => m.component === 'pumpA' && m.message.includes('service')));
});

test('pause freezes components, lifetime hours accumulate, histories and maintenance stay bounded', () => {
    const s = new NuclearPowerSimulation();
    assert.equal(s.components.items.pumpA.hours, 0);
    advance(s, 20);
    assert.equal(s.components.items.pumpA.hours, 0);
    s.togglePump('A'); s.togglePump('B'); advance(s, 180);
    const p = s.components.items.pumpA;
    near(p.hours, 0.05, 0.0001); assert.equal(p.history.length, 120);
    for (let n = 0; n < 130; n++) s.componentAction('pumpB', 'clear');
    assert.equal(s.components.maintenance.length, 100);
    assert.equal(s.components.items.pumpB.changes.length, 80);
    s.togglePause(); const state = structuredClone(s.snapshot().components); advance(s, 60);
    assert.deepEqual(s.snapshot().components, state);
});

test('scenario choices show symptoms; launching does not diagnose the fault in the journal', () => {
    const s = new NuclearPowerSimulation();
    assert.equal(COMPONENT_SCENARIOS.length, 4);
    startPumps(s);
    assert.equal(s.startupReadiness().ready, true);
    s.events = [];
    assert.equal(s.startScenario('flowDrift'), true);
    assert.equal(s.components.scenario.revealed, false);
    assert.equal(s.components.scenario.id, 'flowDrift');
    assert.ok(s.components.items.pumpA.disturbance.progressiveFault);
    assert.ok(s.events.length > 0);
    assert.ok(s.events.every(e => !/pumpA|restriction|deterioration|fault/i.test(e.message)));
    assert.equal(s.condition.incident.cause, s.components.scenario.symptom);
    assert.equal(s.startupReadiness().ready, false);
    s.start(); assert.equal(s.running, false);
    assert.equal(s.startScenario('invalid'), false);
});

test('objectives need sustained actual success and cannot reset trips or start the reactor', () => {
    const s = new NuclearPowerSimulation(); s.setFluctuations(false);
    assert.equal(COMPONENT_OBJECTIVES.length, 3);
    assert.equal(s.startObjective('reachMW'), true); advance(s, 30);
    assert.equal(s.components.objective.progress, 0); assert.equal(s.running, false);
    startPumps(s); s.start(); advance(s, 180); assert.equal(s.components.objective.status, 'completed');
    assert.equal(s.startObjective('recoverCooling'), true); advance(s, 21);
    assert.equal(s.components.objective.status, 'completed');
    s.stop(); advance(s, 100); s.supply.setGrid(s, false);
    s.startObjective('gridOutage'); advance(s, 35);
    assert.equal(s.components.objective.status, 'completed'); assert.equal(s.running, false);
    s.trip(); s.startObjective('recoverCooling'); advance(s, 25);
    assert.equal(s.components.objective.progress, 0); assert.equal(s.tripped, true);
});


test('component conditions also guard fuel renewal and the global cooled repair path', () => {
    const s = new NuclearPowerSimulation();
    s.componentAction('exchanger', 'fault');
    assert.equal(s.replaceAllFuel(), false);
    s.componentAction('exchanger', 'clear');
    s.components.items.exchanger.wear = 3;
    assert.equal(s.replaceAllFuel(), false);
    s.repairComponents();
    assert.equal(s.components.items.exchanger.wear, 0);
    assert.equal(s.replaceAllFuel(), true);
    assert.equal(s.running, false);
    assert.ok(s.components.maintenance.some(event=>event.component==='reactor' && event.message.includes('fuel')));
});

test('fouling can be introduced while running but cleaning requires cooled stopped service', () => {
    const s = manual();
    assert.equal(s.setComponentSetting('exchanger','fouling',20),true);
    assert.equal(s.setComponentSetting('exchanger','fouling',0),false);
    assert.equal(s.components.items.exchanger.settings.fouling,20);
    s.stop(); advance(s,240);
    assert.equal(s.componentAction('exchanger','repair'),true);
    assert.equal(s.components.items.exchanger.settings.fouling,0);
});
