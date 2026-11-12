/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { condenserHeatRejection } from '../src/simulation/nuclear-power-cooling.js';
import { advanceProcessMotion } from '../src/simulation/nuclear-power-motion.js';
import { buildCoolingScene, updateCoolingScene } from '../src/simulation/nuclear-power-cooling-scene.js';
import { PlantOverviewScene } from '../src/simulation/nuclear-power-scene.js';

const hot = { secondaryTemperature: 184, secondaryFlow: 85, condenserCoolingFactor: 1, condenserInletTemperature: 20 };
const previous = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };

test('tower vapor follows actual heat rejection, including shutdown heat and cooling restrictions', () => {
    const normal = condenserHeatRejection(hot);
    assert.ok(normal > .8 && normal < 1);
    assert.ok(condenserHeatRejection({ ...hot, secondaryTemperature: 100 }) < normal);
    assert.ok(condenserHeatRejection({ ...hot, secondaryFlow: 40 }) < normal);
    assert.ok(condenserHeatRejection({ ...hot, condenserCoolingFactor: .2 }) < normal);
    assert.ok(condenserHeatRejection({ ...hot, condenserInletTemperature: 60 }) < normal);
    for (const change of [{ secondaryTemperature: 30 }, { secondaryFlow: 0 }, { condenserCoolingFactor: 0 }, { secondaryTemperature: NaN }]) {
        assert.equal(condenserHeatRejection({ ...hot, ...change }), 0);
    }
    assert.equal(condenserHeatRejection({ ...hot, running: false, electricalOutput: 0 }), normal);
    assert.equal(condenserHeatRejection({ ...hot, requestedMW: 650, requestedCoolingValve: 0 }), normal);
    assert.equal(condenserHeatRejection({ ...hot, secondaryTemperature: 10000, secondaryFlow: 135 }), 1);
});

test('cooling motion freezes at zero frame time, stops with unavailable cooling, and resets cold', () => {
    const signals = { ...hot, primaryFlow: 85, temperature: 286, electricalOutput: 200 };
    const active = advanceProcessMotion(previous, signals, .1);
    assert.ok(active.coolingTowerPhase > 0 && active.coolingWaterTravel > 0);
    const paused = advanceProcessMotion(active, signals, 0);
    assert.equal(paused.coolingTowerPhase, active.coolingTowerPhase);
    assert.equal(paused.coolingWaterTravel, active.coolingWaterTravel);
    const closed = advanceProcessMotion(active, { ...signals, condenserCoolingFactor: 0 }, .1);
    assert.equal(closed.coolingTower, 0);
    assert.equal(closed.coolingTowerPhase, active.coolingTowerPhase);
    assert.equal(closed.coolingWaterTravel, active.coolingWaterTravel);
    const cold = advanceProcessMotion(previous, { ...signals, secondaryTemperature: 25, secondaryFlow: 0 }, .1);
    assert.equal(cold.coolingTowerPhase, 0);
    assert.equal(cold.coolingWaterTravel, 0);
});

test('tower batches remove inactive vapor and water markers and retain registered GPU cleanup', () => {
    const view = Object.assign(Object.create(PlantOverviewScene.prototype), {
        scene: new THREE.Scene(), groups: new Map(), geometries: new Set(), materials: new Set(),
        instancedMeshes: [], dynamicMeshes: [], featureLabels: [],
        jointGeometry: new THREE.IcosahedronGeometry(1, 1),
    });
    for (const name of ['base', 'darkSteel', 'steelLight', 'coolMarker']) view[name] = view.material('#809da2');
    buildCoolingScene(view);
    const tower = view.coolingTower;
    try {
        updateCoolingScene(view, {}, 'dark');
        assert.equal(tower.plume.mesh.count, 0);
        assert.ok(tower.routes.every(route => !route.particles.mesh.visible));
        const low = { coolingTower: .1, coolingWater: .5, coolingTowerPhase: .2, coolingWaterTravel: 1 };
        updateCoolingScene(view, low, 'dark');
        const count = tower.plume.mesh.count, opacity = tower.vapor.uniforms.strength.value;
        assert.ok(count > 0);
        assert.ok(tower.routes.every(route => route.particles.mesh.count > 0));
        updateCoolingScene(view, { ...low, coolingTower: 1 }, 'light');
        assert.ok(tower.plume.mesh.count > count);
        assert.ok(tower.vapor.uniforms.strength.value > opacity);
        const transforms = Array.from(tower.plume.mesh.instanceMatrix.array);
        updateCoolingScene(view, { ...low, coolingTower: 1 }, 'light');
        assert.deepEqual(Array.from(tower.plume.mesh.instanceMatrix.array), transforms);
        const before = tower.plume.items.map(puff => puff.position.clone());
        updateCoolingScene(view, { ...low, coolingTower: 1, coolingTowerPhase: .3 }, 'light');
        for (const [index, puff] of tower.plume.items.entries()) {
            assert.equal(puff.position.x, before[index].x, 'Vapor must rise without spiraling or drifting sideways');
            assert.equal(puff.position.z, before[index].z);
            assert.notEqual(puff.position.y, before[index].y);
        }
        updateCoolingScene(view, {}, 'dark');
        const version = tower.plume.mesh.instanceMatrix.version;
        updateCoolingScene(view, {}, 'dark');
        assert.equal(tower.plume.mesh.visible, false);
        assert.equal(tower.plume.mesh.count, 0);
        assert.equal(tower.plume.mesh.instanceMatrix.version, version);
        assert.ok(view.materials.has(tower.vapor));
        assert.ok(view.geometries.has(tower.plume.mesh.geometry));
        assert.ok(view.instancedMeshes.includes(tower.plume.mesh));
    } finally {
        for (const mesh of view.instancedMeshes) mesh.dispose();
        for (const geometry of view.geometries) geometry.dispose();
        for (const material of view.materials) material.dispose();
        view.jointGeometry.dispose();
    }
});
