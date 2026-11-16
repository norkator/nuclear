/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { poweredSimulation } from './plant-fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlantAudio, plantSoundState } from '../src/simulation/nuclear-power-audio.js';
import { NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { STATION_SOUNDS, stationSoundState } from '../src/simulation/nuclear-power-station-audio.js';

class Param {
    value = 0;
    events = [];
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
    setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); }
}

class Node {
    frequency = new Param();
    gain = new Param();
    playbackRate = new Param();
    Q = new Param();
    connections = [];
    stops = [];
    connect(target) { this.connections.push(target); }
    disconnect() { this.disconnected = true; this.connections = []; }
    start(time, offset = 0) { this.started = true; this.startTime = time; this.offset = offset; }
    stop(time) { this.stops.push(time); }
}

class Context {
    state = 'running';
    currentTime = 10;
    destination = {};
    created = [];
    createOscillator() { const node = new Node(); this.created.push(node); return node; }
    createBufferSource() { const node = new Node(); this.created.push(node); return node; }
    async decodeAudioData(data) { return { duration: 0.32, data }; }
    createGain() { const node = new Node(); this.created.push(node); return node; }
    createBiquadFilter() { const node = new Node(); this.created.push(node); return node; }
}

const loadStation = (audio, scene) => audio.preloadStation(scene, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));

test('station sounds use actual selected equipment, circulation and rack fans without advancing the plant', () => {
    const sim = poweredSimulation();
    assert.equal(stationSoundState(sim, 'computers').activity, sim.computers.fanSpeed / 100);
    for (const scene of ['pumps', 'exchanger', 'turbine', 'condenser']) assert.equal(stationSoundState(sim, scene).activity, 0);
    sim.autoElectricalTarget = 650; sim.pumpB2Speed = 100;
    sim.components.items.exchanger.settings.secondaryValve = 100;
    assert.equal(stationSoundState(sim, 'pumps', 'pumpB2').activity, 0, 'Requested speed cannot spin a silent actual motor');
    Object.assign(sim.components.items.pumpB2.actual, { speed: 60, flow: 0 });
    const motor = stationSoundState(sim, 'pumps', 'pumpB2');
    assert.equal(motor.activity, .6); assert.equal(motor.cutoff, 350);
    assert.equal(stationSoundState(sim, 'pumps', 'pumpA').activity, 0, 'A backup never borrows another pump reading');
    sim.components.items.pumpB2.actual.flow = 60;
    assert.ok(stationSoundState(sim, 'pumps', 'pumpB2').cutoff > motor.cutoff, 'Actual water flow opens the water texture');
    sim.components.items.turbine.actual.shaftSpeed = 80;
    assert.equal(stationSoundState(sim, 'turbine').activity, .8, 'Stopped generation retains actual shaft coast-down');
    sim.primaryFlow = 100;
    sim.components.items.exchanger.settings.bypass = 100;
    assert.equal(stationSoundState(sim, 'exchanger').activity, 1, 'Requested bypass cannot replace actual valve position');
    sim.components.items.exchanger.actual.bypass = 100;
    assert.equal(stationSoundState(sim, 'exchanger').activity, 0);
    sim.secondaryFlow = 70; sim.secondaryTemperature = 180;
    assert.ok(stationSoundState(sim, 'condenser').activity > 0);
    sim.components.items.condenser.actual.coolingFactor = 0;
    assert.equal(stationSoundState(sim, 'condenser').activity, 0);
    sim.computers.fanSpeed = 0; sim.computers.source = 'OFF';
    assert.equal(stationSoundState(sim, 'computers').activity, 0);
    const before = sim.snapshot();
    for (const scene of STATION_SOUNDS) stationSoundState(sim, scene, 'pumpB2');
    assert.deepEqual(sim.snapshot(), before);
});

