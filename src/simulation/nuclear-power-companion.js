/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { SessionConnection, sessionCommandId } from './nuclear-power-session-client.js';
import { captureSessionState, restoreSessionState, remoteSimulation } from './nuclear-power-session-state.js';
import { applySessionCommand, validSessionCommand, freshSessionCommand } from './nuclear-power-session-protocol.js';

const LAYOUT_KEY = 'porssiohjain.nuclear-power.companion-layout';
const screenSections = {
    regulation: 'Regulation & targets', reactor: 'Start / Stop & shutdown', load: 'Load setpoint',
    rods: 'Rod bank controls', pumps: 'Pump controls', grid: 'Grid controller',
    readings: 'Plant instruments', power: 'Electrical supply', core: 'Core map & fuel',
    trends: 'Live trends', events: 'Event journal & alarms',
};
const screenPresets = {
    all: { label: 'All controls', sections: Object.keys(screenSections), view: 'grid' },
    pumps: { label: 'Pumps & load', sections: ['regulation', 'load', 'pumps'], view: 'grid' },
    core: { label: 'Core & fuel', sections: ['core'], view: 'core' },
    monitor: { label: 'Monitor', sections: ['readings', 'grid', 'power', 'trends', 'events'], view: 'trends' },
};
const viewSections = { grid: ['grid', 'readings', 'power'], core: ['core'], trends: ['trends', 'events'] };

export const sessionControls = `<div class="header-screens"><button class="small-button" data-action="connect-screen">Connect screen</button><a class="small-button companion-link" href="/companion/" target="_blank" rel="noopener">Companion screen ↗</a></div>`;
export const pairingDialog = `<div class="pairing-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="pairing-title"><div class="core-dialog-titlebar" tabindex="0" aria-label="Move screen connection window"><h2 id="pairing-title">Connect another screen</h2><button class="small-button" data-action="close-pairing" aria-label="Close screen connection window">×</button></div><div class="pairing-content"><p>Open this site on your tablet or another computer, choose <b>Companion screen</b> and enter this code.</p><output class="pairing-code" aria-label="Screen pairing code">Connecting…</output><p class="pairing-status" role="status"></p><a class="pairing-open small-button" href="/companion/" target="_blank" rel="noopener">Open companion on this computer ↗</a><div class="pairing-actions"><button class="small-button" data-action="new-pairing-code">New code</button><button class="small-button" data-action="disconnect-screens">Disconnect screens</button><button class="small-button" data-action="stop-sharing">Stop sharing</button></div><p class="pairing-help">Keep this desktop session open. The simulation continues while a paired companion is visible. Pause applies to every screen.</p></div></div>`;

export function initializeCompanion(host) {
    const root = host.shadowRoot;
    host.companion = host.getAttribute('screen') === 'companion';
    host.dataset.screen = host.companion ? 'companion' : 'desktop';
    host.pendingSessionCommands = new Map();
    if (host.companion) prepareCompanion(host);
    const status = value => {
        host.sessionStatus = value;
        if (value !== 'connected') { host.remoteReady = false; host.pendingSessionCommands.clear(); }
        if (value === 'connected' && !host.companion) publishSession(host);
        updateSessionControls(host);
    };
    host.createSessionConnection = () => new SessionConnection({
        role: host.companion ? 'companion' : 'host', onStatus: status,
        onMessage: message => receiveSessionMessage(host, message),
    });
    host.openScreenPairing = () => {
        if (!host.sessionConnection || host.sessionConnection.closed) {
            host.sessionConnection = host.createSessionConnection(); host.sessionConnection.connect();
            startSessionHeartbeat(host);
        }
        host.openFloatingDialog(root.querySelector('.pairing-dialog'));
    };
    host.sendSessionCommand = command => {
        if (!host.remoteReady || !validSessionCommand(command) || host.pendingSessionCommands.size >= 8) return false;
        const id = sessionCommandId();
        if (!host.sessionConnection?.send({ type: 'command', id, revision: host.remoteRevision, generation: host.remoteGeneration, command })) return false;
        host.pendingSessionCommands.set(id, performance.now());
        updateSessionControls(host);
        return true;
    };
    root.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'connect-screen') host.openScreenPairing();
        if (action === 'close-pairing') host.closeFloatingDialog(root.querySelector('.pairing-dialog'));
        if (action === 'new-pairing-code') host.sessionConnection?.send({ type: 'new-code' });
        if (action === 'disconnect-screens') host.sessionConnection?.send({ type: 'revoke-devices' });
        if (action === 'stop-sharing') {
            host.sessionConnection?.disconnect({ type: 'end' }); host.sessionConnection = null;
            clearInterval(host.sessionHeartbeat); host.sessionStatus = 'offline'; host.pairingInfo = null;
            updateSessionControls(host);
        }
        if (action === 'leave-session') {
            host.sessionConnection?.disconnect({ type: 'leave' }); host.sessionConnection = null;
            clearInterval(host.sessionHeartbeat); host.remoteReady = false; host.sessionStatus = 'offline';
            host.pendingSessionCommands.clear(); host.tripCoverOpen = false;
            updateSessionControls(host);
        }
        const view = event.target.closest('[data-companion-view]')?.dataset.companionView;
        if (view) selectCompanionView(host, view);
    });
}

