<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Nuclear Power agent guidance

This is the standalone English-only Nuclear Power React/Vite project. Source,
tests, assets, Docker files and configuration live at the repository root.
Read [doc/nuclear-power.md](doc/nuclear-power.md) before changing plant behavior
and [GAMEPLAY-PLAN.md](GAMEPLAY-PLAN.md) before changing the company game.
Preserve unrelated worktree changes and the retained custom-element lifecycle.
No Java, Spring, Vaadin login or parent repository checkout is required.

## Licensing

Use the unchanged Pörssiohjain Personal Use License v1.0 from LICENSE and the
existing Pörssiohjain copyright/license header in project-owned source files,
scripts, styles, configuration and documentation. Keep the original product
wording in that header. JSON files use the package license reference instead of
invalid comments. Bundled third-party audio/assets retain their own CC0 licenses
and source/attribution records; do not replace those with the project license.

## Company game handoff

Read [doc/game-development.md](doc/game-development.md) for the current code map,
save contract, known gaps and next implementation slice. It distinguishes current
behavior from the larger product plan.

Free operation remains the default. Start game creates a separate cold career;
Continue restores its IndexedDB save paused. Company inbox assignments currently
cover startup and five reliable minutes, with reports, archived achieved goals
and explicit full-state saves. Money, bankruptcy and further missions remain
planned. Do not present those as implemented.

Accepted assignments show a gray-to-green checklist above Live trends. Derive
steps from pinned terms and actual plant/evidence; verified steps remain green
until reported. Keep full briefings in Company inbox, hide the checklist before
acceptance/in free operation. The checklist adds no saved fields.

Use permanent semantic mission IDs and capability dependencies, not a current
mission array index. Pin issued objective terms and preserve completed IDs and
achievements when inserting later missions. Mission updates cannot reset progress
or silently alter active requirements. Plant actual readings verify goals.

Career data is separate from free operation and companion transport snapshots.
Preserve atomic save revisions, one writer tab, saved heat/damage/trips, sampled
rotor tolerances, pool records, and no offline advancement. Switching sessions
ends pairing and clears local motion/audio; companions never tick a career.
Keep accepting/reporting/import/export and new-career actions desktop owned.
Company inbox/mission/finance summaries on companions are still planned.
Save schema version 1 is validated but has no migration runner, previous-revision
recovery UI or career restart checkpoint yet; add tested migrations before
changing required saved fields or introducing new objective kinds.

Run focused model tests and `npm run build`. Use `npm run test:browser:game` for
company behavior and `npm run test:browser:companion` for session changes. Keep
the full browser suite for broad changes or release gates.

## Branches and deployment

`main` is the development branch; `production` publishes release images. The
GitHub Action runs tests/build/browser checks only on `main`, and the same checks
followed by both image pushes on `production`. It has no pull-request trigger.
Manual runs obey the selected main/production branch; other branches skip the jobs.
Frontend Docker and Compose contexts are this repository root. Images are
`ghcr.io/norkator/nuclear:latest` and `ghcr.io/norkator/nuclear-backend:latest`.
Keep amd64/arm64, QEMU for the backend, the non-root relay, and proxy upgrades.
The public URL remains https://nuclear.porssiohjain.fi. Do not deploy or push
unless the user asks.

## Reactor and equipment handoff

