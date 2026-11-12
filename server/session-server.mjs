/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { createServer } from 'node:http';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { validSessionCommand } from '../src/simulation/nuclear-power-session-protocol.js';

const token = () => randomBytes(32).toString('base64url');
const open = socket => socket?.readyState === WebSocket.OPEN;
const send = (socket, message) => {
    if (!open(socket)) return;
    if (socket.bufferedAmount > 2 * 1024 * 1024) { socket.close(1013, 'Connection too slow'); return; }
    socket.send(JSON.stringify(message));
};

export function createSessionServer({ pairingLifetime = 10 * 60_000, hostGrace = 30_000,
    maxRooms = 100, maxDevices = 8, allowedOrigins = [], now = Date.now, httpServer } = {}) {
    const rooms = new Map();
    const attempts = new Map();
    const server = httpServer || createServer((request, response) => {
        response.writeHead(request.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(request.url === '/health' ? { status: 'ok' } : { error: 'Not found' }));
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false });
    server.on('upgrade', (request, socket, head) => {
        let allowed = false;
        try { allowed = new URL(request.headers.origin).host === request.headers.host || allowedOrigins.includes(request.headers.origin); } catch { /* Require an explicit browser origin. */ }
        if (!allowed || request.url !== '/session' || wss.clients.size >= maxRooms * (maxDevices + 1)) {
            socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
        }
        wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client, request));
    });
    const error = (socket, message) => send(socket, { type: 'error', message });
    const status = room => {
        const devices = [...room.devices.values()].filter(device => open(device.socket));
        const message = { type: 'presence', hostOnline: open(room.host), devices: devices.length, activeDevices: devices.filter(device => device.active).length };
        send(room.host, message);
        for (const device of room.devices.values()) send(device.socket, message);
    };
    const removeRoom = room => {
        rooms.delete(room.id);
        for (const device of room.devices.values()) {
            send(device.socket, { type: 'ended', message: 'Desktop session ended. Pair with the desktop again.' });
            device.socket?.close(1000, 'Session ended');
        }
    };
    const pairing = room => {
        do { room.code = String(randomInt(10_000_000, 100_000_000)); }
        while ([...rooms.values()].some(other => other !== room && other.code === room.code));
        room.expiresAt = now() + pairingLifetime;
        send(room.host, { type: 'hosted', roomId: room.id, ownerToken: room.ownerToken, code: room.code, expiresAt: room.expiresAt });
    };

    wss.on('connection', (socket, request) => {
        socket.on('error', () => {});
        const authenticationTimeout = setTimeout(() => { if (!socket.roomId) socket.close(1008, 'Pairing timeout'); }, 15_000);
        socket.alive = true;
        socket.on('pong', () => { socket.alive = true; });
        const address = request.socket.remoteAddress;
        let messageCount = 0, windowStart = now();
        socket.on('message', (data, binary) => {
            if (now() - windowStart >= 1000) { windowStart = now(); messageCount = 0; }
            if (++messageCount > 40 || binary) { socket.close(1008, 'Message limit'); return; }
            let message;
            try { message = JSON.parse(data.toString()); } catch { error(socket, 'Invalid message.'); return; }
            if (!message || typeof message !== 'object') return;
            const room = rooms.get(socket.roomId);
            if (message.type === 'host' && !socket.roomId) {
                if (rooms.size >= maxRooms) { error(socket, 'Server is full. Try again later.'); return; }
                const created = { id: randomUUID(), ownerToken: token(), host: socket, devices: new Map(), revision: 0, state: null, lastState: 0, pending: new Map() };
                rooms.set(created.id, created); socket.roomId = created.id; socket.host = true;
                pairing(created); status(created); return;
            }
            if (message.type === 'resume-host' && !socket.roomId) {
                const previous = rooms.get(message.roomId);
                if (!previous || previous.ownerToken !== message.ownerToken || open(previous.host)) { error(socket, 'Desktop session is no longer available.'); return; }
                previous.host = socket; previous.disconnectedAt = null;
                socket.roomId = previous.id; socket.host = true;
                send(socket, { type: 'hosted', roomId: previous.id, ownerToken: previous.ownerToken, code: previous.code, expiresAt: previous.expiresAt });
                status(previous); return;
            }
            if (message.type === 'join' && !socket.roomId) {
                let budget = attempts.get(address);
                if (!budget || now() - budget.since > 60_000) { budget = { count: 0, since: now() }; attempts.set(address, budget); }
                if (++budget.count > 12) { error(socket, 'Too many pairing attempts. Wait a minute.'); return; }
                const selected = [...rooms.values()].find(candidate => candidate.code === message.code && candidate.expiresAt > now() && open(candidate.host));
                if (!selected) { error(socket, 'Pairing code is invalid, expired or the desktop is offline.'); return; }
                if (selected.devices.size >= maxDevices) { error(socket, 'Screen limit reached. Disconnect screens from the desktop.'); return; }
                const device = { id: randomUUID(), token: token(), socket, seen: new Set(), active: false };
                selected.devices.set(device.id, device); socket.roomId = selected.id; socket.deviceId = device.id;
                send(socket, { type: 'joined', roomId: selected.id, deviceId: device.id, deviceToken: device.token });
                if (selected.state) send(socket, { type: 'state', revision: selected.revision, state: selected.state, hostActive: selected.hostActive });
                status(selected); return;
            }
            if (message.type === 'resume-device' && !socket.roomId) {
                const selected = rooms.get(message.roomId), device = selected?.devices.get(message.deviceId);
                if (!device || device.token !== message.deviceToken) { error(socket, 'Screen access expired. Enter a new pairing code.'); return; }
                device.socket?.close(1000, 'Screen reconnected'); device.socket = socket;
                socket.roomId = selected.id; socket.deviceId = device.id;
                send(socket, { type: 'joined', roomId: selected.id, deviceId: device.id, deviceToken: device.token });
                if (selected.state) send(socket, { type: 'state', revision: selected.revision, state: selected.state, hostActive: selected.hostActive });
                status(selected); return;
            }
            if (!room) { error(socket, 'Pair with a desktop session first.'); return; }
            if (socket.host && room.host === socket) {
                if (message.type === 'state' && message.state && typeof message.state === 'object') {
                    room.state = message.state; room.lastState = now(); room.revision++; room.hostActive = message.hostActive === true;
                    room.hostClock = message.hostClock; room.hostMonotonic = message.hostMonotonic;
                    for (const device of room.devices.values()) send(device.socket, { type: 'state', revision: room.revision, state: room.state, hostActive: room.hostActive });
                } else if (message.type === 'result' && typeof message.id === 'string') {
                    const pending = room.pending.get(message.id);
                    if (pending) { send(pending.socket, { type: 'result', id: pending.clientId, accepted: message.accepted === true }); room.pending.delete(message.id); }
                } else if (message.type === 'new-code') pairing(room);
                else if (message.type === 'end') { removeRoom(room); socket.roomId = null; socket.close(1000); }
                else if (message.type === 'revoke-devices') {
                    for (const device of room.devices.values()) { send(device.socket, { type: 'ended', message: 'Screen disconnected by desktop.' }); device.socket?.close(1000); }
                    room.devices.clear(); room.pending.clear(); pairing(room); status(room);
                }
                return;
            }
            const device = room.devices.get(socket.deviceId);
            if (!device || device.socket !== socket) return;
            if (message.type === 'activity' && typeof message.active === 'boolean') {
                if (device.active !== message.active) { device.active = message.active; status(room); }
                return;
            }
            if (message.type === 'leave') { room.devices.delete(device.id); socket.close(1000); status(room); return; }
            if (message.type !== 'command' || typeof message.id !== 'string' || message.id.length > 80 || !validSessionCommand(message.command)) { error(socket, 'Unsupported control command.'); return; }
            if (device.seen.has(message.id)) return;
            device.seen.add(message.id);
            if (device.seen.size > 256) device.seen.delete(device.seen.values().next().value);
            if (!open(room.host) || !room.hostActive || now() - room.lastState > 3000 || room.pending.size >= 64 || message.generation !== (room.state?.sessionGeneration || 0) || !Number.isInteger(message.revision) || message.revision > room.revision || room.revision - message.revision > 12) {
                send(socket, { type: 'result', id: message.id, accepted: false }); return;
            }
            const id = randomUUID();
            room.pending.set(id, { socket, clientId: message.id, expiresAt: now() + 3000 });
            send(room.host, { type: 'command', id, command: message.command, generation: message.generation, hostClock: room.hostClock, hostMonotonic: room.hostMonotonic });
        });
        socket.on('close', () => {
            clearTimeout(authenticationTimeout);
            const room = rooms.get(socket.roomId);
            if (!room) return;
            if (room.host === socket) { room.disconnectedAt = now(); room.pending.clear(); }
            status(room);
        });
    });
    const cleanup = setInterval(() => {
        for (const room of rooms.values()) {
            if (room.disconnectedAt != null && now() - room.disconnectedAt > hostGrace) { removeRoom(room); continue; }
            for (const [id, pending] of room.pending) if (now() > pending.expiresAt) {
                send(pending.socket, { type: 'result', id: pending.clientId, accepted: false }); room.pending.delete(id);
            }
        }
        for (const [address, budget] of attempts) if (now() - budget.since > 60_000) attempts.delete(address);
    }, 1000);
    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (!socket.alive) { socket.terminate(); continue; }
            socket.alive = false; socket.ping();
        }
    }, 10_000);
    server.on('close', () => { clearInterval(cleanup); clearInterval(heartbeat); });
    return { server, wss, rooms, async close() {
        for (const socket of wss.clients) socket.terminate();
        wss.close();
        await new Promise(resolve => server.close(resolve));
    } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const service = createSessionServer({ allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
    const port = Number(process.env.PORT || 8081);
    service.server.listen(port, '0.0.0.0', () => console.log(`Nuclear session relay listening on ${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => service.close().then(() => process.exit(0)));
}
