<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Cooling tower addition

Status: presentation feature implemented. The counts and screenshots below are
historical tower-task evidence. The later standalone/game baseline is recorded in
[doc/game-development.md](doc/game-development.md); this is not a pending game task.

## User request

Add a cooling tower to the background of the 3D cutaway, scaled against the
spent-fuel pool. Use a realistic curved, gray concrete shell with two red rings
near the top. Connect the condenser with pipes descending through the equipment
base plate and continuing into the background. Add a river intake/make-up-water
pipe. Increase the visible white plume with the condenser's actual heat rejection.
The user specifically requested this checkpoint in case the conversation runs
out of context/tokens.

## Agreed presentation

- A separate recirculating condenser cooling-water loop: warm water to the tower,
  cooled water back to the condenser, plus a smaller river make-up connection.
- The white plume represents condensed water vapor from cooling water; reactor
  coolant and turbine steam do not discharge directly into the tower.
- Gray hyperboloid shell, hollow top, two red bands near the top, basin and inlet
  supports. Position behind/right of existing equipment without obscuring the
  spent-fuel pool, crane or electrical equipment.
- Route visible condenser supply/return pipes down through the existing plate,
  beneath/outside its edge, then back up at the background tower.
- Use actual secondary heat/flow and condenser cooling read-back, never requested
  MW or requested valve position. Cold/no-flow/no-cooling states have no plume;
  retained hot circulation may continue releasing a plume after reactor Stop.
- Reuse the shared visibility-aware frame clock and bounded instanced particles.
  Preserve pause, hidden/offscreen/maintenance suspension, reduced motion,
  picking, labels, both themes and GPU disposal. No new physics or controls needed.
- User visual feedback: the original spiral was distracting. Vapor now rises
  straight up in fixed emission columns, with no orbit or sideways drift. Keep
  density/height/opacity dependent on actual cooling load and soft puff expansion.

## Implementation entry points

- `src/simulation/nuclear-power-scene.js`: unified Three.js build/update, static
  batching, labels, camera and disposal. Condenser at `[7, 0, 3.1]`; existing base
  is 24 × 18, centered at `[0, -.35, -.5]`.
- `src/simulation/nuclear-power-motion.js`: `advanceProcessMotion`, integrated
  from the custom element's existing frame loop.
- `src/simulation/nuclear-power-particles.js`: `ParticleBatch` through the scene's
  `particles()` helper automatically registers geometry/instance disposal.
- `src/simulation/nuclear-power-temperature.js`: actual loop temperatures.
- `src/simulation/nuclear-power-components.js`: condenser actual `coolingValve`,
  `inletTemperature` and `coolingFactor`.
- `test/nuclear-power-rendering.test.mjs`: headless scene geometry/particle tests.
- `test/equipment-browser.mjs`: focused UI regression entry point.
- Read `doc/nuclear-power.md` and supplied AGENTS guidance before changes.

## Verification and status

Implemented in `nuclear-power-cooling-scene.js` (geometry, piping, river and one
instanced vapor draw call) and `nuclear-power-cooling.js` (normalized presentation
signal). The shared process-motion state integrates vapor phase and cooling-water
travel; the scene retains picking, keyboard labels, static geometry batching and
registered GPU cleanup. The default camera fits the background tower and plume.
No plant physics, automation, command paths or condenser controls were changed.

Verification passed: all 123 unit checks, the production build and the focused
cooling browser check. After the vertical-plume refinement, focused cooling tests
and the build passed again; a regression check confirms every puff's X/Z position
stays fixed as its height changes. Browser screenshots verified dark/light desktop
and mobile. Heat-dependent plume density, actual-versus-requested cooling, retained
hot circulation after Stop, pause, reduced motion, Reset, canvas picking and the
CT-01 button were checked. The wider equipment run was interrupted when the user
requested vertical vapor; the focused cooling browser run subsequently passed.
The full browser suite was not run during that tower-only iteration; it passed
later during the standalone/company-game baseline.

Focused commands:

```sh
node --test test/nuclear-power-cooling.test.mjs test/nuclear-power-rendering.test.mjs test/nuclear-power-loop.test.mjs
npm run build
npm run test:browser:cooling
# Includes tower plus condenser/turbine UI and overload scenarios:
npm run test:browser:equipment
```

Worktree was clean before this task. Avoid replaying the full browser suite for
this focused addition or documentation edits. The current plant specification is
[doc/nuclear-power.md](doc/nuclear-power.md).

Reference for the water arrangement:
https://www.eia.gov/todayinenergy/detail.php?id=14971
