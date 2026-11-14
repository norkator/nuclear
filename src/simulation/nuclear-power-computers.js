/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { COMPUTER_UNITS, isComputer } from './nuclear-power-computers-model.js';
import { ComputerRackScene } from './nuclear-power-computers-scene.js';
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const workActions = { isolate: 'Isolate unit', service: 'Complete service', release: 'Release for test', complete: 'Return to service' };

export const computerPanel = `<section id="computers-panel" class="computer-panel" role="tabpanel" aria-labelledby="computers-tab" hidden>
  <div class="computer-heading"><div><span class="eyebrow">I&amp;C / OPERATIONS RACK</span><h2>Computer systems</h2></div></div>
  <div class="computer-health" role="status"><strong data-rack-status></strong><span data-rack-readings></span></div>
  <div class="computer-workspace"><div class="computer-rack-viewport"><div class="computer-rack-scene" aria-label="Interactive 3D computer server rack"></div><p class="computer-view-status" role="status" hidden></p><div class="computer-camera-tools"><button class="small-button" data-computer-camera="out" aria-label="Zoom server rack out">−</button><button class="small-button" data-computer-camera="in" aria-label="Zoom server rack in">+</button><button class="small-button" data-computer-camera="home">Reset view</button></div></div>
  <nav class="computer-unit-list" aria-label="Inspect rack units">${COMPUTER_UNITS.map(unit => `<button data-computer-open="${unit.id}" aria-haspopup="dialog" aria-controls="computer-window" aria-expanded="false"><small>${unit.tag}</small><strong>${unit.name}</strong><span data-computer-state="${unit.id}"></span></button>`).join('')}</nav></div>
  <p class="computer-note">Select a unit to inspect or maintain. Either process server can support Auto. Manual controls, plant instruments and emergency shutdown remain independent of this rack. All equipment is simulated.</p>
</section>`;

export const computerDialog = `<section id="computer-window" class="computer-dialog equipment-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="computer-title"><div class="core-dialog-titlebar" tabindex="0" aria-label="Move computer inspection window with arrow keys or drag"><span aria-hidden="true">⠿</span><h2 id="computer-title">Computer inspection</h2><button class="small-button" data-computer-close aria-label="Close computer inspection">×</button></div><div class="equipment-dialog-body"><p class="computer-description"></p><div class="computer-run"><button class="pump-rocker" data-computer-toggle role="switch" aria-checked="true" aria-label="Selected computer power switch"><span class="pump-rocker-face" aria-hidden="true"><span class="rocker-on">I <small>ON</small></span><span class="rocker-off">O <small>OFF</small></span></span></button><strong class="computer-unit-status"></strong><button class="small-button" data-computer-prefer>Make active server</button></div><dl class="computer-readings">${['temperature', 'hours', 'boot', 'source', 'charge', 'battery', 'airflow', 'filter', 'services'].map(key => `<div data-computer-row="${key}"><dt></dt><dd></dd></div>`).join('')}</dl><div class="computer-inspection-actions"><button class="small-button" data-computer-diagnose>Run diagnostics</button><button class="small-button" data-computer-order>Create work order</button></div><p class="computer-diagnostic"></p><section class="computer-work-order"><h3>Hardware maintenance</h3><p class="computer-order-status"></p><progress max="10" value="0" aria-label="Computer functional test qualifying time"></progress><ul class="computer-service-checks"></ul><div class="computer-inspection-actions">${Object.entries(workActions).map(([action, label]) => `<button class="small-button" data-computer-work="${action}">${label}</button>`).join('')}</div><p>Switch the selected unit OFF, establish the checks, then isolate and service it. Release for test, switch it ON and prove ten continuous seconds of actual operation before returning it to service. Service preserves plant heat, fuel and trip latches.</p></section><p class="computer-result" role="status" aria-live="polite"></p></div></section>`;

