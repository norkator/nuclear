/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Maintenance overview of existing simulated damage; no new repair command path. */
import { pumpDefinition } from './nuclear-power-pumps.js';
import { workPanel, initializeWorkPanel, updateWorkPanel } from './nuclear-power-maintenance-work.js';
const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
const percent = value => value < .1 ? '<0.1%' : `${value.toFixed(1)}%`;
const repairBlockers = { stopped: 'Stop the reactor', faults: 'Clear active faults in Maintenance',
    coolant: 'Coolant must be below 150 °C', fuel: 'Peak fuel must be below 200 °C', meltdown: 'Meltdown requires Reset demo' };

export function coreDamagePanel(rodIds) {
    return `<section class="core-damage-panel" aria-label="Core damage inspection">
      <div class="core-damage-heading"><h3 class="core-damage-summary"></h3><button class="small-button" data-maintenance-action="repair" data-core-repair disabled>Repair all damage</button></div>
      <p class="core-damage-hint">Select a damaged zone to inspect its control rod and local readings. Repair all damage also services other plant components; fuel replacement is separate.</p>
      <ul class="core-damage-list" aria-label="Damaged core channels">${rodIds.map(id => `<li hidden data-core-damage-row="${id}"><button data-damaged-zone="${id}" aria-pressed="false"><strong>${id} zone</strong><span></span></button></li>`).join('')}</ul>
      <p class="core-repair-readiness" role="status"></p><p class="maintenance-result" role="status" aria-live="polite"></p>
    </section>`;
}

export function maintenanceItems(sim) {
    const items = [];
    const zones = sim.condition.zones.filter(zone => zone.damage > 0);
    if (zones.length) items.push({ id: 'reactor', damage: sim.condition.coreDamage, zones: zones.length });
    for (const [id, item] of Object.entries(sim.components.items)) {
        const pump = pumpDefinition(id);
        const damage = id === 'turbine' ? sim.components.turbineIntegrity.damage : pump ? sim.condition.components[pump.key].damage : id.endsWith('Pipes') ? sim.hydraulics.pipes[id.replace('Pipes', '')].damage : 0;
        const serviceWear = id === 'turbine' && sim.components.turbineIntegrity.serviceDue ? sim.components.turbineIntegrity.wear : 0;
        const fouling = id === 'exchanger' ? item.settings.fouling : 0;
        if (damage > 0 || item.wear > 0 || fouling > 0 || serviceWear > 0) items.push({ id, damage, wear: item.wear, fouling, ...(serviceWear > 0 ? { serviceWear } : {}) });
    }
    return items;
}

export function maintenancePanel(details) {
    return `<section id="maintenance-panel" class="maintenance-panel" role="tabpanel" aria-labelledby="maintenance-tab" hidden>
      <div class="maintenance-heading"><div><span class="eyebrow">PLANT CONDITION</span><h2>Component maintenance</h2><p>Retained damage, wear and heat-exchanger fouling.</p></div><button class="control-button" data-maintenance-action="repair" disabled>Repair all</button></div>
      <p class="maintenance-summary" role="status"></p>
      <ul class="maintenance-list" aria-label="Components needing repair">${Object.entries(details).map(([id, item]) => `<li data-maintenance-component="${id}" hidden><div><small>${item.tag}</small><strong>${item.name}</strong><span class="maintenance-issue"></span></div><button class="small-button" data-equipment="${id}" aria-label="Inspect ${item.name}" aria-haspopup="dialog" aria-controls="${id === 'reactor' ? 'core-map-window' : `equipment-${id}-window`}">Inspect ↗</button></li>`).join('')}</ul>
      <div class="maintenance-empty"><strong>✓ No damaged components</strong><p>No retained damage, wear or fouling to repair.</p></div>
      <section class="maintenance-readiness" aria-label="Repair conditions"><div><h3>Repair readiness</h3><button class="small-button" data-maintenance-action="clear" disabled>Clear active faults</button></div><p class="maintenance-temperatures"></p><ul></ul><p>Repairs preserve heat, fuel reserves, operating settings and trip latches. The reactor stays stopped. Damaged pipes require both circuit pumps OFF and flow stopped; damaged pump internals require that motor OFF and stopped.</p></section>
      <p class="maintenance-result" role="status" aria-live="polite"></p>
      ${workPanel()}
    </section>`;
}

export function initializeMaintenance(host) {
    initializeWorkPanel(host);
    host.shadowRoot.querySelector('#work-equipment').addEventListener('change', () => host.update());
    host.shadowRoot.addEventListener('click', event => {
        const zone = event.target.closest('[data-damaged-zone]');
        if (zone) host.selectRod(zone.dataset.damagedZone);
        const button = event.target.closest('[data-maintenance-action]');
        if (!button || button.disabled) return;
        const sim = host.simulation;
        if (button.dataset.maintenanceAction === 'repair' && sim.components.serviceReady) {
            const count = maintenanceItems(sim).length;
            sim.repairComponents();
            const repaired = count - maintenanceItems(sim).length;
            host.maintenanceStatus = `${repaired} ${repaired === 1 ? 'component repaired' : 'components repaired'}. Reactor remains stopped; heat, fuel and trips preserved. Open work orders retain their own service steps.`;
        } else if (button.dataset.maintenanceAction === 'clear' && !sim.condition.meltdown) {
            if (sim.condition.fault !== 'none') sim.injectFault('none');
            for (const [id, item] of Object.entries(sim.components.items)) {
                if (item.disturbance.progressiveFault) sim.componentAction(id, 'clear');
            }
            host.maintenanceStatus = 'Active faults cleared. Existing damage remains until repaired.';
        }
        host.update();
    });
}

