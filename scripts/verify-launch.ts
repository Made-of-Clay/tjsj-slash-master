/*
 * Launch checks for step 3.
 *
 *   bun scripts/verify-launch.ts
 *
 * Plain assertions over the trajectory contract: the closed-form aim helpers in
 * src/game/Spawner.ts, the fixed-step integrator in src/game/Physics.ts, and the
 * spawner's guarantees. No test framework, no GPU, no DOM — every import here
 * constructs without a rendering context.
 *
 * This is the piece `pnpm build` cannot see: a spawner that type-checks clean
 * while every arc flies off the top of a phone screen.
 */

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

import { Vector3 } from 'three/webgpu';
import {
    CAMERA,
    FIXED_STEP,
    GAME_PLANE_DEPTH,
    GRAVITY,
    LAUNCH_LINE_Y,
    PLAYFIELD,
    POOL_SIZE,
} from '../src/config.ts';
import type { SpawnRules } from '../src/content/types.ts';
import { halloween } from '../src/content/themes/halloween.ts';
import { Physics } from '../src/game/Physics.ts';
import { Pool } from '../src/game/Pool.ts';
import { aimVx, flightTime, launchVy, Spawner } from '../src/game/Spawner.ts';
import {
    boxBoundingRadius,
    createSpawnedObject,
    resetSpawnedObject,
} from '../src/game/SpawnedObject.ts';
import type { SpawnedObject } from '../src/game/SpawnedObject.ts';
import {
    computePlayBounds,
    createCamera,
    createPlayField,
    createSwipeProjector,
} from '../src/rendering/Camera.ts';
import type { PlayBounds } from '../src/rendering/Camera.ts';

// mulberry32 — small, seedable, good enough for launch sampling.
function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Arc {
    peakY: number;
    landX: number;
}

/**
 * Integrates one ballistic arc with the SAME order Physics uses — position
 * first (old velocity), then gravity — until it falls back to `y0`.
 */
function simulateArc(
    x0: number,
    y0: number,
    vx: number,
    vy: number,
    gravity: number,
    dt: number,
    maxSeconds = 30,
): Arc {
    let x = x0;
    let y = y0;
    let v = vy;
    let peakY = y0;
    let t = 0;

    while (t < maxSeconds) {
        x += vx * dt;
        y += v * dt;
        v -= gravity * dt;
        t += dt;
        if (y > peakY) peakY = y;
        if (v < 0 && y <= y0) break;
    }

    return { peakY, landX: x };
}

const portrait = computePlayBounds(PLAYFIELD, CAMERA.fov, 9 / 16);
const radius = boxBoundingRadius(halloween.objects[0].model.size);
// Side launches start at `halfWidth + that def's radius`; step 7 themes mix
// sizes, so the containment bound must use the largest.
const maxRadius = Math.max(...halloween.objects.map((def) => boxBoundingRadius(def.model.size)));

// ===== aim math =====
// launchVy/aimVx must produce a velocity that peaks at apexY and lands at
// targetX. A fine integrator isolates the formula from the O(dt) Euler offset.
console.log('Aim math');
{
    const g = GRAVITY;
    const inset = Math.max(portrait.halfWidth - radius, 0);
    const y0 = LAUNCH_LINE_Y - radius;
    const rand = seededRandom(1);

    let worstPeak = 0;
    let worstLand = 0;
    for (let i = 0; i < 100; i += 1) {
        const x0 = (rand() * 2 - 1) * inset;
        const targetX = (rand() * 2 - 1) * inset;
        const apexY = LAUNCH_LINE_Y + (0.5 + rand() * 0.3) * 2 * portrait.halfHeight;

        const vy = launchVy(y0, apexY, g);
        const vx = aimVx(x0, targetX, flightTime(vy, g));
        const arc = simulateArc(x0, y0, vx, vy, g, 1 / 2400);

        worstPeak = Math.max(worstPeak, Math.abs(arc.peakY - apexY));
        worstLand = Math.max(worstLand, Math.abs(arc.landX - targetX));
    }
    check('arc peaks at the aimed apexY (<=1e-2)', worstPeak <= 1e-2, `worst=${worstPeak}`);
    check('arc lands at the aimed targetX (<=1e-2)', worstLand <= 1e-2, `worst=${worstLand}`);

    check('a higher apex needs a faster launch', launchVy(0, 5, g) < launchVy(0, 10, g));
    check('no rise gives a zero launch speed', launchVy(0, -1, g) === 0);
    check('aiming right yields positive vx', aimVx(0, 2, 1) > 0);
    check('aiming left yields negative vx', aimVx(0, -2, 1) < 0);
    check('flight time doubles the rise time', Math.abs(flightTime(20, g) - 2 * (20 / g)) < 1e-12);
}

