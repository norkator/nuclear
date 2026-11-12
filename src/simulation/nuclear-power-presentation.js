/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Reuse Intl formatters; creating one for every live reading is expensive.
import { PUMPS } from './nuclear-power-pumps.js';
const fixedFormats = new Map();
const percentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const readingFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumber(value, decimals = 0) {
    if (!fixedFormats.has(decimals)) fixedFormats.set(decimals, new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }));
    return fixedFormats.get(decimals).format(value);
}

export const formatPercent = value => `${percentFormat.format(value)}%`;
export const formatReading = value => typeof value === 'number' ? readingFormat.format(value) : String(value ?? '—');
export function setText(element, value) {
    if (element.textContent === value) return;
    element.textContent = value;
}

// Requested settings alone must not keep a stopped, unpowered plant animating.
export function hasPlantMotion(sim) {
    return sim.running || sim.power > .01 || sim.electricalOutput > .1
        || sim.primaryFlow > .1 || sim.secondaryFlow > .1
        || PUMPS.some(pump => sim.components.items[pump.id].actual.speed > .1)
        || sim.components.items.turbine.actual.shaftSpeed > .01
        || sim.controlRods.some(rod => Math.abs(rod.position - rod.target) > .01)
        || sim.condition.peakTemperature > 100 || sim.condition.meltProgress > 0
        || sim.supply.generators.some(generator => ['STARTING', 'RUNNING'].includes(generator.state));
}
