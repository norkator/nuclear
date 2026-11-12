/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Interactive cutaway of the fictional HX-01, using the existing component commands. */
import { valveHandleAngle, SVG_FLOW_SCALE } from './nuclear-power-motion.js';
import { temperatureColor } from './nuclear-power-temperature.js';

const parts = {
    bypass: { name: 'Primary bypass', hint: 'Divert primary coolant around the tubes. More bypass means less heat reaches the secondary loop.' },
    secondaryValve: { name: 'Secondary valve', hint: 'Open the secondary-side valve to allow more heat transfer to the turbine circuit.' },
    effectiveness: { name: 'Tube effectiveness', hint: 'Tune the simulated tube bundle. Higher effectiveness transfers more heat between the separate circuits.' },
    fouling: { name: 'Tube fouling', hint: 'Add simulated deposits to restrict heat transfer. Removing deposits requires a cooled, stopped, fault-free plant.' },
};
const bounded = value => Math.max(0, Math.min(100, Math.round(value)));
const percent = value => `${Math.round(value)}%`;
const slider = (key, content) => `<g class="hx-part" data-hx-part="${key}" tabindex="0" role="slider" aria-label="${parts[key].name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-describedby="hx-help">${content}</g>`;
const valve = (key, x, y) => slider(key, `<g transform="translate(${x} ${y})"><rect class="hx-hit" x="-88" y="-46" width="176" height="111" rx="12"/><text class="hx-part-name" y="-27" text-anchor="middle">${parts[key].name}</text><circle class="hx-valve-body" r="20"/><path class="hx-valve-seat" d="M-27-13 0 0-27 13ZM27-13 0 0 27 13Z"/><g data-hx-request="${key}" class="hx-request-lever"><path d="M-26 0H26"/></g><g data-hx-valve="${key}" class="hx-actual-lever"><path d="M-23 0H23"/><circle r="5"/></g><text class="hx-part-value" data-hx-caption="${key}" y="46" text-anchor="middle"></text></g>`);
const pipe = (key, d) => `<path class="hx-pipe-shell" d="${d}"/><path class="hx-water" data-hx-water="${key}" d="${d}"/><path class="hx-flow" data-hx-flow="${key}" d="${d}"/>`;

