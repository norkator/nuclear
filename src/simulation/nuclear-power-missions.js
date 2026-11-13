/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Stable content IDs and saved objective terms allow later missions to be inserted.
export const MISSION_CONTENT_VERSION = 1;
export const MISSIONS = [
    {
        id: 'startup.first-shift', version: 1, order: 10, requires: [], grants: ['commissioned'],
        title: 'First shift', sender: 'Elena Ward · Plant manager', achievement: 'First generation',
        brief: 'Welcome to Unit 01. Accept this assignment before starting. Turn off Follow requests, select Auto → Electrical output at 200 MW, then start at least one pump in each circuit. Wait for actual circulation before pressing reactor Start. Hold 200 ± 5 MW for 30 uninterrupted simulated seconds, with healthy cooling and no faults or damage. Report back when ready.',
        objective: { kind: 'generation-hold', seconds: 30, targetMw: 200, toleranceMw: 5, needsStart: true },
        completion: 'Unit 01 has demonstrated its first generation. Your next assignment is to prove reliable operation.',
    },
    {
        id: 'operation.reliable-five', version: 1, order: 20, requires: ['commissioned'], grants: ['reliable-operation'],
        title: 'Prove reliable operation', sender: 'Elena Ward · Plant manager', achievement: 'Five reliable minutes',
        brief: 'Keep Unit 01 at 200 ± 5 gross MW for five uninterrupted simulated minutes. Leave Follow requests off during this commissioning test. Maintain both coolant circuits, positive cooling margin, and fault-free equipment. A stop, trip or operating-envelope violation restarts the hold. Pause freezes the clock. Send your report after verification.',
        objective: { kind: 'generation-hold', seconds: 300, targetMw: 200, toleranceMw: 5, needsStart: false },
        completion: 'Reliable operation verified. Commissioning is complete. Keep this career: further company assignments can arrive with future updates.',
    },
];

export function validateMissionCatalogue(catalogue) {
    const ids = new Set();
    for (const mission of catalogue) {
        if (!mission.id || ids.has(mission.id) || mission.objective?.kind !== 'generation-hold'
            || !(mission.objective.seconds > 0) || !Array.isArray(mission.requires) || !Array.isArray(mission.grants)) {
            throw new Error('Invalid or duplicate mission definition');
        }
        ids.add(mission.id);
    }
    const reachable = new Set(), remaining = [...catalogue];
    while (remaining.length) {
        const index = remaining.findIndex(mission => mission.requires.every(capability => reachable.has(capability)));
        if (index < 0) throw new Error('Mission prerequisites are missing or cyclic');
        for (const capability of remaining.splice(index, 1)[0].grants) reachable.add(capability);
    }
}

function generationHoldConditions(assignment, sim) {
    const objective = assignment.definition.objective;
    return {
        start: !objective.needsStart || sim.startSequence > assignment.baselineStarts,
        running: sim.running && !sim.tripped && !sim.condition.meltdown,
        regulation: sim.autoMode && sim.autoObjective === 'power' && sim.autoElectricalTarget === objective.targetMw,
        following: !sim.gridDispatch.enabled,
        circulation: sim.primaryFlow >= 20 && sim.secondaryFlow >= 20,
        equipment: sim.condition.fault === 'none' && !sim.components.hasFaults && !sim.condition.damaged && !sim.components.damaged,
        cooling: sim.temperature <= 335 && sim.condition.peakTemperature <= 410 && sim.condition.coolingMargin > 0,
        output: Math.abs(sim.electricalOutput - objective.targetMw) <= objective.toleranceMw,
    };
}

// Display-only steps use the issued terms and the same readings as verification.
// Nothing is added to the saved assignment or advanced by rendering this list.
export function assignmentSteps(assignment, sim) {
    if (!assignment || !['active', 'ready', 'completed'].includes(assignment.status)) return [];
    const objective = assignment.definition.objective;
    const checks = generationHoldConditions(assignment, sim);
    const verified = assignment.status === 'ready' || assignment.status === 'completed';
    return [
        { id: 'regulation', label: `Auto → Electrical output: ${objective.targetMw} MW; Follow requests off`, done: checks.regulation && checks.following },
        { id: 'circulation', label: 'Establish flow in both coolant circuits', done: checks.circulation },
        { id: 'start', label: objective.needsStart ? 'Start the reactor after accepting' : 'Keep the reactor running', done: checks.start && checks.running },
        { id: 'condition', label: 'Keep cooling and equipment healthy', done: checks.equipment && checks.cooling && checks.circulation },
        { id: 'hold', label: `Hold ${objective.targetMw} ± ${objective.toleranceMw} MW for ${objective.seconds < 60 ? `${objective.seconds} s` : `${objective.seconds / 60} min`}`, done: false },
    ].map(step => ({ ...step, done: verified || step.done }));
}

