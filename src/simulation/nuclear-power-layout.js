/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
const STORAGE_KEY = 'porssiohjain.nuclear-power.panels';
const panels = { instruments: 'plant-instruments', analysis: 'plant-analysis' };

export const layoutControls = `<nav class="workspace-tools" aria-label="Workspace panels"><button class="panel-edge-button" data-workspace-panel="instruments" aria-controls="plant-instruments" aria-expanded="true" aria-label="Show plant instruments" title="Show plant instruments"><span aria-hidden="true">›</span></button><button class="panel-edge-button" data-workspace-panel="analysis" aria-controls="plant-analysis" aria-expanded="true" aria-label="Show trends and events" title="Show trends and events"><span aria-hidden="true">‹</span></button></nav>`;

export function initializeDesktopLayout(host) {
    if (host.companion) return;
    const root = host.shadowRoot;
    let preferences = {};
    try { preferences = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Layout also works without storage. */ }
    if (typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
    const apply = (name, open, persist = true) => {
        const panel = root.getElementById(panels[name]);
        const button = root.querySelector(`.workspace-tools [data-workspace-panel="${name}"]`);
        const wide = host.clientWidth >= 1400;
        const animate = persist && wide && !host.reducedMotion.matches;
        const restoreFocus = panel.contains(root.activeElement);
        const focusPanel = wide && open && root.activeElement === button;
        if (open) panel.hidden = false;
        // Establish the closed pose before revealing an entering panel. The
        // fixed-width contents slide while the grid gives space to the model.
        if (animate) getComputedStyle(panel).transform;
        root.querySelector('.console-layout').dataset[name] = open ? 'open' : 'closed';
        button.setAttribute('aria-expanded', String(open));
        const label = `${open ? 'Hide' : 'Show'} ${name === 'instruments' ? 'plant instruments' : 'trends and events'}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        if (!open && restoreFocus) button.focus({ preventScroll: true });
        panel.inert = !open;
        panel.setAttribute('aria-hidden', String(!open));
        if (!open && (!animate || !panel.getAnimations().length)) panel.hidden = true;
        if (focusPanel) panel.querySelector('.side-panel-heading button').focus({ preventScroll: true });
        preferences[name] = open;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Keep the current layout in memory. */ }
        }
    };
    for (const [name, id] of Object.entries(panels)) {
        const heading = document.createElement('div');
        heading.className = 'side-panel-heading';
        heading.innerHTML = `<span>${name === 'instruments' ? 'Plant instruments' : 'Trends &amp; events'}</span><button class="small-button" data-workspace-panel="${name}" aria-label="Hide ${name === 'instruments' ? 'instruments' : 'trends and events'}">×</button>`;
        root.getElementById(id).prepend(heading);
        apply(name, preferences[name] !== false, false);
    }
    host.finishWorkspacePanelTransitions = () => {
        for (const [name, id] of Object.entries(panels)) if (!preferences[name]) root.getElementById(id).hidden = true;
    };
    root.addEventListener('transitionend', event => {
        const name = Object.keys(panels).find(key => root.getElementById(panels[key]) === event.target);
        if (name && !preferences[name]) event.target.hidden = true;
    });
    root.addEventListener('click', event => {
        const name = event.target.closest('[data-workspace-panel]')?.dataset.workspacePanel;
        if (Object.hasOwn(panels, name)) apply(name, !preferences[name]);
    });
    root.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const name = Object.keys(panels).find(key => root.getElementById(panels[key]).contains(event.target));
        if (name) { event.preventDefault(); apply(name, false); }
    });
}
