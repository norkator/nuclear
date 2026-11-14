/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Browser-local component consoles; all instrument values remain SIMULATED. */
import * as componentModel from './nuclear-power-components.js';
import { valveHandleAngle } from './nuclear-power-motion.js';
import { exchangerConsole, initializeExchanger, updateExchanger, drawExchanger } from './nuclear-power-exchanger.js';
import { formatReading as format } from './nuclear-power-presentation.js';
import { pumpDefinition } from './nuclear-power-pumps.js';
import { pumpConsole, initializePumpConsoles, updatePumpConsole, drawPumpConsole } from './nuclear-power-pump-console.js';
import { generationConsole, initializeGenerationConsoles, updateGenerationConsole, drawGenerationConsole } from './nuclear-power-generation-console.js';
const COMPONENT_SETTINGS = componentModel.COMPONENT_SETTINGS || {};
const COMPONENT_ACTIONS = componentModel.COMPONENT_ACTIONS || {};

const label = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
function settingInput(setting, id) {
    const attrs=`data-component-setting="${setting.key}" data-component="${id}"`;
    if (setting.type === 'boolean') return `<input ${attrs} type="checkbox"/>`;
    if (setting.type === 'select') return `<select ${attrs}>${setting.options.map(value=>`<option value="${value}">${label(value)}</option>`).join('')}</select>`;
    return `<input ${attrs} type="number" min="${setting.min}" max="${setting.max}" step="${setting.step || 1}"/>`;
}
const actionLabels = { pulse: 'One-shot nudge', oscillate: 'Toggle fluctuation', fault: 'Progressive fault', clear: 'Stop disturbance / clear fault', repair: 'Repair / clean after cooldown' };

const generation = id => ['turbine', 'condenser'].includes(id);
const compactConsole = id => id === 'exchanger' || !!pumpDefinition(id) || generation(id);
const disturbanceAttribute = id => pumpDefinition(id) ? 'data-pump-disturbance' : generation(id) ? 'data-generation-disturbance' : 'data-hx-disturbance';

