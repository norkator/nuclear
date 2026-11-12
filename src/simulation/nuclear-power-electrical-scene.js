/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { setText } from './nuclear-power-presentation.js';
import { PUMP_LAYOUT } from './nuclear-power-pump-scene.js';

const TAU = Math.PI * 2;

// The retained diesel cutaways share the plant renderer, camera and lifecycle.
function buildEngine(view, id, x, z) {
        const group = view.component(`diesel${id}`, [x, 0, z]);
        group.scale.setScalar(.46);
        view.pad(group, 9, 5.7);
        for (const mount of [-2.4, 2.4]) view.box(group, [1, .4, 2], view.rubber, [mount, .35, 0]);
        view.box(group, [5.4, .5, 1.9], view.teal, [-.7, .75, 0]);
        view.box(group, [4.2, 1.5, .35], view.teal, [-.8, 1.7, -.7]);
        view.box(group, [4.4, .35, 1.8], view.teal, [-.8, 2.85, 0]);
        const pistons = [];
        const crank = new THREE.Group();
        crank.position.set(-.7, 1.12, .45);
        group.add(crank);
        view.dynamicGroups.push(crank);
        view.cylinder(crank, .12, 5.8, view.steelLight, [.5, 0, 0], .12, 8).rotation.z = Math.PI / 2;
        for (let i = 0; i < 4; i++) {
            const px = -2.3 + i * 1.05;
            const piston = new THREE.Group();
            piston.position.set(px, 2, .45);
            group.add(piston);
            view.dynamicGroups.push(piston);
            view.cylinder(piston, .34, .38, view.steelLight, [0, 0, 0], .34, 8);
            view.cylinder(piston, .35, .05, view.darkSteel, [0, .12, 0], .35, 8);
            view.box(piston, [.1, .8, .12], view.brass, [0, -.55, 0]);
            pistons.push(piston);
            view.cylinder(crank, .24, .18, view.brass, [px + .7, 0, .2], .24, 8).rotation.z = Math.PI / 2;
            view.box(group, [.12, .9, 1.35], view.steel, [px + .48, 2.1, -.03]);
        }
        view.line(group, [[-2.4, 3.05, -.4], [-2.4, 3.5, -.4], [.8, 3.5, -.4], [.8, 3.05, -.4]], view.darkSteel, .12);
        view.cylinder(group, .45, .4, view.rubber, [-.9, 3.8, -.4], .45, 8);
        view.line(group, [[.8, 2.8, -.6], [1.2, 3.1, -.6], [1.2, 4.5, -.6], [1.8, 4.5, -.6]], view.darkSteel, .16);
        view.box(group, [1.1, 2.6, 2], view.steel, [-3.7, 1.8, -.1]);
        for (let fin = 0; fin < 7; fin++) view.box(group, [.8, .08, .08], view.darkSteel, [-3.7, .85 + fin * .3, 1]);
        const fan = new THREE.Group();
        fan.position.set(-3.7, 1.8, 1.12);
        group.add(fan);
        view.dynamicGroups.push(fan);
        view.mesh(group, new THREE.TorusGeometry(.62, .07, 4, 12), view.darkSteel, [-3.7, 1.8, 1.1]);
        view.cylinder(fan, .13, .15, view.teal, [0, 0, 0]).rotation.x = Math.PI / 2;
        for (let i = 0; i < 5; i++) {
            const angle = i / 5 * TAU;
            const blade = view.box(fan, [.19, .45, .08], view.teal, [Math.sin(angle) * .3, Math.cos(angle) * .3, 0]);
            blade.rotation.z = -angle + .35;
        }
        const alternator = view.cylinder(group, .85, 2.3, view.teal, [2.65, 1.5, 0]);
        alternator.rotation.z = Math.PI / 2;
        for (const ax of [1.6, 3.7]) view.cylinder(group, .9, .12, view.steel, [ax, 1.5, 0]).rotation.z = Math.PI / 2;
        const rotor = new THREE.Group();
        rotor.position.set(3.82, 1.5, 0);
        group.add(rotor);
        view.dynamicGroups.push(rotor);
        for (let i = 0; i < 6; i++) {
            const angle = i / 6 * TAU;
            const blade = view.box(rotor, [.08, .55, .16], view.steelLight, [0, Math.cos(angle) * .42, Math.sin(angle) * .42]);
            blade.rotation.x = angle;
        }
        const terminalMaterial = view.material('#4a6d61', { emissive: '#78ffc3', emissiveIntensity: 0 });
        view.box(group, [.7, .45, .8], view.darkSteel, [2.6, 2.5, 0]);
        view.box(group, [.45, .1, .4], terminalMaterial, [2.6, 2.78, .1]);
        const fill = view.box(group, [3.3, 1.1, .85], view.brass, [-.8, .9, 2]);
        view.dynamicMeshes.push(fill);
        view.box(group, [3.7, .15, 1.15], view.darkSteel, [-.8, .3, 2]);
        view.box(group, [3.7, .15, 1.15], view.steel, [-.8, 1.55, 2]);
        for (const side of [-2.6, 1]) view.box(group, [.1, 1.1, 1], view.steel, [side, .9, 2]);
        view.line(group, [[1, 1.3, 2], [1.3, 1.3, 2], [1.3, 1.3, .3]], view.brass, .055);
        view.engines.set(id, { group, crank, pistons, fan, rotor, fill, terminalMaterial });
}

export const ELECTRICAL_LABELS = [
    ['dieselA', 'DG-A', 'Diesel A', [4.3, 3.1, -6.3]],
    ['dieselB', 'DG-B', 'Diesel B', [9, 3.1, -6.3]],
    ['grid', 'GRID', 'External grid', [.5, 3.1, -6.7]],
    ['bus', 'AC BUS', 'Pump supply', [.2, 2.5, -3.9]],
];

