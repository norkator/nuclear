/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import * as THREE from 'three';

// Keep independent presentation transforms without a scene node and draw call
// for each particle. Hidden particles neither upload matrices nor draw geometry.
export class ParticleBatch {
    constructor(parent, geometry, material, count) {
        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.count = 0;
        this.mesh.visible = false;
        // These small, moving batches stay within the plant's bounded scene.
        // A cached sphere from an earlier pose could incorrectly hide them.
        this.mesh.frustumCulled = false;
        this.mesh.raycast = () => {};
        parent.add(this.mesh);
        this.items = Array.from({ length: count }, () => {
            const item = new THREE.Object3D();
            item.visible = false;
            return item;
        });
    }

    update() {
        let count = 0;
        for (const item of this.items) {
            if (!item.visible) continue;
            item.updateMatrix();
            this.mesh.setMatrixAt(count++, item.matrix);
        }
        this.mesh.count = count;
        this.mesh.visible = count > 0;
        if (count) this.mesh.instanceMatrix.needsUpdate = true;
    }
}
