<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Nuclear Power game and company progression plan

Status: extended 2026-11-14. Eight operations/maintenance assignments, Easy/Hard
careers, condition monitoring, work orders, water treatment, reports, the Computer systems rack and schema-3
local saves with version-1 migration are implemented. Economy, bankruptcy and
the remaining original catalogue are still planned. See README.md and
doc/game-development.md for current behavior. The catalogue below remains the
larger economy roadmap; the implemented maintenance qualification sequence is
listed in the handoff.

## 1. Agreed direction

Turn the existing control room into an optional company-management game. The
player operates the plant, receives assignments from company staff, sells
electricity, earns more for serving the grid well, and pays for mistakes and
maintenance. Serious mistakes can bankrupt the company.

The following requirements define the design:

- Opening the reactor still allows free operation exactly as today. Playing the
  game requires an explicit **Start game** action.
- Tasks are assigned through a fictional company inbox. The player should not
  have to invent objectives or remember to start their own exercises.
- Assignments include startup, sustained reliable generation, grid requests,
  pump tests, fuel replacement, faults, repair and return to service.
- Money has consequences: electricity earns revenue; damage, maintenance,
  outages and contract failures can consume the company's funds and credit.
- A saved career records the plant, finances, assignments, achieved goals and
  completed-assignment archive.
- Future releases can insert missions between existing milestones without
  resetting careers or invalidating completed work.

All proposed amounts, durations and scores below are starting balance values.
They require playtesting against this fictional plant model before release.

## 2. Existing foundation and changes needed

Read alongside [the feature handoff](doc/nuclear-power.md),
[the app README](README.md) and [the fuel-handling plan](FUEL-HANDLING-PLAN.md).
For the exact implementation, read [the game-development handoff](doc/game-development.md).
The table below is current; later sections specify the intended complete game.
Present-tense descriptions of money, extra mission types, economic restrictions
and company summaries on companions are requirements, not shipped features.

| Area | Already available | Game work needed |
| --- | --- | --- |
| Startup | Cold plant, explicit pumps, startup checks and assigned startup hold | Further commissioning/operating assignments |
| Objectives | Eight missions using generation, condition-round, work-order and water-quality evidence; capabilities, reports and achievements | Grid contracts, economic consequences and monetary rewards |
| Grid controller | Capacity-aware gross MW requests, Auto following and status | Contracts, response scoring, electricity settlement and company messages |
| Equipment | Four independent pumps, cutaways, condition rounds, isolated work orders and functional tests | Further diagnosis and paid work orders |
| Failures | Symptom-first scenarios, progressive faults, wear and retained damage | Scheduled incidents, diagnosis tasks and repair costs |
| Fuel | Assembly reserves, explicit replacement and interlocks | Assigned outages, paid replacement and durable service receipts |
| Pool | Representative batches, 35 racks, cooling and dispatch | Authoritative business records and paid dispatch |
| Journal | Bounded events/incident cause plus a saved company inbox, reports and achievement archive | Financial receipts and fuller shift/debrief reports |
| Companion | Desktop host, mirrored state, validated commands and host-routed fuel replacement | Read-only mission/finance summaries and host-owned game actions |
| Persistence | Schema-3 IndexedDB saves, tested version-1/2 migrations, JSON backups and one writer tab | Recovery UI and economic state |

Keep fuel assemblies separate from control rods. An assignment to change fuel
means replacing fuel assemblies, not replacing or removing control rods.

## 3. Entry, modes and session ownership

### Free operation remains the default

Keep `/`, `/reactor/` and `/companion/` and their existing navigation behavior.
The reactor opens in **Free operation**, with today's cold default plant and
controls. No company debts, assigned incidents or contract deadlines run here.
Existing objectives and scenario controls remain available for experimentation.

Add **Start game** and, when a save exists, **Continue game** to the reactor
header. Starting a game opens a short company introduction, difficulty summary
and **Begin career** action. This is the only entry to the economy.

Beginning a career creates its own cold plant with the normal Auto/electrical
defaults. It does not convert an arbitrary running free-operation plant into a
profitable career. Park the free-operation session in memory while the career
is active; returning within the same page restores it. Only the active session
ticks. Do not require another renderer or a second background simulation.
Switching sessions stops the old session's motion/audio through the existing
lifecycle and ends its pairing room. A companion must pair to the selected
session; an old command can never operate a different free-operation/career plant.

### In a game

Show **Company**, **Inbox**, **Assignments**, **Achievements** and
**Save & return to free operation**. Returning saves and freezes the career;
free operation cannot change its wallet or complete its missions.

Reloading `/reactor/` still opens free operation. **Continue game** restores the
saved career at its saved simulated instant, initially paused, with an explicit
**Resume shift** action. There are no offline earnings, interest or failures.

Use one local career slot initially, with export/import for backup. Starting
another career must explicitly explain that it replaces this slot. Keep a
separate archived result for a finished or bankrupt career until replaced.

### Difficulty

- **Easy:** Auto and Manual operation are available.
- **Hard:** Manual operation only; enabling Auto is rejected by the plant model,
  including paired-screen commands. Difficulty is saved for the whole career.
- New power assignments accept actual Manual operation. Qualifying Manual time
  accumulates; out-of-envelope conditions pause progress without a failure deadline.
  Verified success stays ready until reported. Auto keeps continuous holds.
- Migration treats older careers as Easy and preserves already issued terms.
- Free operation remains independent, with Auto available. Costs, limited credit
  and bankruptcy remain planned, with no separate economy balance for difficulty yet.