export function equipmentDialogs(details) {
    return Object.entries(details).filter(([id]) => id !== 'reactor').map(([id, item]) => `
    <section id="equipment-${id}-window" class="equipment-dialog floating-dialog" data-component-dialog="${id}" popover="manual" role="dialog" aria-modal="false" aria-labelledby="equipment-${id}-title">
      <div class="core-dialog-titlebar" tabindex="0" aria-label="Move ${item.name} with arrow keys or drag"><span aria-hidden="true">⠿</span><h2 id="equipment-${id}-title">${item.tag} / ${item.name}</h2><button class="small-button" data-component-close="${id}" aria-label="Close ${item.name}">×</button></div>
      <div class="equipment-dialog-body">
        <p class="component-description">${item.description} All values simulated.</p>
        ${id.endsWith('Pipes') ? `<p class="pipe-operating-hint">Single-pump nominal pressure = 100% ΔP. Sustained pressure above 145% damages these pipes. Close both ${id.startsWith('primary') ? 'primary' : 'secondary'} pump run switches and wait for motor/flow coast-down before cooled repair.</p><button class="small-button" data-component="${id}" data-component-action="repair" disabled>Repair leaking pipework</button>` : ''}
        ${id === 'exchanger' ? `<div class="hx-workspace">${exchangerConsole()}<aside class="hx-sidebar"><div hidden><label class="component-override"><input type="checkbox" data-component-override="exchanger"/></label><p class="component-owner"></p></div><details><summary>All actual readings</summary><dl class="component-readbacks"></dl></details>` : pumpDefinition(id) ? `<div class="pump-workspace">${pumpConsole(id)}<aside class="pump-sidebar"><details><summary>All actual readings</summary><div class="equipment-content"><dl>${item.fields.map(([name, key])=>`<div><dt>${name}</dt><dd data-value="${key}"></dd></div>`).join('')}</dl></div><dl class="component-readbacks"></dl></details><details><summary>Pump response</summary><p class="component-response"></p></details>` : generation(id) ? `<div class="generation-workspace">${generationConsole(id)}<aside class="generation-sidebar"><div hidden><label class="component-override"><input type="checkbox" data-component-override="${id}"/></label><p class="component-owner"></p></div><details><summary>All actual readings</summary><div class="equipment-content"><dl>${item.fields.map(([name, key])=>`<div><dt>${name}</dt><dd data-value="${key}"></dd></div>`).join('')}</dl></div><dl class="component-readbacks"></dl></details>${id === 'turbine' ? '<details><summary>Breaker readiness</summary><ul class="turbine-readiness"></ul></details>' : ''}` : `<div class="equipment-console-grid">
          <section><h3>Requested settings</h3><label class="component-override"><input type="checkbox" data-component-override="${id}"/> Manual override in Auto</label><p class="component-owner"></p>
          <div class="component-settings">${(COMPONENT_SETTINGS[id] || []).filter(setting=>!setting.key.startsWith('disturbance')).map(setting => `<label>${setting.label}<span>${settingInput(setting,id)} ${setting.unit || ''}</span><small data-setting-actual="${setting.key}"></small></label>`).join('')}</div>
          <div class="component-buttons">${(COMPONENT_ACTIONS[id] || []).filter(action=>!Object.hasOwn(actionLabels,action.key)).map(action => `<button class="control-button" data-component-action="${action.key}" data-component="${id}">${action.label}</button>`).join('')}</div>
          ${id.startsWith('pump') ? `<button class="control-button" data-component-action="toggle" data-component="${id}">Start / stop pump</button>` : ''}
          ${id==='turbine' ? '<ul class="turbine-readiness"></ul>' : ''}
          <p class="component-reason" role="status"></p>
          </section>
          <section><h3>Actual response</h3><div class="equipment-content"><dl>${item.fields.map(([name, key])=>`<div><dt>${name}</dt><dd data-value="${key}"></dd></div>`).join('')}</dl></div><dl class="component-readbacks"></dl>
          <svg class="component-flow-diagram" viewBox="0 0 320 75" role="img" aria-label="Illustrative actual component response"><path class="component-flow-shell" d="M10 32H310"/><path class="component-flow" d="M10 32H310"/><g transform="translate(160 32)"><circle r="20"/><g class="component-valve-handle"><path d="M-18 0h36"/><circle r="4"/></g></g><text x="8" y="67">INLET</text><text x="160" y="67" text-anchor="middle">ACTUAL RESPONSE</text><text x="310" y="67" text-anchor="end">OUTLET</text></svg>
          <p class="component-response"></p>
          </section>
        </div>`}
        <section class="component-trends"><h3>Local trends · last 2 minutes</h3><p class="component-trend-legend"></p><svg viewBox="${compactConsole(id) ? '0 0 360 230' : '0 0 600 145'}" role="img" aria-label="Simulated component readings with operator adjustment markers"><path class="component-trend-grid" d="${compactConsole(id) ? 'M35 10V200H345M35 105H345' : 'M35 10V115H585M35 62H585'}"/><g class="component-trend-traces"></g><g class="component-trend-markers"></g><text x="35" y="${compactConsole(id) ? 225 : 140}">−2 MIN</text><text x="${compactConsole(id) ? 310 : 545}" y="${compactConsole(id) ? 225 : 140}">NOW</text></svg><p class="component-trend-note">Each trace uses its own displayed range. Dashed markers show operator changes.</p></section>
        <details class="component-disturbances"><summary>Disturbances &amp; progressive faults</summary><p>A nudge fades away; periodic disturbances continue until stopped. Clearing faults preserves wear and damage.</p><label>Fluctuation strength (%) <input type="${compactConsole(id) ? 'range' : 'number'}" min="0" max="80" step="1" value="10" aria-label="Fluctuation strength (%)" data-component="${id}" data-component-setting="disturbanceAmplitude"/>${compactConsole(id) ? `<output ${disturbanceAttribute(id)}="disturbanceAmplitude"></output>` : ''}</label><label>Period (seconds) <input type="${compactConsole(id) ? 'range' : 'number'}" min="2" max="120" step="1" value="15" aria-label="Period (seconds)" data-component="${id}" data-component-setting="disturbancePeriod"/>${compactConsole(id) ? `<output ${disturbanceAttribute(id)}="disturbancePeriod"></output>` : ''}</label><div class="component-buttons">${Object.entries(actionLabels).map(([action,text])=>`<button class="small-button" data-component-action="${action}" data-component="${id}">${text}</button>`).join('')}</div><p class="component-disturbance-state"></p></details>
        <details><summary>Maintenance &amp; operating history</summary><p class="component-maintenance-state"></p><ol class="component-maintenance-log"></ol></details>
        ${compactConsole(id) ? '</aside></div>' : ''}
      </div>
    </section>`).join('');
}

