<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Nuclear Power

**Nuclear Power** is the standalone English-only React/Vite app in this repository,
served at `https://nuclear.porssiohjain.fi` after DNS and hosting are configured.
The Vaadin desktop and Start menu retain its pixel-icon shortcut and open that URL
in a separate tab. The old `/nuclear-power` Vaadin view and its frontend assets have
been removed from the Java application. Both locale bundles deliberately retain
the name **Nuclear Power**. No account login or backend connection is required by
the standalone simulation. An optional Docker WebSocket relay pairs companion
browsers with an existing desktop session; plant calculations remain in that
desktop browser. See [companion setup](../README.md#companion-console-and-docker-session-backend).

The homepage is a static landing page with Nuclear reactor and Companion screen
cards above the introductory SEO/guide content. Separate `/reactor/` and
`/companion/` HTML entries mount React and the retained `nuclear-power-console`
custom element, preserving its renderer, isolated styles and browser lifecycle.
Neither console includes landing/SEO content, even as hidden DOM. Reload retains
the selected URL; Back returns to the landing page. Free operation does not persist plant state across reload; optional careers do,
through the local company-game save described below. Legacy `/?screen=companion` links redirect to `/companion/`
while retaining pairing-code fragments. The independent npm project,
tests, public audio and Nginx container live together in the repository root.
`.github/workflows/nuclear-container.yml` verifies `main` without publishing; it
verifies `production` and then publishes
`ghcr.io/norkator/nuclear:latest` and
`ghcr.io/norkator/nuclear-backend:latest` for amd64/arm64 on relevant
production pushes and manual runs on that branch. There is no pull-request
trigger; manual main runs verify only, and other branches skip the jobs.
The test gate includes companion
pairing checks, and QEMU supports the backend’s ARM64 dependency installation.
The workflow does not configure DNS/TLS or deploy the images.
See [local development and deployment](../README.md).

## Optional company game: current commissioning chapter

The standalone repository is https://github.com/norkator/nuclear. Source, tests,
Docker files and deployment workflow now live at its root, independently of the
Pörssiohjain Spring project. The external desktop link remains unchanged.

Free operation is still the default. Start game creates a separate cold career;
Continue game restores a local save paused. The plant manager assigns First shift
(200 ± 5 gross MW for 30 seconds after explicit Start) and Prove reliable operation
(five uninterrupted simulated minutes). Briefs instruct disabling grid following
during these fixed-output tests. Objectives use actual readings and existing
interlocks, not target edits or email acknowledgement. Stop/violations reset a
hold; pause freezes it. Reports create permanent achieved goals and archive
records. Future mission insertion preserves issued terms and completed IDs.

IndexedDB saves explicit full plant/pool state, mission terms, inbox, reports and
sampled turbine tolerance, keeping current and previous revisions atomically.
Web Locks allow one writer tab. JSON export/import provides local backups. Restore
does not erase trips/damage/heat or advance offline time. Returning parks/saves
the career and restores the free plant retained on this page. Session changes
end pairing and stop old audio/motion; companion plant commands remain host owned.
Reset demo is unavailable in Career. Money, bankruptcy and later assignments are
planned in [GAMEPLAY-PLAN.md](../GAMEPLAY-PLAN.md), not implemented yet.

For the exact implementation, save schema/limitations, source map and next work,
read [the game-development handoff](game-development.md). The 20-mission product
plan is not a list of implemented assignments.

Run `npm run test:browser:game` for game entry, company messages, reports,
achievements, mobile/light rendering, two-tab ownership, reload and reconnect.

## Current scope

The feature is a fictional, interactive control-room simulation. All readings,
equipment states, alarms, events, and trends are simulated. It does not persist
telemetry, access measurement history, send device commands, or implement a physical
reactor model. Its separate primary/secondary circuits are a fictional two-loop
layout, not a Chernobyl/RBMK simulation or a validated model of any named reactor
type. It starts stopped with Auto → Electrical output selected (200 MW target).
Start at least one primary and one secondary pump explicitly, allow circulation
to build, then press reactor Start
to begin generation. Initial rods are fully inserted, output and
retained heat are zero, and coolant/fuel start near ambient (30 °C). All four pumps
start disabled with zero actual motor speed and flow, retaining 100% speed targets;
small deterministic process fluctuations are enabled.
Reset demo returns to this same stopped state.

The user intends to evolve this into a physical, MQTT-connected scale model and
expects further iteration after trying it. Keep the controls rich and interactive,
keep all feature text English, and keep this document and the root `AGENTS.md`
handoff current when behavior changes.

The 3D reactor has a flat RBMK-inspired tiled channel deck, a rear spent-fuel
pool with 35 initially empty display racks, and an overhead handling crane. The
appearance does not change the fictional two-loop model. Deck caps, 49 fuel
assemblies and twelve control rods share `CORE_CHANNELS` positions/identities.
The caps stay stationary; actual rod movement and aqua collars remain visible
inside the open-front upper guide chamber beneath them. The crane bridge,
trolley, hoist and grabber animate one representative assembly for each
successful selected or batch fuel replacement: align, lower, lift clear of
the deck, traverse to the pool, lower/release and return to park (10.5 s).
Only the pickup cap opens; regulation keeps all caps fixed. Fuel renewal
remains immediate through its existing cooldown checks. Each replacement
stores one representative batch (with its actual replaced assembly count)
in one of 35 racks. Batches remain until manual dispatch; a full pool blocks
further UI replacement until a rack is freed. This is not a complete physical
spent-fuel inventory or pool-temperature model. Repeated commands restart
one illustration, without queueing the entire core. Starting/meltdown cancels
an unfinished illustration; pause, hiding, tab/view switches and detach freeze
it. Returning resumes; reduced motion/fallback places the sample immediately.
Reset demo clears active motion and samples, including at T+0. The animation
never changes heat, damage, trips, settings or the stopped state. See [the continuation plan](../FUEL-HANDLING-PLAN.md)
for the user references, implementation checkpoint and future gameplay steps.

Click the pool or **Spent fuel ↗** to open its movable, nonmodal window, also
available from the schematic/WebGL fallback. Unique session batches show
source channel, represented count, rack and a 60-second simulated cooling
countdown starting at placement. Cooling follows plant time across tabs and
freezes with pause/hide/detach. Reduced motion skips crane motion but never
skips cooling. Explicit selected/all-cooled dispatch to **Long-term storage**
or **Reprocessing** frees racks and removes their 3D fuel, without changing
core fuel, retained heat, damage, settings or trips. Invalid routes, missing/
cooling batches, duplicates and crane-occupied racks cannot dispatch. The
journal records destination/count; a bounded 20-shipment history and total
dispatched count remain in the session. Cost is zero; future gameplay can
extend the shipment cost contract. Reset demo clears pool/cooling/history.
The pool shares dialog dragging, keyboard movement, clamping, focus return,
Escape and close-on-hide/detach behavior with the component windows.

The overview defaults to a low-poly 3D cutaway, with a retained SVG schematic
available through the view selector. Both include moving rods and fuel channels,
separate primary and secondary circuits, animated pumps and coolant flow, a heat
exchanger, a turbine/generator, and a condenser. Click or keyboard-activate outlined
equipment to open its movable component console. The reactor opens the core map;
its former Equipment detail readings are inside that window. The main view has no
Equipment detail card. The 3D scene supports bounded orbit, pan and zoom; the SVG diagram can be zoomed and
scrolled. Controls and instruments adapt to the browser viewport's width.

The process viewport has its own visibility observer. Scrolling just the overview
offscreen suspends WebGL draws, SVG animation writes and the crane illustration;
the visible console's plant clock, instruments and floating equipment windows
continue working. Returning refreshes the overview from actual state, including
while paused or using reduced motion, without fast-forwarding the crane. Hiding
the entire console still suspends the whole simulation. The shared animation loop
retains its 30 FPS cap. Schematic steam markers follow the same static polyline
definition as the drawing, using distance interpolation rather than per-frame SVG
geometry queries. Motion elements retain DOM references across frames. Coolant,
reaction and electrical markers use instanced particle batches with independent
poses and actual-state visibility. Inactive leaks skip droplet calculations;
unchanged turbine blades retain their instance matrices until damage or service
changes their visible count. Equipment label sizes are cached through a resize
observer; immediate measurements are reserved for explicit expansion/selection
and viewport changes. Particle batches share the existing GPU disposal and
reconnection lifecycle. These optimizations retain the existing resolution,
lighting, antialiasing and simulation behavior.

Click the reactor vessel (or **Core map ↗**) to open the core map in a movable,
nonmodal floating dialog above the process (up to 900 px wide, with a
650 px core drawing and viewport clamping). The process schematic stays
visible and interactive underneath, using the same model and rod positions. Drag
the dialog title bar to move it; when the title bar has keyboard focus, arrow keys
move it in 16 px steps. The frame is clamped to the browser viewport on movement
and resize. Close with × or Escape. The dialog closes when the feature is hidden
or detached; rod selection, settings, and its position remain in the retained view.
It uses the native manual-popover top layer with `role="dialog"`, so it can float
above the process without making the process view inert.

The core map is a fictional circular array of individually selectable fuel assemblies
and twelve control rods, `CR-01` through `CR-12`. Control-rod rings show actual insertion;
amber fuel rings show remaining reserve. Depleted assemblies show a high-contrast
cross and **EMPTY** label; low-reserve assemblies show their remaining percentage.
A count below the map summarizes depleted and low-reserve assemblies. Tooltips and
accessible labels state reserve status; damage retains its separate red border. Fuel activity is illustrative, not a measured
local power or temperature. The side section projects the same twelve rod positions.

Core temperature above the existing 335 °C demo high-temperature threshold turns
the temperature card, status light, outlet instrument and annunciator red. Text
also reads **HIGH TEMPERATURE**. The core card and outlet instrument bounce gently
while their borders are red (above 335 °C), stopping on cooldown; reduced motion
keeps them static and pause/hidden-view suspension freezes the bounce. Acknowledging the alarm does not remove this
indication; it clears only when temperature falls back to 335 °C or below. Both
themes have explicit high-temperature colors. Normal running temperatures use a
green card, reading and status indicator; stopped/tripped or damaged states do not
show this green operating indication. High coolant temperature, local fuel hot spots
and low primary flow raise alarms and affect damage in both modes, without activating
emergency shutdown. These are illustrative, not physical safety limits.

## Progressive stress, damage and meltdown

Failure is driven by a separate fictional condition/heat model, never a random
explosion or a single timer. Normal automatic generation, including constrained
MW requests, remains protected. Sustained loss of cooling can still overwhelm a
shutdown because stored fuel heat remains after rod insertion.

The overview's condition strip shows stage, peak local fuel temperature, cooling
margin, retained heat, temperature rate of rise, core damage and pump stress.
Negative cooling margin warns before severe temperatures. Pump buttons acquire
amber/red edges as stress and damage accumulate; their tooltips show actual speed,
stress and damage. Selecting a pump also exposes stress and damage in its details.
The floating core map shows hot/damaged channels and the selected channel's fuel
temperature and retained damage. The coolant reading and local fuel temperature
are separate signals; a hot spot can precede high average coolant temperature.

Stages are **NORMAL**, **STRAINED**, **OVERHEATING**, **PROTECTIVE SHUTDOWN**,
**COMPONENT DAMAGE**, **CORE DAMAGE**, and latched **MELTDOWN**. The order depends on
the fault and operator response; emergency shutdown only follows an explicit command. Stress recedes after
correction, while damage does not heal automatically. At meltdown, fuel deforms
gradually and a glowing pool grows over subsequent seconds; there is no explosion.
Generation shuts down and the session remains inspectable/exportable.
The latched meltdown adds a slow red pulse across the entire console and a
movable, nonmodal top-layer dialog with bouncing **CORE MELTDOWN** text, incident
export and **Reset demo**. It uses the shared core-map/generator title-bar dragging,
keyboard movement and viewport clamping. Close with × or Escape; reopen from
**Meltdown incident ↗** in the footer. Closing it does not clear the incident,
red console pulse or siren. Hiding the view closes it; returning reopens it.
Reduced-motion preferences replace the pulse/bounce with static red emphasis;
pause and hidden-view suspension also pause these effects. Existing damage and
meltdown thresholds remain unchanged.

**Enable plant sounds** in the header opts into browser-synthesized audio, with an
explicit mute control. Unacknowledged alarms start with an attention tone every
three seconds. Fuel temperature and retained core damage escalate the sound through
overheating (2 s), core damage (1.3 s), critical (1 s) and meltdown (0.85 s) cadences,
with wider pitch sweeps, stronger waveform and modestly increasing gain. Critical
starts at 600 °C peak fuel or 70% damage; earlier levels use the existing 410/450 °C
warning/damage boundaries. These are illustrative demo levels. Acknowledgement
silences ordinary attention tones; ongoing overheating/damage and meltdown remain
audible until conditions resolve or the user mutes. Mute, pause, hidden views and detach stop audio;
Reset demo clears the incident sound. Browsers require a user gesture to enable
audio. Sound settings belong to this view instance; bundled audio files load only after opt-in.
The same switch enables distinct quiet ascending Start and descending Stop cues,
only when that command changes the reactor's running state. Blocked/repeated commands
produce no cue. Kenney UI Audio samples provide quiet on/off switch clicks and a short click when
an adjustment is committed (not on every slider movement). They share Enable plant
sounds and mute/pause/visibility cleanup, preload only when sound is enabled and
never loop. One sampled UI voice plays at a time, with 80 ms input throttling and
0.26 default gain (100% of the bounded UI-sample range). The Clicks slider and
Test click button have been removed. Missing samples show an unavailable message.
The context stays running while sounds are enabled and the view is active, even
between sounds, to avoid suspend/resume races. Mute/pause/hide still suspend it.
Unloaded/late clicks are skipped rather than replayed. Sample files and
the included CC0 license/source record are under
`public/audio/nuclear-power/kenney-ui`. Original pack:
https://kenney.nl/assets/ui-audio; downloaded from the Calinou/kenney-ui-audio mirror
because the original download returned 403. No external audio request occurs at runtime.
Opt-in operating audio now uses two original seamless 16-second stereo WAV loops
under `public/audio/nuclear-power/plant-state`: steady steam/turbine/generator
operation and a rough fault texture. Actual running reactor power and turbine
shaft speed drive intensity, bounded to 0.10 gain. Cold sessions are silent; Stop
allows audible shaft coast-down. Stress, damage, overheating, trips and actual
component disturbance values select the fault texture independently of alarm
acknowledgement, with approximately one-second crossfades. Requested MW or fault
selection alone never controls playback. Both decoded loops share phase and are
reused across state changes; missing files show an unavailable status. Late loading
only stores buffers and never starts audio independently. Start/Stop cues retain
their 0.0004 peak and do not interrupt operating loops. Warning and critical alarm
sounds retain separate escalation. Mute, pause, hidden views and detach stop all
loop, cue and alarm nodes immediately; Reset demo returns to cold silence.
Machinery audio is scoped to the selected tab. **Reactor overview** mixes the
reactor operating loops/Start/Stop cues and independent actual-state diesel
startup, running and shutdown sounds. **Maintenance** stops all machinery
immediately; UI clicks and alarms remain shared. Reactor command cues never
interrupt diesel voices. Returning resumes current operation without replaying
past starts/stops. Opt-in, bounded gain, mute/pause/hide/detach and Reset cleanup
remain unchanged.

Original stereo PCM WAVs under `public/audio/nuclear-power/diesel` provide
an eight-second starter/ignition/acceleration cue, a seamless twelve-second exhaust,
clatter and fan loop, and a 3.2-second shutdown. Read-back states drive playback,
including automatic starts, cancelled starts and fuel exhaustion. Running gain
follows actual bus load (0.035 unloaded to 0.05 loaded per engine). The two engines
have independent voices; startup resumes at the current simulated countdown after
pause/tab changes, while an already-running engine resumes directly into its loop.
Past shutdowns and blocked/repeated commands are never replayed. Mute, pause, hide,
detach and Reset demo clear all diesel voices; late loading never starts playback
independently. Generation script, source notes and asset checks live in the repository root.

The temperature trend expands its scale above the old 400 °C range during a severe
incident rather than clipping the continued rise.

Open **Faults & incident** below the left-hand instruments to select a progressive
primary obstruction, secondary cooling loss, or primary-pump deterioration. Faults
ramp rather than instantly changing flow. Existing manual pump controls and uneven
rod settings also affect stress and local heat. These controls are simulation-only.
**Clear injected fault** restores the fault's restriction gradually, preserving wear.
**Repair components** requires a stopped reactor, no injected fault, coolant below
150 °C, fuel below 200 °C, and no meltdown. It repairs accumulated damage/stress while
preserving heat and operating settings. Meltdown can only be cleared by **Reset demo**.

The **Maintenance** overview tab collects retained core/pump damage, equipment wear
and exchanger fouling in a live list, with a count visible on the tab. Core damage
is grouped with its affected-channel count; temporary stress and depleted fuel
are separate. **Inspect** opens the existing movable component/core console.
**Repair all** services the listed components together through the existing
cooled repair path. A shared readiness checklist shows Stop, fault clearance,
coolant below 150 °C, peak fuel below 200 °C and no meltdown, with current
temperatures. **Clear active faults** explicitly clears injected plant/component
deterioration without healing damage or changing other periodic disturbances.
Repairs preserve retained heat, fuel reserves, settings, operating hours and both
reactor/turbine trip latches. They cannot start equipment or close a breaker.
The list clears as repairs complete; Reset demo clears maintenance feedback.

Inspecting the reactor now exposes a damage summary and every affected local
zone directly above the core map. Entries identify the nearby CR rod, retained
damage percentage and local fuel temperature; selecting one selects that rod
and its existing detail readings. All nonzero retained damage has a red map
border, including values below 1%. The dialog also offers **Repair all damage**
through the same core/component bulk repair path, with explicit blocking
reasons and current temperatures. Repairing removes the list entries and red
borders while preserving fuel and trips; fuel replacement remains separate.

Trip reset additionally requires cleared faults, repaired damage and local fuel
below 410 °C. It does not clear retained heat, stress, damage or the incident history,
and it never restarts automatically. Auto reduces generation against cooling capacity
and local fuel hot spots; it never activates or resets emergency shutdown or restarts failed pumps.

### Illustrative model constants

All constants are gameplay/demo parameters, not real reactor engineering:

- Heat reserve starts at zero internal units, follows generation with a 40-second
  response and decays over a 240-second response after shutdown. Displayed retained
  heat is reserve × 1.5 MW. Initial fuel temperature is 30 °C.
- Cooling margin compares a 1200 MW nominal cooling scale, reduced by actual flow
  and core damage, with generation plus retained heat. Fuel temperature integrates
  heat input minus cooling with bounded rates. Poor cooling keeps the coolant
  reading coupled to retained fuel heat rather than dropping immediately to ambient.
- Rod imbalance creates local temperatures. Above 410 °C, exposure accumulates;
  above 450 °C and after 15 seconds of exposure, channel damage accumulates.
  Hot spots raise alarms and constrain Auto output, without latching emergency shutdown.
- Meltdown latches only after a channel reaches 100% damage with fuel at least
  650 °C. Its visual progression then ramps with a 12-second response.
- Pump stress comes from sustained requested/actual flow mismatch. Stress above
  60% accumulates wear, progressively reducing available flow; speed alone does not
  damage a healthy pump. All state freezes with simulation pause/hidden-view suspension.

## Layout and appearance

The console uses the full browser width with no fixed maximum width. At
container widths of at least 1400 px, it has three columns. Regulation, plant
sound enable/mute, theme, simulation information and session clock share a header
card beside the brand/title, leaving more room for the main overview:

- left: stacked temperature, thermal output, electrical output, flow and rod cards,
  followed by the collapsed fault/incident tools; equipment details live in dialogs;
- middle: tabbed reactor/auxiliary overview beside the operator console;
- right: live trends above the filterable event journal.

The operator console uses beveled metal mounting plates, round green/red Start
and Stop pushbuttons, engraved labels and pilot lamps. Lamps use actual running
state rather than command availability: Start remains visibly lit while the
reactor runs even though the button is disabled. Text distinguishes READY,
INTERLOCKED, RUNNING, STOPPED and TRIPPED. Pump lamps follow actual motor speed,
with amber stress and red retained damage/wear indication; an amber Reset trip
lamp marks completed recovery readiness.

The load setpoint and all four pump speed targets share a metal regulator rail,
grooved slider handle, engraved 0–100% scale and amber percentage display. Load
also retains its fine-adjust buttons and AUTO/MANUAL/TRIP LOCK ownership label.
The fill/readout follow a live adjustment until commit without changing the
requested-versus-actual distinction. Native pointer/keyboard behavior, Auto
ownership, individual pump overrides, trip recovery and speed/flow read-backs
remain intact in both themes.

The Start/Stop caps have restrained illuminated lenses and a soft nearby halo: green
Start while running and red Stop while stopped. Emergency shutdown has a soft
red locator halo while armed and a much brighter red cap/halo while latched.
These are steady lights with no flashing or extra timers, retained when paused
and under reduced motion. Pump cards use separate recessed ON/OFF rocker
switches with native keyboard activation and switch semantics. Their position
shows the requested enable state; the adjacent actual-state lamp/status can
remain RUNNING/COASTING after OFF until the motor slows. Pump name, circuit,
speed target, actual read-back, flow and stress/damage indication are retained.

Emergency shutdown is a red mushroom pushbutton on a hazard-marked mounting
plate, behind a transparent hinged plastic cover. First select **Lift cover**,
then press the exposed button; **Close cover** blocks manual access again.
The native cover toggle comes before the button in keyboard order. Enter/Space
opens the cover, then Tab reaches the button. Cover movement never changes plant
state or clears a trip. Emergency shutdown is operator-only in both Auto and Manual.
New sessions and **Reset demo** close the cover; pause and reduced motion skip
the lid transition. Its head remains depressed, its red trip lamp stays lit, and it reads
**TRIP LATCHED** after the operator explicitly activates emergency shutdown.
The disabled latched button retains full visual contrast. Pressing it again
cannot clear the trip. Only successful explicit **Reset trip** releases the
head and extinguishes the trip lamp; the reactor remains stopped until Start.
Start/Stop and recovery interlocks are preserved. Native
keyboard/focus behavior, pause and reduced motion are preserved in both themes;
the lights and physical button position introduce no animation timer.

The default reactor overview fits 1920×1080 and 2560×1440 screens without page scrolling.
The thermal output, electrical output and both flow cards include heat wisps, a
rotating generator symbol, flowing coolant markers and traveling meter highlights.
Their phase and intensity follow actual reported output/flow, remain still at zero,
and share pause, visibility, detach and reduced-motion cleanup. Numeric read-backs
are not interpolated or substituted with requested settings.
Long event lists scroll inside the journal. Narrower/resized windows progressively
use two columns and then stacked sections, with mobile-sized controls retained.

Dark is the default. The header's **Light theme** switch changes this feature's
panels, controls, diagrams, chart and logs, including the React page background.
The browser preference uses `porssiohjain.nuclear-power.theme` in local storage;
unavailable storage falls back to dark and never prevents switching themes. Theme
changes do not reset simulation state or alter control settings.
Light mode uses darker secondary labels and full-opacity disabled controls, so
Auto-owned actuator settings remain readable while disabled.

## 3D reactor overview

The main overview opens as an isometric, low-poly Three.js scene, hosted inside the
retained custom element. Vessel and heat-exchanger cutaways expose the internal
fuel, control rods and transfer tubes. Separate primary and secondary pipework,
pump impellers, turbine blades, generator and condenser share the existing plant
state. No additional physics or command path is introduced.

A gray natural-draft cooling tower with two red bands stands behind the condenser,
scaled against the spent-fuel pool. Warm/cool water pipes descend through sleeves
in the equipment plate, run beneath/along its outer edge, and connect to the tower
and basin. A smaller river intake provides make-up water for cooling-water losses;
this circuit remains separate from reactor coolant and turbine steam. Its white
plume represents condensed water vapor rising straight up in fixed columns, without
spiraling or sideways drift. Actual secondary temperature/circulation
and condenser cooling capacity control plume density, opacity and height; cold,
no-flow and unavailable-cooling states have no plume, while retained hot circulation
can continue it after Stop. This is a normalized illustration, not added heat/water
physics or a measured MW signal. One bounded instanced billboard batch shares the
frame clock, pause/reduced-motion/visibility behavior and GPU disposal. Tower and
pipe picking, plus its keyboard-accessible CT-01 label, open the existing condenser
controls. The default camera includes the tower and plume. The river/tower are 3D
presentation additions; the existing SVG condenser controls remain available.
See [the cooling tower checkpoint](../COOLING-TOWER-PLAN.md). Focused checks:
`npm run test:browser:cooling`; equipment browser checks include these scenarios.

The taller viewport starts at 120% zoom. Drag to orbit within bounded angles, use
the mouse wheel or +/− buttons to zoom (65–300%), and select **Reset view** to restore
the initial camera, including its center. Hold the mouse wheel and drag to pan
in the camera plane; Shift+drag also pans. Panning is bounded to eight scene
units in the unified 3D view. When the canvas has keyboard focus, arrow
keys orbit, Shift+arrow keys pan, +/− zoom and Home resets. Equipment can be selected directly through canvas picking or
through semantic HTML buttons with live readings. They open the same movable
component/core dialogs and receive focus again when those dialogs close.

**Schematic** returns to the original SVG process view without resetting the
simulation. Both themes, actual rod insertion, motor/shaft coast-down, coolant
flow, temperature-dependent steam/heat, retained fuel glow, molten drips and the
growing melt pool are preserved. The scene uses the existing visibility-aware frame
loop; pause and reduced motion freeze illustrative motion, hidden views suspend
work, and detach disposes GPU resources and observers. Reconnection recreates the
renderer around the retained simulation. Unsupported/lost WebGL 2 falls back to
the usable SVG view. Stationary equipment surfaces and rotor blades are batched
by material to reduce draw calls.

The main panel has **Reactor overview** and **Maintenance** tabs, with keyboard
arrow/Home/End navigation and retained plant state. Reactor overview contains the
unified 3D plant and SVG selector. Small diesels, grid, bus and electrical routes
share the plant scene. Maintenance stops rendering without changing simulation
state. The left Pump power source panel sits above Grid controller. Its source
controls and each diesel's own dialog remain usable in the SVG/WebGL fallback.
There is no Auxiliary power tab or header EXTERNAL GRID/source button. Component,
core, pool and electrical windows can coexist and retain the shared lifecycle.

## Loop temperatures, valves and flow

SVG and 3D pipework, bypass and moving markers share one absolute illustrative
temperature palette (blue/teal at low temperatures, yellow/orange as warmer, red
above 335 °C). Equal temperatures have equal colors regardless of hot/return role.
The legend shows the scale. Structural equipment paint remains distinct from fluid
temperature. The reactor label shows core inlet and outlet; pump/exchanger/condenser
labels expose the local return temperatures. Numeric SVG readings remain high
contrast and the existing persistent over-temperature indication remains red.

The primary return calculation now includes actual exchanger/condenser heat removal,
both flows, generated power and retained heat. A 100% actual bypass or unavailable
heat rejection removes the nominal primary temperature drop; read-back responds
gradually. The new `secondaryReturnTemperature` follows secondary outlet temperature,
actual condenser inlet/cooling factor and circulation, also gradually. Both are
explicit simulated signals. Closing condenser cooling removes its return cooling
drop. The bypass route shows flow only while its actual valve is open; exchanger
heat-transfer highlights also obey actual transfer factor.

Valve geometry is aligned to its local pipe axis, including vertical exchanger
valves. At 100% actual opening the lever is parallel to the pipe; at 0% it is
perpendicular, with intermediate angles following read-back. Main SVG and component
consoles use the same opening-angle rule. Requested settings still ramp gradually.

All 3D paths in a loop advect markers using one actual-flow-driven travel distance,
then map that distance into each path's length. Marker spacing is comparable across
short/long routes. SVG steam particles and dash motion use the corresponding shared
distance. Steam density/visibility remains temperature-driven, but steam-line and
return-line marker speed are no longer unrelated fractions of pipe length. These
are illustrative animation distances, not measured water/steam velocities.

## Process animation

The selected 3D scene, retained SVG schematic and instrument cards use the shared
visibility-aware frame loop for illustrative motion:

- Turbine blades show projected rotation and the generator has a centered rotating
  rotor. The separate simulated shaft-speed read-back drives visual rotation, with
  startup acceleration and coast-down after shutdown. An open breaker can leave
  the shaft turning while electrical output is zero. Rotation is independent of the
  steam-particle temperature threshold. This is not a measured RPM.
- Steam particles follow the steam pipe toward the turbine; their visibility and
  travel rate use secondary temperature and actual circulation. Condenser droplets
  follow the same heat/flow activity. Cold circulation still shows water flow but
  no steam. With no flow, particles stop and disappear.
- The exchanger has traveling heat highlights and cross-circuit heat arrows driven
  by the temperature difference and actual flow in both loops. Fluids stay separate.
  Secondary-side steam puffs rise inside its cutaway and turn toward the steam
  outlet in both 3D and SVG views. Density/opacity and travel phase reuse the same
  secondary temperature/actual-flow steam signal as the outlet pipe. Cold
  circulation and zero secondary flow show no steam; retained hot circulation can
  keep producing visible steam after shutdown. Puffs never represent an external leak.
- The 3D vessel has moving reaction particles among the fuel channels and staggered
  per-bundle emissive pulses. They use actual running thermal power and local rod
  insertion, independently of shaft/output or retained-heat motion. Stop, trip and
  meltdown remove reaction particles; retained fuel heat keeps its existing glow.
  These are process illustrations, not added neutronics. The shared frame loop
  freezes particle travel and pulses on pause/reduced motion and suspends hidden
  views; particles are excluded from static batching and disposed with the scene.
- Side-view fuel colors and core-map fuel glow follow local simulated temperatures.
  Retained fuel heat keeps the core glowing after shutdown; uneven channels remain
  visible. Meltdown gradually slumps the fuel, adds molten drips and grows a gently
  shifting molten pool. No explosion or random plant-state changes are introduced.
- The electrical connection window's 2D power route identifies turbine, grid or diesels and
  animates the energized route into the pump bus. Loss of AC dims the bus; source
  restoration does not restart the reactor. Its 3D diesels show pistons, shaft/fans,
  actual fuel fill and electrical-output markers only while supplying load.

Cold startup begins with inserted rods, no turbine rotation, steam or fuel glow,
with all four pumps stopped and no coolant circulation. Explicitly start at least
one pump per circuit and wait for actual motor speed and flow to reach at least 20%;
then pressing reactor Start lets the
existing simulated rod, heat, flow and output signals bring each visual into activity.
Stopping reverses generation activity while retained heat and cooling remain visible.
New/reset sessions clear visual rotor inertia. Pause/hidden/detached views freeze
motion, and reduced motion retains static state/color indicators while data updates.
All colors support the feature's light and dark themes.

## Controls

Controls:

- Start/Stop: normal startup or cooldown, maintaining circulation settings and
  individual operating rod targets. Start requires at least one explicitly enabled
  pump in each circuit, actual motor speed and flow of at least 20% in both
  circuits, AC supply, and a
  temperature below the demo reset limit.
- Load setpoint: sets requested output and corresponding rod insertion.
- Bank Insert/Withdraw: moves every rod's own target by five percentage points,
  retaining offsets until travel limits are reached. Load setpoint intentionally
  applies a uniform bank target. Mean actual insertion is displayed separately.
- Individual rods: select a numbered channel or use the rod selector, then adjust
  its insertion slider or one-percentage-point buttons. Only that rod changes.
- Pumps A/A2 (primary) and B/B2 (secondary): manually enable/disable and
  independently adjust speed targets from 0 to 100%. A2/B2 are the backup pumps;
  all four speed sliders and run switches are available in the main view.
  Individual Auto overrides remain in the pump dialogs.
  Actual speed/flow ramps gradually; disabling preserves the speed setting. Pump
  rotation follows motor speed and each circuit's coolant animation follows flow, including
  coast-down, with continuous phase and an explicit local SVG rotation pivot.
- Emergency shutdown: latches a simulated trip and inserts rods. Restart requires
  **Reset trip**, then **Start**. Only an explicit operator command activates this
  latch, in both Auto and Manual. Reset trip requires all rods at
  least 99.5% inserted, both enabled circuits with target/actual speed at least 20%,
  and core temperature below the demo limit of 335 °C. These are arbitrary simulation
  limits, not real nuclear operating instructions. A checklist explains readiness.
  Reset trip preserves settings, elapsed time, history, and logs and leaves the
  reactor stopped. Reset demo remains available to replace the whole session.
- Acknowledge alarms: acknowledges existing alerts without hiding active conditions.
  New faults require their own acknowledgement.
- Pause/Resume: freezes/resumes simulated time and animations.
- Reset demo: restores the initial stopped state, event log, and trend history.

Both Auto and Manual leave emergency shutdown to the operator. Low primary flow,
high coolant temperature, local fuel hot spots and high output/core/circulation
targets never press or latch the emergency button. Use **Emergency shutdown** or
**Stop** explicitly. Auto still regulates rods/pumps and limits output against
cooling, fuel, hot spots and the configured core ceiling. Alarms, retained heat and
progressive damage remain active. Switching modes never activates or clears the
emergency latch. Irreversible meltdown still ends generation through its separate
failure state in either mode, without activating the emergency button; **Reset demo**
is required afterward. Explicit emergency trips retain their latch across meltdown.

## Parallel pumps, overpressure and leaking water

Each circuit has two manually enabled, parallel pumps: primary **A / A2** and
secondary **B / B2**. A2/B2 are the backup units; all four start OFF with retained
100% speed targets. Either pump can provide its circuit's startup circulation.
Each main/backup pair has independent speed sliders and ON/OFF rockers in the main
view. Adjusting an OFF pump's speed retains its target without starting it. Running
Auto owns each speed unless that pump has an explicit override. **Backup A2/B2 ↗**
opens that pump's speed, discharge valve, Auto override, local trends and internal
inspection. Auto adjusts only enabled pumps and never enables a backup. Each
3D/SVG branch shows its own actual motor/flow, including coast-down and loss of AC.

Two full-speed pumps give an illustrative **135% combined flow** and **182% relative
circulation pressure**, with additional auxiliary demand. Pressure is a normalized
gameplay differential-pressure indication, not an absolute vessel-pressure model.
Auto continues to hold the requested total circulation; use Manual or individual
speed overrides to run both pumps at 100%. Sustained pressure above **145% nominal**
accumulates pipe damage after an eight-second exposure allowance. Damage causes
visible blue water jets/drops in 3D and the schematic and reduces delivered coolant
flow. Leaking fittings also spray. Blades, bearings and fittings retain independent
damage; bearings can slow/stop the motor. Healthy single-pump operation is unchanged.
These values are fictional gameplay parameters. Generator output still depends on
heat, transfer/cooling, shaft/breaker state and retained rotor condition. The normal
gross rating is 410 MW; overdrive can exceed it and accumulate turbine damage.

Primary and secondary flow each have a left-side instrument showing actual delivered
flow, actual pressure and the healthy-pipe damage limit (about **5,780 m³/h**, derived
from **145% nominal ΔP**). Each card turns amber from **125% ΔP**, then red above
145% or while pipe damage remains. Text identifies near-limit, overpressure and
retained damage states. Pressure drives the warning even if a leak lowers delivered
flow below the displayed healthy-pipe limit. Alarm acknowledgement cannot hide it.
Both flow illustrations follow their own actual circulation on the shared frame loop,
including zero-flow stillness, pause, visibility and reduced-motion handling.
The six instruments remain compact enough for the default wide-screen overview.

Click a pipework label, the sidebar pressure readout, or a leaking pipe joint to
inspect pressure, flow, damage and explicit repair. Pipe repair requires both
affected-circuit run switches OFF and actual motor speed/flow below 0.5%, together
with the existing stopped/cooled/fault-free repair checks. Damaged internal pump
parts require that pump OFF and stopped. Turning flow off stops the spray but
does not heal damage; **Repair all** also repairs isolated pipework and internals.
Repairs preserve heat, fuel, settings, operating hours and reactor/turbine trip
latches. Water spray and pump cutaways share the existing frame loop and respect
pause, hidden views, detach, Maintenance and reduced motion. Reset demo clears the
damage/leaks and returns every pump to OFF.

## Component consoles and operating exercises

Heat exchanger, all four pumps, pipework, turbine/generator and condenser open independent,
movable nonmodal windows via pointer or Enter/Space on their outlined equipment.
Requested inputs and actual read-backs remain separate. The underlying process stays
usable; windows retain positions, clamp to the viewport, close with ×/Escape and
close on hide/detach. Pause keeps them available for inspection. Each console has
live readings, an animated valve/flow illustration, causal explanation, local
120-sample trends with per-series ranges and operator-change markers, disturbances,
operating hours, retained wear and a bounded maintenance history. The reactor's
former detail card is now a collapsible reading section inside the core-map window.

- Pumps: each of the four dialogs has a compact interactive SVG cutaway beside
  local speed/flow/pressure trends. Drag the impeller, valve or trim, or select a
  part for a native slider and ±5 controls. Keyboard arrows adjust one unit
  (ten with Shift); Home/End choose bounds. Dragging previews until release;
  cancellation and closing/hiding discard uncommitted changes. Dashed amber
  requests remain separate from solid actual speed/valve read-back. Native
  ON/OFF rockers show requested enable while motor status follows actual
  running/coast-down. Disturbances use sliders too; numeric percentage entry
  fields are removed. Readings/history are collapsed. At wide sizes, the default
  dialog fits without scrolling; below 850 px the columns stack and only the
  cutaway scrolls horizontally. Controls remain start/stop, speed, ±25 percentage-
  point speed trim and discharge valve.
  Actual motor speed is distinct from flow: restricting a valve can reduce flow
  without reducing shaft speed. AC supply remains authoritative. Speed is Auto-owned
  while running unless the operator explicitly enables the pump's manual override.
  Release resumes regulation through the existing actual-speed inertia; enable state
  is never silently changed by Auto. Other tuning remains operator-owned while Auto
  compensates through available reactor/pump controls.
- Heat exchanger: a compact interactive SVG cutaway (up to 520 px wide) sits
  beside a right-hand local trend and collapsed details, fitting the default
  window without vertical scrolling at 1440×900 and larger. Below 850 px
  viewport width the columns stack. The narrow trend has its own plot bounds
  and retains range legends/operator markers. The cutaway replaces numeric setting fields. Drag
  the primary bypass, secondary valve, tube bundle or fouling deposits horizontally
  and release to apply one command; actual response continues through existing
  inertia. Arrow keys adjust 1% (10% with Shift), Home/End select endpoints, and
  part-selection buttons expose a native slider and ±5% buttons for touch/keyboard
  use. Dashed valve handles show requests separately from solid actual handles.
  Temperature colors, flow, heat arrows, secondary steam and deposits follow actual
  state on the shared visibility/pause/reduced-motion-aware animation loop. The
  cutaway scrolls horizontally on narrow screens while the controls fit the window.
  Disturbance strength/period also use sliders with readouts; trends, faults, service
  interlocks and the movable nonmodal lifecycle remain intact.
  Settings remain primary bypass, secondary valve, effectiveness and fouling.
  Transfer is the product of remaining non-bypassed flow, valve opening,
  effectiveness, unfouled fraction, disturbance and wear factors. Restrictions reduce
  heat removal, affect secondary temperature and electrical output, and can heat the
  core. Fault-free cooled/stopped service removes fouling; running adjustments cannot
  decrease accumulated fouling to bypass that requirement.
- Condenser: an interactive SVG cutaway shows actual cooling-water flow, secondary
  steam, falling condensate and return temperatures. Drag the cooling-water valve
  or inlet-temperature dial, or select a control for a native slider and fine-adjust
  buttons. Settings remain cooling-water valve and 0–60 °C inlet temperature.
  Warmer water and restriction reduce heat rejection, cooling margin and available
  generation. Condensate follows actual heat, secondary flow and cooling capacity;
  cold/no-flow states do not show condensation.
- Turbine/generator: an interactive SVG cutaway exposes the steam-admission valve,
  governor-response and load-ramp dials. Turbine and generator rotors share actual
  shaft motion/coast-down; electrical-route markers require actual output. The native
  generator-breaker rocker shows the actual open/closed contact in the cutaway,
  with closing locked until ready and an explanation beside the switch. Separate
  explicit Open admission, Trip turbine and Reset turbine trip buttons retain all
  existing interlocks. Tuning remains steam admission, governor response (0.1–30 s), load ramp (1–400 MW/s),
  manual generator breaker and separate turbine trip/reset/Start. Shaft speed has its
  own simulated inertia and can remain nonzero with zero electrical output. The
  breaker closes only with shaft speed ≥90%, cooling available, no turbine trip,
  active fault, severe wear or meltdown. Auto may establish low unloaded shaft speed
  with an open breaker but never closes it. A turbine trip closes admission and opens
  the breaker. Reset requires cooled/stopped/fault-free conditions and shaft ≤5%;
  it leaves admission closed and breaker open until explicit turbine Start/tuning.
  It never resets the reactor trip or restarts the reactor.

Both new cutaways have native sliders and readouts for tuning and disturbance
strength/period, with no numeric entry fields. Arrow keys adjust one schema step
(0.1 s for governor response), Shift adjusts ten steps and Home/End choose bounds.
Fine-adjust buttons move five steps. Dragging previews the request, committing
only on release; pointer cancellation, lost capture and closing/hiding discard
uncommitted previews. Solid actual valves remain separate from dashed requested
positions. Local trends sit beside the cutaway with collapsed readings, readiness
and maintenance history; turbine trends show shaft speed, electrical output and
admission. Below 850 px columns stack, with horizontal scrolling confined to the
illustration. Both themes and the shared pause/visibility/reduced-motion/detach
lifecycle are preserved, with no independent animation timer or model changes.

### Turbine wear, overload and blade loss

TG-01 has a normal gross rating of 410 MW, with no hard nameplate output clamp.
The interactive **Generator loading** dial spans 50–160%, default 100%; higher
loading extracts more fictional electrical power and can overload the rotor.
Auto never changes this dial. Electrical targets accept 0–650 MW, while normal
grid dispatch remains capped to its existing approximately 300 MW envelope and
derates for actual turbine condition. Existing reactor cooling/fuel/hot-spot
regulation and all explicit emergency/turbine trip rules remain in force.

The left Electrical output instrument turns amber from 90% of rated rotor load,
then red at 110%, or with at least 25% blade damage / 70% service wear. Smaller
retained blade damage and maintenance due keep amber emphasis after unloading.
Text identifies near/over-rated load, damage, destruction and maintenance due;
the tooltip states rating, actual rotor load and damage/wear. Both themes have
specific alert colors. Trends expand their MW scale beyond 400 as needed.

Normal actual shaft rotation accumulates about 2% service wear per full-load
simulated hour (less at low load); stopped shafts do not wear. Scheduled service
is due at 25%, shown in the turbine window, alarms and Maintenance. Minor healthy
wear remains visible in the instrument/window without creating an immediate
maintenance-list entry. Unserviced wear reduces efficiency; after service is due
it also weakens the rotor. Overload accelerates wear quadratically and adds blade
fatigue after a short exposure allowance. A fresh/serviced rotor samples its own
strength (104–116% of rating) and allowance (3–8 s), so fracture timing varies.
The ongoing evolution is deterministic given those sampled values; randomness
is not evaluated on every tick/frame. These are fictional gameplay constants.

Blade damage permanently derates available electrical MW until explicit service;
100% damage removes all 40 illustrated blades and output becomes zero. A broken
spinning rotor can deteriorate further from imbalance after unloading. The event
journal, retained incident cause and maintenance history record fractures. No
rotor failure presses the reactor emergency button or silently resets/restarts
anything. Heat, fuel and coolant dynamics continue independently.

Missing blades and fragments appear in the 3D overview, retained schematic and
interactive turbine cutaway. Two bounded instanced meshes handle all 3D blades
and fragments; one shared frame clock drives one-shot travel, tumble, falling
and resting fragments. No extra timer or growing particle pool is introduced.
Pause/hide/detach/reduced-motion handling uses the existing lifecycle. Closed
windows do not render; current damage is restored when reopened. Service/reset
clears fragments and restores attached blades, including in the idle 3D scene.

**Service turbine** or **Repair all** restores blades/service wear through the
existing cooled, stopped, fault-free readiness path, additionally requiring shaft
speed below 0.5%. It samples a fresh rotor tolerance. Service preserves retained
heat, fuel, targets (including generator loading), hours and both trip latches;
startup remains explicit. Reset demo restores the normal 100% loading/cold session.

Component disturbances have adjustable strength and period, a one-shot nudge,
continuous periodic fluctuation, progressive deterioration and explicit clearing.
Clearing restores the restriction while preserving wear/damage. Component service
requires the same cooled/stopped/fault-free conditions as core repairs; it preserves
hours, retained heat, fuel and trip state. Global Repair components also services
these components after all faults are cleared. Fuel replacement is blocked by
component faults/wear as well as the existing core checks. Maintenance and fuel
replacement events remain inspectable for this session; Reset demo clears them.

**Objectives & scenarios** opens a separate control-room window with a startup
checklist, maintenance journal and three objectives: reach the selected electrical
MW target, recover cooling, or maintain powered circulation through grid loss.
Success must hold for 20 simulated seconds. Starting an objective never starts or
repairs the plant. Diagnostic scenarios present falling flow, warming return,
uneven output or interrupted external supply as symptoms; inspect equipment or use
Reveal cause to identify the initiating cause. Their faults require explicit recovery.

The authoritative `electricalOutput` read-back includes transfer restrictions,
condenser cooling, turbine admission, breaker/trip and any load ramp. The controller,
auxiliary supply, charts, incident report and instrument use that same value.
Valve handles and bypass flow follow actual positions, not just requested settings.
All component constants/rates and shaft percentages are illustrative demo values.

## Automatic regulation and fluctuations

**Auto** has selectable **Core temperature** and **Electrical output** objectives.
Electrical output regulation is the initial and Reset demo default (200 MW electric).
Core temperature regulation remains selectable. It holds configurable core temperature
(minimum 40 °C, default 286 °C, no upper entry cap) and circulation
(25–100%; default 85%) targets. Removing the old 330 °C input/model clamp does
not change the independent over-temperature alarms or accumulated-damage model.
Emergency shutdown is operator-only even with all Auto targets set very high.
A one-second illustrative regulator uses
feed-forward plus proportional/integral temperature correction to adjust the rod
bank, retaining individual offsets where travel allows. Independent feedback adjusts
enabled pump speed targets. It does not automatically re-enable an operator-disabled
pump. Bank/load and pump-speed sliders are disabled during automatic running; individual
rod sliders require an explicit override. Pump enable buttons, Stop and Emergency
shutdown remain available. During a trip, pump speeds
can be changed to restore circulation. Returning to Manual holds current settings.

Small, bounded deterministic waveforms disturb heat, output and each loop's flow.
**Fluctuations: On/Off** lets the user compare disturbance response. The automatic
controller regulates the drifting process rather than freezing displayed values.
The model is deliberately simplified and does not solve reactor/neutron physics.
Trips inhibit regulation. Resetting a trip never triggers automatic restart; an
explicit Start is required even when Auto remains selected.

For grid-style generation control, the initial **Auto → Electrical output** mode uses
**Output target** (0–650 MW electric; default 200). The target
is generator electrical output (`MWₑ`), distinct from the thermal output (`MWₜₕ`).
The left electrical card and regulation status show actual versus requested output.
The right trend switches its output axis from reactor load (%) to electrical MW and
includes the target's recorded history as a dashed line. Only active electrical
regulation records target samples, so the line does not imply a target was active
before it was selected.

In electrical-output mode, **Core target** becomes **Core limit**: the same configured
temperature now limits requested generation. Pump circulation still follows the
configured flow target. The controller adjusts rods against actual generator output
and secondary flow, limits thermal power by available cooling and the temperature
ceiling, and prevents integral wind-up when constrained. Unachievable requests show
the limiting reason (for example **Core temperature limit**); reported output is not
replaced with the requested value. Returning to temperature regulation restores that
objective, preserving the electrical setpoint for later. Trips, manual mode and
explicit restart rules remain authoritative for both objectives.

### Simulated grid-controller requests

The **Grid controller** card beneath the left instruments offers an explicit
**Follow requests** checkbox and **Request now**. New/reset sessions select following
by default and retain the stopped Auto/Electrical output 200 MW initial target. This is a local,
deterministic dispatch exercise; there is no grid server or device connection.

With the feed enabled and the reactor running in Auto → Electrical output, the
first message arrives after 45 active simulated seconds, followed by one every
60 active seconds. Request now immediately delivers the next message and restarts
the interval. Requests alternate illustrative raise/lower changes and stay within
normal available capacity, capped at 300 MW with healthy equipment. Capacity uses
a 330 °C normal operating envelope and available pump circulation, with headroom
and five-MW rounding; it derates for exchanger/condenser/turbine restrictions,
pump trim/overrides, faults/wear, retained heat, fuel capability and fixed rod
overrides. It is independent of the operator's uncapped manual temperature field.
No request is delivered without usable circulation and generation capacity.

Each message coordinates the MW target, circulation target and core limit. Flow
is chosen according to requested load relative to available capacity (60–100%),
then expected conversion/cooling determines the needed core limit with 8 °C
control headroom. A healthy 240 MW request therefore adjusts both settings and
does not remain stuck at the old 85% / 286 °C default ceiling. The message retains
ID, elapsed time, direction, previous/requested MW, planned core/flow settings,
available capacity and explicit simulated source. Actual output follows the
existing regulator/actuators, with all changes recorded in the Automation journal.

The card distinguishes actual output, current target, last request, countdown and
limiting/waiting status and available dispatch capacity. The operating temperature
and circulation settings are owned by each incoming request; alarm/damage
thresholds, cooling/fuel capability and manual pump/rod overrides remain authoritative.
Messages cannot activate/reset emergency shutdown, start equipment, close breakers or change alarm/damage thresholds.
Countdown and request delivery suspend during Stop, trip/meltdown, pause, Manual
mode or temperature regulation. Hiding the console freezes simulated time as usual.
No request can reset a trip, start a reactor/turbine, refuel or repair equipment.
Resume after a stop/trip still requires the existing explicit operator actions.

Disabling the feed retains all current operating targets. Operator MW, temperature
and circulation edits apply immediately and are identified in the card; a later
grid message may replace them while following is enabled. Reset demo clears the
last message/sequence, restores following and holds the initial 45-second countdown
until the reactor is running and dispatch-ready.
Snapshots expose `commands.followGridRequests` separately from `gridDispatch`
message/countdown/status data and measured/simulated electrical-output signals.

### Individual rod overrides during Auto

Select a control rod in the floating core map and enable **Manual override in Auto**.
Its slider and one-percent buttons then hold that rod's requested position while Auto
continues to regulate the remaining rods. A dashed amber channel border identifies
the override. Actual insertion still moves gradually, so the process can fluctuate.
Large imbalances can create local hot spots and invoke the existing protective response.

The controller accounts for fixed override targets when calculating the remaining
bank's insertion, preserving offsets until travel limits. It reports **Manual overrides
limit regulation** when the available rods cannot reach the requested bank mean and
**All rods under manual override** when none are free. Integrals do not wind up against
these limits. Unchecking the override returns that rod to Auto without jumping its
actual position. There is no timeout or silent takeover. Stop, trip and mode changes
release overrides; Stop/trip always insert every rod. Bank/load controls remain blocked
in Auto. Snapshot rod commands include `owner: AUTO|MANUAL` independently of read-back.

## Fuel exposure and manual replacement

Fuel assemblies (`FA-01` onward) are separate inventory objects from control rods.
They start with deterministic, staggered reserves of 36–99%, so they do not expire
together. Energy/exposure-based use follows generated thermal load, nearby control-rod
positions and a bounded spatial factor. Shutdown and pause consume no further fuel.
The broad principle is that [burnup tracks energy produced from fuel](https://www.nrc.gov/reading-rm/doc-collections/fact-sheets/bg-high-burnup-spent-fuel).
This feature's reserve/effectiveness equations and time scales are an accelerated toy
model, not isotope tracking, a validated neutronics calculation or real fuel lifetime.

Select an amber assembly in the map to see remaining reserve, effectiveness, accumulated
demo full-power hours and replacement count. **Fuel exposure speed** offers 1×, 10× and
60×; it changes fuel use only, leaving thermal dynamics and simulated time unchanged.
At 1×, a fresh assembly has six demo full-power hours of nominal reserve, adjusted by
its channel's history. Effectiveness declines with reserve; zero reserve contributes
zero capability. Aggregate capability is normalized to the initial mixed core and capped
at 115% after fresh replacements. The retained manual startup load is 64%; Auto uses its selected target after Start.

Manual output falls as fuel is used. Auto withdraws available rods to compensate, then
reports **Fuel capability** if the remaining fuel cannot satisfy the target. Per-assembly
20%/depleted transitions enter the journal; an active low-fuel alarm remains until the
affected assemblies are replaced. **Automation never replaces fuel.** The map's **Replace all fuel** action manually
renews every assembly together, using exactly the same readiness checks as selected
replacement. The operation is atomic; it does not start the reactor or clear heat,
damage or a trip. Each selected or bulk action starts one 10.5-second
representative crane transfer and reports the actual replaced assembly count.
Inventory renews immediately; crane motion is cosmetic and follows visibility,
pause and reduced motion. Closing the core map clears its local exchange highlight
but does not cancel the shared crane. Start/meltdown cancels an unfinished crane
illustration. See the pool section for deposition/cooling and the game plan before
attaching payments or mission receipts to this current visual mechanism.

**Replace selected fuel** changes only the selected assembly to 100% reserve, zero
exposure and an incremented replacement count. It requires a stopped reactor, all rods
at least 99.5% inserted (requested and actual), coolant below 150 °C, peak local fuel
below 200 °C, no injected fault, no retained damage and no meltdown. Readiness reasons
are shown beside the button. The trip latch, retained heat, other assemblies and control
settings remain intact. Component repair never renews fuel. Reset demo resets inventory.
These are illustrative UI interlocks, not a real refuelling procedure.

## Auxiliary power and backup generators

Two small low-poly diesel cutaways (46% of their former standalone scale) sit
behind the turbine/generator in the main 3D plant. Grid, AC bus and energized
source-to-pump electrical routes share the same renderer, camera, picking,
batching, themes and GPU disposal. Actual engine state drives pistons/fans/shaft;
actual fuel drives tank fill, and actual bus load drives lamps/wire markers.
Stopped/empty engines remain still; running unloaded differs from supplying.

Click either engine or its label to open its own movable, nonmodal diesel window.
Each retains automatic standby, countdown, fuel/load, manual refuelling and a
single pump-style ON/OFF rocker with switch semantics. OFF disables standby;
starting/stopping/refuelling interlocks are unchanged. Actual state remains
separate from the run switch. Both diesel dialogs can remain open independently.

The compact **Pump power source** panel appears above Grid controller at left,
showing source/load and buttons for each engine. Its ↗ button, or the 3D grid/bus,
opens **Electrical supply & connections** with the retained 2D route. External-grid
availability and turbine-feed connection remain native checkboxes/switches with
pump-style rocker faces, keyboard activation and existing change handlers. The
former Auxiliary power view and top-right EXTERNAL GRID button are removed.

The 3D toolbar offers **Labels: Off / Compact / Full**. New sessions default to
compact equipment tags, revealing full names/readings on hover or keyboard focus.
The selected card stays expanded; Full shows every card. Off hides visual cards
while retaining canvas picking and keyboard controls (a focused control reveals
its full card). Cards are reclamped when their size changes. The setting survives
view/tab switches, Reset demo and element reconnection; reduced motion removes
the opacity transition. The unified scene freezes on pause/hide/reduced motion and while
Maintenance is selected. Detach disposes one renderer; reconnect restores current
plant state. SVG fallback keeps the sidebar and all electrical dialogs usable.

Pump power is independent of reactor generation: after shutdown it normally comes from
the external grid. The broad source arrangement is informed by the [NRC emergency power
system description](https://nrcoe.inl.gov/SysStudy/EPS); this demo does not reproduce a
particular plant's electrical distribution or emergency cooling design.

Source priority is turbine auxiliary feed, external grid, then available backup diesels.
The turbine must be running, connected and producing at least pump demand plus 1 MW.
Normal sources have a fictional 20 MW auxiliary capacity. Pump demand is 0.2 MW of
base load plus 3.5 MW per enabled primary pump and 2.5 MW per enabled secondary
pump, each multiplied by its requested speed fraction cubed. All four pumps at
100% demand 12.2 MW. Each diesel has 8 MW capacity: one can run the ordinary
one-pump-per-circuit arrangement, while all four need both diesels for full speed.
Insufficient bus capacity reduces actual motor speed/flow without changing run
switches or targets. Generator
output and the grid-controller target remain **gross electrical generation**, separate
from this auxiliary-load indication; no net-export model is implied.

The electrical connection window permits grid disconnection/restoration and turbine-feed isolation/reconnection.
Each diesel has automatic standby, manual Start/Stop, remaining fuel, startup countdown,
actual bus load/capacity and manual refuelling. Armed diesels start when both normal
sources are unavailable, taking eight simulated seconds. Initial fuel differs (A 82%,
B 95%). Nominal full-load endurance is 30 simulated minutes; an unloaded running engine
still consumes 20% of its full-load rate. Exhaustion stops the engine. Fuel below 15%
raises an alarm. No controller refuels a diesel.

Manual Stop disables that engine's automatic standby so the command persists. Re-arm
standby explicitly when wanted. Refuelling requires a stopped/non-starting engine.
Diesels remain running, unloaded, after normal power returns until manually stopped.
One available diesel carries the normal main-pump pair; two share the load and
can carry all four pumps at full speed. Pump enabled states and
speed requests remain separate from energized/actual speed. Without AC the pumps coast
down and coolant animations slow, even if their requested enable state is still on.
Restoring power ramps the requested pumps back up but never resets a trip or restarts
the reactor. Instruments have an independent, idealized simulated DC supply; battery
capacity and charging are not modeled.

Source transitions, starts/stops and refuelling enter the journal. Total AC loss begins
an incident, raises low-flow alarms and affects retained heat and progressive core
damage. It never activates emergency shutdown in either mode. Backup availability does not heal damaged pumps.
Supply, diesel fuel and startup time freeze with the rest of the paused/hidden simulation.

## Expanded live trends

Click the Live trends panel (or focus it and press Enter/Space) to open a larger
movable, nonmodal chart window, up to 1200 px wide. Both charts share the current
two-minute history, temperature scale, output mode and electrical target; they
update together. Drag the title bar or use its arrow keys, close with × or Escape,
and reopen at the retained position. The window clamps to narrow viewports and
closes when the feature is hidden or detached. Pause freezes its data while keeping
the chart available for inspection. Both themes use the existing chart palette.

## Logging

The event journal retains the newest 200 records in this browser instance, with
simulated elapsed time, severity, category, and message. Categories are Operator,
Automation, Process, Alarms, and System. Automatic corrections and process snapshots
are recorded every ten simulated seconds; mode changes, commands, faults, clears,
acknowledgements and recovery are recorded as they happen. Filtering changes only
what is displayed. **Export CSV** exports all retained records in chronological
order, explicitly marked `SIMULATED`. Free-operation logs are not saved across
reload/reset. Career snapshots preserve their bounded current journal and trends;
they do not turn the 200-entry journal into an unlimited mission archive.
Company reports/achievements are saved separately from that rolling journal.

The condition model keeps a separate incident report so the initiating fault is
not lost when the ordinary journal rolls over. It records the cause, up to six
preceding events, and a bounded 160-entry timeline with instrument snapshots;
the first incident event is preserved. **Export incident report** downloads JSON
explicitly marked `SIMULATED`. Early successful recovery marks an incident resolved;
meltdown leaves it open for inspection. Free-operation reports are session data
and are cleared by Reset demo. Career snapshots retain the current incident along
with heat/damage/trips. Export before resetting or replacing a career if the report
needs to be kept independently.

Each desktop custom-element instance owns its state. Reloading or closing the
desktop discards free operation and ends its shared session. Careers can be
restored from their local save, with a fresh pairing session. A companion browser
never advances a second plant clock. Scrolling the entire console out of view or
hiding its tab suspends local rendering/audio; a visible paired companion can
keep the desktop plant clock active. Without a visible companion, the original
visibility suspension applies without fast-forwarding on return. Browser/OS
suspension can still freeze the host. Detaching clears timers, observers and
session sockets. Reduced-motion preferences disable visual animation while
instruments and controls continue to work.

## Optional companion console

The desktop layout is retained. **Connect screen** opens an expiring eight-digit
pairing code and a link for testing in another browser window. A tablet or another
computer opens **Companion screen** (`/companion/`), enters that code and
connects to the existing desktop session. The companion omits the logo and visible
page title, retaining the regulation/display header and compact connection status.
Its code form lives in a native blocking modal with the console visible behind it;
Escape and backdrop clicks cannot dismiss pairing. It closes only after live
desktop state arrives, stays open for invalid-code retries, and reopens on lost or
revoked connections. Automatic reconnect closes it after fresh state. Detach
closes the modal; reconnecting the element requires pairing again. Grid
requests/readings, the embedded core
map and trends/alarms occupy selectable left-side panes; Start/Stop, rods/load,
pump rockers/speeds and covered emergency shutdown remain on the right. Narrow
screens stack controls above information. Equipment/electrical/diesel windows use
the same component rules. Core-map **Replace selected fuel** and **Replace all fuel**
commands run on the desktop console, using its authoritative cooldown/fault/damage
and pool-capacity checks and starting its existing crane-to-pool animation. Each
screen keeps its own fuel selection. The companion receives renewed fuel, pool
capacity and the host confirmation; it never creates its own transfer or pool batch.
Rejected/offline commands do not renew fuel. Pool dispatch, bulk maintenance,
scenario injection and Reset demo remain desktop-owned. Themes, sound opt-in, panel selection and
emergency-cover position are local; desktop reset closes the companion cover.
The information and operator columns grow to their natural content height. Page
scrolling reaches all controls and stops at the console footer; there are no
viewport-height column scrollers or landing-content gaps in either console.

`server/session-server.mjs` is a bounded Node WebSocket relay with room isolation,
same-origin checks, ten-minute codes, separate per-device credentials, command
validation/acknowledgement, stale-state rejection, revocation and reconnect. It
neither simulates nor saves the plant. State is published twice a second and
after committed commands; companions never queue or replay offline commands.
Stale/disconnected companions lock controls and suspend motion/audio. Brief host
transport loss retains the room for 30 seconds; browser reload or backend restart
requires pairing again. No accounts, economy or multiplayer are implemented.

`compose.yml` references the published Nginx frontend and non-root Node 22
`session-server` images, retaining local build definitions. After the production
workflow completes, `docker compose pull` and `docker compose up -d --no-build`
install/update both; `docker compose up -d --build` builds from source. Only port
8080 is published by default; Nginx proxies `/session` to the internal backend.
The existing frontend image also runs without the optional relay. Local development
runs `npm run start:sessions` alongside `npm run dev`, whose Vite proxy forwards
WebSocket upgrades. HTTPS reverse proxies must retain WebSocket upgrade headers.
For Nginx Proxy Manager, set `NUCLEAR_ALLOWED_ORIGINS` in `.env` to the
exact public origin (for example `https://nuclear.porssiohjain.fi`); Compose maps
it to the relay’s `ALLOWED_ORIGINS`, allowing proxies that rewrite upstream Host.
See the Nuclear README for deployment details and limitations.

## Implementation and future measurements

- `src/simulation/nuclear-power-missions.js` defines/evaluates company assignments
  and records inbox messages, reports, capabilities and achievements.
- `src/simulation/nuclear-power-game.js` and its CSS provide game entry, company UI,
  session switching, save orchestration and one-tab ownership.
- `src/simulation/nuclear-power-game-save.js` defines schema-1 full-state saves and
  IndexedDB revisions; do not replace this with a companion transport snapshot.
- `src/App.tsx` mounts the console through React, independently of Vaadin.
- `src/simulation/nuclear-power.js` renders the native custom element, SVG
  schematic, controls, recent two-minute trends, and bounded event journal.
- `src/simulation/nuclear-power-scene.js` owns the low-poly overview,
  bounded camera, picking, semantic labels, geometry batching and renderer cleanup.
- `src/simulation/nuclear-power-particles.js` batches repeated moving
  markers into instanced meshes without putting each marker in scene traversal.
- `src/simulation/nuclear-power-electrical-scene.js` builds diesel cutaways,
  grid/bus and actual-state electrical routes in the main plant renderer.
- `src/simulation/nuclear-power-electrical.js` supplies the left source panel,
  electrical connection window and independent diesel control windows.
- `src/simulation/nuclear-power.css` is isolated in the element's shadow root.
- `src/simulation/nuclear-power-light.css` supplies the optional light palette.
- `src/simulation/nuclear-power-companion.js` lays out the paired console and manages
  connection state. The session client/protocol/state modules handle socket lifecycle,
  whitelisted commands and a read-only simulation copy with restored class getters.
- `server/session-server.mjs` relays rooms, state and commands without a database.
- `src/simulation/nuclear-power-model.js` contains the deterministic, browser-local
  plant, individual rod/channel layout, controller, disturbances, alarms and log.
  Its snapshot separates `commands` (requested mode/objective, temperature/flow/MW
  targets, enable states) from
  reported `signals` and per-rod insertion. Signals contain value, unit, source,
  quality, and simulated elapsed time; that time is not a sensor timestamp.
- `src/simulation/nuclear-power-condition.js` owns stored heat, local fuel zones,
  progressive faults, component stress/wear, damage, meltdown and incident retention.
- `src/simulation/nuclear-power-fuel.js` owns separate per-assembly inventory,
  uneven exposure, capability, acceleration and explicit replacement interlocks.
- `src/simulation/nuclear-power-turbine.js` owns sampled rotor tolerances, slow
  normal wear, overload fatigue, retained blade loss/capacity and shared fragment poses.
- `src/simulation/nuclear-power-components.js` owns component settings/read-backs,
  transfer/cooling factors, turbine shaft/breaker, disturbances, wear and exercises.
- `src/simulation/nuclear-power-maintenance.js` renders the live damage/wear/fouling
  list, repair readiness and explicit bulk repair/fault-clear controls.
- `src/simulation/nuclear-power-equipment.js` renders the movable consoles and
  exercises, settings ownership, local trends and maintenance journal.
- `src/simulation/nuclear-power-pump-console.js` renders the four interactive
  pump cutaways, drag/keyboard/range adjustments, requested/actual indicators and
  internal damage; it uses the existing component commands and shared frame loop.
- `src/simulation/nuclear-power-audio.js` owns operating-state loops, UI samples and quiet Start/Stop cues;
  the main element retains alarm scheduling and shared-context lifecycle.
- `src/simulation/nuclear-power-generation-console.js` and its isolated CSS
  render the turbine/generator and condenser cutaways, drag/keyboard/range tuning,
  breaker rocker/readiness, actual-state animation and preview cancellation.
- `src/simulation/nuclear-power-pumps.js` owns four pump identities, parallel
  branch flow, normalized pressure, retained pipe damage and isolation checks.
- `src/simulation/nuclear-power-pump-scene.js` builds the four cutaways,
  independent branch paths, damaged parts and instanced water sprays.
- `src/simulation/nuclear-power-leaks.js` shares actual leak sources and
  falling water trajectories between SVG and WebGL.
- `src/simulation/nuclear-power-supply.js` owns auxiliary-source selection,
  standby/manual diesel startup, fuel, capacity and pump power availability.
- `src/simulation/nuclear-power-temperature.js` maps local loop temperatures
  to the shared absolute SVG/WebGL palette.
- `src/simulation/nuclear-power-grid.js` owns simulated grid messages with following selected by default,
  active-time cadence, readiness, requested MW changes and dispatch status.
- `src/simulation/nuclear-power-motion.js` integrates speed-dependent impeller
  angles and flow dash offsets without phase jumps. Animation frames are separate
  from the 250 ms plant/instrument update and obey visibility and reduced motion.

A later optional integration with Pörssiohjain measurements could reuse that
external backend's `DeviceMeasurementService` through a separately designed API
with ownership checks. That Spring service is not part of this repository, and
company-game development does not require the parent project.
Bind sources per instrument, preserve their actual units
and measured/observed timestamps, and explicitly display measured, calculated,
simulated, stale, and missing states. Do not replace missing live signals with demo
values or write simulated values into the measurement tables. The existing measurement
types cover temperature, humidity, battery percentage, and thermostat setpoint;
flow, power, and confirmed pump state require additional source support.

Real actuator control is a separate future feature. Commanded state and confirmed
read-back state must stay distinct. The existing Powerplant board and dedicated
heating controllers remain independent of this simulation.

Future physical-model work should introduce a transport adapter rather than connect
the current buttons to arbitrary existing relays. Define account/model ownership,
MQTT topics and device/channel bindings, command IDs, expiry, acknowledgements,
actual rod position/pump-speed telemetry, freshness and offline states, and explicit
simulation/hardware mode. Physical interlocks and emergency stop need device-side
enforcement; browser animation or a sent MQTT command cannot establish confirmed
hardware state. The current numeric ranges and trip criteria must not be reused as
physical safety limits without a separate scale-model capability design.

## Verification

```sh
# Independent React app, from the repository root:
npm ci
npm test
npm run build
npm run test:browser
# Focused company-game flow:
npm run test:browser:game
# Focused two-window pairing/controls/lifecycle coverage:
npm run test:browser:companion
# Optionally test an already running preview/container:
NUCLEAR_POWER_APP_URL=http://127.0.0.1:8080 npm run test:browser
```

Routine verification should scale with the change: use focused unit tests and the
build for small edits; run `npm run test:browser:equipment` for turbine/condenser
controls, wear/damage and equipment motion. Keep the full browser suite for broad
regressions, explicit requests and CI. Avoid repeatedly replaying unrelated SEO,
audio, fuel, export and desktop scenarios during small UI iterations.

Browser tests use Chrome at `/opt/google/chrome/chrome` by default; `CHROME_BIN` can
select another installed Chromium executable. Without `NUCLEAR_POWER_APP_URL`, a
temporary loopback server tests the actual production build in `dist/`,
including the React entry point and bundled assets. Chrome uses software WebGL
for headless 3D coverage. Each run prints its temporary
screenshot/CSV artifact directory. No extra browser test dependency is required
beyond Node and Chrome. The simulation tests require no Spring application.

Chrome startup allows 60 seconds and discovers DevTools through the profile's
`DevToolsActivePort` file or a complete stdout/stderr announcement. This also
handles launchers that suppress the announcement. An early exit fails immediately;
startup failures include the command, profile, exit status (when available), and
both output streams. CI uses `/opt/google/chrome/chrome` directly to avoid the
distribution's shell launcher. Focused startup regressions run with `npm test`.

The standalone commissioning baseline (2026-11-12) passed 141 unit/model/session
tests, the production build, full browser regression, focused game and companion
checks, both Docker builds and container smoke checks. See the current game
handoff for precise scope and the next slice.

### Historical verification checkpoints

The older counts and parent Java checks below record previous iterations, not
requirements for building this standalone repository.

Migration checkpoint (2026-11-07): all 59 model/motion/failure/resource/component/audio
checks and 23 focused Java desktop tests pass, as do the React production build,
Chrome regression and Nginx container build/HTTP smoke checks. The clean Vaadin
production bundle contains no references to the removed console.
Browser coverage includes React startup, cold
start and controls, wide/mobile layouts, themes, floating dialogs, exports, animation
and pause/visibility/detach/reduced-motion cleanup. It also checks actual WebGL
rendering, canvas picking and semantic equipment controls, camera zoom/reset,
state-preserving overview/tab switching, the header controls, actual-driven
instrument motion, 3D diesels and their 2D source route, WebGL-loss fallback,
and renderer disposal/reconnection. No real MQTT/model devices are
connected.

The model tests cover independent rod positions, bank behavior, speed/flow inertia,
phase-preserving motion, automatic regulation under disturbances, categorized bounded
logging, normal restart, and trip recovery without losing settings. Browser checks
must also verify fixed pump hub centers over multiple frames, individual selection,
both view modes, control disabling in Auto, CSV export, mobile/container resizing,
wide-screen fitting and column ordering, theme default/persistence, electrical MW
tracking and limiting, floating core-map opening/movement/closing with the process
still visible, persistent overheat indication after acknowledgement, and
pause/visibility/detach/reduced-motion cleanup. Generator checks cover tab keyboard navigation, core-map coexistence, 3D
rendering/picking, fuel fill, start/stop/manual refuelling, loaded versus unloaded
read-back, camera controls, mobile layout, stopped/reduced-motion visuals and
hidden-view/GPU cleanup. Build the standalone app before running its browser
regression; a running Nginx container can be checked with `NUCLEAR_POWER_APP_URL`.

Grid/visual checkpoint (2026-11-07): 71 unit checks cover grid tracking, cadence,
pause/mode/stop/trip guards, temperature/rod/breaker ownership and independent
reaction/retained-heat phases. The browser regression also covers 3D/SVG exchanger
steam, vessel reactions, cold/no-flow/Stop behavior, pause/reduced motion, grid
message delivery and requested-versus-actual output.

Rendering checkpoint (2026-11-11): 120 unit checks, the production build, focused
equipment browser checks and the full Chrome regression pass. Compared with the
production build from `299f62c`, the warm two-pump fixture uses about 304–305 draw
calls instead of 369–370, with approximately 23,000 triangles and the same visual
detail. Scene nodes fall from 537 to 428. A phone-sized offscreen overview performs
no recurring WebGL draws or SVG motion writes while plant time and floating pump
motion continue. Browser checks also compare cached steam positions with native
SVG geometry and prohibit label-size reads during reading-only redraws. These
counts come from headless Chrome/software WebGL; they are not phone FPS estimates.