## 4. Company inbox: how work reaches the player

The inbox is an in-game interface with authored messages. It does not send real
email, require an email address or connect to an external mail service.

| Sender | Assignments and messages |
| --- | --- |
| Plant manager / boss | Shift brief, startup authorization, priorities, reviews and warnings |
| Grid operations | Dispatch contract, demand changes, service assessment and settlement |
| Maintenance lead | Tests, suspected faults, inspection findings, work orders and readiness |
| Fuel and logistics | Low-reserve planning, replacement assignment and pool collection |
| Finance | Income statements, repair invoices, credit warnings and insolvency notice |

The first message is from the plant manager: get the plant running, establish
reliable generation, then report readiness for a grid contract. Later messages
follow actual progress: a successful startup brings the next assignment; a
falling-flow incident produces a maintenance request; low funds bring a finance
warning. The boss reacts to outcomes rather than sending unrelated flavor text.

Every assignment message includes:

- Why the company needs the work and which equipment is involved.
- **Accept assignment** or **Acknowledge assignment**, as appropriate. Mandatory
  work may already be assigned; leaving its email unread does not postpone it.
- Observable completion criteria, allowed operating modes and required sequence.
- When the deadline starts, any planned outage window and what it pauses.
- Reward, estimated costs, maximum contract penalty and known risk.
- **Track assignment** and **Inspect equipment** shortcuts.

One primary assignment and at most two related supporting tasks should be active
at once. Upcoming work is visible but does not create a wall of urgent messages.
Deliver follow-ups at suitable plant states and avoid stacking beginner failures.

Routine dispatch messages remain in the existing Grid controller card, linked
to their contract thread. Summarize them in the inbox rather than creating an
email every 60 seconds. Deduplicate messages by durable event IDs.

Alarms remain immediate plant indications. Reading an email, acknowledging an
alarm or clicking **Report complete** cannot substitute for actual recovery.

## 5. Game loop and mission lifecycle

The recurring loop is:

```text
Company assignment -> review and prepare -> operate/test/diagnose
                   -> verified result -> company report and settlement
                   -> maintenance/fuel planning -> next assignment
```

Assignments should make Auto useful while leaving the player meaningful work:
prepare equipment, preserve capacity, inspect trends, manage backups, plan
outages, diagnose failures and decide when to stop. Repeated slider movement is
not itself a task or a scoring category.

Proposed mission states:

```text
LOCKED -> AVAILABLE -> ASSIGNED -> ACTIVE -> READY_TO_REPORT -> COMPLETED
                                         -> FAILED / CANCELLED / SUPERSEDED
```

`ASSIGNED` means the company has issued the work. `ACTIVE` begins at its stated
trigger: acceptance, shift start, fault onset or an agreed maintenance window.
Automatic verification makes work `READY_TO_REPORT`; the report presents the
result and commits its one-time reward. It never completes a missing plant step.
Unreported finished work remains finished across reloads and content updates.

Use distinct objective semantics:

- **Sequence:** circulation established before reactor Start; cooled isolation
  before repair; explicit restart after service.
- **Continuous hold:** remain in the stated healthy operating envelope for five
  uninterrupted simulated minutes. A sustained violation resets that hold and
  explains why; ordinary bounded fluctuations use a defined tolerance.
- **Accumulation:** deliver a stated quantity of electricity during a contract.
- **Evidence:** test a named pump, replace specified assemblies, dispatch a named
  batch, or complete a repair after this assignment began.
- **Recovery:** contain a fault, restore capability, then prove stable operation.

Every timed criterion declares whether it resets, pauses or fails on violation.
Hard failure is reserved for disclosed contract conditions, deadlines or terminal
incidents. A sensible operator Stop or emergency shutdown is always available;
it may interrupt delivery, but must not incur an arbitrary button-press fine.

All time comes from the host plant's advanced simulated time. Pause, hidden-host
suspension, detach and browser closure cannot advance deadlines or economics.
A visible paired companion may keep the host clock active under today's rules.
Opening Maintenance or an offscreen process viewport does not stop plant time.

## 6. Initial mission catalogue

Plan for **20 authored assignments across five chapters**. The first two are
implemented as commissioning; the first six together form the planned initial
company/economy slice. Some assignments span several operations;
these are not twenty copies of the same stable-output timer.

The current free maintenance chapter additionally implements condition rounds,
preventive pump/filter/intake orders, water-quality proof and return to generation.
Its eight current assignments are listed in `doc/game-development.md`. The table
below continues to describe the larger economic catalogue; assigned paid faults,
contracts and fuel logistics remain planned.

Chapter order describes the intended learning path, not numeric prerequisites.
Use explicit stable IDs and capability requirements as described in section 14.