function prepareCompanion(host) {
    const root = host.shadowRoot;
    // Move the existing controls rather than clone them: IDs, events, ownership,
    // requested/actual values and accessible native inputs stay shared.
    const layout = root.querySelector('.console-layout');
    const station = document.createElement('section');
    station.className = 'companion-workspace';
    station.innerHTML = `<div class="companion-information"><nav class="companion-views" aria-label="Companion information"><button class="small-button" data-companion-view="grid" aria-pressed="true">Grid &amp; readings</button><button class="small-button" data-companion-view="core" aria-pressed="false">Core map</button><button class="small-button" data-companion-view="trends" aria-pressed="false">Trends &amp; alarms</button></nav><section class="companion-pane" data-companion-pane="grid" aria-label="Grid requests and plant readings"></section><section class="companion-pane" data-companion-pane="core" aria-label="Reactor core map" hidden></section><section class="companion-pane" data-companion-pane="trends" aria-label="Trends and alarms" hidden></section></div><aside class="companion-operator" aria-label="Touch operator controls"></aside>`;
    layout.before(station);
    station.querySelector('[data-companion-pane="grid"]').append(root.querySelector('.grid-dispatch-panel'), root.querySelector('.metrics'), root.querySelector('.power-source-panel') || root.querySelector('[aria-label="Pump power source"]'));
    station.querySelector('[data-companion-pane="core"]').append(root.querySelector('.core-map'));
    station.querySelector('[data-companion-pane="core"]').append(root.querySelector('.reactor-equipment-detail'));
    station.querySelector('[data-companion-pane="trends"]').append(root.querySelector('.trend-panel'), root.querySelector('.events-panel'));
    station.querySelector('.companion-operator').append(root.querySelector('.operator-panel'));
    layout.hidden = true;
    root.querySelector('.brand-mark').remove();
    root.querySelector('.heading').remove();
    root.querySelector('.console').setAttribute('aria-label', 'Companion controls');
    root.querySelector('.header-settings').querySelector('[data-action="connect-screen"]').hidden = true;
    root.querySelector('.companion-link').hidden = true;
    root.querySelector('.operator-panel .local-tag').textContent = 'LINKED';
    const connection = document.createElement('section');
    connection.className = 'companion-connection panel';
    connection.innerHTML = `<div class="companion-connection-state"><strong class="companion-status" role="status">Enter the code shown by Connect screen on your desktop.</strong><button class="small-button" data-action="leave-session" hidden>Disconnect</button></div><div class="companion-layout-tools"><label for="companion-layout">Screen layout <select id="companion-layout">${Object.entries(screenPresets).map(([id, preset]) => `<option value="${id}">${preset.label}</option>`).join('')}<option value="custom">Custom</option></select></label><details class="companion-customize"><summary>Customize this screen</summary><div class="companion-section-options">${Object.entries(screenSections).map(([id, label]) => `<label><input type="checkbox" data-companion-section-toggle="${id}" checked/> ${label}</label>`).join('')}</div><p>Saved only in this browser. Choose different controls on each device.</p></details></div>`;
    station.before(connection);
    initializeCompanionLayout(host);
    const pairing = document.createElement('dialog');
    pairing.className = 'companion-pairing-dialog';
    pairing.setAttribute('closedby', 'none');
    pairing.setAttribute('aria-labelledby', 'companion-pairing-title');
    pairing.setAttribute('aria-describedby', 'companion-pairing-help');
    pairing.innerHTML = `<h2 id="companion-pairing-title">Connect to desktop</h2><p id="companion-pairing-help">Choose <b>Connect screen</b> on your desktop and enter its eight-digit pairing code.</p><form class="companion-join"><label for="companion-code">Desktop pairing code</label><input id="companion-code" class="companion-code" type="text" inputmode="numeric" pattern="[0-9 ]{8,12}" autocomplete="off" maxlength="12" placeholder="1234 5678" required autofocus/><button class="small-button" type="submit">Connect to desktop</button></form><p class="companion-pairing-status" role="status" aria-live="polite"></p>`;
    root.querySelector('.console').append(pairing);
    // The native modal keeps focus inside and makes the console inert. Escape
    // and backdrop clicks must not dismiss pairing before live state arrives.
    pairing.addEventListener('cancel', event => { event.preventDefault(); });
    pairing.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation();
    });
    pairing.addEventListener('close', () => {
        if (host.isConnected && !(host.remoteReady && host.sessionStatus === 'connected')) updateSessionControls(host);
    });
    root.querySelector('.companion-join').addEventListener('submit', event => {
        event.preventDefault();
        host.sessionConnection?.disconnect(host.sessionConnection.credentials?.type === 'resume-device' ? { type: 'leave' } : undefined);
        host.sessionConnection = host.createSessionConnection();
        host.remoteReady = false; host.remoteHostOnline = false; host.sessionError = '';
        host.pendingSessionCommands.clear();
        host.sessionConnection.connect({ type: 'join', code: root.querySelector('.companion-code').value.replace(/\D/g, '') });
        startSessionHeartbeat(host);
    });
    // A link still requires a deliberate Connect; it never issues plant commands.
    const code = new URLSearchParams(location.hash.slice(1)).get('code');
    if (/^\d{8}$/.test(code || '')) root.querySelector('.companion-code').value = code;
    // Bulk maintenance, exposure speed and session reset stay desktop-owned.
    root.querySelectorAll('[data-core-repair], .fuel-inspector label[for="fuel-rate"], #fuel-rate, [data-action="reset"], [data-action="repair"], [data-action="clear-fault"]').forEach(node => { node.hidden = true; node.disabled = true; });
    applyCompanionLayout(host);
    updateSessionControls(host);
}