export function buildElectricalScene(view) {
    view.engines = new Map();
    view.electricalPaths = [];
    view.rubber = view.material('#192b33');
    view.brass = view.material('#d9a353');
    buildEngine(view, 'A', 4.3, -6.3);
    buildEngine(view, 'B', 9, -6.3);
    const grid = view.component('grid', [.5, 0, -6.7]);
    view.pad(grid, 1.9, 1.7);
    view.box(grid, [1.35, 2, 1.1], view.steel, [0, 1.15, 0]);
    view.box(grid, [1.1, 1.5, .06], view.darkSteel, [0, 1.2, .58]);
    view.gridLamp = view.material('#55756a', { emissive: '#75f0b3', emissiveIntensity: 0 });
    view.box(grid, [.8, .14, .07], view.gridLamp, [0, 1.75, .64]);
    const bus = view.component('bus', [.2, 0, -3.9]);
    view.pad(bus, 1.8, 1.3);
    view.box(bus, [1.3, 1.7, .8], view.steel, [0, .95, 0]);
    view.box(bus, [1.05, 1.25, .06], view.darkSteel, [0, 1, .44]);
    view.busLamp = view.material('#4c6c60', { emissive: '#75f0b3', emissiveIntensity: 0 });
    for (const x of [-.3, 0, .3]) view.box(bus, [.14, .13, .07], view.busLamp, [x, 1.45, .49]);

    const markerMaterial = view.material('#a5efba', { emissive: '#67b48c', emissiveIntensity: .3 });
    const markerGeometry = new THREE.OctahedronGeometry(.09);
    const wire = (source, points, pumpId = null) => {
        const material = view.material('#786e49', { emissive: '#61bb8a', emissiveIntensity: 0 });
        const vectors = view.line(view.scene, points, material, .045);
        const path = new THREE.CurvePath();
        for (let i = 1; i < vectors.length; i++) path.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]));
        const particles = view.particles(view.scene, markerGeometry, markerMaterial, 6);
        const entry = { source, material, path, particles, markers: particles.items, pumpId };
        view.electricalPaths.push(entry);
        return entry;
    };
    for (const [id, x] of [['A', 4.3], ['B', 9]]) {
        const route = wire(`diesel${id}`, [[x + 1.2, 1.2, -6.3], [x + 1.2, .28, -4.85], [.2, .28, -4.85], [.2, .9, -3.9]]);
        Object.assign(view.engines.get(id), { markers: route.markers, path: route.path, wireMaterial: route.material });
    }
    wire('grid', [[.5, .8, -6.7], [.5, .28, -5.2], [.2, .28, -5.2], [.2, .9, -3.9]]);
    wire('turbine', [[9.1, 2.8, -1.5], [10.6, 2.8, -1.5], [10.6, .28, -3.4], [.2, .28, -3.4], [.2, .9, -3.9]]);
    for (const pump of PUMP_LAYOUT) wire('bus', [[.2, .28, -3.9], [pump.x, .28, -3.9], [pump.x, .28, pump.z], [pump.x, .9, pump.z]], pump.id);
}

export function updateElectricalScene(view, supply, phases, busPhase, sim) {
    for (const generator of supply.generators) {
        const engine = view.engines.get(generator.id);
        const phase = (phases?.[generator.id] || 0) / 360;
        engine.crank.rotation.x = engine.rotor.rotation.x = phase * TAU;
        engine.fan.rotation.z = phase === 0 ? 0 : -phase * TAU;
        for (const [index, piston] of engine.pistons.entries()) piston.position.y = 2 + Math.sin((phase + index / 4) * TAU) * .26;
        engine.fill.scale.y = Math.max(.001, generator.fuel / 100);
        engine.fill.position.y = .35 + .55 * generator.fuel / 100;
        const loaded = generator.state === 'RUNNING' && generator.load > 0;
        engine.terminalMaterial.emissiveIntensity = loaded ? .9 : 0;
        const state = generator.state === 'RUNNING' ? loaded ? 'SUPPLYING' : 'RUNNING / UNLOADED' : generator.state;
        const label = view.labels.get(`diesel${generator.id}`);
        setText(label.reading, `${state} · ${generator.fuel.toFixed(0)}% fuel`);
        label.button.classList.toggle('selected', loaded);
    }
    view.busLamp.emissiveIntensity = supply.factor > 0 ? .8 : 0;
    view.gridLamp.emissiveIntensity = supply.source.includes('GRID') ? .8 : 0;
    setText(view.labels.get('grid').reading, supply.source.includes('GRID') ? 'SUPPLYING' : supply.gridAvailable ? 'AVAILABLE' : 'ISOLATED');
    setText(view.labels.get('bus').reading, supply.factor > 0 ? `${supply.demand.toFixed(2)} MW` : 'NO AC SUPPLY');
    for (const route of view.electricalPaths) {
        const loaded = route.source === 'bus' ? supply.factor > 0 && (!route.pumpId || sim[route.pumpId]) : route.source.startsWith('diesel')
            ? supply.generators.find(generator => generator.id === route.source.slice(-1)).load > 0
            : supply.source.includes(route.source === 'grid' ? 'GRID' : 'TURBINE');
        route.material.emissiveIntensity = loaded ? .5 : 0;
        for (const [index, marker] of route.markers.entries()) {
            marker.visible = loaded;
            if (loaded) marker.position.copy(route.path.getPoint((busPhase + index / route.markers.length) % 1));
        }
        route.particles.update();
    }
}
