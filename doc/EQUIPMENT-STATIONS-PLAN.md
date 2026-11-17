<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# 3D equipment stations

## Intended result

Make the reactor overview a navigable plant. A small server building to the
left of the cooling tower opens Computer systems. Selecting a pump, heat
exchanger, turbine/generator or condenser opens a dedicated tab containing a
larger interactive 3D cutaway of that equipment. Selecting its parts provides
the existing guarded process controls, readings, trends and maintenance actions.
The computer rack remains the reference for 3D inspection and floating windows.

## Implementation steps

1. **Inspect the existing presentation and lifecycle.** Map overview picking,
   tab navigation, floating windows, actual-state animation and browser checks.
   Keep the authoritative simulation, save schema and companion controls intact.
2. **Add the server building.** Place a small open-front server warehouse left
   of the cooling tower, with visible racks and actual rack-status lighting.
   Make canvas picking and an accessible equipment button open Computer systems.
3. **Add equipment station navigation.** Add Pumps, Heat exchanger,
   Turbine / generator and Condenser tabs, retaining Reactor overview,
   Maintenance and Computer systems. Pump selection identifies one of the four
   independent pumps. Both the 3D overview and schematic use the same routing.
   Preserve arrow/Home/End tab navigation, focus and the overview camera.
4. **Build dedicated 3D cutaways.** Use shared equipment geometry where practical.
   Expose pump impeller/motor/valve, exchanger tubes/bypass/secondary valve,
   turbine rotor/generator/admission and condenser tubes/cooling valve.
   Give stations their own orbit/zoom/reset camera. Provide semantic part buttons
   and usable native controls when WebGL is unavailable.
5. **Connect inspection and control.** Part selection opens the existing
   component control window, selecting the relevant control where possible.
   Keep native sliders, rocker switches, Auto ownership, command validation,
   disturbances, service interlocks, actual readings and local trends. Overview
   selection navigates first, rather than opening the old 2D window immediately.
6. **Animate actual equipment state.** Use the single console frame clock for
   actual motor/shaft speed, valves, heat/flow and retained damage. No station may
   tick the plant or introduce new random failures. Pause, reduced motion,
   offscreen/hidden tabs and detach stop motion; reconnect disposes/rebuilds GPU
   resources. Future richer issue animations can extend these station models.
7. **Verify the changed journeys.** Update shared browser helpers for intentional
   overview-to-station navigation. Cover the server building, every station,
   pump identity, keyboard and pointer inspection, controls, camera isolation,
   fallback, pause/visibility/reconnect, narrow layouts and both themes. Inspect
   screenshots and geometry diagnostics for failures.
8. **Update the handoff and run final gates.** Document current behavior and
   remaining extensions. Run focused model/rendering checks, build, layout,
   computers and equipment checks; run the full browser suite once against the
   final built source, and companion checks if shared controls are affected.
   Do not push or deploy.

## Boundaries

This changes presentation and navigation. Existing plant behavior, eight career
assignments, saves and companion ownership remain authoritative. New issue
mechanics, an economy and additional missions are later work. SVG overview and
native controls remain available for accessibility and graphics failure.

Rendering is allowed only for the active tab's intersecting viewport while the
console is connected and visible and the page is foregrounded. Hidden stations
retain their camera/resources without drawing; detach disposes them. Stations
must never own a separate animation loop. Inactive-tab/offscreen checks assert
that renderer frame counts stop, rather than only inspecting visibility flags.

## Progress

- Steps 1–6 implemented: warehouse navigation; four dedicated station tabs;
  independent pump selection; shared 3D cutaways; part inspection/native controls;
  actual-state motion, retained damage and WebGL fallback.
- Step 7 implemented: shared station browser coverage and three geometry/actual-
  state adapter tests. Existing overview, cooling-tower and keyboard tab checks
  follow the intentional new navigation. Maintenance inspection stays direct.
- Step 8: build and 166 unit tests pass, as do focused layout and computer checks.
  The full browser run completed every assertion and printed its verification
  message (881.7 seconds); Node marked it cancelled under its former 600-second
  outer limit. The expanded suite now allows 1,200 seconds. This is not recorded
  as a green full-suite command. The focused companion check also passes
  (106.4 seconds), including pairing, controls and retained lifecycle.
- The unchanged checkout reproduced the same headless resize-settling failure.
  Layout readiness now samples actual browser frames and always compares a pair,
  with a bounded 30-second readiness deadline for software-WebGL reallocations.
  It returns immediately when settled; animations and overlap/fit assertions
  remain enabled. No larger fixed sleeps were added.

## Later visual extensions

- Enrich each station's machinery detail and part labels as gameplay expands.
- Add more symptom animations driven by existing actual condition and future
  authored faults; do not invent failures inside rendering code.
- Keep the current station-to-native-control path as the accessible fallback if
  direct 3D dragging is added later.

## Station ambience follow-up

Implemented five original seamless loops for server fans/PSU, pump motor/water,
exchanger circulation/steam, turbine/generator and condenser water. They reuse
Enable/Mute plant sounds and actual read-back, load only for the opted-in visible
active room, and keep one bounded source/filter/gain chain. Actual speed adjusts
pitch/intensity; flow, heat and cooling shape the texture. Offscreen views and
pause/mute/hide/detach/reset stop and disconnect voices; late decode cannot play.
Maintenance, alarms and UI feedback retain their existing behavior. Native
controls and audio work after WebGL failure. See the
[station audio notes](../public/audio/nuclear-power/stations/README.md) and
`scripts/generate-station-audio.py`; run `npm run test:browser:audio`.

Audio verification: all 172 unit checks, production build and the focused shared
audio browser checks pass (86.8 seconds). This audio-only follow-up did not rerun
the full browser suite; its reactor/diesel assertions and new station assertions
share the same helper with the full harness.

The Electrical grid follow-up adds a third desktop tab after Maintenance, reusing
the station lifecycle and electrical geometry/actual-state adapters. See
[ELECTRICAL-GRID-PLAN.md](ELECTRICAL-GRID-PLAN.md). Its final verification passes
182 unit/model/session checks, build, focused grid/layout checks, the full browser
regression and the companion check; this supersedes the older timeout result above.
