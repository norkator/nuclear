/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { CORE_CHANNELS, NuclearPowerSimulation } from './nuclear-power-model.js';
import { FuelTransferAnimation } from './nuclear-power-refuelling.js';
import { validObjective } from './nuclear-power-missions.js';
import { MONITORED_EQUIPMENT, WORK_EQUIPMENT, WORK_TEST_SECONDS } from './nuclear-power-work.js';
import { PlantComputers, COMPUTER_IDS } from './nuclear-power-computers-model.js';

export const CAREER_SAVE_VERSION = 3;
const ROOT_FIELDS = ['elapsed', 'startSequence', 'running', 'tripped', 'paused', 'demand', 'controlRods', 'autoAllowed',
    'operatingRodTargets', 'power', 'temperature', 'returnTemperature', 'secondaryTemperature',
    'secondaryReturnTemperature', 'pumpA', 'pumpA2', 'pumpB', 'pumpB2', 'pumpASpeed', 'pumpA2Speed',
    'pumpBSpeed', 'pumpB2Speed', 'primaryFlow', 'secondaryFlow', 'autoMode', 'autoObjective',
    'autoElectricalTarget', 'regulationLimit', 'autoTemperature', 'autoFlow', 'fluctuationsEnabled',
    'controlIntegral', 'outputControlIntegral', 'lastControlTime', 'lastAutoLog', 'lastProcessLog', 'history', 'events', 'alarms'];
const SECTION_FIELDS = {
    condition: ['fuelTemperature', 'heatReserve', 'temperatureRate', 'coolingMargin', 'stage', 'fault',
        'faultAge', 'restriction', 'components', 'zones', 'meltdown', 'meltProgress', 'incident'],
    fuel: ['rate', 'assemblies', 'initialEffectiveness'],
    supply: ['gridAvailable', 'turbineConnected', 'generators', 'source', 'demand', 'capacity', 'factor'],
    hydraulics: ['branches', 'pipes'],
    components: ['items', 'maintenance', 'objective', 'scenario', 'rampActive', 'turbineIntegrity'],
    gridDispatch: ['enabled', 'remaining', 'sequence', 'lastRequest'],
    water: ['purificationEnabled', 'makeupEnabled', 'conductivity', 'filterLoad', 'intakeDebris', 'basinLevel',
        'purification', 'makeup', 'sampleSequence', 'samples'],
    work: ['sequence', 'inspectionSequence', 'inspections', 'orders'],
    computers: ['units', 'preferredServer', 'source', 'acAvailable', 'rackTemperature', 'charge',
        'batteryHealth', 'filterLoad', 'fanHealth', 'fanSpeed', 'diagnosticSequence', 'diagnostics'],
};
const TRANSFER_FIELDS = ['job', 'samples', 'nextSlot', 'poolTime', 'sampleSequence', 'dispatchHistory', 'dispatchedAssemblies'];
const pick = (source, fields) => Object.fromEntries(fields.map(key => [key, source[key]]));

function validateData(value, depth = 0) {
    if (depth > 30 || typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e12)
        || typeof value === 'string' && value.length > 100000) throw new Error('Invalid save data.');
    if (!value || typeof value !== 'object') return;
    if (Object.keys(value).length > 10000) throw new Error('Save collection is too large.');
    for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid save field.');
        validateData(item, depth + 1);
    }
}

export function captureCareer(sim, transfer, career) {
    const plant = pick(sim, ROOT_FIELDS);
    for (const [section, fields] of Object.entries(SECTION_FIELDS)) plant[section] = pick(sim[section], fields);
    return structuredClone({ schemaVersion: CAREER_SAVE_VERSION, career: career.state, plant,
        transfer: pick(transfer, TRANSFER_FIELDS) });
}

// Migrations only add newly introduced state. Existing heat, damage, rotor samples,
// objective terms, achievements and IDs are copied without being recalculated.
export function migrateCareerBundle(source) {
    if (!source || ![1, 2, CAREER_SAVE_VERSION].includes(source.schemaVersion)) throw new Error('Unsupported career save version.');
    validateData(source);
    const bundle = structuredClone(source);
    if (bundle.schemaVersion === 1) {
        if (!bundle.plant || !bundle.career || !Array.isArray(bundle.career.assignments)) throw new Error('Invalid legacy career.');
        const defaults = new NuclearPowerSimulation();
        bundle.plant.autoAllowed = true;
        for (const section of ['water', 'work']) bundle.plant[section] = pick(defaults[section], SECTION_FIELDS[section]);
        bundle.career.difficulty = 'easy';
        for (const assignment of bundle.career.assignments) {
            assignment.baselineInspections = 0; assignment.baselineOrders = 0; assignment.baselineSamples = 0;
        }
        bundle.schemaVersion = 2;
    }
    if (bundle.schemaVersion === 2) {
        if (!bundle.plant) throw new Error('Invalid legacy plant.');
        bundle.plant.computers = pick(new PlantComputers(), SECTION_FIELDS.computers);
        bundle.schemaVersion = 3;
    }
    return bundle;
}

