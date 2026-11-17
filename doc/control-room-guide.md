<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Control-room guide

For setup and tests, see [development and verification](development.md). For
Docker and reverse proxies, see [hosting and deployment](deployment.md). The
[documentation index](README.md) links the plant specification and feature plans.

The standalone **nuclear-power** React/Vite app for
`https://nuclear.porssiohjain.fi`. It is an English-only, fictional two-loop reactor
control room. Every plant signal and command is simulated in the desktop browser.
An optional WebSocket relay connects companion screens; account login, MQTT and
physical device commands are not implemented.

React mounts the existing `nuclear-power-console` custom element. Its shadow-root
styles, deterministic simulation modules, dialog behavior and audio
lifecycle are retained under `src/simulation/`. Each reactor page owns its simulation;
free-operation sessions are discarded on reload. Optional careers save the plant,
company inbox and achieved goals locally; Continue game preserves the saved Pause choice.
Reload ends any companion pairing session. The light/dark theme is saved locally
and shared by the simulator, landing page and guides, each with a Light theme switch.
The external Vaadin desktop and Start menu open this app in a separate tab.

## Company game: operations and maintenance

Free operation remains the default. Choose **Start game → Begin career** for a
separate cold plant with its clock running immediately. Choose **Easy** for Auto or Manual operation, or **Hard** for
Manual only; Hard blocks Auto on the desktop and paired companions. Eight
assignments cover startup, reliable operation, condition rounds, pump service,
water quality, filter service, cooling-water intake service and return to generation.
Accept work in the company inbox, satisfy actual plant criteria and report verified
results. Service is free; electricity trading, expenses and bankruptcy remain
planned in [GAMEPLAY-PLAN.md](GAMEPLAY-PLAN.md). For continuation,
read [the game-development handoff](game-development.md) for the exact current
code, save format, known gaps and next slice.

For fixed-output tests, disable Follow requests and establish actual circulation
before explicitly starting. Easy Auto can regulate 200 MW; in Manual, adjust
load/rods and pump speeds to reach actual 200 ± 5 MW. The first task requires
30 seconds and reliability requires five minutes. Auto uses continuous holds;
Manual accumulates qualifying time and pauses progress outside the requirements,
with no failure deadline. Verified success stays ready until reported. Pause
freezes all plant time. Previously issued version-1 briefs retain their pinned terms.

In **Maintenance**, condition monitoring derives vibration, bearing temperature
and lubricant readings from actual speed, stress, wear and damage. Record
inspections, then use work orders to isolate, service, release for a ten-second
actual functional test and explicitly return equipment to service. Isolation
checks actual cooldown/coast-down and blocks conflicting commands on every screen.
Water treatment adds purification, filter load, samples, intake debris, make-up
supply and basin level. Poor quality gradually fouls the exchanger; intake/basin
restrictions reduce condenser capacity. These are illustrative game systems.

The company window contains Inbox, Assignments, Achievements, Archive and Save.
Careers save to IndexedDB with one writer tab, complete plant/pool state and sampled
rotor tolerances. **Save & return to free operation** restores the parked free
plant on this page. Reload starts free operation; **Continue game** restores the
career with the user's Pause choice preserved, without offline progress. Export/import JSON backups from Save.
Schema-1 saves migrate as Easy careers; schema-1/2/3 saves upgrade to schema 4, preserving issued terms,
progress, heat, damage, trips and rotor samples. New saves also retain work orders,
inspection/sample records, water state and difficulty. Maintenance management
and sampling are desktop-owned; companions remain plant-control followers.
Reset demo remains available only in free operation. Game management is desktop
owned; companion plant commands continue through the same authoritative host.
Company inbox/mission summaries are not yet shown on companions. Descriptions of
Reset demo below refer to free operation. A melted career can be inspected/exported
and left with Save & return, then replaced through Start game; a dedicated terminal
company/debrief flow is still planned.

Mission IDs and saved objective terms support inserting new assignments in later
updates without deleting completed goals or changing an issued assignment.
Focused verification: `npm run test:browser:game`.

## 3D equipment stations

