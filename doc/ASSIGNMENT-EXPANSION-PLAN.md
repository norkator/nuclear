<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Assignment expansion

Requested 2026-11-17. This plan extends the [company roadmap](GAMEPLAY-PLAN.md),
retaining its economy direction. The immediate expansion delivers operating
variety before money, invoices or bankruptcy. Those systems remain separate work.
See the [implementation handoff](game-development.md) for shipped behavior.

## Progress and authoring contract

Keep the original eight assignment IDs, requirements, completed records,
achievements and capabilities. Never restart a career to add content. An active
or ready assignment keeps its issued terms; extension assignments follow it.
Use capability dependencies rather than a saved chapter/array index. Existing
careers that finished the maintenance chapter receive the continuation.

All evidence uses actual host plant time and read-backs. Pause freezes progress;
closed careers never advance. Manual/Hard remains supported without enabling
Auto. Training has no failure deadlines: power objectives accumulate qualifying
time in Manual, and verified success remains ready until reported. Repairs,
refuelling, restart, breaker closure and backup enable stay explicit actions.

Durations and MW values below are fictional gameplay proposals to validate against
the model. Do not change protection thresholds or shorten cooldowns to meet them.

## First expansion: sixteen assignments

| Permanent ID | Assignment | Result and distinctive decision |
| --- | --- | --- |
| `pumps.acceptance-tests` | Prove every pump | In a stopped test window, prove all four pumps separately, then restore main-pump duty and stopped backups. |
| `grid.first-contract` | First dispatch exercise | Follow at least three different issued requests and accumulate three qualifying minutes of actual delivery. No monetary contract yet. |
| `operation.low-demand` | Quiet overnight demand | Hold 100 ± 5 gross MW for two minutes without sacrificing cooling. |
| `pumps.primary-backup` | Transfer primary duty | Prove A2 delivering flow with A stopped; restore the requested duty configuration explicitly. |
| `pumps.secondary-backup` | Transfer secondary duty | Prove B2 with B stopped, using independent secondary-loop evidence. |
| `diesel.standby-proof` | Prove standby engines | Run and observe both engines, then leave them stopped, fuelled and armed on normal AC. |
| `computers.redundancy-check` | Computer-system rounds | Record fresh diagnostics of all six units while they are healthy and online. |
| `computers.server-service` | Maintain a process server | Complete a new server A work order using existing redundancy, OFF/cool, boot and actual test checks. |
| `computers.ups-service` | UPS readiness | Service and prove the UPS on AC bypass, retaining the plant's actual power state. |
| `computers.cooling-service` | Rack ventilation service | Stop the fan, cool and service the tray, then restore and test actual airflow. |
| `exchanger.planned-clean` | Exchanger service window | Stop/cool, isolate both loops, service and prove heat transfer after explicit restart. |
| `turbine.service-window` | Turbine service window | Wait for real shaft coast-down, service, then explicitly establish generation and test. |
| `operation.high-demand` | Evening peak | Hold 250 ± 5 gross MW for two minutes inside the existing healthy envelope. |
| `fuel.selective-outage` | First two spent assemblies | Two saved random assembly IDs wear faster during actual generation; identify depletion, cool and replace both explicitly. |
| `maintenance.warned-pump-failure` | A bearing warning becomes a failure | Prepare a healthy backup after a warning, respond to a real main-pump failure, then cool, repair/test and return the failed pump. |
| `grid.load-following` | Fifteen-minute grid shift | Follow changing requests for 900 qualifying plant seconds, with actual delivery and multiple raise/lower requests. |

The grid exercises measure qualifying delivery, not a fixed fifteen-minute
financial obligation. Stop, outage or poor tracking pauses credit; it does not
erase fifteen minutes of Manual effort or incur an undisclosed penalty. Paid
contracts will use the separately calibrated obligation/scoring rules in the
company roadmap.

## The three requested scenarios

**Fifteen-minute grid shift.** Reuse the Grid controller and distinguish requested
MW from actual output. Show qualifying time and newly served requests. Auto may
follow; Hard receives read-only requests and the operator adjusts Manual
controls. Manual request delivery must never write rods, speeds or Auto targets.
Persist evidence and request countdown so Continue cannot reroll or skip work.

**Two spent assemblies.** These are fuel assemblies, separate from control rods.
Choose and save two distinct IDs on acceptance. Disclose the accelerated scenario
in the brief, consume their reserves gradually only while generating, and stop
the extra wear after each selected assembly depletes. No instant reserve drain,
whole-core acceleration, automatic replacement or altered thermal clock. Prove
depletion followed by an increased replacement count for each ID. Success belongs
to actual inventory renewal, never a crane animation callback. Pool collection
and paid transactions still need authoritative logical batches before shipping.

