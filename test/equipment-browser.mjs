/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Reuse the Chrome harness, running only the equipment and turbine scenarios.
process.env.NUCLEAR_BROWSER_FOCUS = 'equipment';
await import('./browser.mjs');
