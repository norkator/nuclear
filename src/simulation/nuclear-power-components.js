/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Browser-local illustrative component processes; never hardware control. */
import { PUMPS, pumpDefinition, PUMP_PARTS } from './nuclear-power-pumps.js';
import { TurbineIntegrity, ELECTRICAL_TARGET_MAX_MW } from './nuclear-power-turbine.js';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (v, target, dt, tau) => target + (v - target) * Math.exp(-dt / tau);
const number = (key, label, min, max, unit = '%', step = 1, owned = false) => ({ key, label, min, max, step, unit, owned, type: 'number' });
const disturbances = [number('disturbanceAmplitude', 'Disturbance amplitude', 0, 100), number('disturbancePeriod', 'Disturbance period', 1, 300, 's'),
    { key: 'disturbanceEnabled', label: 'Disturbance enabled', type: 'boolean', owned: false },
    { key: 'disturbanceMode', label: 'Disturbance mode', type: 'select', options: ['continuous', 'pulse'], owned: false }];
const pump = () => [number('dischargeValve', 'Discharge valve', 0, 100), number('speed', 'Speed override', 0, 100, '%', 1, true), number('trim', 'Speed trim', -25, 25, 'pp'), ...disturbances];
export const COMPONENT_SETTINGS = {
    ...Object.fromEntries(PUMPS.map(p => [p.id, pump()])),
    primaryPipes: [], secondaryPipes: [],
    exchanger: [number('bypass', 'Bypass', 0, 100), number('secondaryValve', 'Secondary valve', 0, 100), number('effectiveness', 'Effectiveness', 0, 100), number('fouling', 'Fouling', 0, 100), ...disturbances],
    turbine: [number('admission', 'Steam admission', 0, 100), number('governorResponse', 'Governor response', 0.1, 30, 's', 0.1), number('loadRamp', 'Load ramp', 1, 400, 'MW/s'), number('generatorLoading', 'Generator loading', 50, 160),
        { key: 'breaker', label: 'Generator breaker', type: 'boolean', owned: false }, ...disturbances],
    condenser: [number('coolingValve', 'Cooling valve', 0, 100), number('inletTemperature', 'Cooling inlet temperature', 0, 60, '°C'), ...disturbances]
};
const commonActions = [{ key: 'pulse', label: 'Pulse' }, { key: 'oscillate', label: 'Toggle oscillation' }, { key: 'fault', label: 'Progressive fault' }, { key: 'clear', label: 'Clear disturbance' }, { key: 'repair', label: 'Service after cooldown' }];
export const COMPONENT_ACTIONS = Object.fromEntries(Object.keys(COMPONENT_SETTINGS).map(id => [id, [...commonActions,
    ...(id === 'turbine' ? [{ key: 'trip', label: 'Trip turbine' }, { key: 'reset', label: 'Reset turbine trip' }, { key: 'start', label: 'Start turbine admission' }] : [])]]));
export const COMPONENT_OBJECTIVES = [
    { id: 'reachMW', label: 'Reach requested output', description: 'Hold the current electrical target within 5 MW for 20 seconds.' },
    { id: 'recoverCooling', label: 'Recover cooling', description: 'Restore both flows and positive cooling margin for 20 seconds.' },
    { id: 'gridOutage', label: 'Maintain cooling through grid loss', description: 'Maintain powered circulation during a grid outage for 20 seconds.' }
];
export const COMPONENT_SCENARIOS = [
    { id: 'flowDrift', label: 'Falling circulation', description: 'Primary flow slowly falls despite an unchanged speed request.' },
    { id: 'warmReturn', label: 'Warming return', description: 'Heat removal and electrical output gradually decline.' },
    { id: 'outputSwing', label: 'Uneven output', description: 'Electrical output varies while core generation remains steady.' },
    { id: 'gridLoss', label: 'Supply interruption', description: 'External electrical supply becomes unavailable.' }
];
const readouts = {
    ...Object.fromEntries(PUMPS.map(p => [p.id, { speed: '%', flow: '%', pressure: '% nominal ΔP', dischargeValve: '%', available: '' }])),
    primaryPipes: { pressure: '% nominal ΔP', flow: '%', damage: '%', leakRate: '% nominal flow' },
    secondaryPipes: { pressure: '% nominal ΔP', flow: '%', damage: '%', leakRate: '% nominal flow' },
    exchanger: { bypass: '%', secondaryValve: '%', effectiveness: '%', fouling: '%', transferFactor: '' },
    condenser: { coolingValve: '%', inletTemperature: '°C', coolingFactor: '' },
    turbine: { admission: '%', shaftSpeed: '%', electricalOutput: 'MW', breaker: '', tripped: '', ready: '', loadLimit: 'MW', generatorLoading: '%', rotorLoad: '% rated', stress: '%', bladeDamage: '%', bladesLost: '/ 40', serviceWear: '%' }
};
export const COMPONENT_READOUTS = Object.fromEntries(Object.entries(readouts).map(([id, fields]) => [id,
    Object.fromEntries(Object.entries(fields).map(([key, unit]) => [key, { label: key.replace(/[A-Z]/g, c => ` ${c.toLowerCase()}`), unit }]))]));