| ID | Assignment / issuer | Required result |
| --- | --- | --- |
| `startup.first-shift` | First shift / Boss | From the cold career plant, establish actual circulation, explicitly start, and hold the brief's attainable gross MW target for 30 seconds |
| `operation.reliable-five` | Prove reliable operation / Boss | Generate for five uninterrupted minutes within the defined operating envelope, with no new retained damage or unresolved critical condition |
| `grid.first-contract` | First supply contract / Grid | Serve three issued requests and reach the published service score; assess actual response rather than accepting target changes as success |
| `pumps.acceptance-tests` | Test all four pumps / Maintenance | During a planned stopped/cool window, run A, A2, B and B2 individually; observe actual speed, flow and pressure for ten seconds each, then return to the requested configuration |
| `maintenance.first-repair` | Falling primary circulation / Maintenance | Diagnose a scripted mechanical restriction, contain it, clear the diagnosed defect through a paid work order, repair retained damage if present, and satisfy all isolation/cooling checks |
| `operation.return-to-service` | Return the unit to service / Boss | Current free chapter: explicit restart after preventive service and 60 qualifying seconds at 200 ± 5 MW; later paid fault recovery can extend this objective in future issued terms |
| `diesel.standby-proof` | Prove standby engines / Maintenance | In a planned test window, start each diesel, observe actual running state, stop it and restore the specified standby readiness |
| `fuel.selective-outage` | Replace low-reserve fuel / Fuel | Identify the assigned low-reserve assemblies, shut down and cool, then replace those assemblies through existing interlocks |
| `fuel.pool-collection` | Clear a cooled batch / Logistics | Dispatch the assignment's authoritative cooled batch to its stated destination; verify assembly count and pay the quoted fee |
| `grid.load-following` | Variable demand shift / Grid | Serve a longer raise/lower sequence, maintain capacity and achieve a higher service grade without overload damage |
| `pumps.primary-backup` | Transfer primary duty / Maintenance | Prepare and prove A2, transfer duty from A within a validated pressure/flow envelope, and leave A stopped as instructed |
| `pumps.secondary-backup` | Transfer secondary duty / Maintenance | Repeat the duty-transfer skill on B/B2, with independent test evidence |
| `cooling.warm-return` | Investigate warming return / Maintenance | Use condenser readings/trends to find reduced heat rejection, contain it, remediate the cause and verify recovery |
| `exchanger.planned-clean` | Restore transfer capacity / Maintenance | Carry out a scheduled cooled exchanger inspection/clean when due and prove recovered transfer; do not allow running cleaning to bypass service checks |
| `pipework.isolate-inspect` | Pipework outage / Maintenance | Stop both pumps in the affected loop and wait for actual flow/motor stop; repair existing damage, or complete the healthy inspection variant |
| `turbine.service-window` | Turbine service / Maintenance | Stop and cool, wait for the shaft service threshold, service due wear/damage, then perform explicit turbine recovery and breaker closure when ready |
| `supply.loss-of-normal-power` | Supply interruption / Boss | In an authored, recoverable supply scenario, retain or restore powered cooling, contain the incident, and verify normal supply restoration |
| `fuel.outage-budget` | Fuel outage on budget / Finance + Fuel | Complete a specified selective replacement and dispatch plan inside a disclosed budget, then return to generation |
| `grid.peak-contract` | Peak demand commitment / Grid | Meet a higher but capacity-checked commitment while preserving equipment; unsafe overdrive is not an objective |
| `company.independent-shift` | Run the shift / Boss | Complete at least 15 minutes of operation, a grid contract and one eligible maintenance incident, finishing with serviceable equipment and a solvent company |

Suggested chapters: commissioning (1–4), maintenance and standby (5–7), fuel
logistics (8–9), operating responsibility (10–17), and company performance (18–20).
Use practical chapter names in the UI; display numbers are presentation only.

Aim for an initial guided session of roughly 15–25 active minutes and later shifts
of 20–40 minutes. These are playtest targets, not reasons to shorten cooldowns or
pretend the plant can reach a target faster than its actual dynamics allow.

### Authoring rules

- Startup missions begin cold. Later career work continues from the actual plant
  rather than silently loading a pristine replacement fixture.
- Fixed-output commissioning briefs instruct the operator to disable grid
  following and choose the stated target; the later grid brief requests following
  again. Do not let a changing 45/60-second target invalidate a fixed-target hold,
  or silently change the operator's settings to satisfy the assignment.
- Practice can use declared starting fixtures, including worn equipment or low
  fuel, without changing a saved career.
- Only assign repair when a real defect/damage/service need exists. Healthy
  equipment gets an inspection variant; do not force the player to break it.
- Seed the fuel tutorial with a disclosed low-reserve assembly at career creation,
  or wait for natural reserve decline. Do not abruptly drain fuel to unlock a task.
- Pump tests can begin stopped. Running duty transfers unlock later; never teach
  turning both parallel pumps to full speed as the required solution.
- Supply-loss briefs must distinguish grid availability, turbine auxiliary feed
  and export. Losing external supply alone may leave turbine-fed pumps running.
  A diesel exercise must deliberately establish the required supply conditions.
- Missions use the current repair, refuelling, shaft and trip checks. No task
  changes simulation protection thresholds to become easier or harder.

## 7. How faults become assigned work

Use an incident director that selects from the existing causal fault mechanisms.
It creates a defect and a company assignment, not a random instant explosion.

Early incidents are authored and announced as symptoms: flow drifts down despite
unchanged speed, return temperature rises, or output becomes uneven. Inspection
and trends expose the likely component. A hint can reveal the cause; the result
records assistance, without making the player unable to complete the assignment.

Later shifts choose incidents from a saved seed and eligibility rules: current
chapter, actual wear, load, backup availability, cooling and outstanding work.
Initially allow only one assigned incident at a time, with at least three active
minutes after recovery before another. Never inject a second beginner fault
during shutdown/refuelling. Physical damage from the player's actions still runs.

A typical maintenance thread is:

