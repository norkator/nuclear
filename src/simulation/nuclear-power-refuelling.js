/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Representative pool batches and transfer choreography. Core fuel renewal
// remains the existing atomic model action, separate from cooling/dispatch here.
export const CHANNEL_PITCH = .33;
export const FUEL_TRANSFER_DURATION = 10.5;
export const SPENT_FUEL_COOLING_SECONDS = 60;
export const SPENT_FUEL_DESTINATIONS = Object.freeze({ storage: 'Long-term storage', reprocessing: 'Reprocessing' });
export const FUEL_HANDLING = Object.freeze({
    deckY: 6.18, homeZ: -4.75, bridgeY: 10.38, trolleyY: .18,
    parkedGrabberY: 8.76, clearanceGrabberY: 9.3,
    assemblyHeight: 2.45, gripOffset: .4, coreFuelY: 3, storedFuelY: 3.4,
});
export const FUEL_POOL_SLOTS = Array.from({ length: 35 }, (_, index) => ({
    id: `SF-${String(index + 1).padStart(2, '0')}`,
    x: (index % 7 - 3) * .53, z: FUEL_HANDLING.homeZ + (Math.floor(index / 7) - 2) * .62,
}));

const mix = (a, b, t) => a + (b - a) * t;
const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export class FuelTransferAnimation {
    constructor(channels) {
        this.channels = channels.filter(channel => channel.fuelId);
        this.reset();
    }

    reset() {
        this.job = null;
        this.samples = Array(FUEL_POOL_SLOTS.length).fill(null);
        this.nextSlot = 0;
        this.poolTime = 0;
        this.sampleSequence = 0;
        this.dispatchHistory = [];
        this.dispatchedAssemblies = 0;
    }

    get availableSlot() {
        if (this.job && !this.job.deposited) return this.job.slotIndex;
        for (let offset = 0; offset < this.samples.length; offset++) {
            const index = (this.nextSlot + offset) % this.samples.length;
            if (!this.samples[index]) return index;
        }
        return -1;
    }

    get hasCapacity() { return this.availableSlot >= 0; }

    setPoolTime(elapsed) {
        if (Number.isFinite(elapsed)) this.poolTime = Math.max(this.poolTime, elapsed);
    }

    coolingRemaining(sample) { return Math.max(0, sample.readyAt - this.poolTime); }

    dispatchReadiness(reference) {
        const sample = this.samples.find(sample => sample?.reference === reference);
        if (!sample) return { ready: false, reason: 'Select a stored batch.' };
        if (this.job?.slotIndex === sample.slotIndex) return { ready: false, reason: 'Wait for the crane to finish.' };
        const remaining = this.coolingRemaining(sample);
        if (remaining > 0) return { ready: false, reason: `Cooling · ${Math.ceil(remaining)} s remaining.` };
        return { ready: true, reason: 'Cooled and ready for dispatch.' };
    }

    dispatch(reference, destination) {
        if (!Object.hasOwn(SPENT_FUEL_DESTINATIONS, destination) || !this.dispatchReadiness(reference).ready) return null;
        const sample = this.samples.find(sample => sample?.reference === reference);
        const shipment = { ...sample, destination, dispatchedAt: this.poolTime, cost: 0 };
        this.samples[sample.slotIndex] = null;
        this.dispatchedAssemblies += sample.count;
        this.dispatchHistory.push(shipment);
        this.dispatchHistory = this.dispatchHistory.slice(-20);
        return shipment;
    }

    start(id, count = 1, immediate = false) {
        const channel = this.channels.find(channel => channel.fuelId === id);
        const slotIndex = this.availableSlot;
        if (!channel || slotIndex < 0) return false;
        this.job = { id, count, elapsed: 0, deposited: false, slotIndex,
            x: channel.x * CHANNEL_PITCH, z: channel.y * CHANNEL_PITCH };
        if (immediate) this.finish();
        return true;
    }

    deposit() {
        if (!this.job || this.job.deposited) return;
        const { id, count, slotIndex } = this.job;
        this.samples[slotIndex] = { id, count, slotIndex, reference: `SF-${String(++this.sampleSequence).padStart(4, '0')}`,
            placedAt: this.poolTime, readyAt: this.poolTime + SPENT_FUEL_COOLING_SECONDS };
        this.nextSlot = (slotIndex + 1) % FUEL_POOL_SLOTS.length;
        this.job.deposited = true;
    }

    finish() {
        this.deposit();
        this.job = null;
    }

    cancel() { this.job = null; }

    advance(seconds) {
        if (!this.job || !Number.isFinite(seconds)) return;
        // Long frames must not fast-forward a lift after background suspension.
        this.job.elapsed += Math.max(0, Math.min(.1, seconds));
        if (this.job.elapsed >= 8.3) this.deposit();
        if (this.job.elapsed >= FUEL_TRANSFER_DURATION) this.finish();
    }

    get pose() {
        const layout = FUEL_HANDLING;
        const parked = { x: 0, z: layout.homeZ, grabberY: layout.parkedGrabberY,
            phase: 'Parked', carrying: false, openCap: false, sourceHidden: false };
        if (!this.job) return parked;
        const job = this.job, t = job.elapsed;
        const slot = FUEL_POOL_SLOTS[job.slotIndex];
        const pickupY = layout.coreFuelY + layout.assemblyHeight / 2 + layout.gripOffset;
        const dropY = layout.storedFuelY + layout.assemblyHeight / 2 + layout.gripOffset;
        const pose = { ...parked, sourceId: job.id, slotIndex: job.slotIndex, x: job.x, z: job.z };
        if (t < 1.2) {
            const f = ease(t / 1.2);
            return { ...pose, x: mix(0, job.x, f), z: mix(layout.homeZ, job.z, f), phase: 'Aligning over core' };
        }
        if (t < 2.6) return { ...pose, grabberY: mix(layout.parkedGrabberY, pickupY, ease((t - 1.2) / 1.4)),
            openCap: true, phase: 'Lowering grabber' };
        if (t < 4.6) return { ...pose, grabberY: mix(pickupY, layout.clearanceGrabberY, ease((t - 2.6) / 2)),
            carrying: true, sourceHidden: true, openCap: true, phase: 'Lifting assembly' };
        if (t < 6.5) {
            const f = ease((t - 4.6) / 1.9);
            return { ...pose, x: mix(job.x, slot.x, f), z: mix(job.z, slot.z, f),
                grabberY: layout.clearanceGrabberY, carrying: true, phase: 'Moving to pool' };
        }
        if (t < 8.3) return { ...pose, x: slot.x, z: slot.z,
            grabberY: mix(layout.clearanceGrabberY, dropY, ease((t - 6.5) / 1.8)),
            carrying: true, phase: 'Lowering into pool' };
        if (t < 9.5) return { ...pose, x: slot.x, z: slot.z,
            grabberY: mix(dropY, layout.parkedGrabberY, ease((t - 8.3) / 1.2)), phase: 'Retracting grabber' };
        const f = ease((t - 9.5) / 1);
        return { ...pose, x: mix(slot.x, 0, f), z: mix(slot.z, layout.homeZ, f), phase: 'Returning to park' };
    }
}
