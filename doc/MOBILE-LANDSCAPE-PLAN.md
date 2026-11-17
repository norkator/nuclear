<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Phone landscape layout plan

Status: implementation in progress, 2026-11-17. The layout is implemented;
browser verification and final handoff are in progress. The design below records
the intended behavior and implementation boundaries.
Read [AGENTS.md](../AGENTS.md), [the plant specification](nuclear-power.md),
[the equipment-station plan](EQUIPMENT-STATIONS-PLAN.md) and
[the development guide](development.md) before implementation.

## Goal and scope

Make the full reactor console comfortable on a landscape phone. The plant overview
occupies the available screen; instruments and operating controls open on demand.
Selecting equipment keeps the existing route into its dedicated 3D station.

This is a layout of the authoritative `/reactor/` console. A phone running this
page can operate its own free plant or career, including company assignments and
saves. `/companion/` remains a separately paired follower with its current
ownership and scrolling rules. Screen size must never determine simulation role.

Keep the current wide desktop layout, smaller desktop scrolling layout and
desktop panel preferences. Initially retain the current portrait layout too.
There are no model, mission, save-schema, transport or relay changes.

## Proposed screen

```text
 Unit 01 / clock    Company    Trends / alarms    Pause    More
 ------------------------------------------------------------
             Current 3D overview or equipment station
 Instruments >                                    < Controls

       [Back to plant] on equipment views    [Parts / Units]
```

This is a placement sketch; size controls against actual phone geometry rather
than fitting every desktop label into the header.

| Area | Proposed behavior |
| --- | --- |
| Main view | Existing overview, station or computer-rack renderer fills the height remaining below a compact header. |
| Left edge | A labeled Instruments handle opens the existing readings, Pump power source and Grid controller in a left drawer. |
| Right edge | A labeled Controls handle opens the existing operator controls and regulation settings in a right drawer. |
| Company button | In a career, opens the existing Inbox, Assignments, Achievements, Archive and Save pages. In free operation, offers existing Start/Continue actions. |
| Trends button | Opens Live trends, the accepted-assignment checklist and access to alarms/events in a large sheet. Full briefings remain in Company. |
| More button | Provides Maintenance, all equipment destinations, Core map, spent fuel, theme, sound and Connect screen. Native equipment navigation remains available without WebGL. |
| Back to plant | A floating, labeled button on every non-overview plant view, including Maintenance and Computer systems, returns to the retained overview. |
| Parts / Units | Opens the current station's native part list or rack-unit controls without permanently consuming scene height. Show the native list directly if 3D is unavailable. |

Keep actual run/trip/alarm indication and Pause discoverable while panels are
closed. Put Start, Stop and the existing covered emergency button in the first
visible section of the operator drawer; longer pump and rod controls scroll
below it. Opening any menu or drawer never pauses the plant. Only the existing
Pause command changes Pause.

## Navigation and touch behavior

- Reuse `navigateEquipment()`, `EquipmentStations.navigate()` and `setPlantTab()`.
  Returning to the plant selects `reactor`; it does not recreate a renderer,
  reset a camera or reload the page. Preserve the current overview presentation,
  including an explicitly selected schematic and automatic WebGL fallback.
- Hide the large desktop tab strip only in phone mode. Expose every destination
  through native mobile navigation, including the grid and all four pump identities.
- Opening a drawer has both a visible button and an optional swipe gesture.
  Start swipes on dedicated handles slightly inside the usable screen edge,
  respecting safe areas. Do not capture gestures across the canvas or depend on
  intercepting the browser's back gesture.
- Closing supports the handle, an explicit Close button, backdrop tap and Escape.
  Swipe-to-close uses a drawer handle/header rather than stealing slider gestures.
- Camera dragging and component picking retain their existing movement threshold.
  A canceled swipe or camera drag cannot also pick equipment or change a target.
- Keep touch targets at least 44 CSS pixels. Preserve native ranges, rockers,
  requested/actual indications and all command guards. Do not shrink the desktop
  controls to squeeze the complete console onto one screen.
- Use the floating Back to plant control for plant navigation. Browser Back keeps
  the existing page-navigation behavior; do not add a history entry per panel.

## Drawers and inspection windows

Use one coordinator for mobile drawers, menus and inspection windows. At most
one surface accepts input at a time. Opening another switches surfaces rather
than stacking several independently interactive overlays.

Reuse the actual instrument, operator, company and inspection nodes and their
existing handlers. Prefer CSS positioning and small structural wrappers. If a
node needs to move, record its original position and restore it on mode exit;
never clone a second active control tree or rerun console initialization.

Existing equipment, core, pool, electrical, company and trends windows become
viewport-bounded sheets in phone mode. Keep their title, Close control and any
essential actions reachable; scroll long bodies inside the sheet. Short landscape
height needs explicit treatment: the present 340/480-pixel station canvases and
desktop dialog offsets cannot simply carry over.

