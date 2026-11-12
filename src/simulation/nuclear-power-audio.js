/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Plant/diesel sounds, quiet Start/Stop cues and UI samples. The caller owns gesture-based resume, visibility,
 * mute and pause, and calls cue only after an accepted Start/Stop state change.
 * No context creation, alarm tones, command inference or deferred cue replay. */

export function plantSoundState(sim) {
    const turbine = sim.components.items.turbine.actual;
    // Actual heat production and shaft coast-down, never the requested MW/rod settings.
    const activity = Math.min(1, Math.max(0, turbine.shaftSpeed / 100, sim.running ? sim.power / 100 : 0));
    const fault = sim.tripped || turbine.tripped || sim.temperature > 335
        || sim.condition.stage !== 'NORMAL' || sim.condition.damaged || sim.components.damaged
        || Object.values(sim.components.items).some(item => Math.abs(item.disturbance.value) > .05);
    return { activity, fault };
}

export class PlantAudio {
    constructor(context) {
        this.context = context;
        // Both synthesized cues and one-shot samples share cleanup and the sound switch.
        this.nodes = new Set();
        this.uiBuffers = new Map();
        this.uiGain = 0.26;
        this.uiState = 'not-loaded';
        this.lastUiAt = -Infinity;
        this.plantBuffers = new Map();
        this.plantState = 'not-loaded';
        this.dieselBuffers = new Map();
        this.dieselState = 'not-loaded';
        this.dieselStates = new Map();
        this.completedStarts = new Set();
        this.scene = 'reactor';
    }

    setScene(scene) {
        if (this.scene === scene) return;
        this.scene = scene;
        // Tab changes stop outgoing machinery immediately; shared UI sounds remain.
        for (const voice of this.nodes) if (!voice.ui) this.halt(voice);
        this.dieselStates.clear();
        this.completedStarts.clear();
    }

    updateScene(sim, scene) {
        this.setScene(scene);
        if (scene === 'reactor') {
            this.updatePlant(plantSoundState(sim));
            this.updateDiesels(sim.supply.generators);
        }
    }

    preloadDiesels(fetcher = fetch) {
        if (this.dieselLoading) return this.dieselLoading;
        this.dieselState = 'loading';
        this.dieselLoading = Promise.all(['startup', 'running-loop', 'shutdown'].map(async kind => {
            try {
                const response = await fetcher(`/audio/nuclear-power/diesel/diesel-${kind}.wav`);
                if (!response.ok) return;
                this.dieselBuffers.set(kind, await this.context.decodeAudioData(await response.arrayBuffer()));
            } catch { /* Sound availability never affects auxiliary power. */ }
        })).then(() => { this.dieselState = this.dieselBuffers.size === 3 ? 'ready' : 'unavailable'; });
        return this.dieselLoading;
    }

    updateDiesels(generators) {
        if (this.scene !== 'reactor' || this.context.state !== 'running') {
            for (const voice of this.nodes) if (voice.diesel) this.halt(voice);
            this.dieselStates.clear();
            this.completedStarts.clear();
            return;
        }
        for (const generator of generators) {
            const { id, state, startRemaining, load, capacity } = generator;
            const previous = this.dieselStates.get(id);
            this.dieselStates.set(id, state);
            let voice = [...this.nodes].find(node => node.diesel === id);
            const kind = state === 'STARTING' ? 'startup' : state === 'RUNNING' ? 'running-loop'
                : ['STARTING', 'RUNNING'].includes(previous) || voice?.kind === 'shutdown' ? 'shutdown' : null;
            if (voice && voice.kind !== kind) { this.halt(voice); voice = null; }
            if (!kind || this.dieselState !== 'ready') continue;
            const now = this.context.currentTime;
            if (!voice) {
                // One-shots never replay on repeated updates, late loads or returning to a tab.
                if (kind === 'shutdown' && !['STARTING', 'RUNNING'].includes(previous)) continue;
                if (kind === 'startup' && previous === state && this.completedStarts.has(id)) continue;
                const source = this.context.createBufferSource();
                const gain = this.context.createGain();
                source.buffer = this.dieselBuffers.get(kind);
                source.loop = kind === 'running-loop';
                gain.gain.setValueAtTime(0, now);
                source.connect(gain); gain.connect(this.context.destination);
                voice = { oscillator: source, gain, diesel: id, kind };
                this.nodes.add(voice);
                this.completedStarts.delete(id);
                source.onended = () => {
                    if (kind === 'startup') this.completedStarts.add(id);
                    this.release(voice);
                };
                // Startup resumes at the simulated crank position after pause/tab changes.
                const offset = kind === 'startup' ? Math.min(source.buffer.duration - .001, Math.max(0, 8 - startRemaining))
                    : source.loop && id === 'B' ? Math.min(3, source.buffer.duration / 2) : 0;
                source.start(now, offset);
            }
            const fraction = Number.isFinite(load / capacity) ? Math.min(1, Math.max(0, load / capacity)) : 0;
            const target = kind === 'running-loop' ? .035 + .015 * fraction : .045;
            if (voice.target !== target) {
                voice.gain.gain.setTargetAtTime(target, now, .08);
                voice.target = target;
            }
        }
    }

