/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Fictional operational computers. Manual controls and emergency shutdown are independent.
export const COMPUTER_UNITS = [
    { id: 'serverA', name: 'Process server A', tag: 'PC-01', description: 'Preferred process computer for automatic regulation. Server B can take over while this unit is offline.' },
    { id: 'serverB', name: 'Process server B', tag: 'PC-02', description: 'Redundant process computer. Either healthy, connected server can run normal automatic regulation.' },
    { id: 'rackSwitch', name: 'Control network switch', tag: 'SW-01', description: 'Connects the process servers to normal plant automation. Its loss suspends regulation; independent Manual controls remain available.' },
    { id: 'rackUps', name: 'Rack UPS', tag: 'UPS-01', description: 'Bridges auxiliary AC interruptions for the computer rack. It does not power coolant-pump motors or replace standby diesels.' },
    { id: 'rackCooling', name: 'Rack cooling tray', tag: 'FAN-01', description: 'Fans and a replaceable filter remove computer heat. Blocked airflow can overheat servers and latch a hardware fault.' },
];
export const COMPUTER_IDS = COMPUTER_UNITS.map(unit => unit.id);
export const isComputer = id => COMPUTER_IDS.includes(id);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const approach = (value, target, dt, tau) => target + (value - target) * Math.exp(-dt / tau);

export class PlantComputers {
    constructor() {
        this.units = Object.fromEntries(COMPUTER_IDS.map(id => [id, { enabled: true, online: true, bootRemaining: 0,
            temperature: 28, fault: false, hours: 0, services: 0 }]));
        this.preferredServer = 'serverA';
        this.source = 'AC';
        this.acAvailable = true;
        this.rackTemperature = 28;
        this.charge = 100;
        this.batteryHealth = 100;
        this.filterLoad = 0;
        this.fanHealth = 100;
        this.fanSpeed = 100;
        this.diagnosticSequence = 0;
        this.diagnostics = [];
    }

    get powered() { return this.source !== 'OFF'; }
    get activeServer() {
        return this.units[this.preferredServer].online ? this.preferredServer
            : ['serverA', 'serverB'].find(id => this.units[id].online) || null;
    }
    get automationAvailable() { return this.powered && this.units.rackSwitch.online && Boolean(this.activeServer); }
    get airflow() { return this.fanSpeed / 100 * this.fanHealth / 100 * clamp(1 - this.filterLoad / 100, 0, 1); }

    status(id) {
        const unit = this.units[id];
        if (unit.fault) return 'FAULT · service required';
        if (!unit.enabled) return 'OFF';
        if (!this.powered) return 'NO POWER';
        if (unit.bootRemaining > 0) return `BOOTING · ${Math.ceil(unit.bootRemaining)} s`;
        if (id === 'rackUps') return this.source === 'UPS' ? 'ON BATTERY' : this.charge < 99.9 ? 'CHARGING' : 'READY';
        if (id === 'rackCooling') return this.airflow < .5 ? 'AIRFLOW LOW' : 'COOLING';
        if (['serverA', 'serverB'].includes(id)) return this.activeServer === id ? 'ACTIVE' : 'STANDBY';
        return 'ONLINE';
    }

    setEnabled(sim, id, enabled) {
        const unit = this.units[id];
        if (!isComputer(id) || typeof enabled !== 'boolean' || enabled && sim.work.locked(id)) return false;
        if (unit.enabled === enabled) return true;
        unit.enabled = enabled;
        unit.online = false;
        unit.bootRemaining = enabled && ['serverA', 'serverB', 'rackSwitch'].includes(id) ? 5 : 0;
        sim.record(`${COMPUTER_UNITS.find(item => item.id === id).name} ${enabled ? 'power requested; waiting for actual readiness' : 'switched OFF'}.`, 'info', 'operator');
        return true;
    }

    prefer(sim, id) {
        if (!['serverA', 'serverB'].includes(id) || !this.units[id].online || !this.units.rackSwitch.online) return false;
        this.preferredServer = id;
        sim.record(`Process duty transferred to ${id === 'serverA' ? 'server A' : 'server B'}.`, 'success');
        return true;
    }

    diagnose(sim, id) {
        if (!isComputer(id)) return false;
        const record = { sequence: ++this.diagnosticSequence, id, time: sim.elapsed, status: this.status(id),
            temperature: this.units[id].temperature, source: this.source, charge: this.charge,
            airflow: this.airflow, healthy: this.units[id].online && !this.units[id].fault
                && (id !== 'rackCooling' || this.airflow >= .5) && (id !== 'rackUps' || this.batteryHealth >= 50) };
        this.diagnostics.push(record); this.diagnostics = this.diagnostics.slice(-40);
        sim.components.maintenanceNote(id, `Diagnostics recorded: ${record.status}`);
        return true;
    }

