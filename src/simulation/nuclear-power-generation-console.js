/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Interactive TG-01 / C-01 cutaways. Commands and interlocks stay in the plant model. */
import { COMPONENT_SETTINGS } from './nuclear-power-components.js';
import { valveHandleAngle, SVG_FLOW_SCALE } from './nuclear-power-motion.js';
import { temperatureColor } from './nuclear-power-temperature.js';

const hints = {
    admission: 'Admit steam to the shaft. The solid valve and rotor follow actual response; a turbine trip locks admission closed.',
    governorResponse: 'Set the response time for admission and shaft speed. A shorter time responds faster; it never closes the breaker.',
    loadRamp: 'Limit how quickly electrical load changes. Shaft rotation and electrical generation remain separate.',
    generatorLoading: 'Normal loading is 100%. Overdrive can exceed the 410 MW rating: faster wear, blade fracture and permanent loss of output. Auto never changes this dial.',
    coolingValve: 'Open the cooling-water valve to increase heat rejection. Actual cooling responds gradually.',
    inletTemperature: 'Adjust the simulated cooling-water source temperature. Warmer water reduces available cooling capacity.',
};
const controls = id => COMPONENT_SETTINGS[id].filter(setting => Object.hasOwn(hints, setting.key));
const definition = (id, key) => controls(id).find(setting => setting.key === key);
const bounded = (setting, value) => Number(Math.max(setting.min, Math.min(setting.max, Math.round(value / setting.step) * setting.step)).toFixed(1));
const format = (setting, value) => `${Number(value.toFixed(setting.step < 1 ? 1 : 0))}${setting.unit === '%' ? '%' : ` ${setting.unit}`}`;
const part = (id, key, body) => {
    const setting = definition(id, key);
    return `<g class="generation-part" data-generation-part="${key}" role="slider" tabindex="0" aria-label="${setting.label}" aria-valuemin="${setting.min}" aria-valuemax="${setting.max}" aria-valuenow="${setting.min}" aria-describedby="${id}-generation-help">${body}</g>`;
};
const valve = (id, key, x, y) => part(id, key, `<g transform="translate(${x} ${y})"><rect class="generation-hit" x="-77" y="-52" width="154" height="111" rx="12"/><text class="generation-part-name" y="-32" text-anchor="middle">${definition(id, key).label}</text><circle class="generation-valve-body" r="20"/><path class="generation-valve-seat" d="M-27-13 0 0-27 13ZM27-13 0 0 27 13Z"/><g class="generation-request" data-generation-request="${key}"><path d="M-29 0H29"/></g><g class="generation-actual" data-generation-valve="${key}"><path d="M-24 0H24"/><circle r="5"/></g><text class="generation-caption" y="45" text-anchor="middle" data-generation-caption="${key}"></text></g>`);
const dial = (id, key, x, y) => part(id, key, `<g transform="translate(${x} ${y})"><rect class="generation-hit" x="-83" y="-46" width="166" height="94" rx="12"/><text class="generation-part-name" y="-27" text-anchor="middle">${definition(id, key).label}</text><path class="generation-dial-scale" d="M-21 17A27 27 0 1 1 21 17"/><circle class="generation-dial" r="20"/><path class="generation-dial-pointer" data-generation-dial="${key}" d="M0-14V-3"/><text class="generation-caption" y="40" text-anchor="middle" data-generation-caption="${key}"></text></g>`);
const pipe = (key, d) => `<path class="generation-pipe-shell" d="${d}"/><path class="generation-water" data-generation-water="${key}" d="${d}"/><path class="generation-flow" data-generation-flow="${key}" d="${d}"/>`;
const rotor = (name, radius) => `<g data-generation-rotor="${name}">${Array.from({ length: 10 }, (_, i) => `<path ${name === 'turbine' ? `data-generation-blade="${i}"` : ''} transform="rotate(${i * 36})" d="M5-8 10-${radius} 22-${radius - 6} 12-4Z"/>`).join('')}<circle r="10"/></g>`;

