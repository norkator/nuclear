/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { setText } from './nuclear-power-presentation.js';
import { CORE_CHANNELS } from './nuclear-power-model.js';
import { CHANNEL_PITCH, FUEL_HANDLING, FUEL_POOL_SLOTS } from './nuclear-power-refuelling.js';

export { CHANNEL_PITCH } from './nuclear-power-refuelling.js';
export const ROD_INSERTED_Y = 2.95;
export const ROD_TRAVEL = 1.95;

// Presentation adapter. The console owns cosmetic transfer state; inventory and
// replacement interlocks remain in the simulation. Racks start empty.
export function buildFuelHandlingHall(view, reactor) {
    const deckY = FUEL_HANDLING.deckY;
    const concrete = view.material('#889d9f', { metalness: 0, roughness: .94 });
    const cap = view.material('#c7d0c7', { metalness: .35 });
    const capAlternate = view.material('#a8b8b4', { metalness: .35 });
    const controlCap = view.material('#4a9f80');
    const orange = view.material('#bf602f');
    const yellow = view.material('#dbb756');
    const positionMarker = view.material('#d6fffa', { emissive: '#6dcec7', emissiveIntensity: .35 });
    const blue = view.material('#2587ab', { emissive: '#12566f', emissiveIntensity: .16 });
    const hall = new THREE.Group();
    hall.name = 'fuel-handling-hall';
    hall.position.x = reactor.position.x;
    view.scene.add(hall);

    // A low, tiled channel deck replaces the former cone. Both the caps and the
    // internal fuel/rod meshes use the core map's actual channel coordinates.
    view.cylinder(reactor, 1.83, .16, orange, [0, 6.1, 0], 1.83, 32);
    view.cylinder(reactor, 1.66, .035, view.darkSteel, [0, deckY, 0], 1.66, 32);
    const instances = (size, material, count) => {
        const geometry = new THREE.BoxGeometry(...size);
        view.geometries.add(geometry);
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        reactor.add(mesh);
        view.instancedMeshes.push(mesh);
        view.dynamicMeshes.push(mesh);
        return mesh;
    };
    const caps = instances([.305, .075, .305], view.material('#ffffff', { metalness: .35 }), CORE_CHANNELS.length);
    const handles = instances([.11, .025, .035], view.steel, CORE_CHANNELS.filter(channel => channel.fuelId).length);
    let handleIndex = 0;
    const rodIndicators = [];
    const deckChannels = CORE_CHANNELS.map((channel, capIndex) => {
        const x = channel.x * CHANNEL_PITCH;
        const z = channel.y * CHANNEL_PITCH;
        caps.setMatrixAt(capIndex, new THREE.Matrix4().makeTranslation(x, deckY + .04, z));
        caps.setColorAt(capIndex, (channel.rodId ? controlCap :
            (channel.x + channel.y) % 2 === 0 ? cap : capAlternate).color);
        const fuelHandle = channel.fuelId ? handleIndex++ : null;
        if (channel.rodId) {
            view.box(reactor, [.23, .018, .07], view.darkSteel, [x, deckY + .09, z]);
            const marker = view.box(reactor, [.055, .025, .08], positionMarker, [x - .085, deckY + .11, z]);
            view.dynamicMeshes.push(marker);
            rodIndicators.push({ rodIndex: Number(channel.rodId.slice(3)) - 1, x, marker });
        } else handles.setMatrixAt(fuelHandle, new THREE.Matrix4().makeTranslation(x, deckY + .09, z));
        return { id: channel.fuelId || channel.rodId, kind: channel.rodId ? 'control' : 'fuel',
            capIndex, handleIndex: fuelHandle,
            position: new THREE.Vector3(reactor.position.x + x, deckY + .1, z) };
    });
    for (let i = 0; i < 32; i++) {
        const angle = i / 32 * Math.PI * 2;
        const tile = view.box(reactor, [.17, .025, .12], i % 4 === 0 ? yellow : cap,
            [Math.cos(angle) * 1.73, deckY + .025, Math.sin(angle) * 1.73]);
        tile.rotation.y = -angle;
    }
    // Open-front guide chamber: no bare rods protrude through the top deck.
    // Aqua collars travel with the absorbers and stay legible against warm fuel.
    const rodMaterial = view.material('#c1fff4', { emissive: '#4ca79c', emissiveIntensity: .25, metalness: .45 });
    const rodCollars = view.rods.map(rod => {
        const collar = view.cylinder(rod, .105, .14, rodMaterial, [0, 1.02, 0], .105, 8);
        return collar;
    });
    for (const z of [-.9, 0, .9]) {
        for (const x of [-1.48, 1.48]) {
            view.cylinder(reactor, .035, 1.65, view.trim, [x, 5.2, z], .035, 6);
        }
    }

    // Pool lip and connecting service deck are at the same level as the channel
    // caps, leaving a clear route under the bridge from core to storage racks.
    const pool = new THREE.Group();
    pool.name = 'spent-fuel-pool';
    pool.position.set(0, 0, -4.75);
    pool.userData.equipment = 'spentFuel';
    view.groups.set('spentFuel', pool);
    hall.add(pool);
    view.box(pool, [5, .24, 4.2], concrete, [0, 1.9, 0]);
    view.box(pool, [4.5, .12, 3.7], blue, [0, 2.08, 0]);
    // Rear/left walls remain solid; front/right are cut down to reveal depth.
    view.box(pool, [5, 4.05, .26], concrete, [0, 4.02, -1.95]);
    view.box(pool, [.26, 4.05, 3.8], concrete, [-2.37, 4.02, 0]);
    view.box(pool, [5, .65, .26], concrete, [0, 2.35, 1.95]);
    view.box(pool, [.26, .65, 3.8], concrete, [2.37, 2.35, 0]);
    for (const z of [-2.02, 2.02]) view.box(pool, [5.15, .22, .35], view.steelLight, [0, 6.05, z]);
    for (const x of [-2.42, 2.42]) view.box(pool, [.35, .22, 4.35], view.steelLight, [x, 6.05, 0]);
    const water = view.box(pool, [4.45, 3.65, 3.65], view.material('#229fc4', {
        transparent: true, opacity: .17, depthWrite: false, metalness: .1, roughness: .3,
    }), [0, 3.98, 0]);
    water.name = 'spent-fuel-pool-water';
    water.renderOrder = 2;
    view.dynamicMeshes.push(water);
    const surface = view.box(pool, [4.45, .025, 3.65], view.material('#58cde3', {
        transparent: true, opacity: .32, depthWrite: false, roughness: .22,
        metalness: .25, emissive: '#167597', emissiveIntensity: .18,
    }), [0, 5.82, 0]);
    surface.renderOrder = 3;
    view.dynamicMeshes.push(surface);
    const poolSlots = [];
    for (let row = 0; row < 5; row++) {
        for (let column = 0; column < 7; column++) {
            const x = (column - 3) * .53;
            const z = (row - 2) * .62;
            // Hollow cells, with uprights and lips rather than pretend fuel.
            for (const dx of [-.22, .22]) {
                view.box(pool, [.04, 2.25, .43], view.darkSteel, [x + dx, 3.3, z]);
                view.box(pool, [.05, .08, .49], view.steelLight, [x + dx, 4.43, z]);
            }
            for (const dz of [-.23, .23]) view.box(pool, [.48, .08, .04], view.steelLight, [x, 4.43, z + dz]);
            poolSlots.push({ id: `SF-${String(poolSlots.length + 1).padStart(2, '0')}`,
                position: new THREE.Vector3(hall.position.x + x, 4.43, pool.position.z + z) });
        }
    }
    // Fixed highlights give the water a readable surface without adding an idle
    // animation, another timer or a fictional pool-cooling signal.
    for (const [x, z, length] of [[-.9, -.9, .7], [.8, .15, .9], [-.4, 1.2, .65]]) {
        view.box(pool, [length, .012, .025], view.steelLight, [x, 5.84, z]);
    }
    view.box(hall, [4.7, .18, 1.3], concrete, [0, 6.02, -2.12]);
    for (const x of [-2.15, 2.15]) {
        for (const z of [-2.45, -1.8]) view.cylinder(hall, .035, .7, yellow, [x, 6.45, z], .035, 6);
        view.line(hall, [[x, 6.8, -2.6], [x, 6.8, -1.6]], yellow, .035);
    }

    // Two longitudinal runways, a travelling bridge, transverse trolley, and a
    // hoist are separate groups so transfer animation need not rebuild
    // batched hall geometry. Parked over the pool, clear of the channel deck.
    for (const x of [-2.8, 2.8]) {
        for (const z of [-7.2, 2.15]) {
            view.box(hall, [.65, .22, .65], view.darkSteel, [x, .05, z]);
            view.box(hall, [.19, 10.05, .24], view.steel, [x, 5.05, z]);
            view.box(hall, [.38, .18, .65], view.darkSteel, [x, 9.88, z]);
        }
        view.box(hall, [.26, .32, 9.9], view.darkSteel, [x, 10.03, -2.5]);
        view.box(hall, [.08, .08, 9.9], view.steelLight, [x, 10.23, -2.5]);
    }
    const bridge = new THREE.Group();
    bridge.name = 'fuel-crane-bridge';
    bridge.position.set(0, 10.38, -4.75);
    hall.add(bridge);
    for (const z of [-.32, .32]) {
        view.box(bridge, [5.9, .38, .16], yellow, [0, 0, z]);
        view.box(bridge, [5.9, .07, .29], orange, [0, -.22, z]);
        for (let i = 0; i < 9; i++) {
            const brace = view.box(bridge, [.055, .34, .035], view.darkSteel, [-2.6 + i * .65, 0, z + .09]);
            brace.rotation.z = -.55;
        }
    }
    for (const x of [-2.8, 2.8]) {
        view.box(bridge, [.4, .2, 1.05], yellow, [x, -.25, 0]);
        for (const z of [-.4, .4]) view.cylinder(bridge, .13, .12, view.darkSteel, [x, -.32, z], .13, 8).rotation.z = Math.PI / 2;
    }
    const trolley = new THREE.Group();
    trolley.name = 'fuel-crane-trolley';
    trolley.position.y = .18;
    bridge.add(trolley);
    view.box(trolley, [1, .23, .95], view.darkSteel, [0, .12, 0]);
    view.box(trolley, [.75, .42, .68], yellow, [0, .4, 0]);
    view.cylinder(trolley, .2, .8, view.steel, [0, .55, 0], .2, 10).rotation.z = Math.PI / 2;
    const hoist = new THREE.Group();
    hoist.name = 'fuel-crane-hoist';
    trolley.add(hoist);
    const cables = new THREE.Group();
    cables.name = 'fuel-crane-cables';
    cables.scale.y = 1.8;
    hoist.add(cables);
    for (const x of [-.09, .09]) view.cylinder(cables, .018, 1, view.darkSteel, [x, -.5, 0], .018, 5);
    const grabber = new THREE.Group();
    grabber.name = 'fuel-crane-grabber';
    grabber.position.y = -1.8;
    hoist.add(grabber);
    view.box(grabber, [.38, .25, .36], yellow, [0, 0, 0]);
    for (const x of [-.13, .13]) {
        view.box(grabber, [.06, .3, .08], view.steelLight, [x, -.23, 0]);
        view.box(grabber, [.12, .06, .08], view.steelLight, [x * .7, -.4, 0]);
    }
    const spentMaterial = view.material('#b5a276', { metalness: .45 });
    const carriedFuel = new THREE.Group();
    carriedFuel.name = 'transferred-fuel-assembly';
    carriedFuel.visible = false;
    hall.add(carriedFuel);
    for (const x of [-.065, .065]) for (const z of [-.065, .065]) {
        view.cylinder(carriedFuel, .035, FUEL_HANDLING.assemblyHeight, spentMaterial, [x, 0, z], .035, 6);
    }
    for (const y of [-1.15, -.6, .6, 1.15]) view.box(carriedFuel, [.22, .055, .22], view.steelLight, [0, y, 0]);
    const storedGeometry = new THREE.BoxGeometry(.2, FUEL_HANDLING.assemblyHeight, .2);
    const storedFuel = FUEL_POOL_SLOTS.map(slot => {
        const mesh = view.mesh(hall, storedGeometry, spentMaterial, [slot.x, FUEL_HANDLING.storedFuelY, slot.z]);
        mesh.visible = false;
        view.dynamicMeshes.push(mesh);
        return mesh;
    });
    // Retain named coordinate spaces when batching static surfaces.
    view.dynamicGroups.push(hall, bridge, trolley, hoist, cables, grabber, carriedFuel);
    view.refuelling = { hall, deckY, deckChannels, rodCollars, rodIndicators,
        caps, handles, hiddenCapId: null,
        pool: { group: pool, water, surface, slots: poolSlots, storedFuel },
        crane: { bridge, trolley, hoist, cables, grabber, carriedFuel } };
}

