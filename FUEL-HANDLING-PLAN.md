<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Fuel-handling design and continuation plan

Requested 2026-11-10. Read `AGENTS.md` and `doc/nuclear-power.md` before
continuing. This is a fictional browser-local two-loop plant; the RBMK reference
is for the appearance of the channel deck, not a change to reactor physics.

## Current scope and relationship to the company game

The representative crane, retained batches, 35-rack UI capacity check, 60-second
demo cooling and manual free dispatch are implemented. Companion selected/all
replacement runs through the desktop; pool dispatch remains desktop-only.
Career saves preserve current transfer/batch state, but there are no paid fuel
tasks or authoritative purchase/service receipts yet.

[GAMEPLAY-PLAN.md](GAMEPLAY-PLAN.md) is the company-game product plan and
[doc/game-development.md](doc/game-development.md) is its current continuation
handoff. Their representative business-batch approach supersedes any earlier
suggestion here that full physical inventory must precede all fuel gameplay.
Before charging, decouple batch/receipt success from cosmetic frame/deposition
callbacks. Full per-assembly identities, empty channels, crane-held ownership
and fresh insertion remain the separate optional expansion in steps 2–3.

The work-step narratives, test counts and temporary artifacts below record
earlier feature iterations; they do not redefine the current company-game scope.

## User's idea

- Add a spent nuclear fuel cooling/storage pool behind the reactor vessel in the
  existing interactive 3D cutaway.
- Replace the conical vessel lid with a flat, circular, densely tiled channel deck
  inspired by the RBMK reactor-top reference: pale square caps, green/yellow
  identifiers and an orange perimeter.
- Put a lift/handling crane above the reactor and pool. Leave enough vertical and
  horizontal clearance to lift a fuel assembly, carry it behind the vessel and
  lower it into a pool rack.
- Eventually animate changing fuel assemblies and turn refuelling into gameplay.
  Fuel assemblies and control rods must remain separate objects.
- The user also wants to see control rods moving during normal operation. Keep
  the tiled caps stationary and expose the upper guide chamber in the cutaway;
  aqua collars travel with actual rod insertion beneath the deck. Do not make
  normal regulation look like the crane lifting bare rods into the hall.
- Small read-back sliders on the green control-channel caps provide a second
  visible cue from above. They follow actual insertion; the square cap does not
  lift or become a fuel assembly.

