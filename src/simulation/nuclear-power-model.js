/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */

import { ReactorCondition } from './nuclear-power-condition.js';
import { FuelInventory } from './nuclear-power-fuel.js';
import { AuxiliaryPower } from './nuclear-power-supply.js';
import { ComponentProcesses } from './nuclear-power-components.js';
import { GridDispatcher, gridDispatchCapacity } from './nuclear-power-grid.js';
import { PUMPS, CIRCUITS, circuitPumps, pumpDefinition, PumpCircuits, FLOW_SCALE } from './nuclear-power-pumps.js';
import { ELECTRICAL_TARGET_MAX_MW } from './nuclear-power-turbine.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const approach = (value, target, seconds, response) => target + (value - target) * Math.exp(-seconds / response);

// Fictional channel layout shared by the model and both core visualizations.
const rodPositions = [[-2, -2], [0, -3], [2, -2], [-3, 0], [-1, -1], [1, -1],
    [3, 0], [-1, 1], [1, 1], [-2, 2], [0, 3], [2, 2]];
export const CORE_CHANNELS = [];
for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
        if (x * x + y * y > 18) continue;
        const rodIndex = rodPositions.findIndex(([rx, ry]) => rx === x && ry === y);
        CORE_CHANNELS.push({ x, y, rodId: rodIndex < 0 ? null : `CR-${String(rodIndex + 1).padStart(2, '0')}`,
            fuelId: rodIndex < 0 ? `FA-${String(CORE_CHANNELS.filter(c => c.fuelId).length + 1).padStart(2, '0')}` : null });
    }
}

/** Illustrative, deterministic animation model; not a physical reactor model.
 * Signals are deliberately separate from rendering so a later read-only measurement
 * adapter can supply explicitly sourced values without changing the schematic.
 */
export class NuclearPowerSimulation {
    constructor() {
        this.reset();
    }

    reset() {
        this.elapsed = 0;
        this.startSequence = 0;
        this.running = false;
        this.tripped = false;
        this.paused = false;
        this.demand = 64;
        this.controlRods = rodPositions.map(([x, y], index) => ({
            id: `CR-${String(index + 1).padStart(2, '0')}`, x, y, target: 100, position: 100, manualOverride: false
        }));
        this.operatingRodTargets = this.controlRods.map(() => 36);
        this.power = 0;
        this.temperature = 30;
        this.returnTemperature = 30;
        this.secondaryTemperature = 28;
        this.secondaryReturnTemperature = 28;
        for (const pump of PUMPS) { this[pump.id] = false; this[`${pump.id}Speed`] = 100; }
        this.primaryFlow = 0;
        this.secondaryFlow = 0;
        this.autoMode = true;
        this.autoObjective = 'power';
        this.autoElectricalTarget = 200;
        this.regulationLimit = '';
        this.outputControlIntegral = 0;
        this.autoTemperature = 286;
        this.autoFlow = 85;
        this.fluctuationsEnabled = true;
        this.controlIntegral = 0;
        this.lastControlTime = -1;
        this.lastAutoLog = -10;
        this.lastProcessLog = 0;
        this.history = [];
        this.events = [];
        this.alarms = [];
        this.condition = new ReactorCondition(this.controlRods);
        this.condition.fuelTemperature = 30;
        this.condition.heatReserve = 0;
        this.condition.coolingMargin = 1200;
        this.condition.zones.forEach(zone => { zone.temperature = 30; });
        this.fuel = new FuelInventory(CORE_CHANNELS);
        this.supply = new AuxiliaryPower();
        this.hydraulics = new PumpCircuits();
        this.condition.pipes = this.hydraulics.pipes;
        this.components = new ComponentProcesses(this);
        this.gridDispatch = new GridDispatcher();
        this.record('Simulation initialized. Reactor stopped; start a pump in each circuit before reactor Start. Backup pumps require manual enable. Auto electrical output control; process fluctuations enabled.', 'info', 'system');
        this.sample();
    }

    get electricalOutput() { return this.components.electricalOutput; }

    setComponentSetting(id, key, value) { return this.components.setSetting(id, key, value); }
    setComponentOverride(id, enabled) { return this.components.setOverride(id, enabled); }
    componentAction(id, action) { return this.components.action(id, action); }
    startObjective(id) { return this.components.startObjective(id); }
    startScenario(id) { return this.components.startScenario(id); }

