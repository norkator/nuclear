/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Interactive pump cutaways; commands and interlocks remain in the plant model. */
import { PUMPS, PUMP_PARTS, pumpDefinition } from './nuclear-power-pumps.js';
import { valveHandleAngle, SVG_FLOW_SCALE } from './nuclear-power-motion.js';
import { temperatureColor } from './nuclear-power-temperature.js';
import { waterJetPoint } from './nuclear-power-leaks.js';

const settings = {
    speed: { name: 'Motor speed', min: 0, max: 100, unit: '%', hint: 'Set the motor target. Auto owns speed while running unless you enable Manual override.' },
    dischargeValve: { name: 'Discharge valve', min: 0, max: 100, unit: '%', hint: 'Throttle this branch independently. Restricting flow at high motor speed increases pump stress.' },
    trim: { name: 'Speed trim', min: -25, max: 25, unit: 'pp', hint: 'Bias the speed command by up to 25 percentage points. Actual motor speed still ramps gradually.' },
};
const bounded = (key, value) => Math.max(settings[key].min, Math.min(settings[key].max, Math.round(value)));
const requested = (sim, id, key) => key === 'speed' ? sim[`${id}Speed`] : sim.components.items[id].settings[key];
const owned = (sim, id, key) => key === 'speed' && sim.autoMode && sim.running && !sim.components.items[id].override;
const format = (key, value) => `${Math.round(value)}${settings[key].unit === '%' ? '%' : ' pp'}`;
const part = (id, key, body) => `<g class="pump-adjustable" data-pump-adjust="${key}" role="slider" tabindex="0" aria-label="${settings[key].name}" aria-valuemin="${settings[key].min}" aria-valuemax="${settings[key].max}" aria-valuenow="${key === 'trim' ? 0 : 100}" aria-describedby="${id}-pump-help">${body}</g>`;