const defaults = {
    ...Object.fromEntries(PUMPS.map(p => [p.id, { dischargeValve: 100, speed: 100, trim: 0 }])),
    primaryPipes: {}, secondaryPipes: {},
    exchanger: { bypass: 0, secondaryValve: 100, effectiveness: 100, fouling: 0 },
    condenser: { coolingValve: 100, inletTemperature: 20 },
    turbine: { admission: 100, governorResponse: 2, loadRamp: 400, generatorLoading: 100, breaker: true }
};

export class ComponentProcesses {
    constructor(sim) {
        this.sim = sim;
        this.schema = COMPONENT_SETTINGS;
        this.scenarios = COMPONENT_SCENARIOS;
        this.objectives = COMPONENT_OBJECTIVES;
        this.maintenance = [];
        this.objective = null;
        this.scenario = null;
        this.items = Object.fromEntries(Object.entries(defaults).map(([id, settings]) => [id, {
            settings: { ...settings }, actual: { ...settings }, override: false,
            disturbance: { amplitude: 20, period: 20, enabled: false, mode: 'continuous', age: 0, pulseRemaining: 0, progressiveFault: false, severity: 0, value: 0 },
            wear: 0, hours: 0, history: [], changes: [], reason: '', tau: id === 'turbine' ? 2 : 3, response: pumpDefinition(id)
                ? 'Parallel pumps share a circuit. Actual speed, discharge valve, AC and retained internal damage determine delivered flow. Sustained overpressure damages blades, bearings and fittings.'
                : id.endsWith('Pipes') ? 'Pressure is relative to single-pump nominal circulation. Sustained pressure above 145% causes retained pipe damage and water leaks. Switch both circuit pumps OFF and wait for flow to stop before cooled repair.'
                : ({ exchanger: 'Bypass, valves, fouling and effectiveness determine transfer to the secondary loop.', condenser: 'Cooling valve and inlet temperature determine heat rejection and generation efficiency.', turbine: 'Admission drives shaft speed; the manually closed breaker enables electrical output.' })[id]
        }]));
        this.turbineIntegrity = new TurbineIntegrity();
        this.items.turbine.integrity = this.turbineIntegrity;
        Object.assign(this.items.turbine.actual, { shaftSpeed: 0, electricalOutput: 0, tripped: false, ready: false, loadLimit: ELECTRICAL_TARGET_MAX_MW, rotorLoad: 0, stress: 0, bladeDamage: 0, bladesLost: 0, serviceWear: 0 });
        this.items.exchanger.actual.transferFactor = 1;
        this.items.condenser.actual.coolingFactor = 1;
        for (const { id } of PUMPS) Object.assign(this.items[id].actual, { speed: 0, flow: 0, pressure: 0, available: false });
        for (const id of ['primaryPipes', 'secondaryPipes']) Object.assign(this.items[id].actual, { pressure: 0, flow: 0, damage: 0, leakRate: 0 });
        this.rampActive = false;
    }

    note(id, message) {
        const item = this.items[id];
        item.changes.push({ time: this.sim.elapsed, message });
        if (item.changes.length > 80) item.changes.shift();
        this.sim.record(`${id}: ${message}`, 'info', 'operator');
    }