    turbineReadiness() { return this.components.turbineReadiness(); }

    startupReadiness() {
        const checks = [
            { id: 'trip', label: 'Reactor trip reset', ready: !this.tripped },
            { id: 'stopped', label: 'Reactor stopped', ready: !this.running },
            { id: 'circulation', label: 'Both coolant circuits circulating with AC', ready: this.circulationReady() },
            { id: 'temperature', label: 'Core below startup temperature limit', ready: this.temperature < 335 },
            { id: 'fuel', label: 'Usable fuel available', ready: this.fuel.capability > 0 },
            { id: 'condition', label: 'No meltdown, retained damage or active faults', ready: !this.condition.meltdown && !this.condition.damaged && this.condition.fault === 'none' && !this.components.hasFaults && !this.components.damaged },
            { id: 'heatRemoval', label: 'Exchanger and condenser available', ready: this.components.coolingFactor > 0.2 },
            { id: 'turbine', label: 'Turbine trip reset', ready: !this.components.items.turbine.actual.tripped }
        ];
        return { ready: checks.every(c => c.ready), checks };
    }

    get rods() {
        return this.controlRods.reduce((sum, rod) => sum + rod.position, 0) / this.controlRods.length;
    }

    get rodTarget() {
        return this.controlRods.reduce((sum, rod) => sum + rod.target, 0) / this.controlRods.length;
    }

    rememberRodTargets() {
        this.operatingRodTargets = this.controlRods.map(rod => rod.target);
        this.demand = 100 - this.rodTarget;
    }

    record(message, severity = 'info', category = 'operator') {
        const event = { time: this.elapsed, message, severity, category };
        this.events.unshift(event);
        this.events.length = Math.min(this.events.length, 200);
        this.condition?.note(this, event);
    }

    start() {
        if (this.tripped || this.running) return;
        if (!this.startupReadiness().ready) { this.record('Startup blocked: complete the startup readiness checklist.', 'warning'); return; }
        if (this.fuel.capability <= 0) {
            this.record('Startup blocked: no usable fuel remains. Replace fuel manually after cooldown.', 'warning');
            return;
        }
        if (!this.circulationReady() || this.temperature >= 335 || this.condition.damaged || this.condition.meltdown) {
            this.record('Startup blocked: restore circulation and allow the core to cool below the demo reset limit.', 'warning');
            return;
        }
        this.running = true;
        this.startSequence++;
        this.controlRods.forEach((rod, index) => { rod.target = this.operatingRodTargets[index]; });
        this.record('Startup initiated. Rods moving to load setpoint.', 'success');
        this.updateAlarms();
    }

    stop(reason = 'Normal shutdown. Coolant circulation maintained.') {
        if (!this.running) return;
        this.running = false;
        this.clearRodOverrides();
        this.controlRods.forEach(rod => { rod.target = 100; });
        this.record(reason);
        this.updateAlarms();
    }

    setLoad(value) {
        if (this.tripped || this.autoMode || !Number.isFinite(value)) return;
        this.demand = clamp(Math.round(value), 0, 100);
        this.operatingRodTargets = this.controlRods.map(() => 100 - this.demand);
        if (this.running) this.controlRods.forEach(rod => { rod.target = 100 - this.demand; });
        this.record(`Load setpoint changed to ${this.demand}%.`);
    }

    setRods(value) {
        if (this.tripped || this.autoMode || !this.running || !Number.isFinite(value)) return;
        const target = clamp(Math.round(value), 0, 100);
        this.controlRods.forEach(rod => { rod.target = target; });
        this.rememberRodTargets();
        this.record(`All rod insertion targets set to ${target}%.`);
    }

    setRod(id, value) {
        const rod = this.controlRods.find(candidate => candidate.id === id);
        if (!rod || this.tripped || (this.autoMode && !rod.manualOverride) || !this.running || !Number.isFinite(value)) return;
        rod.target = clamp(Math.round(value), 0, 100);
        this.rememberRodTargets();
        this.record(`${id} insertion target set to ${rod.target}%.`);
    }

    setRodOverride(id, enabled) {
        const rod = this.controlRods.find(r => r.id === id);
        if (!rod || !this.autoMode || !this.running || this.tripped || rod.manualOverride === enabled) return;
        rod.manualOverride = enabled;
        this.controlIntegral = 0;
        this.outputControlIntegral = 0;
        this.record(`${id} ${enabled ? 'under manual override; Auto regulates the remaining rods' : 'released to automatic control'}.`, 'info', 'automation');
    }

