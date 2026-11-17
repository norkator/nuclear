/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { PUMPS, pumpDefinition, circuitPumps } from './nuclear-power-pumps.js';
import { COMPUTER_IDS } from './nuclear-power-computers-model.js';
import { WORK_NAMES } from './nuclear-power-work.js';

const kinds = ['pump-proof', 'diesel-proof', 'rack-diagnostics', 'grid-following', 'fuel-selective', 'pump-recovery'];
export const isOperationsObjective = objective => kinds.includes(objective.kind);
const bounded = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const counter = n => Number.isSafeInteger(n) && n >= 0;
const stopped = (sim, id) => !sim[id] && sim.components.items[id].actual.speed < .5 && sim.components.items[id].actual.flow < .5;
const pumpReady = (sim, id) => {
    const actual = sim.components.items[id].actual;
    return sim[id] && actual.speed >= 20 && actual.flow >= 20 && actual.pressure <= 145;
};
export function healthyOperation(sim) {
    return !sim.tripped && !sim.condition.meltdown && sim.condition.fault === 'none'
        && !sim.components.hasFaults && !sim.condition.damaged && !sim.components.damaged
        && sim.temperature <= 335 && sim.condition.peakTemperature <= 410;
}
const generationReady = sim => healthyOperation(sim) && sim.running && sim.electricalOutput > 20 && sim.primaryFlow >= 20
    && sim.secondaryFlow >= 20 && sim.condition.coolingMargin > 0;

export function validOperationsObjective(objective) {
    switch (objective.kind) {
    case 'pump-proof': return Array.isArray(objective.equipment) && objective.equipment.length > 0
        && objective.equipment.every(id => PUMPS.some(pump => pump.id === id))
        && new Set(objective.equipment).size === objective.equipment.length
        && typeof objective.stopped === 'boolean' && typeof objective.restoreMain === 'boolean';
    case 'diesel-proof': case 'rack-diagnostics': return true;
    case 'grid-following': return bounded(objective.toleranceMw, 1, 30)
        && Number.isInteger(objective.requests) && bounded(objective.requests, 1, 100);
    case 'fuel-selective': return objective.count === 2 && bounded(objective.rate, 1, 120);
    case 'pump-recovery': return bounded(objective.warningSeconds, 30, 300);
    default: return false;
    }
}

// Hashing the random career UUID makes choices stable without a global RNG or
// rendering-dependent draw. Chosen identities are also pinned in saved evidence.
function selection(items, key) {
    let seed = 2166136261;
    for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    const remaining = [...items], result = [];
    while (remaining.length) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        result.push(remaining.splice(seed % remaining.length, 1)[0]);
    }
    return result;
}

export function createOperationsEvidence(assignment, sim, careerId) {
    const objective = assignment.definition.objective;
    if (objective.kind === 'pump-proof') return { proofs: Object.fromEntries(objective.equipment.map(id => [id, { held: 0, done: false }])) };
    if (objective.kind === 'diesel-proof') return { proofs: Object.fromEntries(sim.supply.generators.map(item => [item.id, { held: 0, done: false }])) };
    if (objective.kind === 'rack-diagnostics') return { baselineDiagnostics: sim.computers.diagnosticSequence };
    if (objective.kind === 'grid-following') return { baselineSequence: sim.gridDispatch.sequence, requestIds: [] };
    const key = `${careerId}:${assignment.definition.id}`;
    if (objective.kind === 'fuel-selective') return { targets: selection(sim.fuel.assemblies, key).slice(0, objective.count)
        .map(item => ({ id: item.id, replacements: item.replacements, depleted: item.remaining === 0, replaced: false })) };
    if (objective.kind === 'pump-recovery') {
        const candidates = ['pumpA', 'pumpB'].filter(id => {
            const backup = id === 'pumpA' ? 'pumpA2' : 'pumpB2';
            return sim.condition.components[pumpDefinition(backup).key].damage === 0 && !sim.work.current(backup);
        });
        const pump = selection(candidates.length ? candidates : ['pumpA', 'pumpB'], key)[0];
        return { pump, backup: pump === 'pumpA' ? 'pumpA2' : 'pumpB2', warned: 0, failedAt: null,
            baselineOrders: sim.work.sequence, backupHeld: 0, backupProven: false };
    }
    return null;
}

