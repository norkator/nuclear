/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraTouchZoom } from '../src/simulation/nuclear-power-touch-zoom.js';
import { ConsoleFullscreen } from '../src/simulation/nuclear-power-fullscreen.js';

class Element extends EventTarget {
    constructor(document) { super(); this.ownerDocument = document; this.dataset = {}; this.attributes = {}; this.captured = new Set(); }
    append(...nodes) { (this.children ||= []).push(...nodes); }
    setAttribute(name, value) { this.attributes[name] = value; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
}
function documentFixture() {
    const document = new EventTarget(); document.defaultView = new EventTarget();
    document.createElement = () => new Element(document);
    document.documentElement = new Element(document); document.fullscreenElement = null;
    document.fullscreenEnabled = true;
    document.documentElement.requestFullscreen = async () => { document.fullscreenElement = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); };
    document.exitFullscreen = async () => { document.fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); };
    return document;
}
function pointer(canvas, type, id, x, y = 0, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
    canvas.dispatchEvent(event); return event;
}
function zoomFixture() {
    const document = documentFixture(), canvas = new Element(document), abort = new AbortController();
    const state = { zoom: 1, cancelled: 0, enabled: true, singles: 0 };
    const gesture = new CameraTouchZoom(canvas, { signal: abort.signal, getZoom: () => state.zoom,
        setZoom: value => { state.zoom = Math.max(.7, Math.min(3, value)); },
        cancelDrag: () => state.cancelled++, enabled: () => state.enabled });
    canvas.addEventListener('pointerup', () => state.singles++);
    return { document, canvas, gesture, state, abort };
}

test('two touch pointers zoom the camera, suppress picking and preserve single-pointer behavior', () => {
    const { canvas, gesture, state } = zoomFixture();
    pointer(canvas, 'pointerdown', 1, 100); pointer(canvas, 'pointerup', 1, 100);
    assert.equal(state.singles, 1);
    pointer(canvas, 'pointerdown', 2, 100);
    const secondDown = pointer(canvas, 'pointerdown', 3, 200);
    assert.equal(secondDown.defaultPrevented, false, 'Camera input must not suppress the next native UI tap');
    assert.equal(gesture.active, true);
    pointer(canvas, 'pointermove', 3, 250); assert.equal(state.zoom, 1.5);
    pointer(canvas, 'pointermove', 3, 175); assert.equal(state.zoom, .75);
    pointer(canvas, 'pointerup', 3, 175);
    pointer(canvas, 'pointermove', 2, 50); assert.equal(state.zoom, .75, 'A remaining finger cannot jump into orbit');
    pointer(canvas, 'pointerup', 2, 50);
    assert.equal(state.singles, 1, 'No pointer release from the pinch reaches picking');
    const click = new Event('click', { cancelable: true }); Object.assign(click, { detail: 1, pointerType: 'touch' });
    canvas.dispatchEvent(click); assert.equal(click.defaultPrevented, true, 'Compatibility clicks cannot activate model labels after a pinch');
    assert.equal(gesture.active, false);
    pointer(canvas, 'pointerdown', 4, 100); pointer(canvas, 'pointerup', 4, 100);
    assert.equal(state.singles, 2, 'The next fresh tap works normally');
    pointer(canvas, 'pointerdown', 5, 100); pointer(canvas, 'pointerdown', 6, 200);
    pointer(canvas, 'pointerup', 5, 100); pointer(canvas, 'pointerup', 6, 200);
    const keyboardClick = new Event('click', { cancelable: true }); Object.assign(keyboardClick, { detail: 0 });
    canvas.dispatchEvent(keyboardClick); assert.equal(keyboardClick.defaultPrevented, false, 'Keyboard activation stays available');
    pointer(canvas, 'pointerdown', 7, 100, 0, 'mouse');
    const mouseClick = new Event('click', { cancelable: true }); Object.assign(mouseClick, { detail: 1, pointerType: 'mouse' });
    canvas.dispatchEvent(mouseClick); assert.equal(mouseClick.defaultPrevented, false, 'A new mouse gesture works after touching the screen');
});

