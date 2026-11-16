/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { EquipmentStationScene } from '../src/simulation/nuclear-power-stations-scene.js';
import { EQUIPMENT_STATIONS } from '../src/simulation/nuclear-power-stations-config.js';
import { advanceProcessMotion } from '../src/simulation/nuclear-power-motion.js';
import { PUMPS } from '../src/simulation/nuclear-power-pumps.js';

// Exercise the real shared geometry and adapters without creating a browser/GPU.
function cutaway(id) {
    const view = Object.assign(Object.create(EquipmentStationScene.prototype), {
        host: { dataset: { stationEquipment: id }, replaceChildren() {} },
        scene: new THREE.Scene(), target: new THREE.Vector3(),
        geometries: new Set(), materials: new Set(), groups: new Map(), labels: new Map(), featureLabels: [],
        paths: [], fuel: [], rods: [], valves: [], pumps: {}, dynamicGroups: [], dynamicMeshes: [], instancedMeshes: [],
        visible: true, disposed: false, abort: new AbortController(),
        renderer: { dispose() {}, forceContextLoss() {} }, render() { this.draws = (this.draws || 0) + 1; },
    });
    view.build(); view.batchStaticMeshes(); return view;
}
const pumps = Object.fromEntries(PUMPS.map(pump => [pump.key, { angle: 0, travel: 0 }]));
const motion = advanceProcessMotion({ angle: 0, speed: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 }, {}, 0);

test('every batched station keeps separately pickable parts and builds only the selected equipment', () => {
    for (const definition of EQUIPMENT_STATIONS) {
        const id = definition.id === 'pumps' ? 'pumpB2' : definition.id, view = cutaway(id);
        const parts = new Set(); view.scene.traverse(object => { if (object.userData.equipment) parts.add(object.userData.equipment); });
        for (const [part] of definition.parts) assert.ok(parts.has(part), `${id}: ${part} remains pickable after batching`);
        assert.deepEqual([...view.groups.keys()], [id], 'No hidden plant or unrelated pumps are built');
        view.dispose(); assert.equal(view.disposed, true);
    }
});

test('station poses follow actual motor/valves, retain requests separately, skip hidden draws and never advance the plant', () => {
    const sim = new NuclearPowerSimulation(), view = cutaway('pumpB2');
    sim.setComponentSetting('pumpB2', 'dischargeValve', 35);
    const before = sim.snapshot();
    view.update(sim, motion, { ...pumps, B2: { angle: 90, travel: 0 } }, 'dark');
    assert.equal(view.pumps.pumpB2.rotation.z, Math.PI / 2);
    assert.notEqual(view.valves[0].request.rotation.y, view.valves[0].handle.rotation.y);
    assert.deepEqual(sim.snapshot(), before);
    view.setVisible(false); const draws = view.draws;
    view.update(sim, motion, pumps, 'light');
    assert.equal(view.draws, draws); assert.equal(view.pumps.pumpB2.rotation.z, Math.PI / 2);
    view.dispose();
});

test('station damage and cooling illustrations use retained actual condition and the shared motion clock', () => {
    const sim = new NuclearPowerSimulation(), turbine = cutaway('turbine'), exchanger = cutaway('exchanger'), condenser = cutaway('condenser');
    sim.components.turbineIntegrity.damage = 50;
    turbine.update(sim, { ...motion, angle: 120 }, pumps, 'dark');
    assert.equal(turbine.turbineBladesLost, 20);
    const matrix = new THREE.Matrix4(); turbine.turbineBlades.getMatrixAt(0, matrix);
    assert.equal(new THREE.Vector3().setFromMatrixScale(matrix).length(), 0, 'Lost blades are absent in the detailed station');
    exchanger.update(sim, motion, pumps, 'dark'); assert.equal(exchanger.deposits.visible, false);
    sim.components.items.exchanger.actual.fouling = 45;
    exchanger.update(sim, motion, pumps, 'dark'); assert.equal(exchanger.deposits.visible, true);
    condenser.update(sim, { ...motion, steam: 1 }, pumps, 'dark'); assert.ok(condenser.drops.every(drop => drop.visible));
    sim.components.items.condenser.actual.coolingFactor = 0;
    condenser.update(sim, { ...motion, steam: 1 }, pumps, 'dark'); assert.ok(condenser.drops.every(drop => !drop.visible));
    for (const view of [turbine, exchanger, condenser]) view.dispose();
});
