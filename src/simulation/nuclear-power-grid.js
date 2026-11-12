/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Browser-local dispatch exercise. Requests change the existing electrical target;
// the plant regulator remains responsible for actual output and all interlocks.
import { CIRCUITS, circuitPumps, parallelFlow } from './nuclear-power-pumps.js';
const CHANGES_MW = [40, -60, 80, -40, 60, -80];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function expectedFlows(sim, circulation) {
    return CIRCUITS.map(circuit => {
        const enabled = circuitPumps(circuit).filter(pump => sim[pump.id]);
        const flowAt = control => parallelFlow(enabled.map(({ id, key }) => {
            const item = sim.components.items[id], state = sim.condition.components[key];
            if (sim.supply.factor <= 0) return 0;
            const speed = clamp((item.override ? item.settings.speed : control) + item.settings.trim, 0, 100);
            const motor = state.damage >= 100 ? 0 : 1 - state.parts.bearings * .006;
            return speed * motor * sim.components.pumpFactor(id) * sim.condition.flowFactor(key) * Math.cbrt(sim.supply.factor);
        })) * sim.hydraulics.flowFactor(circuit);
        let control = circulation;
        // Auto owns a shared circuit target, rather than requesting the target
        // separately from both pumps. Operator-owned speeds remain fixed.
        if (enabled.length > 1 && enabled.some(pump => !sim.components.items[pump.id].override)) {
            let low = 25, high = 100;
            for (let i = 0; i < 24; i++) {
                const middle = (low + high) / 2;
                if (flowAt(middle) < circulation) low = middle; else high = middle;
            }
            control = (low + high) / 2;
        }
        return flowAt(control) / 100;
    });
}

// Dispatch uses a normal 330 C operating envelope, independent of the user's
// uncapped manual setting. Alarms and operator emergency shutdown remain separate.
export function gridDispatchCapacity(sim) {
    const turbine = sim.components.items.turbine;
    if (!sim.running || sim.tripped || sim.condition.meltdown || turbine.actual.tripped || !turbine.settings.breaker) return 0;
    const [primary, secondary] = expectedFlows(sim, 100);
    const cooling = sim.components.coolingFactor;
    const transfer = sim.components.transferFactor;
    if (primary <= 0 || secondary <= 0 || transfer < .05) return 0;
    const coolingLoss = (1 - primary) * 1.2 + (1 - secondary) * .6 + (1 - cooling) * 4;
    const temperaturePower = (330 - 30) / (4 + coolingLoss);
    const coolingPower = Math.max(0, (1200 * Math.min(primary, secondary) * cooling - sim.condition.heatReserve * 1.5) / 12);
    const availableWithdrawal = sim.controlRods.reduce((sum, rod) => sum + (rod.manualOverride ? 100 - rod.target : 100), 0) / sim.controlRods.length;
    const thermal = Math.min(95, temperaturePower, coolingPower, availableWithdrawal * sim.fuel.capability);
    // Leave headroom for ordinary fluctuation; messages use five-MW steps.
    return Math.max(0, Math.floor(Math.min(300, thermal * 4.1 * secondary * transfer * .98) / 5) * 5);
}

export function gridOperatingTargets(sim, targetMw, capacity = gridDispatchCapacity(sim)) {
    const circulationPercent = Math.ceil(clamp(60 + 40 * targetMw / Math.max(5, capacity), 60, 100));
    const [primary, secondary] = expectedFlows(sim, circulationPercent);
    const coolingLoss = (1 - primary) * 1.2 + (1 - secondary) * .6 + (1 - sim.components.coolingFactor) * 4;
    const thermal = targetMw / Math.max(.01, 4.1 * secondary * sim.components.transferFactor);
    const coreLimitC = Math.ceil(Math.max(40, 30 + thermal * (4 + coolingLoss) + 8));
    return { coreLimitC, circulationPercent };
}

export class GridDispatcher {
    constructor() {
        this.enabled = true;
        this.remaining = 45;
        this.sequence = 0;
        this.lastRequest = null;
    }

    setEnabled(sim, enabled) {
        if (this.enabled === Boolean(enabled)) return;
        this.enabled = Boolean(enabled);
        if (this.enabled) this.remaining = 45;
        sim.record(`Simulated grid requests ${this.enabled ? 'enabled; Auto electrical control follows incoming MW targets' : 'disabled; current electrical target retained'}.`, 'info', 'automation');
    }

    readiness(sim) {
        if (!this.enabled) return { ready: false, reason: 'Not following grid requests' };
        if (sim.condition.meltdown) return { ready: false, reason: 'Meltdown / dispatch suspended' };
        if (sim.tripped) return { ready: false, reason: 'Trip latched / dispatch suspended' };
        if (!sim.autoMode) return { ready: false, reason: 'Waiting for Auto mode' };
        if (sim.autoObjective !== 'power') return { ready: false, reason: 'Select Electrical output regulation' };
        if (!sim.running) return { ready: false, reason: 'Waiting for reactor Start' };
        if (sim.paused) return { ready: false, reason: 'Simulation paused' };
        if (!sim.circulationReady()) return { ready: false, reason: 'Waiting for coolant circulation' };
        if (gridDispatchCapacity(sim) < 5) return { ready: false, reason: 'No available dispatch capacity' };
        return { ready: true, reason: '' };
    }

    request(sim) {
        if (!this.readiness(sim).ready) return null;
        const previousTargetMw = sim.autoElectricalTarget;
        const capacityMw = gridDispatchCapacity(sim);
        let change = CHANGES_MW[this.sequence % CHANGES_MW.length];
        let targetMw = Math.max(0, Math.min(capacityMw, previousTargetMw + change));
        // A request at an endpoint must still ask for an actual change.
        if (targetMw === previousTargetMw) {
            change = -change;
            targetMw = Math.max(0, Math.min(capacityMw, previousTargetMw + change));
        }
        const id = `GC-${String(++this.sequence).padStart(3, '0')}`;
        const direction = targetMw > previousTargetMw ? 'RAISE' : 'LOWER';
        const message = `${id}: ${direction === 'RAISE' ? 'Raise' : 'Lower'} electrical output from ${previousTargetMw} to ${targetMw} MW.`;
        const targets = gridOperatingTargets(sim, targetMw, capacityMw);
        this.lastRequest = { id, direction, previousTargetMw, targetMw, ...targets, capacityMw,
            time: sim.elapsed, source: 'SIMULATED_GRID_CONTROLLER', message };
        this.remaining = 60;
        sim.setAutoTargets(targets.coreLimitC, targets.circulationPercent);
        sim.setElectricalTarget(targetMw);
        sim.record(`Simulated grid controller — ${message}`, 'info', 'automation');
        return this.lastRequest;
    }

    advance(sim, seconds) {
        if (!this.readiness(sim).ready || !Number.isFinite(seconds) || seconds <= 0) return;
        this.remaining = Math.max(0, this.remaining - seconds);
        if (this.remaining === 0) this.request(sim);
    }

    status(sim) {
        const readiness = this.readiness(sim);
        if (!readiness.ready) return readiness.reason;
        if (!this.lastRequest) return 'Waiting for first grid message';
        if (sim.regulationLimit) return `Limited: ${sim.regulationLimit}`;
        if (sim.autoElectricalTarget !== this.lastRequest.targetMw || sim.autoTemperature !== this.lastRequest.coreLimitC || sim.autoFlow !== this.lastRequest.circulationPercent) return 'Operator targets changed';
        return Math.abs(sim.electricalOutput - this.lastRequest.targetMw) <= 5 ? 'Requested output reached' : 'Following grid target';
    }
}
