/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Presentation only: all controls keep their original DOM, handlers and host model.
const mobileQuery = '(max-width: 1100px) and (max-height: 600px) and (orientation: landscape) and (any-pointer: coarse)';
const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';
const attributes = ['popover', 'role', 'aria-modal', 'aria-labelledby', 'aria-hidden', 'hidden', 'inert'];

export class MobileLayout {
    constructor(host) {
        this.host = host; this.root = host.shadowRoot; this.active = false;
        this.moves = []; this.saved = new Map(); this.inertNodes = new Map();
        const console = this.root.querySelector('.console');
        console.insertAdjacentHTML('afterbegin', `<header class="mobile-header mobile-only" aria-label="Phone control room">
          <img class="mobile-logo" src="/favicon.svg" alt="" width="28" height="28"/>
          <div class="mobile-identity"><strong>Nuclear Power</strong><span data-mobile-clock></span></div>
          <span class="mobile-state" data-mobile-state></span>
          <button class="small-button" data-mobile-open="company" aria-controls="company-window" aria-expanded="false">Company <span data-mobile-unread></span></button>
          <button class="small-button" data-mobile-open="analysis" aria-controls="plant-analysis" aria-expanded="false">Trends <span data-mobile-alarms></span></button>
          <span data-mobile-pause></span><button class="small-button" data-mobile-open="more" aria-controls="mobile-more" aria-expanded="false">More</button>
        </header>
        <nav class="mobile-navigation mobile-only" aria-label="Phone plant navigation">
          <button class="small-button mobile-edge mobile-edge-left" data-mobile-open="instruments" aria-controls="plant-instruments" aria-expanded="false">Instruments ›</button>
          <button class="small-button mobile-edge mobile-edge-right" data-mobile-open="operator" aria-controls="mobile-operator" aria-expanded="false">‹ Controls</button>
          <button class="small-button mobile-back" data-mobile-back hidden>← Back to plant</button>
          <button class="small-button mobile-parts" data-mobile-open="parts" hidden aria-expanded="false">Parts</button>
        </nav>`);
        console.insertAdjacentHTML('beforeend', `<section id="mobile-more" class="mobile-only mobile-menu" data-mobile-surface="more" aria-label="Plant menu">
          <div class="mobile-surface-heading" data-mobile-drag><h2>Plant menu</h2><button class="small-button" data-mobile-close aria-label="Close plant menu">×</button></div>
          <div class="mobile-menu-body"><nav class="mobile-destinations" aria-label="Plant areas"></nav>
          <div class="mobile-shortcuts"><button class="small-button" data-mobile-action="core-view">Core map</button><button class="small-button" data-mobile-action="spent-fuel">Spent fuel</button><button class="small-button" data-mobile-action="exercises">Objectives &amp; scenarios</button></div>
          <div data-mobile-settings></div><div data-mobile-overview></div><div data-mobile-footer></div></div>
        </section>`);
        for (const tab of this.root.querySelectorAll('[data-plant-tab]')) {
            const button = document.createElement('button');
            button.className = 'small-button'; button.dataset.mobileTab = tab.dataset.plantTab;
            button.textContent = tab.textContent.replace(/\s*0$/, '').trim();
            this.root.querySelector('.mobile-destinations').append(button);
        }
        this.root.querySelector('.operator-column').id = 'mobile-operator';
        this.surfaces = new Map([
            ['instruments', this.root.getElementById('plant-instruments')],
            ['operator', this.root.querySelector('.operator-column')],
            ['analysis', this.root.getElementById('plant-analysis')],
            ['more', this.root.getElementById('mobile-more')],
        ]);
        for (const [kind, node] of this.surfaces) this.prepare(node, kind,
            { instruments: 'Plant instruments', operator: 'Operator console', analysis: 'Trends & events', more: 'Plant menu' }[kind]);
        for (const node of this.root.querySelectorAll('.station-part-list, .computer-unit-list')) {
            const tab = node.closest('[role="tabpanel"]').id.replace('-panel', '');
            this.prepare(node, 'parts', tab === 'computers' ? 'Computer units' : 'Equipment parts');
            this.surfaces.set(`parts-${tab}`, node);
        }
    }