1. Boss/maintenance email reports the symptom and requests inspection.
2. Player inspects, reduces demand or stops, and establishes cooling.
3. Maintenance supplies an itemized remediation/repair quote.
4. Player explicitly clears the diagnosed defect and repairs retained damage
   once the existing readiness checks permit it.
5. Player restores configuration and explicitly returns to service.
6. The company receives a report with cause, downtime, costs and recovery proof.

In Career, free injected-fault clearing/debug controls cannot erase a mechanical
defect for free. Route its explicit clearance through a quoted work order; this
does not heal retained damage. If clearance is gradual, its work-order state
waits for actual clearance before permitting the existing repair action. Cost
and completion receipts must survive reload between those steps.

Distinguish external events from repairable defects: restoration of utility
supply is a scenario event, not a pump repair invoice. Catching a restriction
early may avoid retained damage and the additional repair cost. Do not force
unnecessary damage or service just to finish a mission.

## 8. Electricity sales and the company ledger

Use fictional **credits (Cr)**, with no real money or live electricity-price feed.
Start with one fixed tariff; market-price simulation can be added after the
operating and bankruptcy loops are balanced.

### Separate gross generation, settlement export and grid performance

The existing electrical instrument and dispatch targets are **gross generator
MW**. Keep that contract. Selling power needs a separate, clearly labeled
settlement quantity; do not silently relabel the existing reading as export.

Proposed first-release accounting abstraction:

```text
G = actual gross generator MW
A = actual served auxiliary demand MW, bounded by bus availability
settlement export MW = export available ? max(0, G - A) : 0
settlement import MW = external grid supplies the shortfall ? max(0, A - G) : 0
energy MWh = integrated settlement MW * advanced simulated seconds / 3600
```

This is a single-site business balance, not a new physical meter model. Auxiliary
use is deducted once before selling, regardless of the selected bus source;
switching the auxiliary feed cannot create extra sellable energy. Do not also
charge the same deducted load as an additional full grid purchase. Diesel fuel
consumption remains a separate expense and never counts as saleable generation.

Give authored grid outages an explicit export-availability state. The current
grid-available auxiliary switch is not by itself a modeled export connection.
Normal game grid-loss events set the appropriate supply/export states together;
isolating a turbine auxiliary feed does not disconnect export by implication.

Base sales use an agreed gross delivery ceiling converted to settlement export.
Generation above the contracted ceiling plus the published tolerance earns no
additional payment. On a lower request, a declared ramp envelope prevents
instant loss of payment for expected coast-down. This makes deliberate excess
generation a poor way to outperform a well-served contract.

The company has a standing modest supply agreement between specialist contracts,
so it can still earn money after onboarding. A maintenance window suspends its
delivery obligation as stated in advance; it does not suspend plant time or
ordinary actual operating costs.

### Starting balance proposal

| Item | Initial proposal |
| --- | --- |
| Starting cash | 50,000 Cr |
| Approved credit limit | 25,000 Cr; no automatic increase |
| Base sale tariff | 1,000 Cr/MWh |
| Grid service premium | 0–50% of eligible electricity-sale revenue |
| Imported electricity | 1,200 Cr/MWh of settlement import |
| Fixed company overhead | 1,000 Cr per active simulated hour |
| First-clear milestone payment | Typically 2,000–6,000 Cr, disclosed in the brief |
| Mechanical fault remediation | Itemized quote, initially around 1,000–3,000 Cr |
| Pump repair | Damage-based quote, roughly 2,500–12,000 Cr |
| Major turbine restoration | Roughly 15,000–60,000 Cr depending on loss |
| Fresh fuel | 2,000 Cr per assembly; selected replacement encourages planning |
| Diesel refill | Proportional to missing fuel, initially 20 Cr per percentage point |
| Storage dispatch | 200 Cr per batch + 50 Cr per represented assembly |
| Reprocessing dispatch | 400 Cr per batch + 100 Cr per represented assembly |
| Credit interest | Initially 1% of drawn debt per active simulated hour |

Reprocessing initially provides only its assignment/logistics outcome. It does
not instantly return fresh fuel or create a profitable replacement/refund loop.
All bulk actions show the total quote and covered components/counts.

Example: 200 gross MW with 6.2 MW served auxiliaries yields 193.8 settlement MW.
One active minute delivers 3.23 MWh and earns 3,230 Cr base revenue. A 95% service
score adds 1,534.25 Cr at the 50% maximum premium. Show overhead, interest and
other expenses separately so the player can explain the resulting profit.

Treat these rates as game pacing. Do not multiply plant time or pretend fuel's
existing 1x/10x/60x exposure setting accelerates revenue or deadlines. Career
fixes its declared fuel rate; only practice exposes free acceleration controls.

### Financial integrity

- Keep cash, drawn debt, due invoices, sales, premiums and expenses distinct.
  Show available funds as cash plus undrawn approved credit minus reservations.
- Publish itemized quotes before elective work. Reject an unaffordable purchase
  before changing fuel/equipment; automatic obligations become due invoices.
- Debit only a successful actual change. Repeated clicks, blocked repairs,
  already-full fuel tanks and duplicate dispatches cannot create charges.
- Use durable operation IDs. A bulk repair/replacement has one atomic receipt;
  partial failure must not leave half the debit or duplicated fuel/batches.
- Keep integer subcredits with fractional integration carry, avoiding a rounding
  bias from charging/earning on every 250 ms tick.
- Record aggregate energy settlements periodically and on contract boundaries;
  keep mission/financial receipts independently of the rolling plant journal.