    clearRodOverrides() {
        if (this.controlRods.some(r => r.manualOverride)) this.record('Individual rod overrides released.', 'info', 'automation');
        this.controlRods.forEach(r => { r.manualOverride = false; });
    }

    replaceFuel(id) {
        const replaced = this.fuel.replace(this, id);
        if (replaced) { this.components.maintenanceNote('reactor', `${id} fuel replaced manually`); this.updateAlarms(); }
        return replaced;
    }

    replaceAllFuel() {
        const replaced = this.fuel.replaceAll(this);
        if (replaced) { this.components.maintenanceNote('reactor', 'All fuel assemblies replaced manually'); this.updateAlarms(); }
        return replaced;
    }

    moveRods(delta) {
        if (this.tripped || this.autoMode || !this.running || !Number.isFinite(delta)) return;
        this.controlRods.forEach(rod => { rod.target = clamp(rod.target + delta, 0, 100); });
        this.rememberRodTargets();
        this.record(`Rod bank ${delta >= 0 ? 'inserted' : 'withdrawn'} by ${Math.abs(delta)} percentage points.`);
    }

    setPumpSpeed(pump, value) {
        pump = pumpDefinition(pump)?.key;
        if (!pumpDefinition(pump) || (this.autoMode && this.running && !this.components.items[`pump${pump}`].override) || !Number.isFinite(value)) return;
        this[`pump${pump}Speed`] = clamp(Math.round(value), 0, 100);
        if (this.components.items[`pump${pump}`].override) this.components.items[`pump${pump}`].settings.speed = this[`pump${pump}Speed`];
        this.record(`Pump ${pump} speed target set to ${this[`pump${pump}Speed`]}%.`);
        this.updateAlarms();
    }

    togglePump(pump) {
        const definition = pumpDefinition(pump);
        if (!definition) return;
        pump = definition.key;
        const key = `pump${pump}`;
        this[key] = !this[key];
        if (!this[key] && this.running && this.power > 10 && !circuitPumps(definition.circuit).some(p => this[p.id])) this.condition.beginIncident(this, `Operator stopped pump ${pump}`);
        this.record(`Pump ${pump} ${this[key] ? 'started' : 'stopped'}.`, this[key] ? 'success' : 'warning');
        this.updateAlarms();
    }

    trip(reason = 'Operator emergency shutdown') {
        if (this.tripped) return;
        this.tripped = true;
        this.running = false;
        this.clearRodOverrides();
        this.controlRods.forEach(rod => { rod.target = 100; });
        this.controlIntegral = 0;
        this.record(`${reason}. Rods inserting; restore conditions, then Reset trip.`, 'alarm', 'alarm');
        this.updateAlarms();
    }

    tripRecovery() {
        const checks = [
            { id: 'rods', label: 'All rods fully inserted', ready: this.controlRods.every(rod => rod.position >= 99.5) },
            { id: 'flow', label: 'Both circuits circulating', ready: this.circulationReady() },
            { id: 'temperature', label: 'Temperature below demo reset limit', ready: this.temperature < 335 },
            { id: 'fuel', label: 'Fuel hot spots cooled below warning level', ready: this.condition.peakTemperature < 410 },
            { id: 'damage', label: 'Faults cleared and damaged components repaired', ready: this.condition.fault === 'none' && !this.condition.damaged && !this.condition.meltdown && !this.components.hasFaults && !this.components.damaged }
        ];
        return { ready: checks.every(check => check.ready), checks };
    }

    circulationReady() {
        return this.supply.factor > 0 && CIRCUITS.every(circuit => this[`${circuit}Flow`] >= 20
            && circuitPumps(circuit).some(pump => this[pump.id] && this.components.pumpSpeed(pump.id) >= 20
                && this.components.items[pump.id].actual.speed >= 20));
    }

    resetTrip() {
        if (!this.tripped || !this.tripRecovery().ready) return;
        this.tripped = false;
        this.record('Trip reset. Reactor remains stopped; press Start when ready.', 'success');
        this.updateAlarms();
    }