test('pinch limits reverse smoothly and third fingers/cancellation do not jump the camera', () => {
    const { canvas, gesture, state } = zoomFixture();
    pointer(canvas, 'pointerdown', 1, 0); pointer(canvas, 'pointerdown', 2, 100);
    pointer(canvas, 'pointermove', 2, 500); assert.equal(state.zoom, 3);
    pointer(canvas, 'pointermove', 2, 250); assert.equal(state.zoom, 1.5);
    pointer(canvas, 'pointerdown', 3, 800);
    pointer(canvas, 'pointerup', 1, 0);
    pointer(canvas, 'pointermove', 3, 800); assert.equal(state.zoom, 1.5);
    pointer(canvas, 'pointercancel', 2, 250); pointer(canvas, 'pointerup', 3, 800);
    assert.equal(gesture.active, false); assert.equal(state.singles, 0);
});

test('resize, page hiding, scene suspension and detach clear touch state and pointer capture', () => {
    for (const trigger of ['resize', 'hide', 'scene', 'detach']) {
        const { canvas, gesture, state, document, abort } = zoomFixture();
        pointer(canvas, 'pointerdown', 1, 0); pointer(canvas, 'pointerdown', 2, 100);
        if (trigger === 'resize') document.defaultView.dispatchEvent(new Event('resize'));
        else if (trigger === 'hide') { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
        else if (trigger === 'scene') { state.enabled = false; gesture.reset(); }
        else abort.abort();
        assert.equal(gesture.points.size, 0); assert.equal(gesture.active, false); assert.equal(canvas.captured.size, 0);
        pointer(canvas, 'pointermove', 2, 300); assert.equal(state.zoom, 1);
    }
});

test('mouse and pen events do not enter touch zoom', () => {
    const { canvas, gesture, state } = zoomFixture();
    for (const type of ['mouse', 'pen']) {
        pointer(canvas, 'pointerdown', 1, 0, 0, type); pointer(canvas, 'pointerdown', 2, 100, 0, type);
        pointer(canvas, 'pointermove', 2, 200, 0, type);
    }
    assert.equal(gesture.points.size, 0); assert.equal(state.zoom, 1);
});

function fullscreenFixture() {
    const document = documentFixture(), parent = new Element(document);
    const host = { ownerDocument: document, shadowRoot: { querySelector: () => parent }, mobileLayout: { kind: 'more', close() { this.closed = true; } } };
    const control = new ConsoleFullscreen(host); control.connect();
    return { document, parent, host, control };
}

test('fullscreen requests immediately from the gesture and follows native enter and browser exit state', async () => {
    const { document, host, control } = fullscreenFixture();
    let called = false;
    const enter = document.documentElement.requestFullscreen;
    document.documentElement.requestFullscreen = options => { called = true; assert.equal(options.navigationUI, 'hide'); return enter(); };
    const pending = control.toggle(); assert.equal(called, true, 'There is no asynchronous step before the native request');
    await pending;
    assert.equal(control.button.textContent, 'Exit full screen'); assert.equal(control.button.attributes['aria-pressed'], 'true');
    assert.equal(host.mobileLayout.closed, true);
    await document.exitFullscreen();
    assert.equal(control.button.textContent, 'Full screen'); assert.equal(control.owned, false);
    await control.toggle(); await control.toggle(); assert.equal(document.fullscreenElement, null);
});

test('unsupported/rejected fullscreen stays usable and does not close the menu', async () => {
    const { document, host, control } = fullscreenFixture();
    document.fullscreenEnabled = false; control.render();
    assert.equal(control.button.disabled, true); assert.equal(control.button.textContent, 'Full screen unavailable');
    document.fullscreenEnabled = true;
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('Permission denied'));
    await control.toggle();
    assert.equal(control.button.disabled, false); assert.equal(control.status.hidden, false);
    assert.match(control.status.textContent, /could not start/); assert.equal(host.mobileLayout.closed, undefined);
    assert.equal(document.fullscreenElement, null);
});

test('detaching exits owned fullscreen and cleans up a late native entry without duplicate controls on reconnect', async () => {
    const { document, parent, control } = fullscreenFixture();
    await control.toggle(); control.disconnect(); await Promise.resolve();
    assert.equal(document.fullscreenElement, null);
    control.connect();
    let finish;
    document.documentElement.requestFullscreen = () => new Promise(resolve => { finish = () => { document.fullscreenElement = document.documentElement; resolve(); }; });
    const pending = control.toggle(); control.disconnect(); control.connect(); finish(); await pending;
    assert.equal(document.fullscreenElement, null, 'Late entry cannot leave a detached console in fullscreen');
    assert.equal(parent.children.length, 1); assert.equal(control.pending, null); assert.equal(control.button.disabled, false);
});