    serviceReadiness(sim, id) {
        const unit = this.units[id], server = ['serverA', 'serverB'].includes(id);
        const checks = [
            { id: 'off', label: 'Selected unit switched OFF and actually offline', ready: !unit.enabled && !unit.online },
            { id: 'cool', label: 'Unit temperature below 45 °C', ready: unit.temperature < 45 },
            { id: 'plant', label: 'Plant not melted', ready: !sim.condition.meltdown },
            ...(server ? [{ id: 'redundancy', label: 'Other server online, or reactor stopped',
                ready: !sim.running || this.units[id === 'serverA' ? 'serverB' : 'serverA'].online }] : []),
            ...(id === 'rackSwitch' ? [{ id: 'manual', label: 'Manual operation selected, or reactor stopped', ready: !sim.autoMode || !sim.running }] : []),
            ...(id === 'rackUps' ? [{ id: 'ac', label: 'Auxiliary AC available for UPS bypass', ready: this.acAvailable }] : []),
            ...(id === 'rackCooling' ? [{ id: 'fans', label: 'Actual fans below 0.5%', ready: this.fanSpeed < .5 }] : []),
        ];
        return { checks, ready: checks.every(check => check.ready) };
    }

    service(sim, id, orderId) {
        const order = sim.work.current(id);
        if (!order || order.id !== orderId || order.status !== 'isolated' || !this.serviceReadiness(sim, id).ready) return false;
        const unit = this.units[id];
        unit.fault = false; unit.services++;
        if (id === 'rackCooling') { this.filterLoad = 0; this.fanHealth = 100; }
        if (id === 'rackUps') this.batteryHealth = 100;
        sim.components.maintenanceNote(id, 'Computer hardware serviced; plant heat, fuel, settings and trips preserved');
        return true;
    }

    testReady(id) {
        return this.units[id].online && !this.units[id].fault && this.units[id].temperature < 60
            && (id !== 'rackCooling' || this.airflow >= .8)
            && (id !== 'rackUps' || this.acAvailable && this.charge >= 25 && this.batteryHealth >= 80);
    }

    advance(sim, dt) {
        const wasAvailable = this.automationAvailable;
        this.acAvailable = sim.supply.factor >= .1;
        const ups = this.units.rackUps;
        this.source = this.acAvailable ? 'AC' : ups.enabled && !ups.fault && this.charge > 0 && this.batteryHealth > 0 && !sim.work.locked('rackUps') ? 'UPS' : 'OFF';
        if (this.source === 'UPS') this.charge = Math.max(0, this.charge - dt * 100 / 120 / Math.max(.1, this.batteryHealth / 100));
        else if (this.acAvailable && ups.enabled && !sim.work.locked('rackUps')) this.charge = Math.min(100, this.charge + dt * 100 / 180);
        if (this.source === 'UPS' && this.charge === 0) this.source = 'OFF';
        const cooling = this.units.rackCooling;
        const fanTarget = this.powered && cooling.enabled && !cooling.fault && !sim.work.locked('rackCooling') ? 100 : 0;
        this.fanSpeed = approach(this.fanSpeed, fanTarget, dt, 1.5);
        const enabledServers = ['serverA', 'serverB'].filter(id => this.units[id].enabled && !this.units[id].fault).length;
        const heat = this.powered ? 12 + enabledServers * (sim.running ? 18 : 9) : 0;
        this.rackTemperature = approach(this.rackTemperature, 24 + heat * (1 - this.airflow * .88), dt, 40);
        if (this.fanSpeed > 1) {
            this.filterLoad = clamp(this.filterLoad + dt * .00025, 0, 100);
            this.fanHealth = clamp(this.fanHealth - dt * .00002, 0, 100);
        }
        for (const [id, unit] of Object.entries(this.units)) {
            const energised = this.powered && unit.enabled && !unit.fault && !sim.work.locked(id);
            if (!energised && unit.online && ['serverA', 'serverB', 'rackSwitch'].includes(id)) unit.bootRemaining = 5;
            unit.bootRemaining = energised ? Math.max(0, unit.bootRemaining - dt) : unit.bootRemaining;
            unit.temperature = approach(unit.temperature, energised ? this.rackTemperature + (id.startsWith('server') ? 5 : 1) : 24, dt, 15);
            if (id !== 'rackCooling' && unit.temperature >= 70 && !unit.fault) {
                unit.fault = true;
                sim.record(`${COMPUTER_UNITS.find(item => item.id === id).name} overheated. Regulation may be unavailable; Manual controls remain live.`, 'warning', 'process');
            }
            unit.online = energised && !unit.fault && unit.bootRemaining === 0;
            if (unit.online) unit.hours += dt / 3600;
        }
        if (wasAvailable !== this.automationAvailable) sim.record(this.automationAvailable
            ? 'Process computing restored. Regulation available; reactor state and trips retained.'
            : 'Process computing unavailable. Automatic targets held; select Manual to operate. Emergency shutdown remains available.',
        this.automationAvailable ? 'success' : 'warning', 'automation');
    }
}
