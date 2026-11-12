/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// One absolute, illustrative temperature palette for SVG, WebGL and read-outs.
// Equal temperatures use equal colors, including hot return water after bypass.
const STOPS = [
    [20, [79, 174, 211]],
    [80, [95, 203, 187]],
    [160, [233, 193, 100]],
    [250, [239, 136, 76]],
    [335, [240, 90, 82]],
    [600, [197, 63, 97]],
];

export function temperatureColor(temperature) {
    if (!Number.isFinite(temperature)) return '#7b8b96';
    const value = Math.max(STOPS[0][0], Math.min(STOPS.at(-1)[0], temperature));
    const index = Math.max(1, STOPS.findIndex(([limit]) => value <= limit));
    const [low, a] = STOPS[index - 1];
    const [high, b] = STOPS[index];
    const fraction = (value - low) / (high - low);
    return '#' + a.map((channel, i) => Math.round(channel + (b[i] - channel) * fraction).toString(16).padStart(2, '0')).join('');
}

export function loopTemperatures(sim) {
    return {
        primaryHot: sim.temperature,
        primaryReturn: sim.returnTemperature,
        primaryBypass: sim.temperature,
        secondaryHot: sim.secondaryTemperature,
        secondaryExhaust: sim.secondaryTemperature,
        secondaryReturn: sim.secondaryReturnTemperature,
        condenserCooling: sim.components.items.condenser.actual.inletTemperature,
    };
}
