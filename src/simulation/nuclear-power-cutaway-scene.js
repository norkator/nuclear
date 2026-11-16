/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Shared draw-only cutaways for the plant overview and dedicated stations.
export function buildExchangerCutaway(view, position = [-1.3, 0, -1.5]) {
    const exchanger = view.component('exchanger', position);
    view.pad(exchanger, 3, 3.2);
    for (const x of [-.8, .8]) view.box(exchanger, [.24, 1.2, 1.2], view.darkSteel, [x, .65, 0]);
    view.mesh(exchanger, new THREE.CylinderGeometry(1, 1, 3.8, 10, 1, true, Math.PI / 2, Math.PI),
        view.material('#7a9caa', { side: THREE.DoubleSide }), [0, 3.3, 0]);
    for (const y of [1.4, 5.2]) view.cylinder(exchanger, 1.07, .22, view.steelLight, [0, y, 0]);
    view.cylinder(exchanger, .94, .6, view.steel, [0, 5.6, 0], .45);
    for (let i = 0; i < 5; i++) {
        const x = -.65 + i * .32;
        view.line(exchanger, [[x, 1.6, .3], [x, 4.65, .3], [x, 4.8, -.3], [x, 1.6, -.3]], view.hotPipe, .065);
    }
    view.exchangerGlow = view.material('#f4b166', { emissive: '#e7a256', emissiveIntensity: .2 });
    for (const y of [2.3, 3.4, 4.5]) view.box(exchanger, [1.5, .07, .12], view.exchangerGlow, [0, y, .5]);
    // Steam stays inside the secondary-side cutaway, then turns into its
    // outlet. It shares the existing steam phase, not a separate animation.
    const steamGeometry = new THREE.IcosahedronGeometry(1, 1);
    view.exchangerSteam = Array.from({ length: 15 }, () => {
        const material = view.material('#def6f2', {
            transparent: true, opacity: 0, depthWrite: false, metalness: 0,
            emissive: '#b8e1db', emissiveIntensity: .25,
        });
        const puff = view.mesh(exchanger, steamGeometry, material);
        puff.visible = false;
        puff.renderOrder = 1;
        puff.raycast = () => {}; // Selecting steam still picks the equipment behind it.
        view.dynamicMeshes.push(puff);
        return puff;
    });
    view.valve('exchanger', 'secondaryValve', [1.25, 4.3, 0], [0, -1, 0]);
    view.valve('exchanger', 'bypass', [-1.4, 2.5, .6], [0, 1, 0]);

}

export function buildTurbineCutaway(view, position = [6, 0, -1.5]) {
    const turbine = view.component('turbine', position);
    view.pad(turbine, 6, 3);
    for (const x of [-1, 1, 3]) view.box(turbine, [.38, 1.9, 1.3], view.darkSteel, [x, 1.1, 0]);
    const shell = view.mesh(turbine, new THREE.CylinderGeometry(.65, 1.1, 3.1, 12, 1, true, Math.PI, Math.PI),
        view.material('#799baa', { side: THREE.DoubleSide }), [0, 2.8, 0]);
    shell.rotation.z = Math.PI / 2;
    view.turbineRotor = new THREE.Group();
    view.turbineRotor.position.set(0, 2.8, 0);
    turbine.add(view.turbineRotor);
    view.cylinder(view.turbineRotor, .1, 6.3, view.steelLight, [1, 0, 0]).rotation.z = Math.PI / 2;
    view.turbineBladePoses = [];
    for (let i = 0; i < 5; i++) {
        const x = -1.15 + i * .56;
        for (let blade = 0; blade < 8; blade++) {
            const angle = blade / 8 * TAU;
            const radius = .43 + i * .07;
            view.turbineBladePoses.push({ x, y: Math.cos(angle) * radius * .65, z: Math.sin(angle) * radius * .65, angle, scale: radius * .75 / .4 });
        }
    }
    const bladeGeometry = new THREE.BoxGeometry(.09, .4, .16);
    view.geometries.add(bladeGeometry);
    view.turbineBlades = new THREE.InstancedMesh(bladeGeometry, view.steelLight, 40);
    view.turbineRotor.add(view.turbineBlades);
    view.turbineFragments = new THREE.InstancedMesh(bladeGeometry, view.steelLight, 40);
    view.turbineFragments.frustumCulled = false;
    view.turbineFragments.count = 0;
    turbine.add(view.turbineFragments);
    view.instancedMeshes.push(view.turbineBlades, view.turbineFragments);
    view.dynamicMeshes.push(view.turbineBlades, view.turbineFragments);
    view.turbineTransform = new THREE.Object3D();
    const generator = view.stationId
        ? view.mesh(turbine, new THREE.CylinderGeometry(.84, .84, 1.8, 16, 1, true, Math.PI, Math.PI), view.material('#64c9b5', { side: THREE.DoubleSide }), [3.15, 2.8, 0])
        : view.cylinder(turbine, .84, 1.8, view.teal, [3.15, 2.8, 0]);
    if (view.stationId) generator.userData.equipment = 'generatorLoading';
    generator.rotation.z = Math.PI / 2;
    for (const x of [2.4, 3.9]) view.cylinder(turbine, .88, .12, view.steelLight, [x, 2.8, 0]).rotation.z = Math.PI / 2;
    view.generatorLamp = view.box(turbine, [.65, .12, .5], view.material('#4d7d6d', { emissive: '#57e3a6', emissiveIntensity: 0 }), [3.15, 3.68, 0]);
    view.valve('turbine', 'admission', [-1.7, 3.4, 0]);

}