    injectFault(fault) {
        if (!this.condition.inject(this, fault)) return;
        this.record(fault === 'none' ? 'Injected fault cleared. Circulation will recover; existing damage remains.'
            : `Fault scenario started: ${fault.replaceAll('-', ' ')}.`, 'warning', 'process');
    }

    repairComponents() {
        if (!this.components.serviceReady) return;
        if (this.condition.repair(this)) {
            for (const id of Object.keys(this.components.items)) this.components.action(id, 'repair');
            this.components.maintenanceNote('reactor', 'Core/components repaired after cooldown; fuel and heat preserved');
            this.updateAlarms();
        }
    }

    setAutoMode(enabled) {
        if (this.autoMode === enabled) return;
        this.autoMode = enabled;
        this.clearRodOverrides();
        this.controlIntegral = 0;
        this.outputControlIntegral = 0;
        this.regulationLimit = '';
        this.lastControlTime = this.elapsed - 1;
        this.record(enabled ? `Automatic control enabled. Regulating ${this.autoObjective === 'power' ? 'electrical output' : 'core temperature'} and circulation.`
            : 'Manual control enabled. Automatic protective shutdown disabled; use Emergency shutdown. Rod and pump settings held at current targets.', 'info', 'automation');
    }

    setAutoTargets(temperature, flow) {
        if (!Number.isFinite(temperature) || !Number.isFinite(flow)) return;
        this.autoTemperature = Math.max(40, temperature);
        this.autoFlow = clamp(flow, 25, 100);
        this.controlIntegral = 0;
        this.outputControlIntegral = 0;
        this.record(`Automatic targets: ${this.autoTemperature} °C core; ${this.autoFlow}% circulation.`, 'info', 'automation');
    }

    setAutoObjective(objective) {
        if (!['temperature', 'power'].includes(objective) || objective === this.autoObjective) return;
        this.autoObjective = objective;
        this.controlIntegral = 0;
        this.outputControlIntegral = 0;
        this.regulationLimit = '';
        this.record(`Automatic objective: ${objective === 'power' ? 'electrical output (MW electric); core temperature setting is now a ceiling' : 'core temperature'}.`, 'info', 'automation');
    }

    setElectricalTarget(value) {
        if (!Number.isFinite(value)) return;
        this.autoElectricalTarget = clamp(value, 0, ELECTRICAL_TARGET_MAX_MW);
        this.outputControlIntegral = 0;
        this.record(`Electrical output target set to ${this.autoElectricalTarget} MW electric.`, 'info', 'automation');
    }

    setGridDispatchEnabled(enabled) { this.gridDispatch.setEnabled(this, enabled); }
    requestGridDispatch() { return this.gridDispatch.request(this); }

    setFluctuations(enabled) {
        this.fluctuationsEnabled = enabled;
        this.record(`Process fluctuations ${enabled ? 'enabled' : 'disabled'}.`, 'info', 'process');
    }

    disturbances() {
        if (!this.fluctuationsEnabled) return { heat: 0, power: 0, primary: 0, secondary: 0 };
        const t = this.elapsed;
        return {
            heat: Math.sin(t / 9) * 2.8 + Math.sin(t / 2.7) * 0.7,
            power: Math.sin(t / 13) * 0.7 + Math.sin(t / 3.1) * 0.15,
            primary: Math.sin(t / 7) * 1.8 + Math.sin(t / 2.1) * 0.4,
            secondary: Math.sin(t / 8 + 1) * 1.6 + Math.sin(t / 2.4) * 0.5
        };
    }

