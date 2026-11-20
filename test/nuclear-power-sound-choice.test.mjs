/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundChoice } from '../src/simulation/nuclear-power-sound-choice.js';

function fixture(t, bootstrap, enabled = false) {
    const dialog = new EventTarget();
    dialog.open = false; dialog.prompts = 0;
    dialog.showModal = () => { dialog.open = true; dialog.prompts++; };
    dialog.close = () => { dialog.open = false; };
    const host = { soundEnabled: enabled, simulation: { paused: false }, actions: [],
        shadowRoot: { append() {}, querySelector: () => dialog },
        act(action) { assert.equal(action, 'sound'); this.actions.push(action); this.soundEnabled = !this.soundEnabled; } };
    for (const [key, value] of Object.entries({
        document: { createElement: () => ({ content: {} }) },
        window: bootstrap === undefined ? {} : { AndroidBridge: { getBootstrapData: () => bootstrap } },
    })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
    }
    const choice = new SoundChoice(host);
    return { choice, host, dialog };
}

test('Android with automatic playback enables the existing audio path once without a prompt or Pause command', t => {
    const { choice, host, dialog } = fixture(t, '{"platform":"android","audioEnabledByDefault":true}');
    choice.connect();
    assert.equal(host.soundEnabled, true);
    assert.equal(host.simulation.paused, false);
    assert.equal(dialog.prompts, 0);
    assert.deepEqual(host.actions, ['sound']);
    choice.connect();
    assert.deepEqual(host.actions, ['sound'], 'Repeated connections cannot toggle enabled sound off');
});

test('Android reconnect retains a later mute instead of automatically enabling sound again', t => {
    const { choice, host, dialog } = fixture(t, '{"platform":"android","audioEnabledByDefault":true}');
    choice.connect(); host.act('sound'); choice.disconnect(); choice.connect();
    assert.equal(host.soundEnabled, false);
    assert.equal(dialog.prompts, 0);
    assert.deepEqual(host.actions, ['sound', 'sound']);
});

test('Android keeps an already enabled audio path without toggling or creating another context', t => {
    const { choice, host, dialog } = fixture(t, '{"platform":"android","audioEnabledByDefault":true}', true);
    choice.connect();
    assert.equal(host.soundEnabled, true);
    assert.equal(dialog.prompts, 0);
    assert.deepEqual(host.actions, []);
});

test('ordinary browsers, older wrappers and malformed native data still ask before enabling sound', async t => {
    for (const bootstrap of [undefined, 'invalid', 'null', '{"platform":"android"}',
        '{"platform":"android","audioEnabledByDefault":false}',
        '{"platform":"android","audioEnabledByDefault":"true"}',
        '{"platform":"other","audioEnabledByDefault":true}']) {
        await t.test(String(bootstrap), t => {
            const { choice, host, dialog } = fixture(t, bootstrap);
            choice.connect();
            assert.equal(dialog.open, true);
            assert.deepEqual(host.actions, []);
            choice.choose(false); choice.disconnect(); choice.connect();
            assert.equal(host.soundEnabled, false);
            assert.equal(dialog.open, false);
            assert.equal(dialog.prompts, 1, 'The question still appears just once per retained console');
        });
    }
});
