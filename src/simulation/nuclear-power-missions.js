/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { MONITORED_EQUIPMENT, WORK_EQUIPMENT, WORK_NAMES } from './nuclear-power-work.js';
// Stable content IDs and saved objective terms allow later missions to be inserted.
export const MISSION_CONTENT_VERSION = 2;
export const MISSIONS = [
    {
        id: 'startup.first-shift', version: 2, order: 10, requires: [], grants: ['commissioned'],
        title: 'First shift', sender: 'Elena Ward · Plant manager', achievement: 'First generation',
        brief: 'Welcome to Unit 01. Accept before starting. Turn off Follow requests. In Auto, select Electrical output at 200 MW. In Manual, adjust load and pump speeds to reach the same actual output. Start at least one pump in each circuit, establish circulation, then press reactor Start. Qualify at 200 ± 5 MW for 30 seconds with healthy cooling and equipment. Auto requires a continuous hold; in Manual, time outside the requirements pauses progress. There is no failure deadline.',
        objective: { kind: 'generation-hold', seconds: 30, targetMw: 200, toleranceMw: 5, needsStart: true, manualAllowed: true },
        completion: 'Unit 01 has demonstrated its first generation. Your next assignment is to prove reliable operation.',
    },
    {
        id: 'operation.reliable-five', version: 2, order: 20, requires: ['commissioned'], grants: ['reliable-operation'],
        title: 'Prove reliable operation', sender: 'Elena Ward · Plant manager', achievement: 'Five reliable minutes',
        brief: 'Qualify at 200 ± 5 gross MW for five simulated minutes. Leave Follow requests off. Maintain circulation, positive cooling margin and healthy equipment. Auto requires five continuous minutes. In Manual, qualifying time accumulates and leaving the requirements pauses progress; no deadline can fail this assignment. Pause freezes all progress. Report after verification.',
        objective: { kind: 'generation-hold', seconds: 300, targetMw: 200, toleranceMw: 5, needsStart: false, manualAllowed: true },
        completion: 'Reliable operation verified. Maintenance now needs a condition survey of the pumps and turbine.',
    },
    {
        id: 'monitoring.condition-rounds', version: 1, order: 30, requires: ['reliable-operation'], grants: ['condition-survey'],
        title: 'Complete the condition rounds', sender: 'Marcus Lee · Maintenance lead', achievement: 'Eyes on the equipment',
        brief: 'Open Maintenance → Condition monitoring. Record an inspection of pumps A, A2, B and B2 and the turbine after accepting. Compare actual vibration, bearing temperature and lubricant condition. Idle backups can be inspected without starting them. A healthy inspection is valid: do not damage equipment to complete work. Resume the shift to verify your records.',
        objective: { kind: 'condition-rounds', seconds: 1, equipment: MONITORED_EQUIPMENT },
        completion: 'Condition survey received. Your next task is a planned pump service and functional test.',
    },
    {
        id: 'maintenance.planned-service', version: 1, order: 40, requires: ['condition-survey'], grants: ['work-order-qualified'],
        title: 'Service and prove pump A', sender: 'Marcus Lee · Maintenance lead', achievement: 'Released for service',
        brief: 'In Maintenance → Work orders, create a new Pump A order after accepting. Stop the reactor and cool with circulation before switching pump A OFF. Wait for actual motor and branch flow below 0.5%, then isolate, service and release for test. Start pump A explicitly and prove at least 20% actual speed/flow without overpressure for 10 continuous seconds. The reactor can stay stopped for this test. Return the verified order to service. Heat, fuel, hours and trips are preserved; service costs zero in this chapter.',
        objective: { kind: 'work-order', seconds: 1, equipment: 'pumpA' },
        completion: 'Pump A service and functional test accepted. Next, check water-treatment performance.',
    },
    {
        id: 'water.quality-check', version: 1, order: 50, requires: ['work-order-qualified'], grants: ['water-quality-qualified'],
        title: 'Verify water quality', sender: 'Amira Patel · Chemistry', achievement: 'Clean water, healthy plant',
        brief: 'Open Maintenance → Water treatment & cooling. Take a new sample after accepting. Demonstrate conductivity at most 2 µS/cm, filter load below 80%, intake debris at most 20% and basin level at least 25%. Enable purification and make-up supply, with actual AC-powered treatment above 50%, for 10 continuous seconds. Poor conductivity can gradually foul the exchanger; purification improves water, while retained fouling still needs cooled cleaning. These are fictional game limits.',
        objective: { kind: 'water-quality', seconds: 10 },
        completion: 'Water quality verified. Plan a purification-filter inspection and service next.',
    },
    {
        id: 'water.filter-service', version: 1, order: 60, requires: ['water-quality-qualified'], grants: ['filter-service-qualified'],
        title: 'Service the purification filter', sender: 'Amira Patel · Chemistry', achievement: 'Treatment restored',
        brief: 'Create a new Purification filter work order. With the reactor stopped and cooled, switch purification OFF and isolate the filter. Complete service, then release for test. Switch purification ON and prove 10 continuous seconds of powered treatment, good conductivity and a serviceable filter. Explicitly return the order to service. Healthy preventive service is permitted; a loaded filter is not required.',
        objective: { kind: 'work-order', seconds: 1, equipment: 'waterFilter' },
        completion: 'Purification filter returned to service. The cooling-water intake is due for its preventive inspection.',
    },
    {
        id: 'cooling.intake-service', version: 1, order: 70, requires: ['filter-service-qualified'], grants: ['cooling-service-qualified'],
        title: 'Inspect the cooling-water intake', sender: 'Marcus Lee · Maintenance lead', achievement: 'Heat rejection ready',
        brief: 'Create a new Cooling-water intake order. Stop and cool the reactor, switch all four pumps and make-up supply OFF, and wait for actual motor/flow coast-down. Isolate and clean the intake, then release for test. Restore make-up and at least one pump per circuit. Prove secondary flow at least 20%, cooling-water capacity at least 95% and actual make-up above 50% for 10 continuous seconds. Return the order to service. Never stop hot cooling just to reach an isolation check sooner.',
        objective: { kind: 'work-order', seconds: 1, equipment: 'intake' },
        completion: 'Cooling-water readiness verified. Return the unit to generation for the final operating proof.',
    },
    {
        id: 'operation.return-to-service', version: 1, order: 80, requires: ['cooling-service-qualified'], grants: ['maintenance-chapter-complete'],
        title: 'Return Unit 01 to generation', sender: 'Elena Ward · Plant manager', achievement: 'A complete maintenance shift',
        brief: 'After accepting, explicitly start the reactor and qualify at 200 ± 5 gross MW for 60 seconds with healthy equipment, cooling and water. Stop first if already running. Keep Follow requests off. Auto requires a continuous hold; Manual accumulates qualifying time without a failure deadline. All work orders must be returned to service. Report when verified.',
        objective: { kind: 'generation-hold', seconds: 60, targetMw: 200, toleranceMw: 5, needsStart: true, manualAllowed: true, needsWorkComplete: true },
        completion: 'Operations, condition rounds, planned service and water-treatment checks are complete. Your reports and plant are saved. Further assignments can extend this career.',
    },
];

