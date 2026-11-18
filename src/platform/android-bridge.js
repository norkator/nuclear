/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Optional native capabilities. Ordinary browsers retain their existing path.
export function getAndroidBridge() {
    return globalThis.window?.AndroidBridge;
}

export function getAndroidBootstrap() {
    try { return JSON.parse(getAndroidBridge()?.getBootstrapData?.() || 'null'); }
    catch { return null; }
}

export function showNativeToast(message) {
    getAndroidBridge()?.showToast?.(String(message));
}

export function exportTextFile(filename, contents, mimeType) {
    const bridge = getAndroidBridge();
    if (typeof bridge?.saveTextFile === 'function') {
        bridge.saveTextFile(filename, mimeType, contents);
        return;
    }
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
