/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createSessionServer } from '../server/session-server.mjs';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { captureSessionState, restoreSessionState, remoteSimulation } from '../src/simulation/nuclear-power-session-state.js';
import { applySessionCommand, validSessionCommand, freshSessionCommand } from '../src/simulation/nuclear-power-session-protocol.js';

test('companion state restores readings, interlocks and class getters without running a second clock', () => {
    const host = new NuclearPowerSimulation();
    host.togglePump('A'); host.togglePump('B');
    for (let i = 0; i < 80; i++) host.tick(.25);
    host.start();
    for (let i = 0; i < 200; i++) host.tick(.25);
    host.setRodOverride('CR-01', true);
    host.condition.zones[0].damage = .25;
    const copy = restoreSessionState(captureSessionState(host));
    assert.deepEqual(copy.readings(), host.readings());
    assert.deepEqual(copy.startupReadiness(), host.startupReadiness());
    assert.deepEqual(copy.tripRecovery(), host.tripRecovery());
    assert.deepEqual(copy.components.turbineReadiness(), host.components.turbineReadiness());
    assert.equal(copy.fuel.capability, host.fuel.capability);
    assert.equal(copy.condition.coreDamage, .25);
    assert.equal(copy.components.sim, copy);
    assert.equal(copy.condition.pipes, copy.hydraulics.pipes);
    assert.equal(copy.components.items.turbine.integrity, copy.components.turbineIntegrity);
    const sent = [];
    const remote = remoteSimulation(copy, command => { sent.push(command); return true; });
    remote.tick(1); remote.reset(); remote.trip(); remote.togglePump('A2'); remote.setPumpSpeed('A', 60);
    assert.equal(copy.elapsed, host.elapsed);
    assert.equal(copy.tripped, false);
    assert.equal(copy.pumpA2, false);
    assert.deepEqual(sent, [{ method: 'trip', args: [] }, { method: 'setPumpEnabled', args: ['A2', true] }, { method: 'setPumpSpeed', args: ['A', 60] }]);
    host.trip();
    assert.equal(restoreSessionState(captureSessionState(host), copy), copy);
    assert.equal(remote.tripped, true);
    assert.equal(remote.supply.gridAvailable, host.supply.gridAvailable);
    assert.doesNotThrow(() => remote.components.turbineReadiness());
});

test('remote commands preserve model ownership, trip latches and absolute pump state', () => {
    const sim = new NuclearPowerSimulation();
    const apply = (method, ...args) => applySessionCommand(sim, { method, args });
    apply('start'); assert.equal(sim.running, false);
    apply('setPumpEnabled', 'A', true); apply('setPumpEnabled', 'A', true);
    assert.equal(sim.pumpA, true);
    apply('setPumpEnabled', 'B', true);
    for (let i = 0; i < 100; i++) sim.tick(.25);
    apply('start'); assert.equal(sim.running, true);
    apply('setRod', 'CR-01', 0); assert.equal(sim.controlRods[0].manualOverride, false);
    apply('trip'); assert.equal(sim.tripped, true);
    apply('setAutoMode', true); apply('start');
    assert.equal(sim.tripped, true); assert.equal(sim.running, false);
    assert.equal(apply('reset'), false);
    assert.equal(apply('constructor'), false);
    assert.equal(apply('__proto__'), false);
    for (const command of [null, {}, { method: 'trip', args: ['reason'] }, { method: 'setPumpEnabled', args: ['C', true] }, { method: 'setElectricalTarget', args: [NaN] }, { method: 'setAutoMode', args: ['true'] }, { method: 'setComponentSetting', args: ['turbine', '__proto__', 1] }]) assert.equal(validSessionCommand(command), false);
});

