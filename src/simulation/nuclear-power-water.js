/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Illustrative water treatment and cooling-water inventories, not plant chemistry.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export class WaterSystems {
    constructor() {
        this.purificationEnabled = true;
        this.makeupEnabled = true;
        this.conductivity = .2;
        this.filterLoad = 0;
        this.intakeDebris = 0;
        this.basinLevel = 100;
        this.purification = 0;
        this.makeup = 0;
        this.sampleSequence = 0;
        this.samples = [];
    }

    get coolingFactor() {
        return clamp(1 - Math.max(0, this.intakeDebris - 20) / 80, 0, 1)
            * clamp(this.basinLevel / 25, 0, 1);
    }

    get healthy() { return this.conductivity <= 2 && this.filterLoad < 80 && this.intakeDebris <= 20 && this.basinLevel >= 25; }

    setControl(sim, key, value) {
        if (!['purificationEnabled', 'makeupEnabled'].includes(key) || typeof value !== 'boolean') return false;
        if (key === 'purificationEnabled' && value && sim.work.locked('waterFilter')
            || key === 'makeupEnabled' && value && sim.work.locked('intake')) return false;
        this[key] = value;
        sim.record(`Water treatment: ${key === 'purificationEnabled' ? 'purification' : 'make-up supply'} ${value ? 'enabled' : 'disabled'}.`);
        return true;
    }

    sample(sim) {
        const sample = { sequence: ++this.sampleSequence, time: sim.elapsed, conductivity: this.conductivity,
            filterLoad: this.filterLoad, intakeDebris: this.intakeDebris, basinLevel: this.basinLevel };
        this.samples.push(sample);
        this.samples = this.samples.slice(-40);
        sim.record(`Water sample ${sample.sequence}: conductivity ${sample.conductivity.toFixed(2)} µS/cm; basin ${sample.basinLevel.toFixed(1)}%.`, 'info', 'process');
        return sample;
    }

    advance(sim, dt) {
        const powered = sim.supply.factor;
        this.purification = this.purificationEnabled && !sim.work.locked('waterFilter')
            ? powered * clamp(1 - this.filterLoad / 100, 0, 1) : 0;
        this.makeup = this.makeupEnabled && !sim.work.locked('intake') ? powered : 0;
        const heat = clamp((sim.power + sim.condition.heatReserve * .125) / 100, 0, 2);
        const circulation = clamp(sim.secondaryFlow / 100, 0, 1.35);
        // Healthy default water stays nominal for ordinary commissioning sessions.
        this.conductivity = clamp(this.conductivity + (.0004 * heat
            - Math.max(0, this.conductivity - .2) * this.purification / 35) * dt, .2, 50);
        this.filterLoad = clamp(this.filterLoad + this.purification * (this.conductivity * .0005 + heat * .0002) * dt, 0, 100);
        this.intakeDebris = clamp(this.intakeDebris + circulation * .0003 * dt, 0, 100);
        this.basinLevel = clamp(this.basinLevel + (this.makeup * .04 - heat * circulation * .004) * dt, 0, 100);
        if (heat > .01) sim.components.items.exchanger.settings.fouling = clamp(
            sim.components.items.exchanger.settings.fouling + Math.max(0, this.conductivity - 2) * heat * dt * .0003, 0, 100);
    }
}
