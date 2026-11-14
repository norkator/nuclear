/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';

export const RACK_SLOTS = [
    { id: 'rackCooling', y: 6.7, height: .7 },
    { id: 'rackSwitch', y: 5.7, height: .65 },
    { id: 'serverA', y: 4.45, height: 1.05 },
    { id: 'serverB', y: 3.05, height: 1.05 },
    { id: 'rackUps', y: 1.35, height: 1.5 },
];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Draw-only adapter. The console owns frame time; model state never lives in Three.js.
export class ComputerRackScene {
    constructor(host, { inspect, unavailable }) {
        this.host = host; this.inspect = inspect; this.visible = false; this.disposed = false;
        this.geometries = new Set(); this.materials = new Set(); this.units = new Map();
        this.abort = new AbortController(); this.yaw = .42; this.pitch = .18; this.zoom = 1;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 60);
        this.target = new THREE.Vector3(0, 3.6, 0);
        this.raycaster = new THREE.Raycaster();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        try {
            this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            this.renderer.setClearColor(0, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            const canvas = this.renderer.domElement;
            canvas.className = 'computer-rack-canvas'; canvas.tabIndex = 0;
            canvas.setAttribute('role', 'group');
            canvas.setAttribute('aria-label', '3D server rack. Drag or use arrow keys to orbit. Wheel or plus/minus to zoom; Home resets. Select a rack unit to inspect, or use the unit buttons alongside.');
            host.replaceChildren(canvas);
            this.build(); this.bind(canvas);
            canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); unavailable(); }, { signal: this.abort.signal });
            this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
        } catch (error) { this.dispose(); throw error; }
    }

    material(color, options = {}) {
        const material = new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .35, ...options });
        this.materials.add(material); return material;
    }
    mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
        const mesh = new THREE.Mesh(geometry, material); this.geometries.add(geometry);
        mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    }
    box(parent, width, height, depth, material, x, y, z) {
        return this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
    }

    build() {
        this.scene.add(new THREE.HemisphereLight('#d5eaff', '#243743', 2.5));
        const light = new THREE.DirectionalLight('#fff0db', 3); light.position.set(5, 10, 10); this.scene.add(light);
        this.frameMaterial = this.material('#486170'); this.trim = this.material('#a3b7c2');
        this.bodyMaterial = this.material('#243c4c'); this.dark = this.material('#11212c');
        this.floor = this.material('#162b39');
        this.box(this.scene, 6, .18, 4.7, this.floor, 0, -.13, 0);
        const grid = new THREE.GridHelper(6, 12, '#476373', '#293f4d'); grid.position.y = -.03;
        this.scene.add(grid); this.geometries.add(grid.geometry); this.materials.add(grid.material);
        for (const x of [-1.55, 1.55]) for (const z of [-1, 1]) {
            this.box(this.scene, .13, 7.7, .13, this.frameMaterial, x, 3.85, z);
            if (z > 0) for (let y = .3; y < 7.6; y += .22) this.box(this.scene, .055, .065, .02, this.dark, x, y, 1.075);
        }
        for (const y of [.05, 7.7]) this.box(this.scene, 3.25, .16, 2.2, this.frameMaterial, 0, y, 0);
        this.box(this.scene, 3.1, 7.4, .08, this.bodyMaterial, 0, 3.85, -1.04);
        // Open front and slotted side panels expose the rack depth and cable routes.
        for (const y of [.4, 1.7, 3, 4.3, 5.6, 6.9]) this.box(this.scene, .07, .9, 1.85, this.frameMaterial, -1.61, y, 0);
        for (const { id, y, height } of RACK_SLOTS) {
            const group = new THREE.Group(); group.position.y = y; group.userData.computer = id; this.scene.add(group);
            const face = this.material('#385665');
            this.box(group, 2.85, height, 1.8, face, 0, 0, -.02);
            this.box(group, 2.95, height * .84, .12, this.dark, 0, 0, .92);
            for (const x of [-1.38, 1.38]) {
                this.box(group, .1, height * .66, .18, this.trim, x, 0, 1.02);
                for (const dy of [-height * .3, height * .3]) this.box(group, .04, .04, .03, this.dark, x, dy, 1.12);
            }
            const lamp = this.material('#59d8b0', { emissive: '#59d8b0', emissiveIntensity: .55 });
            this.mesh(group, new THREE.SphereGeometry(.06, 8, 6), lamp, 1.13, height * .2, 1.02);
            const fans = [];
            if (id === 'rackCooling') {
                for (const x of [-.65, .65]) {
                    this.mesh(group, new THREE.TorusGeometry(.25, .035, 5, 20), this.trim, x, 0, 1.02);
                    const rotor = new THREE.Group(); rotor.position.set(x, 0, 1.04); group.add(rotor); fans.push(rotor);
                    for (let blade = 0; blade < 5; blade++) {
                        const fin = this.box(rotor, .08, .21, .025, this.trim, 0, .105, 0);
                        const pivot = new THREE.Group(); rotor.remove(fin); pivot.add(fin); pivot.rotation.z = blade * Math.PI * 2 / 5; rotor.add(pivot);
                    }
                }
            } else if (id === 'rackSwitch') {
                for (let index = 0; index < 12; index++) {
                    this.box(group, .12, .1, .04, this.trim, -1.05 + index * .16, -.04, 1.01);
                    this.box(group, .035, .025, .05, lamp, -1.05 + index * .16, .08, 1.02);
                }
            } else if (id === 'rackUps') {
                this.box(group, .6, .38, .04, this.material('#486a74', { emissive: '#164e52', emissiveIntensity: .3 }), -.75, .25, 1.01);
                for (let row = 0; row < 6; row++) this.box(group, 1.7, .025, .03, this.trim, .25, -.1 - row * .07, 1.02);
            } else {
                for (let drive = 0; drive < 8; drive++) {
                    const x = -.98 + (drive % 4) * .51, dy = drive < 4 ? .15 : -.18;
                    this.box(group, .45, .25, .06, this.bodyMaterial, x, dy, 1.01);
                    this.box(group, .26, .025, .025, this.trim, x, dy, 1.06);
                    this.box(group, .025, .035, .03, lamp, x + .18, dy, 1.06);
                }
            }
            this.units.set(id, { group, face, lamp, fans });
        }
        // Visible patch leads and the rear power distribution strip.
        const cableColours = ['#4bb6c5', '#d5a553', '#78b58d'];
        for (let index = 0; index < 3; index++) {
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.6 + index * .2, 5.65, 1.12),
                new THREE.Vector3(1.8 + index * .13, 5.5, 1.2), new THREE.Vector3(1.8 + index * .13, 3.1 + index * .6, .5),
                new THREE.Vector3(1.45, 3.1 + index * .6, .5)]);
            this.mesh(this.scene, new THREE.TubeGeometry(curve, 16, .025, 5, false), this.material(cableColours[index]));
        }
        this.box(this.scene, .22, 6.9, .24, this.dark, 1.75, 3.7, -.8);
        for (let index = 0; index < 12; index++) this.box(this.scene, .09, .11, .03, this.trim, 1.75, .65 + index * .52, -.66);
    }

    bind(canvas) {
        const options = { signal: this.abort.signal };
        canvas.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
            canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
        }, options);
        canvas.addEventListener('pointermove', event => {
            if (!this.drag) return;
            const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
            this.drag.moved ||= Math.hypot(dx, dy) > 5;
            if (this.drag.moved) { this.yaw = clamp(this.drag.yaw - dx * .008, -1.25, 1.25); this.pitch = clamp(this.drag.pitch + dy * .005, -.15, .8); this.render(); }
        }, options);
        canvas.addEventListener('pointerup', event => {
            if (this.drag && !this.drag.moved && this.visible) {
                const rect = canvas.getBoundingClientRect();
                this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
                const hit = this.raycaster.intersectObjects([...this.units.values()].map(unit => unit.group), true)[0];
                let object = hit?.object;
                while (object && !object.userData.computer) object = object.parent;
                if (object) this.inspect(object.userData.computer);
            }
            this.drag = null;
        }, options);
        for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { this.drag = null; }, options);
        canvas.addEventListener('wheel', event => { event.preventDefault(); this.setZoom(this.zoom - Math.sign(event.deltaY) * .1); }, { ...options, passive: false });
        canvas.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', '+', '-', '='].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home') this.resetCamera();
            else if (['+', '-', '='].includes(event.key)) this.setZoom(this.zoom + (event.key === '-' ? -.1 : .1));
            else { this.yaw = clamp(this.yaw + (event.key === 'ArrowLeft' ? -.08 : event.key === 'ArrowRight' ? .08 : 0), -1.25, 1.25); this.pitch = clamp(this.pitch + (event.key === 'ArrowUp' ? .06 : event.key === 'ArrowDown' ? -.06 : 0), -.15, .8); this.render(); }
        }, options);
    }

    setZoom(value) { this.zoom = clamp(value, .7, 1.35); this.resize(); }
    resetCamera() { this.yaw = .42; this.pitch = .18; this.zoom = 1; this.resize(); }
    setVisible(value) { this.visible = value; if (!value) this.drag = null; }
    resize() {
        if (this.disposed || !this.host.clientWidth || !this.host.clientHeight) return;
        this.width = this.host.clientWidth; this.height = this.host.clientHeight;
        this.renderer.setSize(this.width, this.height, false);
        const aspect = this.width / this.height, half = Math.max(4.5, 3.1 / aspect) / this.zoom;
        Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
        this.camera.updateProjectionMatrix(); this.render();
    }
    update(computers, selected, theme, phase) {
        if (this.disposed || !this.visible) return;
        const light = theme === 'light';
        this.floor.color.set(light ? '#c1cdd3' : '#162b39'); this.frameMaterial.color.set(light ? '#6a7d87' : '#486170');
        for (const [id, mesh] of this.units) {
            const unit = computers.units[id], colour = unit.fault ? '#ef6c58' : !unit.online ? '#637585' : computers.status(id).includes('LOW') ? '#e8b764' : '#59d8b0';
            mesh.lamp.color.set(colour); mesh.lamp.emissive.set(colour); mesh.lamp.emissiveIntensity = unit.online || unit.fault ? .55 : 0;
            mesh.face.color.set(id === selected ? '#4d7e8d' : light ? '#647c89' : '#385665');
            for (const fan of mesh.fans) fan.rotation.z = phase;
        }
        this.render();
    }
    render() {
        if (this.disposed || !this.visible || !this.width || this.host.hidden) return;
        this.camera.position.set(Math.sin(this.yaw) * 15, 3.6 + Math.sin(this.pitch) * 15, Math.cos(this.yaw) * 15);
        this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
        this.renderer.render(this.scene, this.camera);
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.visible = false; this.abort.abort(); this.observer?.disconnect();
        for (const geometry of this.geometries) geometry.dispose();
        for (const material of this.materials) material.dispose();
        this.renderer.dispose(); this.renderer.domElement.remove();
    }
}
