/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';

// An explicit powered fixture for operating scenarios. Cold-start tests use the
// real default and advance the authoritative plant clock through commissioning.
// This helper also runs in browser fixtures via its self-contained source.
export function commissionPlant(sim) {
    sim.supply.setGrid(sim, true);
    sim.supply.setTurbine(sim, true);
    for (const generator of sim.supply.generators) if (!generator.automatic) sim.supply.command(sim, generator.id, 'auto');
    for (const id of Object.keys(sim.computers.units)) sim.setComputerEnabled(id, true);
    sim.computers.advance(sim, 5);
    return sim;
}

export function poweredSimulation() { return commissionPlant(new NuclearPowerSimulation()); }