export function initializeEquipment(host) {
    const root = host.shadowRoot;
    initializeExchanger(host);
    initializePumpConsoles(host);
    initializeGenerationConsoles(host);
    root.addEventListener('change', event => {
        const input = event.target;
        if (input.matches('[data-component-setting]')) {
            if ((input.type==='checkbox' || input.value !== '') && input.checkValidity()) {
                const accepted=host.simulation.setComponentSetting(input.dataset.component, input.dataset.componentSetting, input.type==='checkbox' ? input.checked : input.tagName==='SELECT' ? input.value : Number(input.value));
                host.componentMessages ||= {};
                host.componentMessages[input.dataset.component]=accepted ? '' : 'Adjustment blocked. Check ownership, trip/readiness checks, or cooldown requirements for cleaning.';
                if (!accepted && input.type!=='checkbox') input.value=host.simulation.components.items[input.dataset.component].settings[input.dataset.componentSetting] ?? input.value;
            }
            host.update();
        } else if (input.matches('[data-component-override]')) {
            host.simulation.setComponentOverride(input.dataset.componentOverride, input.checked);
            host.update();
        }
    });
    root.addEventListener('click', event => {
        const close = event.target.closest('[data-component-close]');
        if (close) host.closeFloatingDialog(root.querySelector(`[data-component-dialog="${close.dataset.componentClose}"]`));
        const button = event.target.closest('[data-component-action]');
        if (button && !button.disabled) { if (button.dataset.componentAction==='toggle') host.simulation.togglePump(pumpDefinition(button.dataset.component).key); else host.simulation.componentAction(button.dataset.component, button.dataset.componentAction); host.update(); }
    });
}

function entries(node, pairs) {
    const fragment = document.createDocumentFragment();
    for (const [name, value] of pairs) {
        const row = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = label(name);
        const dd = document.createElement('dd'); dd.textContent = format(value);
        row.append(dt, dd); fragment.append(row);
    }
    node.replaceChildren(fragment);
}

function renderTrend(root, item, elapsed) {
    const compact = compactConsole(root.dataset.componentDialog);
    const span = compact ? 310 : 550, bottom = compact ? 200 : 115;
    const history = item.history || [];
    const sample = history.at(-1);
    if (!sample) return;
    const values = sample.actual || sample;
    const keys = root.dataset.componentDialog === 'turbine' ? ['shaftSpeed', 'electricalOutput', 'admission']
        : pumpDefinition(root.dataset.componentDialog) ? ['speed', 'flow', 'pressure']
        : Object.keys(values).filter(key => key !== 'time' && typeof values[key] === 'number').slice(0, 3);
    const traces = root.querySelector('.component-trend-traces');
    traces.replaceChildren();
    const legend = [];
    for (const [index, key] of keys.entries()) {
        const read = point => (point.actual || point)[key];
        const finite = history.map(read).filter(Number.isFinite);
        const min = Math.min(0, ...finite), max = Math.max(min + 1, ...finite);
        legend.push(`${label(key)}: ${format(min)}–${format(max)}`);
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('class', `component-trace trace-${index}`);
        path.setAttribute('d', history.filter(point=>Number.isFinite(read(point))).map((point,i)=>`${i?'L':'M'}${35+(point.time-elapsed+120)/120*span} ${bottom-(read(point)-min)/(max-min)*(bottom-10)}`).join(' '));
        traces.append(path);
    }
    root.querySelector('.component-trend-legend').textContent = legend.join(' · ');
    const markers = root.querySelector('.component-trend-markers'); markers.replaceChildren();
    for (const event of (item.changes || []).filter(event=>event.time >= elapsed-120)) {
        const x = 35 + (event.time-elapsed+120)/120*span;
        const line = document.createElementNS('http://www.w3.org/2000/svg','path');
        line.setAttribute('d',`M${x} 10V${bottom}`); line.setAttribute('class','component-change-marker');
        const title = document.createElementNS('http://www.w3.org/2000/svg','title'); title.textContent=event.message || 'Operator adjustment'; line.append(title); markers.append(line);
    }
}

