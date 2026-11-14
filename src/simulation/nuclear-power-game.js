/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { CORE_CHANNELS, NuclearPowerSimulation } from './nuclear-power-model.js';
import { FuelTransferAnimation } from './nuclear-power-refuelling.js';
import { assignmentSteps, CompanyCareer, MISSIONS } from './nuclear-power-missions.js';
import { CareerStore, captureCareer, restoreCareerBundle } from './nuclear-power-game-save.js';
import { disconnectSession } from './nuclear-power-companion.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const time = seconds => `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
export const gameEntry = `<div class="game-entry"><button class="small-button" data-game-action="start" aria-controls="company-window" aria-expanded="false">Start game</button><button class="small-button" data-game-action="continue" hidden>Continue game</button><button class="small-button" data-game-action="open" hidden aria-controls="company-window" aria-expanded="false">Company inbox <span class="game-unread"></span></button><span class="game-error" role="status" hidden></span></div>`;
export const gamePanel = `<section class="game-status" hidden aria-label="Career assignment"><strong class="game-assignment"></strong><span class="game-progress"></span><button class="small-button" data-game-action="open">View assignment</button><button class="small-button" data-game-action="resume" hidden>Resume shift</button><button class="small-button" data-game-action="return">Save &amp; return to free operation</button></section>`;
export const gameTasks = `<section class="panel game-tasks" hidden aria-labelledby="game-tasks-title"><div class="panel-heading"><h2 id="game-tasks-title">Assignment steps</h2><button class="small-button" data-game-action="open">Full briefing ↗</button></div><div class="game-tasks-content"><h3 class="game-tasks-assignment"></h3><ol class="game-task-list" aria-label="Assignment checklist"></ol><progress class="game-task-hold" aria-label="Verified continuous operation"></progress><p class="game-task-timer"></p><p class="game-task-reason"></p><button class="small-button" data-game-action="report" hidden>Send report</button></div></section>`;
export const gameDialog = `<section id="company-window" class="game-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="company-title"><div class="core-dialog-titlebar" tabindex="0" aria-label="Move company window with arrow keys or drag"><h2 id="company-title">Unit 01 · Company</h2><button class="small-button" data-game-action="close" aria-label="Close company window">×</button></div><div class="game-content"><p class="game-storage-status" role="status"></p><nav class="game-tabs" aria-label="Company pages">${['Inbox', 'Assignments', 'Achievements', 'Archive', 'Save'].map(label => `<button class="small-button" data-game-tab="${label.toLowerCase()}" aria-pressed="false">${label}</button>`).join('')}</nav><div class="game-page"></div><input class="game-import-file" type="file" accept="application/json,.json" hidden/></div></section>`;

export function initializeGame(host) {
    if (host.companion) return;
    host.game = new GameController(host);
}

class GameController {
    constructor(host) {
        this.host = host;
        this.store = new CareerStore();
        this.tab = 'inbox';
        this.difficulty = 'easy';
        this.status = 'Checking local career…';
        this.owner = false;
        this.pendingSave = Promise.resolve();
        this.lastSaved = -Infinity;
        this.root = host.shadowRoot;
        this.root.addEventListener('change', event => {
            if (event.target.matches('[name="career-difficulty"]')) this.difficulty = event.target.value;
        });
        this.root.addEventListener('click', event => {
            const tab = event.target.closest('[data-game-tab]');
            if (tab) { this.tab = tab.dataset.gameTab; this.render(true); }
            const button = event.target.closest('[data-game-action]');
            if (button && !button.disabled) this.action(button.dataset.gameAction).catch(error => this.error(error));
            const message = event.target.closest('[data-game-message]');
            if (message && this.career) {
                this.career.state.messages.find(item => item.id === message.dataset.gameMessage).read = true;
                this.render(true); this.save(true);
            }
        });
        this.root.querySelector('.game-import-file').addEventListener('change', async event => {
            try {
                const file = event.target.files[0];
                if (!file) return;
                if (file.size > 10_000_000) throw new Error('This backup is too large.');
                const bundle = JSON.parse(await file.text());
                const restored = restoreCareerBundle(bundle);
                if (!await this.acquire()) return;
                await this.store.load();
                this.install(restored);
                await this.save(true);
            } catch (error) { this.error(error); }
            event.target.value = '';
        });
        this.onHide = () => { if (document.hidden) this.save(true); };
        document.addEventListener('visibilitychange', this.onHide);
        this.store.load().then(bundle => {
            this.hasSave = Boolean(bundle); this.status = bundle ? 'A saved career is available on this browser.' : 'No saved career yet.'; this.render();
        }).catch(error => this.error(error));
    }