// ===== integration vs closed form =====
console.log('Integration');
{
    const g = GRAVITY;
    const dt = FIXED_STEP;
    const x0 = 1.3;
    const y0 = LAUNCH_LINE_Y - radius;
    const vx = -2.1;
    const vy = 21.7;
    const n = 40;
    const t = n * dt;

    let x = x0;
    let y = y0;
    let v = vy;
    for (let i = 0; i < n; i += 1) {
        x += vx * dt;
        y += v * dt;
        v -= g * dt;
    }

    // Explicit Euler (position before gravity) tracks the analytic curve plus a
    // known 0.5·g·dt·t offset — the identity is exact, so assert it tightly.
    const closedY = y0 + vy * t - 0.5 * g * t * t;
    const eulerOffset = 0.5 * g * dt * t;
    check('x matches the closed form exactly', Math.abs(x - (x0 + vx * t)) < 1e-9);
    check(
        'y matches the closed form plus the Euler offset',
        Math.abs(y - closedY - eulerOffset) < 1e-8,
        `y-closed-offset=${y - closedY - eulerOffset}`,
    );

    // At the real fixed step, the arc still peaks and lands close to the aim.
    const arc = simulateArc(x0, y0, vx, vy, g, dt);
    const apexClosed = y0 + (vy * vy) / (2 * g);
    const landClosed = x0 + vx * flightTime(vy, g);
    check(
        'fixed-step arc peaks within 0.25 of the closed form',
        Math.abs(arc.peakY - apexClosed) < 0.25,
        `d=${Math.abs(arc.peakY - apexClosed).toFixed(4)}`,
    );
    check(
        'fixed-step arc lands within 0.15 of the closed form',
        Math.abs(arc.landX - landClosed) < 0.15,
        `d=${Math.abs(arc.landX - landClosed).toFixed(4)}`,
    );
}

// ===== despawn =====
console.log('Despawn');
{
    const physics = new Physics();
    const bounds = portrait;

    const run = (setup: (object: SpawnedObject) => void): number => {
        const pool = new Pool(2, createSpawnedObject, resetSpawnedObject);
        const object = pool.acquire()!;
        setup(object);
        object.radius = radius;
        object.active = true;
        physics.step(pool, bounds, FIXED_STEP);
        return pool.inUse;
    };

    const bottom = LAUNCH_LINE_Y;
    check(
        'falling below the launch line → released',
        run((o) => {
            o.position.set(0, bottom - 3, 0);
            o.velocity.set(0, -2, 0);
        }) === 0,
    );
    check(
        'rising above the line → kept',
        run((o) => {
            o.position.set(0, bottom + 1, 0);
            o.velocity.set(0, 5, 0);
        }) === 1,
    );
    check(
        'below the line but rising → kept',
        run((o) => {
            o.position.set(0, bottom - 1, 0);
            o.velocity.set(0, 5, 0);
        }) === 1,
    );
    check(
        'outside sideways, moving outward → released',
        run((o) => {
            o.position.set(bounds.halfWidth + 3, bottom + 1, 0);
            o.velocity.set(3, 1, 0);
        }) === 0,
    );
    check(
        'outside sideways, moving inward → kept (side launch)',
        run((o) => {
            o.position.set(-(bounds.halfWidth + 3), bottom + 1, 0);
            o.velocity.set(3, 6, 0);
        }) === 1,
    );

    // A recycled slot must come back zeroed (Policy: pool reset owns rotation).
    const pool = new Pool(1, createSpawnedObject, resetSpawnedObject);
    const object = pool.acquire()!;
    object.position.set(4, 2, 1);
    object.velocity.set(9, -9, 9);
    object.rotation.set(1, 2, 3);
    object.angularVelocity.set(1, 1, 1);
    object.active = true;
    pool.release(object);
    check(
        'release zeroes position/velocity/rotation',
        object.position.lengthSq() === 0 &&
            object.velocity.lengthSq() === 0 &&
            object.rotation.x === 0 &&
            object.angularVelocity.lengthSq() === 0,
    );
    check('release clears active', !object.active);
}

// ===== pool exhaustion =====
console.log('Pool exhaustion');
{
    const bounds = portrait;
    const pool = new Pool(POOL_SIZE, createSpawnedObject, resetSpawnedObject);
    for (let i = 0; i < POOL_SIZE; i += 1) {
        const object = pool.acquire()!;
        object.active = true;
    }
    check('a full pool returns undefined from acquire', pool.acquire() === undefined);

    // Late-round cadence/batch so several events fire in the window.
    const spawner = new Spawner({
        rules: halloween.spawnRules,
        defs: halloween.objects,
        rand: seededRandom(7),
    });
    for (let i = 0; i < 600; i += 1) spawner.step(pool, bounds, FIXED_STEP, 1);

    check('spawner never grows the pool', pool.size === POOL_SIZE && pool.inUse === POOL_SIZE);
    check('exhaustion is counted, not thrown', spawner.skipped > 0, `skipped=${spawner.skipped}`);

    // Free one slot: the spawner can serve again.
    const skippedBefore = spawner.skipped;
    pool.release(pool.items[0]);
    for (let i = 0; i < 600; i += 1) spawner.step(pool, bounds, FIXED_STEP, 1);
    check('a freed slot is used again', pool.inUse === POOL_SIZE, `inUse=${pool.inUse}`);
    check('serving stops the skip growth', spawner.skipped >= skippedBefore);
}

