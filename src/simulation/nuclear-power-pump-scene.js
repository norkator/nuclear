/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { PUMPS } from './nuclear-power-pumps.js';
import { leakSources, waterJetPoint } from './nuclear-power-leaks.js';
export const PUMP_LAYOUT = [
    { id: 'pumpA', x: -4.8, z: 3.7 }, { id: 'pumpA2', x: -4.8, z: 6.1 },
    { id: 'pumpB', x: 2.2, z: 4.4 }, { id: 'pumpB2', x: 2.2, z: 6.8 },
];
export const PIPE_LAYOUT = [
    { id: 'primaryPipes', position: [-7.4, 1.2, 2.3] },
    { id: 'secondaryPipes', position: [.7, 1.2, 3.7] },
];
export function buildPumpScene(view) {
    view.pumpParts = {};
    for (const { id, x, z } of PUMP_LAYOUT) {
        const definition = PUMPS.find(pump => pump.id === id);
        const pump = view.component(id, [x, 0, z]);
        view.pad(pump, 2.25, 2);
        view.box(pump, [1.5, .65, 1.2], view.darkSteel, [0, .5, 0]);
        view.cylinder(pump, .66, .9, view.steel, [0, 1.2, -.1]).rotation.x = Math.PI / 2;
        const bearings = view.material('#c2b276'), blades = view.material('#64c9b5'), fittings = view.material('#a9c5cd');
        view.mesh(pump, new THREE.TorusGeometry(.66, .09, 4, 12), bearings, [0, 1.2, .4]);
        const rotor = new THREE.Group(); rotor.position.set(0, 1.2, .48); pump.add(rotor);
        view.cylinder(rotor, .14, .16, bearings, [0, 0, 0]).rotation.x = Math.PI / 2;
        for (let i = 0; i < 4; i++) {
            const angle = i / 4 * Math.PI * 2;
            const blade = view.box(rotor, [.23, .43, .08], blades, [Math.sin(angle) * .29, Math.cos(angle) * .29, 0]);
            blade.rotation.z = -angle + .4;
        }
        view.pumps[id] = rotor;
        view.valve(id, 'dischargeValve', [1, 1.1, 0]);
        view.cylinder(pump, .22, .12, fittings, [-.87, 1.2, 0]).rotation.z = Math.PI / 2;
        view.box(pump, [.65, .13, .4], definition.backup ? view.brass || view.trim : view.teal, [0, .85, .65]);
        view.pumpParts[id] = { blades, bearings, fittings };
        const circuit = definition.circuit === 'primary' ? 'A' : 'B';
        const key = definition.circuit === 'primary' ? 'primaryReturn' : 'secondaryReturn';
        const inlet = circuit === 'A' ? -3.3 : 4, outlet = circuit === 'A' ? -7.4 : .7;
        const headerZ = circuit === 'A' ? 2.3 : 3.7;
        view.flow([[inlet, 1.2, headerZ], [inlet, 1.2, z], [x, 1.2, z], [outlet, 1.2, z], [outlet, 1.2, headerZ]], circuit, 'water', view.material('#4c9eac'), key, id);
    }
    view.leaks = new Map();
    const water = view.material('#64c9f2', { transparent: true, opacity: .85, emissive: '#286287', emissiveIntensity: .25, roughness: .15 });
    const geometry = new THREE.IcosahedronGeometry(.065, 0); view.geometries.add(geometry);
    const cracks = view.material('#c06d46');
    for (const entry of [...PIPE_LAYOUT, ...PUMP_LAYOUT.map(pump => ({ id: pump.id, position: [pump.x - .85, 1.2, pump.z] }))]) {
        const drops = new THREE.InstancedMesh(geometry, water, 18);
        view.scene.add(drops); view.instancedMeshes.push(drops); view.dynamicMeshes.push(drops);
        const scar = view.mesh(view.scene, new THREE.TorusGeometry(.17, .035, 4, 8), cracks, entry.position);
        view.dynamicMeshes.push(scar);
        const puddle = view.mesh(view.scene, new THREE.CircleGeometry(.6, 16), water, [entry.position[0] + .45, -.13, entry.position[2]]);
        puddle.rotation.x = -Math.PI / 2; view.dynamicMeshes.push(puddle);
        view.leaks.set(entry.id, { ...entry, drops, scar, puddle });
        if (entry.id.endsWith('Pipes')) {
            const inspection = view.component(entry.id, entry.position);
            view.cylinder(inspection, .2, .16, view.steelLight, [0, 0, 0]).rotation.z = Math.PI / 2;
        }
    }
    view.leakTransform = new THREE.Object3D();
}

export function updatePumpScene(view, sim, motion, pumps) {
    for (const definition of PUMPS) {
        view.pumps[definition.id].rotation.z = pumps[definition.key].angle * Math.PI / 180;
        const parts = sim.condition.components[definition.key].parts;
        for (const part of ['blades', 'bearings', 'fittings']) {
            const material = view.pumpParts[definition.id][part];
            material.color.set(parts[part] > 1 ? '#c56445' : part === 'blades' ? '#64c9b5' : part === 'bearings' ? '#c2b276' : '#a9c5cd');
            material.emissive.set('#be4526'); material.emissiveIntensity = parts[part] / 200;
        }
    }
    for (const source of leakSources(sim)) {
        const leak = view.leaks.get(source.id), flowing = source.rate > .01;
        leak.drops.visible = flowing;
        leak.scar.visible = source.damage > 0;
        leak.puddle.visible = flowing;
        leak.puddle.scale.setScalar(Math.min(1.5, .25 + source.rate / 30));
        if (!flowing) continue;
        for (let index = 0; index < leak.drops.count; index++) {
            const point = waterJetPoint(motion.leakPhase || 0, index, leak.drops.count, source.pressure);
            view.leakTransform.position.set(leak.position[0] + point.x, leak.position[1] + point.y, leak.position[2] + point.z);
            view.leakTransform.scale.set(.65 * point.size, point.size * 1.6, .65 * point.size);
            view.leakTransform.rotation.z = -.6;
            view.leakTransform.updateMatrix(); leak.drops.setMatrixAt(index, view.leakTransform.matrix);
        }
        leak.drops.instanceMatrix.needsUpdate = true;
    }
}
