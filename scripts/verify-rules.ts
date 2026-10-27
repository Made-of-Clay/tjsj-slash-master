/*
 * Game-rule checks for step 6.
 *
 *   bun scripts/verify-rules.ts
 *
 * Plain assertions over the round state machine (src/game/Round.ts), restart
 * resets (Spawner.reset, Pool.releaseAll), and the spawn ramp finally being
 * driven by round progress. No test framework, no GPU, no DOM — the HUD
 * (src/ui/hud.ts) is DOM and stays eyeballed in workstream B.
 *
 * This is the piece `pnpm build` cannot see: a buzzer that never latches, a
 * round 2 that starts mid-cadence, or a ramp that silently stays flat.
 */

let failures = 0;
let total = 0;
function check(name: string, condition: boolean, detail = ''): void {
    total += 1;
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

import { BoxGeometry } from 'three/webgpu';
import { COMBO, ROUND } from '../src/config.ts';
import type { SpawnRules } from '../src/content/types.ts';
import type { PlayBounds } from '../src/rendering/Camera.ts';
import { Round } from '../src/game/Round.ts';
import { Combo } from '../src/game/Combo.ts';
import { Spawner } from '../src/game/Spawner.ts';
import { Pool } from '../src/game/Pool.ts';
import { createSpawnedObject, resetSpawnedObject } from '../src/game/SpawnedObject.ts';
import type { SpawnedObject } from '../src/game/SpawnedObject.ts';

const bounds: PlayBounds = { centerY: 0, halfHeight: 7, halfWidth: 10 };

/** Rules with fixed cadence/batch, so only round progress moves the numbers. */
function rampRules(): SpawnRules {
    return {
        intervalRange: { early: [2, 2], late: [0.5, 0.5] },
        batchRange: { early: [1, 1], late: [3, 3] },
        speedRange: [1, 1],
        apexRange: [0.5, 0.5],
        depthRange: [0, 0],
        spinRange: [0, 0],
        sideLaunchChance: 0,
    };
}

function objectPool(size: number): Pool<SpawnedObject> {
    return new Pool<SpawnedObject>(size, createSpawnedObject, resetSpawnedObject);
}

// ===== Round clock =====
console.log('Round');
{
    check(
        'rejects a non-positive duration',
        (() => {
            try {
                new Round(0);
                return false;
            } catch {
                return true;
            }
        })(),
    );

    const round = new Round(30);
    check(
        'starts running at zero',
        !round.over && round.progress === 0 && round.secondsLeft === 30,
    );

    for (let i = 0; i < 10; i += 1) round.step(1);
    check(
        'counts down secondsLeft',
        round.secondsLeft === 20 && !round.over,
        `left=${round.secondsLeft}`,
    );

    const half = new Round(1);
    for (let i = 0; i < 30; i += 1) half.step(1 / 60);
    check(
        'progress accumulates fractionally (0.5 at half)',
        Math.abs(half.progress - 0.5) < 1e-9,
        `p=${half.progress}`,
    );

    round.reset();
    round.step(10);
    check(
        'progress is elapsed/duration',
        Math.abs(round.progress - 1 / 3) < 1e-9,
        `p=${round.progress}`,
    );

    round.reset();
    round.step(29.5);
    check(
        'secondsLeft ceils the remainder (1 at 0.5)',
        round.secondsLeft === 1,
        `left=${round.secondsLeft}`,
    );

    round.reset();
    round.step(30);
    check('the buzzer latches at exactly duration', round.over);

    round.reset();
    round.step(30.5);
    check('an overshooting step still ends the round', round.over && round.secondsLeft === 0);

    round.step(5);
    check(
        'over persists and freezes the clock',
        round.over && round.progress === 1 && round.secondsLeft === 0,
    );

    round.reset();
    check(
        'reset restarts a finished round',
        !round.over && round.progress === 0 && round.secondsLeft === 30,
    );

    round.step(12);
    round.reset();
    check('reset clears mid-round elapsed too', round.progress === 0 && round.secondsLeft === 30);
}

// ===== Spawner.reset =====
console.log('Spawner reset');
{
    const freshPool = objectPool(4);
    const fresh = new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 });
    fresh.step(freshPool, bounds, 1.5, 0);
    check('fresh spawner holds fire before the first interval', freshPool.inUse === 0);
    fresh.step(freshPool, bounds, 0.5, 0);
    check('fresh spawner fires at t = interval', freshPool.inUse === 1);

    const usedPool = objectPool(4);
    const used = new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 });
    used.step(usedPool, bounds, 3, 0); // one fire at t=2, 1 s of credit left
    used.reset();
    used.step(usedPool, bounds, 1.5, 0);
    check(
        'reset discards leftover cadence credit',
        usedPool.inUse === 1,
        `inUse=${usedPool.inUse}`,
    );
    used.step(usedPool, bounds, 0.5, 0);
    check('reset round starts on the fresh cadence', usedPool.inUse === 2);

    const skipPool = objectPool(1);
    const skipping = new Spawner({
        rules: { ...rampRules(), batchRange: { early: [2, 2], late: [2, 2] } },
        defs: defs(),
        rand: () => 0,
    });
    skipping.step(skipPool, bounds, 2, 0);
    check('a full pool counts skips', skipping.skipped === 1, `skipped=${skipping.skipped}`);
    skipping.reset();
    check('reset clears the skip counter', skipping.skipped === 0);

    skipping.reset();
    skipping.reset();
    check('reset is safe to repeat', skipping.skipped === 0);
}

