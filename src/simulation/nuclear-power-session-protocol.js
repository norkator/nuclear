/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Commands available to paired browser consoles. Never resolve arbitrary paths
// or execute client-provided JavaScript on the desktop host.
const number = value => typeof value === 'number' && Number.isFinite(value);
const boolean = value => typeof value === 'boolean';
const oneOf = values => value => values.includes(value);
const pump = oneOf(['A', 'A2', 'B', 'B2']);
const rod = value => typeof value === 'string' && /^CR-(0[1-9]|1[0-2])$/.test(value);
const fuel = value => typeof value === 'string' && /^FA-(0[1-9]|[1-3][0-9]|4[0-9])$/.test(value);
const component = oneOf(['pumpA', 'pumpA2', 'pumpB', 'pumpB2', 'primaryPipes', 'secondaryPipes', 'exchanger', 'turbine', 'condenser']);
const setting = oneOf(['dischargeValve', 'speed', 'trim', 'bypass', 'secondaryValve', 'effectiveness', 'fouling', 'admission', 'governorResponse', 'loadRamp', 'generatorLoading', 'breaker', 'coolingValve', 'inletTemperature', 'disturbanceAmplitude', 'disturbancePeriod', 'disturbanceEnabled', 'disturbanceMode']);
export const SESSION_COMMANDS = Object.freeze({
    start: [], stop: [], trip: [], resetTrip: [], acknowledge: [],
    setLoad: [number], setRods: [number], moveRods: [number],
    setRod: [rod, number], setRodOverride: [rod, boolean],
    replaceFuel: [fuel], replaceAllFuel: [],
    setPumpSpeed: [pump, number], setPumpEnabled: [pump, boolean],
    setAutoMode: [boolean], setAutoTargets: [number, number],
    setAutoObjective: [oneOf(['power', 'temperature'])], setElectricalTarget: [number],
    setGridDispatchEnabled: [boolean], requestGridDispatch: [], setFluctuations: [boolean],
    setPaused: [boolean], setComponentOverride: [component, boolean],
    setComponentSetting: [component, setting, value => number(value) || boolean(value) || ['continuous', 'pulse'].includes(value)],
    componentAction: [component, oneOf(['pulse', 'oscillate', 'fault', 'clear', 'repair', 'trip', 'reset', 'start'])],
    setGridAvailable: [boolean], setTurbineConnected: [boolean],
    dieselCommand: [oneOf(['A', 'B']), oneOf(['start', 'stop', 'auto', 'refuel'])],
});

export function validSessionCommand(command) {
    if (!command || typeof command !== 'object' || !Object.hasOwn(SESSION_COMMANDS, command.method)) return false;
    const validators = SESSION_COMMANDS[command.method];
    return Array.isArray(command.args) && command.args.length === validators.length
        && validators.every((validate, index) => validate(command.args[index]));
}

export function freshSessionCommand(message, clock = Date.now(), monotonic = performance.now()) {
    // These stamps originated on this desktop in its last state publication.
    // Reject delayed socket events after host suspension, even if the relay had
    // forwarded the command just before the desktop stopped responding.
    return [message.hostClock, message.hostMonotonic].every(Number.isFinite)
        && clock >= message.hostClock && clock - message.hostClock <= 3000
        && monotonic >= message.hostMonotonic && monotonic - message.hostMonotonic <= 3000;
}

export function applySessionCommand(simulation, command, actions = {}) {
    if (!validSessionCommand(command)) return false;
    const [first, second] = command.args;
    switch (command.method) {
        // Replacement belongs to the host console: it also checks pool capacity
        // and starts the crane. Never fall through to a model-only replacement.
        case 'replaceFuel': return actions.replaceFuel?.(first) === true;
        case 'replaceAllFuel': return actions.replaceAllFuel?.() === true;
        case 'setPumpEnabled': if (simulation[`pump${first}`] !== second) simulation.togglePump(first); return simulation[`pump${first}`] === second;
        case 'setAutoMode': return simulation.setAutoMode(first) !== false;
        case 'setPaused': if (simulation.paused !== first) simulation.togglePause(); break;
        case 'setGridAvailable': simulation.supply.setGrid(simulation, first); break;
        case 'setTurbineConnected': simulation.supply.setTurbine(simulation, first); break;
        case 'dieselCommand': simulation.supply.command(simulation, first, second); break;
        default: simulation[command.method](...command.args);
    }
    return true;
}