// These flags are derived runtime policy. Save only the assignment/request data;
// restore derives them before ticking. Free operation retains its old dispatcher.
export function syncOperations(assignment, sim) {
    sim.gridDispatch.exercise = assignment?.status === 'active' && assignment.definition.objective.kind === 'grid-following';
    sim.gridDispatch.manualRequests = sim.gridDispatch.exercise;
}

function restoredMains(assignment, sim) {
    const circuits = new Set(assignment.definition.objective.equipment.map(id => pumpDefinition(id).circuit));
    return [...circuits].every(circuit => {
        const pumps = circuitPumps(circuit);
        return pumpReady(sim, pumps[0].id) && stopped(sim, pumps[1].id);
    });
}
function recoveryOrder(assignment, sim) {
    const evidence = assignment.evidence;
    return evidence.failedAt === null ? null : sim.work.orders.find(order => order.equipment === evidence.pump
        && Number(order.id.slice(3)) > evidence.baselineOrders && order.createdAt >= evidence.failedAt);
}

export function operationsSteps(assignment, sim) {
    const objective = assignment.definition.objective, evidence = assignment.evidence;
    if (!evidence) return [];
    if (objective.kind === 'pump-proof') return [
        ...objective.equipment.map(id => ({ id, label: `Prove ${WORK_NAMES[id]} alone: ${Math.floor(evidence.proofs[id].held)} / ${objective.seconds} s${objective.stopped ? '; reactor stopped' : ''}`, done: evidence.proofs[id].done })),
        { id: 'configuration', label: 'Restore main-pump duty; backups OFF and stopped', done: !objective.restoreMain || restoredMains(assignment, sim) },
    ];
    if (objective.kind === 'diesel-proof') return [
        ...sim.supply.generators.map(item => ({ id: item.id, label: `Prove diesel ${item.id}: ${Math.floor(evidence.proofs[item.id].held)} / ${objective.seconds} running seconds`, done: evidence.proofs[item.id].done })),
        { id: 'configuration', label: 'Normal AC; both diesels stopped, standby armed and fuel at least 25%',
            done: ['EXTERNAL GRID', 'TURBINE GENERATOR'].includes(sim.supply.source) && sim.supply.generators.every(item => item.state === 'STANDBY' && item.automatic && item.fuel >= 25) },
    ];
    if (objective.kind === 'rack-diagnostics') return COMPUTER_IDS.map(id => ({ id,
        label: `Record new healthy online diagnostics: ${WORK_NAMES[id]}`,
        done: sim.computers.diagnostics.some(record => record.id === id && record.sequence > evidence.baselineDiagnostics && record.healthy) }));
    if (objective.kind === 'grid-following') {
        const request = sim.gridDispatch.lastRequest;
        return [
            { id: 'following', label: sim.autoMode ? 'Follow requests in Auto → Electrical output' : 'Follow read-only grid requests with Manual controls',
                done: sim.gridDispatch.enabled && sim.gridDispatch.readiness(sim).ready },
            { id: 'requests', label: `Serve different new requests: ${evidence.requestIds.length} / ${objective.requests}`, done: evidence.requestIds.length >= objective.requests },
            { id: 'output', label: request ? `${request.id}: actual output within ${objective.toleranceMw} MW of ${request.targetMw} MW` : 'Wait for a new Grid controller request',
                done: sim.gridDispatch.sequence > evidence.baselineSequence && Boolean(request) && Math.abs(sim.electricalOutput - request.targetMw) <= objective.toleranceMw },
            { id: 'condition', label: 'Keep circulation, equipment and cooling healthy', done: generationReady(sim) },
            { id: 'hold', label: `Accumulate ${objective.seconds / 60} qualifying minutes; outside limits pauses progress`, done: false },
        ];
    }
    if (objective.kind === 'fuel-selective') return evidence.targets.flatMap(item => [
        { id: `spent-${item.id}`, label: `Observe ${item.id} deplete (${objective.rate}× exposure during generation)`, done: item.depleted },
        { id: `replace-${item.id}`, label: `Stop, cool and manually replace depleted ${item.id}`, done: item.replaced },
    ]);
    if (objective.kind === 'pump-recovery') {
        const order = recoveryOrder(assignment, sim);
        return [
            { id: 'warning', label: `${WORK_NAMES[evidence.pump]} bearing warning: ${Math.floor(evidence.warned)} / ${objective.warningSeconds} eligible seconds`, done: evidence.failedAt !== null },
            { id: 'backup', label: `Prove ${WORK_NAMES[evidence.backup]} for 10 s with the failed pump OFF`, done: evidence.backupProven },
            { id: 'service', label: `Complete a new ${WORK_NAMES[evidence.pump]} order after failure: isolate, service, test and return`, done: order?.status === 'completed' },
            { id: 'configuration', label: 'Restart explicitly; restore main-pump duty and stop its backup',
                done: sim.startSequence > assignment.baselineStarts && pumpReady(sim, evidence.pump) && stopped(sim, evidence.backup) && generationReady(sim) },
            { id: 'hold', label: `Accumulate ${objective.seconds} healthy seconds of actual generation after recovery`, done: false },
        ];
    }
    return [];
}

