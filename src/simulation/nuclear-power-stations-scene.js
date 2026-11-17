/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { PlantOverviewScene } from './nuclear-power-scene.js';
import { buildPumpUnit } from './nuclear-power-pump-scene.js';
import { buildExchangerCutaway, buildTurbineCutaway, buildCondenserCutaway, updateTurbineCutaway, updateExchangerCutaway } from './nuclear-power-cutaway-scene.js';
import { pumpDefinition } from './nuclear-power-pumps.js';
import { loopTemperatures, temperatureColor } from './nuclear-power-temperature.js';
import { flowMarkerDistance, valveHandleAngle } from './nuclear-power-motion.js';
import { leakSources, waterJetPoint } from './nuclear-power-leaks.js';

// Reuse camera, picking, batching and disposal, but build only this equipment.
// No reactor, rack, hidden plant or second simulation is created for a station.
export class EquipmentStationScene extends PlantOverviewScene {
    constructor(host, options) {
        super(host, options);
        this.renderer.domElement.setAttribute('aria-label', '3D equipment cutaway. Select a part to open its controls. Drag or use arrow keys to orbit; pinch, wheel or plus/minus zoom; Home resets. Part buttons offer the same controls.');
    }

    build() {
        this.stationId = this.host.dataset.stationEquipment;
        const id = this.stationId, pump = pumpDefinition(id);
        this.frameHeight = pump ? 1.9 : id === 'exchanger' ? 3.7 : id === 'turbine' ? 3.1 : 2;
        this.frameWidth = pump ? 3 : id === 'turbine' ? 5.4 : 3.3;
        this.zoom = this.defaultZoom = 1.1;
        this.target.set(id === 'turbine' ? 1 : 0, pump ? 1 : id === 'exchanger' ? 2.8 : id === 'turbine' ? 1.9 : 1, 0);
        this.steel = this.material('#708d9e'); this.steelLight = this.material('#b6cbd4');
        this.darkSteel = this.material('#344c5c'); this.base = this.material('#243947'); this.trim = this.material('#627f8c');
        this.teal = this.material('#64c9b5'); this.hotPipe = this.material('#d99155'); this.coolPipe = this.material('#4c9eac');
        this.coolMarker = this.material('#b5ffec', { emissive: '#58b9ad', emissiveIntensity: .35 });
        this.markerHighlight = new THREE.Color('#fff6e6');
        this.jointGeometry = new THREE.IcosahedronGeometry(1, 1); this.dotGeometry = new THREE.OctahedronGeometry(.12);
        this.hemisphereLight = new THREE.HemisphereLight('#d4edf4', '#304450', 2.4);
        this.sunLight = new THREE.DirectionalLight('#ffe4c3', 3.2); this.sunLight.position.set(-8, 16, 12);
        this.scene.add(this.hemisphereLight, this.sunLight);
        this.floorMaterial = this.material('#1a2b37');
        this.box(this.scene, [pump ? 6 : 10, .18, 5], this.floorMaterial, [0, -.15, 0]);
        if (pump) this.buildPump(pump);
        else if (id === 'exchanger') {
            buildExchangerCutaway(this, [0, 0, 0]);
            const body = this.groups.get(id);
            const bundle = new THREE.Group(); body.add(bundle); this.part(bundle, 'effectiveness');
            // Tube supports and removable deposits are separately inspectable.
            this.box(bundle, [1.6, .12, .18], this.steelLight, [0, 2.8, .65]);
            this.deposits = new THREE.Group(); this.deposits.position.set(0, 3, .4); body.add(this.deposits); this.part(this.deposits, 'fouling');
            const sediment = this.material('#ae824c');
            for (let i = 0; i < 5; i++) this.cylinder(this.deposits, .1, 1.7, sediment, [-.65 + i * .32, 0, 0]);
            this.flow([[-1.6, 1.4, 0], [-1.6, 4.7, 0], [-.8, 4.7, 0]], 'A', 'water', this.material('#4c9eac'), 'primaryHot');
            this.flow([[.8, 4.7, 0], [1.65, 4.7, 0], [1.65, 1.4, 0]], 'B', 'steam', this.material('#4c9eac'), 'secondaryHot');
        } else if (id === 'turbine') {
            buildTurbineCutaway(this, [0, 0, 0]);
            this.part(this.turbineRotor, 'governorResponse');
            const body = this.groups.get(id);
            this.part(this.generatorLamp, 'generatorLoading');
            const governor = this.box(body, [.7, .55, .8], this.teal, [-1.1, .65, 1]); this.part(governor, 'governorResponse');
            const ramp = this.box(body, [.7, .55, .8], this.steelLight, [.4, .65, 1]); this.part(ramp, 'loadRamp');
            const copper = this.material('#d29760');
            for (let i = 0; i < 8; i++) {
                const coil = this.box(body, [1.3, .12, .15], copper, [3.1, 2.25 + i * .14, .6]); this.part(coil, 'generatorLoading');
            }
        } else {
            buildCondenserCutaway(this, [0, 0, 0]);
            const body = this.groups.get(id);
            for (let i = 0; i < 7; i++) {
                const tube = this.cylinder(body, .055, 3.1, this.coolPipe, [0, .65 + i * .15, 1.07]);
                tube.rotation.z = Math.PI / 2; this.part(tube, 'inletTemperature');
            }
            this.flow([[-2.3, .8, 0], [-2.3, 1.6, 0], [-1.6, 1.6, 0]], 'B', 'water', this.material('#4c9eac'), 'condenserCooling');
        }
        const requestMaterial = this.material('#e6b565', { wireframe: true });
        for (const valve of this.valves) {
            this.part(valve.group, valve.key);
            valve.request = this.box(valve.group, [.8, .035, .16], requestMaterial, [0, .74, 0]);
            this.dynamicMeshes.push(valve.request);
        }
    }