export function updateEquipment(host) {
    const sim = host.simulation;
    if (!sim.components) return;
    for (const root of host.shadowRoot.querySelectorAll('[data-component-dialog]:popover-open')) {
        const id = root.dataset.componentDialog, item = sim.components.items[id];
        if (!item) continue;
        root.querySelector('[data-component-override]').checked = !!item.override;
        root.querySelector('.component-override').hidden = !(COMPONENT_SETTINGS[id] || []).some(setting=>setting.owned);
        root.querySelector('[data-component-override]').disabled = !sim.autoMode || !sim.running || sim.tripped;
        root.querySelector('.component-owner').textContent = !(COMPONENT_SETTINGS[id] || []).some(setting=>setting.owned) ? 'OPERATOR TUNING · Auto compensates using reactor regulation' : item.override ? 'MANUAL OVERRIDE · Auto compensates with other equipment' : sim.autoMode && sim.running ? 'AUTO · owned settings return smoothly to regulation' : 'MANUAL · requested settings held';
        for (const input of root.querySelectorAll('[data-component-setting]')) {
            const key=input.dataset.componentSetting;
            const value = key === 'disturbanceAmplitude' ? item.disturbance?.amplitude : key === 'disturbancePeriod' ? item.disturbance?.period : key === 'disturbanceMode' ? item.disturbance?.mode : item.settings[key];
            if (input.type==='checkbox') input.checked = !!(key==='disturbanceEnabled' ? item.disturbance?.enabled : item.settings[key]);
            else if (host.shadowRoot.activeElement !== input && value !== undefined) input.value=value;
            const definition=(COMPONENT_SETTINGS[id] || []).find(setting=>setting.key===key);
            input.disabled = !!(definition?.owned && sim.autoMode && sim.running && !item.override && !sim.tripped);
            const readback=root.querySelector(`[data-setting-actual="${key}"]`);
            if (readback) readback.textContent = item.actual[key] !== undefined ? `Actual: ${format(item.actual[key])} ${definition?.unit || ''}` : 'Requested setting · read-back shown alongside';
        }
        const readiness = sim.condition.repairReadiness(sim);
        root.querySelector('.component-reason').textContent = host.componentMessages?.[id] || item.reason || (id.endsWith('Pipes') && !readiness.ready ? readiness.checks.filter(check => !check.ready).map(check => check.label).join(' · ') : '');
        root.querySelector('.component-response').textContent = item.response || '';
        root.querySelector('.component-disturbance-state').textContent = `${item.disturbance?.enabled ? 'Periodic fluctuation active' : 'Periodic fluctuation off'} · ${item.disturbance?.progressiveFault ? 'Progressive fault active' : 'No progressive fault'}`;
        root.querySelector('.component-maintenance-state').textContent = `${format(item.hours)} operating hours · ${format(item.wear)}% wear. Repairs do not replenish fuel or erase heat.`;
        entries(root.querySelector('.component-readbacks'), Object.entries(item.actual || {}).filter(([key]) =>
            (!pumpDefinition(id) || key !== 'trim') && (!generation(id) || Object.hasOwn(componentModel.COMPONENT_READOUTS[id], key))
        ).map(([key,value])=>[componentModel.COMPONENT_READOUTS?.[id]?.[key]?.label || key, `${format(value)} ${componentModel.COMPONENT_READOUTS?.[id]?.[key]?.unit || ''}`]));
        if (id==='turbine') {const list=root.querySelector('.turbine-readiness');list.replaceChildren();for(const check of sim.components.turbineReadiness().checks){const li=document.createElement('li');li.textContent=`${check.ready?'✓':'○'} ${check.label}`;list.append(li);}}
        const log=root.querySelector('.component-maintenance-log'); log.replaceChildren();
        for (const event of (sim.components.maintenance || []).filter(event=>event.component===id).slice(-15).reverse()) {
            const li=document.createElement('li'); li.textContent=`T+${host.time(event.time)} · ${event.message}`; log.append(li);
        }
        if (root.matches(':popover-open')) renderTrend(root,item,sim.elapsed);
        for (const button of root.querySelectorAll('[data-component-action="repair"]')) button.disabled=!sim.components.serviceReady || Boolean(sim.work.current(id));
        if (pumpDefinition(id)) updatePumpConsole(host, root);
        if (id === 'exchanger') updateExchanger(host, root);
        if (generation(id)) updateGenerationConsole(host, root);
    }
}

