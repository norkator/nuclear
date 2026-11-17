/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Screen-local presentation only: no plant commands, preferences or saved fields.
export class ConsoleFullscreen {
    constructor(host) {
        this.host = host; this.document = host.ownerDocument;
        // Fullscreen the page so shadow-root drawers and top-layer inspections
        // remain available alongside the model, including after rotation.
        this.target = this.document.documentElement;
        this.tools = this.document.createElement('div'); this.tools.className = 'fullscreen-tools';
        this.button = this.document.createElement('button'); this.button.className = 'small-button';
        this.button.type = 'button'; this.button.dataset.fullscreenToggle = '';
        this.status = this.document.createElement('span'); this.status.className = 'fullscreen-status';
        this.status.setAttribute('role', 'status'); this.status.hidden = true;
        this.tools.append(this.button, this.status);
        host.shadowRoot.querySelector('.header-settings').append(this.tools);
        this.render();
    }

    get supported() { return this.document.fullscreenEnabled === true && typeof this.target.requestFullscreen === 'function'; }
    get active() { return this.document.fullscreenElement === this.target; }
    connect() {
        if (this.abort) return;
        this.abort = new AbortController(); const { signal } = this.abort;
        this.button.addEventListener('click', () => this.toggle(), { signal });
        this.document.addEventListener('fullscreenchange', () => {
            const changed = this.tools.dataset.active !== String(this.active);
            if (!this.active) this.owned = false;
            this.render();
            // Native fullscreen transitions can dismiss top-layer popovers.
            // Reconcile their inert/focus ownership as well as their appearance.
            if (changed && !this.pending?.cancelled) this.host.mobileLayout?.close();
        }, { signal });
        this.render();
    }
    render() {
        this.tools.dataset.active = String(this.active);
        this.button.textContent = this.active ? 'Exit full screen' : this.supported ? 'Full screen' : 'Full screen unavailable';
        this.button.setAttribute('aria-pressed', String(this.active));
        this.button.disabled = Boolean(this.pending) || !this.supported && !this.active;
        this.status.textContent = this.error || ''; this.status.hidden = !this.error;
    }
    async toggle() {
        if (this.pending) return;
        if (!this.active && !this.supported) { this.render(); return; }
        const operation = { entering: !this.active, cancelled: false };
        this.pending = operation; this.error = ''; this.render();
        try {
            // Call directly in the button's user gesture, before the first await.
            await (operation.entering ? this.target.requestFullscreen({ navigationUI: 'hide' }) : this.document.exitFullscreen());
            if (operation.cancelled) {
                if (operation.entering && this.active) await this.document.exitFullscreen();
                return;
            }
            this.owned = operation.entering && this.active;
            if (this.host.mobileLayout?.kind === 'more') this.host.mobileLayout.close();
        } catch {
            if (!operation.cancelled) this.error = operation.entering
                ? 'Full screen could not start. Try again or continue in the normal view.'
                : 'Full screen could not close. Use your browser’s exit control.';
        } finally {
            if (this.pending === operation) this.pending = null;
            if (this.abort) this.render();
        }
    }
    disconnect() {
        this.abort?.abort(); this.abort = null;
        if (this.pending) this.pending.cancelled = true;
        if (this.owned && !this.pending && this.active) {
            try { Promise.resolve(this.document.exitFullscreen()).catch(() => {}); } catch { /* Native exit may already be underway. */ }
        }
        this.owned = false;
    }
}
