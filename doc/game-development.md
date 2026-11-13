<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Continuing company-game development

Updated 2026-11-13. This is the implementation handoff for the standalone
[norkator/nuclear](https://github.com/norkator/nuclear) repository. All commands
below run from this repository root. Read [AGENTS.md](../AGENTS.md), this file,
[the product plan](../GAMEPLAY-PLAN.md) and [the plant specification](nuclear-power.md)
before continuing. The plan describes the intended game; this file describes the
code that exists and the work still needed.

## Current playable chapter

Free operation remains the initial mode. **Start game → Begin career** creates
a separate cold plant, initially paused. **Resume shift** starts its clock.
The free-operation plant is parked in memory and restored by **Save & return to
free operation**; it does not earn career progress. Reload opens free operation;
**Continue game** restores the saved career paused, without offline advancement.
Switching plants ends companion pairing and clears old local audio/motion.

The boss, Elena Ward, automatically issues one assignment at a time through the
company inbox. The player accepts, operates, waits for verification and reports.

Accepting closes the company window and reveals a compact checklist above Live
trends. Gray numbered steps turn green with checkmarks as actual conditions are
met; the hold timer shows continuous verified time. Unverified conditions can
return to gray, while a verified assignment stays green until reported. Full
briefing opens the inbox; Send report is available on the verified checklist.
Unaccepted assignments and free operation have no checklist. Steps are derived
from pinned objective terms and saved plant/evidence, without new save fields.
On wide screens the checklist and trends share the independently hideable right
side panel. Its contents scroll without overlapping or moving the process/header;
the career status and Company inbox entry remain available when that panel is
closed. Companion station presets do not add company pages or career commands.

| Stable mission ID | Criterion | Capability earned on report |
| --- | --- | --- |
| `startup.first-shift` | Explicit successful reactor Start after acceptance, then 200 ± 5 gross MW for 30 continuous simulated seconds | `commissioned` |
| `operation.reliable-five` | 200 ± 5 gross MW for 300 continuous simulated seconds after acceptance | `reliable-operation` |

Both require Auto/electrical regulation with the 200 MW target, grid following
disabled, running/no trip, no active faults or damage under the existing model
checks, positive cooling margin, both flows at least 20%, core at most 335 °C and
peak fuel at most 410 °C. These are fictional model limits. Violations reset the
hold immediately; pause does not advance it. A completed verification stays ready
to report even if the plant changes afterward. Reporting records an achievement,
archives the saved requirements/result, sends follow-up mail and issues eligible
next work. Email read state does not determine plant success.

Current saved lifecycle values are `assigned`, `active`, `ready`, `completed`.
Only the `generation-hold` objective kind is implemented. The larger lifecycle,
20-mission catalogue, costs, rewards, contracts and bankruptcy in the product
plan are future work. There is no wallet or monetary reward for either current
mission. Ordinary repairs, refuelling and dispatch remain free.

All company UI and career ownership are desktop-only. Companions can operate the
host plant through existing validated commands, including selected/all fuel
replacement. They do not display an inbox/mission/finance summary yet, create
career saves, tick objectives, or manage the host's game. Pool dispatch remains
desktop-only.

## Code map

| File | Responsibility |
| --- | --- |
| `src/simulation/nuclear-power-missions.js` | Two definitions, catalogue validation, capability prerequisites, inbox records, hold evaluation and reports |
| `src/simulation/nuclear-power-game.js` | Entry/return, company UI, lock ownership, autosave, JSON backup and plant switching |
| `src/simulation/nuclear-power-game-save.js` | Explicit plant/pool serialization, validation/hydration and IndexedDB revision writes |
| `src/simulation/nuclear-power-game.css` | Company-window and game-status styles |
| `src/simulation/nuclear-power.js` | Custom-element integration, host plant ticks, UI updates, cleanup and guarded Reset demo |
| `src/simulation/nuclear-power-model.js` | Reactor commands/read-backs; `startSequence` increments only on successful Start |
| `test/nuclear-power-game.test.mjs` | Mission timing/evidence, content insertion, pinned terms, hydration and invalid saves |
| `test/company-game.browser.mjs` | UI/reload/ownership/layout/lifecycle/save-failure checks reused by the browser harness |
| `test/game-browser.mjs` | Focused browser entry selected by `npm run test:browser:game` |

`CompanyCareer.advance(sim)` consumes advanced plant elapsed time. The host calls
it from its update path; repeated rendering at the same plant time grants no
progress. The normal plant step is bounded to one simulated second. Tests that
advance many steps must evaluate the career after every step. Future electricity
settlement must consume actual advanced intervals and request boundaries, never
UI calls, animation frames, wall-clock absence or requested MW.

## Saved-state contract and known gaps

- Save schema: `CAREER_SAVE_VERSION = 1`; content metadata:
  `MISSION_CONTENT_VERSION = 1`. There is no economy rules version yet.
- IndexedDB: `porssiohjain-nuclear-career`, database version 1, object store
  `career`, keys `current` and `previous`. Keep this namespace when changing
  repository/UI names, or provide an explicit migration. Saves belong to the
  browser origin; another device, browser profile, origin or cleared storage
  does not share them. The WebSocket relay never stores them.
- Each stored record is `{ revision, bundle }`; the bundle contains
  `{ schemaVersion, career, plant, transfer }`. Successful writes atomically move
  the old current record to previous and compare the expected revision.
- One tab holds the `nuclear-power-career` Web Lock. A second tab is refused
  ownership; explicit takeover/read-only career viewing are not implemented.
  The current browser must support IndexedDB and Web Locks. Use localhost or the
  deployed HTTPS origin for the game; an ordinary HTTP LAN origin may lack the
  required secure-context APIs even though free operation/companions work.
- Autosave runs at least every five advanced seconds and on relevant UI/command
  updates. Accept/report/save/return request immediate consistent snapshots.
  Save failures remain visible and prevent Save & return from claiming success.
- Hydration restores class getters, shared references, heat, damage, trips,
  pump/shaft inertia, fuel, dispatch and pool/transfer records. Existing sampled
  rotor strength/grace are preserved. Do not regenerate them during restore.
- JSON export/import is available. Import validates the complete bundle and
  replaces the career. Unknown save versions are rejected; there is no version
  migration runner or automatic fallback/recovery UI for the previous revision.
- Career history contains mission reports and achievements. Separate archived
  bankrupt/finished companies, profiles, company naming, difficulty choices and
  restart checkpoints are not implemented. Starting another career replaces the
  one local slot after the explicit replacement action in its introduction.
- Reset demo is blocked in Career. A melted career can be inspected/exported and
  saved/left, then explicitly replaced with a new career. Terminal closeout,
  bankruptcy and an end-of-career debrief still need implementation.
- Fuel/pool saves preserve today's representative visual transfer. They are not
  an authoritative purchase/service/transport ledger. Start can cancel a transfer
  before a sample is deposited. Resolve this before charging for replacement or
  awarding a fuel-logistics mission; see the product plan's Career batch proposal.
- No incident director, seeded campaign randomness, repair invoices, paid fuel,
  contracted export model, premium, credit facility or economic failure exists.
  Debug scenario controls and fuel acceleration are still available in Career;
  gate their economic effects before releasing monetary contracts.

## Adding missions without resetting careers

Keep permanent semantic IDs; `order` controls presentation/selection, not saved
identity. `requires` and `grants` are capability arrays. Definitions are copied
into issued assignments, so changing a catalogue entry does not rewrite an
issued brief, objective or earned goal. `reconcile()` retains current work and,
when it ends, selects eligible unseen IDs in order. A newly inserted mission can
therefore be issued as catch-up work without revoking earlier capabilities.
Messages and achievements use stable IDs to avoid duplicates.

For an extension:

1. Add a definition and reachable prerequisites; validate missing dependencies,
   duplicate IDs and cycles. Preserve completed/ready/active instances.
2. When adding an objective other than `generation-hold`, extend evaluation,
   catalogue validation, saved-assignment validation and UI progress rendering
   together. Retain support for the saved version-1 hold definitions.
3. Add any new plant/economy/receipt fields to the explicit serializer and a
   tested version-1-to-new-schema migration. The current loader does not fill
   missing fields or migrate them automatically.
4. Update commissioning-specific UI copy, including the fixed two-assignment
   introduction and “Both reports” completion wording. Adding a definition alone
   does not make pump tests, paid contracts or fuel goals operational.
5. Test insertion before issuance, during active/ready work and after completion;
   require old goals/capabilities to survive and rewards/receipts to occur once.

Content-version metadata is currently bookkeeping, not an automatic migration
engine. Explicit retirement/supersession, applicability variants, alternative
prerequisites and revised economy terms need their own implementation and tests.

## Next game-development slice

Continue Phase 0 economy feasibility alongside the Phase 2 implementation in
[GAMEPLAY-PLAN.md](../GAMEPLAY-PLAN.md). The measured 200 MW startup works; paid
dispatch response envelopes and economic balance have not yet been calibrated.

1. Measure healthy gross-output response across raise/lower requests under the
   current 45/60-ready-second dispatcher cadence. Define a reachable scoring
   envelope before promises, deadlines or non-delivery charges are enabled.
2. Implement and persist a separate fictional-credit ledger and settlement
   quantities. Gross electrical readings/targets stay unchanged. Prove the
   auxiliary-load deduction, MW-seconds/MWh conversion, interval boundaries,
   bounded premium and duplicate-payment protection.
3. Implement grid-contract objective evidence and the next company assignment,
   preserving existing careers through a tested migration.
4. Extend to pump acceptance tests, assigned mechanical defects, priced work
   orders and return-to-service evidence. Apply one host-side guard/event path
   to desktop, component and companion commands.
5. Add due invoices, limited credit, visible warnings and terminal bankruptcy/
   plant-loss closeout. Preserve heat, trips, damage and explicit operator control.
6. Add fuel tasks using authoritative representative business batches; full
   physical inventory/crane-owned fuel is a later independent expansion.

Keep free operation unchanged. Do not invent another simulation, require the
Pörssiohjain backend, add accounts/cloud mail, or implement full physical fuel
handling just to deliver this first financial/mission loop.

## Verification and branch policy

For game work, from the root:

```sh
node --test test/nuclear-power-game.test.mjs test/nuclear-power-grid.test.mjs
npm run build
npm run test:browser:game
```

Use `npm run test:browser:companion` for session/shared-control changes and
`npm run test:browser:equipment` for equipment interaction changes. Run the full
`npm test` and `npm run test:browser` for broad integration/release gates. Do not
replay the full suite for documentation-only changes.

The previous implementation baseline (2026-11-12) passed 141 unit/model/session
tests, the full browser regression, focused game and companion checks, the build,
both Docker image builds and container smoke checks. Historical counts in older
feature plans describe those earlier tasks rather than the current test total.

| Workflow source | Result |
| --- | --- |
| Push to `main` | Tests/build/browser checks only; no image push |
| Push to `production` | Same checks, then both amd64/arm64 images published after success |
| Manual run on `main` / `production` | Same branch-specific policy |
| Pull request or another branch | No automatic pull-request runs; other branches do not run the test/publish jobs |

Images are `ghcr.io/norkator/nuclear:latest` and
`ghcr.io/norkator/nuclear-backend:latest`. The public origin remains
`https://nuclear.porssiohjain.fi`. Publishing does not deploy the running service.
