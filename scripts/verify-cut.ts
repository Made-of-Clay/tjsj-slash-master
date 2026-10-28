/*
 * Cut checks for step 5.
 *
 *   bun scripts/verify-cut.ts
 *
 * Plain assertions over the cutting contract: the pure sphere-vs-segment hit
 * test (src/game/Collision.ts), the Slicer's cut-once orchestration (release
 * during iteration, score deltas, slice normal), the Score model, and the
 * Debris piece ring (spawn math, integration, despawn, ring overflow). No
 * test framework, no GPU, no DOM — every import constructs without a
 * rendering context.
 *
 * This is the piece `pnpm build` cannot see: a hit test that misses the
 * depth band, an object cut twice by one stroke, or pieces that spawn with
 * garbage velocities.
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

import { BoxGeometry, Vector3 } from 'three/webgpu';
import { CUT, SPAWN } from '../src/config.ts';
import type { ObjectCategory, SpawnRules } from '../src/content/types.ts';
import { halloween } from '../src/content/themes/halloween.ts';
import type { PlayBounds } from '../src/rendering/Camera.ts';
import { Debris } from '../src/game/Debris.ts';
import { segmentSphere } from '../src/game/Collision.ts';
import { Slicer } from '../src/game/Slicer.ts';
import { Score } from '../src/game/Score.ts';
import { Spawner } from '../src/game/Spawner.ts';
import { Pool } from '../src/game/Pool.ts';
import {
    boxBoundingRadius,
    createSpawnedObject,
    resetSpawnedObject,
} from '../src/game/SpawnedObject.ts';
import type { SpawnedObject } from '../src/game/SpawnedObject.ts';

/** Horizontal-by-default segment helper; z stays on the play plane. */
function seg(x1: number, y1: number, x2: number, y2: number): { from: Vector3; to: Vector3 } {
    return { from: new Vector3(x1, y1, 0), to: new Vector3(x2, y2, 0) };
}

function hit(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    pad = 0,
): boolean {
    return segmentSphere(
        new Vector3(x1, y1, 0),
        new Vector3(x2, y2, 0),
        new Vector3(cx, cy, cz),
        radius,
        pad,
    );
}

/** Live object at (x, 0, 0) with the given def data. */
function stock(
    pool: Pool<SpawnedObject>,
    x: number,
    score: number,
    defId: string,
    category: ObjectCategory,
    radius = 0.87,
): SpawnedObject {
    const object = pool.acquire();
    if (!object) throw new Error('test pool exhausted');

    object.position.set(x, 0, 0);
    object.radius = radius;
    object.score = score;
    object.defId = defId;
    object.category = category;
    object.active = true;
    return object;
}

/** A live parent for Debris spawn tests. */
function liveParent(): SpawnedObject {
    const parent = createSpawnedObject();
    parent.position.set(0, 0, 0);
    parent.velocity.set(1, 2, 0.4);
    parent.angularVelocity.set(2, 0, 0);
    parent.defId = 'pumpkin';
    parent.category = 'target';
    parent.radius = 0.87;
    parent.score = 1;
    parent.active = true;
    return parent;
}

// ===== hit test: sphere-vs-segment =====
console.log('Hit test');
{
    const r = 0.87;
    check('through-center hits', hit(-5, 0, 5, 0, 0, 0, 0, r));
    check('clear miss above', !hit(-5, 0, 5, 0, 0, 5, 0, r));
    check('exact graze counts (<=)', hit(-5, 0, 5, 0, 0, r, 0, r));
    check('just outside the graze misses', !hit(-5, 0, 5, 0, 0, r + 0.001, 0, r));
    check('past the segment end misses', !hit(0, 0, 1, 0, 2, 0, 0, 0.5));
    check('beyond the end still hits within radius', hit(0, 0, 1, 0, 1.4, 0, 0, 0.5));
    check('before the segment start still hits within radius', hit(0, 0, 1, 0, -0.4, 0, 0, 0.5));
    check('segment fully inside the sphere hits', hit(-0.1, 0, 0.1, 0, 0, 0, 0, 1));
    check('sphere inside the segment span hits', hit(-5, 0, 5, 0, 0, 0, 0, 1));
    check('depth band within reach hits (Decision 3B)', hit(-5, 0, 5, 0, 0, 0, 0.5, r));
    check('depth band out of reach misses', !hit(-5, 0, 5, 0, 0, 0, 2, r));
    check('depth offset at the exact radius hits', hit(-5, 0, 5, 0, 0, 0, r, r));
    check('zero-length segment point-tests as a hit', hit(0, 0, 0, 0, 0, 0.5, 0, 1));
    check('zero-length segment point-tests as a miss', !hit(0, 0, 0, 0, 0, 2, 0, 1));
    check('pad 0 keeps the strict radius', !hit(-5, 0, 5, 0, 0, 0.7, 0, 0.5, 0));
    check('pad widens the reach', hit(-5, 0, 5, 0, 0, 0.7, 0, 0.5, 0.3));
    check('pad smaller than the gap still misses', !hit(-5, 0, 5, 0, 0, 0.7, 0, 0.5, 0.1));
    // 3-4-5 diagonal: distance from (0,5) to the line is exactly 3, inside the span.
    check('diagonal graze from outside', !hit(0, 0, 3, 4, 0, 5, 0, 2.9));
    check('diagonal graze from inside', hit(0, 0, 3, 4, 0, 5, 0, 3.1));
    // Center past the far end clamps t to 1: closest point is the endpoint (3,4).
    check('t clamps at the far endpoint (miss)', !hit(0, 0, 3, 4, 6, 8, 0, 4.9));
    check('t clamps at the far endpoint (hit)', hit(0, 0, 3, 4, 6, 8, 0, 5.1));
}

