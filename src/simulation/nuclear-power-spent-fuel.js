/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { FUEL_POOL_SLOTS, SPENT_FUEL_COOLING_SECONDS, SPENT_FUEL_DESTINATIONS } from './nuclear-power-refuelling.js';

export function spentFuelDialog() {
    return `<section id="spent-fuel-window" class="spent-fuel-dialog equipment-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="spent-fuel-title">
      <div class="core-dialog-titlebar" tabindex="0" aria-label="Move spent-fuel pool with arrow keys or drag"><span aria-hidden="true">⠿</span><h2 id="spent-fuel-title">SF-01 / Spent-fuel pool</h2><button class="small-button" data-pool-action="close" aria-label="Close spent-fuel pool">×</button></div>
      <div class="equipment-dialog-body">
        <p class="component-description">Each replacement stores one representative batch. A batch can represent one or all replaced assemblies. Demo cooling takes ${SPENT_FUEL_COOLING_SECONDS} simulated seconds after placement.</p>
        <div class="spent-fuel-summary"><span>Racks occupied<strong data-pool-value="occupied"></strong></span><span>Cooled batches<strong data-pool-value="cooled"></strong></span><span>Assemblies dispatched<strong data-pool-value="dispatched"></strong></span></div>
        <div class="spent-fuel-workspace"><section><h3>Stored batches</h3><p class="spent-fuel-empty">The pool is empty. Replace fuel after shutdown and cooldown to place a batch here.</p><div class="spent-fuel-list" role="group" aria-label="Select a stored fuel batch"></div></section>
          <section class="spent-fuel-dispatch"><h3>Dispatch cooled fuel</h3><p class="spent-fuel-selection"></p><p class="spent-fuel-readiness"></p>
            <label for="spent-fuel-destination">Destination</label><select id="spent-fuel-destination">${Object.entries(SPENT_FUEL_DESTINATIONS).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select>
            <p class="spent-fuel-cost">Dispatch cost: free in this demo</p><button class="control-button" data-pool-action="dispatch" disabled>Dispatch selected batch</button><button class="small-button" data-pool-action="dispatch-all" disabled>Dispatch all cooled batches</button>
            <p class="spent-fuel-result" role="status"></p><p class="component-trend-note">Cooling follows the simulation clock and pauses with the plant. Stored batches remain until you dispatch them.</p>
          </section></div><details><summary>Recent dispatches</summary><ol class="spent-fuel-history"></ol></details>
      </div></section>`;
}

export function initializeSpentFuel(host) {
    const root = host.shadowRoot.querySelector('.spent-fuel-dialog');
    host.spentFuelUI = { selected: null, signature: '', historySignature: '' };
    root.addEventListener('click', event => {
        const select = event.target.closest('[data-pool-select]');
        if (select) { host.spentFuelUI.selected = select.dataset.poolSelect; host.spentFuelMessage = ''; host.update(); }
        const action = event.target.closest('[data-pool-action]');
        if (!action || action.disabled) return;
        if (action.dataset.poolAction === 'close') { host.closeFloatingDialog(root); return; }
        const pool = host.fuelTransfer;
        const destination = root.querySelector('#spent-fuel-destination').value;
        const references = action.dataset.poolAction === 'dispatch-all'
            ? pool.samples.filter(sample => sample && pool.dispatchReadiness(sample.reference).ready).map(sample => sample.reference)
            : [host.spentFuelUI.selected];
        const shipments = references.map(reference => pool.dispatch(reference, destination)).filter(Boolean);
        if (shipments.length) {
            const count = shipments.reduce((sum, shipment) => sum + shipment.count, 0);
            host.spentFuelMessage = `${shipments.length} ${shipments.length === 1 ? 'batch' : 'batches'} (${count} ${count === 1 ? 'assembly' : 'assemblies'}) dispatched to ${SPENT_FUEL_DESTINATIONS[destination].toLowerCase()}.`;
            host.simulation.record(`Spent fuel: ${host.spentFuelMessage} Dispatch cost: 0 (demo).`, 'success', 'operator');
        } else host.spentFuelMessage = pool.dispatchReadiness(host.spentFuelUI.selected).reason;
        host.update();
    });
}