export function updateMaintenance(host) {
    const sim = host.simulation, root = host.shadowRoot;
    if (host.maintenanceCondition !== sim.condition) {
        host.maintenanceCondition = sim.condition;
        host.maintenanceStatus = '';
    }
    const items = maintenanceItems(sim);
    const zones = sim.condition.zones.filter(zone => zone.damage > 0);
    const readiness = sim.condition.repairReadiness(sim);
    const panel = root.querySelector('#maintenance-panel');
    const tab = root.querySelector('#maintenance-tab');
    setText(tab.querySelector('.maintenance-count'), String(items.length));
    tab.dataset.attention = String(items.length > 0);
    if (host.plantTab === 'maintenance') {
        setText(panel.querySelector('.maintenance-summary'), items.length
            ? `${items.length} ${items.length === 1 ? 'component needs' : 'components need'} attention${readiness.ready ? ' · Ready to repair' : ' · Repair conditions below'}` : 'All components free of retained damage, wear and fouling.');
        panel.querySelector('.maintenance-empty').hidden = items.length > 0;
        for (const row of panel.querySelectorAll('[data-maintenance-component]')) {
            const item = items.find(item => item.id === row.dataset.maintenanceComponent);
            row.hidden = !item;
            if (!item) continue;
            row.querySelector('.maintenance-issue').textContent = [
                item.damage > 0 ? `${percent(item.damage)} damage` : '',
                item.zones ? `${item.zones} affected core ${item.zones === 1 ? 'channel' : 'channels'}` : '',
                item.wear > 0 ? `${percent(item.wear)} wear` : '',
                item.fouling > 0 ? `${percent(item.fouling)} fouling` : '',
                item.serviceWear > 0 ? `${percent(item.serviceWear)} service wear · maintenance due` : ''
            ].filter(Boolean).join(' · ');
        }
        panel.querySelector('[data-maintenance-action="repair"]').disabled = !items.some(item => !sim.work.current(item.id)) || !readiness.ready;
        setText(panel.querySelector('[data-maintenance-action="repair"]'), sim.work.orders.some(order => order.status !== 'completed') ? 'Repair unassigned components' : 'Repair all');
        panel.querySelector('[data-maintenance-action="clear"]').disabled = sim.condition.meltdown || (sim.condition.fault === 'none' && !sim.components.hasFaults);
        panel.querySelector('.maintenance-temperatures').textContent = `Coolant ${sim.temperature.toFixed(1)} °C · Peak fuel ${sim.condition.peakTemperature.toFixed(1)} °C`;
        const checks = panel.querySelector('.maintenance-readiness ul');
        checks.replaceChildren();
        for (const check of readiness.checks) {
            const element = document.createElement('li');
            element.dataset.repairCheck = check.id;
            element.textContent = `${check.ready ? '✓' : '○'} ${check.id === 'meltdown' && check.ready ? 'No meltdown' : check.label}`;
            element.classList.toggle('ready', check.ready);
            checks.append(element);
        }
    }
    const core = root.querySelector('.core-damage-panel');
    if (host.companion ? host.companionView === 'core' : core.closest('.core-dialog').matches(':popover-open')) {
        core.dataset.damaged = String(zones.length > 0);
        setText(core.querySelector('.core-damage-summary'), zones.length
            ? `${zones.length} affected core ${zones.length === 1 ? 'channel' : 'channels'} · peak damage ${percent(sim.condition.coreDamage)}` : 'No retained core damage');
        core.querySelector('.core-damage-hint').hidden = !zones.length;
        core.querySelector('.core-damage-list').hidden = !zones.length;
        core.querySelector('[data-core-repair]').disabled = !zones.length || !readiness.ready;
        for (const zone of sim.condition.zones) {
            const row = core.querySelector(`[data-core-damage-row="${zone.id}"]`);
            row.hidden = zone.damage <= 0;
            const button = row.querySelector('button');
            setText(button.querySelector('span'), `${percent(zone.damage)} damage · ${zone.temperature.toFixed(1)} °C fuel`);
            button.setAttribute('aria-pressed', String(!host.selectedFuel && host.selectedRod === zone.id));
        }
        setText(core.querySelector('.core-repair-readiness'), !zones.length ? '' : readiness.ready
            ? 'Ready to repair. Heat, fuel and trip latches are preserved.'
            : `Repair blocked: ${readiness.checks.filter(check => !check.ready).map(check => repairBlockers[check.id] || check.label).join('; ')}. Coolant ${sim.temperature.toFixed(1)} °C · peak fuel ${sim.condition.peakTemperature.toFixed(1)} °C.`);
    }
    for (const element of root.querySelectorAll('.maintenance-result')) setText(element, host.maintenanceStatus || '');
    updateWorkPanel(host);
}
