/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// 3D-viewport two-pointer zoom. One-pointer orbit/picking stays with the scene.
// After a pinch, suppress the remaining finger until all fingers are lifted.
export class CameraTouchZoom {
    constructor(canvas, { getZoom, setZoom, cancelDrag, enabled, signal, surface = canvas }) {
        this.canvas = canvas; this.getZoom = getZoom; this.setZoom = setZoom;
        this.cancelDrag = cancelDrag; this.enabled = enabled;
        this.points = new Map(); this.active = false; this.distance = 0; this.suppressClick = false;
        const options = { signal, capture: true, passive: false };
        surface.addEventListener('pointerdown', event => this.down(event), options);
        surface.addEventListener('pointermove', event => this.move(event), options);
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            surface.addEventListener(name, event => {
                // Transferring implicit capture from a label to the canvas is
                // part of starting a pinch, not a cancelled finger.
                if (name !== 'lostpointercapture' || event.target === canvas) this.end(event);
            }, options);
        }
        surface.addEventListener('click', event => {
            if (this.suppressClick && (event.pointerType === 'touch' || event.detail > 0)) this.consume(event);
        }, options);
        const document = canvas.ownerDocument, view = document.defaultView;
        view.addEventListener('resize', () => this.reset(), { signal });
        view.addEventListener('blur', () => this.reset(), { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); }, { signal });
        signal.addEventListener('abort', () => this.reset(), { once: true });
    }

    consume(event) {
        // touch-action owns native pan/zoom. Cancelling pointerdown itself also
        // suppresses compatibility clicks, which can affect the next UI tap.
        if (event.type === 'click') event.preventDefault();
        event.stopImmediatePropagation();
    }
    span() {
        const [a, b] = this.points.values();
        return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
    down(event) {
        if (event.pointerType !== 'touch') {
            if (!this.active) this.suppressClick = false;
            return;
        }
        if (event.button !== 0 || !this.enabled()) return;
        if (!this.points.size) this.suppressClick = false;
        this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.points.size < 2 && !this.active) return;
        this.active = true; this.suppressClick = true; this.cancelDrag(); this.distance = this.span();
        for (const id of this.points.keys()) this.canvas.setPointerCapture(id);
        this.consume(event);
    }
    move(event) {
        if (!this.points.has(event.pointerId)) return;
        this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (!this.active) return;
        this.consume(event);
        if (!this.enabled()) { this.reset(); return; }
        const distance = this.span();
        if (distance >= 8 && this.distance >= 8) this.setZoom(this.getZoom() * distance / this.distance);
        this.distance = distance;
    }
    end(event) {
        if (!this.points.has(event.pointerId)) return;
        const consumed = this.active;
        this.points.delete(event.pointerId);
        if (consumed) { this.consume(event); this.cancelDrag(); }
        if (event.type !== 'pointerup') this.cancelDrag();
        this.distance = this.span();
        if (!this.points.size) this.active = false;
        if (consumed && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }
    reset() {
        const ids = [...this.points.keys()];
        this.suppressClick ||= ids.length > 0;
        this.points.clear(); this.active = false; this.distance = 0; this.cancelDrag();
        for (const id of ids) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    }
}