export function updateSpentFuel(host) {
    const root = host.shadowRoot.querySelector('.spent-fuel-dialog');
    if (!root.matches(':popover-open')) return;
    const pool = host.fuelTransfer, ui = host.spentFuelUI;
    const samples = pool.samples.filter(Boolean);
    if (!samples.some(sample => sample.reference === ui.selected)) ui.selected = samples[0]?.reference || null;
    const cooled = samples.filter(sample => pool.dispatchReadiness(sample.reference).ready);
    root.querySelector('[data-pool-value="occupied"]').textContent = `${samples.length} / ${FUEL_POOL_SLOTS.length}`;
    root.querySelector('[data-pool-value="cooled"]').textContent = String(cooled.length);
    root.querySelector('[data-pool-value="dispatched"]').textContent = String(pool.dispatchedAssemblies);
    root.querySelector('.spent-fuel-empty').hidden = samples.length > 0;
    const signature = samples.map(sample => sample.reference).join(',');
    if (signature !== ui.signature) {
        const list = root.querySelector('.spent-fuel-list');
        list.replaceChildren(...samples.map(sample => {
            const button = document.createElement('button');
            button.className = 'spent-fuel-batch';
            button.dataset.poolSelect = sample.reference;
            const name = document.createElement('strong');
            name.textContent = `${sample.reference} · ${FUEL_POOL_SLOTS[sample.slotIndex].id}`;
            const count = document.createElement('small');
            count.textContent = `${sample.id} · ${sample.count} ${sample.count === 1 ? 'assembly' : 'assemblies'}`;
            const status = document.createElement('span'); status.className = 'spent-fuel-batch-state';
            button.append(name, count, status);
            return button;
        }));
        ui.signature = signature;
    }
    for (const button of root.querySelectorAll('[data-pool-select]')) {
        const sample = samples.find(sample => sample.reference === button.dataset.poolSelect);
        const readiness = pool.dispatchReadiness(sample.reference);
        button.setAttribute('aria-pressed', String(sample.reference === ui.selected));
        button.dataset.ready = String(readiness.ready);
        button.querySelector('.spent-fuel-batch-state').textContent = readiness.ready ? 'COOLED' : `Cooling · ${Math.ceil(pool.coolingRemaining(sample))} s`;
    }
    const selected = samples.find(sample => sample.reference === ui.selected);
    root.querySelector('.spent-fuel-selection').textContent = selected
        ? `${selected.reference}: ${selected.count} ${selected.count === 1 ? 'assembly' : 'assemblies'} from ${selected.id}.` : 'Select a stored batch to dispatch.';
    const readiness = pool.dispatchReadiness(ui.selected);
    root.querySelector('.spent-fuel-readiness').textContent = readiness.reason;
    root.querySelector('[data-pool-action="dispatch"]').disabled = !readiness.ready;
    root.querySelector('[data-pool-action="dispatch-all"]').disabled = !cooled.length;
    root.querySelector('.spent-fuel-result').textContent = host.spentFuelMessage || '';
    const historySignature = pool.dispatchHistory.map(shipment => shipment.reference).join(',');
    if (historySignature !== ui.historySignature) {
        root.querySelector('.spent-fuel-history').replaceChildren(...pool.dispatchHistory.slice().reverse().map(shipment => {
            const entry = document.createElement('li');
            entry.textContent = `T+${host.time(shipment.dispatchedAt)} · ${shipment.reference} · ${shipment.count} ${shipment.count === 1 ? 'assembly' : 'assemblies'} → ${SPENT_FUEL_DESTINATIONS[shipment.destination]}`;
            return entry;
        }));
        ui.historySignature = historySignature;
    }
}
