<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Compact landscape layout plan

Status: implemented with automated verification, 2026-11-18. Physical Android/
Firefox and iPhone/Safari verification remains manual. The design below records
the behavior and implementation boundaries.

The 2026-11-20 responsive extension uses this same presentation on all landscape
viewports up to **1200 CSS pixels wide**, including smaller tablets and resized
mouse-operated browser windows. There is no height or pointer-type restriction.
Portrait and wider windows retain their existing layouts. Resizing across the
boundary restores the original controls and desktop panel preferences without
changing the simulation, Pause or cameras. This supersedes the original
phone-only detection rule.
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

Keep the current wide desktop layout, desktop scrolling layout above the compact
breakpoint and desktop panel preferences. Retain the current portrait layout too.
There are no model, mission, save-schema, transport or relay changes.

## Proposed screen

```text
 Unit 01 / clock    Company    Trends / alarms    GC    Pause    More
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
| Left edge | A labeled Instruments handle opens the existing readings and Pump power source in a left drawer. |
| Right edge | A labeled Controls handle opens the existing operator controls and regulation settings in a right drawer. |
| Company button | In a career, opens the existing Inbox, Assignments, Achievements, Archive and Save pages. In free operation, offers existing Start/Continue actions. |
| Assignment steps | Accepted work appears as small top-left text below the scene caption, with completion marks and a timer, without card styling. Touches pass through. The same DOM returns above Live trends outside phone mode. |
| Trends button | Opens Live trends and access to alarms/events in a large sheet. Full briefings and reporting remain in Company. |
| GC button | Opens the existing Grid controller in its own sheet, with Follow requests, Request now and actual dispatch status. |
| More button | Opens Plant menu with Maintenance and Spent fuel first, followed by a separate Other controls section for objectives, theme, sound, view tools and Connect screen. Equipment/Core map use overview selection; native menu shortcuts appear for the schematic/WebGL fallback. |
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
- Accepted handle taps and swipes play the existing UI adjustment sound, using
  the same opt-in, mute, Pause and visibility checks as other native controls.
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
3. Select the compact presentation at landscape widths up to 1200 CSS pixels,
   independently of viewport height and pointer type. This includes phones,
   smaller tablets and mouse-operated browser windows. Portrait and wider
   windows retain their existing layouts. Do not use user-agent sniffing.
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
   844×390 and 932×430 touch viewports, portrait rotation, 1024×768, 1133×744,
   1180×820 and 1200×900 tablets, and mouse-operated windows through 1200px.
   Check desktop restoration at 1201px. Include both themes, reduced motion, keyboard
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

- [x] **Fix viewport-dependent Full screen visibility in Chrome.** Reported
  2026-11-18: the web UI's control works in Firefox, but is missing or does not
  work in Chrome. Header access now works independently of viewport width and
  pointer classification, with actual entry/exit verified in Chrome. Portrait
  settings and landscape More retain the native user-gesture path, unavailable/
  rejected-request fallback and preservation of Pause, plant state, cameras and
  saves. Confirmation on the user's original physical Chrome device remains a
  manual follow-up.

  The hosted `/reactor/` page was checked in Chrome on 2026-11-18: the fullscreen
  API was available, but at 1440×900 with a mouse the button had a zero-size box.
  The deployed CSS hid it unless the viewport was at most 1100px wide and reported
  a coarse pointer. The web control now appears in header settings at every size,
  with More retaining ownership in the phone landscape layout. Coarse-pointer
  touch targets also remain 44px on larger tablets. `test:browser:fullscreen`
  shares real Chrome click/entry/exit and state-preservation checks with the full
  browser run. Physical verification in the user's affected Chrome remains open.

Reported 2026-11-17 for **Firefox on Android**. Both features are implemented;
automated browser checks use native touch input and fullscreen in Chromium.
Verification on a physical Android/Firefox device remains a manual check.

- [x] **Pinch to zoom all 3D views.** `nuclear-power-touch-zoom.js` tracks two
  pointers in the overview, equipment/grid stations and rack, respecting their
  independent cameras and zoom limits. It covers overview labels as well as the
  canvas, while single taps retain inspection. A pinch suppresses picking until
  all fingers lift; cancel, hide, resize and detach clear input/capture. Mouse,
  keyboard, one-finger orbit and ordinary page scrolling outside the model remain
  available. Native pointerdown is not cancelled, preserving subsequent UI taps.
- [x] **Mobile Full screen / Exit full screen control.**
  `nuclear-power-fullscreen.js` adds the full host's native toggle to settings:
  More in landscape, header settings in portrait. It requests the whole page so
  controls and inspections remain usable. Native state/events update the label;
  successful transitions reconcile mobile popovers and focus. Unsupported or
  rejected requests show a usable fallback. Owned and late fullscreen requests
  are cleaned up on detach/reconnect. Entry, exit and rotation preserve cameras,
  actual plant state, Pause, preferences, career saves and the companion role.

`npm run test:browser:mobile-input` runs the shared focused checks for seven
actual two-touch cameras, zoom/pan, release/cancel, subsequent orbit/control taps,
logo/title navigation, native fullscreen entry/exit and portrait rotation. Mobile
and full browser journeys call the same checks. Eight unit cases cover bounds,
combined pan/zoom, third fingers, cancellation,
mouse/keyboard continuity, rejected/unsupported requests and late detach cleanup.

Fullscreen requires a user gesture; the page cannot enter it automatically merely
because it loads or rotates. See the [MDN requestFullscreen reference](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
and [Fullscreen guide](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide).

- [x] Smaller, darker, more transparent mobile equipment tags. Their native
  buttons retain 44-pixel touch targets; selected/focused cards remain readable.
- [x] A 28-pixel app icon beside the mobile header's title and clock.
- [x] The logo, title and clock share a native button returning to the main plant
  view through existing navigation, retaining plant state and the overview camera.
- [x] Small, background-free assignment text below the upper-left caption of
  overview and station views. Steps and completion marks reuse the existing live checklist;
  the overlay clears station return controls and passes camera touches through.
  Text aligns with the scene caption at 16px from the left, directly below it.
  Steps/title use 8px text and the timer 7px, with tight line spacing.
  The pump station adds clearance beside Instruments because its pump-selection
  row places the caption lower in the viewport.
- [x] Two-finger movement pans all seven 3D cameras in the screen plane while
  pinch zoom remains available in the same gesture. Pan limits, Reset view,
  independent cameras, one-finger orbit/picking and cleanup remain in effect.
- [x] Smaller mobile instrument numbers and load-target readouts. Other labels
  and the control hit areas retain their sizes.
- [x] An initial **Enable plant sounds?** dialog with **Yes** / **No** buttons on
  both desktop and phone. `nuclear-power-sound-choice.js` uses the existing
  gesture-driven Enable/Mute path and bounded audio. No/Escape keeps sounds muted.
  It asks once per page load, without saving preferences or adding career/save/
  transport fields; Reset, rotation, career changes and reconnect do not repeat
  it. Shared browser checks exercise both choices with actual mouse/touch input.

The 2026-11-18 follow-up passes all 215 unit checks, the production build, focused
mobile-input/mobile/layout/station/company-game/companion checks and the full
browser regression (18m04s). Checklist geometry is covered at all four phone
sizes in both themes, including completion marks, station return-button
clearance and restoring the same checklist to desktop after rotation.

The subsequent typography/placement refinement puts 8px steps and a 7px timer
directly below the upper-left scene caption, leaving the bottom Return button
clear. Production build and focused mobile browser checks pass for this refinement;
the earlier full-suite result above predates these CSS-only adjustments.

## Responsive extension verification, 2026-11-20

The 1200px landscape breakpoint passes all 223 unit checks, the production build,
focused mobile and desktop-layout browser checks, the full browser regression
(18m56s), and the companion browser check. The full run includes the shared
fullscreen, equipment-station and company-game assertions.

Tablet coverage includes 1024×768, 1133×744, 1180×820 and 1200×900 in both themes.
Real mouse clicks exercise drawers at 844×390, 1000×800, 1100×900 and 1200×900.
Crossing to 1201px closes overlays and restores the original desktop controls;
returning starts with drawers closed. Exact plant snapshots, Pause, camera poses,
the retained host instance and desktop panel preferences survive these changes.
Portrait restoration and companion behavior retain their existing coverage.
