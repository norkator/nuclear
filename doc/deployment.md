<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Hosting and deployment

Run all commands from the repository root. For local Vite and relay development,
see [the development guide](development.md).

## Companion console and Docker session backend

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

## Standalone frontend and release images

From the repository root:

```sh
docker build -t nuclear .
docker run --rm -p 127.0.0.1:8080:80 nuclear
```

The runtime is Nginx on port 80 serving static files, including bundled CC0 Kenney
UI Audio under `public/audio/nuclear-power/kenney-ui/` and Interface Sounds under
`public/audio/nuclear-power/kenney-interface/`, each with its original license and
source record.
It needs no environment variables, API proxy, database, or Java runtime.

`.github/workflows/nuclear-container.yml` runs the unit tests, production build,
Chrome regression and companion pairing checks on `main` and `production` pushes.
Only `production` publishes both `linux/amd64` and `linux/arm64` images after
those checks succeed. Manual runs follow the same branch policy; pull requests
do not trigger runs:

```text
ghcr.io/norkator/nuclear:latest
ghcr.io/norkator/nuclear-backend:latest
```

Use the [companion Compose setup](#companion-console-and-docker-session-backend)
to deploy both images and point your HTTPS reverse proxy at its frontend port
8080. The standalone frontend image remains usable on its own. DNS, TLS, and the
running deployment are configured separately; the workflow builds and publishes
images. The desktop link opens `https://nuclear.porssiohjain.fi`.

See [the feature specification](nuclear-power.md) for the simulation rules,
interlocks and future physical-model work. The repository's [license](../LICENSE)
also applies to this app; bundled third-party audio retains its CC0 license.