- First-clear rewards pay once per stable career milestone. Practice, replay,
  email reopening, reload and Reset demo cannot farm them.

## 9. Reward serving the grid well

Score **actual gross electrical output against an achievable request response**,
not the requested slider value, checkbox state or an acknowledgement email.
Both oversupply and undersupply reduce service quality.

The current dispatcher delivers its first request after 45 ready seconds and
then every 60 ready seconds. Existing grid tests verify final convergence over
several simulated minutes; they do not prove every step settles within 60
seconds. A feasibility/balance spike is therefore required before fixing scored
response windows.

For each contract request, freeze its ID, requested gross MW, available capacity,
tolerance, response envelope, effective interval and scoring rules when issued.
Use a validated reference ramp `R(t)` toward the requested output, maintaining
continuity when the next request arrives. Never rebuild that reference from the
player's later actual output or lower it when they damage equipment.

Proposed initial scoring shape:

```text
tolerance MW = max(5, 3% of the request's gross target)
excess error MW = max(0, abs(actual gross MW - R(t)) - tolerance MW)
instant quality = clamp(1 - excess error / max(10, 15% of abs(R(t))), 0, 1)
contract service score = time-weighted mean quality over obligated active seconds
service premium = eligible base sales * 50% * interval service quality
```

The exact reference envelope must come from measured model response, not an
invented short grace period. Ordinary healthy Auto operation must score well;
good equipment preparation and recovery should improve results over a neglected
plant. If that cannot be achieved with current dynamics/cadence, revisit Career
contract step sizes/envelopes before release and document the explicit change.

Rules that prevent scoring loopholes:

- Turning off Follow requests, changing mode, stopping or opening a breaker does
  not pause an accepted contract's obligation clock. The physical dispatcher may
  suspend as today; the company's existing delivery obligation remains recorded.
- Default Auto following stays supported. No extra reward is granted merely for
  moving targets manually; maintaining the plant is part of good operation.
- Capacity is assessed when work is offered. New damage/overrides do not rewrite
  an accepted obligation. Future offers may use honestly reduced capacity.
- Planned maintenance and declared company-directed outages have agreed scoring
  exclusions. Disclose those before the window, not after a poor result.
- Scripted external force-majeure events can waive contract penalties explicitly;
  player-caused damage or deliberate disconnection cannot claim that waiver.
- **Request now**, manual scenario injection and free fuel acceleration remain
  practice tools; they cannot skip difficult paid contract intervals in Career.

Most early contracts reduce the premium when service is poor, without a fine.
Later contracts may include a capped non-delivery charge stated in the brief.
Never charge both a forfeited bonus and an unexplained duplicate penalty.

## 10. Bankruptcy and meaningful failure

Bankruptcy is a supported end state. Large mistakes must be capable of ending a
career, even if the player completed earlier missions successfully.

The financial path is visible:

```text
Profitable -> cash warning -> credit drawn -> invoices at risk -> BANKRUPT
```

Warn when cash falls below 10,000 Cr, when credit is first used, and when total
remaining liquidity falls below 5,000 Cr. Each warning links to actual bills,
repair options and the company's next delivery opportunity. The boss can order
a planned shutdown; Finance identifies the amount and deadline needed to recover.

An unaffordable elective fuel order is blocked, not an immediate bankruptcy.
For mandatory unpaid obligations, issue a final demand with a disclosed grace
period, initially two active simulated minutes. **Bankruptcy occurs when a due
invoice remains unpaid at that deadline and cash plus undrawn approved credit
cannot cover it.** Grace time follows plant time; pausing cannot accrue charges.
Receiving genuine revenue during grace can still save the company.

Damaging a turbine, repeatedly ignoring maintenance, losing delivery contracts
and consuming fuel/imports during an extended outage can exhaust both cash and
credit. A catastrophic incident may create a disclosed major asset-loss invoice,
initially around 250,000 Cr. This should exceed an early company's means.

Keep asset loss and insolvency distinct: meltdown always ends this plant's
operating run under the existing model; call the company bankrupt only when the
financial test is met. A solvent company with an unrecoverable plant gets a
**Plant lost** result. Rebuilding another plant is outside the initial release.
For terminal asset loss, perform a disclosed immediate closeout: settle earned
receivables and make the loss invoice due, then test the remaining liquidity.
The ordinary operating grace period does not postpone this terminal result.

On bankruptcy:

- Stop taking new contracts and settle outstanding money/rewards once.
- Freeze the career into a persisted debrief with debt, causes, achievements,
  dispatch performance, incident evidence and the final plant state.
- Show a Finance insolvency message and Boss's final report, with export,
  inspection, free-operation and **Start new career** actions.
- Preserve emergency controls while the live run is being contained. Ending
  the career never silently resets a trip, repairs damage or restarts anything.
- There is no automatic unlimited bailout. A new career is an explicit new
  company; it cannot retain the failed company's wallet or reclaim its rewards.

Small mistakes should be recoverable through lower profits and planned repairs.
Early mandatory training work must be affordable from the starting budget or
have a fixed, disclosed company allocation. Avoid an economy that demands an
unfunded repair before allowing the player their first electricity income.

## 11. Fuel and maintenance: first-release scope

Keep existing explicit repair/refuelling interlocks, retained heat, damage,
operating hours, settings and both trip latches. Paying never bypasses readiness.
No mission, boss email or automation refuels, repairs, resets or starts equipment
on the player's behalf.