    preloadPlant(fetcher = fetch) {
        if (this.plantLoading) return this.plantLoading;
        this.plantState = 'loading';
        this.plantLoading = Promise.all(['normal', 'fault'].map(async kind => {
            try {
                const response = await fetcher(`/audio/nuclear-power/plant-state/plant-${kind}-loop.wav`);
                if (!response.ok) return;
                const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
                this.plantBuffers.set(kind, buffer);
            } catch { /* Missing audio must never affect plant operation. */ }
        })).then(() => { this.plantState = this.plantBuffers.size === 2 ? 'ready' : 'unavailable'; });
        // Loading only stores buffers. The next permitted update decides whether to play.
        return this.plantLoading;
    }

    updatePlant({ activity, fault }) {
        if (this.context.state !== 'running' || this.plantState !== 'ready'
                || !Number.isFinite(activity) || activity <= .005) {
            for (const voice of this.nodes) if (voice.plant) this.halt(voice);
            return;
        }
        const now = this.context.currentTime;
        const level = .10 * Math.sqrt(Math.min(1, Math.max(0, activity)));
        for (const kind of ['normal', 'fault']) {
            let voice = [...this.nodes].find(node => node.plant === kind);
            if (!voice) {
                const source = this.context.createBufferSource();
                const gain = this.context.createGain();
                source.buffer = this.plantBuffers.get(kind);
                source.loop = true;
                gain.gain.setValueAtTime(0, now);
                source.connect(gain); gain.connect(this.context.destination);
                voice = { oscillator: source, gain, plant: kind };
                this.nodes.add(voice);
                source.onended = () => this.release(voice);
                source.start(now);
            }
            const target = (fault ? kind === 'fault' : kind === 'normal') ? level : 0;
            if (voice.target !== target) {
                // Smooth ~1 s crossfades; preserve current gain even on rapid state changes.
                voice.gain.gain.setTargetAtTime(target, now, .25);
                voice.target = target;
            }
        }
    }

    preloadUi(fetcher = fetch) {
        if (this.uiLoading) return this.uiLoading;
        this.uiState = 'loading';
        const files = {on:'switch1.wav', off:'switch2.wav', adjust:'click1.wav'};
        this.uiLoading = Promise.all(Object.entries(files).map(async ([kind, file]) => {
            try {
                const response = await fetcher(`/audio/nuclear-power/kenney-ui/${file}`);
                if (!response.ok) return;
                const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
                this.uiBuffers.set(kind, buffer);
            } catch { /* Missing/unsupported audio never blocks a process command. */ }
        })).then(() => { this.uiState = this.uiBuffers.size === 3 ? 'ready' : 'unavailable'; });
        return this.uiLoading;
    }

    ui(kind = 'adjust') {
        const buffer = this.uiBuffers.get(kind);
        const now = this.context.currentTime;
        if (!buffer || this.context.state !== 'running' || now - this.lastUiAt < .08) return false;
        for (const voice of this.nodes) if (voice.ui) this.halt(voice);
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = buffer;
        source.loop = false;
        gain.gain.setValueAtTime(this.uiGain, now);
        source.connect(gain); gain.connect(this.context.destination);
        const voice = {oscillator:source, gain, ui:true};
        this.nodes.add(voice);
        source.onended = () => this.release(voice);
        source.start(now);
        this.lastUiAt = now;
        return true;
    }

    get hasActiveSounds() { return this.nodes.size > 0; }

    voice(type) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        gain.gain.setValueAtTime(0, this.context.currentTime);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        const voice = { oscillator, gain };
        this.nodes.add(voice);
        oscillator.onended = () => this.release(voice);
        return voice;
    }

    release(voice) {
        if (!this.nodes.delete(voice)) return;
        voice.oscillator.onended = null;
        voice.oscillator.disconnect();
        voice.gain.disconnect();
    }

    cue(command) {
        if (!['start', 'stop'].includes(command) || this.context.state !== 'running' || this.scene !== 'reactor') return;
        // One short command voice at a time, even during rapid operator actions.
        for (const voice of this.nodes) if (!voice.plant && !voice.diesel) this.halt(voice);
        const voice = this.voice('sine');
        const now = this.context.currentTime;
        const starting = command === 'start';
        voice.oscillator.frequency.setValueAtTime(starting ? 65 : 180, now);
        voice.oscillator.frequency.linearRampToValueAtTime(starting ? 180 : 45, now + 0.5);
        voice.gain.gain.linearRampToValueAtTime(0.0004, now + 0.04);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.55);
        voice.oscillator.start(now);
        voice.oscillator.stop(now + 0.6);
    }

    halt(voice) {
        voice.gain.gain.cancelScheduledValues(this.context.currentTime);
        voice.gain.gain.setValueAtTime(0, this.context.currentTime);
        voice.oscillator.stop();
        this.release(voice);
    }

    stop() {
        for (const voice of this.nodes) this.halt(voice);
        this.dieselStates.clear();
        this.completedStarts.clear();
    }
}
