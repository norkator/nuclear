/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
/* Phase-preserving SVG motion driven by reported simulation speed, not commands. */
import { advanceTurbineFragments } from './nuclear-power-turbine.js';
import { condenserHeatRejection } from './nuclear-power-cooling.js';

// Share the SVG path definition and distance-based particle positions without
// querying SVG geometry (which can force synchronous style/layout work).
export function createPolylinePath(points) {
    const segments = [];
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i - 1];
        const dx = points[i][0] - x, dy = points[i][1] - y;
        const size = Math.hypot(dx, dy);
        if (size) segments.push({ x, y, dx, dy, start: length, length: size });
        length += size;
    }
    return {
        d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''),
        length,
        pointAtDistance(distance) {
            const offset = Math.max(0, Math.min(length, distance));
            for (const segment of segments) {
                if (offset > segment.start + segment.length) continue;
                const t = (offset - segment.start) / segment.length;
                return { x: segment.x + segment.dx * t, y: segment.y + segment.dy * t };
            }
            return { x: points[0][0], y: points[0][1] };
        },
    };
}
export const SVG_FLOW_SCALE = 19;

export function valveHandleAngle(openingPercent, pipeAngle = 0) {
    const opening = Number.isFinite(openingPercent) ? Math.max(0, Math.min(100, openingPercent)) : 0;
    return pipeAngle + (1 - opening / 100) * 90;
}

export function flowMarkerDistance(travel, index, count, length) {
    if (!Number.isFinite(travel) || !Number.isFinite(length) || length <= 0 || count <= 0) return 0;
    return ((travel + index * length / count) % length + length) % length;
}

export function advancePumpMotion(previous, speedPercent, seconds) {
    const speed = Number.isFinite(speedPercent) ? Math.min(100, Math.max(0, speedPercent)) / 100 : 0;
    const dt = Number.isFinite(seconds) ? Math.min(0.1, Math.max(0, seconds)) : 0;
    return {
        angle: (previous.angle + 180 * speed * dt) % 360,
        offset: (previous.offset - 38 * speed * dt) % 19
    };
}

// Instrument illustrations follow actual reported output/flow, never setpoints.
export function advanceInstrumentMotion(previous, signals, seconds) {
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.1, seconds)) : 0;
    const next = {};
    for (const key of ['thermal', 'electrical', 'flow', 'secondaryFlow']) {
        const activity = Number.isFinite(signals[key]) ? Math.max(0, Math.min(1, signals[key])) : 0;
        next[key] = ((previous[key] || 0) + activity * dt * .9) % 1;
    }
    return next;
}

// Visual reaction activity only, not a neutronics calculation. Use actual rod
// positions and produced heat, never requested load or generator shaft speed.
export function advanceReactorMotion(previous, signals, seconds) {
    const bounded = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.1, seconds)) : 0;
    const power = bounded(signals.reactorPower / 100);
    const fuel = Number.isFinite(signals.reactorFuelCapability) ? Math.max(0, Math.min(1.15, signals.reactorFuelCapability)) : 1;
    const active = (signals.reactorActive ?? power > 0) && fuel > 0;
    const rods = signals.reactorRods || [];
    const withdrawals = rods.map(rod => bounded((100 - rod.position) / 100));
    const meanWithdrawal = withdrawals.length ? withdrawals.reduce((sum, value) => sum + value, 0) / withdrawals.length : power / Math.max(.001, fuel);
    const activity = active ? bounded(power * .55 + meanWithdrawal * fuel * .45) : 0;
    // Broader, immediately readable speed range: gentle at low activity, brisk
    // at high activity. Integrating rate preserves position as activity changes.
    const rate = value => value > 0 ? .1 + 1.6 * value ** 1.2 : 0;
    const reactionRate = rate(activity);
    const reactionChannels = withdrawals.map((withdrawal, index) => {
        const local = active ? bounded(withdrawal * fuel * .65 + power * .35 * withdrawal / Math.max(.05, meanWithdrawal)) : 0;
        const localRate = rate(local);
        return {
            activity: local,
            rate: localRate,
            phase: ((previous.reactionChannels?.[index]?.phase || 0) + localRate * dt) % 1,
        };
    });
    return {
        reactionActivity: activity,
        reactionRate,
        reactionPhase: ((previous.reactionPhase || 0) + reactionRate * dt) % 1,
        reactionChannels,
    };
}

// Illustration state only: these rates are not simulated RPM or extra plant physics.
export function advanceProcessMotion(previous, signals, seconds) {
    const bounded = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.1, seconds)) : 0;
    const steam = bounded((signals.secondaryTemperature - 65) / 140) * bounded(signals.secondaryFlow / 100);
    const coolingTower = condenserHeatRejection(signals);
    const coolingWater = Math.max(0, Math.min(1.35, signals.secondaryFlow / 100)) * bounded(signals.condenserCoolingFactor);
    const heat = bounded((signals.temperature - signals.secondaryTemperature) / 140)
        * bounded(Math.min(signals.primaryFlow, signals.secondaryFlow) / 100)
        * (Number.isFinite(signals.exchangerTransferFactor) ? bounded(signals.exchangerTransferFactor) : 1);
    // Output is authoritative for rotation; the toy model can generate during
    // warm-up before the separate illustrative steam-temperature threshold.
    const target = Number.isFinite(signals.shaftSpeed) ? bounded(signals.shaftSpeed / 100) : bounded(signals.electricalOutput / 300);
    const speed = target + (previous.speed - target) * Math.exp(-dt / (target > previous.speed ? 3 : 6));
    return {
        speed: speed < .0001 ? 0 : speed,
        angle: (previous.angle + speed * 540 * dt) % 360,
        steamPhase: (previous.steamPhase + steam * dt * .35) % 1,
        coolingTower, coolingWater,
        coolingTowerPhase: ((previous.coolingTowerPhase || 0) + (coolingTower > .002 ? .06 + coolingTower * .16 : 0) * dt) % 1,
        coolingWaterTravel: (previous.coolingWaterTravel || 0) + coolingWater * dt * 2,
        heatPhase: (previous.heatPhase + heat * dt * .6) % 1,
        supplyPhase: (previous.supplyPhase + bounded(signals.supplyFactor) * dt * .6) % 1,
        thermalPhase: ((previous.thermalPhase || 0) + bounded((signals.fuelTemperature - 100) / 550) * dt * .4) % 1,
        leakPhase: ((previous.leakPhase || 0) + (signals.leakActivity > .01 ? .6 + bounded(signals.leakActivity / 30) : 0) * dt) % 1,
        ...advanceReactorMotion(previous, signals, dt),
        primaryTravel: (previous.primaryTravel || 0) + Math.max(0, Math.min(1.35, signals.primaryFlow / 100)) * dt * 2,
        secondaryTravel: (previous.secondaryTravel || 0) + Math.max(0, Math.min(1.35, signals.secondaryFlow / 100)) * dt * 2,
        steam, heat,
        turbineFragments: advanceTurbineFragments(previous.turbineFragments, signals.turbineFragments, dt)
    };
}