export function exchangerConsole() {
    return `<section class="hx-console" aria-label="Interactive heat exchanger">
      <div class="hx-heading"><div><span class="eyebrow">HX-01 / LIVE CUTAWAY</span><h3>Heat transfer &amp; flow</h3></div><span class="hx-transfer" data-hx-transfer></span></div>
      <p id="hx-help" class="hx-help">Drag a highlighted part left or right; release to apply. Or select a part and use the slider below. Arrow keys adjust 1%; Shift + arrow adjusts 10%.</p>
      <div class="hx-model-scroll"><svg class="hx-model" viewBox="0 0 800 440" role="group" aria-label="Heat exchanger cutaway with four adjustable parts">
        <defs><linearGradient id="hx-shell" x2="1" y2="0"><stop stop-color="var(--hx-metal-edge)"/><stop offset=".45" stop-color="var(--hx-metal)"/><stop offset="1" stop-color="var(--hx-metal-edge)"/></linearGradient></defs>
        <text class="hx-circuit" x="30" y="31">01 / PRIMARY CIRCUIT</text><text class="hx-circuit" x="770" y="31" text-anchor="end">02 / SECONDARY CIRCUIT</text>
        ${pipe('bypass', 'M78 175V95H208V315H78')}
        ${pipe('primaryHot', 'M30 175H255')}
        ${pipe('primaryReturn', 'M255 315H30')}
        ${pipe('secondaryHot', 'M548 175H770')}
        ${pipe('secondaryReturn', 'M770 315H548')}
        <rect class="hx-shell" x="245" y="118" width="310" height="241" rx="36"/>
        <rect class="hx-chamber" x="262" y="135" width="276" height="205" rx="22"/>
        ${pipe('secondaryChamber', 'M530 315V175H550')}
        <g class="hx-steam" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<ellipse data-hx-steam="${i}" rx="5" ry="8" opacity="0"/>`).join('')}</g>
        ${slider('effectiveness', `<rect class="hx-hit" x="252" y="146" width="260" height="149" rx="14"/><path class="hx-tube-shell" d="M245 175H470Q490 175 490 195T470 215H293Q273 215 273 235T293 255H470Q490 255 490 285T470 315H245"/><path class="hx-tubes" data-hx-water="tubes" d="M245 175H470Q490 175 490 195T470 215H293Q273 215 273 235T293 255H470Q490 255 490 285T470 315H245"/><path class="hx-flow" data-hx-flow="tubes" d="M245 175H470Q490 175 490 195T470 215H293Q273 215 273 235T293 255H470Q490 255 490 285T470 315H245"/><text class="hx-part-name" x="400" y="77" text-anchor="middle">Tube effectiveness</text><text class="hx-part-value" x="400" y="97" text-anchor="middle" data-hx-caption="effectiveness"></text><path class="hx-leader" d="M400 103V157"/>`)}
        <g class="hx-heat" aria-hidden="true"><path d="M310 185v20m-5-6 5 6 5-6M365 225v20m-5-6 5 6 5-6M420 265v25m-5-6 5 6 5-6"/></g>
        ${slider('fouling', `<rect class="hx-hit" x="270" y="300" width="240" height="118" rx="12"/><g class="hx-deposits">${Array.from({ length: 22 }, (_, i) => `<circle cx="${282 + (i % 11) * 19}" cy="${i < 11 ? 306 : 324}" r="${3 + i % 3}"/>`).join('')}</g><path class="hx-leader" d="M390 335v35"/><text class="hx-part-name" x="390" y="389" text-anchor="middle">Tube fouling</text><text class="hx-part-value" x="390" y="409" text-anchor="middle" data-hx-caption="fouling"></text>`)}
        ${valve('bypass', 143, 95)}${valve('secondaryValve', 660, 315)}
        <text class="hx-port" x="30" y="157">FROM CORE →</text><text class="hx-temperature" x="30" y="205" data-hx-temp="primaryHot"></text>
        <text class="hx-port" x="30" y="350">← TO CORE</text><text class="hx-temperature" x="30" y="372" data-hx-temp="primaryReturn"></text>
        <text class="hx-port" x="770" y="157" text-anchor="end">TO TURBINE →</text><text class="hx-temperature" x="770" y="205" text-anchor="end" data-hx-temp="secondaryHot"></text>
        <text class="hx-port" x="770" y="398" text-anchor="end">← FROM CONDENSER</text><text class="hx-temperature" x="770" y="420" text-anchor="end" data-hx-temp="secondaryReturn"></text>
      </svg></div>
      <div class="hx-legend"><span><i class="hx-solid"></i> Actual valve</span><span><i class="hx-dashed"></i> Requested valve</span><span>Separate fluids · heat crosses tube walls</span></div>
      <div class="hx-adjustment"><div class="hx-part-tabs" aria-label="Select a part">${Object.entries(parts).map(([key, part]) => `<button class="small-button" data-hx-select="${key}" aria-pressed="false">${part.name}</button>`).join('')}</div>
        <div class="hx-adjustment-title"><label for="hx-setting" data-hx-label></label><output for="hx-setting" data-hx-output></output></div>
        <div class="hx-adjustment-rail"><button class="small-button" data-hx-step="-5" aria-label="Decrease selected setting by 5 percent">−</button><input id="hx-setting" type="range" min="0" max="100" step="1" data-component="exchanger" data-component-setting="bypass"/><button class="small-button" data-hx-step="5" aria-label="Increase selected setting by 5 percent">+</button></div>
        <p class="hx-part-hint"></p><p class="hx-service-note"></p>
      </div>
      <div class="hx-live-readings"><span>Primary flow <strong data-value="flow"></strong></span><span>Secondary flow <strong data-value="secondaryFlow"></strong></span><span>Electrical output <strong data-hx-electric></strong></span></div>
      <p class="component-reason" role="status"></p><p class="component-response"></p>
    </section>`;
}

export function initializeExchanger(host) {
    const root = host.shadowRoot.querySelector('[data-component-dialog="exchanger"]');
    const input = root.querySelector('#hx-setting');
    const state = host.exchangerUI = { selected: 'bypass', drag: null, preview: null };
    const select = key => { state.selected = key; state.preview = null; input.dataset.componentSetting = key; input.value = host.simulation.components.items.exchanger.settings[key]; updateExchanger(host, root); };
    const commit = value => {
        const accepted = host.simulation.setComponentSetting('exchanger', state.selected, bounded(value));
        host.componentMessages ||= {};
        host.componentMessages.exchanger = accepted ? '' : 'Cleaning requires a cooled, stopped, fault-free plant. Deposits have been retained.';
        state.preview = null;
        input.value = host.simulation.components.items.exchanger.settings[state.selected];
        if (accepted) host.playUiSound('adjust');
        host.update();
    };
    root.addEventListener('click', event => {
        const tab = event.target.closest('[data-hx-select]');
        if (tab) select(tab.dataset.hxSelect);
        const step = event.target.closest('[data-hx-step]');
        if (step) { event.stopPropagation(); commit(host.simulation.components.items.exchanger.settings[state.selected] + Number(step.dataset.hxStep)); }
    });
    root.addEventListener('focusin', event => {
        const part = event.target.closest('[data-hx-part]');
        if (part) select(part.dataset.hxPart);
    });
    root.addEventListener('keydown', event => {
        const part = event.target.closest('[data-hx-part]');
        if (!part) return;
        const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
        if (!(event.key in directions) && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault(); event.stopPropagation();
        select(part.dataset.hxPart);
        const value = host.simulation.components.items.exchanger.settings[state.selected];
        commit(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : value + directions[event.key] * (event.shiftKey ? 10 : 1));
    });
    root.addEventListener('pointerdown', event => {
        const part = event.target.closest('[data-hx-part]');
        if (!part || event.button !== 0 || state.drag) return;
        event.preventDefault();
        part.focus({ preventScroll: true }); select(part.dataset.hxPart);
        part.setPointerCapture(event.pointerId);
        state.drag = { part, id: event.pointerId, x: event.clientX, value: host.simulation.components.items.exchanger.settings[state.selected] };
    });
    root.addEventListener('pointermove', event => {
        if (!state.drag || state.drag.id !== event.pointerId) return;
        // A 180-pixel gesture spans the full setting, independent of diagram zoom.
        state.preview = bounded(state.drag.value + (event.clientX - state.drag.x) / 1.8);
        input.value = state.preview;
        updateExchanger(host, root);
    });
    const cancel = () => { const drag = state.drag; state.drag = null; state.preview = null; if (drag?.part.hasPointerCapture(drag.id)) drag.part.releasePointerCapture(drag.id); input.value = host.simulation.components.items.exchanger.settings[state.selected]; updateExchanger(host, root); };
    root.addEventListener('pointerup', event => {
        if (!state.drag || state.drag.id !== event.pointerId) return;
        const value = state.preview; cancel();
        if (value !== null) commit(value);
    });
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('lostpointercapture', () => { if (state.drag) cancel(); });
    root.addEventListener('beforetoggle', event => { if (event.newState === 'closed') cancel(); });
    input.addEventListener('input', () => { state.preview = Number(input.value); updateExchanger(host, root); });
    input.addEventListener('change', () => { state.preview = null; });
    input.addEventListener('blur', () => { state.preview = null; updateExchanger(host, root); });
    root.addEventListener('input', event => {
        const output = root.querySelector(`[data-hx-disturbance="${event.target.dataset.componentSetting}"]`);
        if (output) output.textContent = event.target.value + (event.target.dataset.componentSetting === 'disturbancePeriod' ? ' s' : '%');
    });
}

export function updateExchanger(host, root) {
    const sim = host.simulation, item = sim.components.items.exchanger;
    const state = host.exchangerUI || { selected: 'bypass', preview: null };
    for (const [key, part] of Object.entries(parts)) {
        const requested = state.selected === key && state.preview !== null ? state.preview : item.settings[key];
        const node = root.querySelector(`[data-hx-part="${key}"]`);
        node.setAttribute('aria-valuenow', requested);
        node.setAttribute('aria-valuetext', `${percent(requested)} requested, ${percent(item.actual[key])} actual`);
        node.classList.toggle('selected', state.selected === key);
        root.querySelector(`[data-hx-select="${key}"]`).setAttribute('aria-pressed', String(state.selected === key));
        root.querySelector(`[data-hx-caption="${key}"]`).textContent = `${percent(requested)} SET / ${percent(item.actual[key])} ACT`;
        const ghost = root.querySelector(`[data-hx-request="${key}"]`);
        if (ghost) ghost.setAttribute('transform', `rotate(${valveHandleAngle(requested)})`);
        if (state.selected === key) {
            if (state.preview !== null) root.querySelector('#hx-setting').value = requested;
            root.querySelector('[data-hx-label]').textContent = part.name;
            root.querySelector('[data-hx-output]').textContent = `${percent(requested)} requested · ${percent(item.actual[key])} actual`;
            root.querySelector('.hx-part-hint').textContent = part.hint;
        }
    }
    root.querySelector('.hx-service-note').textContent = sim.components.serviceReady ? 'Cleaning available · plant is cooled, stopped and fault-free.' : 'Cleaning locked · stop, cool and clear faults before reducing fouling.';
    root.querySelector('[data-hx-transfer]').textContent = `${Math.round(item.actual.transferFactor * 100)}% transfer capacity`;
    root.querySelector('[data-hx-electric]').textContent = `${sim.electricalOutput.toFixed(1)} MW`;
    for (const output of root.querySelectorAll('[data-hx-disturbance]')) {
        const key = output.dataset.hxDisturbance;
        output.textContent = root.querySelector(`[data-component-setting="${key}"]`).value + (key === 'disturbancePeriod' ? ' s' : '%');
    }
    drawExchanger(host, root);
}

export function drawExchanger(host, root) {
    const sim = host.simulation, actual = sim.components.items.exchanger.actual, motion = host.processMotion;
    const temperatures = { primaryHot: sim.temperature, primaryReturn: sim.returnTemperature, bypass: sim.temperature, tubes: (sim.temperature + sim.returnTemperature) / 2, secondaryHot: sim.secondaryTemperature, secondaryReturn: sim.secondaryReturnTemperature, secondaryChamber: sim.secondaryTemperature };
    for (const node of root.querySelectorAll('[data-hx-water]')) node.style.stroke = temperatureColor(temperatures[node.dataset.hxWater]);
    for (const node of root.querySelectorAll('[data-hx-temp]')) node.textContent = `${Math.round(temperatures[node.dataset.hxTemp])} °C`;
    for (const node of root.querySelectorAll('[data-hx-flow]')) {
        const key = node.dataset.hxFlow, secondary = key.startsWith('secondary');
        let flow = secondary ? sim.secondaryFlow : sim.primaryFlow;
        if (key === 'bypass') flow *= actual.bypass / 100;
        if (key === 'tubes') flow *= 1 - actual.bypass / 100;
        if (secondary) flow *= actual.secondaryValve / 100;
        node.style.opacity = Math.min(1, flow / 70);
        node.style.strokeDashoffset = -((secondary ? motion.secondaryTravel : motion.primaryTravel) || 0) * SVG_FLOW_SCALE;
    }
    for (const key of ['bypass', 'secondaryValve']) root.querySelector(`[data-hx-valve="${key}"]`).setAttribute('transform', `rotate(${valveHandleAngle(actual[key])})`);
    root.querySelector('.hx-deposits').style.opacity = actual.fouling / 100;
    root.querySelector('.hx-heat').style.opacity = motion.heat || 0;
    root.querySelector('.hx-heat').setAttribute('transform', `translate(0 ${Math.sin(motion.heatPhase * Math.PI * 2) * 3})`);
    for (const puff of root.querySelectorAll('[data-hx-steam]')) {
        const index = Number(puff.dataset.hxSteam), phase = (motion.steamPhase + index / 9) % 1;
        puff.setAttribute('cx', 515 + Math.sin(index * 2) * 10);
        puff.setAttribute('cy', 290 - phase * 138);
        puff.setAttribute('opacity', (motion.steam || 0) * actual.secondaryValve / 100 * Math.sin(phase * Math.PI) * .65);
    }
}
