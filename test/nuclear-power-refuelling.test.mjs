/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_CHANNELS, NuclearPowerSimulation } from '../src/simulation/nuclear-power-model.js';
import { FuelTransferAnimation, FUEL_HANDLING, FUEL_POOL_SLOTS, SPENT_FUEL_COOLING_SECONDS } from '../src/simulation/nuclear-power-refuelling.js';

const advance = (animation, seconds) => {
    for (let step = 0; step < Math.ceil(seconds / .05); step++) animation.advance(.05);
};

test('one representative assembly is lifted clear before traversal and deposited under the pool water', () => {
    const animation = new FuelTransferAnimation(CORE_CHANNELS);
    assert.equal(animation.start('CR-01'), false);
    assert.equal(animation.start('FA-17', 49), true);
    const seen = new Set();
    let prior = animation.pose;
    for (let step = 0; step < 230; step++) {
        animation.advance(.05);
        const pose = animation.pose;
        seen.add(pose.phase);
        if (pose.carrying && prior.carrying && (pose.x !== prior.x || pose.z !== prior.z)) {
            assert.ok(pose.grabberY - FUEL_HANDLING.gripOffset - FUEL_HANDLING.assemblyHeight > FUEL_HANDLING.deckY + .1,
                'The whole assembly must clear the deck before horizontal travel');
        }
        if (pose.phase === 'Lowering into pool') {
            assert.equal(pose.x, FUEL_POOL_SLOTS[0].x);
            assert.equal(pose.z, FUEL_POOL_SLOTS[0].z);
        }
        prior = pose;
    }
    assert.ok(seen.has('Lifting assembly') && seen.has('Moving to pool') && seen.has('Lowering into pool'));
    assert.equal(animation.job, null);
    assert.deepEqual(animation.samples.filter(Boolean).map(({ id, count, slotIndex }) => ({ id, count, slotIndex })), [{ id: 'FA-17', count: 49, slotIndex: 0 }]);
    assert.ok(FUEL_HANDLING.storedFuelY + FUEL_HANDLING.assemblyHeight / 2 < 5.82);
    assert.equal(animation.pose.carrying, false);
    assert.equal(animation.pose.phase, 'Parked');
});

test('repeated actions replace an unfinished illustration, while a full pool preserves batches until explicit dispatch', () => {
    const animation = new FuelTransferAnimation(CORE_CHANNELS);
    animation.start('FA-01');
    advance(animation, 4);
    animation.start('FA-02');
    assert.equal(animation.job.id, 'FA-02');
    assert.equal(animation.samples.filter(Boolean).length, 0);
    advance(animation, 11);
    assert.equal(animation.samples.filter(Boolean).length, 1);
    for (let i = 0; i < 40; i++) animation.start('FA-03', 49, true);
    assert.equal(animation.samples.filter(Boolean).length, 35);
    const references = animation.samples.map(sample => sample.reference);
    assert.equal(animation.start('FA-04', 1, true), false);
    assert.deepEqual(animation.samples.map(sample => sample.reference), references);
    assert.ok(animation.nextSlot >= 0 && animation.nextSlot < 35);
    animation.cancel();
    assert.equal(animation.samples.filter(Boolean).length, 35);
    animation.reset();
    assert.equal(animation.job, null);
    assert.equal(animation.samples.filter(Boolean).length, 0);
});

test('cooling starts on placement and dispatch requires elapsed simulation time, a valid destination and explicit action', () => {
    const pool = new FuelTransferAnimation(CORE_CHANNELS);
    pool.setPoolTime(10);
    pool.start('FA-01', 49);
    advance(pool, 4);
    pool.setPoolTime(20);
    advance(pool, 7);
    const batch = pool.samples.find(Boolean);
    assert.equal(batch.placedAt, 20);
    assert.equal(batch.readyAt, 20 + SPENT_FUEL_COOLING_SECONDS);
    assert.equal(pool.dispatch(batch.reference, 'storage'), null);
    pool.setPoolTime(batch.readyAt - .01);
    assert.equal(pool.dispatchReadiness(batch.reference).ready, false);
    pool.setPoolTime(batch.readyAt);
    assert.equal(pool.dispatchReadiness(batch.reference).ready, true);
    assert.equal(pool.dispatch(batch.reference, 'unknown'), null);
    assert.equal(pool.samples.filter(Boolean).length, 1, 'Ready batches must never leave automatically');
    const shipment = pool.dispatch(batch.reference, 'reprocessing');
    assert.equal(shipment.count, 49);
    assert.equal(shipment.destination, 'reprocessing');
    assert.equal(shipment.cost, 0);
    assert.equal(pool.dispatchedAssemblies, 49);
    assert.equal(pool.samples.filter(Boolean).length, 0);
    assert.equal(pool.dispatch(batch.reference, 'storage'), null, 'A batch cannot be sent twice');
    assert.equal(pool.dispatchedAssemblies, 49);
});

test('dispatch releases exactly its rack, resumes pool capacity and reset clears the session ledger', () => {
    const pool = new FuelTransferAnimation(CORE_CHANNELS);
    for (let i = 0; i < 35; i++) pool.start('FA-01', 1, true);
    assert.equal(pool.hasCapacity, false);
    pool.setPoolTime(SPENT_FUEL_COOLING_SECONDS);
    const original = pool.samples.map(sample => sample.reference);
    pool.dispatch(pool.samples[12].reference, 'storage');
    assert.equal(pool.hasCapacity, true);
    pool.start('FA-02', 49, true);
    assert.equal(pool.samples[12].id, 'FA-02');
    assert.ok(pool.samples.every((sample, index) => index === 12 || sample.reference === original[index]));
    assert.equal(new Set(pool.samples.map(sample => sample.reference)).size, 35);
    pool.reset();
    assert.equal(pool.poolTime, 0);
    assert.equal(pool.dispatchedAssemblies, 0);
    assert.deepEqual(pool.dispatchHistory, []);
    assert.equal(pool.samples.some(Boolean), false);
});

test('presentation never changes fuel, heat, damage, settings or trip state, including reduced motion and cancellation', () => {
    const sim = new NuclearPowerSimulation();
    sim.trip();
    sim.condition.heatReserve = 7;
    const state = () => JSON.stringify({ snapshot: sim.snapshot(), fuel: sim.fuel,
        heat: sim.condition.heatReserve, damage: sim.condition.zones });
    const before = state();
    const animation = new FuelTransferAnimation(CORE_CHANNELS);
    animation.start('FA-01', 49, true);
    assert.equal(animation.job, null);
    assert.equal(animation.samples.filter(Boolean).length, 1);
    animation.start('FA-02');
    advance(animation, 5);
    animation.cancel();
    assert.equal(animation.samples.filter(Boolean).length, 1);
    animation.setPoolTime(SPENT_FUEL_COOLING_SECONDS);
    animation.dispatch(animation.samples.find(Boolean).reference, 'storage');
    assert.equal(state(), before);
});

test('invalid and stalled frames cannot fast-forward or rewind a transfer', () => {
    const animation = new FuelTransferAnimation(CORE_CHANNELS);
    animation.start('FA-01');
    animation.advance(-1);
    animation.advance(NaN);
    animation.advance(Infinity);
    assert.equal(animation.job.elapsed, 0);
    animation.advance(100);
    assert.equal(animation.job.elapsed, .1);
});