/** One target def, parts box size 1 — enough for every spawn draw (step 7 seam). */
function defs() {
    return [
        {
            id: 'a',
            score: 1,
            category: 'target' as const,
            model: {
                kind: 'parts' as const,
                parts: [{ geometry: new BoxGeometry(1, 1, 1), color: '#ffffff' }],
                size: 1,
            },
        },
    ];
}

// ===== Pool.releaseAll =====
console.log('Pool releaseAll');
{
    interface Slot {
        value: number;
    }
    const pool = new Pool<Slot>(
        4,
        () => ({ value: 0 }),
        (slot) => {
            slot.value = 0;
        },
    );

    pool.releaseAll();
    check('no-op on an empty pool', pool.inUse === 0 && pool.available === 4);

    const a = pool.acquire();
    const b = pool.acquire();
    if (!a || !b) throw new Error('test pool exhausted');
    a.value = 7;
    b.value = 9;
    pool.releaseAll();
    check('releases every checked-out slot', pool.inUse === 0 && pool.available === 4);
    check('released items are reset', a.value === 0 && b.value === 0);

    for (let i = 0; i < 4; i += 1) pool.acquire();
    pool.releaseAll();
    check('drains a completely full pool', pool.inUse === 0 && pool.available === 4);

    const again = pool.acquire();
    if (!again) throw new Error('test pool exhausted');
    check('reacquisition after releaseAll works', again.value === 0);

    pool.releaseAll();
    pool.releaseAll();
    check('double releaseAll is safe', pool.inUse === 0);
}

// ===== Round drives the ramp =====
console.log('Round x Spawner');
{
    // The ramp must bite: a round-driven spawner launches more, and bigger
    // batches, than one parked at progress 0 over the same wall time.
    const duration = 4;
    const round = new Round(duration);
    const rampPool = objectPool(16);
    const ramped = new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 });
    while (!round.over) {
        ramped.step(rampPool, bounds, 1, round.progress);
        round.step(1);
    }
    const flatPool = objectPool(16);
    const flat = new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 });
    for (let i = 0; i < 4; i += 1) flat.step(flatPool, bounds, 1, 0);
    check(
        'the ramp tightens a round (more launches than flat progress)',
        rampPool.inUse === 7 && flatPool.inUse === 2,
        `ramped=${rampPool.inUse} flat=${flatPool.inUse}`,
    );
    check(
        'late-round batches grow (7 objects over 3 fires)',
        ramped.skipped === 0 && rampPool.inUse > 3,
    );

    // Progress 0 vs 1 endpoints, isolated.
    const earlyPool = objectPool(4);
    new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 }).step(earlyPool, bounds, 2, 0);
    const latePool = objectPool(4);
    new Spawner({ rules: rampRules(), defs: defs(), rand: () => 0 }).step(latePool, bounds, 0.5, 1);
    check('progress 0 = early cadence, batch 1', earlyPool.inUse === 1);
    check('progress 1 = late cadence, batch 3', latePool.inUse === 3, `inUse=${latePool.inUse}`);

    // The buzzer flips exactly once per round.
    const buzzer = new Round(1);
    let transitions = 0;
    let wasOver = false;
    for (let i = 0; i < 120; i += 1) {
        buzzer.step(1 / 60);
        if (buzzer.over && !wasOver) transitions += 1;
        wasOver = buzzer.over;
    }
    check('over transitions exactly once', transitions === 1, `transitions=${transitions}`);

    // Restart: round 2 equals round 1 (clock + spawner cadence).
    buzzer.reset();
    let firstRun = 0;
    while (!buzzer.over) {
        buzzer.step(1 / 60);
        firstRun += 1;
    }
    check('a second round runs the full duration again', firstRun === 60, `steps=${firstRun}`);
}

