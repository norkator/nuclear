/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { NuclearPowerSimulation } from './nuclear-power-model.js';
import { SESSION_COMMANDS } from './nuclear-power-session-protocol.js';

// The companion uses existing read-back/ownership/readiness/rendering code, but
// never advances this copy. Restore the class prototypes and shared references
// instead of trying to simulate independently in each connected browser.
export function captureSessionState(simulation) {
    const { sim, schema, objectives, scenarios, ...components } = simulation.components;
    return JSON.parse(JSON.stringify({ ...simulation, components }));
}

export function restoreSessionState(state, simulation = new NuclearPowerSimulation()) {
    const sections = ['condition', 'fuel', 'supply', 'hydraulics', 'components', 'gridDispatch', 'water', 'work'];
    for (const key of Object.keys(simulation)) {
        if (!sections.includes(key) && Object.hasOwn(state, key)) simulation[key] = state[key];
    }
    for (const key of sections) {
        for (const field of Object.keys(simulation[key])) {
            if (!['sim', 'schema', 'objectives', 'scenarios', 'turbineIntegrity'].includes(field)
                && state[key] && Object.hasOwn(state[key], field)) simulation[key][field] = state[key][field];
        }
    }
    Object.assign(simulation.components.turbineIntegrity, state.components.turbineIntegrity);
    simulation.components.items.turbine.integrity = simulation.components.turbineIntegrity;
    simulation.components.sim = simulation;
    simulation.condition.pipes = simulation.hydraulics.pipes;
    return simulation;
}

export function remoteSimulation(simulation, send) {
    const forward = method => (...args) => send({ method, args });
    const overrides = {
        togglePump: key => send({ method: 'setPumpEnabled', args: [key, !simulation[`pump${key}`]] }),
        togglePause: () => send({ method: 'setPaused', args: [!simulation.paused] }),
    };
    const commands = new Set(Object.keys(SESSION_COMMANDS));
    const supply = new Proxy(simulation.supply, { get(target, key) {
        if (key === 'setGrid') return (_sim, value) => forward('setGridAvailable')(value);
        if (key === 'setTurbine') return (_sim, value) => forward('setTurbineConnected')(value);
        if (key === 'command') return (_sim, id, action) => forward('dieselCommand')(id, action);
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
    return new Proxy(simulation, { get(target, key) {
        if (Object.hasOwn(overrides, key)) return overrides[key];
        if (commands.has(key)) return forward(key);
        if (key === 'supply') return supply;
        // Actions outside the first companion's scope stay desktop-owned.
        if (['tick', 'reset', 'repairComponents', 'injectFault', 'startObjective', 'startScenario',
            'inspectEquipment', 'createWorkOrder', 'workOrderAction', 'setWaterControl', 'sampleWater'].includes(key)) return () => false;
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