The reactor overview is also plant navigation. Select the small **server warehouse**
left of the cooling tower to open Computer systems. Selecting a pump, heat
exchanger, turbine/generator, condenser or cooling tower opens its dedicated
equipment tab. The schematic follows the same route. The Pumps station selects
each of the four independent pumps, including both backups.

Each station has a larger 3D cutaway and its own orbit/zoom/reset camera. Select
a model part or its matching button to open native controls, actual readings,
local trends, disturbances and service actions. These windows omit the previous
2D cutaway while using the existing command guards. Solid levers show actual
position; amber outlines show requested position. Pump damage/leaks, turbine
blade loss, exchanger deposits and condenser drops follow actual plant state.
Pause, reduced motion, offscreen suspension and detach preserve the shared clock.
If WebGL fails, the part buttons still provide usable controls. **Plant overview**
returns to the retained plant camera. Focused checks:
`npm run test:browser:stations` (also included in equipment and full browser checks).
See [the implementation plan](EQUIPMENT-STATIONS-PLAN.md) for the next visual work.

**Enable plant sounds** also enables distinct server-room, pump, exchanger,
turbine/generator and condenser ambience. Actual equipment speed, flow, heat and
cooling drive the sound. Only the active visible room plays; offscreen views,
mute, pause and hiding stop it. Room sounds load locally on demand. Maintenance
stays quiet. Focused sound checks: `npm run test:browser:audio`.

The yellow **Alert silence** pushbutton above ESD mutes only alerts, with a
pressed cap and amber lamp. Machinery and UI sounds continue; alarms remain
visible and unacknowledged. The header retains the clock; Pause/Reset sit at the
footer's left, with PÖRSSIOHJAIN at right.

## Computer systems

The **Computer systems** tab contains a clickable 3D server rack with two
redundant process servers, a plant instrument server, control-network switch, rack UPS and cooling tray.
Server drive, network-port and UPS activity lights blink while units are powered ON.
They freeze on Pause/offscreen and stay steady with reduced motion.
Drag or use arrow keys to orbit, wheel or +/− to zoom, and Home/Reset view to
restore the camera. The rack uses only the 3D presentation. Native unit buttons
also open the same inspection window and remain usable if 3D is unavailable.

New/reset plants have grid and turbine feed disconnected, both diesels OFF with
standby disabled, and every rack unit OFF. Connect the grid or manually start a
diesel first. Use the ON/OFF switches beside the computer cards to power rack
cooling, the network and a server, then wait five plant seconds for boot before
reactor Start in both Auto and Manual. Restoring AC never switches computers on.
Startup requires an online server and control network, plus AC and circulation.
Once running, independent Manual controls and emergency shutdown remain usable
during computing loss. Existing saves restore their
recorded power state, including partial boot; schema 3→4 adds a healthy instrument
server while preserving the five previously saved rack units.

The six main plant instruments start OFF. Switch ON the plant instrument server
and network and let them boot to restore current readings. Power loss, hardware
faults or either unit switched OFF darken the displays and hide their readings and
motion. Local inspections, Manual controls and emergency shutdown remain usable.

Inspect actual power/online state, boot countdown, temperature, operating hours,
UPS charge/battery health and cooling airflow/filter load. Run diagnostics,
transfer process duty to the spare server, or create an existing-style work order.
Switch a unit OFF before isolation/service, release it for test, switch it ON and
prove ten continuous seconds before explicitly returning it to service. Servers
can be serviced with the other server online; network work needs Manual or a
stopped reactor, UPS work needs AC bypass, and cooling service waits for fan stop.

Either online server plus the network supports normal Auto regulation. Total
computing loss holds requested rod/pump targets and suspends dispatch; it never
starts, stops, trips or resets the reactor. Independent Manual controls, essential
inspection readings and emergency shutdown remain available. Hard still prohibits Auto.
The rack UPS bridges auxiliary AC interruptions for a fictional 120 seconds at
full battery health and recharges from AC; it never powers coolant pumps. Blocked
cooling can latch hardware overheat faults, requiring explicit cooled hardware
service. All state follows plant time, including while another tab is selected;
rack drawing suspends offscreen, hidden or detached. Pause and reduced motion
freeze fan animation while camera and inspection controls remain usable.