const bounded = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const counter = value => Number.isSafeInteger(value) && value >= 0;
function validateMaintenance(plant) {
    const { water, work, elapsed } = plant;
    const waterRecord = record => record && bounded(record.conductivity, .2, 50)
        && ['filterLoad', 'intakeDebris', 'basinLevel'].every(key => bounded(record[key], 0, 100));
    if (!waterRecord(water) || !bounded(water.purification, 0, 1) || !bounded(water.makeup, 0, 1)
        || !counter(water.sampleSequence) || water.samples.length > 40
        || water.samples.some(sample => !waterRecord(sample) || !counter(sample.sequence) || sample.sequence < 1
            || sample.sequence > water.sampleSequence || !bounded(sample.time, 0, elapsed))
        || new Set(water.samples.map(sample => sample.sequence)).size !== water.samples.length) throw new Error('Invalid water-treatment records.');
    if (!counter(work.sequence) || !counter(work.inspectionSequence) || work.orders.length > 40 + WORK_EQUIPMENT.length
        || new Set(work.orders.map(order => order.id)).size !== work.orders.length) throw new Error('Invalid work-order records.');
    for (const [id, reading] of Object.entries(work.inspections)) {
        if (!MONITORED_EQUIPMENT.includes(id) || !reading || !counter(reading.sequence) || reading.sequence < 1
            || reading.sequence > work.inspectionSequence || !bounded(reading.time, 0, elapsed)
            || !['Normal', 'Watch trend', 'Service attention'].includes(reading.condition)
            || !['speed', 'flow', 'vibration', 'bearingTemperature', 'lubricant'].every(key => bounded(reading[key], 0, 1000))) throw new Error('Invalid condition inspection.');
    }
    for (const order of work.orders) {
        const statuses = ['planned', 'isolated', 'serviced', 'testing', 'ready', 'completed'];
        const stage = statuses.indexOf(order?.status), sequence = Number(order?.id?.slice(3));
        if (stage < 0 || !/^WO-[1-9]\d*$/.test(order.id) || !counter(sequence) || sequence > work.sequence
            || !WORK_EQUIPMENT.includes(order.equipment) || !bounded(order.createdAt, 0, elapsed)
            || !bounded(order.held, 0, WORK_TEST_SECONDS) || stage >= 4 && order.held !== WORK_TEST_SECONDS) throw new Error('Invalid work order.');
        let previous = order.createdAt;
        for (const [index, key] of ['isolatedAt', 'servicedAt', 'releasedAt', 'completedAt'].entries()) {
            const required = stage >= [1, 2, 3, 5][index];
            if (required ? !bounded(order[key], previous, elapsed) : order[key] !== null) throw new Error('Invalid work-order sequence.');
            if (required) previous = order[key];
        }
    }
    const open = work.orders.filter(order => order.status !== 'completed');
    if (new Set(open.map(order => order.equipment)).size !== open.length) throw new Error('Duplicate open work order.');
}

function validateComputers(plant) {
    const computer = plant.computers;
    if (!['serverA', 'serverB'].includes(computer.preferredServer) || !['AC', 'UPS', 'OFF'].includes(computer.source)
        || !['charge', 'batteryHealth', 'filterLoad', 'fanHealth', 'fanSpeed'].every(key => bounded(computer[key], 0, 100))
        || !bounded(computer.rackTemperature, 0, 200) || !counter(computer.diagnosticSequence)
        || Object.keys(computer.units).length !== COMPUTER_IDS.length || computer.diagnostics.length > 40) throw new Error('Invalid computer rack state.');
    for (const id of COMPUTER_IDS) {
        const unit = computer.units[id];
        if (!bounded(unit.temperature, 0, 200) || !bounded(unit.bootRemaining, 0, 5)
            || !bounded(unit.hours, 0, 1e12) || !counter(unit.services)
            || unit.online && (!unit.enabled || unit.fault)) throw new Error('Invalid computer unit.');
    }
    for (const record of computer.diagnostics) {
        if (!record || !COMPUTER_IDS.includes(record.id) || !counter(record.sequence) || record.sequence < 1
            || record.sequence > computer.diagnosticSequence || !bounded(record.time, 0, plant.elapsed)
            || !bounded(record.temperature, 0, 200) || !bounded(record.charge, 0, 100) || !bounded(record.airflow, 0, 1)
            || !['AC', 'UPS', 'OFF'].includes(record.source) || typeof record.healthy !== 'boolean'
            || typeof record.status !== 'string') throw new Error('Invalid computer diagnostics.');
    }
    if (new Set(computer.diagnostics.map(record => record.sequence)).size !== computer.diagnostics.length) throw new Error('Duplicate computer diagnostic.');
}