    error(error) { this.status = error.message || 'Career operation failed.'; this.errorMessage = this.status; this.render(true); }

    async attach() {
        this.attaching = true;
        try {
            await this.detaching;
            if (!this.host.isConnected) return;
            document.addEventListener('visibilitychange', this.onHide);
            if (this.career && !this.owner) { this.host.simulation.paused = true; await this.acquire(); this.host.update(); }
        } finally { this.attaching = false; this.render(); }
    }

    async acquire() {
        if (this.owner) return true;
        if (!navigator.locks) { this.error(new Error('This browser cannot safely own a saved career. Use a browser with Web Locks support.')); return false; }
        return new Promise(resolve => {
            this.lockRequest = navigator.locks.request('nuclear-power-career', { ifAvailable: true }, async lock => {
                if (!this.host.isConnected) { resolve(false); return; }
                if (!lock) { this.error(new Error('This career is open in another tab. Save and leave it there first.')); resolve(false); return; }
                this.owner = true;
                const held = new Promise(release => { this.releaseLock = release; });
                resolve(true);
                await held;
            }).catch(error => { this.error(error); resolve(false); });
        });
    }

    release() {
        const request = this.lockRequest;
        this.owner = false; this.releaseLock?.(); this.releaseLock = null; this.lockRequest = null;
        return request;
    }

    install(restored) {
        if (!this.career) this.freeSession = { simulation: this.host.simulation, transfer: this.host.fuelTransfer };
        this.career = new CompanyCareer(restored.state);
        this.switchPlant(restored.simulation, restored.transfer);
        this.host.simulation.paused = true;
        this.career.state.lastElapsed = this.host.simulation.elapsed;
        this.lastSaved = -Infinity;
        this.tab = 'inbox';
        this.introduction = false;
        this.render(true);
        this.open();
    }

    switchPlant(simulation, transfer) {
        const host = this.host;
        disconnectSession(host);
        host.pairingInfo = null; host.connectedActiveScreens = 0; host.connectedScreens = 0;
        host.sessionGeneration = (host.sessionGeneration || 0) + 1;
        host.stopAlarmSound();
        clearInterval(host.timer); host.timer = null;
        cancelAnimationFrame(host.animationFrame); host.animationFrame = null;
        for (const dialog of [...host.floatingDialogs]) host.closeFloatingDialog(dialog, false);
        host.simulation = simulation; host.fuelTransfer = transfer;
        host.lastProcessElapsed = simulation.elapsed;
        host.tripCoverOpen = false; host.reopenMeltdown = false;
        host.componentMessages = {}; host.fuelServiceStatus = ''; host.spentFuelMessage = '';
        host.selectedRod = 'CR-01'; host.selectedFuel = null;
        host.processMotion = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
        host.motion = Object.fromEntries(['A', 'A2', 'B', 'B2'].map(key => [key, { angle: 0, offset: 0, travel: 0 }]));
        host.dieselMotion = { A: 0, B: 0 };
        host.instrumentMotion = { thermal: 0, electrical: 0, flow: 0, secondaryFlow: 0 };
        host.idleOverviewSignature = '';
        host.update(); host.updateOverview(true);
    }

    open() {
        this.render(true);
        const dialog = this.root.querySelector('.game-dialog');
        this.host.openFloatingDialog(dialog);
        dialog.querySelector('.core-dialog-titlebar').focus({ preventScroll: true });
    }