// ===== Slicer orchestration =====
console.log('Slicer');
{
    const score = new Score();
    const pool = new Pool<SpawnedObject>(4, createSpawnedObject, resetSpawnedObject);
    const pieces: Array<{ defId: string; nx: number; ny: number; radius: number }> = [];
    const cuts: Array<{ defId: string; points: number }> = [];
    const slicer = new Slicer({
        score,
        pieces: (parent, nx, ny) => {
            pieces.push({ defId: parent.defId, nx, ny, radius: parent.radius });
        },
        onCut: (defId, points) => {
            cuts.push({ defId, points });
        },
    });

    stock(pool, 0, 1, 'pumpkin', 'target');
    check('a segment through the object cuts it', slicer.cut(pool, seg(-5, 0, 5, 0)) === 1);
    check('the cut object is released', pool.inUse === 0 && pool.available === 4);
    check('the score takes the object score', score.total === 1, `total=${score.total}`);

    // The piece sink ran BEFORE the release zeroed the object: the captured
    // defId is live, the pool slot's is wiped.
    check('pieces see the live object, not the reset', pieces[0]?.defId === 'pumpkin');
    check('release zeroed the slot afterwards', pool.items[0].defId === '');

    check(
        'a released slot is never re-tested',
        slicer.cut(pool, seg(-5, 0, 5, 0)) === 0 && score.total === 1,
    );

    stock(pool, 0, -1, 'skull', 'restricted');
    slicer.cut(pool, seg(-5, 0, 5, 0));
    check('restricted score is negative', score.total === 0, `total=${score.total}`);

    stock(pool, 0, 1, 'pumpkin', 'target');
    check('a far segment changes nothing', slicer.cut(pool, seg(-5, 9, 5, 9)) === 0);
    check('miss keeps the object and the score', pool.inUse === 1 && score.total === 0);

    // Vertical stroke: d = (0, 10) -> normal (-1, 0).
    pieces.length = 0;
    slicer.cut(pool, seg(0, -5, 0, 5));
    check('vertical stroke normal is (-1, 0)', pieces[0]?.nx === -1 && pieces[0]?.ny === 0);
    check(
        'onCut hook gets defId + points',
        cuts.at(-1)?.defId === 'pumpkin' && cuts.at(-1)?.points === 1,
    );
    check('cuts counter accumulates', slicer.cuts === 3, `cuts=${slicer.cuts}`);

    // One segment, several objects; score sums each object's own def score.
    const multiScore = new Score();
    const multiPool = new Pool<SpawnedObject>(4, createSpawnedObject, resetSpawnedObject);
    const multiSlicer = new Slicer({ score: multiScore, pieces: () => {} });
    stock(multiPool, -2, 1, 'pumpkin', 'target');
    stock(multiPool, 0, -1, 'skull', 'restricted');
    stock(multiPool, 2, 2, 'gourd', 'target');
    check(
        'one segment cuts every object it touches',
        multiSlicer.cut(multiPool, seg(-5, 0, 5, 0)) === 3,
    );
    check('score sums the mixed deltas', multiScore.total === 2, `total=${multiScore.total}`);
    check('all three slots freed', multiPool.inUse === 0);

    // Pad flows from CUT through the Slicer: only the widened reach makes
    // this a hit (gap 0.95 vs radius 0.87 + pad 0.1).
    const padPool = new Pool<SpawnedObject>(2, createSpawnedObject, resetSpawnedObject);
    const padSlicer = new Slicer({ score: new Score(), pieces: () => {} });
    stock(padPool, 0, 1, 'pumpkin', 'target').position.set(0, 0.95, 0);
    check(
        'CUT.pad reaches where the bare radius would not',
        padSlicer.cut(padPool, seg(-5, 0, 5, 0)) === 1,
    );

    // Zero-length drained segment (possible below the gate) still point-tests.
    const pointPool = new Pool<SpawnedObject>(2, createSpawnedObject, resetSpawnedObject);
    const pointSlicer = new Slicer({ score: new Score(), pieces: () => {} });
    stock(pointPool, 0, 1, 'pumpkin', 'target');
    check(
        'zero-length segment cuts what it sits on',
        pointSlicer.cut(pointPool, seg(0, 0, 0, 0)) === 1,
    );
}