// Strict shape checking keeps truncated/newer/foreign saves away from class hydration.
function validateShape(value, template, path = 'save', depth = 0) {
    if (depth > 30) throw new Error('Save is too deeply nested.');
    // Manual/temperature-regulated trend samples have no electrical target.
    if (/^plant\.history\.\d+\.electricalTarget$/.test(path) && value === null) return;
    if (typeof template === 'number') {
        if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`Invalid ${path}.`);
    } else if (typeof template === 'string' || typeof template === 'boolean') {
        if (typeof value !== typeof template || (typeof value === 'string' && value.length > 100000)) throw new Error(`Invalid ${path}.`);
    } else if (Array.isArray(template)) {
        if (!Array.isArray(value) || value.length > 10000) throw new Error(`Invalid ${path}.`);
        if (template.length) {
            if (value.length !== template.length && !['history', 'events', 'alarms', 'maintenance', 'changes', 'fragments', 'dispatchHistory'].includes(path.split('.').at(-1))) throw new Error(`Invalid ${path} count.`);
            value.forEach((item, i) => validateShape(item, template[Math.min(i, template.length - 1)], `${path}.${i}`, depth + 1));
        }
    } else if (template && typeof template === 'object') {
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`Invalid ${path}.`);
        for (const key of Object.keys(template)) validateShape(value[key], template[key], `${path}.${key}`, depth + 1);
    }
}

