<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Nuclear Power

The standalone **nuclear-power** React/Vite app for
`https://nuclear.porssiohjain.fi`. It is an English-only, fictional two-loop reactor
control room. Every plant signal and command is simulated in the desktop browser.
An optional WebSocket relay connects companion screens; account login, MQTT and
physical device commands are not implemented.

React mounts the existing `nuclear-power-console` custom element. Its shadow-root
styles, deterministic simulation modules, dialog behavior and audio
lifecycle are retained under `src/simulation/`. Each reactor page owns its simulation;
free-operation sessions are discarded on reload. Optional careers save the plant,
company inbox and achieved goals locally; Continue game restores a paused career.
Reload ends any companion pairing session. The light/dark theme is also saved
locally. The external Vaadin desktop and Start menu open this app in a separate tab.

## Company game: commissioning chapter

Free operation remains the default. Choose **Start game → Begin career** for a
separate cold plant and assignments from the plant manager. The first chapter
contains **First shift** and **Prove reliable operation**. Accept assignments in
the company inbox, verify the actual plant criteria, and send reports to record
achievements and the assignment archive. These two commissioning assignments do
not charge money; electricity trading, expenses, bankruptcy and further missions
remain the next stages in [GAMEPLAY-PLAN.md](GAMEPLAY-PLAN.md).

For the fixed-output tests, disable Follow requests and use Auto → Electrical
output at 200 MW, then establish circulation and explicitly Start. The first task
requires a 30-second stable hold; the next requires five uninterrupted simulated
minutes. Stop, faults, damage or leaving the operating envelope reset the hold;
Pause freezes it. Reporting never starts or repairs equipment.

The company window contains Inbox, Assignments, Achievements, Archive and Save.
Careers save to IndexedDB with one writer tab, complete plant/pool state and sampled
rotor tolerances. **Save & return to free operation** restores the parked free
plant on this page. Reload starts free operation; **Continue game** restores the
career paused, without offline progress. Export/import JSON backups from Save.
Reset demo remains available only in free operation. Game management is desktop
owned; companion plant commands continue through the same authoritative host.

Mission IDs and saved objective terms support inserting new assignments in later
updates without deleting completed goals or changing an issued assignment.
Focused verification: `npm run test:browser:game`.

## Repository and branches

This project lives independently at <https://github.com/norkator/nuclear>. Work
on `main`; merge approved releases to `production`. The container workflow tests
both branches and pull requests, and publishes images only from `production`
(including manual runs on that branch). No Java/Spring checkout is required.

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

## Companion console and Docker session backend

The normal desktop retains its full layout. **Connect screen** in the header
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

After the production workflow publishes both images, run these commands from
the repository root on the Ubuntu Docker host to install or update both containers:

```sh
docker compose pull
docker compose up -d --no-build
```

For a local source build instead, use `docker compose up -d --build`.

Open `http://SERVER_ADDRESS:8080` on both devices. Set `NUCLEAR_PORT=8085` (or another
free port) before the command to change the published port. The frontend remains
Nginx; the small Node 22 relay runs as a separate, non-root `session-server`
container. Only Nginx is published. It proxies `/session` with WebSocket upgrades
to the relay's internal port 8081. No database, Spring service or account is needed.
The existing static-only frontend container can still run without the optional
relay; its local simulation works normally and screen pairing reports unavailable.
Compose references the published frontend and backend images while retaining
their local build definitions. The production workflow publishes both for
`linux/amd64` and `linux/arm64`:

```text
ghcr.io/norkator/nuclear:latest
ghcr.io/norkator/nuclear-backend:latest
```

Before the first image-only deployment, let the production workflow complete.
For each GHCR package, allow public pulls in its GitHub package settings, or log
the server into GHCR using credentials with package read access.

If HTTPS terminates at another reverse proxy, forward the full site to port 8080,
and enable WebSocket upgrades for `/session`. The client automatically uses
`wss://` on HTTPS pages. The relay accepts browser origins matching the forwarded
`Host`. If the proxy changes that header, explicitly allow the public origin as
described below. No wildcard or cross-origin access is enabled by default.

For **Nginx Proxy Manager**, first create `.env` with your public origin
(scheme and hostname, no path or trailing slash):

```dotenv
NUCLEAR_PORT=8080
NUCLEAR_ALLOWED_ORIGINS=https://nuclear.porssiohjain.fi
```

