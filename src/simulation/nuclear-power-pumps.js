/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Shared pump identities and fictional parallel-circuit hydraulics. */
export const PUMPS = [
    { key: 'A', id: 'pumpA', circuit: 'primary', tag: 'P-01', backup: false, power: 3.5 },
    { key: 'A2', id: 'pumpA2', circuit: 'primary', tag: 'P-03', backup: true, power: 3.5 },
    { key: 'B', id: 'pumpB', circuit: 'secondary', tag: 'P-02', backup: false, power: 2.5 },
    { key: 'B2', id: 'pumpB2', circuit: 'secondary', tag: 'P-04', backup: true, power: 2.5 },
];
export const CIRCUITS = ['primary', 'secondary'];
export const PUMP_PARTS = ['blades', 'bearings', 'fittings'];
export const MAX_CIRCUIT_FLOW = 135;
export const PRESSURE_LIMIT = 145;
export const PRESSURE_WARNING = 125;
export const FLOW_SCALE = 48; // m³/h per normalized flow percentage point.
export const FLOW_DAMAGE_LIMIT = Math.sqrt(PRESSURE_LIMIT * 100) * FLOW_SCALE;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const approach = (v, target, dt, tau) => target + (v - target) * Math.exp(-dt / tau);
export const pumpDefinition = id => PUMPS.find(pump => pump.id === id || pump.key === id);
export const circuitPumps = circuit => PUMPS.filter(pump => pump.circuit === circuit);

// Illustrative shared-header resistance: two full-speed pumps give 135%, not
// double flow. A stopped branch has a check valve and contributes no reverse flow.
export function parallelFlow(flows) {
    const [a = 0, b = 0] = flows.map(flow => clamp(flow, 0, 100));
    return Math.min(MAX_CIRCUIT_FLOW, Math.max(a, b) + .35 * Math.min(a, b));
}

export class PumpCircuits {
    constructor() {
        this.branches = Object.fromEntries(PUMPS.map(pump => [pump.key, { capacity: 0 }]));
        this.pipes = Object.fromEntries(CIRCUITS.map(circuit => [circuit, {
            pressure: 0, suppliedFlow: 0, flow: 0, damage: 0, exposure: 0, leakRate: 0,
        }]));
    }

    get damaged() { return Object.values(this.pipes).some(pipe => pipe.damage > 0); }

    flowFactor(circuit) { return 1 - this.pipes[circuit].damage * .006; }

    advance(sim, dt, fluctuations) {
        for (const circuit of CIRCUITS) {
            const [main, backup] = circuitPumps(circuit);
            // Preserve the retained single-pump read-back, including restored
            // operating snapshots. Parallel branches keep their own coast-down.
            if (!sim[backup.id] && this.branches[backup.key].capacity < .001) {
                this.branches[main.key].capacity = sim[`${circuit}Flow`] / this.flowFactor(circuit);
            }
        }
        for (const pump of PUMPS) {
            const item = sim.components.items[pump.id];
            const state = sim.condition.components[pump.key];
            const motor = state.damage >= 100 ? 0 : 1 - state.parts.bearings * .006;
            const target = sim[pump.id] ? clamp(sim.components.pumpSpeed(pump.id) * Math.cbrt(sim.supply.factor)
                * motor * sim.condition.flowFactor(pump.key) * sim.components.pumpFactor(pump.id)
                * (1 + fluctuations[pump.circuit] / 100), 0, 100) : 0;
            const branch = this.branches[pump.key];
            branch.capacity = approach(branch.capacity, target, dt, 2);
            // Motor speed remains distinct from delivered branch flow.
            item.actual.speed = approach(item.actual.speed, sim[pump.id]
                ? sim.components.pumpSpeed(pump.id) * Math.cbrt(sim.supply.factor) * motor : 0, dt, 2);
        }
        for (const circuit of CIRCUITS) {
            const pumps = circuitPumps(circuit), pipe = this.pipes[circuit];
            const capacities = pumps.map(pump => this.branches[pump.key].capacity);
            const sum = capacities.reduce((total, value) => total + value, 0);
            pipe.suppliedFlow = parallelFlow(capacities);
            const previousPressure = pipe.pressure;
            pipe.pressure = pipe.suppliedFlow ** 2 / 100;
            if (previousPressure <= PRESSURE_LIMIT && pipe.pressure > PRESSURE_LIMIT) {
                sim.condition.beginIncident(sim, `${circuit} pipework overpressure`);
            }
            const overload = clamp((pipe.pressure - PRESSURE_LIMIT) / 37.25, 0, 1);
            pipe.exposure = overload > 0 ? pipe.exposure + dt : Math.max(0, pipe.exposure - dt * 2);
            const before = pipe.damage;
            if (pipe.exposure > 8) pipe.damage = clamp(pipe.damage + overload * .8 * dt, 0, 100);
            if (before === 0 && pipe.damage > 0) {
                sim.condition.beginIncident(sim, `${circuit} pipework overpressure`);
                sim.record(`${circuit} pipework damaged by sustained overpressure. Reduce circulation; isolate both pumps before repair.`, 'alarm', 'process');
            }
            pipe.flow = pipe.suppliedFlow * this.flowFactor(circuit);
            pipe.leakRate = pipe.suppliedFlow > .5 && pipe.damage > 0 ? pipe.suppliedFlow - pipe.flow : 0;
            sim[`${circuit}Flow`] = pipe.flow;
            for (const [index, pump] of pumps.entries()) {
                const actual = sim.components.items[pump.id].actual;
                actual.flow = sum > 0 ? pipe.suppliedFlow * capacities[index] / sum : 0;
                actual.pressure = pipe.pressure;
            }
            Object.assign(sim.components.items[`${circuit}Pipes`].actual, {
                pressure: pipe.pressure, flow: pipe.flow, damage: pipe.damage, leakRate: pipe.leakRate,
            });
        }
    }

    isolated(sim, circuit) {
        return circuitPumps(circuit).every(pump => !sim[pump.id] && sim.components.items[pump.id].actual.speed < .5)
            && this.pipes[circuit].suppliedFlow < .5;
    }

    repairChecks(sim) {
        return CIRCUITS.filter(circuit => this.pipes[circuit].damage > 0).map(circuit => ({
            id: `${circuit}Isolation`, label: `Both ${circuit} pumps OFF; motor speed and flow below 0.5%`,
            ready: this.isolated(sim, circuit),
        }));
    }

    repair(sim, circuit) {
        if (!this.isolated(sim, circuit) || !sim.condition.canRepair(sim)) return false;
        Object.assign(this.pipes[circuit], { damage: 0, exposure: 0, leakRate: 0 });
        Object.assign(sim.components.items[`${circuit}Pipes`].actual, { damage: 0, leakRate: 0 });
        return true;
    }
}