Schema-3 career saves retain rack state, diagnostics, boot/test progress and UPS
inventory. Older saves receive healthy rack defaults without changing previous
plant state or issued goals. Rack management is desktop-owned; companions receive
read-back and obey the host's automation availability. The career remains eight
assignments; rack targets are available for optional work orders and future missions.
Focused checks: `npm run test:browser:computers`.

## Landing and console pages

`/` is the static landing page: two cards at the top open **Nuclear reactor**
(`/reactor/`) and **Companion screen** (`/companion/`), with the introduction and
control-room guides below. The landing page never mounts or loads the simulation.
Both consoles have separate HTML entries with no SEO article, guide footer or
hidden landing content. The URL keeps the selected screen on reload; browser Back
returns to the landing page. Reload starts free operation; use Continue game
to restore a saved career.
Existing `/?screen=companion` pairing links redirect to `/companion/`, retaining
any pairing code in the URL fragment.

## Desktop layout

On desktop screens at least 1400 px wide, the plant workspace fills the available
viewport height. Close either side panel with its × button or Escape; small,
translucent chevron tabs at the left/right edges reopen them. Panels slide in/out
as the process view expands, with immediate changes under reduced motion. These
controls use no extra row above the workspace. The header and
operator console stay in place; long side panels and operator controls scroll
within their columns. Panel choices are remembered in this browser. Smaller
desktop windows retain the stacked, page-scrolling layout.

## Companion screens

**Connect screen** in the header
starts sharing that existing simulation and displays an eight-digit pairing code.
Open the same site's **Companion screen** link on a tablet, another computer or
another browser window, enter the code, and press **Connect to desktop**. The
code is requested in a blocking modal with the console visible behind it. Escape
and backdrop clicks do not dismiss it; it closes only when live desktop state is
available. Invalid codes stay in the dialog for retry. Connection loss,
disconnection or revoked access brings it back, and successful reconnect closes
it automatically. The companion omits the logo and page title to save space;
regulation/display settings and a compact connection status remain above the panes.
The pairing window also provides a link with the code already filled in for testing
on one computer. Codes expire after ten minutes; **New code** rotates the code
without disconnecting devices already paired. **Disconnect screens** revokes all
device credentials and rotates the code; **Stop sharing** ends the room.

The companion uses `/companion/`. On a landscape tablet it has information
on the left and the operator console on the right. The information selector offers
**Grid & readings**, **Core map**, and **Trends & alarms**. The right side retains
Start/Stop, load/rod adjustments, all four pump switches and speed targets, and
the covered emergency shutdown. Auto/Manual regulation and requested versus actual
readings retain the desktop rules. Equipment, diesel and supply windows are
available from their existing buttons. In **Core map**, select an amber fuel
assembly and press **Replace selected fuel**, or use **Replace all fuel**.
The desktop applies the same shutdown/cooldown and pool-capacity checks, renews
the fuel and runs its crane-to-pool animation. Fuel readings and confirmation
return to the companion; selection on each screen remains independent. Pool
dispatch, bulk maintenance, scenario injection and Reset demo stay on the desktop.
Narrow screens stack the operator controls above the information pane. Themes and panel selection are
local to each screen. Information and operator panels grow to their natural
content height. The document scrolls to reach the lower controls; there are no
separate scrolling columns or empty landing-page space below the console.

**Screen layout** selects **All controls**, **Pumps & load**, **Core & fuel**, or
**Monitor**. **Customize this screen** lets each browser choose its regulation,
run/shutdown, load, rod, pump, grid, instrument, electrical, core, trend and event
sections. A core-only screen uses the full width; a pump station has larger touch
controls and puts the two circuits side by side when space permits. Layout and
information selection survive reload in this browser, independently of desktop
panel choices. They issue no plant commands and do not change pairing or save
ownership. Company inbox, assignments, achievements and marking mail as read
remain desktop-only; there is no companion company summary yet.



