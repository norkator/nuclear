/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Fictional failure/heat model for the browser demo, not reactor engineering. */
import { PUMPS, PUMP_PARTS, PRESSURE_LIMIT } from './nuclear-power-pumps.js';
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const approach = (n, target, dt, tau) => target + (n - target) * Math.exp(-dt / tau);

export class ReactorCondition {
    constructor(rods) {
        this.fuelTemperature = 323.3;
        this.heatReserve = 96;
        this.temperatureRate = 0;
        this.coolingMargin = 288;
        this.stage = 'NORMAL';
        this.fault = 'none';
        this.faultAge = 0;
        this.restriction = Object.fromEntries(PUMPS.map(pump => [pump.key, 1]));
        this.components = Object.fromEntries(PUMPS.map(pump => [pump.key, { stress: 0, damage: 0,
            parts: Object.fromEntries(PUMP_PARTS.map(part => [part, 0])) }]));
        this.zones = rods.map(rod => ({ id: rod.id, temperature: 323.3, exposure: 0, damage: 0 }));
        this.meltdown = false;
        this.meltProgress = 0;
        this.incident = null;
    }

    get peakTemperature() { return Math.max(...this.zones.map(zone => zone.temperature)); }
    get coreDamage() { return Math.max(...this.zones.map(zone => zone.damage)); }
    get damaged() { return this.coreDamage >= 1 || Object.values(this.components).some(component => component.damage >= 1)
        || Object.values(this.pipes || {}).some(pipe => pipe.damage > 0); }

    beginIncident(sim, cause) {
        if (this.incident && !this.incident.resolvedAt) return;
        this.incident = { source: 'SIMULATED', startedAt: sim.elapsed, cause, resolvedAt: null,
            precedingEvents: sim.events.slice(0, 6).toReversed(), timeline: [] };
    }

    note(sim, event) {
        if (!this.incident || this.incident.resolvedAt) return;
        this.incident.timeline.push({ ...event, coreTemperature: sim.temperature,
            fuelTemperature: this.fuelTemperature, electricalMw: sim.electricalOutput,
            primaryFlow: sim.primaryFlow, secondaryFlow: sim.secondaryFlow, stage: this.stage });
        // Retain the initiating event even after a long incident.
        if (this.incident.timeline.length > 160) this.incident.timeline.splice(1, 1);
    }

    inject(sim, fault) {
        if (!['none', 'primary-restriction', 'secondary-loss', 'pump-wear'].includes(fault)) return false;
        this.fault = fault;
        this.faultAge = 0;
        if (fault !== 'none') this.beginIncident(sim, {
            'primary-restriction': 'Progressive primary-loop obstruction',
            'secondary-loss': 'Progressive secondary cooling loss',
            'pump-wear': 'Primary pump deterioration'
        }[fault]);
        return true;
    }

    flowFactor(pump) {
        const component = this.components[pump];
        return this.restriction[pump] * (component.damage >= 100 ? 0 : 1 - component.damage * 0.0075);
    }

    prepare(dt) {
        this.faultAge += dt;
        const targets = Object.fromEntries(PUMPS.map(pump => [pump.key, 1]));
        if (this.fault === 'primary-restriction') targets.A = targets.A2 = Math.max(0, 1 - this.faultAge / 35);
        if (this.fault === 'secondary-loss') targets.B = targets.B2 = Math.max(0, 1 - this.faultAge / 35);
        if (this.fault === 'pump-wear') targets.A = Math.max(0.1, 1 - this.faultAge / 90);
        for (const { key } of PUMPS) this.restriction[key] = approach(this.restriction[key], targets[key], dt, 2);
    }

