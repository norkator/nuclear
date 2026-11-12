/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { CORE_CHANNELS, NuclearPowerSimulation } from './nuclear-power-model.js';
import { FuelTransferAnimation } from './nuclear-power-refuelling.js';

export const CAREER_SAVE_VERSION = 1;
const ROOT_FIELDS = ['elapsed', 'startSequence', 'running', 'tripped', 'paused', 'demand', 'controlRods',
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

// Strict shape checking keeps truncated/newer/foreign saves away from class hydration.
function validateShape(value, template, path = 'save', depth = 0) {
    if (depth > 30) throw new Error('Save is too deeply nested.');
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

export function restoreCareerBundle(bundle) {
    if (!bundle || bundle.schemaVersion !== CAREER_SAVE_VERSION) throw new Error('Unsupported career save version.');
    validateData(bundle);
    const sim = new NuclearPowerSimulation(), transfer = new FuelTransferAnimation(CORE_CHANNELS);
    const template = captureCareer(sim, transfer, { state: {} });
    validateShape(bundle.plant, template.plant, 'plant');
    validateShape(bundle.transfer, template.transfer, 'transfer');
    const state = bundle.career;
    if (!state || typeof state.id !== 'string' || !Array.isArray(state.assignments) || !Array.isArray(state.messages)
        || !Array.isArray(state.achievements) || !Array.isArray(state.capabilities) || !Number.isFinite(state.lastElapsed)
        || state.assignments.length > 1000 || state.messages.length > 10000) throw new Error('Invalid company progress.');
    for (const assignment of state.assignments) {
        const definition = assignment.definition, objective = definition?.objective;
        if (!['assigned', 'active', 'ready', 'completed'].includes(assignment.status)
            || objective?.kind !== 'generation-hold' || !(objective.seconds > 0 && objective.seconds <= 86400)
            || !Number.isFinite(objective.targetMw) || objective.targetMw < 0 || objective.targetMw > 650
            || !Number.isFinite(objective.toleranceMw) || objective.toleranceMw < 0 || objective.toleranceMw > 650
            || !Number.isFinite(assignment.held) || assignment.held < 0 || assignment.held > objective.seconds
            || !Number.isFinite(assignment.baselineStarts) || typeof assignment.reason !== 'string'
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
