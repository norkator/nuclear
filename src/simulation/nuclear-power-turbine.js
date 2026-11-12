/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Fictional turbine fatigue, not engineering limits. Randomness is sampled only at manufacture/service. */
export const TURBINE_RATING_MW = 410;
export const ELECTRICAL_TARGET_MAX_MW = 650;
export const TURBINE_BLADE_COUNT = 40;
export const TURBINE_SERVICE_WEAR = 25;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class TurbineIntegrity {
    constructor(random = Math.random) {
        this.serial = 0;
        this.service(random);
    }

    service(random = Math.random) {
        this.damage = 0;
        this.wear = 0;
        this.stress = 0;
        this.load = 0;
        this.exposure = 0;
        this.fragments = [];
        // A fresh rotor tolerates roughly 104–116% for a varying short exposure.
        this.strength = TURBINE_RATING_MW * (1.04 + clamp(random(), 0, 1) * .12);
        this.grace = 3 + clamp(random(), 0, 1) * 5;
    }

    get bladesLost() { return Math.min(TURBINE_BLADE_COUNT, Math.floor(this.damage / 100 * TURBINE_BLADE_COUNT)); }
    get factor() { return (1 - this.damage / 100) * (1 - this.wear * .002); }
    get serviceDue() { return this.wear >= TURBINE_SERVICE_WEAR; }
    get level() {
        return this.damage >= 25 || this.wear >= 70 || this.load >= 110 ? 'danger'
            : this.damage > 0 || this.serviceDue || this.load >= 90 ? 'warning' : 'normal';
    }

    advance(driveMw, shaftSpeed, seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        const dt = Math.min(1, seconds), speed = clamp(shaftSpeed / 100, 0, 1.5);
        this.load = Math.max(0, driveMw) / TURBINE_RATING_MW * 100;
        const overload = Math.max(0, this.load / 100 - 1);
        if (speed > .005) {
            // About 2% per full-load hour; overload can accelerate this by tens of times.
            this.wear = clamp(this.wear + dt * 2 / 3600 * (.2 + .8 * Math.min(1, this.load / 100) ** 2) * speed * (1 + 300 * overload ** 2), 0, 100);
        }
        // Scheduled maintenance becomes due before ordinary wear weakens the rotor.
        const limit = this.strength * (1 - Math.max(0, this.wear - TURBINE_SERVICE_WEAR) * .004);
        const excess = speed > .05 ? Math.max(0, driveMw / limit - 1) : 0;
        this.stress += (clamp((this.load - 85) / 55 * 100, 0, 100) - this.stress) * (1 - Math.exp(-dt / 4));
        this.exposure = excess > 0 ? this.exposure + dt : Math.max(0, this.exposure - dt * 2);
        const oldBlades = this.bladesLost;
        if (this.exposure > this.grace) this.damage = clamp(this.damage + excess * (5 + this.wear * .05) * dt, 0, 100);
        // An already fractured, spinning rotor can deteriorate from imbalance after unloading.
        if (oldBlades && speed > .05) this.damage = clamp(this.damage + oldBlades * .003 * speed * speed * dt, 0, 100);
        for (let blade = oldBlades; blade < this.bladesLost; blade++) {
            this.fragments.push({ id: ++this.serial, blade, angle: (blade * 137.5 + this.strength) % 360 });
        }
    }
}

// One shared presentation clock for overview/SVG/dialog fragments. No simulation state is changed.
export function advanceTurbineFragments(previous = [], fragments = [], seconds = 0) {
    const dt = Number.isFinite(seconds) ? clamp(seconds, 0, .1) : 0;
    return fragments.map(fragment => {
        const age = (previous.find(item => item.id === fragment.id)?.age || 0) + dt;
        const t = Math.min(2.2, age), angle = fragment.angle * Math.PI / 180;
        return { ...fragment, age, x: Math.cos(angle) * t * 1.5, z: Math.sin(angle) * t * 1.5,
            y: Math.max(-2.5, Math.sin(angle) * t * 1.2 + 1.6 * t - 2.5 * t * t), spin: fragment.angle + t * 650 };
    });
}
