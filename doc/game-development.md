<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Continuing company-game development

Updated 2026-11-17. This is the implementation handoff for the standalone
[norkator/nuclear](https://github.com/norkator/nuclear) repository. All commands
below run from this repository root. Read [AGENTS.md](../AGENTS.md), this file,
[the product plan](GAMEPLAY-PLAN.md) and [the plant specification](nuclear-power.md)
before continuing. The plan describes the intended game; this file describes the
code that exists and the work still needed.

## Current playable operations and maintenance campaign

Free operation remains the initial mode. **Start game → Begin career** creates
a separate cold plant with its clock running immediately. Pause is operator-owned.
The free-operation plant is parked in memory and restored by **Save & return to
free operation**; it does not earn career progress. Reload opens free operation;
**Continue game**, import and reconnect preserve the user's Pause choice, without offline advancement.
Switching plants ends companion pairing and clears old local audio/motion.

New careers select Easy (Auto and Manual) or Hard (Manual only). Hard sets the
saved plant `autoAllowed` policy false, enforced at the model boundary for
both desktop and companion commands. Free operation retains Auto.

The boss, Elena Ward, automatically issues one assignment at a time through the
company inbox. The player accepts, operates, waits for verification and reports.

Accepting closes the company window and reveals a compact checklist above Live
trends. Gray numbered steps turn green with checkmarks as actual conditions are
met; timers show qualifying plant time where required. Unverified conditions can
return to gray, while a verified assignment stays green until reported. Full
briefing opens the inbox; Send report is available on the verified checklist.
Unaccepted assignments and free operation have no checklist. Steps are derived
from pinned objective terms and saved plant/evidence, without new save fields.
On wide screens the checklist and trends share the independently hideable right
side panel. Its contents scroll without overlapping or moving the process/header;
the career status and Company inbox entry remain available when that panel is
closed. Companion station presets do not add company pages or career commands.

With plant sounds enabled, a newly satisfied checklist step plays a short Kenney
Interface Sounds confirmation. Full verification plays a different, longer cue
when the assignment becomes ready to report; reporting adds no second completion
cue. Simultaneous newly green steps coalesce. An in-memory tracker prevents
repeated updates or fluctuating conditions from replaying a step within the
session. Accept/Continue/import prime the existing evidence silently. Muted,
paused, hidden or unavailable-audio progress is consumed without queued playback.
Cues share the existing audio context/cleanup, stay independent of machinery and
UI clicks, and add no saved fields or mission rules.

| Stable mission ID | Criterion | Capability earned on report |
| --- | --- | --- |
| `startup.first-shift` | Explicit successful Start after acceptance, then 200 ± 5 gross MW for 30 qualifying seconds | `commissioned` |
| `operation.reliable-five` | 200 ± 5 gross MW for 300 qualifying seconds | `reliable-operation` |
| `monitoring.condition-rounds` | New inspections of all four pumps and turbine | `condition-survey` |
| `maintenance.planned-service` | New pump A order, isolation, service, actual test and explicit return | `work-order-qualified` |
| `water.quality-check` | New healthy sample and ten seconds of powered treatment/make-up | `water-quality-qualified` |
| `water.filter-service` | New filter order, cooled service and actual treatment test | `filter-service-qualified` |
| `cooling.intake-service` | New intake order, both loops isolated, service and restored cooling-water test | `cooling-service-qualified` |
| `operation.return-to-service` | Explicit Start, then 200 ± 5 MW for 60 seconds with water healthy and work complete | `maintenance-chapter-complete` |

The original eight remain unchanged. The sixteen-assignment continuation is
issued after that maintenance certificate, including for existing completed
careers; it does not revoke earlier goals or alter active/ready issued terms.

| Stable mission ID | Actual criterion | Capability earned on report |
| --- | --- | --- |
| `pumps.acceptance-tests` | Four separate stopped pump proofs, ten seconds each; restore main duty | `pump-tests-qualified` |
| `grid.first-contract` | 180 qualifying seconds within 10 MW of new requests, at least three served | `dispatch-qualified` |
| `operation.low-demand` | 100 ± 5 gross MW for 120 seconds | `low-demand-qualified` |
| `pumps.primary-backup` | Ten actual seconds on A2 with A stopped, then restore A duty | `primary-transfer-qualified` |
| `pumps.secondary-backup` | Ten actual seconds on B2 with B stopped, then restore B duty | `backup-transfer-qualified` |
| `diesel.standby-proof` | Each diesel actually running for ten seconds; finish on normal AC, engines stopped/armed/fuelled | `standby-qualified` |
| `computers.redundancy-check` | New healthy online diagnostics of all six units | `rack-inspected` |
| `computers.server-service` | New server A order through explicit return | `server-service-qualified` |
| `computers.ups-service` | New UPS order with actual AC-bypass and test interlocks | `ups-service-qualified` |
| `computers.cooling-service` | New cooling-tray order with actual fan stop and airflow proof | `rack-service-qualified` |
| `exchanger.planned-clean` | New exchanger order, both loops isolated and actual generation test | `exchanger-service-qualified` |
| `turbine.service-window` | New turbine order, shaft coast-down and explicit generation test | `turbine-service-qualified` |
| `operation.high-demand` | 250 ± 5 gross MW for 120 seconds | `high-demand-qualified` |
| `fuel.selective-outage` | Two pinned random assemblies deplete at 120×, then actual manual replacements | `selective-fuel-qualified` |
| `maintenance.warned-pump-failure` | Saved 45-second warning, real one-time bearing failure, backup proof, new returned order and 60 healthy generation seconds | `incident-recovery-qualified` |
| `grid.load-following` | 900 qualifying seconds within 10 MW, at least ten different new requests served | `extended-operations-complete` |

Grid exercises accumulate qualifying delivery in both modes; outside requirements
pauses credit, with no deadline, score tariff or fine. Their saved countdown uses
the existing 45/60-second dispatcher. While active, Manual/Hard receives read-only
requests without writing any plant targets; Request now is blocked at the model
boundary. This policy is derived from the active assignment, restored before the
first tick and removed at verification. Ordinary Manual free operation retains
the suspended dispatcher. These exercises are not the planned monetary contracts.

Selective fuel evidence pins two distinct IDs and replacement counters. Only
those assemblies receive extra consumption through the normal inventory path,
up to a total 120× rate while reacting; each stops receiving extra wear once
depleted. Depletion must precede an actual replacement. Counter evidence does
not depend on crane deposition, camera, reduced motion or a transfer callback.
Paid fuel and pool-logistics missions still require authoritative batch receipts.

The warned incident pins one eligible main pump and its backup from the random
career UUID. The warning advances only during healthy generation with that pump
delivering flow, a healthy backup and no open orders. It pauses during Stop or
an outage; once eligible for 45 seconds, retained bearing damage stops the actual
motor. There is one injection and one failure message. Backup proof needs ten
actual seconds with the failed pump OFF/stopped. Repair still requires the
existing stopped/cooled checks and a new post-failure order; final recovery needs
an explicit restart, restored main duty and stopped backup. No random background
incident director, concurrent incidents or preventive-avoidance variant exists yet.

Generation tests require Auto/electrical regulation at 200 MW or actual Manual
operation (Hard requires Manual), grid following disabled, running/no trip,
no active faults or damage under the existing model
checks, positive cooling margin, both flows at least 20%, core at most 335 °C and
peak fuel at most 410 °C. These are fictional model limits. Violations reset the
continuous Auto hold immediately. Manual qualifying time accumulates and pauses
outside requirements without a failure deadline; pause freezes time. Version-1
issued briefs retain their original Auto-only terms. A completed verification
stays ready to report even if the plant changes afterward. Reporting records an achievement,
archives the saved requirements/result, sends follow-up mail and issues eligible
next work. Email read state does not determine plant success.

Current saved lifecycle values are `assigned`, `active`, `ready`, `completed`.
Objective kinds are `generation-hold`, `condition-rounds`, `work-order`,
`water-quality`, `pump-proof`, `diesel-proof`, `rack-diagnostics`,
`grid-following`, `fuel-selective` and `pump-recovery`. Post-acceptance baselines use monotonic inspection, sample and
order sequences. Requested switches, old samples and unclosed work orders cannot
substitute for actual success. Work tests need ten continuous plant seconds.
The remaining economic catalogue, economic lifecycle, costs, monetary rewards,
contracts and bankruptcy remain planned. Service, repairs, refuelling and dispatch
remain free.

All company UI and career ownership are desktop-only. Companions can operate the
host plant through existing validated commands, including selected/all fuel
replacement. They do not display an inbox/mission/finance summary yet, create
career saves, tick objectives, or manage the host's game. Pool dispatch remains
desktop-only. Condition records, work orders and water controls/sampling are also
desktop-owned. Companions hydrate water/work state and obey host isolation and
Hard restrictions through their existing plant controls.

## Code map

| File | Responsibility |
| --- | --- |
| `src/simulation/nuclear-power-missions.js` | Original eight definitions, combined catalogue, capabilities, pinned terms and reports |
| `src/simulation/nuclear-power-mission-catalogue.js` | Sixteen authored continuation assignments |
| `src/simulation/nuclear-power-assignment-operations.js` | Actual-state proofs, grid delivery, targeted fuel, warned failure and evidence validation |
| `src/simulation/nuclear-power-game.js` | Entry/return, company UI, lock ownership, autosave, JSON backup and plant switching |
| `src/simulation/nuclear-power-game-audio.js` | Presentation-only assignment/step cue deduplication from actual checklist evidence |
| `src/simulation/nuclear-power-game-save.js` | Explicit plant/pool serialization, validation/hydration and IndexedDB revision writes |
| `src/simulation/nuclear-power-game.css` | Company-window and game-status styles |
| `src/simulation/nuclear-power.js` | Custom-element integration, host plant ticks, UI updates, cleanup and guarded Reset demo |
| `src/simulation/nuclear-power-model.js` | Reactor commands/read-backs; `startSequence` increments only on successful Start |
| `test/nuclear-power-game.test.mjs` | Mission timing/evidence, content insertion, pinned terms, hydration and invalid saves |
| `test/company-game.browser.mjs` | UI/reload/ownership/layout/lifecycle/save-failure checks reused by the browser harness |
| `test/company-assignment-expansion.browser.mjs` | Shared browser continuation through all sixteen new assignments, preserving original reports |
| `test/nuclear-power-assignment-expansion.test.mjs` | Original-progress migration, new objective behavior and exact scenario continuation |
| `test/game-browser.mjs` | Focused browser entry selected by `npm run test:browser:game` |

`CompanyCareer.advance(sim)` consumes advanced plant elapsed time. The host calls
it from its update path; repeated rendering at the same plant time grants no
progress. The normal plant step is bounded to one simulated second. Tests that
advance many steps must evaluate the career after every step. Future electricity
settlement must consume actual advanced intervals and request boundaries, never
UI calls, animation frames, wall-clock absence or requested MW.

The new model/UI modules are `nuclear-power-work.js` (derived condition readings,
inspections and isolation/service/test orders), `nuclear-power-water.js` (powered
treatment, samples and cooling inventories), and `nuclear-power-maintenance-work.js`
(desktop controls). `test/nuclear-power-work.test.mjs` covers command guards,
water behavior, Manual progress, migrations and exact hydration.

Computer-rack support is in `nuclear-power-computers-model.js` (pure rack model),
`nuclear-power-computers-scene.js` (draw-only GPU adapter), and
`nuclear-power-computers.js`/CSS (3D-only tab and floating inspection). The main
console owns the shared frame loop. A rack-only observer suspends offscreen GPU
work; detach disposes resources. Existing work orders accept all six rack units,
with dedicated hardware isolation and actual online proof. The continuation adds
rack diagnostics and server/UPS/cooling service assignments. Rack commands and
records stay desktop-owned; companion hydration retains model methods and
blocks Auto while host process computing is unavailable.

The rack diagram and presentation selector have been removed at the user's
request. Context loss disposes the renderer and shows a status message; native
unit inspection/maintenance buttons remain available. There is no alternate rack
diagram. The main reactor's separate schematic is unchanged.

Overview equipment navigation now opens dedicated 3D stations for pumps,
exchanger, turbine/generator and condenser; the server warehouse left of the
cooling tower opens Computer systems. `nuclear-power-stations.js`/CSS owns the
station UI and part-to-control routing; `nuclear-power-stations-scene.js` builds
only the selected equipment, reusing `nuclear-power-cutaway-scene.js` and pump
geometry. All controls still pass through the same simulation and work-order
guards. Stations add no saved fields, missions or plant clock. Their lazy cameras,
visibility, actual damage/motion and fallback are covered by
`test/equipment-stations.browser.mjs`, shared by focused equipment and full checks.

## Saved-state contract and known gaps

- Save schema: `CAREER_SAVE_VERSION = 5`; content metadata:
  `MISSION_CONTENT_VERSION = 3`. There is no economy rules version yet.
- IndexedDB: `porssiohjain-nuclear-career`, database version 1, object store
  `career`, keys `current` and `previous`. Keep this namespace when changing
  repository/UI names, or provide an explicit migration. Saves belong to the
  browser origin; another device, browser profile, origin or cleared storage
  does not share them. The WebSocket relay never stores them.
- Each stored record is `{ revision, bundle }`; the bundle contains
  `{ schemaVersion, career, plant, transfer }`. Successful writes atomically move
  the old current record to previous and compare the expected revision.
- One tab holds the `nuclear-power-career` Web Lock. A second tab is refused
  ownership; explicit takeover/read-only career viewing are not implemented.
  The current browser must support IndexedDB and Web Locks. Use localhost or the
  deployed HTTPS origin for the game; an ordinary HTTP LAN origin may lack the
  required secure-context APIs even though free operation/companions work.
- Autosave runs at least every five advanced seconds and on relevant UI/command
  updates. Accept/report/save/return request immediate consistent snapshots.
  Save failures remain visible and prevent Save & return from claiming success.
- Hydration restores class getters, shared references, heat, damage, trips,
  pump/shaft inertia, fuel, dispatch and pool/transfer records. Existing sampled
  rotor strength/grace are preserved. Do not regenerate them during restore.
- JSON export/import validates the complete bundle before replacing the career.
  `migrateCareerBundle` adds healthy water, empty work records, evidence baselines
  and Easy difficulty to schema 1, preserving old plant state, issued terms and
  achievements. The schema-2-to-3 step adds healthy computer defaults; schema 3→4
  adds a healthy instrument server without changing the five existing rack units.
  Schema 4 retains rack power/boot/fault/thermal state, UPS inventory and diagnostics.
  Schema 4→5 adds explicit null assignment evidence to old records, preserving
  all definitions, holds, completions, achievements and capabilities. New kinds
  save validated proof timers, diagnostic/request baselines, served request IDs,
  selected fuel/replacement evidence and warned-failure identity/stage. Validation
  checks water bounds, order IDs/stage timestamps,
  evidence types and difficulty/Auto consistency. Manual trend samples can have
  null electrical targets. Continue commits the migrated revision. Unknown
  versions are rejected; previous-revision recovery UI remains planned.
- Career history contains mission reports and achievements. Separate archived
  bankrupt/finished companies, profiles, company naming and
  restart checkpoints are not implemented. Starting another career replaces the
  one local slot after the explicit replacement action in its introduction.
- Reset demo is blocked in Career. A melted career can be inspected/exported and
  saved/left, then explicitly replaced with a new career. Terminal closeout,
  bankruptcy and an end-of-career debrief still need implementation.
- Fuel/pool saves preserve today's representative visual transfer. They are not
  an authoritative purchase/service/transport ledger. Start can cancel a transfer
  before a sample is deposited. Resolve this before charging for replacement or
  awarding a fuel-logistics mission; see the product plan's Career batch proposal.
- No general incident director, repair invoices, paid fuel,
  contracted export model, premium, credit facility or economic failure exists.
  The one authored bearing incident and selective fuel exercise use saved,
  deterministic choices; a general random campaign director is still planned.
  Debug scenario controls and fuel acceleration are still available in Career;
  gate their economic effects before releasing monetary contracts.

## Adding missions without resetting careers

Keep permanent semantic IDs; `order` controls presentation/selection, not saved
identity. `requires` and `grants` are capability arrays. Definitions are copied
into issued assignments, so changing a catalogue entry does not rewrite an
issued brief, objective or earned goal. `reconcile()` retains current work and,
when it ends, selects eligible unseen IDs in order. A newly inserted mission can
therefore be issued as catch-up work without revoking earlier capabilities.
Messages and achievements use stable IDs to avoid duplicates.

For an extension:

1. Add a definition and reachable prerequisites; validate missing dependencies,
   duplicate IDs and cycles. Preserve completed/ready/active instances.
2. When adding an objective kind, extend evaluation,
   catalogue validation, saved-assignment validation and UI progress rendering
   together. Retain support for the saved version-1 hold definitions.
3. Add any new plant/economy/receipt fields to the explicit serializer and a
   tested migration from existing versions. Never silently fill missing required
   schema-5 fields; legacy additions belong only in explicit migrations.
4. Update the introduction, progression copy and actual-state checklist. Adding
   a definition alone does not implement new objective behavior or paid contracts.
5. Test insertion before issuance, during active/ready work and after completion;
   require old goals/capabilities to survive and rewards/receipts to occur once.

Content-version metadata is currently bookkeeping, not an automatic migration
engine. Explicit retirement/supersession, applicability variants, alternative
prerequisites and revised economy terms need their own implementation and tests.

## Next game-development slice

Continue Phase 0 economy feasibility alongside the Phase 2 implementation in
[GAMEPLAY-PLAN.md](GAMEPLAY-PLAN.md). The measured 200 MW startup works; paid
dispatch response envelopes and economic balance have not yet been calibrated.

1. Measure healthy gross-output response across raise/lower requests under the
   current 45/60-ready-second dispatcher cadence. Define a reachable scoring
   envelope before promises, deadlines or non-delivery charges are enabled.
2. Implement and persist a separate fictional-credit ledger and settlement
   quantities. Gross electrical readings/targets stay unchanged. Prove the
   auxiliary-load deduction, MW-seconds/MWh conversion, interval boundaries,
   bounded premium and duplicate-payment protection.
3. Extend the existing qualifying grid exercises to measured financial contracts,
   preserving their pinned non-monetary terms and old career progress.
4. Extend current preventive work orders to assigned mechanical defects and
   priced work, retaining actual tests and one host-side guard/event path
   for desktop, component and companion commands.
5. Add due invoices, limited credit, visible warnings and terminal bankruptcy/
   plant-loss closeout. Preserve heat, trips, damage and explicit operator control.
6. Add fuel tasks using authoritative representative business batches; full
   physical inventory/crane-owned fuel is a later independent expansion.

Keep free operation unchanged. Do not invent another simulation, require the
Pörssiohjain backend, add accounts/cloud mail, or implement full physical fuel
handling just to deliver this first financial/mission loop.

## Verification and branch policy

For game work, from the root:

```sh
node --test test/nuclear-power-game.test.mjs test/nuclear-power-grid.test.mjs test/nuclear-power-work.test.mjs
npm run build
npm run test:browser:game
```

Use `npm run test:browser:companion` for session/shared-control changes and
`npm run test:browser:equipment` for equipment interaction changes. Run the full
`npm test` and `npm run test:browser` for broad integration/release gates. Do not
replay the full suite for documentation-only changes.

The previous implementation baseline (2026-11-12) passed 141 unit/model/session
tests, the full browser regression, focused game and companion checks, the build,
both Docker image builds and container smoke checks. Historical counts in older
feature plans describe those earlier tasks rather than the current test total.

The operations/maintenance extension (2026-11-14) passed 153 unit/model/session
tests, the production build, the full browser regression and the focused companion
check against the final build. Focused game and layout checks also passed during
iteration. Browser coverage runs all eight assignments, Hard save/Continue,
Manual success retention, real isolation tests and desktop/mobile maintenance fit.
Companion coverage rejects remote Auto and isolated-pump starts at the host.
No image publishing or deployment was performed for this extension.

The Computer systems rack extension passed 163 unit/model/session tests,
the production build, focused rack/layout checks, the full browser regression
against the final build and the focused companion check. Shared browser coverage
includes 3D mesh picking, diagnostics, real service/boot/test evidence, camera
independence, mobile fit, reduced motion, pause/offscreen suspension, context-loss
handling and detach/reconnect disposal. Three-tab keyboard wrap/Home/End checks
are updated. Companion coverage verifies host-owned rack controls and the Auto
lock during computing loss. No extra authored assignment, publishing or deployment
is included in this extension.

| Workflow source | Result |
| --- | --- |
| Push to `main` | Tests/build/browser checks only; no image push |
| Push to `production` | Same checks, then both amd64/arm64 images published after success |
| Manual run on `main` / `production` | Same branch-specific policy |
| Pull request or another branch | No automatic pull-request runs; other branches do not run the test/publish jobs |

Images are `ghcr.io/norkator/nuclear:latest` and
`ghcr.io/norkator/nuclear-backend:latest`. The public origin remains
`https://nuclear.porssiohjain.fi`. Publishing does not deploy the running service.


New careers now start with grid/turbine auxiliary feeds disconnected, both diesels
OFF/unarmed and all rack units OFF. Startup briefing describes AC commissioning
and explicit rack power/boot before reactor Start in both Easy and Hard. Manual
controls and ESD remain available through a computing outage.
The same eight assignment IDs, objectives and pinned issued terms remain. Schema 3
continues saving exact supply/rack/rod state; legacy migrations retain their old
healthy defaults. Post-trip manual core-map rod withdrawal produces heat while ESD
remains latched and cannot qualify the normal running assignment requirements.

The cold-commissioning and console-control update (2026-11-16) passed 179 unit/
model/session tests, the production build, focused rack/audio/layout browser checks,
the full browser regression and the focused companion check against the final
build. All eight assignments and Hard save/Continue remain covered. The companion
check includes host-owned post-trip rod withdrawal and cold Reset read-backs.


Reactor Start now requires an online process server and control network in both
Auto and Manual, including Hard. Boot uses actual plant time; a computing outage
blocks later starts while existing Manual controls, Stop and ESD remain available.
The Electrical grid station follows Maintenance and uses the same plant/supply
state and commands, with no save-schema or mission-term changes.

The grid-station/startup-interlock follow-up passed 182 unit/model/session checks,
build, focused grid/layout checks, the full browser regression and the focused
companion check. Browser coverage includes all eight assignments and verifies
Hard startup with the rack OFF, explicit native rack power/boot, generation and
save/Continue. Companions cannot bypass the host's Manual startup interlock.

The instrument-server update adds a sixth rack unit, shared-clock server/network/UPS
activity LEDs and powered main instrument displays. Schema 4 migrates versions 1–3
without changing prior plant state or progress. New careers run immediately;
Continue/import/reconnect preserve the user's Pause choice. Verification passed
185 unit/model/session checks, build, focused game/layout checks, the full browser
regression and the focused companion check. Companion coverage includes instrument
shutdown/boot synchronization and desktop ownership of the new hardware.
