/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));

function inside(parent, child) {
    const path = relative(parent, child);
    return path === '' || !path.startsWith('..') && !isAbsolute(path);
}

export function syncAndroidAssets({ source = resolve(repository, 'dist'),
    project = process.env.NUCLEAR_ANDROID_PROJECT || resolve(repository, '../NuclearMobile') } = {}) {
    // Validate before creating or replacing anything in the Android project.
    for (const file of ['reactor/index.html', 'favicon.svg']) {
        if (!existsSync(resolve(source, file))) throw new Error(`Missing dist/${file}. Run npm run build first.`);
    }
    project = realpathSync(project);
    const main = resolve(project, 'app/src/main');
    if (!existsSync(resolve(main, 'AndroidManifest.xml')) || !inside(project, realpathSync(main))) {
        throw new Error(`Not an Android application project: ${project}`);
    }
    const assets = resolve(main, 'assets');
    if (existsSync(assets) && !inside(project, realpathSync(assets))) throw new Error('Android assets must stay inside the project.');
    const target = resolve(assets, 'nuclear');
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('Refusing to replace a symbolic-link asset directory.');
    source = realpathSync(source);
    if (inside(source, target) || inside(target, source)) throw new Error('Build source and Android target must be separate directories.');
    mkdirSync(dirname(target), { recursive: true });
    const staging = mkdtempSync(resolve(assets, '.nuclear-sync-'));
    const previous = resolve(staging, 'previous');
    try {
        cpSync(source, resolve(staging, 'next'), { recursive: true, dereference: true });
        if (existsSync(target)) renameSync(target, previous);
        try { renameSync(resolve(staging, 'next'), target); }
        catch (error) {
            if (existsSync(previous)) renameSync(previous, target);
            throw error;
        }
    } finally { rmSync(staging, { recursive: true, force: true }); }
    return target;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try { console.log(`Copied Nuclear UI to ${syncAndroidAssets()}`); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
