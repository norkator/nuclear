/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Normalized visual heat rejection, not a new thermal calculation or MW reading.
// Use actual cooling capacity and circulation, including retained hot flow after Stop.
export function condenserHeatRejection(signals) {
    const { secondaryTemperature, secondaryFlow, condenserCoolingFactor, condenserInletTemperature } = signals;
    if (![secondaryTemperature, secondaryFlow, condenserCoolingFactor, condenserInletTemperature].every(Number.isFinite)) return 0;
    const heat = Math.max(0, secondaryTemperature - Math.max(45, condenserInletTemperature + 5)) / 140;
    const flow = Math.max(0, Math.min(1.35, secondaryFlow / 100));
    const cooling = Math.max(0, Math.min(1, condenserCoolingFactor));
    return Math.min(1, heat * flow * cooling);
}