The **desktop remains the only simulation host**. The relay owns pairing,
per-device credentials, room isolation, bounded messages, acknowledgements and
reconnection; it never calculates plant physics or stores a saved game. Companion
screens receive full state twice a second and after committed desktop commands,
and never advance their own plant clock. No command is queued or retried offline.
A stale or lost connection locks companion controls and stops their motion/audio;
short transport interruptions reconnect to the same room using in-memory device
credentials. Reloaded companions need pairing again. A disconnected desktop can
resume its room within 30 seconds. Closing/reloading ends pairing and discards
free operation; a saved career can still be resumed through Continue game.
Restarting the relay loses all rooms and requires pairing again.

A visible paired companion keeps the desktop plant clock active even when the
desktop tab is hidden or scrolled away. Local animations/audio still suspend when
hidden. With no visible companions, the original desktop visibility rules apply.
Browser/OS suspension can still freeze the desktop host: stale companion readings
then lock controls rather than pretending the plant is live. Pause is shared;
panel changes, theme, sound opt-in and emergency-cover position remain local.
Desktop Reset demo closes the companion's cover and restores cold read-backs.

Focused verification:

```sh
node --test test/nuclear-power-session.test.mjs
npm run build
npm run test:browser:companion
```

The browser check uses two real browser targets and the real relay. It covers
pairing, one-clock behavior, desktop/tablet command synchronization, grid/core
information, pump/rod ownership, emergency shutdown, stale controls, reconnect,
reset, revocation, tablet/phone layout and both themes.