// ===== Score model =====
console.log('Score');
{
    const score = new Score();
    check('starts at zero', score.total === 0);
    score.add(1);
    score.add(1);
    check('add accumulates', score.total === 2);
    score.add(-1);
    check('negatives accumulate', score.total === 1);
    score.reset();
    check('reset zeroes (step 6 round boundary)', score.total === 0);
}

// ===== Debris ring =====
console.log('Debris');
{
    // rand = () => 0 pins the wobble at 0.9 for exact numbers.
    const debris = new Debris(
        8,
        () => [0.5, 0.5],
        () => 0,
    );
    const parent = liveParent();
    // Segment (0,0)→(1,0): d = (1,0) -> normal (0,1).
    debris.spawn(parent, 0, 1);
    check('a cut spawns exactly two pieces', debris.activeCount === 2);

    const p0 = debris.pieces[0];
    const p1 = debris.pieces[1];
    check(
        'piece 0 offsets +normal by 0.4 radius',
        p0.position.x === 0 && Math.abs(p0.position.y - 0.87 * 0.4) < 1e-9 && p0.position.z === 0,
    );
    check('piece 1 offsets -normal', Math.abs(p1.position.y + 0.87 * 0.4) < 1e-9);
    check(
        'piece 0 velocity = inherit + separation',
        Math.abs(p0.velocity.x - 0.6) < 1e-9 &&
            Math.abs(p0.velocity.y - (1.2 + 1.8)) < 1e-9 &&
            Math.abs(p0.velocity.z - 0.24) < 1e-9,
    );
    check(
        'piece 1 velocity = inherit - separation',
        Math.abs(p1.velocity.x - 0.6) < 1e-9 && Math.abs(p1.velocity.y - (1.2 - 1.8)) < 1e-9,
    );
    check(
        'the pair tumbles opposed',
        Math.abs(p0.angularVelocity.z - 3.6) < 1e-9 && Math.abs(p1.angularVelocity.z + 3.6) < 1e-9,
    );
    check('parent spin halves into the pieces', Math.abs(p0.angularVelocity.x - 1) < 1e-9);
    check('parent rotation copies over', p0.rotation.equals(parent.rotation));
    check(
        'view dispatch fields ride along',
        p0.pieceIndex === 0 &&
            p1.pieceIndex === 1 &&
            p0.defId === 'pumpkin' &&
            p0.category === 'target' &&
            p0.radius === 0.5,
    );

    debris.step(1 / 60, -100);
    check(
        'integration moves and gravity pulls',
        Math.abs(p0.position.y - (0.348 + 3.0 / 60)) < 1e-9 &&
            Math.abs(p0.velocity.y - (3.0 - 20 / 60)) < 1e-9 &&
            Math.abs(p0.age - 1 / 60) < 1e-9,
    );

    debris.clear();
    check('clear deactivates every piece', debris.activeCount === 0);

    // Floor: despawn below the launch line by the piece's own radius.
    const floored = new Debris(
        4,
        () => [0.5, 0.5],
        () => 0,
    );
    floored.spawn(parent, 0, 1);
    floored.step(1, 0.9); // floor = 0.9 - 0.5 = 0.4
    check('below-launch-line piece despawns', floored.pieces[1].active === false);
    check('rising piece survives the same step', floored.pieces[0].active === true);

    // Life: force-despawn wherever the piece is.
    floored.clear();
    floored.spawn(parent, 0, 1);
    for (let i = 0; i < 100; i += 1) floored.step(0.02, -100); // 2 s > life 1.5
    check('pieces expire at CUT.life', floored.activeCount === 0);

    // Ring: 3 spawns (6 writes) into 4 slots — the oldest pair is overwritten.
    const ring = new Debris(
        4,
        () => [0.5, 0.5],
        () => 0,
    );
    for (let i = 0; i < 3; i += 1) ring.spawn(parent, 0, 1);
    check('drop-oldest saturates at capacity', ring.activeCount === 4, `got=${ring.activeCount}`);
    check('the overwritten slots belong to the newest spawn', ring.pieces[0].pieceIndex === 0);

    // Allocation proxy (PERF-BUDGET): spawn/step reuse slot state forever.
    const vectors = new Set<unknown>();
    for (let i = 0; i < 50; i += 1) {
        ring.spawn(parent, 0, 1);
        ring.step(1 / 60, -100);
    }
    for (const piece of ring.pieces) {
        vectors.add(piece.position);
        vectors.add(piece.velocity);
        vectors.add(piece.rotation);
        vectors.add(piece.angularVelocity);
    }
    check('ring reuses piece state (<= capacity x4)', vectors.size <= 16, `unique=${vectors.size}`);
}