test('station assets load once per selected room and cannot play on decode completion', async () => {
    const audio = new PlantAudio(new Context()), paths = [];
    assert.equal(audio.stationBuffers.size, 0);
    const fetcher = async path => { paths.push(path); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; };
    await audio.preloadStation('computers', fetcher); await audio.preloadStation('computers', fetcher);
    assert.deepEqual(paths, ['/audio/nuclear-power/stations/computers-loop.wav']);
    assert.equal(audio.stationStates.get('computers'), 'ready');
    assert.equal(audio.nodes.size, 0);
    assert.equal(audio.stationStates.has('turbine'), false, 'Inactive rooms are not downloaded');
    await audio.preloadStation('invalid', fetcher);
    assert.equal(paths.length, 1);
});

test('one station voice follows tab/pump selection, bounded actual speed, and cleans all filter nodes', async () => {
    const context = new Context(), audio = new PlantAudio(context), sim = poweredSimulation();
    for (const scene of STATION_SOUNDS) await loadStation(audio, scene);
    Object.assign(sim, { primaryFlow: 100, secondaryFlow: 100, secondaryTemperature: 190 });
    sim.components.items.turbine.actual.shaftSpeed = 100;
    sim.components.items.pumpA.actual.speed = 70; sim.components.items.pumpB2.actual.speed = 50;
    const before = sim.snapshot();
    let previous;
    for (const scene of STATION_SOUNDS) {
        audio.updateScene(sim, scene);
        if (previous) assert.ok(previous.oscillator.disconnected && previous.filter.disconnected && previous.gain.disconnected);
        assert.equal(audio.nodes.size, 1);
        const voice = [...audio.nodes][0];
        assert.equal(voice.station, scene); assert.equal(voice.oscillator.loop, true);
        assert.ok(voice.target > 0 && voice.target <= .08);
        assert.ok(voice.oscillator.playbackRate.value >= .55 && voice.oscillator.playbackRate.value <= 1.2);
        const created = context.created.length;
        for (let i = 0; i < 20; i++) audio.updateScene(sim, scene);
        assert.equal(context.created.length, created, 'Repeated updates reuse one source/filter/gain');
        previous = voice;
    }
    audio.updateScene(sim, 'pumps'); const a = [...audio.nodes][0];
    audio.updateScene(sim, 'pumps', { pumpId: 'pumpB2' });
    assert.ok(a.oscillator.disconnected && a.filter.disconnected);
    assert.equal([...audio.nodes][0].equipment, 'pumpB2');
    assert.equal(sim.running, false);
    sim.components.items.pumpB2.actual.speed = 0;
    audio.updateScene(sim, 'pumps', { pumpId: 'pumpB2' }); assert.equal(audio.nodes.size, 0);
    sim.components.items.pumpB2.actual.speed = 50;
    assert.deepEqual(sim.snapshot(), before);
    audio.updateScene(sim, 'computers'); const server = [...audio.nodes][0];
    audio.updateScene(sim, 'maintenance');
    assert.equal(audio.nodes.size, 0); assert.ok(server.filter.disconnected);
});