    async action(action) {
        if (this.busy || this.attaching) return;
        this.busy = true;
        try {
            if (action === 'start') { this.introduction = true; this.open(); }
            if (action === 'open') { this.introduction = false; this.tab = 'inbox'; this.open(); }
            if (action === 'close') this.host.closeFloatingDialog(this.root.querySelector('.game-dialog'));
            if (action === 'begin') {
                if (!await this.acquire()) return;
                await this.store.load(); // Read the current revision only after acquiring ownership.
                const simulation = new NuclearPowerSimulation();
                simulation.autoAllowed = this.difficulty !== 'hard';
                if (!simulation.autoAllowed) simulation.setAutoMode(false);
                this.install({ simulation, transfer: new FuelTransferAnimation(CORE_CHANNELS),
                    state: new CompanyCareer(null, MISSIONS, this.difficulty).state });
                await this.save(true);
            }
            if (action === 'continue') {
                if (!await this.acquire()) return;
                const bundle = await this.store.load();
                if (!bundle) { await this.release(); throw new Error('No saved career was found.'); }
                this.install(restoreCareerBundle(bundle));
                await this.save(true);
            }
            if (action === 'resume' && this.career && this.owner) {
                this.host.simulation.paused = false; this.host.update(); await this.save(true);
            }
            if (action === 'accept' && this.career?.accept(this.host.simulation)) {
                await this.save(true);
                this.host.closeFloatingDialog(this.root.querySelector('.game-dialog'));
            }
            if (action === 'report' && this.career?.report(this.host.simulation)) await this.save(true);
            if (action === 'save') await this.save(true);
            if (action === 'return' && this.career) {
                const saved = await this.save(true);
                if (!saved) { this.open(); return; }
                this.career = null;
                this.switchPlant(this.freeSession.simulation, this.freeSession.transfer);
                this.freeSession = null; await this.release(); this.render(true);
            }
            if (action === 'export' && this.career) {
                const bundle = captureCareer(this.host.simulation, this.host.fuelTransfer, this.career);
                const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
                const link = document.createElement('a'); link.href = url; link.download = 'nuclear-power-career.json'; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            if (action === 'import') {
                this.root.querySelector('.game-import-file').click();
            }
        } catch (error) { if (!this.career) await this.release(); throw error; }
        finally { this.busy = false; this.render(true); }
    }

    save(force = false) {
        if (!this.career || !this.owner) return Promise.resolve(false);
        const elapsed = this.host.simulation.elapsed;
        if (!force && elapsed - this.lastSaved < 5) return this.pendingSave;
        const bundle = captureCareer(this.host.simulation, this.host.fuelTransfer, this.career);
        this.lastSaved = elapsed;
        this.pendingSave = this.pendingSave.then(async () => {
            try {
                await this.store.write(bundle); this.hasSave = true; this.errorMessage = '';
                this.status = `Saved locally · plant time ${time(bundle.plant.elapsed)}`;
                this.render(); return true;
            } catch (error) { this.error(error); return false; }
        });
        return this.pendingSave;
    }

    update(fromTimer) {
        if (this.career) {
            const changed = this.career.advance(this.host.simulation);
            this.save(changed || !fromTimer);
        }
        this.render();
    }

    async detach() {
        document.removeEventListener('visibilitychange', this.onHide);
        if (this.career) this.host.simulation.paused = true;
        await this.save(true);
        await this.release();
    }

    renderTasks(current) {
        const panel = this.root.querySelector('.game-tasks');
        const steps = assignmentSteps(current, this.host.simulation);
        panel.hidden = steps.length === 0;
        if (panel.hidden) return;
        panel.querySelector('.game-tasks-assignment').textContent = current.definition.title;
        const signature = JSON.stringify([current.definition.id, steps]);
        if (signature !== this.tasksSignature) {
            this.tasksSignature = signature;
            panel.querySelector('.game-task-list').innerHTML = steps.map((step, index) => `<li data-step="${step.id}" data-complete="${step.done}"><span class="game-task-marker" aria-hidden="true">${step.done ? '✓' : index + 1}</span><span><span class="sr-only">${step.done ? 'Done' : 'Pending'}: </span>${escape(step.label)}</span></li>`).join('');
        }
        panel.querySelector('.game-task-hold').max = current.definition.objective.seconds;
        panel.querySelector('.game-task-hold').value = current.held;
        const timed = ['generation-hold', 'water-quality'].includes(current.definition.objective.kind);
        panel.querySelector('.game-task-hold').hidden = !timed;
        panel.querySelector('.game-task-hold').setAttribute('aria-label', 'Verified qualifying time');
        panel.querySelector('.game-task-timer').textContent = timed ? `${time(current.held)} / ${time(current.definition.objective.seconds)}${!this.host.simulation.autoMode && current.definition.objective.manualAllowed ? ' · Qualifying time; outside limits pauses progress' : ''}` : 'Complete the verified work steps';
        panel.querySelector('.game-task-reason').textContent = current.reason;
        panel.querySelector('[data-game-action="report"]').hidden = current.status !== 'ready';
    }

    render(force = false) {
        const active = Boolean(this.career), current = this.career?.current;
        this.host.dataset.game = active ? 'career' : 'free';
        this.root.querySelector('.game-error').hidden = !this.errorMessage;
        this.root.querySelector('.game-error').textContent = this.errorMessage || '';
        for (const button of this.root.querySelectorAll('[data-game-action]')) button.disabled = Boolean(this.attaching);
        for (const [action, hidden] of [['start', active], ['continue', active || !this.hasSave], ['open', !active]]) {
            this.root.querySelector(`.game-entry [data-game-action="${action}"]`).hidden = hidden;
        }
        this.root.querySelector('.game-status').hidden = !active;
        this.renderTasks(current);
        this.root.querySelector('.game-unread').textContent = active ? `(${this.career.state.messages.filter(item => !item.read).length})` : '';
        this.root.querySelector('.game-assignment').textContent = current?.definition.title || 'Shift assignments complete';
        this.root.querySelector('.game-progress').textContent = `${active ? `${this.career.state.difficulty === 'hard' ? 'Hard · Manual only' : 'Easy · Auto available'} · ` : ''}${current ? current.status === 'assigned' ? 'Read the briefing and accept in Company inbox.' : current.status === 'ready' ? 'Verified · ready to report' : 'In progress · see assignment steps' : 'Your achievements are saved. Further assignments can arrive in updates.'}`;
        this.root.querySelector('[data-game-action="resume"]').hidden = !active || !this.host.simulation.paused;
        for (const reset of this.root.querySelectorAll('[data-action="reset"]')) { reset.disabled = active; reset.title = active ? 'Return to free operation before resetting a demo.' : ''; }
        const dialog = this.root.querySelector('.game-dialog');
        if (!force && !dialog.matches(':popover-open')) return;
        this.root.querySelector('.game-storage-status').textContent = this.status;
        this.root.querySelector('.game-tabs').hidden = this.introduction || !active;
        for (const button of this.root.querySelectorAll('[data-game-tab]')) button.setAttribute('aria-pressed', String(button.dataset.gameTab === this.tab));
        const page = this.root.querySelector('.game-page');
        const state = this.career?.state;
        const signature = JSON.stringify([this.introduction, this.tab, this.hasSave,
            this.tab === 'inbox' ? state?.messages : this.tab === 'achievements' ? state?.achievements
                : this.tab === 'save' ? Boolean(state) : state?.assignments.map(item =>
                    [item.definition, item.status, Math.floor(item.held), item.reason, item.completedAt])]);
        if (!force && signature === this.signature) return;
        this.signature = signature;
        if (this.introduction || !active) {
            page.innerHTML = `<div class="game-welcome"><span class="eyebrow">UNIT 01 · YOUR FIRST SHIFT</span><h3>Work for the company. Run the plant.</h3><p>Your plant manager and specialists assign startup, reliable operation, condition rounds, work orders and water-treatment checks. Accept the work, operate the actual plant, then report verified results. Your plant, inbox and achievements save on this browser.</p><p>This career has ${MISSIONS.length} assignments. Service is free; electricity trading and company expenses remain planned.</p><fieldset class="game-difficulty"><legend>Career difficulty</legend><label><input type="radio" name="career-difficulty" value="easy" ${this.difficulty === 'easy' ? 'checked' : ''}/> <strong>Easy</strong><span>Auto and Manual operation available.</span></label><label><input type="radio" name="career-difficulty" value="hard" ${this.difficulty === 'hard' ? 'checked' : ''}/> <strong>Hard</strong><span>Manual operation only. Auto is disabled on every screen.</span></label><p>Manual power assignments accumulate qualifying time. Outside the requirements, progress pauses. There is no failure deadline; verified success stays ready to report. Plant heat and damage still apply.</p></fieldset><p>Beginning starts a separate cold plant. Your current free-operation plant stays available on this page.${this.hasSave ? ' <strong>Beginning a new career replaces your existing local career. Continue it instead to keep that progress.</strong>' : ''}</p><button class="control-button" data-game-action="begin">${this.hasSave ? 'Replace saved career & begin' : 'Begin career'}</button>${this.hasSave ? '<button class="small-button" data-game-action="continue">Continue saved career</button>' : ''}<button class="small-button" data-game-action="import">Import career backup</button></div>`;
        } else if (this.tab === 'inbox') {
            page.innerHTML = `<h3>Company inbox</h3>${[...this.career.state.messages].reverse().map(message => `<article class="company-message ${message.read ? '' : 'unread'}"><p class="game-meta">${escape(message.sender)} · T+${time(message.time)}</p><h3>${escape(message.subject)}</h3><p>${escape(message.body)}</p>${message.read ? '' : `<button class="small-button" data-game-message="${escape(message.id)}">Mark read</button>`}${message.missionId === current?.definition.id ? '<button class="small-button" data-game-tab="assignments">View assignment</button>' : ''}</article>`).join('')}`;
        } else if (this.tab === 'assignments') {
            page.innerHTML = current ? `<h3>${escape(current.definition.title)}</h3><p>${escape(current.definition.brief)}</p>${['generation-hold', 'water-quality'].includes(current.definition.objective.kind) ? `<progress max="${current.definition.objective.seconds}" value="${current.held}" aria-label="Verified qualifying time"></progress><p>${time(current.held)} / ${time(current.definition.objective.seconds)} · ${escape(current.status)}</p>` : `<p>${escape(current.status)} · Follow the verified work steps in Maintenance.</p>`}<p role="status">${escape(current.reason)}</p>${current.status === 'assigned' ? '<button class="control-button" data-game-action="accept">Accept assignment</button>' : current.status === 'ready' ? '<button class="control-button" data-game-action="report">Send report</button>' : ''}<p class="game-meta">Upcoming: ${escape(MISSIONS.filter(item => !this.career.state.assignments.some(saved => saved.definition.id === item.id)).map(item => item.title).join(', ') || 'Further company assignments can arrive in updates.')}</p>` : '<h3>Shift assignments complete</h3><p>Your reports are in the archive. Keep this career for future assignments, or return to free operation.</p>';
        } else if (this.tab === 'achievements') {
            page.innerHTML = `<h3>Achieved goals</h3>${this.career.state.achievements.map(item => `<article class="company-message"><h3>✓ ${escape(item.title)}</h3><p>T+${time(item.time)} · ${time(item.heldSeconds)} verified operation</p></article>`).join('') || '<p>No achieved goals yet. Report your first verified assignment to earn one.</p>'}`;
        } else if (this.tab === 'archive') {
            page.innerHTML = `<h3>Assignment archive</h3>${this.career.state.assignments.filter(item => item.status === 'completed').map(item => `<article class="company-message"><h3>${escape(item.definition.title)}</h3><p>${escape(item.definition.brief)}</p><p>Report accepted at T+${time(item.completedAt)} · ${time(item.held)} verified hold</p><p>${escape(item.definition.completion)}</p></article>`).join('') || '<p>Completed reports will be kept here.</p>'}`;
        } else {
            page.innerHTML = '<h3>Career save</h3><p>Your plant, assignments, inbox and achievements are saved together. Returning later resumes at the saved plant time, paused. Nothing runs while the career is closed.</p><button class="control-button" data-game-action="save">Save now</button><button class="small-button" data-game-action="export">Export backup</button><p>Importing replaces this career and its plant. Export a backup first if you want to keep it.</p><button class="small-button" data-game-action="import">Import and replace career</button><button class="small-button" data-game-action="return">Save & return to free operation</button>';
        }
    }
}