    setSetting(id, key, value) {
        const item = this.items[id], entry = COMPONENT_SETTINGS[id]?.find(s => s.key === key);
        if (!Object.hasOwn(this.items, id) || !entry) return false;
        if (this.sim.work?.locked(id) && !(key === 'breaker' && value === false)) return false;
        if (entry.type === 'number') {
            if (!Number.isFinite(value)) return false;
            value = clamp(value, entry.min, entry.max);
        } else if (entry.type === 'boolean') {
            if (![true, false, 0, 1].includes(value)) return false;
            value = Boolean(value);
        } else if (!entry.options.includes(value)) return false;
        if (key === 'fouling' && value < item.settings.fouling && !this.serviceReady) { item.reason = 'Cleaning requires a cooled, stopped, fault-free reactor'; return false; }
        if (entry.owned && this.sim.autoMode && this.sim.running && !item.override) return false;
        if (id === 'turbine' && key === 'admission' && item.actual.tripped && value > 0) return false;
        if (key === 'breaker' && value && (!this.turbineReadiness().ready || item.actual.tripped)) return false;
        const disturbanceKeys = { disturbanceAmplitude: 'amplitude', disturbancePeriod: 'period', disturbanceEnabled: 'enabled', disturbanceMode: 'mode' };
        if (key in disturbanceKeys) item.disturbance[disturbanceKeys[key]] = value;
        else {
            item.settings[key] = value;
            if (key === 'speed') this.sim[`${id}Speed`] = value;
            if (key === 'loadRamp') { this.rampActive = true; item.actual.loadLimit = this.electricalOutput; }
            if (key === 'breaker') { item.actual.breaker = value; item.actual.electricalOutput = this.electricalOutput; }
        }
        this.note(id, `${key} set to ${value}`);
        return true;
    }

    setOverride(id, enabled) {
        const item = this.items[id];
        if (!Object.hasOwn(this.items, id) || typeof enabled !== 'boolean') return false;
        item.override = enabled;
        if (pumpDefinition(id)) item.settings.speed = this.sim[`${id}Speed`];
        this.note(id, enabled ? 'Manual override enabled' : 'Manual override released');
        return true;
    }

    get hasFaults() { return Object.values(this.items).some(i => i.disturbance.progressiveFault); }
    get damaged() { return Object.values(this.items).some(i => i.wear >= 1) || this.turbineIntegrity.damage > 0 || this.turbineIntegrity.serviceDue; }
    get serviceReady() { return this.sim.condition.canRepair(this.sim) && !this.hasFaults; }

    maintenanceNote(id, message) {
        this.maintenance.push({ component: id, time: this.sim.elapsed, message });
        if (this.maintenance.length > 100) this.maintenance.shift();
    }

