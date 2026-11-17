/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { pumpDefinition } from './nuclear-power-pumps.js';

export const UI_SOUND_PROFILES = {
    computers: { on: 'click_004', off: 'click_005', adjust: 'click_002' },
    electrical: { on: 'switch_001', off: 'switch_002', adjust: 'click_003' },
    exchanger: { adjust: 'pluck_001' },
    turbine: { on: 'switch_003', off: 'switch_004', adjust: 'click_001' },
    condenser: { adjust: 'tick_004' },
    core: { adjust: 'tick_001' },
};
export const UI_SOUND_FILES = {
    on: '/audio/nuclear-power/kenney-ui/switch1.wav',
    off: '/audio/nuclear-power/kenney-ui/switch2.wav',
    adjust: '/audio/nuclear-power/kenney-ui/click1.wav',
    ...Object.fromEntries([...new Set(Object.values(UI_SOUND_PROFILES).flatMap(profile => Object.values(profile)))]
        .map(name => [name, `/audio/nuclear-power/kenney-interface/${name}.wav`])),
};

// Derive the sound from the control's equipment, including floating windows and
// companions. The currently selected desktop tab must not change another window.
export function uiSoundProfile(control) {
    const component = control.dataset.component || control.closest('[data-component-dialog]')?.dataset.componentDialog;
    if (pumpDefinition(component) || pumpDefinition(control.dataset.action) || control.closest('[data-pump-card]')) return 'pumps';
    if (['exchanger', 'turbine', 'condenser'].includes(component)) return component;
    if (control.closest('.computer-panel, .computer-dialog')) return 'computers';
    if (control.closest('.electrical-supply-dialog, .diesel-dialog, .auxiliary-controls, .power-source-panel')) return 'electrical';
    if (['insert', 'withdraw'].includes(control.dataset.action) || control.closest('.core-dialog, .individual-rod')) return 'core';
    return 'general';
}