export function advanceOperations(assignment, sim, dt, notify) {
    const objective = assignment.definition.objective, evidence = assignment.evidence;
    if (objective.kind === 'pump-proof' || objective.kind === 'diesel-proof') {
        for (const [id, proof] of Object.entries(evidence.proofs)) {
            if (proof.done) continue;
            const met = objective.kind === 'pump-proof' ? healthyOperation(sim) && (!objective.stopped || !sim.running)
                && pumpReady(sim, id) && circuitPumps(pumpDefinition(id).circuit).filter(pump => pump.id !== id).every(pump => stopped(sim, pump.id))
                : sim.supply.generators.some(item => item.id === id && item.state === 'RUNNING' && item.fuel > 0);
            proof.held = met ? Math.min(objective.seconds, proof.held + dt) : 0;
            proof.done = proof.held >= objective.seconds;
        }
    } else if (objective.kind === 'fuel-selective') {
        for (const target of evidence.targets) {
            const assembly = sim.fuel.assemblies.find(item => item.id === target.id);
            if (!target.depleted) {
                sim.fuel.advanceAssembly(sim, assembly, dt, Math.max(0, objective.rate - sim.fuel.rate));
                if (assembly.remaining === 0) { target.depleted = true; target.replacements = assembly.replacements; }
            }
            if (target.depleted && assembly.replacements > target.replacements) target.replaced = true;
        }
    } else if (objective.kind === 'pump-recovery') {
        if (evidence.failedAt === null) {
            const backup = pumpDefinition(evidence.backup);
            const eligible = generationReady(sim) && pumpReady(sim, evidence.pump) && !sim.work.orders.some(order => order.status !== 'completed')
                && sim.condition.components[backup.key].damage === 0 && !sim.components.items[evidence.backup].disturbance.progressiveFault;
            if (eligible) evidence.warned = Math.min(objective.warningSeconds, evidence.warned + dt);
            if (evidence.warned >= objective.warningSeconds && eligible) {
                const state = sim.condition.components[pumpDefinition(evidence.pump).key];
                state.parts.bearings = 100; state.damage = 100;
                evidence.failedAt = sim.elapsed; evidence.baselineOrders = sim.work.sequence;
                sim.condition.beginIncident(sim, `Warned bearing failure: ${evidence.pump}`);
                sim.components.maintenanceNote(evidence.pump, 'Warned bearing failed; backup and explicit cooled work order required');
                sim.record(`${WORK_NAMES[evidence.pump]} bearing failed. Enable its backup and prepare a cooled repair window.`, 'alarm', 'alarm');
                notify('failure', 'Bearing failure confirmed', `${WORK_NAMES[evidence.pump]} has failed. Enable ${WORK_NAMES[evidence.backup]}, stop the failed pump and establish cooling. Stop and cool before the new work order; no automatic restart or repair occurs.`);
            }
        }
        if (evidence.failedAt !== null && !evidence.backupProven) {
            evidence.backupHeld = pumpReady(sim, evidence.backup) && stopped(sim, evidence.pump) ? Math.min(10, evidence.backupHeld + dt) : 0;
            evidence.backupProven = evidence.backupHeld >= 10;
        }
    }
    const steps = operationsSteps(assignment, sim).filter(step => step.id !== 'hold');
    const met = steps.every(step => step.done);
    if (objective.kind === 'grid-following') {
        // Different requests count only after actual delivery, never a target edit.
        const qualifying = steps.filter(step => step.id !== 'requests').every(step => step.done);
        if (qualifying) {
            const id = sim.gridDispatch.lastRequest.id;
            if (!evidence.requestIds.includes(id) && evidence.requestIds.length < objective.requests) evidence.requestIds.push(id);
            assignment.held = Math.min(objective.seconds, assignment.held + dt);
        }
        return { ready: assignment.held >= objective.seconds && evidence.requestIds.length >= objective.requests,
            reason: qualifying ? 'Following actual grid demand. Qualifying time accumulates; Pause freezes progress.' : steps.find(step => step.id !== 'requests' && !step.done)?.label };
    }
    if (objective.kind === 'pump-recovery') assignment.held = met ? Math.min(objective.seconds, assignment.held + dt) : assignment.held;
    else assignment.held = met ? objective.seconds : 0;
    return { ready: met && assignment.held >= objective.seconds,
        reason: met ? 'Actual work verified.' : steps.find(step => !step.done)?.label };
}