    prepare(node, kind, title) {
        node.dataset.mobileSurface = kind;
        if (node.querySelector('.mobile-surface-heading')) return;
        const heading = document.createElement('div');
        heading.className = 'mobile-surface-heading mobile-only'; heading.dataset.mobileDrag = '';
        const h2 = document.createElement('h2'); h2.id = `mobile-${this.surfaces.size}-${kind}-${node.closest('[role="tabpanel"]')?.id || 'drawer'}-title`; h2.textContent = title;
        const close = document.createElement('button'); close.className = 'small-button'; close.dataset.mobileClose = '';
        close.setAttribute('aria-label', `Close ${title.toLowerCase()}`); close.textContent = '×';
        heading.append(h2, close); node.prepend(heading);
        if (kind === 'parts') {
            const note = document.createElement('p'); note.className = 'mobile-fallback-note mobile-only';
            note.textContent = '3D unavailable. Use the native controls below.'; note.hidden = true;
            heading.after(note);
        }
    }

    connect() {
        if (this.abort) return;
        this.abort = new AbortController(); const { signal } = this.abort;
        this.query = matchMedia(mobileQuery);
        this.query.addEventListener('change', () => this.reconcile(), { signal });
        this.host.reducedMotion.addEventListener('change', () => { if (this.host.reducedMotion.matches) this.entryAnimation?.cancel(); }, { signal });
        window.addEventListener('resize', () => this.reconcile(), { signal });
        window.visualViewport?.addEventListener('resize', () => this.sizeViewport(), { signal });
        window.visualViewport?.addEventListener('scroll', () => this.sizeViewport(), { signal });
        this.root.addEventListener('click', event => this.click(event), { capture: true, signal });
        // Browsers can retarget a top-layer backdrop to the shadow host/document.
        // Dismiss on click after the native touch sequence, preserving focus and
        // keeping the background inert throughout the complete press/release.
        document.addEventListener('pointerdown', event => {
            this.backdropPress = null;
            if (!this.active) return;
            if (!this.current || event.button !== 0) return;
            const r = this.current.getBoundingClientRect();
            if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return;
            this.backdropPress = this.current;
        }, { capture: true, signal });
        document.addEventListener('click', event => {
            if (!this.active || !this.current || this.backdropPress !== this.current) return;
            this.backdropPress = null;
            const r = this.current.getBoundingClientRect();
            if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return;
            event.preventDefault(); event.stopImmediatePropagation(); this.close();
        }, { capture: true, signal });
        document.addEventListener('keydown', event => this.keydown(event), { capture: true, signal });
        document.addEventListener('focusin', event => {
            const target = event.composedPath()[0];
            if (this.active && this.current && !this.current.contains(target)) this.focusCurrent();
        }, { signal });
        this.root.addEventListener('touchstart', event => this.touchStart(event), { passive: true, signal });
        this.root.addEventListener('touchend', event => this.touchEnd(event), { passive: false, signal });
        this.root.addEventListener('touchcancel', () => { this.swipe = null; }, { passive: true, signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(this.gestureFrame); cancelAnimationFrame(this.focusFrame); this.close(false); } }, { signal });
        this.reconcile();
    }

    disconnect() { this.abort?.abort(); this.abort = null; if (this.active) this.leave(); }

    reconcile() {
        if (this.query.matches && !this.active) this.enter();
        else if (!this.query.matches && this.active) this.leave();
        this.sizeViewport();
    }

    move(node, target) {
        const marker = document.createComment('mobile layout position'); node.before(marker);
        this.moves.push({ node, marker }); target.append(node);
    }

    enter() {
        this.host.finishWorkspacePanelTransitions?.();
        for (const dialog of [...this.host.floatingDialogs]) this.host.closeFloatingDialog(dialog, false);
        this.active = true; this.host.dataset.layout = 'phone-landscape';
        for (const node of this.surfaces.values()) {
            this.saved.set(node, attributes.map(name => [name, node.getAttribute(name)]));
            node.hidden = false; node.inert = false; node.removeAttribute('aria-hidden');
            node.setAttribute('popover', 'manual'); node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true');
            const heading = node.querySelector('.mobile-surface-heading h2');
            if (heading) node.setAttribute('aria-labelledby', heading.id);
        }
        this.move(this.root.querySelector('[data-action="pause"]'), this.root.querySelector('[data-mobile-pause]'));
        this.move(this.root.querySelector('.session-clock'), this.root.querySelector('[data-mobile-clock]'));
        this.move(this.root.querySelector('.automation-strip'), this.surfaces.get('operator'));
        this.move(this.root.querySelector('.header-settings'), this.root.querySelector('[data-mobile-settings]'));
        this.move(this.root.querySelector('.overview-toolbar'), this.root.querySelector('[data-mobile-overview]'));
        this.move(this.root.querySelector('.console-footer > div'), this.root.querySelector('[data-mobile-footer]'));
        this.tabChanged(); this.update(); this.refreshScenes();
    }

    leave() {
        cancelAnimationFrame(this.gestureFrame);
        cancelAnimationFrame(this.focusFrame);
        this.close(false); this.swipe = null;
        for (const dialog of [...this.host.floatingDialogs]) this.host.closeFloatingDialog(dialog, false);
        for (const { node, marker } of this.moves.reverse()) { marker.replaceWith(node); }
        this.moves = [];
        for (const [node, saved] of this.saved) {
            delete node.dataset.mobileInline;
            const note = node.querySelector('.mobile-fallback-note'); if (note) note.hidden = true;
            for (const [name, value] of saved) {
                if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
            }
        }
        this.saved.clear(); this.active = false; delete this.host.dataset.layout;
        this.host.restoreWorkspacePanels?.(); this.refreshScenes();
        if (this.host.isConnected) this.root.querySelector(`#${this.host.plantTab}-tab`)?.focus({ preventScroll: true });
    }

    sizeViewport() {
        if (!this.active) return;
        const viewport = window.visualViewport;
        this.host.style.setProperty('--mobile-height', `${viewport?.height || innerHeight}px`);
        this.host.style.setProperty('--mobile-top', `${viewport?.offsetTop || 0}px`);
        this.host.style.setProperty('--mobile-left', `${viewport?.offsetLeft || 0}px`);
        this.host.style.setProperty('--mobile-width', `${viewport?.width || innerWidth}px`);
    }

    get occludesScene() { return this.active && Boolean(this.current) && !['instruments', 'operator', 'parts'].includes(this.kind); }

    refreshScenes() {
        this.host.refreshOverviewVisibility(); this.host.equipmentStations?.syncVisibility();
        this.host.computerConsole?.scene?.setVisible(this.host.computerConsole.canDraw());
        this.host.updateActivity(); this.host.updateAlarmSound(); this.host.updateOverview(true);
    }

    modal(node) {
        this.restoreInert();
        // Inert siblings along the ancestor path; never inert a popover's own parent.
        for (let child = node; child && child !== this.root; child = child.parentNode) {
            for (const sibling of child.parentNode?.children || []) if (sibling !== child && sibling.tagName !== 'STYLE') {
                this.inertNodes.set(sibling, sibling.inert); sibling.inert = true;
            }
        }
    }

    restoreInert() { for (const [node, value] of this.inertNodes) node.inert = value; this.inertNodes.clear(); }

    open(kind, trigger = this.root.activeElement) {
        if (!this.active) return;
        if (kind === 'company') { this.host.game?.action(this.host.game.career ? 'open' : 'start'); return; }
        const node = this.surfaces.get(kind === 'parts' ? `parts-${this.host.plantTab}` : kind);
        if (!node) return;
        if (node.dataset.mobileInline) { node.querySelector(focusable)?.focus({ preventScroll: true }); return; }
        if (this.current === node) { this.close(); return; }
        this.close(false); this.closeOtherDialogs();
        this.current = node; this.kind = kind; this.returnTo = trigger;
        node.showPopover(); this.modal(node); this.expanded(node.id, true);
        // UI motion must still finish while plant animations are paused.
        this.entryAnimation?.cancel();
        if (!this.host.reducedMotion.matches) this.entryAnimation = node.animate(
            [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
            { duration: 180, easing: 'ease-out' });
        this.focusCurrent(); this.refreshScenes();
        if (kind === 'analysis') this.host.updateTrend();
    }

    closeOtherDialogs(except) {
        for (const dialog of [...this.host.floatingDialogs]) if (dialog !== except) this.host.closeFloatingDialog(dialog, false);
    }

    beforeDialog(dialog) {
        if (!this.active) return;
        const trigger = this.root.activeElement;
        if (this.current !== dialog) this.close(false);
        this.closeOtherDialogs(dialog);
        this.current = dialog; this.kind = 'inspection'; this.returnTo = trigger;
        dialog.setAttribute('aria-modal', 'true');
        this.modal(dialog);
    }

    dialogClosed(dialog, restoreFocus) {
        if (!this.active || this.current !== dialog) return false;
        dialog.setAttribute('aria-modal', 'false');
        const trigger = this.returnTo; this.current = null; this.kind = null; this.restoreInert();
        if (restoreFocus) this.restoreFocus(trigger, dialog);
        this.refreshScenes(); return true;
    }

    close(restoreFocus = true) {
        if (!this.current) return;
        const node = this.current, trigger = this.returnTo;
        this.entryAnimation?.cancel();
        if (node.classList.contains('floating-dialog')) { this.host.closeFloatingDialog(node, restoreFocus); return; }
        this.current = null; this.kind = null;
        node.hidePopover(); this.expanded(node.id, false); this.restoreInert();
        if (restoreFocus) this.restoreFocus(trigger);
        this.refreshScenes();
    }

    expanded(id, value) {
        if (!id) return;
        for (const trigger of this.root.querySelectorAll(`.mobile-only [aria-controls="${id}"]`)) trigger.setAttribute('aria-expanded', String(value));
    }

    visible(node) { return node?.isConnected && !node.disabled && !node.closest('[inert]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'; }

    restoreFocus(trigger, dialog) {
        const apply = () => {
            if (!this.active || this.current || document.hidden) return;
            let target = this.visible(trigger) ? trigger : null;
            if (!target) target = this.root.querySelector(`[data-mobile-open="${dialog?.classList.contains('game-dialog') ? 'company' : this.host.plantTab === 'reactor' ? 'more' : 'parts'}"]`);
            if (!this.visible(target)) target = this.root.querySelector('[data-mobile-back]:not([hidden])') || this.root.querySelector('[data-mobile-open="more"]');
            target?.focus({ preventScroll: true });
        };
        apply();
        // Native touch dismissal can update focus after the click listener returns.
        cancelAnimationFrame(this.focusFrame);
        this.focusFrame = requestAnimationFrame(() => { this.focusFrame = null; apply(); });
    }

    focusCurrent() { this.current?.querySelector(focusable)?.focus({ preventScroll: true }); }

    keydown(event) {
        if (!this.active || !this.current) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); }
        if (event.key === 'Tab') {
            const nodes = [...this.current.querySelectorAll(focusable)].filter(node => this.visible(node));
            const index = nodes.indexOf(this.root.activeElement);
            if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === nodes.length - 1) {
                event.preventDefault(); nodes[event.shiftKey ? nodes.length - 1 : 0]?.focus();
            }
            // Intermediate Tab movement stays native, including scrolling a
            // focused control into view and radio-group keyboard semantics.
        }
    }

    click(event) {
        if (!this.active) return;
        const button = event.target.closest('[data-mobile-open], [data-mobile-close], [data-mobile-back], [data-mobile-tab], [data-mobile-action]');
        if (!button || button.disabled) return;
        if (button.dataset.mobileOpen) this.open(button.dataset.mobileOpen, button);
        else if (button.hasAttribute('data-mobile-close')) this.close();
        else if (button.dataset.mobileAction) { this.close(false); this.host.act(button.dataset.mobileAction); }
        else {
            this.close(false); this.closeOtherDialogs();
            this.host.setPlantTab(button.dataset.mobileTab || 'reactor');
            this.focusStation();
        }
    }

    touchStart(event) {
        if (!this.active || event.touches.length !== 1) { this.swipe = null; return; }
        const handle = event.target.closest('.mobile-edge, [data-mobile-drag]');
        if (!handle || event.target.closest('[data-mobile-close]')) return;
        const touch = event.touches[0];
        this.swipe = { id: touch.identifier, x: touch.clientX, y: touch.clientY, handle, closing: Boolean(this.current) };
    }

    touchEnd(event) {
        const swipe = this.swipe; this.swipe = null;
        const touch = [...event.changedTouches].find(point => point.identifier === swipe?.id);
        if (!swipe || !touch) return;
        const dx = touch.clientX - swipe.x, dy = touch.clientY - swipe.y;
        if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        const left = swipe.handle.dataset.mobileOpen === 'instruments' || this.kind === 'instruments';
        if (swipe.closing ? (left ? dx >= 0 : dx <= 0) : (left ? dx <= 0 : dx >= 0)) return;
        // Cancel only the recognized swipe's compatibility click; normal taps,
        // range controls, scrolling and camera gestures keep their native path.
        event.preventDefault();
        const current = this.current;
        // Finish the native touch sequence before removing its top-layer target.
        // Otherwise the browser can suppress the next control's compatibility click.
        cancelAnimationFrame(this.gestureFrame);
        this.gestureFrame = requestAnimationFrame(() => {
            this.gestureFrame = null;
            if (!this.active || document.hidden || this.current !== current) return;
            if (swipe.closing) this.close(); else this.open(swipe.handle.dataset.mobileOpen, swipe.handle);
        });
    }

    tabChanged() {
        if (!this.active) return;
        this.close(false);
        this.root.querySelector('[data-mobile-back]').hidden = this.host.plantTab === 'reactor';
        const parts = this.root.querySelector('[data-mobile-open="parts"]');
        const source = this.surfaces.get(`parts-${this.host.plantTab}`);
        if (source && !source.id) source.id = `mobile-${this.host.plantTab}-parts`;
        parts.hidden = !source || Boolean(source.dataset.mobileInline); parts.textContent = this.host.plantTab === 'computers' ? 'Units' : 'Parts';
        if (source) parts.setAttribute('aria-controls', source.id);
    }

    focusStation() {
        if (!this.active) return;
        const target = this.host.plantTab === 'reactor' ? this.root.querySelector('.diagram-viewport') : this.root.querySelector('[data-mobile-back]');
        target.focus({ preventScroll: true });
    }

    update() {
        if (!this.active) return;
        const sim = this.host.simulation;
        const state = sim.condition.meltdown ? 'MELTDOWN' : sim.tripped ? 'TRIPPED' : sim.running ? 'RUNNING' : 'STOPPED';
        const set = (selector, value) => { const node = this.root.querySelector(selector); if (node.textContent !== value) node.textContent = value; };
        set('[data-mobile-state]', state);
        set('[data-mobile-alarms]', sim.alarms.length ? `(${sim.alarms.length})` : '');
        set('[data-mobile-unread]', this.host.game?.career ? this.root.querySelector('.game-unread').textContent : '');
        this.root.querySelector('[data-mobile-open="company"]').disabled = Boolean(this.host.game?.attaching);
        const tab = this.host.plantTab, source = this.surfaces.get(`parts-${tab}`);
        const unavailable = tab === 'computers' ? this.host.computerConsole?.unavailable : this.host.equipmentStations?.unavailable.has(tab);
        if (source && unavailable && !source.dataset.mobileInline) {
            if (this.current === source) this.close(false);
            source.dataset.mobileInline = 'true'; source.removeAttribute('popover');
            source.setAttribute('role', 'navigation'); source.setAttribute('aria-modal', 'false');
            source.querySelector('.mobile-fallback-note').hidden = false;
            this.root.querySelector('[data-mobile-open="parts"]').hidden = true;
        }
    }
}
