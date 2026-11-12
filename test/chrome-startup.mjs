/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function waitForChrome(browser, profileDir, { timeout = 60000 } = {}) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        const activePortFile = join(profileDir, 'DevToolsActivePort');
        const finish = (error, endpoint) => {
            clearTimeout(deadline);
            clearInterval(poll);
            browser.off('error', onError);
            browser.off('close', onClose);
            browser.stdout.off('data', onStdout);
            browser.stderr.off('data', onStderr);
            // Keep draining Chrome's pipes after startup so logging cannot block it.
            browser.stdout.resume();
            browser.stderr.resume();
            if (error) reject(error);
            else resolve(endpoint);
        };
        const fail = (message, cause) => finish(new Error(
            `${message}\nCommand: ${browser.spawnargs.join(' ')}\nProfile: ${profileDir}` +
            `\nstdout: ${stdout.trim() || '(empty)'}\nstderr: ${stderr.trim() || '(empty)'}`,
            { cause },
        ));
        const fromOutput = output => {
            const match = output.match(/DevTools listening on (ws:\/\/\S+)\r?\n/);
            if (match) finish(null, match[1]);
        };
        const onStdout = chunk => { stdout = (stdout + chunk).slice(-8192); fromOutput(stdout); };
        const onStderr = chunk => { stderr = (stderr + chunk).slice(-8192); fromOutput(stderr); };
        const onError = error => fail(`Chrome could not start: ${error.message}`, error);
        const onClose = (code, signal) => fail(`Chrome exited before DevTools became ready (code ${code}, signal ${signal || 'none'})`);
        const fromProfile = () => {
            try {
                // Chrome writes this file with --remote-debugging-port=0 even when
                // its launcher redirects or suppresses the readiness log message.
                const [port, path] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
                if (/^\d+$/.test(port) && Number(port) > 0 && Number(port) <= 65535 && /^\/devtools\/browser\/\S+$/.test(path || '')) {
                    finish(null, `ws://127.0.0.1:${port}${path}`);
                }
            } catch (error) {
                if (error.code !== 'ENOENT') fail(`Could not read ${activePortFile}: ${error.message}`, error);
            }
        };
        const deadline = setTimeout(() => fail(`Chrome startup timeout after ${timeout} ms`), timeout);
        const poll = setInterval(fromProfile, 50);
        browser.stdout.on('data', onStdout);
        browser.stderr.on('data', onStderr);
        browser.once('error', onError);
        browser.once('close', onClose);
        fromProfile();
    });
}