**Warned pump failure.** Choose and pin a main pump whose circuit has a healthy
backup. A message reports a bearing concern before a saved warning interval.
Escalation waits for an eligible operating state; no failure is injected during
an outage, isolation or fuel work. Apply actual retained bearing damage through
the plant model once. The operator enables the backup, reduces load or stops as
needed, then completes a new failed-pump work order and actual return-to-service
proof. Existing cooldown rules mean backup transfer is containment, followed by
a stopped/cooled repair window. A reload cannot select a new pump or repeat the
failure. Avoid concurrent authored incidents.

## Further authored ideas

These are backlog proposals, not implemented features. Reuse the original
roadmap IDs where an idea already exists; do not create duplicate tutorials.

| Area | Further assignment | What makes it different |
| --- | --- | --- |
| Demand | Dawn pickup | Step from overnight output to a measured morning ramp. |
| Demand | Renewable surplus | Reduce generation through several downward requests, then recover. |
| Demand | Peak plateau | Sustain a capacity-checked plateau longer than the first peak test. |
| Demand | Shift energy target | Deliver a stated actual MWh quantity; output alone is insufficient. |
| Demand | Derated dispatch | Accept a lower-capacity offer while cooling is restricted. |
| Demand | Dispatch handover | End a variable shift at an agreed target and configuration. |
| Cooling | `cooling.warm-return` | Diagnose a warming return using actual condenser trends. |
| Cooling | Hot cooling-water day | Work within reduced heat rejection and avoid demanding unavailable power. |
| Cooling | Debris after a storm | Contain an intake restriction, arrange an outage and prove restored cooling. |
| Cooling | Falling basin inventory | Restore make-up and sample actual basin recovery before increasing load. |
| Chemistry | Conductivity excursion | Diagnose poor water, treat it and verify a new healthy sample. |
| Chemistry | Treatment recovery | Restore purification after an announced interruption; retained fouling still needs service. |
| Maintenance | `pipework.isolate-inspect` | Isolate both pumps in the affected loop; inspect healthy pipework or repair actual damage. |
| Maintenance | Valve restriction diagnosis | Distinguish normal motor speed from poor actual flow. |
| Maintenance | Condenser service window | Planned cooled isolation and actual heat-rejection proof. |
| Maintenance | Preventive intervention | Service a warned component before failure; record an avoided incident. |
| Supply | `supply.loss-of-normal-power` | Announced source interruption with actual backup load and restoration proof. |
| Supply | Diesel refuelling rotation | Maintain available backup coverage while refuelling one stopped engine. |
| Supply | Auxiliary capacity limit | Reduce pump demand when one diesel cannot support the chosen configuration. |
| Supply | Restore normal supply | Recover AC, verify cooling/computers and explicitly stop unloaded diesels. |
| Computers | Server failover incident | Retain regulation through one actual server loss, then service it. |
| Computers | Network maintenance window | Prepare Manual/stopped operation before network isolation and boot. |
| Computers | Instrument-server outage | Use independent local readings while recovering the main displays. |
| Computers | UPS endurance proof | Verify actual rack continuity across an agreed brief AC interruption. |
| Fuel | `fuel.pool-collection` | Dispatch an authoritative cooled batch and verify its real assembly count. |
| Fuel | Selective outage planning | Replace due assemblies while preserving unaffected inventory. |
| Fuel | `fuel.outage-budget` | Add disclosed costs and budget evidence after the ledger exists. |
| Operations | Warm restart | Recover from an ordinary planned Stop while preserving actual retained heat. |
| Operations | Controlled shutdown | Finish with rods inserted, cooled fuel, available AC and proven cooling. |
| Operations | `company.independent-shift` | Combine a variable-demand shift with one eligible incident and a final condition report. |

Later repeatable shifts can vary request patterns, eligible equipment, weather
restrictions and maintenance windows using saved seeds. Show required work and
known risks before acceptance. Add an explicit repeatable-instance contract
before replaying permanent mission IDs; reporting must never duplicate an
achievement or future payment.

## Delivery and verification

1. Record this plan before source changes; retain the original eight missions.
2. Add reusable actual-state evidence, validation, checklist rendering and an
   explicit save migration together. Keep scenario choices and partial progress.
3. Extend the catalogue with the sixteen assignments, without depending on the
   future economy or new physical fuel handling.
4. Test pre-expansion completed/active/ready saves, exact Continue, Manual and
   Auto grid delivery, pause, invalid evidence, post-acceptance work, targeted
   depletion and one-time failure escalation.
5. Run model tests, build, shared company browser checks and companion checks;
   use the final full browser suite for this broad integration change.