The present crane is cosmetic and its batches are representative. Money and
mission completion cannot depend on a WebGL frame, the camera remaining visible,
or an animation callback that can be cancelled by Start or view changes.

For Career's first fuel mission:

1. Validate funds, selected assembly IDs/count, stopped/cooled readiness and a
   free representative batch slot before committing replacement.
2. Commit the debit, actual fuel renewal, service receipt and authoritative
   representative batch together. Each batch retains the real assembly count.
3. Record logical placement on the plant clock at that commit and apply the
   existing 60-simulated-second demo cooling gate to that business record.
4. Let the crane illustrate that already-recorded batch without creating another
   batch or deciding whether the purchase succeeded. Visual interruption cannot
   lose paid fuel, a shipment obligation or its record.
5. Validate and charge cooled dispatch atomically; freeing the rack and the
   shipment receipt must occur together.

This intentionally adds authoritative Career records beyond today's
presentation-driven deposition. Free operation keeps its existing behavior.
The UI must describe representative **batches**, not pretend 35 displayed racks
are a complete physical inventory for 49 individual core assemblies.

Full per-assembly spent inventory, empty core channels, crane-owned fuel,
queued insertion jobs and fresh-fuel stock remain the separate expansion in
[FUEL-HANDLING-PLAN.md](FUEL-HANDLING-PLAN.md). Do not make those prerequisites for
the first company game. Reduced motion changes visuals only, never cost,
replacement success, cooling time or mission credit.

Initial repairs remain explicit actions after real cooldown/isolation; do not
add long repair timers merely to stretch a mission. Repair-time jobs, crews and
parts inventories can follow once the operating/economic loop is enjoyable.

## 12. Where status, achieved goals and history live

Keep the existing control-room layout. Add a compact game strip with company
cash, available credit, active assignment, contract service score and inbox
unread count. Equipment detail stays in its existing dialogs.

| Place | Contents |
| --- | --- |
| Inbox | Threads, senders, assignment briefs, decisions, follow-ups and finance warnings |
| Assignments | Active objective, live criteria, timers, blockers, upcoming work and chapter progress |
| Assignment archive | Completed/failed assignment reports, dates in plant time, assistance, costs and earned payments |
| Achievements | Permanent career milestones with evidence and completion time |
| Company | Cash, debt, payable invoices, revenue/cost breakdown, net profit and save status |
| Shift report | Delivery, service grade, incidents, downtime, maintenance/fuel costs and next priorities |

Examples of durable achievements: **First generation**, **Five reliable
minutes**, **First grid contract**, **All pumps tested**, **First repair**,
**Fuel outage completed**, **Backup supply proved**, and **Independent shift**.
Cash rewards belong to named mission milestones; achievements do not duplicate
those payouts. A later incident never deletes previously earned achievements.

The archive stores exact goal evidence independently of the newest 200 plant
events. Historical reports show the requirements/version that were actually
completed, even if a later release changes that mission.

Messages and game dialogs use the current keyboard, focus return, dragging,
viewport clamping, mobile scrolling, light/dark and reduced-motion conventions.
Avoid opening a blocking email over an active incident. Briefing and debrief
can deliberately pause, with their clock behavior explicit.

The companion displays the current task, relevant company messages and finance
summary. Desktop remains the game owner for accepting contracts, purchases, bulk
maintenance, saves and new careers. Companion selected/all fuel replacement is
already supported through the authoritative desktop and must retain its checks. Any already-supported paid
equipment command from a companion must use the same host-side cost/readiness
guards. Companions never settle money or advance missions independently.

## 13. Local saves and authoritative state

Use **IndexedDB** for the career bundle, with a versioned serialization adapter.
Keep theme preferences as today. No Spring/account system, cloud database or
relay-side simulation is needed for this first release.

The bundle contains:

- Career ID, company name, difficulty, save schema and economy rules version.
- Actual and requested plant state, thermal inertia/heat, fuel, hydraulics,
  equipment condition, shaft state, trips, diesel state/fuel and grid dispatch.
- Sampled turbine tolerance, scenario seed/random-generator state and incident
  schedule, so resume cannot reroll a failure or a serviced rotor.
- Wallet, debt, invoices, integration remainders, reservations and durable
  transaction/operation IDs.
- Logical fuel batches, cooling times, shipments and completed service receipts.
- Mission instances, pinned assignment terms, objective evidence, achievements,
  inbox/read state and archived reports.
- Content seen, stable progression capabilities and active contract clocks.

Do not treat the existing companion snapshots as a complete save format: they
serve a different purpose and omit runtime state needed for exact continuation.
Restore class behavior through explicit adapters; never persist DOM, sockets,
WebGL resources, timers or playing audio voices.

Save the whole mutually consistent bundle at least every five advanced seconds
and immediately after purchases, reported goals, issued contracts and critical
events. Plant effects, charges and completion IDs share one committed revision.
Keep a previous valid revision for recovery. A crash may lose the last unsaved
few seconds; it must not retain a reward while rolling back its associated cost.

Detect save-write failure visibly and retain the previous valid revision; offer
export rather than claiming success. Provide JSON export/import with schema,
bounds and reference validation. Local storage is not secure against deliberate
editing; competitive leaderboards and server-authoritative economies are out
of scope.

Only one tab may write a career. Use a browser lock/lease and revision checks;
a second tab offers read-only status or an explicit takeover that pauses the old
owner. Companions remain followers of that owner, not additional save writers.
Reload/resume establishes a new pairing session under the existing relay rules.

