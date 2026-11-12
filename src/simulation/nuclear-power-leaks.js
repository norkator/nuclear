/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Actual-state water spray shared by SVG and WebGL; no independent timers. */
import { CIRCUITS, PUMPS } from './nuclear-power-pumps.js';
export function leakSources(sim) {
    return [
        ...CIRCUITS.map(circuit => ({ id: `${circuit}Pipes`, circuit,
            damage: sim.hydraulics.pipes[circuit].damage, rate: sim.hydraulics.pipes[circuit].leakRate,
            pressure: sim.hydraulics.pipes[circuit].pressure })),
        ...PUMPS.map(pump => ({ id: pump.id, circuit: pump.circuit,
            damage: sim.condition.components[pump.key].parts.fittings,
            rate: sim.components.items[pump.id].actual.flow > .5 ? sim.condition.components[pump.key].parts.fittings * .15 : 0,
            pressure: sim.components.items[pump.id].actual.pressure })),
    ];
}

export function waterJetPoint(phase, index, count, pressure) {
    const t = ((phase + index / count) % 1 + 1) % 1;
    const force = Math.min(1.8, Math.max(.2, pressure / 100));
    return { x: force * t * .95, y: force * t * .22 - t * t * 1.45,
        z: Math.sin(index * 2.4) * t * .18, size: .65 + Math.sin(t * Math.PI) * .5, opacity: Math.sin(t * Math.PI) };
}