// ===== config + spawn wiring =====
console.log('Config + spawn');
{
    check('CUT.pad is a finite non-negative distance', Number.isFinite(CUT.pad) && CUT.pad >= 0);
    check(
        'CUT piece knobs are sane',
        CUT.pieceScale > 0 &&
            CUT.pieceScale <= 1 &&
            CUT.inherit >= 0 &&
            CUT.inherit <= 1 &&
            CUT.separation > 0 &&
            CUT.spin > 0 &&
            CUT.life > 0,
    );
    check('CUT.capacity holds a full piece pair', CUT.capacity >= 2, `capacity=${CUT.capacity}`);

    const fresh = createSpawnedObject();
    check('a fresh object scores zero', fresh.score === 0);
    fresh.score = 7;
    resetSpawnedObject(fresh);
    check('reset zeroes the score', fresh.score === 0);

    // Step 7: the model seam is parts-only now; only `size` matters here.
    const seamBoxModel = () => ({
        kind: 'parts' as const,
        parts: [{ geometry: new BoxGeometry(1, 1, 1), color: '#ffffff' }],
        size: 1,
    });

    // The Spawner copies def.score onto the launch (rand = () => 0 pins the
    // def pick to defs[0]; speed 1 keeps the aim math NaN-free).
    const defs = [
        {
            id: 'a',
            name: 'A',
            score: 3,
            category: 'target' as const,
            model: seamBoxModel(),
        },
        {
            id: 'b',
            name: 'B',
            score: -2,
            category: 'restricted' as const,
            model: seamBoxModel(),
        },
    ];
    const rules: SpawnRules = {
        intervalRange: { early: [1, 1], late: [1, 1] },
        batchRange: { early: [1, 1], late: [1, 1] },
        speedRange: [1, 1],
        apexRange: [0.5, 0.5],
        depthRange: [0, 0],
        spinRange: [0, 0],
        sideLaunchChance: 0,
    };
    const bounds: PlayBounds = { centerY: 0, halfHeight: 7, halfWidth: 10 };
    const pool = new Pool<SpawnedObject>(2, createSpawnedObject, resetSpawnedObject);
    new Spawner({ rules, defs, rand: () => 0 }).step(pool, bounds, 1, 0);
    // The pool's free stack pops from the end, so the launch lives in the
    // last slot — find the checked-out item rather than assuming an index.
    const launched = pool.items.find((object) => object.active);
    check(
        'the spawner launches with the def score',
        launched?.score === 3,
        `score=${launched?.score}`,
    );

    // Chopping-bug regression (2026-10-21): z offsets shrink the blade's
    // reach and parallax-shift objects, so spawns stay on the play plane.
    check(
        'theme spawns on the play plane (depthRange [0, 0])',
        halloween.spawnRules.depthRange[0] === 0 && halloween.spawnRules.depthRange[1] === 0,
    );
    check('depth drift is off (SPAWN.depthDrift 0)', SPAWN.depthDrift === 0);
    const maxSpawnZ = Math.max(...halloween.spawnRules.depthRange.map((z) => Math.abs(z)));
    const allReachable = halloween.objects.every(
        (def) => maxSpawnZ <= boxBoundingRadius(def.model.size) + CUT.pad,
    );
    check('every spawn z is within blade reach (radius + pad)', allReachable);
}

if (failures > 0) {
    throw new Error(`${failures} cut check(s) failed`);
}

console.log(`\nALL PASS — ${total} checks`);
