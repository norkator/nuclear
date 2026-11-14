/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { MONITORED_EQUIPMENT, WORK_EQUIPMENT, WORK_NAMES, WORK_TEST_SECONDS } from './nuclear-power-work.js';
import { isComputer } from './nuclear-power-computers-model.js';
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const stages = { planned: 'Planned', isolated: 'Isolated · start inhibited', serviced: 'Serviced · isolation retained',
    testing: 'Functional test', ready: 'Test verified', completed: 'Returned to service' };
const actions = { isolate: 'Isolate equipment', service: 'Complete service', release: 'Release for test', complete: 'Return to service' };
const orderMarkup = order => `<article class="work-order" data-work-order="${order.id}"><h4>${order.id} · ${WORK_NAMES[order.equipment]}</h4><strong class="work-order-state"></strong><progress max="${WORK_TEST_SECONDS}" value="0" aria-label="Functional test qualifying time"></progress><p class="work-order-proof"></p><ul class="work-order-checks"></ul><div class="work-order-actions">${Object.entries(actions).map(([key, label]) => `<button class="small-button" data-work-action="${key}" data-work-id="${order.id}">${label}</button>`).join('')}</div></article>`;

export function workPanel() {
    return `<div class="maintenance-work">
      <details class="maintenance-section" open><summary>Condition monitoring</summary><p>Actual-state vibration, bearing temperature and lubricant condition. These illustrative readings reflect existing wear, damage, stress and motor/shaft speed. Record inspections for condition rounds; healthy equipment and idle backups are valid.</p>
        <div class="condition-grid">${MONITORED_EQUIPMENT.map(id => `<article class="condition-card" data-condition-equipment="${id}"><h4>${WORK_NAMES[id]}</h4><strong class="condition-state"></strong><dl><div><dt>Actual speed</dt><dd data-condition-reading="speed"></dd></div><div><dt>Vibration</dt><dd data-condition-reading="vibration"></dd></div><div><dt>Bearing temperature</dt><dd data-condition-reading="bearingTemperature"></dd></div><div><dt>Lubricant condition</dt><dd data-condition-reading="lubricant"></dd></div></dl><p class="condition-inspection"></p><button class="small-button" data-work-inspect="${id}">Record inspection</button></article>`).join('')}</div>
      </details>
      <details class="maintenance-section" open><summary>Work orders</summary><p>Plan → isolate → service → release for test → return to service. Cool the plant before isolating equipment. Isolation blocks starts and conflicting commands on every screen. Service is free and never starts or resets equipment.</p><div class="work-order-create"><label for="work-equipment">Equipment <select id="work-equipment">${WORK_EQUIPMENT.map(id => `<option value="${id}">${WORK_NAMES[id]}</option>`).join('')}</select></label><button class="small-button" data-work-create>Create work order</button></div><p class="work-empty">No work orders yet.</p><div class="work-order-list"></div></details>
      <details class="maintenance-section" open><summary>Water treatment &amp; cooling</summary><p>Purification removes dissolved impurities. A loaded filter reduces treatment; poor water gradually fouls the exchanger. Intake debris and a low basin level reduce actual condenser cooling. Healthy defaults need little intervention. All limits are fictional game values.</p><div class="water-controls"><label><input type="checkbox" data-water-control="purificationEnabled"/> Enable purification</label><label><input type="checkbox" data-water-control="makeupEnabled"/> Enable make-up supply</label><button class="small-button" data-water-sample>Take water sample</button></div><dl class="water-readings">${[['conductivity', 'Conductivity'], ['filterLoad', 'Filter load'], ['intakeDebris', 'Intake debris'], ['basinLevel', 'Basin level'], ['purification', 'Actual purification'], ['makeup', 'Actual make-up'], ['coolingFactor', 'Cooling-water capacity']].map(([key, label]) => `<div><dt>${label}</dt><dd data-water-reading="${key}"></dd></div>`).join('')}</dl><p class="water-condition" role="status"></p><p>Use a Purification filter or Cooling-water intake work order for cooled service. Treating water preserves existing exchanger fouling and damage.</p><ol class="water-samples" aria-label="Recent water samples"></ol></details>
      <p class="work-result" role="status" aria-live="polite"></p>
    </div>`;
}

export function initializeWorkPanel(host) {
    const root = host.shadowRoot;
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-work-inspect], [data-work-create], [data-work-action], [data-water-sample]');
        if (!button || button.disabled || host.companion) return;
        const sim = host.simulation;
        let result;
        if (button.hasAttribute('data-work-inspect')) result = sim.inspectEquipment(button.dataset.workInspect);
        else if (button.hasAttribute('data-work-create')) result = sim.createWorkOrder(root.querySelector('#work-equipment').value);
        else if (button.hasAttribute('data-water-sample')) result = sim.sampleWater();
        else result = sim.workOrderAction(button.dataset.workId, button.dataset.workAction);
        host.workStatus = result ? 'Recorded. Follow the work steps and actual readiness readings.' : 'Action blocked. Check the work order and isolation requirements.';
        host.update();
    });
    root.addEventListener('change', event => {
        if (!event.target.matches('[data-water-control]') || host.companion) return;
        const accepted = host.simulation.setWaterControl(event.target.dataset.waterControl, event.target.checked);
        host.workStatus = accepted ? 'Water-treatment request updated.' : 'Control locked by the isolated work order.';
        host.update();
    });
}