    action(id, action, silent = false, orderId = null) {
        const item = this.items[id];
        if (!Object.hasOwn(this.items, id)) return false;
        const order = this.sim.work?.current(id);
        if (['repair', 'service'].includes(action) && order
            && !(order.id === orderId && order.status === 'isolated' && this.sim.work.readiness(this.sim, id).ready)) {
            item.reason = 'Use the open work order to isolate, service and test this equipment'; return false;
        }
        if (this.sim.work?.locked(id) && !['repair', 'service', 'clear', 'trip'].includes(action)) return false;
        const d = item.disturbance;
        if (action === 'pulse') { d.pulseRemaining = d.period; d.age = 0; }
        else if (action === 'oscillate') { d.enabled = !d.enabled; d.mode = 'continuous'; d.age = 0; }
        else if (['fault', 'progressiveFault'].includes(action)) {
            d.progressiveFault = true;
            this.sim.condition.beginIncident(this.sim, `Component deterioration: ${id}`);
        } else if (action === 'clear') {
            d.enabled = false; d.progressiveFault = false; d.pulseRemaining = 0; d.severity = 0; d.value = 0;
        } else if (['repair', 'service'].includes(action)) {
            if (!this.serviceReady) { item.reason = 'Service requires a cooled, stopped, fault-free, non-melted reactor'; return false; }
            if (pumpDefinition(id) && (this.sim[id] || item.actual.speed >= .5)) {
                item.reason = 'Switch this pump OFF and wait for the motor to stop before service'; return false;
            }
            if (id === 'turbine' && item.actual.shaftSpeed >= .5) {
                item.reason = 'Wait for the turbine shaft to stop before service'; return false;
            }
            if (id.endsWith('Pipes') && !this.sim.hydraulics.isolated(this.sim, id.replace('Pipes', ''))) {
                item.reason = 'Switch both circuit pumps OFF and wait for motor/flow coast-down before pipe repair'; return false;
            }
            item.wear = 0;
            if (id === 'turbine') {
                this.turbineIntegrity.service();
                Object.assign(item.actual, { rotorLoad: 0, stress: 0, bladeDamage: 0, bladesLost: 0, serviceWear: 0 });
            }
            if (id === 'exchanger') item.settings.fouling = 0;
            if (pumpDefinition(id)) {
                const state = this.sim.condition.components[pumpDefinition(id).key];
                Object.assign(state, { damage: 0, stress: 0 });
                for (const part of PUMP_PARTS) state.parts[part] = 0;
            }
            if (id.endsWith('Pipes') && !this.sim.hydraulics.repair(this.sim, id.replace('Pipes', ''))) return false;
            this.maintenanceNote(id, 'Manual service completed; heat, fuel, trip and hours retained');
        } else if (id === 'turbine' && action === 'trip') {
            item.actual.tripped = true; item.settings.breaker = false; item.actual.breaker = false;
            item.settings.admission = 0; item.actual.admission = 0; item.actual.electricalOutput = 0;
        } else if (id === 'turbine' && action === 'reset') {
            if (!item.actual.tripped || !this.serviceReady || item.actual.shaftSpeed > 5 || item.wear >= 100) return false;
            item.actual.tripped = false; // Remain disconnected with zero admission until explicit Start/tuning.
        } else if (id === 'turbine' && action === 'start') {
            if (item.actual.tripped || this.sim.condition.meltdown || item.wear >= 100 || this.turbineIntegrity.damage >= 100) return false;
            item.settings.admission = 100;
        } else return false;
        if (['fault', 'progressiveFault', 'clear', 'trip', 'reset', 'start'].includes(action)) this.maintenanceNote(id, silent ? 'Scenario symptom observed' : action);
        if (!silent) this.note(id, action);
        return true;
    }

    pumpSpeed(id) {
        const item = this.items[id];
        return clamp((item.override ? item.settings.speed : this.sim[`${id}Speed`]) + item.settings.trim, 0, 100);
    }

    pumpFactor(id) {
        const i = this.items[id];
        return i.actual.dischargeValve / 100 * (1 - i.disturbance.value) * (1 - i.wear / 100);
    }

    get coolingFactor() { return this.items.exchanger.actual.transferFactor * this.items.condenser.actual.coolingFactor; }
    get transferFactor() {
        const t = this.items.turbine;
        return this.coolingFactor * t.actual.admission / 100 * t.actual.generatorLoading / 100 * (1 - t.disturbance.value) * (1 - t.wear / 100) * this.turbineIntegrity.factor;
    }
    get turbineDriveMw() {
        const t = this.items.turbine;
        if (this.sim.condition.meltdown || t.actual.tripped || !t.settings.breaker) return 0;
        const drive = this.sim.power * 4.1 * this.sim.secondaryFlow / 100 * this.coolingFactor * t.actual.admission / 100
            * t.actual.generatorLoading / 100 * (1 - t.disturbance.value) * (1 - t.wear / 100);
        return this.rampActive ? Math.max(0, Math.min(drive, t.actual.loadLimit)) : drive;
    }
    get electricalOutput() {
        const t = this.items.turbine;
        if (this.sim.condition.meltdown || t.actual.tripped || !t.settings.breaker) return 0;
        const available = this.sim.power * 4.1 * this.sim.secondaryFlow / 100 * this.transferFactor;
        return Math.max(0, this.rampActive ? Math.min(available, t.actual.loadLimit) : available);
    }

