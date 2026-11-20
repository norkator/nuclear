<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Development and verification

All commands and code paths below are relative to the repository root.

## Repository and branches

This project lives independently at <https://github.com/norkator/nuclear>. Work
on `main`; merge approved releases to `production`. The container workflow tests
both named branches, publishing images only from `production`. Pushes/manual
runs on `main` run checks only; `production` runs checks followed by both image
pushes. Pull requests do not trigger this workflow, and manual runs on other
branches skip its jobs. No Java/Spring checkout is required.

## Local development and verification

Use Node 22.12+ (or Node 24) and npm, independently of the Java/Gradle application:

From this repository root:

```sh
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

For shared console layout, breakpoints or panel animations, run
`npm run test:browser:layout` while iterating and the full `npm run test:browser`
once before handoff on the final build. The focused command shares its geometry
assertions with the full suite. It waits for actual layout transitions, stable
rectangles and the renderer resize before checking overlap, viewport fit and both
themes at 1440/1920/2560/3440 px. Animation behavior is checked separately by the
companion browser suite. Avoid fixed sleeps or disabling motion to hide failures.
Browser failures print geometry/transition diagnostics and save a screenshot plus
`failure-context.json`. GitHub Actions retains screenshots and JSON for one
day in `browser-failure-evidence`, excluding browser profiles.

`npm test` runs model, motion, failure, fuel, supply, component, audio, game and
session tests. Game changes normally use `node --test test/nuclear-power-game.test.mjs`,
`npm run build`, then `npm run test:browser:game`. Use the companion check when
shared controls change.

For continuation objectives and save compatibility, include
`node --test test/nuclear-power-assignment-expansion.test.mjs`. The shared company
browser journey operates all twenty-four assignments and checks that the original
eight reports survive the continuation. Run browser harnesses separately when
software WebGL rendering competes for resources; retain their existing assertions
and readiness checks.
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

## Compact landscape verification

`npm run test:browser:fullscreen` checks the visible web fullscreen control and
real Chrome entry/exit in both themes on desktop, smaller mouse viewports and
large touch viewports. It uses the same checks as the full suite and preserves
plant state, Pause and the overview camera. The focused mobile-input check below
covers actual phone touch entry/exit and rotation.

`npm run test:browser:mobile-input` is the shorter iteration check for real
two-touch camera input across all seven 3D views and native fullscreen entry,
exit and rotation. Its assertions are shared with the complete mobile journey
and full suite. `node --test test/nuclear-power-mobile-input.test.mjs` covers
cancelled gestures, mouse/keyboard continuity, rejected/unsupported fullscreen
and asynchronous detach cleanup without a browser.

For the compact landscape host layout, run `npm run test:browser:mobile`. The checks
are shared with the full browser suite and use actual touch input, viewport and
drawer geometry, focus, cold startup, career controls and rotation/reconnection.
They cover landscape tablets through 1200px wide and real mouse clicks in small
browser windows, with desktop restoration at 1201px and state/camera preservation.
This layout changes the shared console shell: before handoff also run the existing
desktop layout/station checks, the final full browser suite and focused companion
and company-game checks. See [the mobile implementation plan](MOBILE-LANDSCAPE-PLAN.md).

## Android audio defaults

The sibling `../NuclearMobile` WebView can advertise `audioEnabledByDefault: true`
with `platform: android` in its native bootstrap, paired with
`setMediaPlaybackRequiresUserGesture(false)`. The full host then enables the
existing audio path without a question. Ordinary browsers and older wrappers
retain the existing Yes/No dialog. Mute remains local to the current page and
survives reset, resizing, reconnection and background/resume.

Run `node --test test/android-integration.test.mjs test/nuclear-power-sound-choice.test.mjs`,
`npm run build`, `npm run test:browser:android` and `npm run test:browser:audio`.
The Android browser check injects the native bootstrap into a fresh Chromium
page and permits gesture-free playback only for that focused run. It verifies
running audio before any user activation, no prompt, a quiet cold plant, Mute,
reset/reconnect and pause/visibility cleanup. The ordinary browser checks retain
their default media policy and explicit Yes/No checks.

`npm run sync:android` copies `dist/` into the sibling wrapper's generated assets.
On the Android development machine, follow `../NuclearMobile/doc/android.md` for
APK builds and the real WebView smoke test. The browser model does not establish
device playback; the 2026-11-20 native change awaits Android compilation and
emulator/device verification there.

Web verification on 2026-11-20 passes all 234 unit checks, the production build,
the modeled Android audio browser check and the existing plant/station audio
browser check, including ordinary browser Yes/No behavior. The tested bundle was
synced into `../NuclearMobile/app/src/main/assets/nuclear`.

## Local companion relay

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

## Search visibility

The production build includes static introductory content, three linked control-room
guides, canonical and social metadata, structured app data, a sharing screenshot,
`/robots.txt` and `/sitemap.xml`. The guides work without JavaScript and do not mount
the simulator. The landing page shows the two screen-selection cards above the introduction.
Only `/reactor/` and `/companion/` mount React and the retained custom element;
their HTML contains no landing or guide article. See [SEO.md](SEO.md) for content
maintenance, verification and the Search Console steps after deployment.

See [hosting and deployment](deployment.md) for Docker, published images and reverse proxies.