export function validObjective(objective) {
    if (!objective || !Number.isFinite(objective.seconds) || objective.seconds <= 0 || objective.seconds > 86400) return false;
    if (objective.kind === 'generation-hold') return Number.isFinite(objective.targetMw) && objective.targetMw >= 0 && objective.targetMw <= 650
        && Number.isFinite(objective.toleranceMw) && objective.toleranceMw >= 0 && objective.toleranceMw <= 650
        && typeof objective.needsStart === 'boolean' && (objective.manualAllowed === undefined || typeof objective.manualAllowed === 'boolean')
        && (objective.manualOnly === undefined || typeof objective.manualOnly === 'boolean')
        && (!objective.manualOnly || objective.manualAllowed === true)
        && (objective.needsWorkComplete === undefined || typeof objective.needsWorkComplete === 'boolean');
    if (objective.kind === 'condition-rounds') return Array.isArray(objective.equipment) && objective.equipment.length > 0
        && new Set(objective.equipment).size === objective.equipment.length && objective.equipment.every(id => MONITORED_EQUIPMENT.includes(id));
    if (objective.kind === 'work-order') return WORK_EQUIPMENT.includes(objective.equipment);
    return objective.kind === 'water-quality';
}

export function validateMissionCatalogue(catalogue) {
    const ids = new Set();
    for (const mission of catalogue) {
        if (!mission.id || ids.has(mission.id) || !validObjective(mission.objective)
            || !Array.isArray(mission.requires) || !Array.isArray(mission.grants)) {
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
        regulation: sim.autoMode ? sim.computers.automationAvailable && !objective.manualOnly && sim.autoObjective === 'power' && sim.autoElectricalTarget === objective.targetMw
            : objective.manualAllowed === true,
        following: !sim.gridDispatch.enabled,
        circulation: sim.primaryFlow >= 20 && sim.secondaryFlow >= 20,
        equipment: sim.condition.fault === 'none' && !sim.components.hasFaults && !sim.condition.damaged && !sim.components.damaged
            && (!objective.needsWorkComplete || sim.water.healthy && sim.work.orders.every(order => order.status === 'completed')),
        cooling: sim.temperature <= 335 && sim.condition.peakTemperature <= 410 && sim.condition.coolingMargin > 0,
        output: Math.abs(sim.electricalOutput - objective.targetMw) <= objective.toleranceMw,
    };
}

// Display-only steps use the issued terms and the same readings as verification.
// Nothing is added to the saved assignment or advanced by rendering this list.
export function assignmentSteps(assignment, sim) {
    if (!assignment || !['active', 'ready', 'completed'].includes(assignment.status)) return [];
    const objective = assignment.definition.objective;
    const verified = assignment.status === 'ready' || assignment.status === 'completed';
    if (objective.kind !== 'generation-hold') return maintenanceSteps(assignment, sim).map(step => ({ ...step, done: verified || step.done }));
    const checks = generationHoldConditions(assignment, sim);
    return [
        { id: 'regulation', label: `${objective.manualOnly ? 'Manual operation' : objective.manualAllowed ? 'Auto or Manual' : 'Auto → Electrical output'}: ${objective.targetMw} MW; Follow requests off`, done: checks.regulation && checks.following },
        { id: 'circulation', label: 'Establish flow in both coolant circuits', done: checks.circulation },
        { id: 'start', label: objective.needsStart ? 'Start the reactor after accepting' : 'Keep the reactor running', done: checks.start && checks.running },
        { id: 'condition', label: 'Keep cooling and equipment healthy', done: checks.equipment && checks.cooling && checks.circulation },
        { id: 'hold', label: `Hold ${objective.targetMw} ± ${objective.toleranceMw} MW for ${objective.seconds < 60 ? `${objective.seconds} s` : `${objective.seconds / 60} min`}${!sim.autoMode && objective.manualAllowed ? ' qualifying time; outside limits pauses progress' : ''}`, done: false },
    ].map(step => ({ ...step, done: verified || step.done }));
}

function missionOrder(assignment, sim) {
    return sim.work.orders.find(order => order.equipment === assignment.definition.objective.equipment
        && Number(order.id.slice(3)) > assignment.baselineOrders);
}

function maintenanceSteps(assignment, sim) {
    const objective = assignment.definition.objective;
    if (objective.kind === 'condition-rounds') return objective.equipment.map(id => ({ id,
        label: `Record ${WORK_NAMES[id]} condition readings`, done: (sim.work.inspections[id]?.sequence || 0) > assignment.baselineInspections }));
    if (objective.kind === 'water-quality') {
        const sample = sim.water.samples.find(item => item.sequence > assignment.baselineSamples
            && item.conductivity <= 2 && item.filterLoad < 80 && item.intakeDebris <= 20 && item.basinLevel >= 25);
        return [{ id: 'sample', label: 'Take a new water sample within the stated limits', done: Boolean(sample) },
            { id: 'treatment', label: 'Prove actual purification and make-up above 50%; keep water healthy',
                done: sim.water.healthy && sim.water.purification > .5 && sim.water.makeup > .5 },
            { id: 'hold', label: `Verify treatment for ${objective.seconds} continuous seconds`, done: false }];
    }
    const order = missionOrder(assignment, sim);
    return [{ id: 'order', label: `Create a new ${WORK_NAMES[objective.equipment]} work order`, done: Boolean(order) },
        { id: 'isolate', label: 'Stop, cool and establish actual equipment isolation', done: order?.isolatedAt !== null && order?.isolatedAt !== undefined },
        { id: 'service', label: 'Complete explicit service with isolation retained', done: order?.servicedAt !== null && order?.servicedAt !== undefined },
        { id: 'test', label: 'Release and prove 10 continuous seconds of actual operation', done: ['ready', 'completed'].includes(order?.status) },
        { id: 'complete', label: 'Explicitly return the verified order to service', done: order?.status === 'completed' }];
}

export class CompanyCareer {
    constructor(state = null, catalogue = MISSIONS, difficulty = 'easy') {
        validateMissionCatalogue(catalogue);
        if (!['easy', 'hard'].includes(state?.difficulty || difficulty)) throw new Error('Invalid career difficulty');
        this.catalogue = catalogue;
        this.state = state ? structuredClone(state) : {
            id: globalThis.crypto.randomUUID(), contentVersion: MISSION_CONTENT_VERSION, difficulty,
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
        const definition = structuredClone(next);
        if (this.state.difficulty === 'hard' && definition.objective.kind === 'generation-hold') {
            definition.objective.manualOnly = true;
            definition.brief = `Hard career: Auto is disabled. Use Manual load, rods and pump speeds. ${definition.brief}`;
        }
        const assignment = { definition, status: 'assigned', held: 0,
            issuedAt: this.state.lastElapsed, acceptedAt: null, completedAt: null,
            baselineStarts: 0, baselineInspections: 0, baselineOrders: 0, baselineSamples: 0,
            reason: 'Read the briefing and accept the assignment.' };
        this.state.assignments.push(assignment);
        this.message(`assignment:${next.id}`, next.title, definition.brief, next.sender, assignment.issuedAt, next.id);
    }

    accept(sim) {
        const assignment = this.current;
        if (!assignment || assignment.status !== 'assigned') return false;
        assignment.status = 'active';
        assignment.acceptedAt = sim.elapsed;
        assignment.baselineStarts = sim.startSequence;
        assignment.baselineInspections = sim.work.inspectionSequence;
        assignment.baselineOrders = sim.work.sequence;
        assignment.baselineSamples = sim.water.sampleSequence;
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
        let reason = '';
        if (objective.kind !== 'generation-hold') {
            const steps = maintenanceSteps(assignment, sim);
            const requirements = steps.filter(step => step.id !== 'hold');
            const met = requirements.every(step => step.done);
            assignment.held = met ? Math.min(objective.seconds, assignment.held + dt) : 0;
            reason = met ? 'Requirements met; verifying on plant time.' : requirements.find(step => !step.done).label;
        } else {
            const checks = generationHoldConditions(assignment, sim);
            if (!checks.start) reason = 'Explicitly start the reactor after accepting this assignment.';
            else if (!checks.running) reason = 'Reactor must be running without a trip.';
            else if (!checks.regulation) reason = objective.manualOnly ? 'Use Manual operation.' : `Select Auto → Electrical output at ${objective.targetMw} MW${objective.manualAllowed ? ' or operate manually' : ''}.`;
            else if (!checks.following) reason = 'Turn off Follow requests for this fixed-output test.';
            else if (!checks.equipment) reason = 'Clear active faults and retained damage; complete required work orders and restore water quality.';
            else if (!checks.cooling || !checks.circulation) reason = 'Restore circulation and healthy cooling.';
            else if (!checks.output) reason = `Waiting for actual output within ${objective.targetMw} ± ${objective.toleranceMw} MW.`;
            assignment.held = reason ? (!sim.autoMode && objective.manualAllowed ? assignment.held : 0) : Math.min(objective.seconds, assignment.held + dt);
        }
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