test('the desktop rejects delayed commands after suspension using its own two clock stamps', () => {
    const message = { hostClock: 10_000, hostMonotonic: 5000 };
    assert.equal(freshSessionCommand(message, 10_500, 5500), true);
    assert.equal(freshSessionCommand(message, 14_000, 9000), false);
    assert.equal(freshSessionCommand(message, 14_000, 5500), false);
    assert.equal(freshSessionCommand(message, 10_500, 9000), false);
    assert.equal(freshSessionCommand(message, 9000, 5500), false);
    assert.equal(freshSessionCommand({}, 10_500, 5500), false);
});

test('remote fuel replacement requires the desktop console action and never renews the companion copy', () => {
    const host = new NuclearPowerSimulation();
    const copy = restoreSessionState(captureSessionState(host));
    const sent = [];
    const remote = remoteSimulation(copy, command => { sent.push(command); return true; });
    remote.replaceFuel('FA-17'); remote.replaceAllFuel();
    assert.deepEqual(sent, [{ method: 'replaceFuel', args: ['FA-17'] }, { method: 'replaceAllFuel', args: [] }]);
    assert.deepEqual(copy.fuel.assemblies, host.fuel.assemblies);
    // Model-only application would bypass the console's pool-capacity check and crane.
    for (const command of sent) assert.equal(applySessionCommand(host, command), false);
    assert.deepEqual(copy.fuel.assemblies, host.fuel.assemblies);
    for (const id of ['FA-01', 'FA-17', 'FA-49']) assert.equal(validSessionCommand({ method: 'replaceFuel', args: [id] }), true);
    for (const args of [[], ['FA-00'], ['FA-50'], ['CR-01'], [null], ['FA-17', true]]) {
        assert.equal(validSessionCommand({ method: 'replaceFuel', args }), false);
    }
    assert.equal(validSessionCommand({ method: 'replaceAllFuel', args: [true] }), false);
});

async function relay(t, options = {}) {
    const service = createSessionServer(options);
    await new Promise((resolve, reject) => { service.server.once('error', reject); service.server.listen(0, '127.0.0.1', resolve); });
    t.after(() => service.close());
    const origin = `http://127.0.0.1:${service.server.address().port}`;
    async function client(browserOrigin = origin) {
        const socket = new WebSocket(origin.replace('http', 'ws') + '/session', { origin: browserOrigin });
        const messages = [];
        const waiters = [];
        socket.on('message', data => {
            const message = JSON.parse(data.toString()); messages.push(message);
            for (const waiter of [...waiters]) if (waiter.predicate(message)) { waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(message); }
        });
        await once(socket, 'open');
        return { socket, messages, send: message => socket.send(JSON.stringify(message)), next(type, predicate = () => true) {
            const existing = messages.find(message => message.type === type && predicate(message));
            if (existing) return Promise.resolve(existing);
            return new Promise((resolve, reject) => {
                const waiter = { predicate: message => message.type === type && predicate(message), resolve };
                waiter.timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error(`Missing ${type}: ${JSON.stringify(messages)}`)); }, 3000);
                waiters.push(waiter);
            });
        } };
    }
    async function host() { const connection = await client(); connection.send({ type: 'host' }); return { ...connection, info: await connection.next('hosted') }; }
    async function join(code) { const connection = await client(); connection.send({ type: 'join', code }); return connection; }
    return { ...service, origin, client, host, join };
}