export class CompanyCareer {
    constructor(state = null, catalogue = MISSIONS) {
        validateMissionCatalogue(catalogue);
        this.catalogue = catalogue;
        this.state = state ? structuredClone(state) : {
            id: globalThis.crypto.randomUUID(), contentVersion: MISSION_CONTENT_VERSION,
            assignments: [], messages: [], achievements: [], capabilities: [], lastElapsed: 0,
        };
        this.reconcile();
    }

    get current() { return this.state.assignments.find(item => ['assigned', 'active', 'ready'].includes(item.status)); }

    message(id, subject, body, sender, time, missionId = null) {
        if (this.state.messages.some(item => item.id === id)) return;
        this.state.messages.push({ id, subject, body, sender, time, missionId, read: false });
    }

    reconcile() {
        // An issued assignment carries its own definition, even if removed or edited later.
        if (this.current) return;
        const next = [...this.catalogue].sort((a, b) => a.order - b.order).find(definition =>
            !this.state.assignments.some(item => item.definition.id === definition.id)
            && definition.requires.every(capability => this.state.capabilities.includes(capability)));
        if (!next) return;
        const assignment = { definition: structuredClone(next), status: 'assigned', held: 0,
            issuedAt: this.state.lastElapsed, acceptedAt: null, completedAt: null,
            baselineStarts: 0, reason: 'Read the manager’s brief and accept the assignment.' };
        this.state.assignments.push(assignment);
        this.message(`assignment:${next.id}`, next.title, next.brief, next.sender, assignment.issuedAt, next.id);
    }

    accept(sim) {
        const assignment = this.current;
        if (!assignment || assignment.status !== 'assigned') return false;
        assignment.status = 'active';
        assignment.acceptedAt = sim.elapsed;
        assignment.baselineStarts = sim.startSequence;
        this.state.lastElapsed = sim.elapsed;
        assignment.reason = 'Waiting for the assignment’s operating conditions.';
        return true;
    }

    advance(sim) {
        const dt = Math.max(0, Math.min(1, sim.elapsed - this.state.lastElapsed));
        this.state.lastElapsed = sim.elapsed;
        const assignment = this.current;
        if (!assignment || assignment.status !== 'active' || dt === 0) return false;
        const objective = assignment.definition.objective;
        const checks = generationHoldConditions(assignment, sim);
        let reason = '';
        if (!checks.start) reason = 'Explicitly start the reactor after accepting this assignment.';
        else if (!checks.running) reason = 'Reactor must be running without a trip.';
        else if (!checks.regulation) reason = `Select Auto → Electrical output at ${objective.targetMw} MW.`;
        else if (!checks.following) reason = 'Turn off Follow requests for this fixed-output test.';
        else if (!checks.equipment) reason = 'Clear active faults and repair retained damage.';
        else if (!checks.cooling || !checks.circulation) reason = 'Restore circulation and healthy cooling.';
        else if (!checks.output) reason = `Waiting for actual output within ${objective.targetMw} ± ${objective.toleranceMw} MW.`;
        assignment.held = reason ? 0 : Math.min(objective.seconds, assignment.held + dt);
        assignment.reason = reason || 'Holding stable generation. Pause freezes this timer.';
        if (assignment.held < objective.seconds) return false;
        assignment.status = 'ready';
        assignment.verifiedAt = sim.elapsed;
        assignment.reason = 'Verified. Send your report to the plant manager.';
        this.message(`verified:${assignment.definition.id}`, `Ready to report: ${assignment.definition.title}`,
            'The operating criteria have been verified. Open Assignments and send your report.',
            'Unit 01 · Shift records', sim.elapsed, assignment.definition.id);
        return true;
    }

    report(sim) {
        const assignment = this.current;
        if (!assignment || assignment.status !== 'ready') return false;
        assignment.status = 'completed';
        assignment.completedAt = sim.elapsed;
        for (const capability of assignment.definition.grants) {
            if (!this.state.capabilities.includes(capability)) this.state.capabilities.push(capability);
        }
        if (!this.state.achievements.some(item => item.id === assignment.definition.id)) {
            this.state.achievements.push({ id: assignment.definition.id, title: assignment.definition.achievement,
                time: sim.elapsed, version: assignment.definition.version, heldSeconds: assignment.held });
        }
        this.message(`report:${assignment.definition.id}`, `Report accepted: ${assignment.definition.title}`,
            assignment.definition.completion, assignment.definition.sender, sim.elapsed, assignment.definition.id);
        this.state.lastElapsed = sim.elapsed;
        this.reconcile();
        return true;
    }
}