    advance(sim, dt, previousTemperature) {
        this.heatReserve = approach(this.heatReserve, sim.power * 1.5, dt, sim.running ? 40 : 240);
        const averageDamage = this.zones.reduce((sum, zone) => sum + zone.damage, 0) / this.zones.length;
        const cooling = Math.min(sim.primaryFlow, sim.secondaryFlow) / 100 * sim.components.coolingFactor * (1 - averageDamage * 0.005);
        this.coolingMargin = 1200 * cooling - sim.power * 12 - this.heatReserve * 1.5;
        const fuelRate = (sim.power * 0.2 + this.heatReserve * 0.1
            - Math.max(0, this.fuelTemperature - sim.temperature) * 0.6 * cooling) / 3;
        this.fuelTemperature = clamp(this.fuelTemperature + clamp(fuelRate, -20, 8) * dt, 25, 1000);
        this.temperatureRate = approach(this.temperatureRate, (sim.temperature - previousTemperature) / dt * 60, dt, 4);

        for (let i = 0; i < this.zones.length; i++) {
            const zone = this.zones[i];
            const rod = sim.controlRods[i];
            const imbalance = Math.max(0, sim.rods - rod.position) * 4.2 * sim.power / 100;
            zone.temperature = approach(zone.temperature, this.fuelTemperature + imbalance, dt, 5);
            zone.exposure = zone.temperature > 410 ? zone.exposure + dt : Math.max(0, zone.exposure - dt * 2);
            if (zone.temperature > 450 && zone.exposure > 15) {
                zone.damage = clamp(zone.damage + Math.min(2, (zone.temperature - 450) / 100) * dt, 0, 100);
            }
        }
        for (const pump of PUMPS) {
            const component = this.components[pump.key];
            const flow = sim.hydraulics.branches[pump.key].capacity;
            const requested = sim[pump.id] ? sim.components.pumpSpeed(pump.id) * Math.cbrt(sim.supply.factor) : 0;
            const deficit = requested > 10 ? Math.max(0, 1 - flow / requested) : 0;
            const pipe = sim.hydraulics.pipes[pump.circuit];
            const overload = requested > 10 && pipe.exposure > 8 ? Math.max(0, (pipe.pressure - PRESSURE_LIMIT) / 37.25) : 0;
            component.stress = clamp(component.stress + (deficit > .15 || overload > 0 ? deficit * 3 + overload * 3 : -2) * dt, 0, 100);
            if (component.stress > 60) component.damage = clamp(component.damage + (component.stress - 60) * 0.012 * dt, 0, 100);
            component.parts.blades = clamp(component.parts.blades + (component.stress > 60 ? deficit * .45 : 0) * dt + overload * .16 * dt, 0, 100);
            component.parts.bearings = clamp(component.parts.bearings + (component.stress > 60 ? requested / 100 * .18 : 0) * dt, 0, 100);
            component.parts.fittings = clamp(component.parts.fittings + overload * .3 * dt, 0, 100);
            component.damage = Math.max(component.damage, ...Object.values(component.parts));
        }
        if (this.coreDamage >= 100 && this.peakTemperature >= 650) this.meltdown = true;
        if (this.meltdown) this.meltProgress = approach(this.meltProgress, 1, dt, 12);
        const stressed = this.coolingMargin < 0 || this.peakTemperature > 380
            || Object.values(this.components).some(component => component.stress >= 25)
            || Object.values(sim.hydraulics.pipes).some(pipe => pipe.pressure > PRESSURE_LIMIT);
        const next = this.meltdown ? 'MELTDOWN' : this.coreDamage >= 1 ? 'CORE DAMAGE' : this.damaged ? 'COMPONENT DAMAGE'
            : sim.temperature > 335 || this.peakTemperature > 410 ? 'OVERHEATING'
                : stressed ? 'STRAINED' : sim.tripped ? 'PROTECTIVE SHUTDOWN' : 'NORMAL';
        if (next !== this.stage) {
            if (next !== 'NORMAL') this.beginIncident(sim, this.coolingMargin < 0 ? 'Heat removal fell below heat load' : `Process entered ${next.toLowerCase()}`);
            this.stage = next;
            sim.record(`Condition: ${next}. Peak fuel ${this.peakTemperature.toFixed(1)} °C; cooling margin ${this.coolingMargin.toFixed(0)} MW.`,
                ['MELTDOWN', 'CORE DAMAGE', 'COMPONENT DAMAGE', 'OVERHEATING'].includes(next) ? 'alarm' : next === 'NORMAL' ? 'success' : 'warning', 'alarm');
            if (next === 'NORMAL' && this.fault === 'none' && this.incident) this.incident.resolvedAt = sim.elapsed;
        }
    }

    repairReadiness(sim) {
        const checks = [
            { id: 'stopped', label: 'Reactor stopped', ready: !sim.running },
            { id: 'faults', label: 'Active faults cleared', ready: this.fault === 'none' && !sim.components?.hasFaults },
            { id: 'coolant', label: 'Coolant below 150 °C', ready: sim.temperature < 150 },
            { id: 'fuel', label: 'Peak fuel below 200 °C', ready: this.peakTemperature < 200 },
            { id: 'meltdown', label: 'No meltdown — Reset demo required after meltdown', ready: !this.meltdown },
            ...((sim.components?.turbineIntegrity.damage > 0 || sim.components?.turbineIntegrity.wear > 0 || sim.components?.items.turbine.wear > 0) ? [{
                id: 'turbineStopped', label: 'Turbine shaft stopped before service', ready: sim.components.items.turbine.actual.shaftSpeed < .5,
            }] : []),
            ...(sim.hydraulics?.repairChecks(sim) || []),
            ...PUMPS.filter(pump => Object.values(this.components[pump.key].parts).some(damage => damage > 0)).map(pump => ({
                id: `${pump.id}Isolation`, label: `Pump ${pump.key} OFF and motor stopped before internal repair`,
                ready: !sim[pump.id] && sim.components.items[pump.id].actual.speed < .5,
            })),
        ];
        return { ready: checks.every(check => check.ready), checks };
    }

    canRepair(sim) { return this.repairReadiness(sim).ready; }

    repair(sim, excludedPumps = []) {
        if (!this.canRepair(sim)) return false;
        for (const [key, component] of Object.entries(this.components)) {
            if (excludedPumps.includes(key)) continue;
            component.damage = 0; component.stress = 0; for (const part of PUMP_PARTS) component.parts[part] = 0;
        }
        for (const zone of this.zones) { zone.damage = 0; zone.exposure = 0; }
        this.stage = sim.tripped ? 'PROTECTIVE SHUTDOWN' : 'NORMAL';
        sim.record('Simulated components repaired after cooldown. Stored heat and operating settings preserved.', 'success', 'operator');
        if (this.incident) this.incident.resolvedAt = sim.elapsed;
        return true;
    }
}