test('station ambience stops offscreen, on pause/mute cleanup and suspension while shared UI stays independent', async () => {
    const context = new Context(), audio = new PlantAudio(context), sim = poweredSimulation();
    await loadStation(audio, 'pumps'); await loadStation(audio, 'computers');
    await audio.preloadUi(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
    sim.components.items.pumpA.actual.speed = 90;
    audio.updateScene(sim, 'pumps'); const pump = [...audio.nodes][0];
    audio.cue('start'); audio.ui('on');
    assert.ok(audio.nodes.has(pump), 'Command/UI cues preserve the active component loop');
    audio.updateScene(sim, 'pumps', { visible: false });
    assert.ok(pump.oscillator.disconnected && pump.filter.disconnected && pump.gain.disconnected);
    assert.ok([...audio.nodes].some(voice => voice.ui), 'Offscreen machinery does not silence UI feedback');
    audio.stop(); audio.updateScene(sim, 'computers');
    const server = [...audio.nodes][0];
    context.state = 'suspended'; audio.updateScene(sim, 'computers');
    assert.equal(audio.nodes.size, 0); assert.ok(server.filter.disconnected);
    context.state = 'running'; audio.updateScene(sim, 'computers');
    assert.equal(audio.nodes.size, 1);
    audio.stop(); audio.stop(); assert.equal(audio.nodes.size, 0);
    assert.ok(context.created.filter(node => node.started).every(node => node.disconnected));
});

test('late or failed station loading never plays outgoing-room audio or blocks controls', async () => {
    const audio = new PlantAudio(new Context()), sim = poweredSimulation();
    let release; const gate = new Promise(resolve => { release = resolve; });
    const loading = audio.preloadStation('computers', async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; });
    audio.updateScene(sim, 'computers'); audio.updateScene(sim, 'maintenance'); audio.stop();
    release(); await loading;
    assert.equal(audio.scene, 'maintenance'); assert.equal(audio.nodes.size, 0);
    audio.updateScene(sim, 'computers', { visible: false }); assert.equal(audio.nodes.size, 0);
    audio.updateScene(sim, 'computers'); assert.equal(audio.nodes.size, 1);
    audio.stop();
    const failed = new PlantAudio(new Context());
    await failed.preloadStation('computers', async () => { throw new Error('Missing audio'); });
    failed.updateScene(sim, 'computers');
    assert.equal(failed.stationStates.get('computers'), 'unavailable'); assert.equal(failed.nodes.size, 0);
    assert.equal(sim.setComputerEnabled('serverA', false), true);
});

test('bundled station loops are quiet stereo PCM with clean seams, distinct waveforms and no silent padding', () => {
    const fingerprints = new Set();
    for (const scene of STATION_SOUNDS) {
        const wav = readFileSync(new URL(`../public/audio/nuclear-power/stations/${scene}-loop.wav`, import.meta.url));
        assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
        assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt32LE(24), 48000); assert.equal(wav.readUInt16LE(34), 16);
        assert.equal(wav.readUInt32LE(40), 8 * 48000 * 4);
        let peak = 0, squares = 0, firstWindow = 0, lastWindow = 0;
        for (let i = 44; i < wav.length; i += 2) {
            const sample = wav.readInt16LE(i); peak = Math.max(peak, Math.abs(sample)); squares += sample ** 2;
            if (i < 44 + 4800 * 4) firstWindow += sample ** 2;
            if (i >= wav.length - 4800 * 4) lastWindow += sample ** 2;
        }
        assert.ok(peak > 6000 && peak <= 16384);
        const rms = Math.sqrt(squares / ((wav.length - 44) / 2)); assert.ok(rms > 2200 && rms < 2900);
        assert.ok(Math.sqrt(firstWindow / 9600) > 1500 && Math.sqrt(lastWindow / 9600) > 1500, 'Loop endpoints have no baked-in fade or silence');
        for (let channel = 0; channel < 2; channel++) assert.ok(Math.abs(wav.readInt16LE(44 + channel * 2) - wav.readInt16LE(wav.length - 4 + channel * 2)) < 900);
        fingerprints.add(wav.subarray(44, 512).toString('base64'));
    }
    assert.equal(fingerprints.size, 5, 'Each room has its own sound design');
});

test('start and stop have distinct bounded envelopes and onended disconnects both nodes', () => {
    const context = new Context();
    const audio = new PlantAudio(context);
    for (const command of ['start', 'stop']) {
        audio.cue(command);
        assert.equal(audio.hasActiveSounds, true);
        const [voice] = audio.nodes;
        const pitch = voice.oscillator.frequency.events;
        assert.equal(Math.sign(pitch[1][1] - pitch[0][1]), command === 'start' ? 1 : -1);
        assert.deepEqual(voice.gain.gain.events, [['set', 0, 10], ['ramp', 0.0004, 10.04], ['ramp', 0, 10.55]]);
        assert.deepEqual(voice.oscillator.stops, [10.6]);
        voice.oscillator.onended();
        assert.ok(voice.oscillator.disconnected && voice.gain.disconnected);
        assert.equal(audio.hasActiveSounds, false);
    }
});