// ===== combo =====
console.log('Combo');
{
    const combo = new Combo();
    check('the first cut of a chain banks nothing', combo.register(1) === 1);
    check('a chain under the window banks, not pays', combo.step(COMBO.window / 2) === 0);
    check('the second cut banks one step', combo.register(1) === 2);
    check('the third cut banks two steps', combo.register(1) === 3);
    check('count tracks the chain', combo.count === 3, `count=${combo.count}`);
    check('the window lapsing pays the whole bank', combo.step(COMBO.window) === COMBO.step * 3);
    check('the chain restarts after payout', combo.count === 0);

    // Regression: a pointer held down (no cut, no stroke end) farmed the
    // multiplier forever while the chain was keyed on the stroke.
    check('a held pointer with no cuts pays nothing', combo.step(COMBO.window * 10) === 0);
    check('the first cut after a lapse starts over', combo.register(1) === 1);

    // A 4-cut chain is the documented total: 0 + 1 + 2 + 3 steps = 6.
    const four = new Combo();
    check('a four-cut chain banks six steps', four.register(4) === 4);
    check('the four-cut bank lands on expiry', four.step(COMBO.window) === COMBO.step * 6);

    const rhythm = new Combo();
    rhythm.register(1);
    rhythm.step(COMBO.window * 0.9);
    check('a cut inside the window keeps the chain open', rhythm.register(1) === 2);
    check('the extended window pays nothing yet', rhythm.step(COMBO.window * 0.9) === 0);

    // Fixed steps accumulate: 38 × 1/60 s > window.
    const stepped = new Combo();
    stepped.register(2);
    let paid = 0;
    for (let index = 0; index < 38; index += 1) paid += stepped.step(1 / 60);
    check('small steps add up to the same expiry', paid === COMBO.step && stepped.count === 0);

    const idle = new Combo();
    idle.register(1);
    idle.step(COMBO.window * 0.9);
    check('an empty register does not extend the window', idle.register(0) === 1);
    check(
        'the original window still lapses',
        idle.step(COMBO.window * 0.2) === 0 && idle.count === 0,
    );

    const flushed = new Combo();
    flushed.register(2);
    check('flush pays an open chain early', flushed.flush() === COMBO.step);
    check('flush empties the chain', flushed.count === 0);
    check('flush on an empty chain pays nothing', flushed.flush() === 0);

    const dropped = new Combo();
    dropped.register(3);
    dropped.reset();
    check(
        'reset drops the chain and its bank',
        dropped.count === 0 && dropped.step(COMBO.window * 2) === 0,
    );

    check('COMBO.window is finite and positive', Number.isFinite(COMBO.window) && COMBO.window > 0);
}

// ===== config =====
console.log('Config');
{
    check('ROUND.duration is finite', Number.isFinite(ROUND.duration));
    check('ROUND.duration is positive', ROUND.duration > 0, `duration=${ROUND.duration}`);
}

if (failures > 0) {
    throw new Error(`${failures} rule check(s) failed`);
}

console.log(`\nALL PASS — ${total} checks`);
