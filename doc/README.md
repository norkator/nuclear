<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Documentation index

Start with the [project README](../README.md) for a quick introduction. Codex
instructions live in the root [AGENTS.md](../AGENTS.md), which directs each task
to the relevant documents here.

Commands and code paths in these documents refer to the repository root unless
stated otherwise. Markdown links are relative to the document containing them.

## Using and developing the app

| Document | Covers |
| --- | --- |
| [Control-room guide](control-room-guide.md) | Operating controls, careers, equipment, maintenance, fuel, audio and companion screens. |
| [Development and verification](development.md) | Local setup, Android bundle/audio checks, companion relay, model/browser tests, diagnostics and branch policy. |
| [Hosting and deployment](deployment.md) | Docker Compose, published images, HTTPS proxies, WebSocket configuration and server updates. |
| [Plant specification](nuclear-power.md) | Current plant behavior, interlocks, model boundaries, code ownership and future physical-model work. |
| [Game-development handoff](game-development.md) | Current playable assignments, save contract and migrations, code map, known gaps and next implementation slice. |
| [Search visibility](SEO.md) | Landing pages and guides, metadata, crawl files, verification and Search Console steps. |

The control-room, development and deployment guides retain the detailed material
previously held in the root README.

## Feature plans and checkpoints

These documents include planned work and historical verification. Use the current
plant specification and game-development handoff to establish what is implemented.

| Document | Covers |
| --- | --- |
| [Company-game plan](GAMEPLAY-PLAN.md) | Product direction, progression, future economy, mission authoring and delivery phases. |
| [Assignment expansion](ASSIGNMENT-EXPANSION-PLAN.md) | Sixteen-assignment continuation, saved grid/fuel/incident evidence and further campaign ideas. |
| [Compact landscape layout plan](MOBILE-LANDSCAPE-PLAN.md) | Phone/tablet/small-window layout, drawers, station navigation, pinch zoom, native fullscreen and verification checkpoints. |
| [Equipment-station plan](EQUIPMENT-STATIONS-PLAN.md) | Dedicated 3D stations, routing, controls, visibility, lifecycle and ambience. |
| [Electrical-grid plan](ELECTRICAL-GRID-PLAN.md) | Electrical station, supply controls, startup requirements and verification checkpoint. |
| [Fuel-handling plan](FUEL-HANDLING-PLAN.md) | Representative crane transfers, pool handling, implementation checkpoint and future inventory work. |
| [Cooling-tower checkpoint](COOLING-TOWER-PLAN.md) | Tower geometry, cooling-water routes, actual-state plume and focused checks. |

## Audio records

Audio notes and attribution records stay with the bundled assets, alongside their
existing licenses. They are the exception to keeping project documentation here.

- [Equipment-station ambience](../public/audio/nuclear-power/stations/README.md)
- [Plant operating-state sounds](../public/audio/nuclear-power/plant-state/README.md)
- [Diesel generator sounds](../public/audio/nuclear-power/diesel/README.md)
- [Kenney UI Audio sources and CC0 attribution](../public/audio/nuclear-power/kenney-ui/SOURCES.md)
- [Kenney Interface Sounds sources and CC0 attribution](../public/audio/nuclear-power/kenney-interface/SOURCES.md)