    regulate() {
        if (!this.autoMode || !this.running || this.tripped || this.elapsed - this.lastControlTime < 1) return;
        const dt = Math.min(1, this.elapsed - this.lastControlTime);
        this.lastControlTime = this.elapsed;
        const error = this.autoTemperature - this.temperature;
        this.controlIntegral = clamp(this.controlIntegral + error * dt, -150, 150);
        const coolingLoss = (1 - this.primaryFlow / 100) * 1.2 + (1 - this.secondaryFlow / 100) * 0.6 + (1 - this.components.coolingFactor) * 4;
        const basePower = (this.autoTemperature - 30) / (4 + coolingLoss);
        let desiredPower = clamp(basePower + error * 0.12 + this.controlIntegral * 0.003, 0, 95);
        this.regulationLimit = '';
        if (this.autoObjective === 'power') {
            const conversion = 4.1 * Math.max(0.05, this.secondaryFlow / 100 * this.components.transferFactor);
            const electricalError = this.autoElectricalTarget - this.electricalOutput;
            const requestedPower = this.autoElectricalTarget / conversion + electricalError * 0.04 + this.outputControlIntegral * 0.001;
            const temperatureCeiling = Math.max(0, basePower + Math.min(0, error) * 0.12);
            desiredPower = clamp(Math.min(requestedPower, temperatureCeiling), 0, 95);
            if (this.components.items.turbine.actual.tripped || this.components.items.turbine.settings.admission === 0) { desiredPower = 0; this.regulationLimit = 'Turbine stopped or tripped: explicit turbine Start required'; }
            else if (!this.components.items.turbine.settings.breaker) { desiredPower = Math.min(8, temperatureCeiling); this.regulationLimit = 'Generator breaker open: establishing shaft speed; close manually when ready'; }
            else if (this.components.transferFactor < 0.05) { desiredPower = 0; this.regulationLimit = 'Component transfer unavailable'; }
            else if (this.autoElectricalTarget > 0 && this.secondaryFlow < 20) this.regulationLimit = 'Secondary circulation unavailable';
            else if (requestedPower > temperatureCeiling + 0.5) this.regulationLimit = 'Core temperature limit';
            else if (requestedPower > 95.5) this.regulationLimit = 'Generator capacity';
            // Do not wind up the power controller against a cooling/temperature limit.
            if (!this.regulationLimit || electricalError < 0) this.outputControlIntegral = clamp(this.outputControlIntegral + electricalError * dt, -300, 300);
        }
        const coolingLimit = Math.max(0, (1200 * Math.min(this.primaryFlow, this.secondaryFlow) / 100 * this.components.coolingFactor - this.condition.heatReserve * 1.5) / 12);
        if (desiredPower > coolingLimit) { desiredPower = coolingLimit; this.regulationLimit = 'Cooling capacity'; }
        if (this.condition.peakTemperature > 410) {
            desiredPower = Math.min(desiredPower, Math.max(0, this.power - (this.condition.peakTemperature - 410) * 0.08));
            this.regulationLimit = 'Local core hot spot';
        }
        if (desiredPower > 100 * this.fuel.capability) {
            desiredPower = 100 * this.fuel.capability;
            this.regulationLimit = 'Fuel capability';
        }
        const insertion = 100 - desiredPower / Math.max(0.001, this.fuel.capability);
        const free = this.controlRods.filter(rod => !rod.manualOverride);
        const fixed = this.controlRods.filter(rod => rod.manualOverride).reduce((sum, r) => sum + r.target, 0);
        if (free.length) {
            const desired = (insertion * this.controlRods.length - fixed) / free.length;
            // Solve a bounded common shift, preserving free-rod offsets until travel limits.
            let low = -100, high = 100;
            for (let i = 0; i < 30; i++) {
                const shift = (low + high) / 2;
                const mean = free.reduce((sum, r) => sum + clamp(r.target + shift, 0, 100), 0) / free.length;
                if (mean < clamp(desired, 0, 100)) low = shift; else high = shift;
            }
            free.forEach(rod => { rod.target = clamp(rod.target + (low + high) / 2, 0, 100); });
            if (free.length < this.controlRods.length && (desired < 0 || desired > 100)) this.regulationLimit = 'Manual overrides limit regulation';
        } else this.regulationLimit = 'All rods under manual override';
        if (this.regulationLimit) { this.controlIntegral = 0; this.outputControlIntegral = 0; }
        this.rememberRodTargets();
        for (const pump of PUMPS) if (this[pump.id] && !this.components.items[pump.id].override) {
            this[`${pump.id}Speed`] = clamp(this[`${pump.id}Speed`] + (this.autoFlow - this[`${pump.circuit}Flow`]) * .6, 25, 100);
        }
        if (this.elapsed - this.lastAutoLog >= 10) {
            this.lastAutoLog = this.elapsed;
            const target = this.autoObjective === 'power'
                ? `Electrical target ${this.autoElectricalTarget} MW, actual ${(this.electricalOutput).toFixed(1)} MW${this.regulationLimit ? ` (${this.regulationLimit})` : ''}`
                : `Core target ${this.autoTemperature} °C, actual ${this.temperature.toFixed(1)} °C`;
            this.record(`${target}: rod bank ${this.rodTarget.toFixed(1)}%; ${PUMPS.map(pump => `pump ${pump.key} ${this[pump.id] ? this[`${pump.id}Speed`].toFixed(1) + '%' : 'OFF'}`).join(', ')}.`, 'info', 'automation');
        }
    }

