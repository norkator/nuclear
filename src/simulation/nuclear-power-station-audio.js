/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { pumpDefinition } from './nuclear-power-pumps.js';

export const STATION_SOUNDS = ['computers', 'pumps', 'exchanger', 'turbine', 'condenser'];
const fraction = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

// Draw/audio read-back only: requests, the selected fault menu and frame time
// cannot start machinery or create assignment evidence.
export function stationSoundState(sim, scene, pumpId = 'pumpA') {
    if (!STATION_SOUNDS.includes(scene)) return null;
    let activity = 0, rate = 1, cutoff = 3000, equipment = scene;
    const actual = sim.components.items;
    const secondary = fraction(sim.secondaryFlow / 100);
    const steam = fraction((sim.secondaryTemperature - 65) / 140) * secondary;
    if (scene === 'computers') {
        const rack = sim.computers, fans = fraction(rack.fanSpeed / 100);
        const online = Object.values(rack.units).filter(unit => unit.online).length / 5;
        activity = Math.max(fans, rack.powered ? .22 * online : 0);
        rate = .8 + .2 * fans;
        cutoff = 500 + 2400 * fans;
    } else if (scene === 'pumps') {
        const pump = pumpDefinition(pumpId);
        if (!pump) return null;
        const read = actual[pump.id].actual;
        equipment = pump.id;
        activity = fraction(read.speed / 100);
        rate = .55 + .6 * activity;
        cutoff = 350 + 2500 * fraction(read.flow / 100);
    } else if (scene === 'exchanger') {
        const read = actual.exchanger.actual;
        activity = Math.max(fraction(sim.primaryFlow / 100) * (1 - fraction(read.bypass / 100)), secondary * fraction(read.secondaryValve / 100));
        rate = .85 + .15 * activity;
        cutoff = 650 + 2600 * steam;
    } else if (scene === 'turbine') {
        activity = fraction(actual.turbine.actual.shaftSpeed / 100);
        rate = .6 + .5 * activity;
        cutoff = 1200 + 2000 * fraction(sim.electricalOutput / 410);
    } else {
        activity = secondary * fraction(actual.condenser.actual.coolingFactor) * (.55 + .45 * steam);
        rate = .85 + .15 * activity;
        cutoff = 800 + 2200 * steam;
    }
    return { sound: scene, equipment, activity, rate, cutoff };
}