function selectCompanionView(host, view) {
    if (!['grid', 'core', 'trends'].includes(view)) return;
    // Equipment shortcuts can reveal a section omitted from a custom layout.
    if (!viewSections[view].some(section => host.companionLayout.sections.includes(section))) {
        host.companionLayout.sections.push(...viewSections[view]);
        host.companionLayout.preset = 'custom';
    }
    host.companionView = view;
    host.companionLayout.view = view;
    applyCompanionLayout(host);
    saveCompanionLayout(host);
}

function initializeCompanionLayout(host) {
    const root = host.shadowRoot;
    const mark = (selector, section) => { root.querySelector(selector).dataset.companionSection = section; };
    for (const [selector, section] of Object.entries({
        '.automation-strip': 'regulation', '.setpoint': 'load', '.rod-control': 'rods', '.pump-controls': 'pumps',
        '.grid-dispatch-panel': 'grid', '.metrics': 'readings', '.power-source-panel': 'power',
        '.core-map': 'core', '.reactor-equipment-detail': 'core', '.trend-panel': 'trends', '.events-panel': 'events',
        '.emergency-station': 'reactor',
    })) mark(selector, section);
    const run = document.createElement('div');
    run.dataset.companionSection = 'reactor';
    const content = root.querySelector('.operator-content');
    content.prepend(run);
    for (const selector of ['.operation-state', '.reactor-pushbuttons', '.trip-recovery']) run.append(content.querySelector(selector));
    const defaults = { preset: 'all', sections: [...screenPresets.all.sections], view: 'grid' };
    let saved;
    try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)); } catch { /* Use all controls if storage is unavailable. */ }
    host.companionLayout = saved && Array.isArray(saved.sections) ? {
        preset: Object.hasOwn(screenPresets, saved.preset) ? saved.preset : 'custom',
        sections: [...new Set(saved.sections.filter(section => Object.hasOwn(screenSections, section)))],
        view: Object.hasOwn(viewSections, saved.view) ? saved.view : 'grid',
    } : defaults;
    if (!host.companionLayout.sections.length) host.companionLayout = defaults;
    root.querySelector('#companion-layout').addEventListener('change', event => {
        const preset = screenPresets[event.target.value];
        if (preset) host.companionLayout = { preset: event.target.value, sections: [...preset.sections], view: preset.view };
        else root.querySelector('.companion-customize').open = true;
        applyCompanionLayout(host);
        saveCompanionLayout(host);
    });
    root.addEventListener('change', event => {
        const section = event.target.dataset.companionSectionToggle;
        if (!section) return;
        const current = new Set(host.companionLayout.sections);
        event.target.checked ? current.add(section) : current.delete(section);
        // Keep one useful section so the screen never becomes empty.
        if (!current.size) { event.target.checked = true; return; }
        host.companionLayout.sections = [...current];
        host.companionLayout.preset = 'custom';
        applyCompanionLayout(host);
        saveCompanionLayout(host);
    });
}