function turbineCutaway() {
    return `<svg class="generation-model" viewBox="0 0 660 310" role="group" aria-label="Turbine and generator cutaway with steam valve, governor and load ramp controls">
      <defs><linearGradient id="tg-metal"><stop stop-color="var(--generation-edge)"/><stop offset=".45" stop-color="var(--generation-metal)"/><stop offset="1" stop-color="var(--generation-edge)"/></linearGradient></defs>
      <text class="generation-port" x="16" y="23">STEAM → SHAFT → ELECTRICITY</text>
      ${pipe('steam', 'M16 96H226V132')}
      <path class="generation-shell" fill="url(#tg-metal)" d="M167 114Q166 103 180 103H291L327 129V204L291 226H180Q167 226 167 212Z"/>
      <circle class="generation-chamber" cx="242" cy="167" r="53"/><g transform="translate(242 167)">${rotor('turbine', 46)}</g>
      <path class="generation-shaft" d="M242 167H465"/>
      <path class="generation-coupling" d="M339 155V179M350 155V179"/>
      <rect class="generation-shell" x="388" y="112" width="154" height="113" rx="25" fill="url(#tg-metal)"/>
      <g class="generation-coils">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${404 + i * 23} 131V202"/>`).join('')}</g>
      <circle class="generation-chamber" cx="465" cy="167" r="34"/><g transform="translate(465 167)">${rotor('generator', 27)}</g>
      <text class="generation-port" x="242" y="246" text-anchor="middle">TURBINE</text><text class="generation-port" x="465" y="246" text-anchor="middle">GENERATOR</text>
      <path class="generation-cable" d="M542 167H569M615 167H645"/><path class="generation-electric-flow" d="M542 167H569M615 167H645"/>
      <circle class="generation-contact" cx="569" cy="167" r="4"/><circle class="generation-contact" cx="615" cy="167" r="4"/><path class="generation-breaker-arm" data-generation-breaker-arm d="M569 167H615"/>
      <text class="generation-port" x="595" y="133" text-anchor="middle">BREAKER</text><text class="generation-caption" x="595" y="203" text-anchor="middle" data-generation-breaker-caption></text>
      ${pipe('exhaust', 'M288 226V281H373')}<text class="generation-port" x="385" y="285">TO CONDENSER →</text>
      ${valve('turbine', 'admission', 91, 96)}${dial('turbine', 'governorResponse', 87, 246)}${dial('turbine', 'loadRamp', 563, 267)}
      ${dial('turbine', 'generatorLoading', 465, 65)}
      <g class="turbine-blade-fragments" aria-hidden="true">${Array.from({ length: 40 }, (_, i) => `<path data-generation-fragment="${i}" d="M-3-8 3-10 5 5-2 8Z" visibility="hidden"/>`).join('')}</g>
    </svg>`;
}

function condenserCutaway() {
    return `<svg class="generation-model" viewBox="0 0 660 310" role="group" aria-label="Condenser cutaway with cooling valve and inlet temperature controls">
      <defs><linearGradient id="condenser-metal"><stop stop-color="var(--generation-edge)"/><stop offset=".5" stop-color="var(--generation-metal)"/><stop offset="1" stop-color="var(--generation-edge)"/></linearGradient></defs>
      <text class="generation-port" x="16" y="23">STEAM → CONDENSATION → RETURN</text>
      ${pipe('steam', 'M16 66H249V102')}${pipe('return', 'M410 229V268H645')}
      <rect class="generation-shell" x="178" y="97" width="306" height="141" rx="28" fill="url(#condenser-metal)"/>
      <rect class="generation-chamber" x="193" y="111" width="276" height="112" rx="17"/>
      <g class="generation-steam">${Array.from({ length: 8 }, (_, i) => `<ellipse data-generation-steam="${i}" rx="8" ry="5" opacity="0"/>`).join('')}</g>
      ${pipe('cooling', 'M16 173H215V151H445V174H215V197H445V173H645')}
      <g class="generation-drops">${Array.from({ length: 12 }, (_, i) => `<path data-generation-drop="${i}" d="M0-4Q-5 2 0 4Q5 2 0-4" opacity="0"/>`).join('')}</g>
      <path class="generation-condensate" d="M200 213Q267 208 333 213T461 213V220H200Z"/>
      ${valve('condenser', 'coolingValve', 90, 173)}${dial('condenser', 'inletTemperature', 566, 85)}
      <text class="generation-port" x="16" y="48">FROM TURBINE →</text><text class="generation-port" x="645" y="151" text-anchor="end">COOLING OUT →</text>
      <text class="generation-port" x="16" y="265">COOLING IN</text><text class="generation-temperature" x="16" y="288" data-generation-value="coolingInlet"></text>
      <text class="generation-port" x="308" y="287" text-anchor="middle">SECONDARY RETURN</text><text class="generation-temperature" x="645" y="295" text-anchor="end" data-generation-value="returnTemperature"></text>
      <text class="generation-caption" x="330" y="86" text-anchor="middle" data-generation-value="secondaryTemperature"></text>
    </svg>`;
}

export function generationConsole(id) {
    const turbine = id === 'turbine', settings = controls(id);
    return `<section class="generation-console" aria-label="Interactive ${turbine ? 'turbine and generator' : 'condenser'}">
      <div class="generation-heading"><div><span class="eyebrow">${turbine ? 'TG-01' : 'C-01'} / LIVE CUTAWAY</span><h3>${turbine ? 'Steam to electricity' : 'Cooling &amp; condensation'}</h3></div><span class="generation-state" data-generation-state></span></div>
      <p class="generation-help" id="${id}-generation-help">Drag a valve or dial left/right; release to apply. Or select a control and use its slider. Arrows adjust one step, Shift + arrow ten; Home/End select the bounds.</p>
      <div class="generation-model-scroll">${turbine ? turbineCutaway() : condenserCutaway()}</div>
      <div class="generation-legend"><span><i></i> Actual valve</span><span><i class="requested"></i> Requested valve</span><span>Motion follows actual ${turbine ? 'shaft & output' : 'heat & flow'}</span></div>
      <div class="generation-live">${(turbine ? [['Shaft', 'shaft'], ['Electrical output', 'output'], ['Load limit', 'loadLimit']] : [['Cooling capacity', 'cooling'], ['Secondary inlet', 'inlet'], ['Return', 'return']]).map(([label, key]) => `<span>${label}<strong data-generation-value="${key}"></strong></span>`).join('')}</div>
      <div class="generation-adjustment"><div class="generation-part-tabs" aria-label="Select a control">${settings.map(setting => `<button class="small-button" data-generation-select="${setting.key}" aria-pressed="false">${setting.label}</button>`).join('')}</div>
        <div class="generation-adjustment-title"><label for="${id}-generation-setting" data-generation-label></label><output for="${id}-generation-setting" data-generation-output></output></div>
        <div class="generation-adjustment-rail"><button class="small-button" data-generation-step="-5" aria-label="Decrease selected setting">−</button><input id="${id}-generation-setting" class="generation-setting" type="range" min="${settings[0].min}" max="${settings[0].max}" step="${settings[0].step}" data-component="${id}" data-component-setting="${settings[0].key}"/><button class="small-button" data-generation-step="5" aria-label="Increase selected setting">+</button></div>
        <p class="generation-hint"></p>
      </div>
      ${turbine ? `<div class="turbine-service-strip"><span data-turbine-condition></span><span data-turbine-wear></span><button class="small-button" data-component="turbine" data-component-action="repair" disabled>Service turbine</button></div><div class="generation-switchboard"><label class="generation-breaker" for="turbine-generator-breaker"><span>Generator breaker<strong data-generation-breaker-state></strong></span><span class="pump-rocker feed-rocker"><input id="turbine-generator-breaker" type="checkbox" role="switch" data-component="turbine" data-component-setting="breaker" aria-describedby="turbine-breaker-note"/><span class="pump-rocker-face" aria-hidden="true"><span class="rocker-on">I <small>ON</small></span><span class="rocker-off">O <small>OFF</small></span></span></span></label><p id="turbine-breaker-note"></p><div class="generation-actions"><button class="small-button" data-component="turbine" data-component-action="start">Open admission</button><button class="small-button generation-trip" data-component="turbine" data-component-action="trip">Trip turbine</button><button class="small-button" data-component="turbine" data-component-action="reset">Reset turbine trip</button></div></div>` : ''}
      <p class="component-reason" role="status"></p><p class="component-response"></p>
    </section>`;
}

export function initializeGenerationConsoles(host) {
    host.generationUI = {};
    for (const id of ['turbine', 'condenser']) {
        const root = host.shadowRoot.querySelector(`[data-component-dialog="${id}"]`), input = root.querySelector('.generation-setting');
        const state = host.generationUI[id] = { selected: controls(id)[0].key, preview: null, drag: null };
        const requested = () => host.simulation.components.items[id].settings[state.selected];
        const select = key => {
            state.selected = key; state.preview = null;
            updateGenerationConsole(host, root);
        };
        const commit = value => {
            const accepted = host.simulation.setComponentSetting(id, state.selected, bounded(definition(id, state.selected), value));
            host.componentMessages ||= {};
            host.componentMessages[id] = accepted ? '' : 'Admission is locked by the turbine trip. Stop, cool and clear faults before resetting the trip.';
            state.preview = null;
            if (accepted) host.playUiSound('adjust');
            host.update();
        };
        root.addEventListener('click', event => {
            const tab = event.target.closest('[data-generation-select]');
            if (tab) select(tab.dataset.generationSelect);
            const step = event.target.closest('[data-generation-step]');
            if (step && !step.disabled) { event.stopPropagation(); commit(requested() + Number(step.dataset.generationStep) * definition(id, state.selected).step); }
        });
        root.addEventListener('focusin', event => {
            const node = event.target.closest('[data-generation-part]');
            if (node) select(node.dataset.generationPart);
        });
        root.addEventListener('keydown', event => {
            const node = event.target.closest('[data-generation-part]');
            if (!node) return;
            const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
            if (!(event.key in directions) && !['Home', 'End'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation(); select(node.dataset.generationPart);
            if (node.getAttribute('aria-disabled') === 'true') return;
            const setting = definition(id, state.selected);
            commit(event.key === 'Home' ? setting.min : event.key === 'End' ? setting.max : requested() + directions[event.key] * setting.step * (event.shiftKey ? 10 : 1));
        });
        root.addEventListener('pointerdown', event => {
            const node = event.target.closest('[data-generation-part]');
            if (!node || event.button !== 0 || state.drag) return;
            event.preventDefault(); node.focus({ preventScroll: true }); select(node.dataset.generationPart);
            if (node.getAttribute('aria-disabled') === 'true') return;
            node.setPointerCapture(event.pointerId);
            state.drag = { node, pointer: event.pointerId, x: event.clientX, value: requested() };
        });
        root.addEventListener('pointermove', event => {
            if (state.drag?.pointer !== event.pointerId) return;
            const setting = definition(id, state.selected);
            state.preview = bounded(setting, state.drag.value + (event.clientX - state.drag.x) * (setting.max - setting.min) / 180);
            updateGenerationConsole(host, root);
        });
        const cancel = () => {
            const drag = state.drag; state.drag = null; state.preview = null;
            if (drag?.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
            updateGenerationConsole(host, root);
        };
        root.addEventListener('pointerup', event => { if (state.drag?.pointer !== event.pointerId) return; const value = state.preview; cancel(); if (value !== null) commit(value); });
        root.addEventListener('pointercancel', cancel);
        root.addEventListener('lostpointercapture', () => { if (state.drag) cancel(); });
        root.addEventListener('beforetoggle', event => { if (event.newState === 'closed') cancel(); });
        input.addEventListener('input', () => { state.preview = Number(input.value); updateGenerationConsole(host, root); });
        input.addEventListener('change', () => { state.preview = null; });
        input.addEventListener('blur', () => { state.preview = null; updateGenerationConsole(host, root); });
        root.addEventListener('input', event => {
            const output = root.querySelector(`[data-generation-disturbance="${event.target.dataset.componentSetting}"]`);
            if (output) output.textContent = event.target.value + (event.target.dataset.componentSetting === 'disturbancePeriod' ? ' s' : '%');
        });
    }
}

export function updateGenerationConsole(host, root) {
    const id = root.dataset.componentDialog, sim = host.simulation, item = sim.components.items[id];
    const state = host.generationUI[id], input = root.querySelector('.generation-setting');
    for (const setting of controls(id)) {
        const key = setting.key, selected = state.selected === key, value = selected && state.preview !== null ? state.preview : item.settings[key];
        const node = root.querySelector(`[data-generation-part="${key}"]`), locked = key === 'admission' && item.actual.tripped;
        const hasReadback = ['admission', 'coolingValve', 'inletTemperature', 'generatorLoading'].includes(key);
        const description = `${format(setting, value)} requested${hasReadback ? ` · ${format(setting, item.actual[key])} actual` : ''}`;
        node.setAttribute('aria-valuenow', value); node.setAttribute('aria-valuetext', description); node.setAttribute('aria-disabled', String(locked));
        node.classList.toggle('selected', selected);
        root.querySelector(`[data-generation-select="${key}"]`).setAttribute('aria-pressed', String(selected));
        root.querySelector(`[data-generation-caption="${key}"]`).textContent = hasReadback ? `${format(setting, value)} SET / ${format(setting, item.actual[key])} ACT` : `${format(setting, value)} SET`;
        const ghost = root.querySelector(`[data-generation-request="${key}"]`);
        if (ghost) ghost.setAttribute('transform', `rotate(${valveHandleAngle(value)})`);
        const dial = root.querySelector(`[data-generation-dial="${key}"]`);
        if (dial) dial.setAttribute('transform', `rotate(${-130 + (value - setting.min) / (setting.max - setting.min) * 260})`);
        if (selected) {
            // Set bounds before value: changing between seconds and percent must not clamp the old range.
            input.min = setting.min; input.max = setting.max; input.step = setting.step; input.value = value;
            input.dataset.componentSetting = key; input.disabled = locked;
            root.querySelector('[data-generation-label]').textContent = setting.label;
            root.querySelector('[data-generation-output]').textContent = description;
            root.querySelector('.generation-hint').textContent = hints[key];
            for (const button of root.querySelectorAll('[data-generation-step]')) {
                const negative = Number(button.dataset.generationStep) < 0;
                button.disabled = locked || (negative ? value <= setting.min : value >= setting.max);
                button.setAttribute('aria-label', `${negative ? 'Decrease' : 'Increase'} ${setting.label.toLowerCase()} by ${format(setting, setting.step * 5)}`);
            }
        }
    }
    const values = id === 'turbine' ? { shaft: `${item.actual.shaftSpeed.toFixed(1)}%`, output: `${sim.electricalOutput.toFixed(1)} MW`, loadLimit: `${item.actual.loadLimit.toFixed(0)} MW` }
        : { cooling: `${Math.round(item.actual.coolingFactor * 100)}%`, inlet: `${Math.round(sim.secondaryTemperature)} °C`, return: `${Math.round(sim.secondaryReturnTemperature)} °C`, coolingInlet: `${item.actual.inletTemperature.toFixed(1)} °C`, returnTemperature: `${Math.round(sim.secondaryReturnTemperature)} °C`, secondaryTemperature: `${Math.round(sim.secondaryTemperature)} °C SECONDARY INLET` };
    for (const node of root.querySelectorAll('[data-generation-value]')) node.textContent = values[node.dataset.generationValue];
    const status = root.querySelector('[data-generation-state]');
    status.textContent = id === 'turbine' ? item.actual.tripped ? 'TRIP LATCHED' : item.actual.shaftSpeed < .5 ? 'SHAFT STOPPED' : !sim.running || item.actual.admission < .5 ? 'COASTING' : sim.electricalOutput > .5 ? 'GENERATING' : 'UNLOADED'
        : sim.secondaryFlow < .5 ? 'NO CIRCULATION' : item.actual.coolingFactor <= .2 ? 'COOLING LIMITED' : sim.secondaryTemperature > sim.secondaryReturnTemperature + 1 ? 'REJECTING HEAT' : 'CIRCULATING';
    status.dataset.warning = String(id === 'turbine' ? item.actual.tripped : item.actual.coolingFactor <= .2);
    if (id === 'turbine') {
        const readiness = sim.components.turbineReadiness(), breaker = root.querySelector('[data-component-setting="breaker"]');
        breaker.checked = item.settings.breaker;
        // An already-closed breaker can always be opened; closing still requires explicit readiness.
        breaker.disabled = !item.settings.breaker && !readiness.ready;
        root.querySelector('[data-generation-breaker-state]').textContent = item.actual.breaker ? 'CLOSED · CONNECTED' : 'OPEN · DISCONNECTED';
        root.querySelector('#turbine-breaker-note').textContent = item.settings.breaker ? 'Open the breaker to disconnect generation; the shaft can keep turning.' : readiness.ready ? 'Ready to connect. Close the breaker explicitly.' : 'Closing locked · ' + readiness.checks.filter(check => !check.ready).map(check => check.label).join(' · ');
        root.querySelector('[data-component-action="start"]').disabled = item.actual.tripped || sim.condition.meltdown || item.wear >= 100 || sim.components.turbineIntegrity.damage >= 100;
        root.querySelector('[data-component-action="trip"]').disabled = item.actual.tripped;
        root.querySelector('[data-component-action="reset"]').disabled = !item.actual.tripped || !sim.components.serviceReady || item.actual.shaftSpeed > 5 || item.wear >= 100;
        const integrity = sim.components.turbineIntegrity;
        root.querySelector('.turbine-service-strip').dataset.integrity = integrity.level;
        root.querySelector('[data-turbine-condition]').textContent = `${integrity.damage >= 100 ? 'ROTOR DESTROYED' : `${integrity.bladesLost} / 40 blades lost`} · ${integrity.damage.toFixed(1)}% damage`;
        root.querySelector('[data-turbine-wear]').textContent = `${integrity.wear.toFixed(2)}% service wear${integrity.serviceDue ? ' · MAINTENANCE DUE' : ''} · ${Math.round(integrity.load)}% rated load`;
        root.querySelector('[data-generation-state]').textContent = integrity.damage >= 100 ? 'ROTOR DESTROYED' : integrity.level === 'danger' ? 'ROTOR AT RISK' : integrity.serviceDue ? 'MAINTENANCE DUE' : root.querySelector('[data-generation-state]').textContent;
        root.querySelector('[data-generation-state]').dataset.warning = String(item.actual.tripped || integrity.level === 'danger');
    }
    for (const output of root.querySelectorAll('[data-generation-disturbance]')) {
        const key = output.dataset.generationDisturbance;
        output.textContent = root.querySelector(`[data-component-setting="${key}"]`).value + (key === 'disturbancePeriod' ? ' s' : '%');
    }
    drawGenerationConsole(host, root);
}

export function drawGenerationConsole(host, root) {
    const id = root.dataset.componentDialog, sim = host.simulation, actual = sim.components.items[id].actual, motion = host.processMotion;
    for (const node of root.querySelectorAll('[data-generation-valve]')) node.setAttribute('transform', `rotate(${valveHandleAngle(actual[node.dataset.generationValve])})`);
    const cooling = sim.components.items.condenser.actual;
    const temperatures = { steam: sim.secondaryTemperature, exhaust: sim.secondaryTemperature, return: sim.secondaryReturnTemperature, cooling: cooling.inletTemperature };
    for (const node of root.querySelectorAll('[data-generation-water]')) node.style.stroke = temperatureColor(temperatures[node.dataset.generationWater]);
    for (const node of root.querySelectorAll('[data-generation-flow]')) {
        const key = node.dataset.generationFlow;
        const factor = id === 'turbine' ? actual.admission / 100 : key === 'cooling' ? actual.coolingValve / 100 : 1;
        node.style.opacity = Math.min(1, sim.secondaryFlow / 70 * factor) * (['steam', 'exhaust'].includes(key) ? motion.steam : 1);
        node.style.strokeDashoffset = -(motion.secondaryTravel || 0) * SVG_FLOW_SCALE;
    }
    if (id === 'turbine') {
        for (const rotor of root.querySelectorAll('[data-generation-rotor]')) rotor.setAttribute('transform', `rotate(${motion.angle} 0 0)`);
        const arm = root.querySelector('[data-generation-breaker-arm]');
        arm.setAttribute('transform', `rotate(${actual.breaker ? 0 : -32} 569 167)`);
        root.querySelector('[data-generation-breaker-caption]').textContent = actual.breaker ? 'CLOSED' : 'OPEN';
        const electric = root.querySelector('.generation-electric-flow');
        electric.style.opacity = Math.min(1, sim.electricalOutput / 150); electric.style.strokeDashoffset = -motion.angle / 2;
        root.querySelector('.generation-coils').style.opacity = .3 + Math.min(1, sim.electricalOutput / 300) * .7;
        const lost = sim.components.turbineIntegrity.bladesLost;
        for (const blade of root.querySelectorAll('[data-generation-blade]')) blade.style.visibility = Number(blade.dataset.generationBlade) * 4 < lost ? 'hidden' : 'visible';
        for (const node of root.querySelectorAll('[data-generation-fragment]')) {
            const fragment = motion.turbineFragments?.[Number(node.dataset.generationFragment)];
            node.style.visibility = fragment ? 'visible' : 'hidden';
            if (fragment) node.setAttribute('transform', `translate(${242 + fragment.x * 42} ${167 - fragment.y * 40}) rotate(${fragment.spin})`);
        }
    } else {
        const condensation = (motion.steam || 0) * actual.coolingFactor;
        for (const puff of root.querySelectorAll('[data-generation-steam]')) {
            const i = Number(puff.dataset.generationSteam), phase = (motion.steamPhase + i / 8) % 1;
            puff.setAttribute('cx', 221 + phase * 216); puff.setAttribute('cy', 128 + Math.sin(i * 2 + phase * Math.PI) * 6);
            puff.setAttribute('opacity', (motion.steam || 0) * Math.sin(phase * Math.PI) * .5);
        }
        for (const drop of root.querySelectorAll('[data-generation-drop]')) {
            const i = Number(drop.dataset.generationDrop), phase = (motion.steamPhase * 2 + i / 12) % 1;
            drop.setAttribute('transform', `translate(${218 + i * 20} ${147 + phase * 64})`);
            drop.setAttribute('opacity', condensation * Math.sin(phase * Math.PI));
        }
        root.querySelector('.generation-condensate').style.opacity = condensation;
    }
}
