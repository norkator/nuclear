/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';
import { PlantOverviewScene } from './nuclear-power-scene.js';
import { buildElectricalScene, updateElectricalScene } from './nuclear-power-electrical-scene.js';
import { PUMPS } from './nuclear-power-pumps.js';

// Dedicated electrical equipment, sharing geometry, actual read-back and the
// console frame clock. No hidden reactor or local simulation is constructed.
export class ElectricalGridScene extends PlantOverviewScene {
    constructor(host, options) {
        super(host, options);
        this.renderer.domElement.setAttribute('aria-label', '3D electrical grid. Select transformer, switchgear, bus or diesel to inspect. Drag to orbit; pinch or wheel to zoom; Home resets. Part buttons provide the same controls.');
    }

    build() {
        this.frameWidth = 10.5; this.frameHeight = 6.3; this.zoom = this.defaultZoom = 1.1;
        this.target.set(4.1, 1.5, -2.8);
        this.steel = this.material('#708d9e'); this.steelLight = this.material('#b6cbd4');
        this.darkSteel = this.material('#344c5c'); this.base = this.material('#243947');
        this.trim = this.material('#627f8c'); this.teal = this.material('#64c9b5');
        this.jointGeometry = new THREE.IcosahedronGeometry(1, 1);
        this.hemisphereLight = new THREE.HemisphereLight('#d4edf4', '#304450', 2.4);
        this.sunLight = new THREE.DirectionalLight('#ffe4c3', 3.2); this.sunLight.position.set(-8, 16, 12);
        this.scene.add(this.hemisphereLight, this.sunLight);
        this.floorMaterial = this.material('#1a2b37');
        this.box(this.scene, [16, .18, 12], this.floorMaterial, [3.5, -.15, -3.2]);
        this.loads = PUMPS.map((pump, index) => ({ id: pump.id, x: -.9 + index * 2.5, z: 1.7 }));
        buildElectricalScene(this, { loads: this.loads, turbine: [8.7, 1.5, -1.8] });

        const grid = this.groups.get('grid');
        this.pad(grid, 5.8, 3);
        this.box(grid, [2.6, .3, 1.8], this.darkSteel, [-2, .4, 0]);
        this.box(grid, [2.3, 2.2, .3], this.steelLight, [-2, 1.7, -.65]);
        this.copper = this.material('#cc8b4b', { emissive: '#ecb45b', emissiveIntensity: 0 });
        const porcelain = this.material('#d4dfd4');
        for (const x of [-2.8, -2, -1.2]) {
            this.cylinder(grid, .3, 1.6, this.darkSteel, [x, 1.6, 0]);
            for (let i = 0; i < 9; i++) this.mesh(grid, new THREE.TorusGeometry(.38, .07, 4, 12), this.copper, [x, .85 + i * .18, 0]).rotation.x = Math.PI / 2;
            this.cylinder(grid, .07, 1.3, this.copper, [x, 3.1, 0]);
            for (let i = 0; i < 5; i++) this.cylinder(grid, .16, .05, porcelain, [x, 2.65 + i * .18, 0]);
        }
        this.box(grid, [2.7, .14, .14], this.copper, [-2, 3.85, 0]);
        this.gridContact = new THREE.Group(); this.gridContact.position.set(-.7, 2.3, .6); grid.add(this.gridContact); this.dynamicGroups.push(this.gridContact);
        this.box(this.gridContact, [.95, .08, .13], this.copper, [.45, 0, 0]);

        const bus = this.groups.get('bus');
        for (const x of [-.3, 0, .3]) this.box(bus, [.09, 1.1, .1], this.copper, [x, .9, .51]);
        const feed = this.component('turbineFeed', [8.7, 0, -1.8]); this.pad(feed, 2, 1.7);
        this.box(feed, [1.4, 1.8, .9], this.steel, [0, 1, 0]);
        this.box(feed, [1.1, 1.4, .08], this.darkSteel, [0, 1.05, .49]);
        this.feedLamp = this.material('#55756a', { emissive: '#75f0b3', emissiveIntensity: 0 });
        this.box(feed, [.65, .13, .09], this.feedLamp, [0, 1.55, .56]);
        this.feedContact = new THREE.Group(); this.feedContact.position.set(-.4, .9, .58); feed.add(this.feedContact); this.dynamicGroups.push(this.feedContact);
        this.box(this.feedContact, [.8, .08, .12], this.copper, [.4, 0, 0]);
        this.loadLamps = [];
        for (const load of this.loads) {
            const terminal = this.component(`load-${load.id}`, [load.x, 0, load.z]);
            terminal.userData.equipment = 'bus';
            this.pad(terminal, 1.7, 1.2); this.box(terminal, [1.2, 1.2, .65], this.darkSteel, [0, .7, 0]);
            const lamp = this.material('#55756a', { emissive: '#75f0b3', emissiveIntensity: 0 });
            this.box(terminal, [.6, .1, .1], lamp, [0, 1, .38]); this.loadLamps.push({ id: load.id, material: lamp });
        }
    }

    buildLabels() {
        const caption = document.createElement('span'); caption.className = 'plant-scene-caption'; caption.textContent = 'AC-01 / SUPPLY & DISTRIBUTION';
        const hint = document.createElement('span'); hint.className = 'plant-scene-hint'; hint.textContent = 'Select equipment to inspect · drag to orbit';
        this.host.append(caption, hint);
    }

    update(sim, motion, phases, theme) {
        if (this.disposed || !this.visible) return;
        this.floorMaterial.color.set(theme === 'light' ? '#8b9fa8' : '#1a2b37');
        this.hemisphereLight.intensity = theme === 'light' ? 1.65 : 2.4;
        this.sunLight.intensity = theme === 'light' ? 2.3 : 3.2;
        updateElectricalScene(this, sim.supply, phases, motion.supplyPhase || 0, sim);
        this.copper.emissiveIntensity = sim.supply.source.includes('GRID') ? .25 : 0;
        this.gridContact.rotation.z = sim.supply.gridAvailable ? 0 : Math.PI / 3;
        this.feedContact.rotation.z = sim.supply.turbineConnected ? 0 : Math.PI / 3;
        this.feedLamp.emissiveIntensity = sim.supply.source.includes('TURBINE') ? .8 : 0;
        for (const lamp of this.loadLamps) lamp.material.emissiveIntensity = sim.supply.factor > 0 && sim[lamp.id] ? .8 : 0;
        this.render();
    }
}