Keep **Reset demo** in free operation. Career offers **Restart assignment** only
where a declared checkpoint exists, rolling back plant, wallet and mission state
together. It never refunds expenses while keeping the improved equipment. A
career restart/new career remains separate from trip reset and ordinary Stop.

## 14. Adding missions between existing progress later

Treat content evolution as a first-release requirement. A save must not contain
only `currentMissionIndex = 7` or assume that a chapter is an immutable array.

### Stable identities and prerequisites

- Mission definitions have permanent semantic IDs, such as
  `pumps.acceptance-tests`, separate from display order, title and chapter.
- Definitions include a content version, prerequisite capabilities/milestones,
  applicability rules, delivery trigger, objectives, rewards and retirement policy.
- Persist completed IDs and earned capabilities, not just a cursor into the
  current content list. Never reuse a retired ID for different work.
- Use a dependency graph with explicit alternatives when appropriate. Tests must
  catch missing prerequisites, cycles and unreachable content.
- Save-schema version, mission-content version and economy-rule version are
  independent. Adding an email/mission should not require changing plant saves.

### Insertion example

Version 1 contains:

```text
First startup -> Reliable operation -> First grid contract
```

Version 2 adds **Condenser readiness inspection** between the first two:

```text
First startup -> Condenser inspection -> Reliable operation -> First grid contract
```

For a new career, use the new sequence. For an existing career:

| Saved progress | Delivery of the inserted mission |
| --- | --- |
| Startup not completed | Include it in the normal upcoming sequence |
| Startup completed, reliable-operation assignment not issued | Offer it next at a suitable inspection window |
| Reliable-operation assignment active | Keep that assignment's terms; queue the inspection after it |
| Reliable operation / grid contract already completed | Send a new maintenance catch-up assignment; preserve completed work and unlocked capability |
| Prior campaign finished | Offer a continuation message/chapter; keep the earlier completion certificate |
| Career bankrupt/archived | Keep the archive unchanged; new content is available in a new career or practice |

The new mission can appear in the middle of the displayed chapter without
retroactively locking advanced equipment, removing achievements or demanding
a repeated cold startup. If its original setup is impossible in the current
plant state, offer an equivalent planned test window under its catch-up policy.
Genuinely inapplicable historical prerequisites can receive a documented waiver,
distinct from mission completion and without a cash reward. The original
exercise remains available in practice; practice cannot pay a career reward.

### Existing assignments and changed definitions

Pin an issued assignment's objective parameters, rewards, penalties, deadline,
content version and evidence rules in its saved instance. Updating the app does
not silently make that contract harder or replace its bill with a higher one.
Likewise retain existing invoice/quote amounts and contract tariffs. An economy
rules update affects future disclosed offers/actions, not money already owed
or an active delivery agreement.

For a corrected or retired mission, ship an explicit policy: retain the old
evaluator until completion, migrate evidence to an equivalent objective, or
cancel/supersede it without penalty and send an explanatory company message.
Never leave a save depending on removed executable mission logic.

New mandatory prerequisites affect future assignment issuance. For players who
already earned the downstream capability, use a catch-up assignment rather than
revoking it. Do not make the entire campaign complete status depend on blindly
completing every mission in whatever content catalogue is installed today.
Record chapter certificates against their content revision; new chapters extend
the career instead of erasing the old result.

On content discovery, reconcile once per durable content version, generate
deduplicated company messages and save the outcome. New incidents, costs and
deadlines start only when actually issued in advanced plant time. No update can
bankrupt an offline company with retroactive obligations.

## 15. Implementation boundaries

Proposed modules, following the existing plain-JavaScript simulation style:

| Responsibility | Proposed location / integration |
| --- | --- |
| Game session and assignment lifecycle | New `nuclear-power-game.js`, called by the authoritative host |
| Mission catalogue and prerequisites | New mission-content module, with versioned definitions and declarative criteria |
| Company inbox | New company-message model plus inbox UI module |
| Electricity settlement and finances | New economy module, separate from gross generation calculation |
| Incident scheduling | New scenario-director module wrapping existing fault mechanisms |
| Save/reload and migrations | New persistence module with explicit plant/game serializers |
| Status, reports and achievements | Small game UI modules using existing dialogs/styles |
| Plant integration | Existing model, component, fuel, supply and grid modules through guarded actions/events |
| Companion integration | Versioned session state/protocol extension; host-owned validation and effects |

Advance game evaluation once per actual plant step, after actual readings and
condition have been updated. Integrate elapsed energy over the step, splitting
at request/deadline boundaries when needed. Game rendering never earns revenue.
Command events distinguish requested action, successful effect and rejected
action. Mission evidence consumes successful effects/read-backs only.

Choose one authoritative event path for financial side effects, including
component-level and companion commands; charging only UI buttons would leave
bypass paths. Scenarios request existing fault actions rather than introducing
a second incompatible damage model. Do not build a parallel React simulation.

## 16. Delivery sequence and acceptance gates

### Phase 0 — model and economy feasibility

Status: startup at 200 MW was measured. Contract response envelopes and economy
balancing remain the next prerequisite before paid contracts.

Measure cold-start, target-step, cooldown, backup transfer and recovery times.
Prototype scoring calculations outside the UI, using deterministic plant runs.
Balance a successful shift, a recoverable mistake and a deliberately destructive
run. Healthy Auto should achieve a good service score; major repeated mistakes
should be capable of producing insolvency.