Coordinate the existing top-layer popovers with drawers. A drawer implemented
only with a large CSS z-index must not end up behind an older open popover. Keep
the desktop's movable, nonmodal multi-window behavior outside phone mode.

While a mobile surface is modal to interaction, apply appropriate dialog labeling,
contain keyboard focus and make background controls inert. Restore focus to a
visible trigger on close. In particular, `EquipmentStations.navigate()` currently
focuses a desktop tab, and several dialog-close paths resolve desktop buttons:
provide mobile-aware focus targets before hiding those controls.

Opening inspection from a parts list preserves station/part context. Closing
inspection returns to a visible station control. Returning to the overview or
closing a sheet uses the existing preview-cancellation path; uncommitted slider
or drag values must never be applied by navigation. The emergency cover continues
to require explicit opening and activation; navigation never changes its state.

## Isolating the mobile layout

1. Introduce a presentation attribute such as `data-layout="phone-landscape"`.
   Keep `data-screen="desktop"` for the full host and `data-screen="companion"`
   for followers. Do not overload role or career state with viewport information.
2. Add a dedicated `nuclear-power-mobile-layout.js` controller and matching CSS.
   Scope all new rules to the full host with the mobile attribute. Reuse shared
   behavior through small hooks rather than rewriting desktop layout rules.
3. Begin automatic detection with a short landscape viewport on a touch device;
   a candidate is width up to 1100 CSS pixels and height up to 600 CSS pixels.
   Validate these thresholds against real devices. A small mouse-operated desktop
   must retain its existing layout, and a landscape tablet must not be caught
   just because its orientation matches. Do not use user-agent sniffing.
4. Arbitrate panel ownership between the existing desktop controller and the
   mobile controller. Mobile drawers start closed and use transient UI state.
   Opening them must not write `porssiohjain.nuclear-power.panels` or the companion
   layout preference. Both controllers must not set hidden/inert/transition state
   on the same panel at the same time.
5. On mode entry/exit, settle or cancel in-flight panel transitions, resolve the
   active overlay and cancel uncommitted gestures. Restore desktop preferences,
   focus semantics and window positioning. Preserve the simulation instance,
   actual readings, career, Pause choice, selected equipment and all cameras.
6. Use dynamic viewport height and safe-area padding. If using edge-to-edge
   rendering, update only the reactor entry's viewport metadata as needed.
   Browser toolbar changes and the software keyboard must keep sheets and Close
   buttons visible without unexpectedly switching layout mode.
7. Attach and remove viewport, gesture and focus listeners through the retained
   custom-element lifecycle. Support reduced motion and rapid reversal without
   leaving hidden controls interactive after rotation, detach or reconnect.

## Rendering and plant time

Keep the existing single simulation timer and shared frame loop. Changing layout,
opening Company or showing instruments never sends a plant command or advances
a separate clock. The same Auto/Manual, Hard-mode and service interlocks apply.

Visible scene portions can continue animating behind a partial drawer. When a
sheet fully covers a scene, suspend that scene's rendering and machinery ambience
through the presentation visibility logic while the visible console's plant time
continues. Intersection observers alone do not establish whether an overlay
covers a scene. Model scene occlusion explicitly, independently of simulation
visibility, and verify actual frame/audio behavior. Preserve page-hiding, Pause,
reduced-motion and detach cleanup; returning resumes actual state without replay.

## Code entry points

All paths below are relative to the repository root.

| File | Relevant work |
| --- | --- |
| `src/simulation/nuclear-power.js` | Header/console markup, initialization and lifecycle, `setPlantTab()`, `equipmentTrigger()`, floating-window opening/closing/positioning, activity and audio visibility. |
| `src/simulation/nuclear-power-layout.js` and `.css` | Preserve desktop panel preferences, transitions and focus; add explicit ownership handoff to the mobile layout. |
| `src/simulation/nuclear-power-stations.js` and `.css` | Existing equipment routes, Back to plant action, native parts, selected pump, station sizing and mobile focus targets. |
| `src/simulation/nuclear-power-computers.js` and `.css` | Rack sizing, native unit access and focus while the desktop tab strip is hidden. |
| `src/simulation/nuclear-power-game.js` and `.css` | Reuse company pages, career entry/status and derived assignment checklist. No new mission or save data. |
| `src/simulation/nuclear-power.css` and dialog-specific styles | Mobile-only sheet sizing, scroll ownership and touch hit areas. |
| `src/styles.css` and `reactor/index.html` | Scope viewport/safe-area integration to the full reactor console. Preserve landing, guide and companion behavior. |
| `test/console-layout.browser.mjs` | Extend layout readiness/diagnostics for mobile surfaces while preserving existing desktop assertions. |
| `test/equipment-stations.browser.mjs` | Keep navigation, actual rendering, native fallback and camera-preservation checks shared. |

