<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Nuclear Power

A fictional nuclear power plant control room that runs in your browser. Operate a
two-loop reactor, manage its equipment and respond to changing plant conditions.
The interface is in English and supports dark and light themes.

**[Open Nuclear Power](https://nuclear.porssiohjain.fi)**

## What you can do

- Run the plant freely with automatic or manual controls.
- Inspect 3D equipment, handle maintenance and manage fuel replacement.
- Start a saved career with eight operations and maintenance assignments. Easy
  allows Auto or Manual; Hard uses Manual only.
- Pair a tablet or another browser as a companion control screen.

All plant readings and commands are simulated in the desktop browser. Free
operation resets on reload; careers save locally and never advance offline.
Electricity trading and company finances are planned features.

## Run locally

Use Node.js 22.12+ (or Node.js 24) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:5174](http://localhost:5174). For companion screens, also run
`npm run start:sessions` in a separate terminal, then use **Connect screen** in
the desktop console. See the [development guide](doc/development.md) for testing
and the local relay setup.

## Run with Docker

```sh
docker compose up -d --build
```

Open [localhost:8080](http://localhost:8080). This starts the frontend and companion
relay. See [hosting and deployment](doc/deployment.md) for published images,
server updates and HTTPS reverse-proxy setup.

## Documentation

- [Control-room guide](doc/control-room-guide.md): controls, careers, equipment
  and companion screens.
- [Development and verification](doc/development.md): setup, tests and branch policy.
- [Hosting and deployment](doc/deployment.md): Docker, relay and reverse proxies.
- [Documentation index](doc/README.md): plant specifications, implementation
  handoffs, feature plans and audio records.

Codex repository instructions live in [AGENTS.md](AGENTS.md), which points to the
documentation needed for each area of work.

## License

This project uses the [Pörssiohjain Personal Use License v1.0](LICENSE).
Bundled Kenney audio retains its original CC0 licenses and attribution records.