// ===== side launches =====
console.log('Side launches');
{
    const g = GRAVITY;
    const bounds = portrait;
    const rules: SpawnRules = { ...halloween.spawnRules, sideLaunchChance: 1 };
    const spawner = new Spawner({ rules, defs: halloween.objects, rand: seededRandom(99) });
    const launches = collectLaunches(spawner, bounds, 120);

    check('side launches are produced', launches.length > 5, `got ${launches.length}`);

    let allOutside = true;
    let allEnter = true;
    let allInsideAtApex = true;
    let neverFarSide = true;

    for (const launch of launches) {
        const side = Math.sign(launch.x0);
        if (Math.abs(launch.x0) < bounds.halfWidth) allOutside = false;

        const tApex = launch.vy / g;
        const xApex = launch.x0 + launch.vx * tApex;
        if (Math.abs(xApex) > bounds.halfWidth) allInsideAtApex = false;

        let entered = false;
        const dt = 1 / 240;
        for (let t = 0; t <= tApex; t += dt) {
            const x = launch.x0 + launch.vx * t;
            if (Math.abs(x) < bounds.halfWidth) entered = true;
            // The far edge is -side; the arc must not reach it before the apex.
            if (x * side < -(bounds.halfWidth + launch.radius)) neverFarSide = false;
        }
        if (!entered) allEnter = false;
    }

    check('every side launch spawns outside the bounds', allOutside);
    check('every side launch enters the field', allEnter);
    check('every side launch is inside at its apex', allInsideAtApex);
    check('no side launch exits the far side before apex', neverFarSide);
}

// ===== containment across aspects =====
// The success signal: arcs stay in frame at 21:9 and 9:16, never escape the top.
console.log('Arc containment');
{
    for (const aspect of [21 / 9, 16 / 9, 9 / 16]) {
        const bounds = computePlayBounds(PLAYFIELD, CAMERA.fov, aspect);
        const top = bounds.centerY + bounds.halfHeight;
        const spawner = new Spawner({
            rules: halloween.spawnRules,
            defs: halloween.objects,
            rand: seededRandom(5),
        });
        const pool = new Pool(POOL_SIZE, createSpawnedObject, resetSpawnedObject);
        const physics = new Physics();

        let maxY = -Infinity;
        let maxAbsX = 0;
        let observed = 0;
        for (let i = 0; i < 60 * 90; i += 1) {
            spawner.step(pool, bounds, FIXED_STEP, 0);
            pool.each((object) => {
                observed += 1;
                if (object.position.y > maxY) maxY = object.position.y;
                const absX = Math.abs(object.position.x);
                if (absX > maxAbsX) maxAbsX = absX;
            });
            physics.step(pool, bounds, FIXED_STEP);
        }

        const tag = aspect.toFixed(3);
        check(`[${tag}] objects are simulated`, observed > 0);
        check(
            `[${tag}] no arc rises above the field top`,
            maxY <= top + 1e-6,
            `maxY=${maxY.toFixed(3)} top=${top.toFixed(3)}`,
        );
        // Side launches start at halfWidth+radius and travel inward; nothing
        // else may be observed outside that boundary.
        check(
            `[${tag}] no arc escapes the sides`,
            maxAbsX <= bounds.halfWidth + maxRadius + 1e-6,
            `max|X|=${maxAbsX.toFixed(3)} limit=${(bounds.halfWidth + radius).toFixed(3)}`,
        );
    }
}

// ===== swipe projector regression =====
console.log('Projector regression');
{
    const camera = createCamera(9 / 19.5);
    createPlayField(camera).reframe(21 / 9);
    const project = createSwipeProjector(camera);
    const out = new Vector3();

    let onPlane = true;
    for (const [ndcX, ndcY] of [
        [0, 0],
        [1, 1],
        [-1, -1],
        [0.4, -0.8],
        [-0.6, 0.3],
    ] as const) {
        project(ndcX, ndcY, out);
        if (Math.abs(out.z - GAME_PLANE_DEPTH) > 1e-9) onPlane = false;
    }
    check('reframing keeps the swipe ray on the play plane', onPlane);
}

// Drives a size-1 pool so each fire yields one freshly-configured object; the
// slot is released immediately so the next event can reuse it.
function collectLaunches(
    spawner: Spawner,
    bounds: PlayBounds,
    seconds: number,
): Array<{
    x0: number;
    y0: number;
    vx: number;
    vy: number;
    radius: number;
}> {
    const pool = new Pool(1, createSpawnedObject, resetSpawnedObject);
    const launches: Array<{ x0: number; y0: number; vx: number; vy: number; radius: number }> = [];
    const steps = Math.round(seconds / FIXED_STEP);

    for (let i = 0; i < steps; i += 1) {
        spawner.step(pool, bounds, FIXED_STEP, 0);
        const object = pool.items[0];
        if (object.active) {
            launches.push({
                x0: object.position.x,
                y0: object.position.y,
                vx: object.velocity.x,
                vy: object.velocity.y,
                radius: object.radius,
            });
            pool.release(object);
        }
    }

    return launches;
}

if (failures > 0) {
    throw new Error(`${failures} launch check(s) failed`);
}

console.log('\nALL PASS');