    togglePause() {
        this.paused = !this.paused;
        this.record(this.paused ? 'Simulation paused.' : 'Simulation resumed.');
    }

    acknowledge() {
        const pending = this.alarms.filter(alarm => !alarm.acknowledged);
        if (!pending.length) return;
        pending.forEach(alarm => { alarm.acknowledged = true; });
        this.record('Alarms acknowledged. Active conditions remain listed.');
    }

    updateAlarms() {
        const conditions = [
            ['trip', this.tripped, 'Emergency shutdown latched', 'alarm'],
            ['primary', this.running && (this.primaryFlow < 20 || !circuitPumps('primary').some(p => this[p.id] && this.components.pumpSpeed(p.id) >= 20)), 'Primary circulation low or unavailable', 'warning'],
            ['secondary', this.running && (this.secondaryFlow < 20 || !circuitPumps('secondary').some(p => this[p.id] && this.components.pumpSpeed(p.id) >= 20)), 'Secondary circulation low or unavailable', 'warning'],
            ...CIRCUITS.flatMap(circuit => [
                [`${circuit}-pressure`, this.hydraulics.pipes[circuit].pressure > 145, `${circuit} circulation overpressure`, 'alarm'],
                [`${circuit}-leak`, this.hydraulics.pipes[circuit].damage > 0, `${circuit} pipe leak damage: isolate pumps and repair`, 'alarm'],
            ]),
            ['temperature', this.temperature > 335, 'Core temperature high', 'alarm'],
            ['cooling', this.condition.coolingMargin < 0, 'Cooling margin negative: retained heat needs circulation', 'warning'],
            ['fuel', this.condition.peakTemperature > 410, 'Local fuel temperature high', 'alarm'],
            ['component-fault', this.components.hasFaults, 'Component deterioration active: inspect component readings', 'warning'],
            ['turbine-trip', this.components.items.turbine.actual.tripped, 'Turbine trip latched: cooldown, reset and explicit turbine Start required', 'alarm'],
            ['turbine-load', this.components.turbineIntegrity.load > 100, 'Turbine above rated load: rapid wear and blade fracture risk', 'alarm'],
            ['turbine-blades', this.components.turbineIntegrity.damage > 0, 'Turbine blade damage retained: electrical capacity reduced', 'alarm'],
            ['turbine-service', this.components.turbineIntegrity.serviceDue, 'Turbine scheduled maintenance due', 'warning'],
            ['component-process', this.components.hasFaults, 'Component response abnormal: inspect equipment', 'warning'],
            ['component-wear', this.components.damaged, 'Component damage/wear retained: service after cooldown', 'alarm'],
            ['damage', this.condition.damaged, 'Component damage retained: cooldown and repair required', 'alarm'],
            ['meltdown', this.condition.meltdown, 'Core meltdown: reset demo required', 'alarm'],
            ['fuel-reserve', this.fuel.assemblies.some(a => a.remaining <= 20), 'Low or depleted fuel: manual replacement after cooldown', 'warning'],
            ['ac-supply', this.supply.factor === 0, 'Auxiliary AC lost: pumps coasting down', 'alarm'],
            ['diesel', this.supply.source.startsWith('BACKUP'), 'Backup diesel supplying coolant pumps', 'warning'],
            ['diesel-fuel', this.supply.generators.some(g => g.fuel < 15), 'Backup diesel fuel reserve low', 'warning']
        ];
        const next = [];
        for (const [id, active, message, severity] of conditions) {
            const previous = this.alarms.find(alarm => alarm.id === id);
            if (active) {
                next.push(previous || { id, message, severity, acknowledged: false });
                if (!previous) this.record(message, severity, 'alarm');
            } else if (previous) {
                this.record(`Condition cleared: ${previous.message}.`, 'success', 'alarm');
            }
        }
        this.alarms = next;
    }