export function restoreCareerBundle(source) {
    const bundle = migrateCareerBundle(source);
    const sim = new NuclearPowerSimulation(), transfer = new FuelTransferAnimation(CORE_CHANNELS);
    const template = captureCareer(sim, transfer, { state: {} });
    validateShape(bundle.plant, template.plant, 'plant');
    validateShape(bundle.transfer, template.transfer, 'transfer');
    validateMaintenance(bundle.plant);
    validateComputers(bundle.plant);
    const state = bundle.career;
    if (!state || typeof state.id !== 'string' || !Array.isArray(state.assignments) || !Array.isArray(state.messages)
        || !Array.isArray(state.achievements) || !Array.isArray(state.capabilities) || !Number.isFinite(state.lastElapsed)
        || state.assignments.length > 1000 || state.messages.length > 10000
        || !['easy', 'hard'].includes(state.difficulty)
        || bundle.plant.autoAllowed !== (state.difficulty === 'easy')
        || state.difficulty === 'hard' && bundle.plant.autoMode) throw new Error('Invalid company progress or difficulty.');
    for (const assignment of state.assignments) {
        const definition = assignment.definition, objective = definition?.objective;
        if (!['assigned', 'active', 'ready', 'completed'].includes(assignment.status)
            || !validObjective(objective)
            || !Number.isFinite(assignment.held) || assignment.held < 0 || assignment.held > objective.seconds
            || !counter(assignment.baselineStarts) || typeof assignment.reason !== 'string'
            || !['baselineInspections', 'baselineOrders', 'baselineSamples'].every(key => counter(assignment[key]))
            || assignment.baselineInspections > bundle.plant.work.inspectionSequence
            || assignment.baselineOrders > bundle.plant.work.sequence || assignment.baselineSamples > bundle.plant.water.sampleSequence
            || !['id', 'title', 'sender', 'brief', 'completion', 'achievement'].every(key => typeof definition[key] === 'string')
            || !Array.isArray(definition.grants) || !definition.grants.every(item => typeof item === 'string')) throw new Error('Invalid saved assignment.');
    }
    if (state.assignments.filter(item => item.status !== 'completed').length > 1
        || !state.capabilities.every(item => typeof item === 'string')
        || state.messages.some(item => !item || !['id', 'subject', 'body', 'sender'].every(key => typeof item[key] === 'string') || !Number.isFinite(item.time) || typeof item.read !== 'boolean')
        || state.achievements.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || !Number.isFinite(item.time) || !Number.isFinite(item.heldSeconds))) throw new Error('Invalid company records.');
    if (new Set(state.assignments.map(item => item.definition.id)).size !== state.assignments.length) throw new Error('Duplicate saved assignment.');
    Object.assign(sim, structuredClone(pick(bundle.plant, ROOT_FIELDS)));
    for (const [section, fields] of Object.entries(SECTION_FIELDS)) {
        for (const field of fields) {
            if (field !== 'turbineIntegrity') sim[section][field] = structuredClone(bundle.plant[section][field]);
        }
    }
    Object.assign(sim.components.turbineIntegrity, structuredClone(bundle.plant.components.turbineIntegrity));
    sim.components.items.turbine.integrity = sim.components.turbineIntegrity;
    sim.components.sim = sim;
    sim.condition.pipes = sim.hydraulics.pipes;
    Object.assign(transfer, structuredClone(pick(bundle.transfer, TRANSFER_FIELDS)));
    if (sim.elapsed < 0 || sim.startSequence < 0 || !sim.history.length || transfer.samples.length !== 35
        || sim.controlRods.some((rod, i) => rod.id !== template.plant.controlRods[i].id)
        || sim.fuel.assemblies.some((assembly, i) => assembly.id !== template.plant.fuel.assemblies[i].id)) throw new Error('Invalid plant identities or clock.');
    const fuelIds = new Set(sim.fuel.assemblies.map(item => item.id));
    const validBatch = batch => batch && typeof batch === 'object' && typeof batch.reference === 'string'
        && fuelIds.has(batch.id) && Number.isInteger(batch.count) && batch.count >= 1 && batch.count <= 49
        && Number.isInteger(batch.slotIndex) && batch.slotIndex >= 0 && batch.slotIndex < 35
        && Number.isFinite(batch.placedAt) && Number.isFinite(batch.readyAt) && batch.readyAt >= batch.placedAt;
    if (transfer.samples.some((batch, index) => batch !== null && (!validBatch(batch) || batch.slotIndex !== index))
        || transfer.dispatchHistory.some(batch => !validBatch(batch))
        || transfer.poolTime < 0 || !Number.isInteger(transfer.nextSlot) || transfer.nextSlot < 0 || transfer.nextSlot >= 35
        || transfer.job && (!fuelIds.has(transfer.job.id) || !Number.isInteger(transfer.job.slotIndex)
            || transfer.job.slotIndex < 0 || transfer.job.slotIndex >= 35 || !Number.isFinite(transfer.job.elapsed)
            || !Number.isFinite(transfer.job.x) || !Number.isFinite(transfer.job.z))) throw new Error('Invalid fuel transfer record.');
    return { simulation: sim, transfer, state: structuredClone(state) };
}

export class CareerStore {
    constructor(indexedDB = globalThis.indexedDB) { this.indexedDB = indexedDB; this.revision = 0; }

    async database() {
        if (!this.indexedDB) throw new Error('Local saves are unavailable. You can export a backup instead.');
        if (!this.connection) this.connection = new Promise((resolve, reject) => {
            const request = this.indexedDB.open('porssiohjain-nuclear-career', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('career');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Could not open the local career save.'));
        });
        return this.connection;
    }

    async load() {
        const database = await this.database();
        return new Promise((resolve, reject) => {
            const request = database.transaction('career').objectStore('career').get('current');
            request.onsuccess = () => { this.revision = request.result?.revision || 0; resolve(request.result?.bundle || null); };
            request.onerror = () => reject(new Error('Could not read the local career save.'));
        });
    }

    async write(bundle) {
        const database = await this.database(), expected = this.revision;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('career', 'readwrite'), store = transaction.objectStore('career');
            const current = store.get('current');
            current.onsuccess = () => {
                if ((current.result?.revision || 0) !== expected) { transaction.abort(); return; }
                if (current.result) store.put(current.result, 'previous');
                store.put({ revision: expected + 1, bundle }, 'current');
            };
            transaction.oncomplete = () => { this.revision = expected + 1; resolve(); };
            transaction.onabort = transaction.onerror = () => reject(new Error('Career was not saved. Another tab may have updated it; export your backup.'));
        });
    }
}