Gate: agree measured mission tolerances, request-response envelopes, starting
budget and catastrophic-loss treatment before shipping monetary contracts.

### Phase 1 — optional game shell, inbox and durable progression

Status: operations/maintenance chapter and version-1 save migration implemented.
See the continuation handoff for current behavior and remaining recovery/economy gaps.

Add explicit game entry/return, separate career ownership, saved mission graph,
company inbox, live objectives, archive, achievements and IndexedDB persistence.
Implement startup and reliable-operation assignments first.

Gate: today's free operation still works; a career can be paused, reloaded and
continued without losing a step or inventing offline progress. Prove insertion
of a new mission into an existing save already in this phase.

### Phase 2 — first complete company game

Deliver the first six catalogue assignments, paid generation, grid premium,
pump acceptance tests, an assigned fault, priced repair, return to service,
credit warnings and bankruptcy/debrief. Treat this as the smallest complete
release, not a finished game after adding only a cash counter.

Gate: the player can start, receive work, earn, spend, make a costly mistake,
repair and recover, or go bankrupt; all outcomes survive reload.

### Phase 3 — fuel, standby and operating variety

Expand toward the full 20-assignment catalogue, authoritative representative
fuel records, paid replacement/dispatch, diesel proof, running backup transfers,
cooling diagnoses, turbine service and longer contracts. Add balanced later
incident selection and complete shift reports.

Gate: fuel/pool progress is independent of graphics, assignments stay applicable
to the actual plant, and the catalogue supports several distinct saved shifts.

### Phase 4 — continued content and balance

Add further company threads and missions using the insertion policies, more
contract variants and further difficulty balancing. Easy/Hard control ownership
already exists. Consider upgrades, insurance,
crews, a larger physical fuel inventory or another plant only after the core
game is enjoyable. Accounts, multiplayer, cloud saves, real mail, real money and
hardware control remain separate proposals.

## 17. Verification plan for future implementation

Use deterministic model tests for mission and financial rules, plus focused
browser coverage for the actual game flow. Changes to this plan alone do not
require an application build; implementation changes require the checks below.

Required model coverage:

- Startup order; continuous versus accumulated timers; transient tolerance;
  wrong-pump evidence; repairs/fuel that happened before assignment acceptance.
- Healthy grid following; oversupply/undersupply; source switching; accepted
  obligations during Stop/Manual/disconnection; capacity changes; contract edges.
- MW-seconds to MWh conversion; auxiliary deduction exactly once; zero/islanded
  output; fractional carry; no diesel export or visual-frame-driven revenue.
- Affordable/blocked/no-op/bulk purchases; repair/clearance ordering; atomic fuel
  and pool effects; duplicate command/report protection; bounded penalties.
- Cash/debt/invoice accounting; grace recovery; insolvency; catastrophic but
  solvent asset loss; no automatic bailout or reset-driven money farming.
- Save at every mission stage and purchase boundary; restored inertia, trips,
  seeds and sampled tolerances; corrupt/old saves; failed writes; two-tab ownership.
- New mission before/after completed work; active pinned contracts; catch-up
  applicability; retired missions; preserved chapter certificates; reward IDs.
- Pause/hide/detach/resume, companion-owned visibility, and zero offline time.

Browser coverage must include free-operation defaults, Start/Continue, inbox
assignment/report/archive, achieved goals, save/resume, bankruptcy, both themes,
keyboard/mobile use, and stale/disconnected companion restrictions. Verify that
reduced motion/WebGL loss does not change earnings, fuel receipts or objective
completion.

Run focused unit checks and `npm run build` during implementation. Use
`npm run test:browser:equipment` and `npm run test:browser:companion` where those
areas change. `npm run test:browser:game` is the existing focused company-game
entry and is also reused by the full browser suite. Reserve the full browser
regression for broad integration/release gates.

## 18. Decisions to validate before coding the economy

The product direction above is settled by the user's requests. These narrower
design values remain proposals to validate, without blocking the plan:

1. Measured grid response envelope and mission durations that fit the current
   plant dynamics and 45/60-second request cadence.
2. Exact tariff, repair quotes, credit/grace settings and the target profitability
   of careful operation versus the losses from major mistakes.
3. Which optional delivery penalties begin after the first contract, with their
   maximum exposure always visible before acceptance.
4. The first fuel tutorial's starting reserve setup and the distinction between
   authoritative Career batches and the retained cosmetic crane.
5. Final chapter pacing, sender names and achievement wording.

This file defines the staged game, rollout and content-migration strategy.
The checkpoint below distinguishes implemented behavior from the remaining plan.

## Implementation checkpoint: operations and maintenance

Eight assignments, inbox, actual-state work evidence, reports, achieved goals and
archive are implemented. New careers offer Easy and Hard. Career saves use
schema 3 with tested version-1/2 migrations and atomic current/previous revisions,
full explicit plant/pool serialization, JSON backup and a single-tab Web Lock.
Restore retains trips, heat, damage and sampled rotor strength. Reconnection
reacquires ownership before ticking. Free operation remains the default and is
parked independently during a career. No economy or game-driven incident exists
yet; the remaining phases above retain their scope. New-mission insertion and
pinned active terms have deterministic regression coverage. Condition monitoring,
explicit work orders/functional tests and water treatment are implemented; priced
work orders, paid grid contracts and the rest of the original catalogue remain
future work. See the handoff for the exact permanent IDs and save contract.