    tick(seconds = 0.25) {
        if (this.paused || !Number.isFinite(seconds) || seconds <= 0) return;
        // Do not fast-forward a retained window after browser suspension.
        const dt = Math.min(seconds, 1);
        this.elapsed += dt;
        this.condition.prepare(dt);
        this.components.prepare(dt);
        this.supply.advance(this, dt);
        this.gridDispatch.advance(this, dt);
        this.regulate();
        const fluctuation = this.disturbances();
        for (const rod of this.controlRods) {
            rod.position = approach(rod.position, rod.target, dt, this.tripped ? 0.5 : 2.5);
        }
        this.power = approach(this.power, this.running ? clamp((100 - this.rods) * this.fuel.capability * (1 + fluctuation.power / 100), 0, 100) : 0, dt, this.tripped ? 2 : 5);
        this.hydraulics.advance(this, dt, fluctuation);
        this.fuel.advance(this, dt);
        const coolingLoss = (1 - this.primaryFlow / 100) * 1.2 + (1 - this.secondaryFlow / 100) * 0.6 + (1 - this.components.coolingFactor) * 4;
        const retainedHeatTarget = Math.min(this.primaryFlow, this.secondaryFlow) * this.components.coolingFactor < 20
            ? this.condition.fuelTemperature - 35 : 30;
        const coreTarget = Math.max(30 + this.power * (4 + coolingLoss) + fluctuation.heat, retainedHeatTarget);
        const previousTemperature = this.temperature;
        this.temperature = approach(this.temperature, coreTarget, dt, 18);
        // Read-back temperature drop follows actual heat removal. Bypassed or
        // unavailable cooling cannot keep reporting a nominal cold return.
        const heatLoad = this.power + this.condition.heatReserve * .125;
        const primaryDrop = 28 * Math.min(this.primaryFlow, this.secondaryFlow) / 100
            * heatLoad / 64 * this.components.coolingFactor;
        this.returnTemperature = approach(this.returnTemperature,
            Math.max(30, this.temperature - primaryDrop), dt, 7);
        this.secondaryTemperature = approach(this.secondaryTemperature,
            25 + (this.temperature - 25) * 0.61 * this.primaryFlow / 100 * this.components.items.exchanger.actual.transferFactor, dt, 12);
        const condenser = this.components.items.condenser.actual;
        const coolingSink = Math.min(this.secondaryTemperature, condenser.inletTemperature + 5);
        const secondaryDrop = (this.secondaryTemperature - coolingSink) * .85
            * condenser.coolingFactor * this.secondaryFlow / 100;
        this.secondaryReturnTemperature = approach(this.secondaryReturnTemperature,
            Math.max(coolingSink, this.secondaryTemperature - secondaryDrop), dt, 7);
        this.condition.advance(this, dt, previousTemperature);
        this.components.advance(dt);
        // Emergency shutdown is an operator action in both modes. Auto may regulate
        // output down, but alarms/flow/temperature must never latch the mushroom button.
        // Terminal core failure still ends generation through its separate meltdown latch.
        if (this.condition.meltdown) this.stop('Simulated core meltdown ended generation. Reset demo required.');
        this.updateAlarms();
        if (this.elapsed - this.history.at(-1).time >= 1) this.sample();
        if (this.elapsed - this.lastProcessLog >= 10) {
            this.lastProcessLog = this.elapsed;
            this.record(`Core ${this.temperature.toFixed(1)} °C; output ${(this.power * 12).toFixed(0)} MW; flow A ${this.primaryFlow.toFixed(1)}%, B ${this.secondaryFlow.toFixed(1)}%.`, 'info', 'process');
        }
    }

    sample() {
        this.history.push({ time: this.elapsed, temperature: this.temperature, power: this.power,
            electricalOutput: this.electricalOutput,
            electricalTarget: this.autoMode && this.autoObjective === 'power' ? this.autoElectricalTarget : null,
            primaryFlow: this.primaryFlow, secondaryFlow: this.secondaryFlow, rods: this.rods });
        this.history = this.history.filter(point => point.time >= this.elapsed - 120);
    }