    turbineReadiness() {
        const t = this.items.turbine;
        const checks = [
            { id: 'trip', label: 'Turbine trip reset', ready: !t.actual.tripped },
            { id: 'steam', label: 'Reactor running with secondary circulation', ready: this.sim.running && this.sim.power >= 5 && this.sim.secondaryFlow >= 20 },
            { id: 'shaft', label: 'Shaft at operating speed', ready: t.actual.shaftSpeed >= 90 },
            { id: 'cooling', label: 'Condenser cooling available', ready: this.items.condenser.actual.coolingFactor > 0.2 },
            { id: 'condition', label: 'Turbine free of faults and severe wear', ready: !t.disturbance.progressiveFault && t.wear < 100 && this.turbineIntegrity.damage < 100 && !this.sim.condition.meltdown }
        ];
        return { ready: checks.every(c => c.ready), checks };
    }

    prepare(dt) {
        for (const [id, i] of Object.entries(this.items)) {
            const d = i.disturbance;
            d.age += dt;
            d.severity = d.progressiveFault ? clamp(d.severity + dt / 90, 0, 1) : d.severity;
            const pulse = d.pulseRemaining > 0;
            d.pulseRemaining = Math.max(0, d.pulseRemaining - dt);
            const wave = d.enabled ? (d.mode === 'pulse' ? (d.age % d.period < d.period / 4 ? 1 : 0) : (1 - Math.cos(d.age * Math.PI * 2 / d.period)) / 2) : 0;
            d.value = clamp(Math.max(pulse ? d.amplitude / 100 : 0, wave * d.amplitude / 100, d.severity), 0, 1);
            for (const [key, target] of Object.entries(i.settings)) {
                if (typeof target === 'number' && !['speed', 'trim', 'governorResponse', 'loadRamp'].includes(key)) {
                    i.actual[key] = approach(i.actual[key], target, dt, id === 'turbine' ? i.settings.governorResponse : i.tau);
                }
            }
            if (id === 'exchanger') i.actual.transferFactor = (1 - i.actual.bypass / 100) * i.actual.secondaryValve / 100 * i.actual.effectiveness / 100 * (1 - i.actual.fouling / 100) * (1 - d.value) * (1 - i.wear / 100);
            if (id === 'condenser') i.actual.coolingFactor = i.actual.coolingValve / 100 * clamp(1 - (i.actual.inletTemperature - 20) / 80, 0, 1) * (1 - d.value) * (1 - i.wear / 100) * (this.sim.water?.coolingFactor ?? 1);
        }
    }

    advance(dt) {
        const sim = this.sim, t = this.items.turbine;
        const shaftTarget = !t.actual.tripped && sim.running && this.turbineIntegrity.damage < 100 ? clamp(sim.power / 5, 0, 1) * 100 * t.actual.admission / 100 * this.coolingFactor * (1 - t.disturbance.value) : 0;
        t.actual.shaftSpeed = approach(t.actual.shaftSpeed, shaftTarget, dt, t.settings.governorResponse);
        const bladesBefore = this.turbineIntegrity.bladesLost, dueBefore = this.turbineIntegrity.serviceDue;
        this.turbineIntegrity.advance(this.turbineDriveMw, t.actual.shaftSpeed, dt);
        Object.assign(t.actual, { rotorLoad: this.turbineIntegrity.load, stress: this.turbineIntegrity.stress, bladeDamage: this.turbineIntegrity.damage, bladesLost: this.turbineIntegrity.bladesLost, serviceWear: this.turbineIntegrity.wear });
        if (this.turbineIntegrity.bladesLost > bladesBefore) {
            sim.condition.beginIncident(sim, 'Turbine rotor overloaded / worn blades');
            sim.record(`Turbine blade fracture: ${this.turbineIntegrity.bladesLost} / 40 lost; ${this.turbineIntegrity.damage.toFixed(1)}% damage. Electrical capacity reduced.`, 'alarm', 'process');
            this.maintenanceNote('turbine', 'Rotor blade fracture; retained capacity loss');
        }
        if (!dueBefore && this.turbineIntegrity.serviceDue) this.maintenanceNote('turbine', 'Scheduled turbine maintenance due');
        if (this.rampActive) {
            const target = sim.power * 4.1 * sim.secondaryFlow / 100 * this.transferFactor;
            t.actual.loadLimit += clamp(target - t.actual.loadLimit, -t.settings.loadRamp * dt, t.settings.loadRamp * dt);
        }
        t.actual.electricalOutput = this.electricalOutput;
        t.actual.breaker = t.settings.breaker;
        t.actual.ready = this.turbineReadiness().ready;
        for (const [id, i] of Object.entries(this.items)) {
            const isPump = !!pumpDefinition(id);
            if (isPump) {
                i.actual.available = sim.supply.factor > 0 && sim[id] && i.wear < 100 && sim.condition.components[pumpDefinition(id).key].damage < 100;
                i.settings.speed = i.override ? i.settings.speed : sim[`${id}Speed`];
            }
            const operating = isPump ? i.actual.speed > 1 : id === 'turbine' ? t.actual.shaftSpeed > 1 : sim.power > 0.1 || sim.condition.heatReserve > 1;
            if (operating) {
                i.hours += dt / 3600;
                // Ordinary hours are tracked without altering the established default plant.
                // Only sustained injected deterioration accumulates additional component wear.
                if (i.disturbance.progressiveFault) i.wear = clamp(i.wear + i.disturbance.severity * dt * 0.12, 0, 100);
            }
            i.reason = i.wear >= 100 ? 'Unavailable: service required' : i.disturbance.progressiveFault ? 'Progressive deterioration active'
                : id === 'turbine' && t.actual.tripped ? 'Turbine trip latched' : isPump && !i.actual.available ? 'Pump disabled or AC unavailable' : '';
            if (!i.history.length || sim.elapsed - i.history.at(-1).time >= 1) {
                i.history.push({ time: sim.elapsed, ...i.actual });
                if (i.history.length > 120) i.history.shift();
            }
        }
        this.advanceObjective(dt);
    }

