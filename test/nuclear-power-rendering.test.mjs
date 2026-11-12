/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPolylinePath, flowMarkerDistance } from '../src/simulation/nuclear-power-motion.js';
import { ParticleBatch } from '../src/simulation/nuclear-power-particles.js';
import { PlantOverviewScene } from '../src/simulation/nuclear-power-scene.js';

test('explicit offscreen viewport resizing clamps labels without drawing WebGL or resuming frame-time layout reads', () => {
    let draws = 0, reads = 0;
    const button = { style: {}, textContent: 'Pump A', className: 'plant-scene-label',
        get offsetWidth() { reads++; return 110; }, get offsetHeight() { reads++; return 40; } };
    const label = { button, anchor: new THREE.Vector3(100, 0, 0), width: 110, height: 40 };
    const view = Object.assign(Object.create(PlantOverviewScene.prototype), {
        disposed: false, visible: false, width: 1400, height: 600,
        host: { clientWidth: 360, clientHeight: 400, dataset: { labels: 'compact' }, hidden: false },
        renderer: { setSize() {}, render() { draws++; } },
        camera: new THREE.OrthographicCamera(-14, 14, 9, -9, .1, 120),
        scene: new THREE.Scene(), target: new THREE.Vector3(0, 2.6, .5),
        zoom: 1.2, yaw: .24, pitch: .7, labels: new Map([['pumpA', label]]), featureLabels: [],
    });
    view.resize();
    assert.equal(view.width, 360);
    const left = Number.parseFloat(button.style.left);
    assert.ok(left >= 55 && left + 55 <= 360, 'Label follows the new narrow viewport while offscreen');
    assert.equal(draws, 0);
    assert.equal(reads, 2, 'Only the explicit resize measures label dimensions');
    view.render();
    assert.equal(draws, 0);
    assert.equal(reads, 2);
    view.setVisible(true); view.render();
    assert.equal(draws, 1);
    assert.equal(reads, 2, 'Returning to view reuses the measured dimensions');
});

test('schematic particles follow the same distance through corners and wrap without SVG layout reads', () => {
    const path = createPolylinePath([[610, 160], [790, 160], [790, 210]]);
    assert.equal(path.length, 230);
    assert.equal(path.d, 'M610 160L790 160L790 210');
    for (const [distance, point] of [
        [-5, { x: 610, y: 160 }], [0, { x: 610, y: 160 }],
        [100, { x: 710, y: 160 }], [180, { x: 790, y: 160 }],
        [200, { x: 790, y: 180 }], [230, { x: 790, y: 210 }],
        [300, { x: 790, y: 210 }],
    ]) assert.deepEqual(path.pointAtDistance(distance), point);
    const before = path.pointAtDistance(flowMarkerDistance(179, 0, 6, path.length));
    const after = path.pointAtDistance(flowMarkerDistance(182, 0, 6, path.length));
    assert.equal(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), 3);
    assert.deepEqual(path.pointAtDistance(flowMarkerDistance(235, 0, 6, path.length)), { x: 615, y: 160 });
    const duplicate = createPolylinePath([[0, 0], [0, 0], [0, 5], [-5, 5]]);
    assert.deepEqual(duplicate.pointAtDistance(7), { x: -2, y: 5 });
    assert.deepEqual(createPolylinePath([[2, 3], [2, 3]]).pointAtDistance(10), { x: 2, y: 3 });
});

test('particle batches preserve independent poses and compact hidden particles without stale instances', () => {
    const parent = new THREE.Group();
    const geometry = new THREE.OctahedronGeometry(.1);
    const material = new THREE.MeshStandardMaterial();
    const batch = new ParticleBatch(parent, geometry, material, 3);
    assert.equal(parent.children.length, 1, 'Only the batch participates in scene traversal');
    const [a, hidden, b] = batch.items;
    a.visible = b.visible = true;
    a.position.set(1, 2, 3); a.scale.set(1, 2, 1);
    b.position.set(4, 5, 6); b.rotation.z = .5;
    batch.update();
    const matrix = new THREE.Matrix4();
    assert.equal(batch.mesh.count, 2);
    assert.equal(batch.mesh.visible, true);
    batch.mesh.getMatrixAt(0, matrix); assert.deepEqual(matrix.elements, a.matrix.elements);
    batch.mesh.getMatrixAt(1, matrix);
    matrix.elements.forEach((value, index) => assert.ok(Math.abs(value - b.matrix.elements[index]) < 1e-6));
    a.visible = b.visible = false;
    const version = batch.mesh.instanceMatrix.version;
    batch.update(); batch.update();
    assert.equal(batch.mesh.count, 0);
    assert.equal(batch.mesh.visible, false);
    assert.equal(batch.mesh.instanceMatrix.version, version, 'Inactive effects must not upload matrices');
    hidden.visible = true; hidden.position.set(-3, 0, 1);
    batch.update();
    assert.equal(batch.mesh.count, 1);
    batch.mesh.getMatrixAt(0, matrix);
    assert.deepEqual(matrix.elements, hidden.matrix.elements);
    assert.equal(batch.mesh.frustumCulled, false, 'Moving particles cannot inherit an obsolete bounding sphere');
    batch.mesh.dispose(); geometry.dispose(); material.dispose();
});