    // Live instruments do not need a clone of every component's retained history.
    readings() {
        const signal = (value, unit) => ({ value, unit, source: 'SIMULATED', quality: 'GOOD', time: this.elapsed });
        return {
            elapsed: this.elapsed,
            status: this.condition.meltdown ? 'MELTDOWN' : this.tripped ? 'TRIPPED' : !this.running ? this.temperature > 40 || this.power > 0.1 ? 'COOLING DOWN' : 'STOPPED' : this.power < 2 ? 'STANDBY' : 'RUNNING',
            signals: {
                coreTemperature: signal(this.temperature, '°C'),
                returnTemperature: signal(this.returnTemperature, '°C'),
                secondaryTemperature: signal(this.secondaryTemperature, '°C'),
                secondaryReturnTemperature: signal(this.secondaryReturnTemperature, '°C'),
                thermalOutput: signal(this.power * 12, 'MW'),
                electricalOutput: signal(this.electricalOutput, 'MW'),
                fuelTemperature: signal(this.condition.peakTemperature, '°C'),
                coolingMargin: signal(this.condition.coolingMargin, 'MW'),
                retainedHeat: signal(this.condition.heatReserve * 1.5, 'MW'),
                temperatureRate: signal(this.condition.temperatureRate, '°C/min'),
                coreDamage: signal(this.condition.coreDamage, '%'),
                fuelReserve: signal(this.fuel.remaining, '%'),
                fuelCapability: signal(this.fuel.capability * 100, '%'),
                auxiliaryDemand: signal(this.supply.demand, 'MW'),
                auxiliaryCapacity: signal(this.supply.capacity, 'MW'),
                primaryFlow: signal(this.primaryFlow * FLOW_SCALE, 'm³/h'),
                secondaryFlow: signal(this.secondaryFlow * FLOW_SCALE, 'm³/h'),
                pumpASpeed: signal(this.components.items.pumpA.actual.speed, '%'),
                pumpBSpeed: signal(this.components.items.pumpB.actual.speed, '%'),
                pumpA2Speed: signal(this.components.items.pumpA2.actual.speed, '%'),
                pumpB2Speed: signal(this.components.items.pumpB2.actual.speed, '%'),
                primaryPressure: signal(this.hydraulics.pipes.primary.pressure, '% nominal ΔP'),
                secondaryPressure: signal(this.hydraulics.pipes.secondary.pressure, '% nominal ΔP'),
                rodInsertion: signal(this.rods, '%'),
                load: signal(this.power, '%')
            }
        };
    }

    snapshot() {
        const signal = (value, unit) => ({ value, unit, source: 'SIMULATED', quality: 'GOOD', time: this.elapsed });
        return {
            ...this.readings(),
            components: structuredClone({ items: this.components.items, maintenance: this.components.maintenance, objective: this.components.objective, scenario: this.components.scenario }),
            // Requests remain distinct from reported signals for a future scale-model adapter.
            commands: {
                running: this.running, loadPercent: this.demand, mode: this.autoMode ? 'AUTO' : 'MANUAL',
                temperatureTarget: this.autoTemperature, flowTarget: this.autoFlow,
                objective: this.autoObjective, electricalTargetMw: this.autoElectricalTarget,
                followGridRequests: this.gridDispatch.enabled,
                pumps: Object.fromEntries(PUMPS.map(pump => [pump.key, { enabled: this[pump.id], speedPercent: this[`${pump.id}Speed`] }])),
                rods: this.controlRods.map(rod => ({ id: rod.id, insertionPercent: rod.target, owner: this.autoMode && !rod.manualOverride ? 'AUTO' : 'MANUAL' })),
                auxiliary: { gridAvailable: this.supply.gridAvailable, turbineConnected: this.supply.turbineConnected,
                    generators: this.supply.generators.map(g => ({ id: g.id, automaticStandby: g.automatic })) }
            },
            fuel: this.fuel.assemblies.map(a => ({ id: a.id, reserve: signal(a.remaining, '%'), exposure: signal(a.exposure, 'demo full-power h'), replacements: a.replacements })),
            hydraulics: { source: 'SIMULATED', pipes: structuredClone(this.hydraulics.pipes), pumpParts: structuredClone(this.condition.components) },
            auxiliary: { source: this.supply.source, generators: this.supply.generators.map(g => ({ id: g.id, state: g.state, fuel: signal(g.fuel, '%'), load: signal(g.load, 'MW') })) },
            gridDispatch: { source: 'SIMULATED', nextRequestInSeconds: this.gridDispatch.remaining, availableCapacityMw: gridDispatchCapacity(this),
                lastRequest: this.gridDispatch.lastRequest ? { ...this.gridDispatch.lastRequest } : null, status: this.gridDispatch.status(this) },
            rods: this.controlRods.map(rod => ({ id: rod.id, insertion: signal(rod.position, '%') }))
        };
    }
}