Read [doc/nuclear-power.md](doc/nuclear-power.md) before changing the reactor or game.
The English-only standalone React/Vite app is a fictional two-loop reactor / future physical
scale-model control room, not a simulator of a specific real reactor. All current
signals and commands are browser-local simulation; no MQTT devices are connected.
The app, simulation modules, styles, bundled audio and tests live in the repository root.
React hosts the retained `nuclear-power-console` custom element; preserve its lifecycle.
The homepage is a static landing/SEO page with Nuclear reactor and Companion
screen cards. Independent `/reactor/` and `/companion/` HTML entries mount the
consoles without landing/guide DOM. Keep selected URLs on reload and let Back
return to the landing page; free-operation plant state is not saved across reload; careers use local saves.
Companion columns grow with content and use ordinary page scrolling, with no
fixed-height inner scroll regions or empty trailing content. The companion omits
its logo/title; pairing uses a blocking native dialog with the console behind it.
Escape/backdrop clicks cannot dismiss it; only live session state closes it.
Preserve invalid-code retry, stale/disconnect/revocation reopening, reconnect
closure, focus containment and detach cleanup. Legacy
`/?screen=companion` links redirect to `/companion/`, preserving code fragments.
Optional companion browsers use `/companion/` and pair through Connect screen
with the simple Docker WebSocket relay in `server/`. The desktop remains
the sole simulation host; companions never tick their state or queue offline
commands. Companion core-map selected/all fuel replacement runs through the desktop
console, including cooldown/pool-capacity checks and its crane-to-pool animation;
sync readiness/results without changing desktop selection or creating local batches.
Pool dispatch remains desktop-only. Keep room isolation, command/read-back separation, stale control locks,
reconnect/revocation and local motion/audio cleanup. A visible paired companion
may keep the desktop clock active while its local rendering is hidden; otherwise
preserve the existing visibility rules. Run `npm run test:browser:companion` for
focused pairing and shared-control checks. `compose.yml` builds both the
Nginx frontend and non-root relay for Ubuntu Docker hosting. See the Nuclear README;
accounts, economy and multiplayer remain outside this first version. The local
commissioning career described above now supports saved games.
For routine changes, run focused unit checks and `npm run build` in that folder.
Use `npm run test:browser:equipment` when equipment UI/interaction coverage is needed.
Reserve the full `npm run test:browser` for broad changes, explicit requests or CI;
do not repeatedly replay the whole browser suite for small edits or timing-only
fixes. Run `npm ci` when installing dependencies or after lockfile changes.
No Spring app or account login is needed. `.github/workflows/nuclear-container.yml`
publishes `ghcr.io/norkator/nuclear:latest` and
`ghcr.io/norkator/nuclear-backend:latest` for amd64/arm64 on production
pushes/manual runs, gated by model/build/browser/companion checks. QEMU supports
the backend ARM64 build. Compose retains local builds and references both images;
production updates use `docker compose pull` and `docker compose up -d --no-build`.
The Vaadin desktop/Start link opens `https://nuclear.porssiohjain.fi`
in a separate tab; do not reintroduce the old Vaadin simulation view.
The frontend separates requested rod/pump settings from actual simulated read-back.
Equipment detail lives in the component dialogs (reactor readings in the core map),
not a main-view card. Component valves, bypass, cooling, disturbances and turbine
breaker/shaft affect the common electrical output and cooling model. Preserve
manual pump overrides, explicit turbine restart/breaker readiness, component service
interlocks, local trends, objectives and symptom-first scenarios. Plant audio has
quiet Start/Stop cues, local CC0 Kenney UI Audio one-shot switch/adjustment samples
(with bundled license/source records), and separate alarms; opt-in steam/turbine/generator loops follow actual running power
and shaft coast-down, crossfading to a fault texture for actual stress/damage/disturbances.
Cold sessions are silent; preserve opt-in, bounded gain,
and mute/pause/hide/detach cleanup of every voice. Reactor overview mixes plant
loops/Start/Stop cues and independent actual-state diesel startup/running/shutdown
sounds. Reactor cues must not interrupt diesel voices. Maintenance silences all
machinery immediately; UI clicks/alarms remain shared. Returning resumes actual
state without replay. Preserve automatic starts, fuel exhaustion, bounded gain,
opt-in loading and Reset cleanup.
New/reset sessions select Auto with Electrical output regulation (200 MW), but
the reactor starts stopped/cold with fully inserted rods and all four pumps disabled
(zero actual motor speed/flow, retained 100% speed targets). Explicitly start at least
one pump per circuit and establish circulation before reactor Start; healthy
running core temperatures have green emphasis in both themes.
Process animations use actual heat/flow/output: turbine/generator coast-down, steam,
condenser drops, exchanger highlights, local fuel glow/molten drips and source-to-pump
bus flow share the visibility-aware frame loop. Rates are illustrative, not RPM;
preserve cold-start stillness, retained heat, reduced motion and pause cleanup.
The process viewport separately suspends offscreen SVG/WebGL work and crane motion;
visible-console plant time, instruments and floating equipment windows remain live.
Preserve distance-based SVG markers, instanced particle visibility/disposal, inactive
leak skipping and turbine blade matrices that update only after damage/service.
Cache equipment label sizes through their resize observer; keep immediate clamping
for explicit selection, hover/focus, label-mode changes and viewport resizing.
Preserve individual rod targets, bank offsets, speed-dependent centered pump/flow
motion, manual/automatic modes, disturbances, categorized logs, and latched trip
recovery.
Primary pumps A/A2 and secondary pumps B/B2 are independently enabled parallel
branches in both 3D and SVG. A2/B2 are manual backups, OFF by default; Auto regulates
only enabled pumps and never enables a backup. Two full-speed pumps provide a
fictional 135% flow and 182% nominal differential pressure. Sustained pressure
above 145% causes pipe damage after eight seconds; visible water jets/drops and
fitting leaks follow actual flow on the shared frame loop. Shutdown stops spray
but retains damage. Track each pump's blades, bearings and fittings separately.
Pipe repair additionally requires both affected-circuit run switches OFF and
actual motor speed/flow below 0.5%; internal pump repairs require that motor OFF
and stopped. Keep cooled/stopped/fault-free checks, heat/fuel/settings/hours and
trip latches. Auxiliary demand includes every enabled pump; partial AC capacity
slows all motors. Preserve cold stillness, pause/hide/detach, Maintenance stops,
reduced motion, picking/dialog lifecycle, both themes and wide-screen fitting. Industrial Start/Stop pushbuttons and pump pilot lamps show actual running
state; stress/wear has amber/red indication. Start/Stop caps have clear green/red
halos with restrained shine, and the emergency cap has a soft armed glow and bright latched red glow.
Load and pump-speed targets share engraved regulator rails, grooved handles and
amber percentage displays; preserve native controls, Auto ownership and pump overrides.
Pump ON/OFF rockers show requested enable state separately from actual motor
lamps/coast-down status; preserve name, circuit, speed and flow readings. Emergency shutdown is a mushroom
button held visibly depressed with a red lamp for every latched reactor trip.
Its transparent hinged plastic cover must be opened before manual activation;
keep the native cover toggle before the button in keyboard order. Opening/closing
the cover never changes the plant or clears a trip. New/reset sessions
close it; preserve both themes and pause/reduced-motion handling.
Only successful explicit Reset trip releases it; preserve interlocks and the
stopped state after reset, readable disabled lamps, both themes and keyboard access.
Automatic control must never reset a trip or restart the plant by itself.
Both Auto and Manual require operator Stop/Emergency shutdown. Flow, temperature,
hot spots and high output/core/circulation targets must never automatically activate
the emergency latch. Auto still limits output and regulates rods/pumps; alarms,
retained heat and progressive damage remain active. Irreversible meltdown stops
generation through its own failure state without pressing the emergency button;
Reset demo is still required. Mode changes never activate or clear a trip, and an
explicit operator trip remains latched across meltdown.
Wide windows use stacked instruments on the left, tabbed reactor/maintenance views
and operator controls in the middle, and trends/logs on the right. Regulation, plant
sound enable/mute, theme, simulation status and clock share the header card beside
the title. UI clicks default to 100% of their bounded range (0.26 gain); there is no
volume slider or test-click button. Thermal/electrical/flow instrument motion follows
actual read-back and obeys cold/zero, pause, visibility and reduced-motion behavior.
Dark remains default; light theme is local to this feature. Auto can regulate core temperature or electrical MW; power requests
must respect the configured core-temperature ceiling and report limiting reasons.
Follow simulated Grid controller requests is selected in new/reset sessions, with
a fresh 45-second countdown held until dispatch is ready. Operators can disable
following to retain their targets. The controller coordinates MW, circulation and operating
core limit on each request (45 active seconds initially, then every 60). Bound
requests to normal available capacity (healthy ceiling about 300 MW), derating for
cooling/equipment restrictions, fuel and manual pump/rod overrides. Keep requested
targets separate from actual output and suspend dispatch while stopped, tripped,
paused, Manual/temperature-regulated or without circulation/generation capacity.
It must never start/reset, close breakers, change protection thresholds, repair or
refuel. Manual temperature entry has no 330 °C upper cap; independent alarms and
damage remain active, while emergency shutdown stays operator-only in both modes. Disabling retains all operating targets; Reset demo
clears messages and restores following. Both loops use actual-temperature colors, including hot
returns and bypass, with core inlet/outlet and secondary return read-back. Primary
cooling drop must honor actual bypass/heat rejection. Valve levers must be parallel
to their pipe axis when open, perpendicular when closed, using actual read-back.
Use shared distance-based marker travel per circuit so longer paths do not look
faster. Exchanger steam stays on the secondary side and follows actual heat/flow;
vessel reaction particles/pulses follow running power/rods, independently of retained
heat. Preserve cold/no-flow/Stop, pause, reduced-motion and renderer cleanup.
Clicking the vessel opens a movable floating core-map dialog while the process
stays visible. Over 335 °C, the core card/outlet/annunciator stay red until cooling,
independent of alarm acknowledgement. These are simulation limits, not hardware safety limits.
`nuclear-power-condition.js` models retained heat, progressive faults, local fuel
hot spots, stress/wear and accumulated damage before a slow meltdown. Trip reset
must never erase heat/damage or heal components. Only cooled, stopped, fault-free
non-melted sessions allow explicit repair; meltdown requires Reset demo. The Maintenance
tab lists retained core/pump damage, component wear and exchanger fouling, with
Inspect, explicit fault clearing, a shared readiness checklist and Repair all.
The core map also lists each damaged local zone with damage/temperature, selectable
rod details, red borders for all nonzero damage and the shared Repair all action.
Repairs preserve heat, fuel, settings, hours and reactor/turbine trip latches.
The latched meltdown has a red console pulse, bouncing
movable nonmodal dialog with reset/export, and escalating opt-in warning/siren audio; preserve mute, pause,
visibility cleanup and reduced-motion behavior. Preserve
the incident's initiating cause independently of the rolling event journal.
`nuclear-power-fuel.js` tracks uneven exposure and reserve per fuel assembly, separately
from control rods. Replacement is manual, for a selected assembly or all fuel together after the
same cooled/stopped checks; the exchange animation is visual only and preserves
heat, damage, the trip latch and stopped state; never
let automation replace fuel or component repair replenish it. Auto compensates declining
fuel capability and regulates only rods without an explicit manual override. Stop/trip
release overrides and insert every rod. `nuclear-power-supply.js` models the auxiliary
AC bus: turbine, external grid, then two armed standby diesels. Pumps must coast down
without AC; restoring power must never reset trips or restart the reactor.
The separate Auxiliary power view is removed. Two small 3D diesel cutaways behind
the turbine/generator, grid, AC bus and source-to-pump electrical routes share the
main plant renderer/camera/disposal. Actual engine/fuel/load drive pistons/fans,
tank fill, lamps and markers; preserve pause/hide/reduced-motion/maintenance stops.
Each diesel opens its own movable, nonmodal control dialog with a pump-style ON/OFF
rocker, standby, countdown, load/fuel and explicit refuelling. OFF disables standby.
The Pump power source panel is above Grid controller at left; its button and the
3D grid/bus open Electrical supply & connections. Native grid-available and
turbine-feed switches use the same rocker styling, preserving keyboard behavior.
The old top-right EXTERNAL GRID/source button is removed. Controls remain usable
in the SVG/WebGL fallback. Core/component/pool/electrical windows share dragging,
keyboard movement, viewport clamping, per-window closing and focus restoration.
The 3D Labels selector offers Off / Compact / Full, defaulting to Compact tags.
Hover/focus reveals full names and readings; the selected card stays expanded.
Off hides visual cards while keeping canvas picking and keyboard focus reveal.
Preserve expansion-aware viewport clamping, both themes/reduced motion and the
choice across view/tab switches, Reset demo and element reconnection.
All four pump dialogs use a compact SVG cutaway with adjacent local speed/flow/
pressure trends. Drag the impeller, discharge valve or trim, or select a control
for native sliders, keyboard arrows/Home/End and ±5 adjustments. No numeric
percentage entry fields remain; disturbances also use sliders. Preserve Auto
ownership/overrides, requested dashed versus actual solid indicators, native run
rockers, part damage, repair checks and shared animation cleanup. Preview drags
until release; cancel uncommitted values on cancellation or close/hide. Narrow
views stack trends and keep horizontal scrolling inside the cutaway.
The heat exchanger dialog uses an interactive SVG cutaway: drag valves, tube bundle
or deposits horizontally, or select a part for slider/keyboard/±5% adjustments.
Keep requested dashed handles separate from actual solid handles, use the shared
animation loop for heat/flow/steam, preserve cleaning interlocks and floating-window
lifecycle, and retain usable controls alongside the scrollable mobile cutaway.
The compact exchanger cutaway (up to 520 px) and local trends share left/right
columns on wide screens to avoid default-view scrolling; below 850 px they
stack. Preserve the narrower trend bounds and operator change markers.
Turbine/generator and condenser dialogs use interactive SVG cutaways beside local
trends, with draggable valves/dials, native sliders and fine adjustments; no numeric
entry fields remain, including disturbances. Keep governor 0.1 s steps, load-ramp
MW/s and cooling-inlet 0–60 °C bounds. Requested valves stay dashed, actual valves
solid. Turbine/generator rotation follows actual shaft coast-down independently of
output; electrical markers require actual generation. The native breaker rocker
always permits opening and closes only when ready; preserve explicit admission,
turbine trip/reset and cooled service checks. Condenser steam/drops follow actual
heat/flow/cooling and remain absent when cold or without flow. Cancel uncommitted
drag/slider previews on cancellation/close/hide, and preserve shared motion cleanup,
both themes, floating-window lifecycle and narrow cutaway scrolling.
Turbine normal rating is 410 MW, without a hard output clamp. The operator-owned
Generator loading dial spans 50–160% (100% default); electrical targets allow up to
650 MW while normal grid dispatch stays in its existing safe gameplay envelope.
Actual rotor load/wear/damage drive amber/red Electrical output card indications.
Normal rotation slowly accumulates service wear (~2% per full-load hour; service
due at 25%); overload accelerates wear and fatigue. Each new/serviced rotor samples
a 104–116% strength and 3–8 s exposure allowance once. Retain deterministic evolution
between those samples. Blade loss progressively derates MW to zero at destruction;
imbalance can continue damage while coasting. None of this activates reactor ESD.
The 3D/SVG/dialog cutaways lose attached blades and show bounded one-shot fragments
on the shared frame clock. Preserve pause/hide/detach/reduced-motion/idle cleanup.
Explicit cooled/stopped/fault-free turbine service additionally requires shaft
speed below 0.5%; it restores wear/blades, preserving heat, fuel, settings, hours
and trip latches. Minor wear stays readable without immediately listing maintenance.
The 3D cutaway has an RBMK-inspired tiled channel deck, rear spent-fuel pool
with initially empty racks, and an overhead fuel-handling crane. Keep stationary
caps and actual moving rods/aqua collars visible in the open-front guide
chamber beneath them. Deck, fuel and rod positions share `CORE_CHANNELS`.
Selected and batch fuel replacement each illustrate one 10.5-second crane
transfer into the pool; only the pickup cap opens. Fuel still renews immediately
through existing interlocks. Pool batches represent replacement actions, not a
full physical inventory. Click the pool or Spent fuel button for its shared
movable window. After 60 simulated seconds of cooling from placement, manually
dispatch selected/all cooled batches to long-term storage or reprocessing.
The 35 racks retain batches until dispatch; full pool blocks UI replacement.
Dispatch frees visible racks, records count/destination/history and costs zero
until later gameplay. Preserve crane pause/hide/tab/detach freezing; pool cooling
follows plant time across tabs. Reduced motion skips movement but never cooling.
Reset demo clears pool/jobs/shipments, without changing repair/trip semantics.
Middle-wheel drag or Shift+drag pans the unified 3D view; Shift+arrows also pan,
plain wheel zooms, and Home/Reset view restores center/orbit/zoom. Read
`FUEL-HANDLING-PLAN.md` before full spent-fuel inventory or gameplay work;
the latest scope update records the intentionally representative animation.
The 3D background has a gray cooling tower with two red bands, condenser
warm/cool pipes beneath the base and a separate river make-up intake. Its white
water-vapor plume rises straight up without spiraling; intensity follows actual
secondary heat/flow and condenser cooling capacity,
including retained hot circulation after Stop. Cold/no-flow/no-cooling states have
no plume. Keep the bounded instanced vapor on the shared frame clock and preserve
pause/reduced-motion/visibility/disposal, both themes, camera fitting and condenser
picking/keyboard access. This is presentation only; do not connect reactor/turbine
steam directly to the tower. See `COOLING-TOWER-PLAN.md` and use
`npm run test:browser:cooling` for focused coverage.
The feature document records the control model, verification, and future MQTT work.