export class ComputerConsole {
    constructor(host) {
        this.host = host; this.root = host.shadowRoot; this.selected = 'serverA'; this.phase = 0; this.visible = false;
        this.root.addEventListener('click', event => {
            if (host.companion) return;
            const open = event.target.closest('[data-computer-open]');
            if (open) { this.open(open.dataset.computerOpen); return; }
            const button = event.target.closest('[data-computer-camera], [data-computer-close], [data-computer-toggle], [data-computer-prefer], [data-computer-diagnose], [data-computer-order], [data-computer-work]');
            if (!button || button.disabled) return;
            const sim = host.simulation;
            if (button.dataset.computerCamera) {
                const action = button.dataset.computerCamera;
                if (action === 'home') this.scene?.resetCamera(); else this.scene?.setZoom(this.scene.zoom + (action === 'in' ? .1 : -.1));
            } else if (button.hasAttribute('data-computer-close')) host.closeFloatingDialog(this.dialog);
            else {
                let result;
                if (button.hasAttribute('data-computer-toggle')) result = sim.setComputerEnabled(this.selected, !sim.computers.units[this.selected].enabled);
                else if (button.hasAttribute('data-computer-prefer')) result = sim.selectProcessServer(this.selected);
                else if (button.hasAttribute('data-computer-diagnose')) result = sim.diagnoseComputer(this.selected);
                else if (button.hasAttribute('data-computer-order')) result = sim.createWorkOrder(this.selected);
                else result = sim.workOrderAction(sim.work.current(this.selected)?.id, button.dataset.computerWork);
                this.message = result ? 'Request recorded. Check actual readiness and test progress.' : 'Action blocked. Check power, isolation and service requirements.';
            }
            host.update();
        });
    }
    get dialog() { return this.root.querySelector('.computer-dialog'); }
    connect() {
        if (this.host.companion) return;
        this.observer?.disconnect();
        this.observer = new IntersectionObserver(entries => {
            this.visible = entries.at(-1).isIntersecting;
            this.scene?.setVisible(this.canDraw()); this.draw(); this.host.updateActivity();
        });
        this.observer.observe(this.root.querySelector('.computer-rack-viewport'));
        this.activate();
    }
    disconnect() { this.observer?.disconnect(); this.scene?.dispose(); this.scene = null; this.visible = false; }
    canDraw() {
        return this.host.isConnected && !this.host.companion && this.host.plantTab === 'computers' && !this.unavailable
            && this.visible && this.host.intersecting && !document.hidden;
    }
    activate() {
        const active = this.host.plantTab === 'computers' && !this.host.companion;
        if (active && !this.scene && !this.unavailable) {
            try { this.scene = new ComputerRackScene(this.root.querySelector('.computer-rack-scene'), {
                inspect: id => this.open(id), unavailable: () => this.showUnavailable(),
            }); } catch { this.showUnavailable(); }
        }
        // Explicit tab changes refresh geometry before observers deliver.
        if (active) {
            const rect = this.root.querySelector('.computer-rack-viewport').getBoundingClientRect();
            this.visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        }
        this.scene?.setVisible(this.canDraw()); this.scene?.resize(); this.update(); this.draw();
    }
    showUnavailable() {
        this.unavailable = true; this.scene?.dispose(); this.scene = null;
        this.root.querySelector('.computer-rack-scene').hidden = true;
        this.root.querySelector('.computer-camera-tools').hidden = true;
        const status = this.root.querySelector('.computer-view-status');
        status.textContent = '3D rack unavailable. Use the unit buttons to inspect and maintain equipment.';
        status.hidden = false;
    }
    trigger() { return this.host.plantTab === 'computers' ? this.root.querySelector(`.computer-unit-list [data-computer-open="${this.selected}"]`) : this.root.querySelector('#computers-tab'); }
    open(id) {
        if (!isComputer(id) || this.host.companion) return;
        this.selected = id; this.update(true);
        this.host.openFloatingDialog(this.dialog); this.update(); this.dialog.querySelector('.core-dialog-titlebar').focus({ preventScroll: true }); this.draw();
    }
    hasMotion() { return this.canDraw() && this.host.simulation.computers.fanSpeed > .5; }
    draw(seconds = 0) {
        if (!this.canDraw() || !this.scene) return;
        if (!this.host.simulation.paused && !this.host.reducedMotion.matches) this.phase = (this.phase + Math.min(.1, Math.max(0, seconds)) * this.host.simulation.computers.fanSpeed / 100 * 5) % (Math.PI * 2);
        this.scene.setVisible(true); this.scene.update(this.host.simulation.computers, this.selected, this.host.dataset.theme, this.phase);
    }
    update(forceDialog = false) {
        const sim = this.host.simulation, computers = sim.computers;
        if (this.model !== computers) { this.model = computers; this.message = ''; this.phase = 0; }
        for (const trigger of this.root.querySelectorAll('[data-computer-open]')) trigger.setAttribute('aria-expanded',
            String(trigger.dataset.computerOpen === this.selected && this.dialog.matches(':popover-open')));
        if (this.host.plantTab === 'computers') {
            text(this.root.querySelector('[data-rack-status]'), computers.automationAvailable ? `Process computing ready · ${computers.activeServer === 'serverA' ? 'Server A' : 'Server B'} active` : 'Auto unavailable · Manual controls remain available');
            text(this.root.querySelector('[data-rack-readings]'), `${computers.source === 'UPS' ? 'UPS battery' : computers.source === 'AC' ? 'Auxiliary AC' : 'Rack unpowered'} · ${computers.rackTemperature.toFixed(1)} °C · UPS ${computers.charge.toFixed(0)}%`);
            for (const unit of COMPUTER_UNITS) {
                text(this.root.querySelector(`[data-computer-state="${unit.id}"]`), computers.status(unit.id));
            }
        }
        if (forceDialog || this.dialog.matches(':popover-open')) {
            const id = this.selected, definition = COMPUTER_UNITS.find(unit => unit.id === id), unit = computers.units[id];
            text(this.dialog.querySelector('h2'), `${definition.tag} / ${definition.name}`);
            text(this.dialog.querySelector('.computer-description'), definition.description);
            text(this.dialog.querySelector('.computer-unit-status'), computers.status(id));
            const toggle = this.dialog.querySelector('[data-computer-toggle]'); toggle.setAttribute('aria-checked', String(unit.enabled));
            toggle.setAttribute('aria-label', `${definition.name} power switch`); toggle.disabled = sim.work.locked(id);
            const prefer = this.dialog.querySelector('[data-computer-prefer]'); prefer.hidden = !id.startsWith('server');
            prefer.disabled = !unit.online || !computers.units.rackSwitch.online || computers.preferredServer === id;
            const fields = { temperature: ['Unit temperature', `${unit.temperature.toFixed(1)} °C`], hours: ['Operating hours', unit.hours.toFixed(2)],
                boot: ['Boot countdown', `${unit.bootRemaining.toFixed(1)} s`], source: ['Rack power source', computers.source],
                charge: ['UPS charge', `${computers.charge.toFixed(1)}%`], battery: ['Battery health', `${computers.batteryHealth.toFixed(1)}%`],
                airflow: ['Actual airflow', `${(computers.airflow * 100).toFixed(1)}%`], filter: ['Cooling filter load', `${computers.filterLoad.toFixed(1)}%`], services: ['Completed services', String(unit.services)] };
            for (const [key, [label, value]] of Object.entries(fields)) {
                const row = this.dialog.querySelector(`[data-computer-row="${key}"]`);
                row.hidden = ['charge', 'battery'].includes(key) ? id !== 'rackUps' : ['airflow', 'filter'].includes(key) ? id !== 'rackCooling' : false;
                text(row.querySelector('dt'), label); text(row.querySelector('dd'), value);
            }
            const diagnostic = computers.diagnostics.findLast(record => record.id === id);
            text(this.dialog.querySelector('.computer-diagnostic'), diagnostic ? `Diagnostics ${diagnostic.sequence} · T+${Math.floor(diagnostic.time)} s · ${diagnostic.healthy ? 'Passed' : 'Attention required'} · ${diagnostic.status} · ${diagnostic.temperature.toFixed(1)} °C` : 'No diagnostics recorded for this unit.');
            const order = sim.work.current(id), readiness = sim.work.readiness(sim, id);
            this.dialog.querySelector('[data-computer-order]').disabled = Boolean(order) || sim.condition.meltdown;
            text(this.dialog.querySelector('.computer-order-status'), order ? `${order.id} · ${order.status} · ${order.held.toFixed(1)} / 10 s actual functional test` : 'No open work order. A healthy preventive inspection/service is valid.');
            this.dialog.querySelector('progress').hidden = !order || !['testing', 'ready'].includes(order.status);
            this.dialog.querySelector('progress').value = order?.held || 0;
            this.dialog.querySelector('.computer-service-checks').replaceChildren(...readiness.checks.map(check => {
                const li = document.createElement('li'); li.textContent = `${check.ready ? '✓' : '○'} ${check.label}`; li.dataset.ready = check.ready; return li;
            }));
            for (const button of this.dialog.querySelectorAll('[data-computer-work]')) button.disabled = !({
                isolate: order?.status === 'planned' && readiness.ready, service: order?.status === 'isolated' && readiness.ready,
                release: order?.status === 'serviced' && readiness.ready, complete: order?.status === 'ready',
            })[button.dataset.computerWork];
            text(this.dialog.querySelector('.computer-result'), this.message || '');
        }
        this.draw();
    }
}
