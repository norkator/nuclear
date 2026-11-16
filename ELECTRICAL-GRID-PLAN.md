<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Electrical grid station

1. Add Electrical grid immediately after Maintenance. Route overview grid and
   AC-bus selection to it; retain direct electrical/diesel inspection and companion
   controls. Preserve keyboard tab order and overview camera.
2. Build a dedicated 3D electrical cutaway: grid transformer/switchgear, turbine
   feed, AC bus, two standby diesels and outgoing pump circuits. Reuse shared
   electrical geometry and actual-state adapters. Give the view its own camera.
3. Provide native grid/feed switches and accessible part buttons. Canvas picking
   opens the existing guarded connections and diesel windows, with focus return.
   Keep controls usable after WebGL loss.
4. Use the existing station lifecycle and single console frame clock. Build only
   on first visit; draw only while selected, visible and foregrounded. Preserve
   pause/reduced motion, actual engine phases, cold stillness, detach disposal
   and reconnect. No new simulation, timers or saved fields.
5. Update shared browser coverage for navigation, picking, native controls,
   actual-state supply/motion, camera isolation, hidden/offscreen suspension,
   fallback, keyboard access, mobile fit, both themes and reconnect. Keep all
   eight company assignments and companion ownership intact.
6. Update documentation; run model tests, build, focused grid/station and layout
   checks, the final full browser regression and companion checks. Do not deploy.

The startup follow-up also requires an actually online process server and control
network before reactor Start in either mode, including Hard. Independent Manual
controls, Stop and ESD remain available during computing loss.

## Completed verification

Steps 1–6 implemented. All 182 model/unit/session checks and the production build
pass. Focused grid and layout browser checks pass; the final full browser
regression passes (942 seconds), including all eight company assignments, Hard
startup/Continue, grid navigation and visibility/disposal/fallback checks. The
focused companion check passes (107 seconds), including blocked remote Manual
Start with computers OFF and independent emergency controls. No save fields,
mission IDs or issued objective terms changed.
