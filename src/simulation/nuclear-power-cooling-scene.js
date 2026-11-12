/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { flowMarkerDistance } from './nuclear-power-motion.js';
import { setText } from './nuclear-power-presentation.js';

const TAU = Math.PI * 2;
export const COOLING_TOWER = { x: 5.8, y: -.65, z: -12.4, height: 10.7, radius: 3.3, plumeCount: 42 };
export const COOLING_LABELS = [
    ['cooling-tower', 'CT-01', 'Cooling tower', 'No heat rejection', [8.7, 5.2, -12.4]],
    ['river-intake', 'RIVER', 'River make-up water', 'Replaces cooling-water losses', [11.3, -.2, -15.4]],
];

// A hyperboloid profile with a flared base and a narrower throat below the rim.
const radiusAt = y => 1.83 * Math.sqrt(1 + ((y - 8.1) / 4.9) ** 2);
function shellGeometry(from, to, inset = 0) {
    const steps = Math.max(2, Math.ceil((to - from) * 5));
    const points = Array.from({ length: steps + 1 }, (_, index) => {
        const y = from + (to - from) * index / steps;
        return new THREE.Vector2(radiusAt(y) - inset, y);
    });
    return new THREE.LatheGeometry(points, 48);
}

export function buildCoolingScene(view) {
    const { x, y, z, height, radius, plumeCount } = COOLING_TOWER;
    const tower = new THREE.Group();
    tower.name = 'cooling-tower';
    tower.position.set(x, y, z);
    // Clicking tower/water pipework opens the existing condenser controls.
    tower.userData.equipment = 'condenser';
    view.groups.set('coolingTower', tower);
    view.scene.add(tower);
    const concrete = view.material('#a6a7a2', { metalness: 0, roughness: .97, flatShading: false });
    const inside = view.material('#6f7676', { metalness: 0, roughness: 1, side: THREE.BackSide, flatShading: false });
    const red = view.material('#b93735', { metalness: 0, roughness: .9, flatShading: false });
    const bands = [[8.85, 9.15], [9.85, 10.15]];
    view.box(tower, [8.3, .22, 8.1], view.base, [0, -.13, 0]);
    view.cylinder(tower, radius + .17, .3, concrete, [0, .13, 0], radius + .17, 48);
    view.cylinder(tower, radius -.12, .035, view.material('#477e8a', { metalness: .2 }), [0, .3, 0], radius -.12, 48);
    // Open air-inlet arcade, with inclined paired concrete legs.
    for (let i = 0; i < 24; i++) {
        const angle = i / 24 * TAU;
        for (const lean of [-.075, .075]) view.line(tower, [
            [Math.cos(angle + lean) * 3.08, .3, Math.sin(angle + lean) * 3.08],
            [Math.cos(angle) * radiusAt(1.1), 1.1, Math.sin(angle) * radiusAt(1.1)],
        ], concrete, .065);
    }
    for (const [from, to] of [[1.1, bands[0][0]], [bands[0][1], bands[1][0]], [bands[1][1], height]]) {
        view.mesh(tower, shellGeometry(from, to), concrete);
    }
    for (const [from, to] of bands) view.mesh(tower, shellGeometry(from, to), red);
    view.mesh(tower, shellGeometry(1.1, height, .11), inside);
    for (const level of [1.1, height]) {
        view.mesh(tower, new THREE.TorusGeometry(radiusAt(level) - .035, .08, 6, 48), concrete, [0, level, 0]).rotation.x = Math.PI / 2;
    }

    // A separate cooling-water loop drops through sleeves in the plant plate,
    // emerges beyond its right/rear edge and enters the tower distribution/basin.
    const pipework = new THREE.Group();
    pipework.name = 'condenser-cooling-water';
    pipework.userData.equipment = 'condenser';
    view.groups.set('coolingWater', pipework);
    view.scene.add(pipework);
    const warm = view.material('#be8760');
    const cool = view.material('#509dad');
    const makeup = view.material('#639fad');
    const routes = [
        { role: 'warm', material: warm, points: [[8.85, 1.25, 2.75], [10.6, 1.25, 2.75], [10.6, -.95, 2.75], [12.4, -.95, 2.75], [12.4, -.95, -10.2], [8.5, -.95, -10.2], [8.5, 2, -10.2], [7.65, 2, -10.5]] },
        { role: 'cool', material: cool, points: [[7.5, -.2, -9.65], [7.5, -1.15, -9.65], [13, -1.15, -9.65], [13, -1.15, 3.55], [9.85, -1.15, 3.55], [9.85, .85, 3.55], [8.85, .85, 3.55]] },
        { role: 'makeup', material: makeup, points: [[11.3, -.55, -15.4], [11.3, .05, -15.4], [9.5, .05, -15.4], [9.5, -.2, -13.5], [8.7, -.2, -13.5]] },
    ];
    for (const [px, pz] of [[10.6, 2.75], [9.85, 3.55]]) {
        view.mesh(pipework, new THREE.TorusGeometry(.25, .08, 6, 16), view.darkSteel, [px, -.14, pz]).rotation.x = Math.PI / 2;
    }
    for (const route of routes) {
        const vectors = view.line(pipework, route.points, route.material, route.role === 'makeup' ? .085 : .16);
        route.curve = new THREE.CurvePath();
        for (let i = 1; i < vectors.length; i++) route.curve.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]));
        route.length = route.curve.getLength();
        route.particles = view.particles(pipework, new THREE.OctahedronGeometry(.11), view.coolMarker, Math.ceil(route.length / 1.6));
    }

    // A small river section identifies the intake without adding a new terrain renderer.
    view.box(tower, [2, .12, 8], view.material('#777c69', { metalness: 0 }), [5.5, -.11, -.2]);
    const river = view.box(tower, [1.65, .045, 8], view.material('#4b96aa', { metalness: .05, roughness: .45 }), [5.5, -.025, -.2]);
    river.name = 'river-make-up-water';
    for (let i = 0; i < 8; i++) {
        view.box(tower, [.55 + i % 3 * .15, .012, .025], view.steelLight, [5.5 + Math.sin(i * 2) * .3, .005, -3.5 + i * .9]);
    }
    view.box(tower, [.5, .35, .65], concrete, [5.5, .12, -3]);
    for (let i = 0; i < 5; i++) view.box(tower, [.035, .28, .55], view.darkSteel, [5.3 + i * .1, .15, -3]);

    // Soft camera-facing vapor in one instanced draw call; no bitmap asset,
    // timer or per-puff material. Individual opacity also fades the plume ends.
    const geometry = new THREE.PlaneGeometry(1, 1);
    const opacity = new THREE.InstancedBufferAttribute(new Float32Array(plumeCount), 1);
    opacity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('plumeOpacity', opacity);
    const vapor = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color('#e5eff0') }, strength: { value: 0 } },
        vertexShader: `
            attribute float plumeOpacity;
            varying vec2 vaporUv;
            varying float vaporOpacity;
            void main() {
                vaporUv = uv;
                vaporOpacity = plumeOpacity;
                vec4 center = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
                center.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
                gl_Position = projectionMatrix * center;
            }`,
        fragmentShader: `
            uniform vec3 color;
            uniform float strength;
            varying vec2 vaporUv;
            varying float vaporOpacity;
            void main() {
                vec2 p = vaporUv - .5;
                float cloud = 1. - smoothstep(.06, .5, length(p));
                gl_FragColor = vec4(color, cloud * cloud * vaporOpacity * strength);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    view.materials.add(vapor);
    const plume = view.particles(tower, geometry, vapor, plumeCount);
    plume.mesh.renderOrder = 2;
    plume.mesh.name = 'cooling-tower-vapor';
    view.coolingTower = { group: tower, pipework, routes, plume, opacity, vapor, activity: 0 };
}

export function updateCoolingScene(view, motion, theme) {
    const { plume, opacity, vapor, routes } = view.coolingTower;
    const activity = motion.coolingTower || 0;
    view.coolingTower.activity = activity;
    vapor.uniforms.strength.value = .25 + activity * .38;
    vapor.uniforms.color.value.set(theme === 'light' ? '#abc4cb' : '#e5eff0');
    const count = activity > .002 ? Math.min(plume.items.length, Math.ceil(8 + activity * 34)) : 0;
    for (const [index, puff] of plume.items.entries()) {
        puff.visible = index < count;
        if (!puff.visible) continue;
        const phase = ((motion.coolingTowerPhase || 0) + index * .618034) % 1;
        // Fixed emission columns: vapor rises vertically without orbiting,
        // horizontal drift or a widening spiral around the tower mouth.
        puff.position.set((index % 3 - 1) * .75,
            COOLING_TOWER.height + .05 + phase * (1.8 + activity * 2.5),
            (Math.floor(index / 3) % 3 - 1) * .65);
        const size = (.9 + phase * 1.65) * (.65 + activity * .5);
        puff.scale.set(size * 1.3, size, 1);
        opacity.setX(index, Math.sin(phase * Math.PI) ** .65 * Math.min(1, activity * 5));
    }
    if (count) opacity.needsUpdate = true;
    plume.update();
    for (const route of routes) {
        const flow = route.role === 'makeup' ? activity : motion.coolingWater || 0;
        for (const [index, dot] of route.particles.items.entries()) {
            dot.visible = flow > .002;
            if (dot.visible) dot.position.copy(route.curve.getPoint(flowMarkerDistance(
                (motion.coolingWaterTravel || 0) * (route.role === 'makeup' ? .3 : 1), index, route.particles.items.length, route.length) / route.length));
        }
        route.particles.update();
    }
    const label = view.featureLabels.find(label => label.id === 'cooling-tower');
    if (label) {
        setText(label.reading, activity > .002 ? `${activity < .3 ? 'Light' : activity < .65 ? 'Moderate' : 'Dense'} water vapor · condenser cooling` : 'No heat rejection');
        label.button.classList.toggle('selected', view.selected === 'condenser');
    }
}