## Delivery and verification

1. Build the isolated layout and explicit button navigation first: compact header,
   retained scene, drawers and Back to plant. Verify desktop-to-phone-to-desktop
   transitions before adding swipe gestures.
2. Adapt station/rack controls and inspection sheets, then company/trends/menu
   access. Complete one cold startup on a phone, including AC, computer boot,
   circulation, reactor Start, Stop and covered ESD. Complete career acceptance,
   verification/reporting, Save/Continue and backup export/import.
3. Add optional handle swipes, gesture cancellation and real-device refinements.
   Check an Android browser and Safari on an iPhone, including browser toolbars,
   notches, the software keyboard and the browser's own edge navigation.
4. Add a focused mobile browser entry, for example `test:browser:mobile`, backed
   by checks also called by the full browser suite. Exercise 667×375, 740×360,
   844×390 and 932×430 touch viewports, portrait rotation, a touch tablet and a
   smaller mouse-operated desktop. Include both themes, reduced motion, keyboard
   access, fallback, hidden rendering/audio, pause and detach/reconnect.
5. Assert real geometry, touch picking, focus return and control ownership. Verify
   that layout changes preserve the exact simulation instance, saved desktop
   preferences and camera poses. Wait for actual transitions, settled geometry
   and renderer resizing with `waitForConsoleLayout`; check in-flight interlocks
   separately. Do not delete desktop overlap/fit assertions or add fixed sleeps.
6. During implementation, run focused model checks, `npm run build`, the new mobile
   checks, `npm run test:browser:layout` and `npm run test:browser:stations` as
   appropriate. Before handoff, run `npm test`, the final production build and
   `npm run test:browser` once, plus the focused companion and company-game checks.
   This is a shared-shell change; a focused pass alone is insufficient.

The first implementation slice is layout isolation, button-operated drawers and
retained overview/station navigation. Swipe polish follows after those paths and
desktop restoration are verified. No publishing or deployment is part of this work.

## Additional requested tasks

Reported 2026-11-17 during assignment expansion; these two follow-ups are queued,
not implemented by the assignment work. The reported device/browser is
**Firefox on Android**; use it as the primary real-device verification target:

- [ ] **Pinch to zoom all 3D views.** Two-finger gestures currently do not zoom
  the model on a touch screen. The overview camera accepts one pointer for orbit
  or pan and a mouse wheel for zoom; its active drag rejects a second pointer.
  The rack also has no two-pointer distance tracking. Add camera zoom using the
  distance between two active touches in the overview, equipment/grid stations
  and computer rack, respecting each camera's zoom limits and independent pose.
  Preserve one-finger orbit, picking and native ± controls. Pinching, pointer
  cancellation or lifting one finger must not accidentally pick equipment or
  operate controls. Do not capture gestures outside a canvas or disable ordinary
  page zoom/scrolling. Clear touch state on hide, rotation, context loss and detach.
  Cover actual two-touch input, transitions between one/two fingers and camera
  retention in the shared station/rack/mobile checks; verify on a real phone.
- [ ] **Mobile Full screen / Exit full screen control.** Add a discoverable
  control, preferably in More for landscape, with access in portrait too, for
  the full console when supported. A tap should
  request fullscreen for the complete application so the header, drawers and
  inspection windows remain accessible. Use native fullscreen state/events for
  the label and exit behavior, handle rejected/unsupported requests visibly and
  leave the normal layout usable. Entry/exit, Android Back/browser exit and
  rotation must settle viewport geometry without resetting a camera, changing
  Pause, touching career saves or changing the simulation/companion role. Verify
  on Firefox for Android and another mobile browser; check support at runtime
  rather than assuming every mobile browser provides the same API.

Fullscreen requires a user gesture; the page cannot enter it automatically merely
because it loads or rotates. See the [MDN requestFullscreen reference](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
and [Fullscreen guide](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide).

- [x] Smaller, darker, more transparent mobile equipment tags. Their native
  buttons retain 44-pixel touch targets; selected/focused cards remain readable.
- [x] A 28-pixel app icon beside the mobile header's title and clock.
- [x] Smaller mobile instrument numbers and load-target readouts. Other labels
  and the control hit areas retain their sizes.
- [x] An initial **Enable plant sounds?** dialog with **Yes** / **No** buttons on
  both desktop and phone. `nuclear-power-sound-choice.js` uses the existing
  gesture-driven Enable/Mute path and bounded audio. No/Escape keeps sounds muted.
  It asks once per page load, without saving preferences or adding career/save/
  transport fields; Reset, rotation, career changes and reconnect do not repeat
  it. Shared browser checks exercise both choices with actual mouse/touch input.
