/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Preserve existing pairing links without mounting the simulation on the landing
// page. Screen selection lives in the URL: reload stays there, Back returns here.
if (new URLSearchParams(location.search).get('screen') === 'companion') {
    location.replace(`/companion/${location.hash}`);
}
