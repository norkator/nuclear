/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForChrome } from './chrome-startup.mjs';

function fixture(t, code, executable = process.execPath) {
    const profileDir = mkdtempSync(join(tmpdir(), 'nuclear-chrome-startup-'));
    const browser = spawn(executable, ['-e', code, profileDir]);
    t.after(async () => {
        if (browser.pid && browser.exitCode === null && browser.signalCode === null) {
            const closed = new Promise(resolve => browser.once('close', resolve));
            browser.kill('SIGKILL');
            await closed;
        }
        rmSync(profileDir, { recursive: true, force: true });
    });
    return { browser, profileDir };
}

test('Chrome readiness comes from the profile when the launcher produces no output', { timeout: 10000 }, async t => {
    const { browser, profileDir } = fixture(t, `
        const fs = require('node:fs');
        const file = require('node:path').join(process.argv[1], 'DevToolsActivePort');
        fs.writeFileSync(file, '43210\\n');
        setTimeout(() => fs.appendFileSync(file, '/devtools/browser/silent-chrome'), 150);
        setInterval(() => {}, 1000);
    `);
    assert.equal(await waitForChrome(browser, profileDir, { timeout: 5000 }), 'ws://127.0.0.1:43210/devtools/browser/silent-chrome');
});

for (const stream of ['stdout', 'stderr']) {
    test(`Chrome readiness also accepts a fragmented ${stream} announcement`, { timeout: 10000 }, async t => {
        const { browser, profileDir } = fixture(t, `
            process.${stream}.write('DevTools listening on ws://127.0.0.1:');
            setTimeout(() => process.${stream}.write('43211/devtools/browser/logged-chrome\\n'), 50);
            setInterval(() => {}, 1000);
        `);
        assert.equal(await waitForChrome(browser, profileDir, { timeout: 5000 }), 'ws://127.0.0.1:43211/devtools/browser/logged-chrome');
    });
}

test('an early Chrome exit reports its status, executable and both output streams', { timeout: 10000 }, async t => {
    const { browser, profileDir } = fixture(t, `
        require('node:fs').writeSync(1, 'launcher failed\\n');
        require('node:fs').writeSync(2, 'missing library\\n');
        process.exit(23);
    `);
    await assert.rejects(waitForChrome(browser, profileDir, { timeout: 5000 }), error => {
        assert.match(error.message, /Chrome exited before DevTools became ready \(code 23, signal none\)/);
        assert.ok(error.message.includes(process.execPath));
        assert.ok(error.message.includes(profileDir));
        assert.match(error.message, /stdout: launcher failed/);
        assert.match(error.message, /stderr: missing library/);
        return true;
    });
});

test('a missing Chrome executable fails immediately with the spawn error', { timeout: 10000 }, async t => {
    const { browser, profileDir } = fixture(t, '', join(tmpdir(), 'nonexistent-nuclear-chrome', 'chrome'));
    await assert.rejects(waitForChrome(browser, profileDir, { timeout: 5000 }), error => {
        assert.match(error.message, /Chrome could not start:.*ENOENT/);
        assert.equal(error.cause.code, 'ENOENT');
        return true;
    });
});

test('a silent hung Chrome has a bounded timeout with explicit empty-output diagnostics', { timeout: 10000 }, async t => {
    const { browser, profileDir } = fixture(t, 'setInterval(() => {}, 1000);');
    await assert.rejects(waitForChrome(browser, profileDir, { timeout: 150 }), error => {
        assert.match(error.message, /Chrome startup timeout after 150 ms/);
        assert.match(error.message, /stdout: \(empty\)/);
        assert.match(error.message, /stderr: \(empty\)/);
        return true;
    });
});