test('suspended/invalid commands are discarded without replay', () => {
    const context = new Context();
    const audio = new PlantAudio(context);
    context.state = 'suspended'; audio.cue('start');
    assert.equal(context.created.length, 0);
    context.state = 'running'; audio.cue('blocked');
    assert.equal(context.created.length, 0);
    assert.equal(audio.hasActiveSounds, false);
});

test('repeated command cues do not stack and mute stops all voices', () => {
    const context = new Context();
    const audio = new PlantAudio(context);
    assert.equal(audio.hasActiveSounds, false);
    audio.cue('start'); audio.cue('stop');
    assert.equal(audio.nodes.size, 1);
    audio.stop(); audio.stop();
    assert.equal(audio.nodes.size, 0);
    for (const node of context.created) {
        assert.equal(node.disconnected, true);
        if (node.started) assert.ok(node.stops.includes(undefined));
    }
});

const loadPlant = audio => audio.preloadPlant(async () => ({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
const loadDiesels = async audio => {
    await audio.preloadDiesels(async () => ({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
    for (const [kind, buffer] of audio.dieselBuffers) buffer.duration = kind === 'startup' ? 8 : kind === 'shutdown' ? 3.2 : 12;
};

test('diesels follow actual startup, load, independent stops and fuel exhaustion', async () => {
    const audio = new PlantAudio(new Context()), sim = poweredSimulation();
    await loadDiesels(audio);
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 0);
    sim.supply.setGrid(sim, false); // Automatic eight-second startup for both engines.
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 2);
    assert.ok([...audio.nodes].every(v => v.kind === 'startup' && !v.oscillator.loop));
    const starts = [...audio.nodes];
    audio.updateScene(sim, 'reactor');
    assert.deepEqual([...audio.nodes], starts);
    sim.supply.advance(sim, 8);
    audio.updateScene(sim, 'reactor');
    assert.ok(starts.every(v => v.oscillator.disconnected));
    assert.ok([...audio.nodes].every(v => v.kind === 'running-loop' && v.oscillator.loop));
    const a = [...audio.nodes].find(v => v.diesel === 'A');
    assert.ok(a.target > .035 && a.target <= .05);
    sim.supply.setGrid(sim, true);
    audio.updateScene(sim, 'reactor');
    assert.equal(a.target, .035, 'Unloaded engines remain audible');
    sim.supply.command(sim, 'A', 'stop');
    audio.updateScene(sim, 'reactor');
    const shutdown = [...audio.nodes].find(v => v.diesel === 'A');
    assert.equal(shutdown.kind, 'shutdown');
    assert.equal(shutdown.oscillator.loop, false);
    assert.equal([...audio.nodes].find(v => v.diesel === 'B').kind, 'running-loop');
    audio.updateScene(sim, 'reactor');
    assert.ok(audio.nodes.has(shutdown));
    shutdown.oscillator.onended();
    sim.supply.command(sim, 'A', 'stop');
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 1, 'Repeated stop does not replay shutdown');
    sim.supply.generators[1].fuel = .00001;
    sim.supply.advance(sim, 1);
    audio.updateScene(sim, 'reactor');
    assert.equal([...audio.nodes][0].kind, 'shutdown');
    audio.stop();
    assert.equal(audio.nodes.size, 0);
});

test('the unified plant mixes reactor and diesel voices, and maintenance silences both without replay', async () => {
    const audio = new PlantAudio(new Context()), sim = poweredSimulation();
    await loadDiesels(audio); await loadPlant(audio);
    sim.components.items.turbine.actual.shaftSpeed = 90;
    sim.supply.command(sim, 'A', 'start'); sim.supply.advance(sim, 3);
    audio.updateScene(sim, 'reactor'); audio.cue('start');
    assert.ok([...audio.nodes].some(v => v.plant));
    assert.equal([...audio.nodes].find(v => v.diesel === 'A').oscillator.offset, 3);
    const previous = [...audio.nodes];
    audio.updateScene(sim, 'maintenance');
    assert.ok(previous.every(v => v.oscillator.disconnected));
    assert.equal(audio.nodes.size, 0);
    audio.updateScene(sim, 'reactor');
    const startup = [...audio.nodes].find(v => v.diesel === 'A');
    assert.equal(startup.oscillator.offset, 3);
    startup.oscillator.onended(); audio.updateScene(sim, 'reactor');
    assert.equal([...audio.nodes].filter(v => v.diesel).length, 0, 'Finished startup must not loop');
    audio.stop(); audio.updateScene(sim, 'reactor');
    assert.equal([...audio.nodes].find(v => v.diesel === 'A').oscillator.offset, 3);
    audio.updateScene(sim, 'maintenance'); sim.supply.advance(sim, 5);
    audio.updateScene(sim, 'reactor');
    assert.equal([...audio.nodes].find(v => v.diesel === 'A').kind, 'running-loop');
    assert.ok([...audio.nodes].some(v => v.plant));
    audio.updateScene(sim, 'maintenance'); sim.supply.command(sim, 'A', 'stop');
    audio.updateScene(sim, 'reactor');
    assert.equal([...audio.nodes].filter(v => v.diesel).length, 0, 'Off-tab shutdown must not replay');
});

test('electrical grid plays actual diesel voices only while visible and leaves UI sound available offscreen', async () => {
    const audio = new PlantAudio(new Context()), sim = poweredSimulation();
    await loadDiesels(audio); await loadPlant(audio);
    sim.supply.command(sim, 'A', 'start');
    audio.updateScene(sim, 'electrical');
    assert.equal([...audio.nodes].find(voice => voice.diesel === 'A').kind, 'startup');
    assert.ok([...audio.nodes].every(voice => !voice.plant && !voice.station));
    sim.supply.advance(sim, 8); audio.updateScene(sim, 'electrical');
    const running = [...audio.nodes].find(voice => voice.diesel === 'A');
    assert.equal(running.kind, 'running-loop');
    audio.updateScene(sim, 'electrical', { visible: false });
    assert.equal(audio.nodes.size, 0); assert.ok(running.oscillator.disconnected && running.gain.disconnected);
    audio.updateScene(sim, 'electrical');
    assert.equal([...audio.nodes].find(voice => voice.diesel === 'A').kind, 'running-loop');
    audio.updateScene(sim, 'maintenance'); assert.equal(audio.nodes.size, 0);
});

test('diesel shutdown is interrupted by restart; suspension clears all state without deferred cues', async () => {
    const context = new Context(), audio = new PlantAudio(context), sim = poweredSimulation();
    await loadDiesels(audio);
    sim.supply.command(sim, 'A', 'start');
    audio.updateScene(sim, 'reactor');
    sim.supply.command(sim, 'A', 'stop');
    audio.updateScene(sim, 'reactor');
    const shutdown = [...audio.nodes][0];
    sim.supply.command(sim, 'A', 'start');
    audio.updateScene(sim, 'reactor');
    assert.ok(shutdown.oscillator.disconnected);
    assert.equal([...audio.nodes][0].kind, 'startup');
    context.state = 'suspended';
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 0);
    sim.supply.command(sim, 'A', 'stop');
    context.state = 'running';
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 0);
});

test('late or failed diesel loads never replay shutdown or create voices by themselves', async () => {
    const audio = new PlantAudio(new Context()), sim = poweredSimulation();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const loading = audio.preloadDiesels(async () => {
        await gate; return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
    });
    sim.supply.command(sim, 'A', 'start'); audio.updateScene(sim, 'reactor');
    sim.supply.command(sim, 'A', 'stop'); audio.updateScene(sim, 'reactor');
    audio.stop(); release(); await loading;
    assert.equal(audio.nodes.size, 0);
    audio.updateScene(sim, 'reactor');
    assert.equal(audio.nodes.size, 0);
    const failed = new PlantAudio(new Context());
    await failed.preloadDiesels(async () => { throw new Error('Missing audio'); });
    assert.equal(failed.dieselState, 'unavailable');
    sim.supply.command(sim, 'A', 'start'); failed.updateScene(sim, 'reactor');
    assert.equal(failed.nodes.size, 0);
});

test('bundled diesel PCM assets have expected durations, bounded peaks and smooth endpoints', () => {
    for (const [kind, seconds] of [['startup', 8], ['running-loop', 12], ['shutdown', 3.2]]) {
        const wav = readFileSync(new URL(`../public/audio/nuclear-power/diesel/diesel-${kind}.wav`, import.meta.url));
        assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
        assert.equal(wav.readUInt16LE(22), 2);
        assert.equal(wav.readUInt32LE(24), 48000);
        assert.equal(wav.readUInt16LE(34), 16);
        assert.equal(wav.readUInt32LE(40), seconds * 48000 * 4);
        let peak = 0, squares = 0;
        for (let i = 44; i < wav.length; i += 2) {
            const sample = wav.readInt16LE(i);
            peak = Math.max(peak, Math.abs(sample)); squares += sample ** 2;
        }
        assert.ok(peak < 18100 && peak > 6000);
        assert.ok(Math.sqrt(squares / ((wav.length - 44) / 2)) > 2000);
        for (let channel = 0; channel < 2; channel++) {
            const first = wav.readInt16LE(44 + channel * 2), last = wav.readInt16LE(wav.length - 4 + channel * 2);
            if (kind === 'running-loop') assert.ok(Math.abs(first - last) < 1500);
            else assert.ok(Math.abs(first) < 20 && Math.abs(last) < 20);
        }
    }
});

test('plant audio follows actual operation and coast-down, with faults independent of acknowledgement', () => {
    const sim = poweredSimulation();
    assert.deepEqual(plantSoundState(sim), {activity:0, fault:false});
    sim.autoElectricalTarget = 400;
    assert.equal(plantSoundState(sim).activity, 0);
    sim.running = true; sim.power = 64;
    assert.equal(plantSoundState(sim).activity, .64);
    sim.components.items.turbine.actual.shaftSpeed = 80;
    sim.running = false;
    assert.equal(plantSoundState(sim).activity, .8);
    sim.condition.stage = 'STRAINED';
    sim.alarms = [{acknowledged:true}];
    assert.equal(plantSoundState(sim).fault, true);
    sim.condition.stage = 'NORMAL';
    sim.components.items.condenser.disturbance.value = .2;
    assert.equal(plantSoundState(sim).fault, true);
    sim.components.items.condenser.disturbance.value = 0;
    sim.components.items.turbine.actual.shaftSpeed = 0;
    assert.deepEqual(plantSoundState(sim), {activity:0, fault:false});
});

test('two gapless loops crossfade without stacking and command/UI cues preserve them', async () => {
    const context = new Context(), audio = new PlantAudio(context);
    await loadPlant(audio);
    audio.updatePlant({activity:0, fault:false});
    assert.equal(audio.nodes.size, 0);
    audio.updatePlant({activity:1, fault:false});
    const voices = [...audio.nodes];
    assert.equal(voices.length, 2);
    assert.ok(voices.every(v => v.oscillator.loop && v.oscillator.startTime === 10));
    const normal = voices.find(v => v.plant === 'normal'), fault = voices.find(v => v.plant === 'fault');
    assert.equal(normal.target, .10); assert.equal(fault.target, 0);
    audio.updatePlant({activity:1, fault:true});
    assert.equal(audio.nodes.size, 2);
    assert.equal(normal.target, 0); assert.equal(fault.target, .10);
    assert.deepEqual(fault.gain.gain.events.at(-1), ['target', .10, 10, .25]);
    audio.updatePlant({activity:100, fault:true});
    assert.equal(fault.target, .10);
    audio.cue('stop');
    await audio.preloadUi(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
    audio.ui('on');
    assert.ok(voices.every(v => audio.nodes.has(v) && !v.oscillator.disconnected));
    audio.updatePlant({activity:.25, fault:false});
    assert.equal(normal.target, .05); assert.equal(fault.target, 0);
    audio.stop(); audio.stop();
    assert.equal(audio.nodes.size, 0);
    assert.ok(voices.every(v => v.oscillator.disconnected && v.gain.disconnected));
});

test('silence and suspension release loops; resuming creates only one fresh pair', async () => {
    const context = new Context(), audio = new PlantAudio(context);
    await loadPlant(audio);
    for (const state of ['suspended', 'running', 'closed']) {
        context.state = state;
        audio.updatePlant({activity:.5, fault:false});
        assert.equal(audio.nodes.size, state === 'running' ? 2 : 0);
    }
    context.state = 'running';
    audio.updatePlant({activity:.5, fault:false});
    const voices = [...audio.nodes];
    audio.updatePlant({activity:0, fault:true});
    assert.equal(audio.nodes.size, 0);
    assert.ok(voices.every(v => v.oscillator.disconnected && v.gain.disconnected));
});

test('loading completes without playing late audio and failures never substitute a healthy sound', async () => {
    const context = new Context(), audio = new PlantAudio(context);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const urls = [];
    const loading = audio.preloadPlant(async url => {
        urls.push(url); await gate;
        return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
    });
    audio.updatePlant({activity:1, fault:false});
    audio.stop(); release(); await loading;
    await loadPlant(audio);
    assert.equal(urls.length, 2);
    assert.equal(audio.nodes.size, 0);
    assert.equal(context.created.length, 0);
    const failed = new PlantAudio(context);
    await failed.preloadPlant(async url => ({ok:url.includes('normal'),arrayBuffer:async()=>new ArrayBuffer(4)}));
    assert.equal(failed.plantState, 'unavailable');
    failed.updatePlant({activity:1, fault:true});
    assert.equal(context.created.length, 0);
});


test('Kenney samples preload once, play quietly without looping, and replace earlier UI voices', async () => {
    const context=new Context(), audio=new PlantAudio(context);
    const urls=[];
    const fetcher=async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
    assert.equal(audio.ui('on'),false); // Loading never queues a click for later.
    await audio.preloadUi(fetcher); await audio.preloadUi(fetcher);
    assert.equal(urls.length,3); assert.equal(audio.uiBuffers.size,3);
    assert.ok(urls.every(url=>url.startsWith('/audio/nuclear-power/kenney-ui/')));
    assert.equal(audio.ui('on'),true);
    const [first]=audio.nodes;
    assert.equal(first.oscillator.loop,false);
    assert.equal(first.gain.gain.value,0.26);
    assert.equal(audio.ui('off'),false); // Fast repeated input cannot stack clicks.
    context.currentTime+=.1;
    assert.equal(audio.ui('off'),true);
    assert.equal(audio.nodes.size,1); assert.equal(first.oscillator.disconnected,true);
    audio.stop(); assert.equal(audio.nodes.size,0);
});

test('missing sample assets fail silently and never synthesize a replacement or replay', async () => {
    const context=new Context(), audio=new PlantAudio(context);
    await audio.preloadUi(async()=>{throw new Error('unavailable');});
    assert.equal(audio.ui('adjust'),false);
    assert.equal(context.created.length,0);
});

test('finished samples disconnect and suspended contexts never play a UI click', async () => {
    const context=new Context(), audio=new PlantAudio(context);
    await audio.preloadUi(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
    context.state='suspended'; assert.equal(audio.ui('adjust'),false);
    context.state='running'; assert.equal(audio.ui('adjust'),true);
    const [voice]=audio.nodes;voice.oscillator.onended();
    assert.equal(audio.nodes.size,0);
    assert.equal(voice.gain.disconnected,true);
    assert.equal(voice.oscillator.disconnected,true);
});
