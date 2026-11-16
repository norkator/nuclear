/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { pumpDefinition } from './nuclear-power-pumps.js';

export const EQUIPMENT_STATIONS = [
    { id: 'electrical', title: 'Electrical grid', tag: 'AC-01', parts: [['grid', 'Grid transformer'], ['turbineFeed', 'Turbine auxiliary feed'], ['bus', 'Auxiliary AC bus'], ['dieselA', 'Backup diesel A'], ['dieselB', 'Backup diesel B']] },
    { id: 'pumps', title: 'Pumps', tag: 'CIRCULATION', parts: [['speed', 'Motor & impeller'], ['dischargeValve', 'Discharge valve'], ['trim', 'Speed trim']] },
    { id: 'exchanger', title: 'Heat exchanger', tag: 'HX-01', parts: [['bypass', 'Primary bypass'], ['secondaryValve', 'Secondary valve'], ['effectiveness', 'Tube bundle'], ['fouling', 'Tube deposits']] },
    { id: 'turbine', title: 'Turbine / generator', tag: 'TG-01', parts: [['admission', 'Steam admission'], ['governorResponse', 'Governor'], ['loadRamp', 'Load ramp'], ['generatorLoading', 'Generator loading']] },
    { id: 'condenser', title: 'Condenser', tag: 'C-01', parts: [['coolingValve', 'Cooling-water valve'], ['inletTemperature', 'Cooling-water inlet']] },
];

export function equipmentStation(id) {
    if (['grid', 'bus', 'turbineFeed'].includes(id)) return 'electrical';
    return pumpDefinition(id) ? 'pumps' : EQUIPMENT_STATIONS.some(station => station.id === id) ? id : null;
}