For relay setup and reverse-proxy configuration, see [hosting and deployment](deployment.md#companion-console-and-docker-session-backend).

## Reactor overview and equipment controls

The reactor overview opens as a low-poly Three.js cutaway. Drag to orbit within
bounded angles. Hold the mouse wheel and drag to shift the center, or use
Shift+drag. Scroll or use +/− to zoom. **Reset view** restores the initial center,
rotation and zoom. Arrow keys orbit, Shift+arrow keys pan, +/− zoom and Home resets
the focused canvas. Panning is bounded. Equipment labels fade until hovered,
keyboard-focused or showing an open dialog, keeping the plant visible behind them.
Select equipment directly or use its labeled button to open the existing component
console. Rods, pump impellers, turbine, flow, fuel heat and melting follow the same
simulation as the instruments. The taller viewport supports both themes and
reduced motion. **Schematic** switches to the retained SVG overview without
changing plant state; browsers without WebGL 2 fall back to it automatically.

A gray cooling tower with two red bands stands behind the condenser, sized against
the spent-fuel pool. Warm/cool water pipes descend through the equipment plate and
run along its outer edge to the tower. A small river intake supplies make-up water
to its basin, separate from the reactor and turbine steam loops. The white plume
represents condensed water vapor rising straight up. Actual secondary heat,
circulation and condenser cooling capacity control its density and height.
Cold/no-flow/unavailable-cooling states have no plume; retained hot circulation
can keep it visible after Stop.
Tower surfaces and its keyboard-accessible CT-01 label open the condenser controls.
Its bounded instanced vapor shares pause, reduced motion, visibility and GPU cleanup
with the main scene. See [the cooling tower checkpoint](COOLING-TOWER-PLAN.md).

For focused checks, run the cooling, rendering and loop unit tests listed in the
checkpoint, followed by `npm run build` and `npm run test:browser:cooling`.
The equipment browser suite also includes these tower scenarios.

Plant calculations and instrument refreshes run every 250 ms. Presentation uses
one visibility-aware animation loop capped at 30 fps, which stops when there is
no visible motion. A static cold 3D scene redraws only when its displayed state,
camera or size changes; plant time and controls remain active. Hidden diagrams,
closed component/core/pool windows and inactive maintenance content defer their
expensive updates until shown, including immediate refresh when opened during
pause. Live readings reuse number formatters and avoid cloning component histories.
Software WebGL can still cost substantially more CPU than hardware acceleration.

### Fuel handling

The reactor has a flat, RBMK-inspired tiled channel deck, a blue spent-fuel pool
behind it with storage racks, and an overhead fuel-handling crane.
The top caps, internal fuel assemblies and control rods share the core map's
channel coordinates. Aqua collars make actual rod movement visible inside the
open-front upper guide chamber; rods stay beneath the deck. Small sliders on green
control-channel caps also show actual insertion from above; the caps themselves
stay stationary during regulation. **Replace selected fuel** and **Replace all
fuel** now trigger one approximately ten-second illustrative crane transfer:
align, lower the grabber, lift one assembly clear of the deck, carry it to the
pool, lower/release it and return to park. A batch replacement shows one assembly
to keep the sequence short. Move or close the floating core map to watch the
process underneath. The selected channel cap opens only during pickup.

Fuel renewal remains immediate and uses the existing cooled/stopped checks; the
animation never changes heat, damage, trips or operating settings. Displayed
pool assemblies represent replacement batches, not a complete physical spent-fuel
inventory. The 35 racks retain their batches until manual dispatch; a full pool
blocks further UI replacement until space is freed. Repeating replacement
restarts a single illustration; starting the reactor cancels an unfinished
illustration. Pause, hidden views, tab/view switches and detach freeze movement;
returning resumes its current position. Reduced motion places the sample
immediately. Reset demo clears the crane and displayed pool samples. The existing
core-map exchange animation and WebGL fallback remain available.

Click the **spent-fuel pool** or **Spent fuel ↗** to open its movable, nonmodal
window, available from the schematic/WebGL fallback too. Each stored batch shows
its source, assembly count and a 60-second demo cooling countdown. Cooling starts
on placement and follows simulated plant time, including while another tab is
selected; pause/hide/detach freeze that clock. Select a cooled batch and dispatch
it to **Long-term storage** or **Reprocessing**, or dispatch all cooled batches.
Dispatch frees the racks, removes their 3D fuel and records the destination/count
in the event journal and a bounded recent-dispatch list. Dispatch is free in this
demo; fee handling is reserved for later gameplay. No measured pool temperature
or real fuel-handling procedure is modeled.

See [the fuel-handling work plan](FUEL-HANDLING-PLAN.md) for the user's references,
the implementation checkpoint, and staged tasks for transfers, inventory and
gameplay, including continuation guidance for another instance.

### Equipment and operator controls

The **Heat exchanger** console has a compact interactive cutaway with local trends
on its right on wide screens, fitting the default window without vertical scrolling.
The trend and controls stack on narrow screens. Drag the primary bypass,
secondary valve, tube bundle or deposits left/right, then release to apply a setting.
Select a part for a native slider and ±5% buttons; focused model parts support arrow
keys (1%, or 10% with Shift) and Home/End. No numeric entry is needed. Dashed valve
handles show requests, solid handles show actual positions. Fluid colors, flow,
secondary steam, heat arrows and deposits follow simulated read-back through the
shared animation loop, including pause/reduced-motion behavior. Cleaning still
requires a cooled, stopped, fault-free plant. Local trends, faults and maintenance
remain in the same movable window. On narrow screens the cutaway scrolls sideways
while the part selector and adjustment slider fit the window.

The header card beside the title contains regulation targets, the opt-in plant
sound switch, theme, simulation status and clock. UI clicks use 100% of the bounded
sample-volume range (0.26 gain); the volume slider and test button are removed.

The **Turbine & generator** and **Condenser** windows also use interactive cutaways
beside local trends. Drag the steam/cooling valve or a regulator dial, or select a
control for its native slider and fine-adjust buttons. Governor response retains
0.1-second steps, load ramp uses MW/s, and cooling inlet temperature spans 0–60 °C.
Arrow keys adjust one step (ten with Shift); Home/End choose bounds. Drags preview
until release; cancellation, closing and hiding discard uncommitted changes.
All tuning and disturbance fields use sliders with readouts, with no numeric entry.
Dashed valve requests stay separate from solid actual positions. Turbine and
generator rotors follow actual shaft coast-down; electrical markers appear only
with actual output. The native breaker rocker retains explicit readiness checks,
and turbine trip/reset/admission controls preserve the existing interlocks.
Condenser water, steam and falling condensate follow actual flow, heat and cooling.
Both windows share pause, reduced-motion, hide/detach cleanup, movable positioning
and both themes. Narrow screens stack trends and scroll only the illustration
horizontally; the adjustment controls fit the window.

The 3D toolbar's **Labels** selector defaults to **Compact** equipment tags. Hover
or keyboard focus reveals the name and live readings; the selected equipment's
card stays expanded. **Full** shows every card. **Off** hides the cards while
keeping canvas picking and keyboard access available: a focused equipment control
still reveals its card. Expansion stays clamped inside the view in both themes.
The choice survives view/tab switches, Reset demo and element reconnection.

All four pump dialogs use a compact interactive cutaway beside speed, flow and
pressure trends. Drag the impeller, discharge valve or trim knob, or choose a
control and use its native slider and ±5 buttons. Arrows adjust one unit, Shift
arrows ten; Home/End choose the control's bounds. A drag previews its request and
commits on release; cancellation, closing or hiding the dialog discards the preview.
Requested speed/valves are dashed amber; actual motor/valve read-back stays solid.
The rocker keeps requested enable separate from actual rotation/coast-down.
Auto ownership, manual override, internal damage and cooled repair rules remain
in force. Disturbances also use sliders; there are no numeric percentage entry
fields in the pump dialogs. Details/history are collapsed, and narrow screens
stack the trends below the cutaway with scrolling confined to the illustration.

The operator console uses recessed metal plates, round Start/Stop pushbuttons and
pilot lights. Green means the reactor or pump motor is actually running; amber
marks a stopped reactor or a ready trip reset. Pump stress/damage has amber/red
indication. Labels distinguish readiness, interlocks and actual operation, including
when a command is disabled. Emergency shutdown has a transparent hinged plastic
cover: first select **Lift cover**, then press the exposed red mushroom button.
The native cover toggle precedes the button in keyboard order; Enter/Space opens
the cover and Tab reaches the button. **Close cover** blocks access again without
changing the plant. New sessions and **Reset demo** close the cover. Automatic
trips work with either cover position, and pause/reduced motion skip the lid animation.
The trip lamp and button stay visible through the lid: the button stays depressed
and reads **TRIP LATCHED** for any latched reactor
trip, and releases only after a successful **Reset trip**. After ESD, the core-map insertion slider permits manual withdrawal and renewed
core heat while the latch stays engaged and Auto stays suspended. Stop or another
ESD command reinserts the rods. Repeated presses cannot
reset it; clearing the latch leaves the reactor stopped. The controls retain their
existing interlocks, keyboard access and both themes. These are simulated controls.
The button faces have restrained illumination: green Start during running, red Stop
while stopped, and a soft emergency locator glow that becomes bright red when
latched. These are steady lights, including with reduced motion. Pump cards use
recessed **ON/OFF rocker switches**, preserving circuit, speed and flow readings.
Rocker position shows the requested enable state; the separate status and lamp
still show actual motor operation, including coast-down after switching OFF.
The load setpoint uses a metal regulator plate, a grooved slider handle, an
engraved 0–100% rail, an amber percentage display and fine-adjust buttons. Its
AUTO/MANUAL/TRIP LOCK label identifies control ownership. Native slider input,
keyboard adjustment and automatic/trip interlocks are preserved.
All four pump speed targets share the same regulator rail, grooved handle, engraved
scale and illuminated percentage display. Manual overrides, automatic ownership
and actual speed/flow read-backs remain separate from these requested targets.

### Parallel pumps and pipework

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
heat, transfer/cooling, shaft/breaker state and retained turbine blade condition.
410 MW is the normal gross rating, rather than a hard output cap.

### Turbine loading, wear and service

The turbine's **Generator loading** dial spans 50–160% (100% is normal). It can
overdrive the fictional machine beyond 410 MW when heat and circulation allow;
the header accepts electrical targets up to 650 MW. Auto never changes this dial,
and the grid controller stays within its normal capacity. Watch the left electrical
card: amber begins near 90% rated rotor load, red at 110% or substantial blade
damage. Text identifies overload, blade damage and maintenance due in both themes.

Normal rotation slowly accumulates service wear (about 2% per full-load hour),
with scheduled maintenance due at 25%. Overload accelerates wear sharply. Each
freshly serviced rotor has a sampled strength and exposure allowance, so fracture
does not always start at the same load or time. Sustained overload breaks blades;
the remaining spinning rotor can deteriorate further from imbalance. Blade loss
progressively reduces available MW, down to zero after destruction. Missing blades
and falling fragments appear in the 3D view, schematic and interactive cutaway,
sharing the visibility-aware frame loop and pause/reduced-motion behavior. Fragments
fall once and remain until service; their pool is bounded to forty blades.

Unloading and stopping preserve wear and damage. The turbine console's **Service
turbine** action and Maintenance **Repair all** restore the rotor only after the
existing cooled/stopped/fault-free checks and shaft coast-down. Service preserves
fuel, retained heat, targets, operating hours and reactor/turbine trip latches.
Neither overload nor destruction presses reactor emergency shutdown.

### Flow warnings and repair

Primary and secondary flow each have a left-side instrument showing actual delivered
flow, actual pressure and the healthy-pipe damage limit (about **5,780 m³/h**, derived
from **145% nominal ΔP**). Each card turns amber from **125% ΔP**, then red above
145% or while pipe damage remains. Text identifies near-limit, overpressure and
retained damage states. Pressure drives the warning even if a leak lowers delivered
flow below the displayed healthy-pipe limit. Alarm acknowledgement cannot hide it.

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

### Plant sounds

Control sounds use the bundled Kenney UI Audio and Interface Sounds packs. Pumps
retain the original clicks; computers, electrical switching, heat-exchanger
controls, turbine/generator controls, condenser controls and rods use distinct
sampled feedback. Computer cards and their inspection window share physical
ON/OFF rockers with computer-specific clicks; requested power remains separate
from actual boot/online status.

In Career, newly satisfied checklist steps play a short confirmation, and verified
assignments play a longer confirmation when ready to report. Simultaneous steps
produce one cue; repeated updates and conditions returning to green do not repeat
it. Continue/import prime existing progress silently. All cues share Enable/Mute
plant sounds and stop on pause, hiding, detach or session changes. Missed or late
loaded cues never replay; no audio history is added to career saves.

**Enable plant sounds** also enables seamless steam/turbine/generator loops.
Actual reactor output and turbine shaft speed drive the sound level; stress,
damage, overheating, trips and actual component disturbances crossfade to a rough
fault texture independently of alarm acknowledgement. The cold plant is silent,
and a stopped turbine fades with its actual coast-down. Mute, pause, hidden views
and detach stop all voices. The original synthesized WAVs and generation notes
are in `public/audio/nuclear-power/plant-state/`; they load only after sound opt-in.

Machinery audio follows the selected tab: **Reactor overview** mixes reactor
operating loops/Start/Stop cues and independent diesel startup, seamless running
and shutdown sounds. **Maintenance** silences all machinery immediately; alarms
and UI clicks remain shared. Diesel sounds follow actual startup/running/stopped/
empty state, including automatic starts and fuel exhaustion; volume follows bus
load. Returning to the plant resumes current operation without replaying past events.
Original diesel WAVs and regeneration notes are in `public/audio/nuclear-power/diesel/`.

### Electrical supply and maintenance

The main panel has **Reactor overview** and **Maintenance** tabs. Small diesel
cutaways sit behind the turbine/generator in the main 3D plant, with the external
grid, AC bus and source-to-pump electrical routes. Pistons/shaft/fans follow actual
engine state; tank fill shows fuel, and lit terminals/moving wire markers show
actual bus load. Clicking either diesel opens its own movable dialog, with a
pump-style ON/OFF rocker, automatic standby, startup countdown, fuel/load and
manual refuelling. OFF disables standby as before. The two dialogs can coexist.

The **Electrical grid** tab sits immediately after Maintenance. Its independent
3D cutaway shows the grid transformer/switchgear, turbine feed, AC bus, two diesels
and outgoing pump circuits. The Pump power source arrow and overview grid/bus
navigate here. Native grid/feed rockers allow quick switching; select 3D equipment
or a part button to open the existing connections or diesel controls. Source,
load, fuel and electrical markers follow actual state. Direct inspection and
companion screens retain their electrical windows. The 3D station builds on first
visit, draws only while visible, shares the console frame clock and disposes on
detach. Pause/reduced motion freeze motion; WebGL failure retains native controls.
Actual diesel sounds play only while the electrical viewport is visible. See
[ELECTRICAL-GRID-PLAN.md](ELECTRICAL-GRID-PLAN.md) and run
`npm run test:browser:grid` for focused coverage.

The **Maintenance** tab shows a live count and list of components with retained
damage, wear or exchanger fouling, including affected core channels. **Inspect**
opens the existing component/core console. **Repair all** uses the existing
stopped, fault-free cooldown conditions, displayed with current temperatures.
**Clear active faults** stops injected deterioration without healing damage.
Repairs preserve heat, fuel reserves, settings and trip latches; meltdown still
requires Reset demo. The healthy list clears as repairs complete.
The reactor's **Inspect** core map also lists every damaged local zone with its
damage percentage and fuel temperature. Select an entry to show that rod's local
readings on the map. All retained damage, including below 1%, has a red border.
The dialog includes **Repair all damage** and current blocking reasons; repairing
clears these entries without renewing fuel or clearing a trip.

### Process animation

Steam rises through the exchanger's secondary-side cutaway and turns into its
outlet in both 3D and schematic views. Its density and speed follow secondary
temperature and circulation, with no steam during cold circulation or zero flow.
The vessel has moving reaction particles and individual fuel pulses driven by
actual running power, fuel capability and rod insertion. Higher reaction activity
visibly increases particle travel and pulse speed; each rod's local activity has
its own continuous phase, so withdrawn rods animate faster than inserted ones.
Requested settings and turbine/electrical speed do not drive these effects.
Stop/trip removes reaction activity while
retained fuel heat keeps its separate glow. These visuals share pause, visibility,
reduced-motion and renderer cleanup with the rest of the scene.

### Grid controller and regulation

The **Grid controller** card below the instruments can **Follow requests** in
Auto → Electrical output. Following is selected in new sessions and after Reset
demo. The simulated feed sends its first raise/lower MW request after 45 active
seconds, then every 60 active seconds.
**Request now** delivers one immediately. Each message coordinates the electrical
target, circulation target and operating core limit. Requests stay within normal
available capacity (up to about 300 MW healthy), derated for equipment restrictions,
fuel and manual pump/rod overrides. The card shows available capacity, planned
operating targets, actual output, countdown and limiting reason. Actual output
continues through the existing regulator and protections. Dispatch waits during
Stop, trips, pause, Manual or temperature regulation and unavailable circulation/
generation; it never starts the plant or closes a breaker. Disabling retains all
current targets. Reset demo clears messages and restores following. Manual temperature entry has
no 330 °C cap. Emergency shutdown is operator-only in both Auto and Manual:
high output/core/circulation targets, low flow and fuel hot spots never press or
latch the emergency button. Auto still limits output against cooling, fuel and
the configured core ceiling. Alarms, accumulated damage and retained heat remain
active. Irreversible meltdown ends generation through its own failure state,
without activating the emergency button; Reset demo is still required afterward.

### Temperatures and instruments

Both coolant loops use the same absolute temperature colors, including return
pipes and bypass. Core inlet/outlet and secondary return temperatures are displayed.
Full exchanger bypass removes the primary cooling drop instead of retaining a
nominal cold return; condenser cooling controls the secondary return temperature.
Valve handles follow actual opening and the pipe axis: parallel when fully open,
perpendicular when closed. All pipe sections in a circuit share distance-based
marker travel, so longer return pipes no longer appear to flow faster than steam.

Thermal output, electrical output and primary flow instruments have small animated
heat, generator and coolant illustrations, plus traveling meter highlights. Their
speed/intensity follows actual output/flow. They stay still at zero and share the
pause, visibility and reduced-motion behavior of the main scene.