    part(object, key) { object.userData.equipment = key; return object; }

    buildPump(pump) {
        this.pumpParts = {};
        const body = buildPumpUnit(this, pump.id);
        this.part(this.pumps[pump.id], 'speed');
        const motor = this.cylinder(body, .5, 1.3, this.darkSteel, [0, 1.2, -.9]); motor.rotation.x = Math.PI / 2;
        this.part(motor, 'speed');
        for (let i = 0; i < 7; i++) this.box(body, [1.1, .06, .07], this.steel, [0, 1 + i * .09, -1.5]);
        this.part(this.cylinder(body, .18, .12, this.teal, [-.75, .75, .6]), 'trim');
        this.flow([[-2.3, 1.2, 0], [2.3, 1.2, 0]], pump.circuit === 'primary' ? 'A' : 'B', 'water', this.material('#4c9eac'), pump.circuit === 'primary' ? 'primaryReturn' : 'secondaryReturn', pump.id);
        const water = this.material('#64c9f2', { transparent: true, opacity: .85 });
        this.leakDrops = this.particles(body, new THREE.IcosahedronGeometry(.045), water, 18);
    }

    buildLabels() {
        const caption = document.createElement('span'); caption.className = 'plant-scene-caption';
        caption.textContent = 'LIVE EQUIPMENT / CUTAWAY';
        const hint = document.createElement('span'); hint.className = 'plant-scene-hint'; hint.textContent = 'Select a part · drag to orbit · pinch to zoom';
        this.host.append(caption, hint);
    }

    update(sim, motion, pumps, theme) {
        if (this.disposed || !this.visible) return;
        this.floorMaterial.color.set(theme === 'light' ? '#8b9fa8' : '#1a2b37');
        this.hemisphereLight.intensity = theme === 'light' ? 1.65 : 2.4;
        this.sunLight.intensity = theme === 'light' ? 2.3 : 3.2;
        if (pumpDefinition(this.stationId)) this.base.color.set(theme === 'light' ? '#6c8491' : '#243947');
        const id = this.stationId, pump = pumpDefinition(id), item = sim.components.items[id];
        if (pump) {
            this.pumps[id].rotation.z = pumps[pump.key].angle * Math.PI / 180;
            const parts = sim.condition.components[pump.key].parts;
            for (const part of ['blades', 'bearings', 'fittings']) {
                const material = this.pumpParts[id][part];
                material.color.set(parts[part] > 1 ? '#c56445' : part === 'blades' ? '#64c9b5' : part === 'bearings' ? '#c2b276' : '#a9c5cd');
                material.emissive.set('#be4526'); material.emissiveIntensity = parts[part] / 200;
            }
            const source = leakSources(sim).find(source => source.id === id);
            for (const [index, drop] of this.leakDrops.items.entries()) {
                drop.visible = source.rate > .01;
                if (!drop.visible) continue;
                const point = waterJetPoint(motion.leakPhase || 0, index, this.leakDrops.items.length, source.pressure);
                drop.position.set(-.87 + point.x, 1.2 + point.y, point.z); drop.scale.set(.65 * point.size, point.size * 1.6, .65 * point.size);
            }
            this.leakDrops.update();
        } else if (id === 'turbine') updateTurbineCutaway(this, sim, motion);
        else if (id === 'exchanger') {
            updateExchangerCutaway(this, motion, theme);
            this.deposits.visible = item.actual.fouling > .1;
            this.deposits.scale.set(1, Math.min(1, item.actual.fouling / 50), 1);
        } else {
            for (const [index, drop] of this.drops.entries()) {
                drop.visible = motion.steam > .02 && item.actual.coolingFactor > .01;
                drop.position.y = 1.6 - ((motion.steamPhase * 2 + index / 7) % 1) * 1.1; drop.scale.set(.4, .65, .4);
            }
        }
        for (const valve of this.valves) {
            valve.handle.rotation.y = valveHandleAngle(item.actual[valve.key] ?? 100) * Math.PI / 180;
            valve.request.rotation.y = valveHandleAngle(item.settings[valve.key] ?? 100) * Math.PI / 180;
        }
        const temperatures = loopTemperatures(sim);
        this.coolPipe.color.set(temperatureColor(temperatures.condenserCooling));
        for (const path of this.paths) {
            path.material.color.set(temperatureColor(temperatures[path.temperatureKey]));
            const flow = pump ? item.actual.flow : path.circuit === 'A' ? sim.primaryFlow : sim.secondaryFlow;
            const travel = pump ? pumps[pump.key].travel || 0 : path.circuit === 'A' ? motion.primaryTravel : motion.secondaryTravel;
            for (const [index, dot] of path.dots.entries()) {
                dot.visible = flow > .1 && (path.kind !== 'steam' || motion.steam > .02);
                if (dot.visible) dot.position.copy(path.curve.getPoint(flowMarkerDistance(travel, index, path.dots.length, path.length) / path.length));
            }
            path.particles.update();
        }
        this.render();
    }
}