function saveCompanionLayout(host) {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(host.companionLayout)); } catch { /* The layout remains usable for this session. */ }
}

function applyCompanionLayout(host) {
    const root = host.shadowRoot;
    const { sections } = host.companionLayout;
    const selected = new Set(sections);
    for (const node of root.querySelectorAll('[data-companion-section]')) node.hidden = !selected.has(node.dataset.companionSection);
    const available = Object.keys(viewSections).filter(view => viewSections[view].some(section => selected.has(section)));
    const view = available.includes(host.companionLayout.view) ? host.companionLayout.view : available[0];
    host.companionView = view;
    if (view) host.companionLayout.view = view;
    const operator = ['reactor', 'load', 'rods', 'pumps'].some(section => selected.has(section));
    root.querySelector('.companion-information').hidden = !available.length;
    root.querySelector('.companion-operator').hidden = !operator;
    root.querySelector('.companion-workspace').dataset.columns = available.length && operator ? 'two' : 'one';
    root.querySelector('.companion-views').hidden = available.length < 2;
    root.querySelector('#companion-layout').value = host.companionLayout.preset;
    root.querySelector('.header-control-card').dataset.regulationVisible = String(selected.has('regulation'));
    for (const input of root.querySelectorAll('[data-companion-section-toggle]')) input.checked = selected.has(input.dataset.companionSectionToggle);
    for (const pane of host.shadowRoot.querySelectorAll('[data-companion-pane]')) pane.hidden = pane.dataset.companionPane !== view;
    for (const button of root.querySelectorAll('[data-companion-view]')) {
        button.hidden = !available.includes(button.dataset.companionView);
        button.setAttribute('aria-pressed', String(button.dataset.companionView === view));
    }
    if (view === 'core') host.updateCore();
    if (view === 'trends') host.updateTrend();
}

function startSessionHeartbeat(host) {
    clearInterval(host.sessionHeartbeat);
    host.sessionHeartbeat = setInterval(() => {
        if (host.companion) {
            host.sessionConnection?.send({ type: 'activity', active: host.isConnected && host.intersecting && !document.hidden });
            if (host.lastRemoteState && performance.now() - host.lastRemoteState > 3000) host.remoteReady = false;
            for (const [id, time] of host.pendingSessionCommands) if (performance.now() - time > 3000) {
                host.pendingSessionCommands.delete(id); host.sessionError = 'Command was not confirmed. Check the desktop before trying again.';
            }
        } else publishSession(host);
        updateSessionControls(host);
    }, 500);
}

function receiveSessionMessage(host, message) {
    if (message.type === 'hosted') { host.pairingInfo = message; host.sessionError = ''; publishSession(host); }
    if (message.type === 'joined') {
        host.sessionError = '';
        host.sessionConnection.send({ type: 'activity', active: host.isConnected && host.intersecting && !document.hidden });
    }
    if (message.type === 'presence') {
        host.remoteHostOnline = message.hostOnline; host.connectedScreens = message.devices;
        host.connectedActiveScreens = message.activeDevices;
        if (!message.hostOnline) host.remoteReady = false;
        if (!host.companion) { host.updateActivity(); publishSession(host); }
    }
    if (message.type === 'state' && host.companion) {
        try {
            if (host.remoteGeneration !== message.state.sessionGeneration) {
                host.tripCoverOpen = false;
                host.pendingSessionCommands.clear();
                host.remoteGeneration = message.state.sessionGeneration;
            }
            host.remoteState = restoreSessionState(message.state, host.remoteState);
            host.remoteFuelService = message.state.fuelService;
            host.simulation = remoteSimulation(host.remoteState, command => host.sendSessionCommand(command));
            host.remoteRevision = message.revision;
            host.lastRemoteState = performance.now(); host.remoteReady = host.remoteHostOnline !== false && message.hostActive;
            host.update(true);
        } catch { host.remoteReady = false; host.sessionError = 'Incompatible desktop state. Reload both screens.'; }
    }
    if (message.type === 'command' && !host.companion) {
        // A visible companion can keep its desktop host active. A suspended or
        // disconnected host never queues commands for a later return.
        const available = host.isConnected && ((host.intersecting && !document.hidden) || host.connectedActiveScreens > 0);
        const accepted = available && message.generation === (host.sessionGeneration || 0) && freshSessionCommand(message) && applySessionCommand(host.simulation, message.command, {
            replaceFuel: id => host.replaceFuelSelection(false, id),
            replaceAllFuel: () => host.replaceFuelSelection(true),
        });
        host.sessionConnection.send({ type: 'result', id: message.id, accepted });
        if (accepted) { host.update(); publishSession(host); }
    }
    if (message.type === 'result' && host.companion) {
        host.pendingSessionCommands.delete(message.id);
        host.sessionError = message.accepted ? '' : 'Command was not accepted. Check desktop visibility and readiness.';
    }
    if (message.type === 'ended' || message.type === 'error') {
        host.sessionError = message.message; host.remoteReady = false;
        host.pendingSessionCommands.clear(); host.tripCoverOpen = false;
    }
    updateSessionControls(host);
}