export function pumpConsole(id) {
    const pump = pumpDefinition(id);
    return `<section class="pump-console" aria-label="Interactive pump ${pump.key}">
      <div class="pump-console-heading"><div><span class="eyebrow">${pump.tag} / LIVE CUTAWAY</span><h3>Motor &amp; circulation</h3></div><span class="pump-console-state" id="${id}-console-state" data-pump-value="state"></span><button class="pump-rocker pump-console-run" data-component="${id}" data-component-action="toggle" role="switch" aria-checked="false" aria-label="Pump ${pump.key} run switch" aria-describedby="${id}-console-state"><span class="pump-rocker-face" aria-hidden="true"><span class="rocker-on">I <small>ON</small></span><span class="rocker-off">O <small>OFF</small></span></span></button></div>
      <div class="pump-console-ownership"><label class="component-override"><input type="checkbox" data-component-override="${id}"/> Manual override in Auto</label><p class="component-owner"></p></div>
      <p class="pump-console-help" id="${id}-pump-help">Drag the impeller, valve or trim left/right. Or select a control and use its slider. Arrows adjust 1; Shift + arrow adjusts 10.</p>
      <div class="pump-model-scroll"><svg class="pump-model" viewBox="0 0 620 255" role="group" aria-label="Interactive pump cutaway with motor speed, discharge valve and trim controls">
        <path class="pump-console-pipe-shell" d="M16 130H605"/><path class="pump-console-water" d="M16 130H605"/><path class="pump-console-flow" d="M16 130H605"/>
        <path class="pump-console-shell" d="M165 87V64H326L369 96V166L326 199H165V174H132V87Z"/>
        <g data-pump-part="fittings"><path d="M39 111V149M49 111V149M566 111V149M576 111V149" stroke="currentColor" stroke-width="7"/></g>
        ${part(id, 'speed', `<rect class="pump-adjust-hit" x="166" y="31" width="201" height="181" rx="14"/><text class="pump-adjust-name" x="260" y="46" text-anchor="middle">MOTOR SPEED</text><g transform="translate(260 130)"><path class="pump-speed-ring requested" data-pump-speed-request/><circle class="pump-speed-ring actual" r="57" data-pump-speed-actual/><circle class="pump-chamber" r="45"/><g data-pump-blades data-pump-part="blades">${[0, 120, 240].map(angle => `<path transform="rotate(${angle})" d="M0-34C28-34 34-9 7 0 14-18-9-17 0-34Z" fill="currentColor"/>`).join('')}</g><g data-pump-part="bearings"><circle r="11" fill="none" stroke="currentColor" stroke-width="6"/><circle r="4" fill="currentColor"/></g></g><text class="pump-adjust-value" x="260" y="231" text-anchor="middle" data-pump-caption="speed"></text>`)}
        ${part(id, 'dischargeValve', `<rect class="pump-adjust-hit" x="421" y="55" width="172" height="151" rx="14"/><text class="pump-adjust-name" x="505" y="75" text-anchor="middle">DISCHARGE VALVE</text><g transform="translate(505 130)"><circle class="pump-chamber" r="23"/><path class="pump-valve-seat" d="M-31-14 0 0-31 14ZM31-14 0 0 31 14Z"/><g class="pump-valve-request" data-pump-valve-request><path d="M-32 0H32"/></g><g class="pump-valve-actual" data-pump-valve-actual><path d="M-27 0H27"/><circle r="5"/></g></g><text class="pump-adjust-value" x="505" y="185" text-anchor="middle" data-pump-caption="dischargeValve"></text>`)}
        ${part(id, 'trim', `<rect class="pump-adjust-hit" x="24" y="162" width="128" height="79" rx="12"/><text class="pump-adjust-name" x="88" y="180" text-anchor="middle">SPEED TRIM</text><g transform="translate(88 207)"><circle class="pump-trim-knob" r="18"/><path data-pump-trim-pointer d="M0-13V-3"/></g><text class="pump-adjust-value" x="88" y="241" text-anchor="middle" data-pump-caption="trim"></text>`)}
        <text class="pump-model-port" x="16" y="103">INLET →</text><text class="pump-model-port" x="605" y="103" text-anchor="end">→ HEADER</text>
        <g class="pump-fitting-spray" aria-hidden="true">${Array.from({ length: 10 }, (_, index) => `<ellipse data-pump-drop="${index}" rx="1.5" ry="2.6"/>`).join('')}</g>
      </svg></div>
      <div class="pump-console-live"><span>Motor <strong data-pump-value="speed"></strong></span><span>Branch flow <strong data-pump-value="flow"></strong></span><span>Pressure <strong data-pump-value="pressure"></strong></span></div>
      <div class="pump-adjustment"><div class="pump-part-tabs" aria-label="Select a pump control">${Object.entries(settings).map(([key, definition]) => `<button class="small-button" data-pump-select="${key}" aria-pressed="false">${definition.name}</button>`).join('')}</div>
        <div class="pump-adjustment-title"><label for="${id}-setting" data-pump-setting-label></label><output for="${id}-setting" data-pump-setting-output></output></div>
        <div class="pump-adjustment-rail"><button class="small-button" data-pump-step="-5" aria-label="Decrease selected pump setting by 5">−</button><input id="${id}-setting" class="pump-setting" type="range" min="0" max="100" step="1" data-component="${id}" data-component-setting="speed"/><button class="small-button" data-pump-step="5" aria-label="Increase selected pump setting by 5">+</button></div>
        <p class="pump-setting-hint"></p><p class="component-reason" role="status"></p>
      </div>
      <section class="pump-internal-inspection" aria-label="Pump internals"><div class="pump-repair-heading"><h3>Internal damage</h3><button class="small-button" data-component="${id}" data-component-action="repair" disabled>Repair pump</button></div><ul>${PUMP_PARTS.map(name => `<li><span>${name[0].toUpperCase() + name.slice(1)}</span><meter min="0" max="100" low="10" high="40" optimum="0" value="0" data-part-meter="${name}" aria-label="${name} damage"></meter><strong data-part-damage="${name}">0%</strong></li>`).join('')}</ul><p class="pump-repair-state" role="status"></p></section>
    </section>`;
}