The distinction is informed by the [IAEA RBMK design description, section 2.2](https://nucleus-qa.iaea.org/sites/gsan/lib/Safety%20Assessment%20Safety%20Series/Accident%20Analysis%20for%20Nuclear%20Power%20Plants%20with%20Graphite%20moderated%20Boiling%20Water%20RBMK%20Reactors-SRS-43.pdf):
control rods travel in their own channels, suspended from drives at the channel
cappings. The cutaway's exposed moving collars are an illustrative presentation.

References supplied by the user (local files, not portable assets):

- `/home/norkator/Pictures/Screenshots/Screenshot From 2026-11-10 18-09-25.png`
  — the original plant cutaway and vessel location.
- `/home/norkator/Pictures/Screenshots/Screenshot From 2026-11-10 18-12-38.png`
  — the tiled reactor-top appearance.

## Work steps

### Unified electrical cutaway and controls (completed feature iteration)

- Remove Auxiliary power view and its separate renderer. Both diesels are small
  cutaways behind the main turbine/generator, alongside external grid, AC bus and
  actual-state electrical routes to the pumps. `nuclear-power-electrical-scene.js`
  reuses the original engine geometry/motion in the plant renderer at 46% scale.
- Each diesel opens its own nonmodal floating dialog for standby, run, fuel/load,
  startup countdown and manual refuelling. Start/Stop is a single pump-style ON/OFF
  rocker with switch semantics. OFF keeps disabling automatic standby; actual
  state and countdown remain separate read-backs.
- A compact Pump power source panel is above Grid controller at left. It opens
  either diesel and the shared Electrical supply & connections dialog. Native
  grid-available and turbine-feed checkboxes now have the same rocker styling,
  retaining keyboard activation and the existing change handlers. Remove the
  former top-right EXTERNAL GRID/header button entirely.
- Full scene info cards use 55% opacity, while compact tags use 85%; hover, keyboard
  focus and selected/open cards use full opacity. Passive crane labels also accept hover.
- Plant audio now mixes actual reactor and diesel machinery in Reactor overview;
  Maintenance stops both. Reactor command cues must never interrupt diesel voices.
  Pause/mute/hide/detach and returning without replaying past starts/stops remain.
- Core, pool and equipment windows still coexist and use the common lifecycle.
  Source/diesel controls also work in the SVG/WebGL fallback. All 92 unit checks,
  the production build and full browser regression pass for the consolidated view.
  Final screenshots/exports are at `/tmp/nuclear-power-check-y5BNZM/`, including
  `integrated-diesel-dialogs.png`, `wide-1920-light.png`, and backup-generator,
  pool, exchanger and mobile views. The earlier pool/exchanger-only pass succeeded
  at `/tmp/nuclear-power-check-uAA7Hr/`.

### Pool dispatch and compact exchanger update

The user next requested a clickable pool, manual dispatch of cooled fuel to
storage/reprocessing, and a smaller heat-exchanger visualization with trends on
its right. Costs belong to later gameplay, not this pass.

- The pool geometry and semantic label open a movable, keyboard-accessible
  nonmodal window. **Spent fuel ↗** opens it in the schematic/WebGL fallback.
- Deposited representative batches have unique session references, source channel,
  assembly count, rack, placement time and cooling-ready time. Cooling takes 60
  **simulated** seconds after placement; it is a demo gate rather than a physical
  pool-temperature model. It follows plant time across tabs and pauses with the
  plant/hide/detach. Reduced motion still requires cooling time after placement.
- Explicit selected/all-cooled dispatch offers Long-term storage or Reprocessing,
  frees racks/removes 3D samples, logs source count/destination, and retains the
  latest 20 shipments plus total dispatched assemblies. `dispatch()` returns a
  shipment with `cost: 0` as a future fee integration point; there is no balance or
  currency model yet. Unknown destinations, hot/missing batches, duplicates and
  a rack still occupied by the crane cannot dispatch.
- The earlier cyclic display behavior is superseded: batches no longer disappear
  when 35 racks fill. The replacement UI and its action guard require a free rack,
  and tell the operator to dispatch cooled fuel. Existing model replacement,
  heat, damage, settings, latches and explicit manual ownership remain unchanged.
- This is still one representative batch per replacement action (one/all), with
  actual replaced assembly count retained. It is not a full per-assembly spent
  inventory, transport simulation, repository model or fresh-fuel supply model.
- Reset demo clears batches, cooling, shipments and UI feedback. The pool window
  shares the existing close-on-hide/detach, Escape, focus return, drag/arrow-key
  movement and viewport clamping; it can coexist with the core/component windows.
- The exchanger uses a roughly 520 px maximum cutaway and a right-hand sidebar
  with a taller, narrower local trend and collapsed details. Native adjustment
  controls and all read-back/cleaning/motion behavior remain. Below 850 px viewport
  width the columns stack, retaining horizontal scrolling inside the mobile SVG.

Validation: 92 unit checks, production build and expanded browser checks pass.
See the latest unified-view checkpoint above for final artifacts.

### Scope update after the visual foundation

The user requested middle-mouse dragging to change the camera center, then
explicitly limited the next animation to **one representative fuel assembly per
replacement action**, even for Replace all, to save time. That smaller animation
is implemented; the complete inventory/job system in step 2 remains future work.

- Middle-button drag or Shift+drag pans either 3D scene in its camera plane.
  Shift+arrow keys also pan. Plain wheel scrolling still zooms, plain drag still
  orbits. Pan distance is bounded to eight scene units; Home/Reset view restores
  each scene's original center, orbit and zoom.
- Successful selected/batch replacement starts one 10.5-second visual transfer.
  The bridge/trolley align with the selected assembly (or first assembly for an
  unselected batch), the grabber descends, that cap opens, and one assembly lifts
  vertically clear before travelling to the pool. It lowers into a rack, releases,
  and the empty grabber retracts/returns to park.
- Core fuel renews immediately through existing model actions. The animation is
  cosmetic and never changes heat, damage, trips, settings, startup checks or
  real fuel inventory. The refreshed core mesh/cap returns once extraction clears
  the deck. Fresh insertion is not animated in this pass.
- Pool samples are representative batches, one per completed replacement action,
  with 35 retained rack slots (see the dispatch update above). They are not a full
  spent-fuel inventory. Physical ownership rules require step 2; the company-game
  plan instead allows a separate authoritative representative business-batch ledger.
- Repeated actions restart one illustration rather than queueing 49 lifts. Start/
  meltdown cancels an unfinished illustration without changing fuel. Pause/hide/
  tab or overview switching/detach freeze it; returning resumes. Closing the core
  map does not cancel the crane. Reduced motion/fallback uses immediate placement.
  Reset demo clears active motion and all displayed samples, including at T+0.

### 1. Visual foundation — historical completed pass

- [x] Replace the conical reactor lid with the channel deck, keeping the open-front
  cutaway and actual moving control rods.
- [x] Reuse `CORE_CHANNELS` for deck positions/identifiers so later lifting aligns
  with the existing core map and fuel inventory.
- [x] Add the rear pool with blue water, visible empty storage racks, a concrete
  cutaway enclosure, a connecting service deck and rails.
- [x] Add overhead runway rails, a separate bridge, trolley, hoist and grabber;
  park the crane over the pool, clear of the reactor top.
- [x] The initial scenery-only pass was completed, then superseded by the
  representative transfer/cooling/dispatch implementation described above.
  Physical crane-owned fuel inventory has not been added.
- [x] Verify production build, existing unit/browser checks and visual appearance
  in dark/light themes, mobile framing, camera extremes and lifecycle cleanup.

### 2. Fuel-handling state and inventory

- Extend the existing cosmetic `nuclear-power-refuelling.js` state or introduce
  a separate authoritative model when full handling is requested. Keep simulation
  state outside Three.js and React rendering.
- Give discharged assemblies unique identities and history (source core channel,
  remaining reserve/exposure, replacement number and discharge time). Reserve a
  destination rack before lifting. Start with empty pool slots.
- Define explicit states such as idle, aligning, gripping, lifting, traversing,
  lowering, releasing and returning. Store requested versus actual crane position
  and held assembly separately. Model an empty core channel while fuel is held.
- Decide how new fuel enters the scene (a separate fresh-fuel staging rack is a
  proposal, not yet a user requirement). Handle a full pool and interrupted jobs
  without duplicating, losing or silently renewing assemblies.
- Reuse `FuelInventory.replacementReadiness()` and existing cooled/stopped checks.
  Preserve heat, damage, trips, settings and stopped state. Automation must not
  initiate refuelling. Reactor Start must be blocked during an incomplete transfer
  or when a core channel is empty.
- Reconcile the current immediate `replace`/`replaceAll` behavior deliberately:
  either retain the existing quick replacement as a clearly separate mode or route
  it through the new operation; do not accidentally renew inventory twice.

### 3. Crane animation and operator controls

- Use the scene's named bridge/trolley/hoist groups and shared channel/rack anchors.
  Align over the selected channel, lower the grabber, lift vertically clear of the
  deck, traverse to the reserved pool slot and lower the discharged assembly.
- Add fresh insertion as the next explicit operation and confirm completion only
  when the assembly reaches its destination. Keep control rods in their channels.
- Animate actual handling state through the existing visibility-aware frame loop.
  Pause/hide/tab switches freeze work; reopening must show current state without
  replaying a completed lift. Reduced motion changes presentation, not inventory
  correctness. Detach disposes resources; Reset demo clears jobs and pool state.
- Add a movable, nonmodal fuel-handling window with native keyboard controls,
  channel/slot selection, current operation, readiness reasons and cancellation
  behavior. Preserve core-map/component dialogs and camera/picking controls.
- Expose equivalent state/action access when WebGL is unavailable. Record explicit
  operator operations in the existing categorized journal and snapshot/export.

### 4. Gameplay (company plan takes precedence)

- Candidate tasks: replace depleted assemblies, choose/reserve storage slots and
  complete a shutdown/refuelling/restart objective.
- Candidate scoring: correct sequence, fuel usage and successful placement; avoid
  rewarding bypassing interlocks or treating toy limits as real procedures.
- Representative pool capacity/cooling and the saved commissioning career now
  exist. Paid fuel tasks follow the company plan. Physical pool heat, crane
  faults, fresh-fuel supply and a complete inventory remain separate proposals.
- Keep the current normal plant operation available; never let a game objective
  silently start/reset the reactor, repair equipment or replenish fuel.

### 5. Verification for handling behavior

- Unit tests: slot reservation/full pool, identity conservation, empty channels,
  correct completion, readiness changes, interruption/cancellation, pause/reset
  and preserved trip/heat/damage. Test selected and batch operations.
- Browser tests: aligned pickup/drop, visible held assembly and occupied racks,
  keyboard controls, both themes, camera bounds, mobile, fallback, tab switches,
  reduced motion and resource cleanup.
- From the repository root: `npm ci`, `npm test`, `npm run build`, `npm run test:browser`.

## Existing implementation entry points

- `src/simulation/nuclear-power-scene.js`: Three.js overview, camera, batching,
  picking, shared render lifecycle and GPU disposal.
- `src/simulation/nuclear-power-refuelling-scene.js`: visual deck, pool and parked
  crane; instanced opening channel caps, moving crane/cables/grabber, carried fuel
  and representative submerged rack samples.
- `src/simulation/nuclear-power-refuelling.js`: pure cosmetic transfer state,
  choreography, shared dimensions and bounded display samples. This is not the
  full inventory/job system proposed in step 2.
- `src/simulation/nuclear-power-model.js`: `CORE_CHANNELS`, simulation state,
  commands and snapshots.
- `src/simulation/nuclear-power-fuel.js`: fuel inventory, readiness and immediate
  replacement operations.
- `src/simulation/nuclear-power.js`: core map, replacement actions, existing
  cosmetic exchange animation and visibility-aware animation loop.
- `test/browser.mjs`: real production app/WebGL regression and screenshots.

## Handoff checkpoint

The visual foundation, representative transfer, retained batch cooling and manual
dispatch are complete. Steps 2–3 and their associated verification still describe
the optional full physical handling expansion. The current company-game handoff
and product plan govern staged missions/economy, without requiring that expansion.

Implementation notes:

- The deck has 61 shared channels: 49 fuel assemblies and 12 control rods. Internal
  fuel meshes now match the same coordinates instead of the earlier simplified
  twelve-box layout. Heat/reaction visuals use the nearest existing rod zone.
- The pool starts with 35 empty, named rack positions and stores one representative
  batch per replacement action. Filled racks stay occupied until manual cooled
  dispatch; the UI blocks replacement when full. Full per-assembly inventory and
  transport/cost rules remain future work.
- `overviewScene.refuelling` holds `deckChannels` (world-space pickup anchors),
  `rodIndicators`, `pool.slots` (world-space rack-top anchors), and separate
  `crane.bridge`, `crane.trolley`, `crane.hoist` and `crane.grabber` groups.
  The hall/group geometry is still batched and disposed by the existing renderer.
  Caps/handles use tracked instanced meshes so only the pickup channel opens.
- Current rod movement is a cutaway illustration beneath the closed deck. The
  cap sliders are actual-insertion indicators, not moving channel caps or
  requested positions.
- The platform extends rearward; the default camera frames the taller crane.
  User orbit/zoom, semantic equipment controls and the SVG fallback remain.
- Historical feature verification passed at that iteration: all 92 unit checks (`npm test`),
  production build (`npm run build`) and expanded Chrome/WebGL regression
  (`npm run test:browser`). Dependencies were installed with `npm ci`.
  The browser checks include shared fuel/channel identities, deck alignment,
  the entire pool/crane fitting the default camera, actual rod/cap-indicator
  travel beneath the stationary deck, and existing themes/mobile/pause/fallback/
  tab/lifecycle behavior.
- Final browser screenshots/exports: `/tmp/nuclear-power-check-y5BNZM/`, including
  `fuel-crane-lifting-dark.png`, `fuel-crane-lifting-light.png`,
  `fuel-crane-traversing.png` and `fuel-crane-pool-deposit.png`.
  Earlier cropped design views: `/tmp/nuclear-fuel-design/`. These temporary
  artifacts may disappear; regenerate with the browser test if needed.