export function drawEquipmentMotion(host) {
    const sim=host.simulation;
    if (!sim.components) return;
    for (const root of host.shadowRoot.querySelectorAll('[data-component-dialog]:popover-open')) {
        if (root.dataset.componentDialog === 'exchanger') { drawExchanger(host, root); continue; }
        if (generation(root.dataset.componentDialog)) { drawGenerationConsole(host, root); continue; }
        const item=sim.components.items[root.dataset.componentDialog];
        if (pumpDefinition(root.dataset.componentDialog)) { drawPumpConsole(host, root); continue; }
        const read=item?.actual || {};
        const opening=read.dischargeValve ?? read.secondaryValve ?? read.admission ?? read.coolingValve ?? 100;
        root.querySelector('.component-valve-handle').setAttribute('transform',`rotate(${valveHandleAngle(Number(opening))} 0 0)`);
        const flow=read.flow ?? read.shaftSpeed ?? read.coolingCapacity ?? read.effectiveness ?? 0;
        const path=root.querySelector('.component-flow');
        path.style.opacity=Math.max(.08,Math.min(1,Number(flow)/100));
        path.style.strokeDashoffset=-host.processMotion.supplyPhase*40;
    }
}


export function exerciseDialog() {
    return `<section id="exercises-window" class="exercises-dialog equipment-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="exercises-title"><div class="core-dialog-titlebar" tabindex="0"><h2 id="exercises-title">Operating objectives &amp; scenarios</h2><button class="small-button" data-exercise="close" aria-label="Close operating objectives">×</button></div><div class="equipment-dialog-body"><p>Choose a goal, adjust equipment, and watch how the process responds. These exercises never reset a trip, repair equipment or start the reactor for you.</p><h3>Operating objective</h3><p>Output objectives use the current electrical target. Success must hold for 20 simulated seconds.</p><label>Goal <select id="operating-objective"></select></label><button class="control-button" data-exercise="objective">Begin objective</button><p class="objective-state" role="status"></p><h3>Diagnostic scenario</h3><p>The journal and readings show symptoms first. Inspect equipment to find and correct the cause.</p><label>Scenario <select id="diagnostic-scenario"></select></label><button class="control-button" data-exercise="scenario">Begin scenario</button><button class="small-button" data-exercise="reveal">Reveal cause</button><p class="scenario-state"></p><h3>Startup readiness</h3><ul class="exercise-startup-checks"></ul><h3>Maintenance journal</h3><ol class="exercise-maintenance"></ol></div></section>`;
}

export function initializeExercises(host) {
    const root=host.shadowRoot;
    for (const [selector, options] of [['#operating-objective',componentModel.COMPONENT_OBJECTIVES || []],['#diagnostic-scenario',componentModel.COMPONENT_SCENARIOS || []]]) {
        for (const option of options) {
            const node=document.createElement('option'); node.value=option.id || option.key; node.textContent=option.label || option.name; root.querySelector(selector).append(node);
        }
    }
    root.addEventListener('click',event=>{
        const button=event.target.closest('[data-exercise]');
        if (!button) return;
        const action=button.dataset.exercise;
        if (action==='close') host.closeFloatingDialog(root.querySelector('.exercises-dialog'));
        else if (action==='objective') host.simulation.startObjective(root.querySelector('#operating-objective').value);
        else if (action==='scenario') {host.simulation.startScenario(root.querySelector('#diagnostic-scenario').value);host.revealScenario=false;}
        else if (action==='reveal') host.revealScenario=true;
        host.update();
    });
}

export function updateExercises(host) {
    const root=host.shadowRoot, sim=host.simulation;
    if (!root.querySelector('.exercises-dialog').matches(':popover-open')) return;
    const readiness=sim.startupReadiness?.();
    const checks=readiness?.checks || [];
    const list=root.querySelector('.exercise-startup-checks'); list.replaceChildren();
    for (const check of checks) {const li=document.createElement('li');li.textContent=`${check.ready?'✓':'○'} ${check.label}`;list.append(li);}
    const objective=sim.components?.objective;
    root.querySelector('.objective-state').textContent=objective ? `${objective.label || objective.id}${objective.id==='reachMW' ? ` (${objective.target} MW)` : ''} · ${objective.status || ''} · ${Math.round((objective.progress || 0)*100)}% · ${objective.reason || ''}` : 'No objective active. Start one when ready.';
    const scenario=sim.components?.scenario;
    root.querySelector('.scenario-state').textContent=scenario ? host.revealScenario ? scenario.cause || scenario.label || scenario.id : scenario.symptom || 'Scenario active. Inspect component readings and trends.' : 'No diagnostic scenario active.';
    const log=root.querySelector('.exercise-maintenance');log.replaceChildren();
    for (const event of (sim.components?.maintenance || []).slice(-30).reverse()) {const li=document.createElement('li');li.textContent=`T+${host.time(event.time)} · ${event.component || 'Plant'} · ${event.message}`;log.append(li);}
}