export function validateOperationsEvidence(assignment, plant) {
    const objective = assignment.definition.objective, e = assignment.evidence;
    if (!isOperationsObjective(objective)) return e === null;
    if (assignment.status === 'assigned') return e === null;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
    if (['pump-proof', 'diesel-proof'].includes(objective.kind)) {
        const ids = objective.kind === 'pump-proof' ? objective.equipment : plant.supply.generators.map(item => item.id);
        return e.proofs && Object.keys(e.proofs).length === ids.length && ids.every(id => e.proofs[id]
            && bounded(e.proofs[id].held, 0, objective.seconds) && typeof e.proofs[id].done === 'boolean'
            && e.proofs[id].done === (e.proofs[id].held === objective.seconds));
    }
    if (objective.kind === 'rack-diagnostics') return counter(e.baselineDiagnostics) && e.baselineDiagnostics <= plant.computers.diagnosticSequence;
    if (objective.kind === 'grid-following') return counter(e.baselineSequence) && e.baselineSequence <= plant.gridDispatch.sequence
        && Array.isArray(e.requestIds) && e.requestIds.length <= objective.requests && new Set(e.requestIds).size === e.requestIds.length
        && e.requestIds.every(id => typeof id === 'string' && /^GC-\d+$/.test(id)
            && Number(id.slice(3)) > e.baselineSequence && Number(id.slice(3)) <= plant.gridDispatch.sequence);
    if (objective.kind === 'fuel-selective') return Array.isArray(e.targets) && e.targets.length === objective.count
        && new Set(e.targets.map(item => item.id)).size === objective.count && e.targets.every(target => {
            const assembly = plant.fuel.assemblies.find(item => item.id === target.id);
            return assembly && counter(target.replacements) && target.replacements <= assembly.replacements
                && typeof target.depleted === 'boolean' && typeof target.replaced === 'boolean'
                && (!target.replaced || target.depleted && assembly.replacements > target.replacements);
        });
    if (objective.kind === 'pump-recovery') return ['pumpA', 'pumpB'].includes(e.pump)
        && e.backup === (e.pump === 'pumpA' ? 'pumpA2' : 'pumpB2') && bounded(e.warned, 0, objective.warningSeconds)
        && (e.failedAt === null || bounded(e.failedAt, assignment.acceptedAt, plant.elapsed) && e.warned === objective.warningSeconds)
        && counter(e.baselineOrders) && e.baselineOrders <= plant.work.sequence && bounded(e.backupHeld, 0, 10)
        && typeof e.backupProven === 'boolean' && e.backupProven === (e.backupHeld === 10)
        && (!e.backupProven || e.failedAt !== null);
    return false;
}