export function updateFuelHandlingHall(view, animation) {
    const pose = animation.pose;
    const { hall, deckChannels, deckY, caps, handles, pool, crane } = view.refuelling;
    crane.bridge.position.z = pose.z;
    crane.trolley.position.x = pose.x;
    const cableLength = FUEL_HANDLING.bridgeY + FUEL_HANDLING.trolleyY - pose.grabberY;
    crane.cables.scale.y = cableLength;
    crane.grabber.position.y = -cableLength;
    crane.carriedFuel.visible = pose.carrying;
    crane.carriedFuel.position.set(pose.x, pose.grabberY - FUEL_HANDLING.gripOffset - FUEL_HANDLING.assemblyHeight / 2, pose.z);
    for (const [index, mesh] of pool.storedFuel.entries()) {
        mesh.visible = !!animation.samples[index];
        // A reserved rack stays empty until the crane actually releases its batch.
        if (animation.job?.slotIndex === index && !animation.job.deposited) mesh.visible = false;
    }
    for (const fuel of view.fuel) fuel.visible = !(pose.sourceHidden && fuel.userData.fuelId === pose.sourceId);
    const hiddenCapId = pose.openCap ? pose.sourceId : null;
    if (hiddenCapId !== view.refuelling.hiddenCapId) {
        for (const id of [view.refuelling.hiddenCapId, hiddenCapId].filter(Boolean)) {
            const channel = deckChannels.find(channel => channel.id === id);
            const matrix = new THREE.Matrix4().makeTranslation(channel.position.x - hall.position.x, deckY + .04, channel.position.z);
            if (id === hiddenCapId) matrix.scale(new THREE.Vector3(0, 0, 0));
            caps.setMatrixAt(channel.capIndex, matrix);
            matrix.elements[13] = deckY + .09;
            handles.setMatrixAt(channel.handleIndex, matrix);
        }
        caps.instanceMatrix.needsUpdate = true;
        handles.instanceMatrix.needsUpdate = true;
        view.refuelling.hiddenCapId = hiddenCapId;
    }
    const occupied = animation.samples.filter(Boolean).length;
    setText(view.featureLabels.find(label => label.id === 'fuel-crane').reading, pose.phase);
    const cooled = animation.samples.filter(sample => sample && animation.dispatchReadiness(sample.reference).ready).length;
    setText(view.featureLabels.find(label => label.id === 'spent-fuel-pool').reading, occupied
        ? `${occupied} ${occupied === 1 ? 'batch' : 'batches'} · ${cooled} cooled` : 'Empty storage racks');
}
