/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Simplified auxiliary AC bus; all capacities/timings are illustrative demo values.
import { PUMPS } from './nuclear-power-pumps.js';
export class AuxiliaryPower {
    constructor() {
        this.gridAvailable = true;
        this.turbineConnected = true;
        this.generators = ['A', 'B'].map(id => ({ id, automatic: true, state: 'STANDBY', startRemaining: 0,
            fuel: id === 'A' ? 82 : 95, capacity: 8, load: 0 }));
        this.source = 'TURBINE GENERATOR';
        this.demand = 6.2;
        this.capacity = 20;
        this.factor = 1;
    }

    setGrid(sim, available) {
        if (available === this.gridAvailable) return;
        this.gridAvailable = available;
        sim.record(`External grid supply ${available ? 'restored' : 'disconnected'}.`, available ? 'success' : 'warning', 'operator');
        this.advance(sim, 0);
    }

    setTurbine(sim, connected) {
        if (connected === this.turbineConnected) return;
        this.turbineConnected = connected;
        sim.record(`Turbine auxiliary feed ${connected ? 'connected' : 'isolated'}.`, connected ? 'info' : 'warning', 'operator');
        this.advance(sim, 0);
    }

    command(sim, id, action) {
        const g = this.generators.find(g => g.id === id);
        if (!g) return;
        if (action === 'auto') {
            g.automatic = !g.automatic;
            sim.record(`Diesel ${id} automatic standby ${g.automatic ? 'armed' : 'disabled'}.`);
        } else if (action === 'start') this.start(sim, g, false);
        else if (action === 'stop') {
            g.automatic = false; // Explicit stop must not be undone on the next tick.
            g.state = 'STOPPED'; g.startRemaining = 0; g.load = 0;
            sim.record(`Diesel ${id} stopped; automatic standby disabled.`, 'warning');
        } else if (action === 'refuel' && !['RUNNING', 'STARTING'].includes(g.state)) {
            g.fuel = 100; g.state = g.automatic ? 'STANDBY' : 'STOPPED';
            sim.record(`Diesel ${id} manually refuelled to 100%.`, 'success');
        }
        this.advance(sim, 0);
    }

    start(sim, g, automatic) {
        if (['RUNNING', 'STARTING'].includes(g.state) || g.fuel <= 0) return;
        g.state = 'STARTING'; g.startRemaining = 8;
        sim.record(`Diesel ${g.id} starting (${automatic ? 'automatic loss-of-supply response' : 'manual'}); 8 simulated seconds to ready.`, 'warning', automatic ? 'automation' : 'operator');
    }

    advance(sim, dt) {
        this.demand = .2 + PUMPS.reduce((total, pump) => total + (sim[pump.id]
            ? pump.power * (sim.components.pumpSpeed(pump.id) / 100) ** 3 : 0), 0);
        const turbinePower = sim.running && this.turbineConnected ? sim.electricalOutput : 0;
        const turbineReady = turbinePower >= this.demand + 1;
        const normalAvailable = turbineReady || this.gridAvailable;
        for (const g of this.generators) {
            if (!normalAvailable && g.automatic) this.start(sim, g, true);
            if (g.state === 'STARTING') {
                g.startRemaining = Math.max(0, g.startRemaining - dt);
                if (g.startRemaining === 0) {
                    g.state = 'RUNNING';
                    sim.record(`Diesel ${g.id} ready to supply auxiliary loads.`, 'success', 'process');
                }
            }
            if (g.state === 'RUNNING') {
                g.fuel = Math.max(0, g.fuel - dt / 1800 * 100 * (0.2 + 0.8 * g.load / g.capacity));
                if (g.fuel === 0) { g.state = 'EMPTY'; sim.record(`Diesel ${g.id} stopped: fuel exhausted.`, 'alarm', 'alarm'); }
            }
            g.load = 0;
        }
        const ready = this.generators.filter(g => g.state === 'RUNNING');
        const next = turbineReady ? 'TURBINE GENERATOR' : this.gridAvailable ? 'EXTERNAL GRID'
            : ready.length ? `BACKUP DIESEL ${ready.map(g => g.id).join(' + ')}` : 'NO AC SUPPLY';
        this.capacity = normalAvailable ? 20 : ready.reduce((sum, g) => sum + g.capacity, 0);
        this.factor = Math.min(1, this.capacity / this.demand);
        if (!normalAvailable) for (const g of ready) g.load = Math.min(g.capacity, this.demand / ready.length);
        if (next !== this.source) {
            this.source = next;
            if (this.factor === 0) sim.condition.beginIncident(sim, 'Auxiliary AC power lost');
            sim.record(`Auxiliary supply: ${next}. Pump load ${this.demand.toFixed(2)} MW.`, this.factor === 0 ? 'alarm' : next.startsWith('BACKUP') ? 'warning' : 'success', 'process');
        }
    }
}