    startObjective(id) {
        const definition = COMPONENT_OBJECTIVES.find(o => o.id === id);
        if (!definition) return false;
        this.objective = { id, label: definition.label, status: 'active', startedAt: this.sim.elapsed, completedAt: null, progress: 0, reason: 'Waiting for stable conditions', held: 0, target: this.sim.autoElectricalTarget };
        return true;
    }

    advanceObjective(dt) {
        const o = this.objective, sim = this.sim;
        if (!o || o.status !== 'active') return;
        const cooling = sim.primaryFlow >= 70 && sim.secondaryFlow >= 70 && sim.condition.coolingMargin > 0 && this.coolingFactor >= 0.7;
        const healthy = !sim.tripped && !sim.condition.meltdown && !sim.condition.damaged && !this.damaged;
        const met = healthy && (o.id === 'reachMW' ? sim.running && Math.abs(sim.electricalOutput - o.target) <= 5
            : o.id === 'recoverCooling' ? cooling : !sim.supply.gridAvailable && sim.supply.factor > 0 && cooling);
        o.held = met ? o.held + dt : 0;
        o.progress = clamp(o.held / 20, 0, 1);
        o.reason = met ? 'Holding stable conditions' : 'Required conditions not yet met';
        if (o.held >= 20) { o.status = 'completed'; o.completedAt = sim.elapsed; o.reason = 'Objective completed'; sim.record(o.reason + ': ' + o.label, 'success', 'process'); }
    }

    startScenario(id) {
        const definition = COMPONENT_SCENARIOS.find(s => s.id === id);
        if (!definition) return false;
        const cause = { flowDrift: 'Progressive primary pump restriction', warmReturn: 'Progressive condenser cooling loss', outputSwing: 'Oscillating turbine admission capacity', gridLoss: 'External grid disconnected' }[id];
        this.scenario = { id, symptom: definition.description, cause, revealed: false, startedAt: this.sim.elapsed };
        this.sim.condition.beginIncident(this.sim, definition.description);
        if (id === 'flowDrift') this.action('pumpA', 'fault', true);
        if (id === 'warmReturn') this.action('condenser', 'fault', true);
        if (id === 'outputSwing') { this.items.turbine.disturbance.enabled = true; this.items.turbine.disturbance.mode = 'continuous'; this.items.turbine.disturbance.age = 0; }
        if (id === 'gridLoss') this.sim.supply.setGrid(this.sim, false);
        this.sim.record(definition.description, 'warning', 'process');
        return true;
    }
}