export function initializePumpConsoles(host) {
    host.pumpUI = {};
    for (const pump of PUMPS) {
        const id = pump.id, root = host.shadowRoot.querySelector(`[data-component-dialog="${id}"]`), input = root.querySelector('.pump-setting');
        const state = host.pumpUI[id] = { selected: 'speed', drag: null, preview: null };
        const select = key => {
            state.selected = key; state.preview = null;
            input.dataset.componentSetting = key; input.min = settings[key].min; input.max = settings[key].max;
            input.value = requested(host.simulation, id, key); updatePumpConsole(host, root);
        };
        const commit = value => {
            const accepted = host.simulation.setComponentSetting(id, state.selected, bounded(state.selected, value));
            host.componentMessages ||= {};
            host.componentMessages[id] = accepted ? '' : 'Auto owns motor speed. Enable Manual override to adjust this pump.';
            state.preview = null; input.value = requested(host.simulation, id, state.selected);
            if (accepted) host.playUiSound('adjust'); host.update();
        };
        root.addEventListener('click', event => {
            const tab = event.target.closest('[data-pump-select]'); if (tab) select(tab.dataset.pumpSelect);
            const step = event.target.closest('[data-pump-step]');
            if (step && !step.disabled) { event.stopPropagation(); commit(requested(host.simulation, id, state.selected) + Number(step.dataset.pumpStep)); }
        });
        root.addEventListener('focusin', event => { const node = event.target.closest('[data-pump-adjust]'); if (node) select(node.dataset.pumpAdjust); });
        root.addEventListener('keydown', event => {
            const node = event.target.closest('[data-pump-adjust]'); if (!node) return;
            const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
            if (!(event.key in directions) && !['Home', 'End'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation(); select(node.dataset.pumpAdjust);
            if (owned(host.simulation, id, state.selected)) return;
            commit(event.key === 'Home' ? settings[state.selected].min : event.key === 'End' ? settings[state.selected].max
                : requested(host.simulation, id, state.selected) + directions[event.key] * (event.shiftKey ? 10 : 1));
        });
        root.addEventListener('pointerdown', event => {
            const node = event.target.closest('[data-pump-adjust]'); if (!node || event.button !== 0 || state.drag) return;
            event.preventDefault(); node.focus({ preventScroll: true }); select(node.dataset.pumpAdjust);
            if (owned(host.simulation, id, state.selected)) return;
            node.setPointerCapture(event.pointerId);
            state.drag = { node, pointer: event.pointerId, x: event.clientX, value: requested(host.simulation, id, state.selected) };
        });
        root.addEventListener('pointermove', event => {
            if (!state.drag || state.drag.pointer !== event.pointerId) return;
            state.preview = bounded(state.selected, state.drag.value + (event.clientX - state.drag.x) * (settings[state.selected].max - settings[state.selected].min) / 180);
            input.value = state.preview; updatePumpConsole(host, root);
        });
        const cancel = () => {
            const drag = state.drag; state.drag = null; state.preview = null;
            if (drag?.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
            input.value = requested(host.simulation, id, state.selected); updatePumpConsole(host, root);
        };
        root.addEventListener('pointerup', event => { if (state.drag?.pointer !== event.pointerId) return; const value = state.preview; cancel(); if (value !== null) commit(value); });
        root.addEventListener('pointercancel', cancel);
        root.addEventListener('lostpointercapture', () => { if (state.drag) cancel(); });
        root.addEventListener('beforetoggle', event => { if (event.newState === 'closed') cancel(); });
        input.addEventListener('input', () => { state.preview = Number(input.value); updatePumpConsole(host, root); });
        input.addEventListener('change', () => { state.preview = null; });
        input.addEventListener('blur', () => { state.preview = null; updatePumpConsole(host, root); });
        root.addEventListener('input', event => {
            const output = root.querySelector(`[data-pump-disturbance="${event.target.dataset.componentSetting}"]`);
            if (output) output.textContent = `${event.target.value}${event.target.dataset.componentSetting === 'disturbancePeriod' ? ' s' : '%'}`;
        });
    }
}

export function updatePumpConsole(host, root) {
    const id = root.dataset.componentDialog, pump = pumpDefinition(id), sim = host.simulation, item = sim.components.items[id];
    const state = host.pumpUI?.[id] || { selected: 'speed', preview: null };
    for (const [key, definition] of Object.entries(settings)) {
        const value = state.selected === key && state.preview !== null ? state.preview : requested(sim, id, key);
        const node = root.querySelector(`[data-pump-adjust="${key}"]`), locked = owned(sim, id, key);
        node.setAttribute('aria-valuenow', value); node.setAttribute('aria-disabled', String(locked));
        node.setAttribute('aria-valuetext', `${format(key, value)} requested${key === 'trim' ? '' : `; ${format(key, item.actual[key])} actual`}`);
        node.classList.toggle('selected', state.selected === key);
        root.querySelector(`[data-pump-select="${key}"]`).setAttribute('aria-pressed', String(state.selected === key));
        root.querySelector(`[data-pump-caption="${key}"]`).textContent = key === 'trim' ? format(key, value) : `${format(key, value)} SET / ${format(key, item.actual[key])} ACT`;
        if (state.selected === key) {
            const input = root.querySelector('.pump-setting'); input.value = value; input.disabled = locked;
            input.min = definition.min; input.max = definition.max; input.dataset.componentSetting = key;
            root.querySelector('[data-pump-setting-label]').textContent = definition.name;
            root.querySelector('[data-pump-setting-output]').textContent = key === 'trim' ? `${format(key, value)} bias · ${Math.max(0, Math.min(100, sim[`${id}Speed`] + value))}% command`
                : `${format(key, value)} requested · ${format(key, item.actual[key])} actual`;
            root.querySelector('.pump-setting-hint').textContent = definition.hint;
            for (const button of root.querySelectorAll('[data-pump-step]')) button.disabled = locked || (Number(button.dataset.pumpStep) < 0 ? value <= definition.min : value >= definition.max);
        }
    }
    const display = { state: item.actual.speed < .5 ? 'STOPPED' : !sim[id] || sim.supply.factor === 0 || sim[`${id}Speed`] === 0 ? 'COASTING' : 'RUNNING',
        speed: `${item.actual.speed.toFixed(1)}%`, flow: `${Math.round(item.actual.flow * 48)} m³/h`, pressure: `${Math.round(item.actual.pressure)}% ΔP` };
    for (const element of root.querySelectorAll('[data-pump-value]')) element.textContent = display[element.dataset.pumpValue];
    root.querySelector('.pump-console-run').setAttribute('aria-checked', String(sim[id]));
    root.querySelector('.pump-console-run').disabled = !sim[id] && sim.pumpIsolated(id);
    root.querySelector('.component-owner').textContent = item.override ? 'MANUAL OVERRIDE · your motor speed target'
        : sim.autoMode && sim.running ? 'AUTO · speed follows circulation target' : 'MANUAL · speed set by operator';
    root.querySelector('.pump-console').dataset.running = String(item.actual.speed > .5);
    root.querySelector('.pump-console').dataset.overpressure = String(item.actual.pressure > 145);
    const readiness = sim.condition.repairReadiness(sim), parts = sim.condition.components[pump.key].parts;
    for (const name of PUMP_PARTS) {
        root.querySelector(`[data-part-damage="${name}"]`).textContent = `${parts[name].toFixed(1)}%`;
        root.querySelector(`[data-part-meter="${name}"]`).value = parts[name];
        root.querySelector(`[data-pump-part="${name}"]`).style.color = parts[name] > 0 ? '#d47755' : '#68cbb3';
    }
    root.querySelector('.pump-repair-state').textContent = readiness.ready ? 'Ready for explicit repair. Heat, fuel and trips are preserved.' : readiness.checks.filter(check => !check.ready).map(check => check.label).join(' · ');
    for (const output of root.querySelectorAll('[data-pump-disturbance]')) {
        const key = output.dataset.pumpDisturbance;
        output.textContent = root.querySelector(`[data-component-setting="${key}"]`).value + (key === 'disturbancePeriod' ? ' s' : '%');
    }
    drawPumpConsole(host, root);
}

export function drawPumpConsole(host, root) {
    const id = root.dataset.componentDialog, pump = pumpDefinition(id), sim = host.simulation, item = sim.components.items[id];
    const state = host.pumpUI?.[id] || { selected: 'speed', preview: null };
    const target = key => state.selected === key && state.preview !== null ? state.preview : requested(sim, id, key);
    root.querySelector('[data-pump-blades]').setAttribute('transform', `rotate(${host.motion[pump.key].angle} 0 0)`);
    root.querySelector('[data-pump-valve-actual]').setAttribute('transform', `rotate(${valveHandleAngle(item.actual.dischargeValve)})`);
    root.querySelector('[data-pump-valve-request]').setAttribute('transform', `rotate(${valveHandleAngle(target('dischargeValve'))})`);
    root.querySelector('[data-pump-trim-pointer]').setAttribute('transform', `rotate(${target('trim') / 25 * 120})`);
    const request = Math.max(0, Math.min(100, target('speed'))), angle = request / 100 * Math.PI * 2;
    const arc = request <= 0 ? '' : request >= 100 ? 'M0-64A64 64 0 1 1 0 64A64 64 0 1 1 0-64'
        : `M0-64A64 64 0 ${request > 50 ? 1 : 0} 1 ${Math.sin(angle) * 64} ${-Math.cos(angle) * 64}`;
    root.querySelector('[data-pump-speed-request]').setAttribute('d', arc);
    const circumference = Math.PI * 2 * 57;
    root.querySelector('[data-pump-speed-actual]').style.strokeDasharray = `${circumference * Math.max(0, Math.min(100, item.actual.speed)) / 100} ${circumference}`;
    const temperature = pump.circuit === 'primary' ? sim.returnTemperature : sim.secondaryReturnTemperature;
    root.querySelector('.pump-console-water').style.stroke = temperatureColor(temperature);
    const flow = root.querySelector('.pump-console-flow'); flow.style.opacity = Math.min(1, item.actual.flow / 70);
    flow.style.strokeDashoffset = -(host.motion[pump.key].travel || 0) * SVG_FLOW_SCALE;
    const leaking = sim.condition.components[pump.key].parts.fittings > 0 && item.actual.flow > .5;
    for (const drop of root.querySelectorAll('[data-pump-drop]')) {
        const point = waterJetPoint(host.processMotion.leakPhase || 0, Number(drop.dataset.pumpDrop), 10, item.actual.pressure);
        drop.setAttribute('cx', 572 + point.x * 22); drop.setAttribute('cy', 134 - point.y * 34);
        drop.style.opacity = leaking ? point.opacity : 0;
    }
}
