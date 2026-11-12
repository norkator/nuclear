/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Fictional accelerated fuel inventory. Exposure is energy-based, not calendar age.
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

export class FuelInventory {
    constructor(channels) {
        this.rate = 1;
        this.assemblies = channels.filter(c => !c.rodId).map((c, i) => {
            const remaining = 36 + (i * 37 % 64);
            return { id: c.fuelId, x: c.x, y: c.y, remaining, exposure: (100 - remaining) / 100 * 6,
                replacements: 0, announced: remaining <= 20 ? 'low' : 'normal' };
        });
        this.initialEffectiveness = this.meanEffectiveness;
    }

    effectiveness(assembly) {
        return assembly.remaining <= 0 ? 0 : 0.15 + 0.85 * (assembly.remaining / 100) ** 0.7;
    }

    get meanEffectiveness() {
        return this.assemblies.reduce((sum, a) => sum + this.effectiveness(a), 0) / this.assemblies.length;
    }

    get capability() { return Math.min(1.15, this.meanEffectiveness / this.initialEffectiveness); }
    get remaining() { return this.assemblies.reduce((sum, a) => sum + a.remaining, 0) / this.assemblies.length; }

    setRate(sim, value) {
        if (![1, 10, 60].includes(value) || this.rate === value) return;
        this.rate = value;
        sim.record(`Fuel exposure acceleration set to ${value}×. Thermal simulation speed is unchanged.`, 'info', 'operator');
    }

    advance(sim, dt) {
        if (!sim.running || sim.power <= 0) return;
        const openMean = Math.max(1, 100 - sim.rods);
        for (const a of this.assemblies) {
            let open = 0, weights = 0;
            for (const rod of sim.controlRods) {
                const w = 1 / (1 + (rod.x - a.x) ** 2 + (rod.y - a.y) ** 2);
                open += (100 - rod.position) * w;
                weights += w;
            }
            const spatial = 0.85 + ((a.x * 13 + a.y * 7 + 100) % 19) / 60;
            const exposure = dt / 3600 * this.rate * sim.power / 100 * clamp(open / weights / openMean, 0.25, 2) * spatial;
            a.exposure += exposure;
            a.remaining = Math.max(0, a.remaining - exposure / 6 * 100);
            const state = a.remaining <= 0 ? 'spent' : a.remaining <= 20 ? 'low' : 'normal';
            if (state !== a.announced) {
                a.announced = state;
                sim.record(`${a.id} fuel ${state === 'spent' ? 'depleted' : 'reserve below 20%'}. Manual replacement required after cooldown.`, 'warning', 'process');
            }
        }
    }

    replacementReadiness(sim) {
        const reasons = [];
        if (sim.running) reasons.push('Stop the reactor');
        if (sim.controlRods.some(rod => rod.position < 99.5 || rod.target < 99.5)) reasons.push('Wait for all control rods to insert');
        if (sim.temperature >= 150 || sim.condition.peakTemperature >= 200) reasons.push('Coolant must be below 150 °C and fuel below 200 °C');
        if (sim.condition.fault !== 'none' || sim.condition.damaged || sim.condition.meltdown || sim.components?.hasFaults || sim.components?.damaged) reasons.push('Clear faults and repair damage first');
        return { ready: reasons.length === 0, reasons };
    }

    renew(assembly) {
        assembly.remaining = 100;
        assembly.exposure = 0;
        assembly.replacements++;
        assembly.announced = 'normal';
    }

    replaceAll(sim) {
        if (!this.replacementReadiness(sim).ready) return false;
        this.assemblies.forEach(assembly => this.renew(assembly));
        sim.record(`All ${this.assemblies.length} fuel assemblies replaced manually. Reactor remains stopped; retained heat, damage and trip latch preserved.`, 'success', 'operator');
        return true;
    }

    replace(sim, id) {
        const a = this.assemblies.find(a => a.id === id);
        if (!a || !this.replacementReadiness(sim).ready) return false;
        this.renew(a);
        sim.record(`${id} replaced manually with fresh fuel (replacement ${a.replacements}). Other fuel, retained heat and damage preserved.`, 'success', 'operator');
        return true;
    }
}