export function updateWorkPanel(host) {
    if (host.companion || host.plantTab !== 'maintenance') return;
    const sim = host.simulation, root = host.shadowRoot.querySelector('.maintenance-work');
    if (host.workModel !== sim.work) {
        host.workModel = sim.work; host.workStatus = '';
        root.querySelector('.work-order-list').replaceChildren();
    }
    for (const card of root.querySelectorAll('[data-condition-equipment]')) {
        const id = card.dataset.conditionEquipment, reading = sim.work.reading(sim, id), inspected = sim.work.inspections[id];
        text(card.querySelector('.condition-state'), reading.condition);
        card.dataset.attention = String(reading.condition !== 'Normal');
        for (const node of card.querySelectorAll('[data-condition-reading]')) {
            const key = node.dataset.conditionReading;
            text(node, `${reading[key].toFixed(key === 'vibration' ? 2 : 1)} ${key === 'vibration' ? 'mm/s' : key === 'bearingTemperature' ? '°C' : '%'}`);
        }
        text(card.querySelector('.condition-inspection'), inspected ? `Recorded T+${Math.floor(inspected.time)} s · ${inspected.condition} · ${inspected.vibration.toFixed(2)} mm/s` : 'No inspection recorded.');
    }
    const selected = host.shadowRoot.querySelector('#work-equipment').value;
    root.querySelector('[data-work-create]').disabled = Boolean(sim.work.current(selected)) || sim.condition.meltdown;
    text(root.querySelector('.work-empty'), sim.work.orders.length ? '' : 'No work orders yet.');
    const list = root.querySelector('.work-order-list');
    for (const row of list.querySelectorAll('[data-work-order]')) if (!sim.work.orders.some(order => order.id === row.dataset.workOrder)) row.remove();
    for (const order of [...sim.work.orders].reverse()) {
        let row = list.querySelector(`[data-work-order="${order.id}"]`);
        if (!row) { list.insertAdjacentHTML('afterbegin', orderMarkup(order)); row = list.querySelector(`[data-work-order="${order.id}"]`); }
        const readiness = sim.work.readiness(sim, order.equipment);
        text(row.querySelector('.work-order-state'), stages[order.status]);
        row.querySelector('progress').value = order.held;
        row.querySelector('progress').hidden = !['testing', 'ready', 'completed'].includes(order.status);
        text(row.querySelector('.work-order-proof'), ['testing', 'ready', 'completed'].includes(order.status)
            ? `${order.held.toFixed(1)} / ${WORK_TEST_SECONDS} s actual functional test. ${isComputer(order.equipment) ? 'Switch the unit ON: actual online state, temperature below 60 °C; cooling airflow ≥80%, UPS charge ≥25% where applicable.' : order.equipment.startsWith('pump') ? 'Run this pump: actual speed/flow ≥20%, pressure ≤145%.' : order.equipment === 'waterFilter' ? 'Enable purification: actual >50%, conductivity ≤2 µS/cm, filter <80%.' : order.equipment === 'intake' ? 'Restore make-up >50%, secondary flow ≥20%, cooling-water capacity ≥95%.' : 'Restore healthy generation above 20 MW; turbine test also requires shaft ≥90% and breaker closed.'}` : 'Establish every isolation check below before service.');
        row.querySelector('.work-order-checks').hidden = !['planned', 'isolated', 'serviced'].includes(order.status);
        row.querySelector('.work-order-checks').replaceChildren(...readiness.checks.map(check => {
            const li = document.createElement('li'); li.textContent = `${check.ready ? '✓' : '○'} ${check.label}`; li.dataset.ready = check.ready; return li;
        }));
        for (const button of row.querySelectorAll('[data-work-action]')) {
            button.disabled = !({ isolate: order.status === 'planned' && readiness.ready,
                service: order.status === 'isolated' && readiness.ready, release: order.status === 'serviced' && readiness.ready,
                complete: order.status === 'ready' })[button.dataset.workAction];
        }
    }
    for (const input of root.querySelectorAll('[data-water-control]')) {
        input.checked = sim.water[input.dataset.waterControl];
        input.disabled = sim.work.locked(input.dataset.waterControl === 'purificationEnabled' ? 'waterFilter' : 'intake');
    }
    for (const node of root.querySelectorAll('[data-water-reading]')) {
        const key = node.dataset.waterReading, value = sim.water[key];
        text(node, `${(value * (['purification', 'makeup', 'coolingFactor'].includes(key) ? 100 : 1)).toFixed(key === 'conductivity' ? 2 : 1)} ${key === 'conductivity' ? 'µS/cm' : '%'}`);
    }
    text(root.querySelector('.water-condition'), sim.water.healthy ? 'Water quality and cooling-water inventories healthy.' : 'Water systems need attention: inspect quality, filter, intake and basin readings.');
    root.querySelector('.water-samples').replaceChildren(...sim.water.samples.slice(-5).reverse().map(sample => {
        const li = document.createElement('li'); li.textContent = `Sample ${sample.sequence} · T+${Math.floor(sample.time)} s · ${sample.conductivity.toFixed(2)} µS/cm · filter ${sample.filterLoad.toFixed(1)}% · intake ${sample.intakeDebris.toFixed(1)}% · basin ${sample.basinLevel.toFixed(1)}%`; return li;
    }));
    text(root.querySelector('.work-result'), host.workStatus || '');
}