export function publishSession(host) {
    if (host.companion || host.sessionStatus !== 'connected' || !host.isConnected) return;
    if (performance.now() - (host.lastSessionPublish || 0) < 100) return;
    host.lastSessionPublish = performance.now();
    host.sessionConnection?.send({ type: 'state', state: {
        ...captureSessionState(host.simulation), sessionGeneration: host.sessionGeneration || 0,
        fuelService: { hasCapacity: host.fuelTransfer.hasCapacity, message: host.fuelServiceStatus || '' },
    }, hostActive: (host.intersecting && !document.hidden) || host.connectedActiveScreens > 0, hostClock: Date.now(), hostMonotonic: performance.now() });
}

export function updateSessionControls(host) {
    const root = host.shadowRoot;
    if (host.companion) {
        const ready = host.remoteReady && host.sessionStatus === 'connected';
        const wasReady = host.dataset.remoteReady === 'true';
        host.dataset.remoteReady = String(Boolean(ready));
        if (wasReady !== Boolean(ready)) host.updateActivity();
        const status = root.querySelector('.companion-status');
        if (!status) return;
        const message = host.sessionError || (ready
            ? `${host.simulation.paused ? 'Desktop paused' : 'Connected to desktop'}${host.pendingSessionCommands.size ? ' · Sending command…' : ' · Readings live'}`
            : host.sessionStatus === 'connecting' ? 'Connecting…' : host.sessionStatus === 'connected' ? 'Desktop unavailable · readings stale · controls locked' : 'Disconnected · enter the desktop pairing code');
        status.textContent = message;
        root.querySelector('.companion-pairing-status').textContent = message;
        root.querySelector('[data-action="leave-session"]').hidden = !host.sessionConnection || host.sessionConnection.closed;
        for (const selector of ['.automation-strip', '.companion-operator', '.companion-pane', '.console-footer']) {
            root.querySelectorAll(selector).forEach(node => { node.inert = !ready; });
        }
        // Component controls share the connection lock.
        root.querySelectorAll('.equipment-dialog-body').forEach(node => { node.inert = !ready; });
        const pairing = root.querySelector('.companion-pairing-dialog');
        if (ready && pairing.open) {
            pairing.close();
            const navigation = root.querySelector('.companion-views');
            (navigation.hidden ? root.querySelector('#companion-layout') : navigation.querySelector('[aria-pressed="true"]')).focus({ preventScroll: true });
        } else if (!ready && host.isConnected && !pairing.open) {
            for (const dialog of [...host.floatingDialogs]) host.closeFloatingDialog(dialog, false);
            host.reopenMeltdown = host.simulation.condition.meltdown;
            pairing.showModal();
        }
    } else {
        const info = host.pairingInfo;
        const code = root.querySelector('.pairing-code');
        if (!code) return;
        code.textContent = info && host.sessionStatus === 'connected' ? `${info.code.slice(0, 4)} ${info.code.slice(4)}` : host.sessionStatus === 'connecting' ? 'Connecting…' : 'Offline';
        const remaining = info ? Math.max(0, Math.ceil((info.expiresAt - Date.now()) / 60_000)) : 0;
        root.querySelector('.pairing-status').textContent = host.sessionError || (info && host.sessionStatus === 'connected' ? `${host.connectedScreens || 0} connected screen(s) · ${remaining ? `code expires in ${remaining} min` : 'code expired; request a new code'}` : 'Session server unavailable. Start the Docker session service or local backend.');
        root.querySelector('.pairing-open').href = `/companion/${info ? `#code=${info.code}` : ''}`;
    }
}

export function disconnectSession(host) {
    clearInterval(host.sessionHeartbeat);
    host.sessionConnection?.disconnect({ type: host.companion ? 'leave' : 'end' });
    host.sessionConnection = null; host.remoteReady = false; host.sessionStatus = 'offline';
    host.pendingSessionCommands?.clear();
    const pairing = host.shadowRoot.querySelector('.companion-pairing-dialog');
    if (pairing?.open) pairing.close();
}