export function buildCondenserCutaway(view, position = [7, 0, 3.1]) {
    const condenser = view.component('condenser', position);
    view.pad(condenser, 4.2, 2.6);
    view.box(condenser, [3.7, 1.45, 1.8], view.steel, [0, 1.05, 0]);
    view.box(condenser, [3.2, 1.1, .05], view.darkSteel, [0, 1.08, .93]);
    for (let i = 0; i < 6; i++) view.box(condenser, [.1, 1, .1], view.coolPipe, [-1.3 + i * .52, 1.08, .98]);
    view.drops = Array.from({ length: 7 }, (_, i) => view.mesh(condenser, view.dotGeometry, view.coolMarker, [-1.3 + i * .43, 1.4, 1.1]));
    view.valve('condenser', 'coolingValve', [1.8, 1.3, 0]);
}

export function updateTurbineCutaway(view, sim, motion) {
    view.turbineRotor.rotation.x = motion.angle * Math.PI / 180;
    const lost = sim.components.turbineIntegrity.bladesLost, transform = view.turbineTransform;
    if (lost !== view.turbineBladesLost) {
        for (const [index, pose] of view.turbineBladePoses.entries()) {
            transform.position.set(pose.x, pose.y, pose.z); transform.rotation.set(pose.angle, 0, 0);
            transform.scale.set(1, pose.scale, 1); if (index < lost) transform.scale.setScalar(0);
            transform.updateMatrix(); view.turbineBlades.setMatrixAt(index, transform.matrix);
        }
        view.turbineBlades.instanceMatrix.needsUpdate = true;
        view.turbineBladesLost = lost;
    }
    view.turbineFragments.count = motion.turbineFragments?.length || 0;
    for (const [index, fragment] of (motion.turbineFragments || []).entries()) {
        const pose = view.turbineBladePoses[fragment.blade];
        transform.position.set(pose.x + fragment.x, Math.max(.24, 2.8 + pose.y + fragment.y), pose.z + fragment.z);
        transform.rotation.set(fragment.spin * Math.PI / 180, fragment.spin * .007, 0); transform.scale.set(1, pose.scale, 1);
        transform.updateMatrix(); view.turbineFragments.setMatrixAt(index, transform.matrix);
    }
    if (view.turbineFragments.count) view.turbineFragments.instanceMatrix.needsUpdate = true;
    view.generatorLamp.material.emissiveIntensity = sim.electricalOutput > .1 ? .7 : 0;
}

export function updateExchangerCutaway(view, motion, theme) {
    view.exchangerGlow.emissiveIntensity = motion.heat * (.4 + .4 * Math.sin(motion.heatPhase * TAU) ** 2);
    for (const [index, puff] of view.exchangerSteam.entries()) {
        const phase = (motion.steamPhase + index / view.exchangerSteam.length) % 1;
        const turn = clamp((phase - .72) / .28, 0, 1);
        const lane = index % 3 - 1;
        puff.position.set(
            (lane * .48 + Math.sin(phase * TAU + index) * .06) * (1 - turn) + turn * 1.05,
            2.1 + Math.min(1, phase / .8) * 2.6,
            .64 * (1 - turn),
        );
        const size = .1 + Math.sin(phase * Math.PI) * .14;
        puff.scale.set(size * 1.2, size * 1.45, size);
        puff.rotation.y = phase * TAU;
        puff.material.opacity = motion.steam * .48 * Math.sin(phase * Math.PI);
        puff.material.color.set(theme === 'light' ? '#82b5b3' : '#def6f2');
        puff.visible = puff.material.opacity > .012;
    }
}

