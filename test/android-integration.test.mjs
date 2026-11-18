/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { syncAndroidAssets } from '../scripts/sync-to-android.mjs';
import { exportTextFile, getAndroidBootstrap, showNativeToast } from '../src/platform/android-bridge.js';

function globalValue(t, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    });
}

function fixture(t) {
    const root = mkdtempSync(resolve(tmpdir(), 'nuclear-android-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = resolve(root, 'dist'), project = resolve(root, 'android');
    mkdirSync(resolve(source, 'reactor'), { recursive: true });
    mkdirSync(resolve(project, 'app/src/main/assets/nuclear'), { recursive: true });
    writeFileSync(resolve(source, 'reactor/index.html'), 'reactor');
    writeFileSync(resolve(source, 'favicon.svg'), '<svg/>');
    writeFileSync(resolve(project, 'app/src/main/AndroidManifest.xml'), '<manifest/>');
    return { source, project };
}

test('Android sync replaces its own bundle, drops stale files and preserves other native assets', t => {
    const options = fixture(t), assets = resolve(options.project, 'app/src/main/assets');
    writeFileSync(resolve(assets, 'native.txt'), 'keep');
    writeFileSync(resolve(assets, 'nuclear/old.js'), 'stale');
    const target = syncAndroidAssets(options);
    assert.equal(readFileSync(resolve(target, 'reactor/index.html'), 'utf8'), 'reactor');
    assert.equal(readFileSync(resolve(assets, 'native.txt'), 'utf8'), 'keep');
    assert.equal(existsSync(resolve(target, 'old.js')), false);
    syncAndroidAssets(options);
    assert.equal(readFileSync(resolve(target, 'favicon.svg'), 'utf8'), '<svg/>');
});

test('Android sync validates a complete build and target before touching existing assets', t => {
    const options = fixture(t), target = resolve(options.project, 'app/src/main/assets/nuclear');
    writeFileSync(resolve(target, 'retained'), 'old build');
    rmSync(resolve(options.source, 'reactor/index.html'));
    assert.throws(() => syncAndroidAssets(options), /Run npm run build/);
    assert.equal(readFileSync(resolve(target, 'retained'), 'utf8'), 'old build');
    writeFileSync(resolve(options.source, 'reactor/index.html'), 'reactor');
    rmSync(resolve(options.project, 'app/src/main/AndroidManifest.xml'));
    assert.throws(() => syncAndroidAssets(options), /Not an Android/);
    assert.equal(readFileSync(resolve(target, 'retained'), 'utf8'), 'old build');
});

test('Android sync refuses a linked target and leaves its destination intact', t => {
    const options = fixture(t), target = resolve(options.project, 'app/src/main/assets/nuclear');
    rmSync(target, { recursive: true });
    symlinkSync(options.source, target, 'dir');
    assert.throws(() => syncAndroidAssets(options), /symbolic-link/);
    assert.equal(readFileSync(resolve(options.source, 'reactor/index.html'), 'utf8'), 'reactor');
});

test('native bridge exports JSON and Unicode CSV through Android without browser blob downloads', t => {
    t.mock.method(globalThis, 'setTimeout', () => { throw new Error('No browser download cleanup in Android'); });
    const calls = [];
    globalValue(t, 'window', { AndroidBridge: {
        getBootstrapData: () => '{"platform":"android","bridgeVersion":1}',
        showToast: message => calls.push(message),
        saveTextFile: (...args) => calls.push(args),
    } });
    assert.equal(getAndroidBootstrap().platform, 'android');
    showNativeToast('Ready');
    exportTextFile('career.json', '{"schemaVersion":5}', 'application/json');
    exportTextFile('log.csv', '"PÖRSSIOHJAIN","reactor"\r\n', 'text/csv;charset=utf-8');
    assert.deepEqual(calls, ['Ready', ['career.json', 'application/json', '{"schemaVersion":5}'],
        ['log.csv', 'text/csv;charset=utf-8', '"PÖRSSIOHJAIN","reactor"\r\n']]);
});

test('browser exports retain download names, payload and delayed blob cleanup without a native bridge', t => {
    globalValue(t, 'window', {});
    const link = { click: t.mock.fn() };
    globalValue(t, 'document', { createElement: () => link });
    let blob, cleanup;
    t.mock.method(URL, 'createObjectURL', value => { blob = value; return 'blob:test'; });
    const revoke = t.mock.method(URL, 'revokeObjectURL', () => {});
    t.mock.method(globalThis, 'setTimeout', (fn, delay) => { cleanup = fn; assert.equal(delay, 1000); });
    exportTextFile('career.json', '{"test":true}', 'application/json');
    assert.equal(link.href, 'blob:test'); assert.equal(link.download, 'career.json');
    assert.equal(link.click.mock.callCount(), 1); assert.equal(blob.type, 'application/json');
    assert.equal(revoke.mock.callCount(), 0); cleanup();
    assert.equal(revoke.mock.calls[0].arguments[0], 'blob:test');
    assert.equal(getAndroidBootstrap(), null);
    globalThis.window = { AndroidBridge: { getBootstrapData: () => 'invalid' } };
    assert.equal(getAndroidBootstrap(), null);
});
