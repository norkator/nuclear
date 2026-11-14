/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { PUMPS, pumpDefinition } from './nuclear-power-pumps.js';

export const MONITORED_EQUIPMENT = [...PUMPS.map(p => p.id), 'turbine'];
export const WORK_EQUIPMENT = [...MONITORED_EQUIPMENT, 'exchanger', 'condenser', 'waterFilter', 'intake'];
export const WORK_NAMES = Object.fromEntries([...PUMPS.map(p => [p.id, `Pump ${p.key}`]),
    ['turbine', 'Turbine / generator'], ['exchanger', 'Heat exchanger'], ['condenser', 'Condenser'],
    ['waterFilter', 'Purification filter'], ['intake', 'Cooling-water intake']]);
const lockedStates = ['isolated', 'serviced'];
export const WORK_TEST_SECONDS = 10;

export class PlantWork {
    constructor() {
        this.sequence = 0;
        this.inspectionSequence = 0;
        this.inspections = {};
        this.orders = [];
    }

    current(id) { return this.orders.find(order => order.equipment === id && order.status !== 'completed'); }
    locked(id) { return lockedStates.includes(this.current(id)?.status); }
    get hasIsolation() { return this.orders.some(order => lockedStates.includes(order.status)); }

    reading(sim, id) {
        if (!MONITORED_EQUIPMENT.includes(id)) return null;
        const item = sim.components.items[id], pump = pumpDefinition(id);
        const parts = pump ? sim.condition.components[pump.key] : null;
        const damage = parts ? parts.damage : sim.components.turbineIntegrity.damage;
        const wear = Math.max(item.wear, parts ? parts.parts.bearings : sim.components.turbineIntegrity.wear);
        const stress = parts ? parts.stress : sim.components.turbineIntegrity.stress;
        const speed = pump ? item.actual.speed : item.actual.shaftSpeed;
        return { speed, flow: pump ? item.actual.flow : sim.secondaryFlow,
            vibration: speed / 100 * (.6 + wear * .07 + damage * .08 + stress * .02),
            bearingTemperature: 30 + speed * .25 + wear * .6 + damage * .3,
            lubricant: Math.max(0, 100 - wear),
            condition: damage > 0 || item.disturbance.progressiveFault || wear >= 25 ? 'Service attention'
                : stress >= 25 || wear >= 10 ? 'Watch trend' : 'Normal' };
    }

    inspect(sim, id) {
        const reading = this.reading(sim, id);
        if (!reading) return false;
        this.inspections[id] = { sequence: ++this.inspectionSequence, time: sim.elapsed, ...reading };
        sim.components.maintenanceNote(id, `Condition inspection: ${reading.condition}; vibration ${reading.vibration.toFixed(2)} mm/s`);
        return true;
    }

    create(sim, equipment) {
        if (!WORK_EQUIPMENT.includes(equipment) || this.current(equipment) || sim.condition.meltdown) return false;
        const order = { id: `WO-${++this.sequence}`, equipment, status: 'planned', createdAt: sim.elapsed,
            isolatedAt: null, servicedAt: null, releasedAt: null, completedAt: null, held: 0 };
        this.orders.push(order);
        // Retain all open orders and a bounded completed history; IDs never repeat.
        const completed = this.orders.filter(item => item.status === 'completed').slice(-40);
        this.orders = this.orders.filter(item => item.status !== 'completed' || completed.includes(item));
        sim.components.maintenanceNote(equipment, `${order.id}: planned inspection / service`);
        return order;
    }

    readiness(sim, equipment) {
        const pump = pumpDefinition(equipment);
        const checks = [
            ...sim.condition.repairReadiness(sim).checks,
            ...(pump ? [{ id: 'motor', label: `${WORK_NAMES[equipment]} OFF; actual motor and flow below 0.5%`,
                ready: !sim[equipment] && sim.components.items[equipment].actual.speed < .5
                    && sim.components.items[equipment].actual.flow < .5 }] : []),
            ...(equipment === 'turbine' ? [{ id: 'shaft', label: 'Breaker open; shaft below 0.5%',
                ready: !sim.components.items.turbine.settings.breaker && sim.components.items.turbine.actual.shaftSpeed < .5 }] : []),
            ...(['exchanger', 'condenser', 'intake'].includes(equipment) ? [{ id: 'circuits', label: 'Both loops isolated; all pumps OFF and flow below 0.5%',
                ready: ['primary', 'secondary'].every(circuit => sim.hydraulics.isolated(sim, circuit)) }] : []),
            ...(equipment === 'waterFilter' ? [{ id: 'purification', label: 'Purification switched OFF', ready: !sim.water.purificationEnabled }] : []),
            ...(equipment === 'intake' ? [{ id: 'makeup', label: 'Make-up supply switched OFF', ready: !sim.water.makeupEnabled }] : []),
        ];
        return { checks, ready: checks.every(check => check.ready) };
    }

    action(sim, id, action) {
        const order = this.orders.find(item => item.id === id);
        if (!order || order.status === 'completed') return false;
        const equipment = order.equipment;
        if (action === 'isolate' && order.status === 'planned' && this.readiness(sim, equipment).ready) {
            order.status = 'isolated'; order.isolatedAt = sim.elapsed;
        } else if (action === 'service' && order.status === 'isolated' && this.readiness(sim, equipment).ready) {
            if (equipment === 'waterFilter') sim.water.filterLoad = 0;
            else if (equipment === 'intake') sim.water.intakeDebris = 0;
            else if (!sim.components.action(equipment, 'repair', false, order.id)) return false;
            order.status = 'serviced'; order.servicedAt = sim.elapsed;
        } else if (action === 'release' && order.status === 'serviced' && this.readiness(sim, equipment).ready) {
            order.status = 'testing'; order.releasedAt = sim.elapsed;
        } else if (action === 'complete' && order.status === 'ready') {
            order.status = 'completed'; order.completedAt = sim.elapsed;
        } else return false;
        sim.components.maintenanceNote(equipment, `${order.id}: ${order.status}`);
        sim.record(`${order.id} / ${WORK_NAMES[equipment]}: ${order.status}.`, 'success');
        return true;
    }

    advance(sim, dt) {
        for (const order of this.orders.filter(item => item.status === 'testing')) {
            const id = order.equipment, pump = pumpDefinition(id), item = sim.components.items[id];
            const healthy = !sim.tripped && !sim.condition.meltdown && sim.condition.fault === 'none'
                && !sim.components.hasFaults && !sim.condition.damaged && !sim.components.damaged;
            const met = healthy && (pump ? sim[id] && item.actual.speed >= 20 && item.actual.flow >= 20
                && item.actual.pressure <= 145
                : id === 'waterFilter' ? sim.water.purification > .5 && sim.water.filterLoad < 80 && sim.water.conductivity <= 2
                : id === 'intake' ? sim.water.makeup > .5 && sim.water.coolingFactor >= .95 && sim.secondaryFlow >= 20
                : sim.running && sim.electricalOutput > 20 && sim.condition.coolingMargin > 0
                    && (id !== 'turbine' || item.actual.shaftSpeed >= 90 && item.settings.breaker));
            order.held = met ? Math.min(WORK_TEST_SECONDS, order.held + dt) : 0;
            if (order.held >= WORK_TEST_SECONDS) {
                order.status = 'ready';
                sim.components.maintenanceNote(id, `${order.id}: functional test verified; explicit return to service required`);
            }
        }
    }
}