Replace the hostname if needed, then run `docker compose pull` followed by
`docker compose up -d --no-build` from the repository root. Compose passes
`NUCLEAR_ALLOWED_ORIGINS` to the relay as
`ALLOWED_ORIGINS`. Multiple exact origins may be comma-separated without spaces;
include the public port when using a nonstandard port. This handles NPM versions
that forward their upstream hostname in `Host`, avoiding WebSocket 403 errors.
See [NPM's proxy configuration](https://github.com/NginxProxyManager/nginx-proxy-manager/blob/v2.17.0/docker/rootfs/etc/nginx/conf.d/include/proxy.conf).

Add a Proxy Host for your public Nuclear hostname:
use scheme **http**, the Ubuntu Docker host's reachable LAN IP and forward port
**8080** (or `NUCLEAR_PORT`), and enable **Websockets Support**. Select/request the
hostname's certificate in SSL and enable **Force SSL**. Leave Advanced and Custom
Locations empty for this setup: the frontend already routes `/session` to the
backend. Browsers use the same public HTTPS hostname for the page and WebSocket.
When NPM runs in Docker, `127.0.0.1` refers to NPM's own container.
Alternatively, attach only the frontend to NPM's shared Docker network as well as
its existing default network, and forward to its unique network alias on port 80;
the backend stays on the app's default network with internal port 8081. NPM's
[Docker network guide](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network)
explains this container-name routing option. No separate backend domain or public
backend port is needed.

Local development uses two terminals:

```sh
npm ci
npm run start:sessions
```

```sh
npm run dev
```

Vite proxies `/session` to `127.0.0.1:8081`. Open `http://localhost:5174/reactor/` and
`http://localhost:5174/companion/` in two windows, or use the computer's LAN
address on a tablet. Use the same hostname/port on both screens.

The **desktop remains the only simulation host**. The relay owns pairing,
per-device credentials, room isolation, bounded messages, acknowledgements and
reconnection; it never calculates plant physics or stores a saved game. Companion
screens receive full state twice a second and after committed desktop commands,
and never advance their own plant clock. No command is queued or retried offline.
A stale or lost connection locks companion controls and stops their motion/audio;
short transport interruptions reconnect to the same room using in-memory device
credentials. Reloaded companions need pairing again. A disconnected desktop can
resume its room within 30 seconds; closing/reloading the desktop ends the run.
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
trip, and releases only after a successful **Reset trip**. Repeated presses cannot
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

The main panel has **Reactor overview** and **Maintenance** tabs. Small diesel
cutaways sit behind the turbine/generator in the main 3D plant, with the external
grid, AC bus and source-to-pump electrical routes. Pistons/shaft/fans follow actual
engine state; tank fill shows fuel, and lit terminals/moving wire markers show
actual bus load. Clicking either diesel opens its own movable dialog, with a
pump-style ON/OFF rocker, automatic standby, startup countdown, fuel/load and
manual refuelling. OFF disables standby as before. The two dialogs can coexist.

The **Pump power source** panel sits above Grid controller on the left, with source,
requested/available load and buttons to open each diesel. Its ↗ button (or the 3D
grid/bus) opens **Electrical supply & connections**, retaining the 2D route and
native grid/feed switches styled as the same ON/OFF rockers. Their keyboard and
requested/actual behavior remain. There is no Auxiliary power tab or header grid
button. Sidebar controls remain available in the schematic/WebGL fallback.
Maintenance suspends rendering; all dialogs retain the shared movement, clamping,
closing/focus and detach cleanup. No power/supply model behavior has changed.

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

## Development and verification

Use Node 22.12+ (or Node 24) and npm, independently of the Java/Gradle application:

```sh
cd nuclear
npm ci
npm run dev
```

Open `http://localhost:5174`. For production checks:

```sh
npm test
npm run build
npm run test:browser
npm run preview
```

For routine equipment changes, use `npm test`, `npm run build`, then
`npm run test:browser:equipment`. This focused browser run checks the turbine,
condenser, controls, wear/damage, themes and motion without replaying the complete
control-room, audio, fuel, SEO and export scenarios. Reserve `npm run test:browser`
for broad regressions and CI.

`npm test` runs the model, motion, failure, fuel, supply, component and audio tests.
The browser regression serves `dist/` on a temporary loopback port and tests the
actual React production build, including responsive layouts, themes, dialogs,
controls, exports, animations and cleanup, including 3D picking, zoom, view switching,
WebGL fallback and renderer disposal/reconnection. It uses Chrome's software WebGL
renderer for deterministic headless coverage. It requires Chrome at
`/opt/google/chrome/chrome`, or an installed Chromium selected with `CHROME_BIN`.
CI uses that executable directly. Startup allows 60 seconds and reads the profile's
`DevToolsActivePort` file as well as stdout/stderr, with early-exit diagnostics.
Set `NUCLEAR_POWER_APP_URL=http://127.0.0.1:8080` to test a running app/container.
Screenshot and export artifacts are written to the temporary directory printed by
the test. Tests do not need the Spring application.

## Container and deployment

From the repository root:

```sh
docker build -t nuclear .
docker run --rm -p 127.0.0.1:8080:80 nuclear
```

The runtime is Nginx on port 80 serving static files, including bundled CC0 Kenney
UI Audio under `public/audio/nuclear-power/kenney-ui/` with its license/source record.
It needs no environment variables, API proxy, database, or Java runtime.

`.github/workflows/nuclear-container.yml` runs the unit tests, production build,
Chrome regression and companion pairing checks for pull requests. Relevant pushes
to `production` and manual runs on that branch publish both `linux/amd64` and
`linux/arm64` images:

```text
ghcr.io/norkator/nuclear:latest
ghcr.io/norkator/nuclear-backend:latest
```

Use the [companion Compose setup](#companion-console-and-docker-session-backend)
to deploy both images and point your HTTPS reverse proxy at its frontend port
8080. The standalone frontend image remains usable on its own. DNS, TLS, and the
running deployment are configured separately; the workflow builds and publishes
images. The desktop link opens `https://nuclear.porssiohjain.fi`.

See [the feature specification](doc/nuclear-power.md) for the simulation rules,
interlocks and future physical-model work. The repository's [license](LICENSE)
also applies to this app; bundled third-party audio retains its CC0 license.

## Search visibility

The production build includes static introductory content, three linked control-room
guides, canonical and social metadata, structured app data, a sharing screenshot,
`/robots.txt` and `/sitemap.xml`. The guides work without JavaScript and do not mount
the simulator. The landing page shows the two screen-selection cards above the introduction.
Only `/reactor/` and `/companion/` mount React and the retained custom element;
their HTML contains no landing or guide article. See [SEO.md](SEO.md) for content maintenance, verification and the
Search Console steps after deployment.
