/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Continuation capabilities do not alter the original maintenance certificate.
const manager = 'Elena Ward · Plant manager';
const maintenance = 'Marcus Lee · Maintenance lead';
const grid = 'Sofia Chen · Grid operations';
const computing = 'Daniel Brooks · Computer systems';
const hold = (targetMw, seconds = 120) => ({ kind: 'generation-hold', seconds, targetMw, toleranceMw: 5,
    needsStart: false, manualAllowed: true, needsWorkComplete: true });
const order = equipment => ({ kind: 'work-order', seconds: 1, equipment });
const serviceBrief = 'Create a new work order after accepting. Follow its actual OFF, cooldown and isolation checks; service, release for test and explicitly return the verified order to service. Power and restart commands remain yours. Service is free; heat, fuel, settings and trip latches are retained.';

export const CONTINUATION_MISSIONS = [
    {
        id: 'pumps.acceptance-tests', title: 'Prove all four pumps', sender: maintenance,
        achievement: 'Four pumps proven', requires: ['maintenance-chapter-complete'], grants: ['pump-tests-qualified'],
        brief: 'Plan a stopped, cooled test window. After accepting, prove A, A2, B and B2 separately for 10 continuous seconds each at actual speed and flow of at least 20%, with the other pump in that circuit OFF and stopped. Keep pressure at most 145%. Completed individual proofs are retained. Finish with main pumps A/B delivering flow and both backups OFF and stopped. The reactor can remain stopped. Do not run both pumps at full speed.',
        objective: { kind: 'pump-proof', seconds: 10, equipment: ['pumpA', 'pumpA2', 'pumpB', 'pumpB2'], stopped: true, restoreMain: true },
        completion: 'All four pump proofs received. Grid operations has a first variable-demand exercise for you.',
    },
    {
        id: 'grid.first-contract', title: 'Serve your first grid requests', sender: grid,
        achievement: 'First dispatch shift', requires: ['pump-tests-qualified'], grants: ['dispatch-qualified'],
        brief: 'Start generation and enable Follow requests. Accumulate 3 qualifying minutes within 10 MW of actual issued Grid controller requests, serving at least three different new requests. Auto follows in Electrical output regulation. In Manual, including Hard, requests are read-only: adjust load, rods and pump speeds yourself. Keep healthy circulation, cooling and equipment. Outside requirements, progress pauses in either mode; no deadline or money applies. Request now is unavailable during this exercise.',
        objective: { kind: 'grid-following', seconds: 180, toleranceMw: 10, requests: 3 },
        completion: 'Your first changing-demand exercise is complete. Next, demonstrate low-load operation.',
    },
    {
        id: 'operation.low-demand', title: 'Supply the quiet overnight shift', sender: grid,
        achievement: 'Overnight operator', requires: ['dispatch-qualified'], grants: ['low-demand-qualified'],
        brief: 'Turn Follow requests off. Supply 100 ± 5 gross MW for two qualifying minutes with healthy equipment, water and cooling and all work orders returned. In Auto select Electrical output at 100 MW; Auto requires a continuous hold. Manual accumulates qualifying time and pauses outside requirements, without a failure deadline. Low demand still needs circulation.',
        objective: hold(100), completion: 'Overnight output verified. Maintenance is ready to test duty transfers.',
    },
    {
        id: 'pumps.primary-backup', title: 'Transfer primary duty to A2', sender: maintenance,
        achievement: 'Primary backup ready', requires: ['low-demand-qualified'], grants: ['primary-transfer-qualified'],
        brief: 'Prepare a controlled primary duty transfer, lowering load or stopping first if needed. Prove A2 for 10 continuous seconds at actual speed/flow of at least 20%, with pump A OFF and stopped and circuit pressure at most 145%. Then restore A as the running main pump and leave A2 OFF and stopped. Auto never enables the backup for you; avoid sustained parallel full-speed operation.',
        objective: { kind: 'pump-proof', seconds: 10, equipment: ['pumpA2'], stopped: false, restoreMain: true },
        completion: 'Primary duty transfer and restoration verified.',
    },
    {
        id: 'pumps.secondary-backup', title: 'Transfer secondary duty to B2', sender: maintenance,
        achievement: 'Secondary backup ready', requires: ['primary-transfer-qualified'], grants: ['backup-transfer-qualified'],
        brief: 'Prepare a controlled secondary duty transfer, lowering load or stopping if needed. Prove B2 for 10 continuous seconds at actual speed/flow of at least 20%, with B OFF and stopped and circuit pressure at most 145%. Restore B delivering flow and leave B2 OFF and stopped. Your primary transfer does not count as secondary evidence.',
        objective: { kind: 'pump-proof', seconds: 10, equipment: ['pumpB2'], stopped: false, restoreMain: true },
        completion: 'Both circuit transfers are proven. Check the standby electrical engines next.',
    },
    {
        id: 'diesel.standby-proof', title: 'Prove both standby engines', sender: maintenance,
        achievement: 'Standby engines ready', requires: ['backup-transfer-qualified'], grants: ['standby-qualified'],
        brief: 'After accepting, explicitly run each diesel for 10 continuous seconds. Engine proof uses actual running state, not its switch or countdown; unloaded running on normal AC is valid. Stop each engine, refuel it while stopped to at least 25%, then explicitly re-arm automatic standby. Finish on normal turbine/grid AC with both engines stopped, fuelled and armed. There is no need to cut cooling power for this first proof.',
        objective: { kind: 'diesel-proof', seconds: 10 }, completion: 'Both standby engines have passed their running and readiness checks.',
    },
    {
        id: 'computers.redundancy-check', title: 'Complete computer-system rounds', sender: computing,
        achievement: 'Healthy computing', requires: ['standby-qualified'], grants: ['rack-inspected'],
        brief: 'In Computer systems, power and boot all six units and record new healthy online diagnostics for each after accepting. Old diagnostics and requested power switches do not count. Check actual temperatures, airflow, AC/UPS and redundant process servers. Diagnostics never repair a hardware fault.',
        objective: { kind: 'rack-diagnostics', seconds: 1 }, completion: 'Fresh diagnostics received for every rack unit.',
    },
    {
        id: 'computers.server-service', title: 'Service process server A', sender: computing,
        achievement: 'Server returned to service', requires: ['rack-inspected'], grants: ['server-service-qualified'],
        brief: `Keep process server B online if the reactor is running. Switch server A OFF and let it cool below 45 °C. ${serviceBrief} Power A ON after release, allow the five-second boot and prove ten continuous seconds of healthy online operation.`,
        objective: order('serverA'), completion: 'Process server A is serviced, booted and explicitly returned.',
    },
    {
        id: 'computers.ups-service', title: 'Service the rack UPS', sender: computing,
        achievement: 'UPS readiness proven', requires: ['server-service-qualified'], grants: ['ups-service-qualified'],
        brief: `Establish actual AC bypass before switching the UPS OFF. ${serviceBrief} Restore the UPS and prove its actual powered readiness; it supplies the rack, never the coolant pumps.`,
        objective: order('rackUps'), completion: 'UPS service and actual readiness accepted.',
    },
    {
        id: 'computers.cooling-service', title: 'Service rack ventilation', sender: computing,
        achievement: 'Rack ventilation restored', requires: ['ups-service-qualified'], grants: ['rack-service-qualified'],
        brief: `Choose a suitable operating window, reducing rack heat before stopping the cooling tray. Wait for actual fan coast-down and a temperature below 45 °C. ${serviceBrief} Restore airflow and prove actual healthy operation. Do not leave powered servers overheating during preparation.`,
        objective: order('rackCooling'), completion: 'Rack cooling is serviced and proven. Schedule the mechanical outage next.',
    },
    {
        id: 'exchanger.planned-clean', title: 'Service the heat exchanger', sender: maintenance,
        achievement: 'Heat transfer restored', requires: ['rack-service-qualified'], grants: ['exchanger-service-qualified'],
        brief: `Stop and cool with circulation before switching all four pumps OFF. Wait for actual flow/motor stop in both loops. ${serviceBrief} After release, restore circulation and explicitly restart generation; ten seconds above 20 gross MW with positive cooling margin proves this order. Healthy preventive service is valid.`,
        objective: order('exchanger'), completion: 'Heat exchanger service and heat-transfer proof received.',
    },
    {
        id: 'turbine.service-window', title: 'Complete a turbine service window', sender: maintenance,
        achievement: 'Turbine service proven', requires: ['exchanger-service-qualified'], grants: ['turbine-service-qualified'],
        brief: `Stop and cool the reactor, open the generator breaker and wait for the actual shaft below 0.5%. ${serviceBrief} After release, explicitly restore admission, circulation, reactor Start and the generator breaker when ready. Prove ten continuous seconds of healthy actual generation and shaft speed at least 90%. Service never clears an existing trip latch.`,
        objective: order('turbine'), completion: 'Turbine service accepted. Grid operations can now request an evening peak.',
    },
    {
        id: 'operation.high-demand', title: 'Meet the evening peak', sender: grid,
        achievement: 'Peak demand supplied', requires: ['turbine-service-qualified'], grants: ['high-demand-qualified'],
        brief: 'Turn Follow requests off and supply 250 ± 5 gross MW for two qualifying minutes. Keep equipment, water and cooling healthy with all work orders returned. In Auto select Electrical output at 250 MW and allow sufficient operating core-temperature and circulation targets; Auto requires a continuous hold. Manual accumulates qualifying time without a failure deadline. This is ordinary output, not an overdrive task.',
        objective: hold(250), completion: 'Evening peak supplied within the normal operating envelope.',
    },
    {
        id: 'fuel.selective-outage', title: 'Replace your first two spent assemblies', sender: 'Nadia Flores · Fuel and logistics',
        achievement: 'Selective fuel replacement', requires: ['high-demand-qualified'], grants: ['selective-fuel-qualified'],
        brief: 'Acceptance selects and saves two random fuel assembly IDs, shown in your checklist. This disclosed accelerated exercise wears only those assemblies at a total 120× exposure rate while generating; thermal time is unchanged. Observe both depleting, then stop, insert all rods and cool within the existing replacement checks. Replace the two specified assemblies explicitly; replacing healthy fuel early does not prove depletion. Bulk replacement is allowed but unnecessary. Inventory replacement counts prove success independently of the cosmetic crane. No pool dispatch or payment is required.',
        objective: { kind: 'fuel-selective', seconds: 1, count: 2, rate: 120 },
        completion: 'Both assigned assemblies depleted and were manually replaced. Other fuel and retained plant history remain intact.',
    },
    {
        id: 'maintenance.warned-pump-failure', title: 'Respond to a warned pump failure', sender: maintenance,
        achievement: 'Backup, repair and recovery', requires: ['selective-fuel-qualified'], grants: ['incident-recovery-qualified'],
        brief: 'Maintenance has reported a bearing concern on one saved main pump, identified in your acceptance message and checklist. Inspect it and prepare its healthy backup. After 45 eligible operating seconds the bearing fails once; the warning clock waits during Stop, isolation or an unavailable backup. Enable and prove the backup delivering flow for ten seconds with the failed pump OFF. Reduce demand or stop as needed. Then stop/cool, create a NEW failed-pump work order after the failure, isolate, service, test and explicitly return it. Restore main-pump duty, stop the backup, restart explicitly and prove 60 healthy seconds of generation. The failure cannot reroll on Continue; cooling interlocks still apply.',
        objective: { kind: 'pump-recovery', seconds: 60, warningSeconds: 45 },
        completion: 'The warned failure was contained with the backup, serviced and returned to generation.',
    },
    {
        id: 'grid.load-following', title: 'Follow the grid for fifteen minutes', sender: grid,
        achievement: 'Fifteen-minute dispatch operator', requires: ['incident-recovery-qualified'], grants: ['extended-operations-complete'],
        brief: 'Enable Follow requests and supply changing Grid controller requests for 900 qualifying plant seconds, serving at least ten different new requests. Keep actual output within 10 MW, healthy equipment/cooling and both circuits flowing. Auto follows Electrical output requests; Manual/Hard gets read-only requests for the operator to follow. Outside requirements, progress pauses without a failure deadline. Pause freezes everything; closed careers never advance. Request now cannot skip intervals. Report once verified; your earlier certificates and achievements stay saved.',
        objective: { kind: 'grid-following', seconds: 900, toleranceMw: 10, requests: 10 },
        completion: 'Extended operations completed: variable demand, low/peak power, standby readiness, computer and mechanical service, selective fuel work and incident recovery.',
    },
].map((definition, index) => ({ version: 1, order: 90 + index * 10, ...definition }));