test('an explicit public origin supports a proxy-rewritten Host without allowing other origins', async t => {
    const publicOrigin = 'https://nuclear.example.test';
    const service = await relay(t, { allowedOrigins: [publicOrigin] });
    const host = await service.client(publicOrigin);
    host.send({ type: 'host' });
    assert.ok((await host.next('hosted')).code);
    const status = await new Promise((resolve, reject) => {
        const socket = new WebSocket(service.origin.replace('http', 'ws') + '/session', { origin: 'https://other.example.test' });
        socket.on('error', reject);
        socket.on('open', () => { socket.close(); reject(new Error('Unexpected origin accepted')); });
        socket.on('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); });
    });
    assert.equal(status, 403);
});

test('WebSocket pairing isolates sessions, authorizes roles and acknowledges commands without replay', async t => {
    const service = await relay(t);
    const a = await service.host(), b = await service.host();
    assert.notEqual(a.info.code, b.info.code);
    a.send({ type: 'state', state: { elapsed: 17 }, hostActive: true });
    b.send({ type: 'state', state: { elapsed: 91 }, hostActive: true });
    const screen = await service.join(a.info.code);
    const credentials = await screen.next('joined');
    assert.ok(credentials.deviceToken);
    const state = await screen.next('state'); assert.equal(state.state.elapsed, 17);
    screen.send({ type: 'command', generation: 0, id: 'pump-on', revision: state.revision, command: { method: 'setPumpEnabled', args: ['A', true] } });
    const command = await a.next('command');
    assert.deepEqual(command.command, { method: 'setPumpEnabled', args: ['A', true] });
    assert.equal(b.messages.some(message => message.type === 'command'), false);
    a.send({ type: 'result', id: command.id, accepted: true });
    assert.equal((await screen.next('result')).accepted, true);
    screen.send({ type: 'command', generation: 0, id: 'pump-on', revision: state.revision, command: command.command });
    screen.send({ type: 'state', state: { elapsed: 999 }, hostActive: true });
    await screen.next('error');
    assert.equal(a.messages.filter(message => message.type === 'command').length, 1);
    assert.equal(service.rooms.get(a.info.roomId).state.elapsed, 17);
    const intruder = await service.client();
    intruder.send({ type: 'resume-host', roomId: a.info.roomId, ownerToken: 'wrong' });
    await intruder.next('error');
    intruder.send({ type: 'resume-device', roomId: credentials.roomId, deviceId: credentials.deviceId, deviceToken: 'wrong' });
    assert.ok((await intruder.next('error')).message);
});

test('expired codes, stale readings and revoked device credentials cannot operate a desktop', async t => {
    let clock = Date.now();
    const service = await relay(t, { now: () => clock, pairingLifetime: 5000 });
    const host = await service.host();
    host.send({ type: 'state', state: { elapsed: 1 }, hostActive: true });
    const screen = await service.join(host.info.code);
    const joined = await screen.next('joined');
    const state = await screen.next('state');
    clock += 6000;
    const late = await service.join(host.info.code);
    await late.next('error');
    screen.send({ type: 'command', generation: 0, id: 'stale', revision: state.revision, command: { method: 'start', args: [] } });
    assert.equal((await screen.next('result')).accepted, false);
    assert.equal(host.messages.some(message => message.type === 'command'), false);
    host.send({ type: 'revoke-devices' }); await screen.next('ended');
    const revoked = await service.client();
    revoked.send({ type: 'resume-device', roomId: joined.roomId, deviceId: joined.deviceId, deviceToken: joined.deviceToken });
    await revoked.next('error');
    assert.equal(service.rooms.get(host.info.roomId).devices.size, 0);
});

test('a dropped host can resume its room; screens remain locked until fresh host readings', async t => {
    const service = await relay(t);
    const host = await service.host();
    host.send({ type: 'state', state: { elapsed: 8 }, hostActive: true });
    const screen = await service.join(host.info.code); await screen.next('joined');
    const state = await screen.next('state');
    host.socket.close(); await once(host.socket, 'close');
    await screen.next('presence', message => !message.hostOnline);
    screen.send({ type: 'command', generation: 0, id: 'offline', revision: state.revision, command: { method: 'trip', args: [] } });
    assert.equal((await screen.next('result')).accepted, false);
    const resumed = await service.client();
    resumed.send({ type: 'resume-host', roomId: host.info.roomId, ownerToken: host.info.ownerToken });
    assert.equal((await resumed.next('hosted')).roomId, host.info.roomId);
    resumed.send({ type: 'state', state: { elapsed: 9 }, hostActive: true });
    await screen.next('state', message => message.state.elapsed === 9);
    assert.equal(resumed.messages.some(message => message.type === 'command'), false);
    resumed.send({ type: 'end' }); await screen.next('ended');
    assert.equal(service.rooms.size, 0);
});
