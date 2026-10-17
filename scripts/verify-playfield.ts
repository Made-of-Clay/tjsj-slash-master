/*
 * Playfield checks for step 2.
 *
 *   bun scripts/verify-playfield.ts
 *
 * Plain assertions over the pure play-area contract (src/rendering/PlayArea.ts)
 * and its interaction with camera framing. No test framework and no GPU: the
 * TSL background needs a device, but BufferGeometry, Line and
 * PerspectiveCamera all construct without a rendering context.
 *
 * Fit-formula internals (monotonicity, pure-height floor) also appear in
 * verify-foundation.ts; they are repeated here so this harness can stand alone
 * as the step-2 gate.
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
import { CAMERA, GAME_PLANE_DEPTH, LAUNCH_LINE_Y, PLAY_BOUNDS } from '../src/config.ts';
import {
    applyFraming,
    computeFitDistance,
    createCamera,
    createSwipeProjector,
} from '../src/rendering/Camera.ts';
import { clampToBounds, contains, createDebugRect } from '../src/rendering/PlayArea.ts';

const { halfWidth, halfHeight, centerY } = PLAY_BOUNDS;
const minY = centerY - halfHeight;
const maxY = centerY + halfHeight;
const aspects = [21 / 9, 16 / 9, 4 / 3, 1, 3 / 4, 9 / 16, 9 / 19.5];
const tanHalf = Math.tan((CAMERA.fov * Math.PI) / 360);

// ===== fit distance =====
console.log('Fit distance');
{
    const pureHeight = halfHeight / tanHalf;
    let monotonic = true;
    let atLeastHeight = true;
    let previous = 0;

    for (const aspect of aspects) {
        const distance = computeFitDistance(halfWidth, halfHeight, CAMERA.fov, aspect);
        if (distance + 1e-9 < pureHeight) atLeastHeight = false;
        if (distance < previous - 1e-9) monotonic = false;
        previous = Math.max(previous, distance);
    }

    check('never dips below the pure-height distance', atLeastHeight);
    check('is monotonic non-decreasing as aspect narrows', monotonic);
}

// ===== contains =====
console.log('contains');
{
    check('centre is inside', contains(PLAY_BOUNDS, 0, centerY));
    check('left edge is inside (inclusive)', contains(PLAY_BOUNDS, -halfWidth, centerY));
    check('right edge is inside (inclusive)', contains(PLAY_BOUNDS, halfWidth, centerY));
    check('bottom edge is inside (inclusive)', contains(PLAY_BOUNDS, 0, minY));
    check('top edge is inside (inclusive)', contains(PLAY_BOUNDS, 0, maxY));
    check('just outside left is out', !contains(PLAY_BOUNDS, -halfWidth - 1e-6, centerY));
    check('just outside right is out', !contains(PLAY_BOUNDS, halfWidth + 1e-6, centerY));
    check('just outside bottom is out', !contains(PLAY_BOUNDS, 0, minY - 1e-6));
    check('just outside top is out', !contains(PLAY_BOUNDS, 0, maxY + 1e-6));
    check('far outside is out', !contains(PLAY_BOUNDS, 1e6, -1e6));
    check('a corner is inside (inclusive)', contains(PLAY_BOUNDS, halfWidth, maxY));
}

// ===== clampToBounds =====
console.log('clampToBounds');
{
    const inside = { x: 1, y: centerY + 1 };
    check('returns the same object (no allocation)', clampToBounds(PLAY_BOUNDS, inside) === inside);
    check('an inside point is unchanged', inside.x === 1 && inside.y === centerY + 1);

    check(
        'x clamps to the right edge',
        clampToBounds(PLAY_BOUNDS, { x: halfWidth + 5, y: centerY }).x === halfWidth,
    );
    check(
        'x clamps to the left edge',
        clampToBounds(PLAY_BOUNDS, { x: -halfWidth - 5, y: centerY }).x === -halfWidth,
    );
    check('y clamps to the top edge', clampToBounds(PLAY_BOUNDS, { x: 0, y: maxY + 5 }).y === maxY);
    check(
        'y clamps to the bottom edge',
        clampToBounds(PLAY_BOUNDS, { x: 0, y: minY - 5 }).y === minY,
    );

    const corner = clampToBounds(PLAY_BOUNDS, { x: -1e6, y: 1e6 });
    check('a far corner clamps on both axes', corner.x === -halfWidth && corner.y === maxY);

    let allContained = true;
    for (let x = -20; x <= 20; x += 0.5) {
        for (let y = -20; y <= 20; y += 0.5) {
            const point = clampToBounds(PLAY_BOUNDS, { x, y });
            if (!contains(PLAY_BOUNDS, point.x, point.y)) allContained = false;
        }
    }
    check('every clamped point is contained', allContained);

    const vector = new Vector3(halfWidth * 4, minY * 4, 9);
    const returned = clampToBounds(PLAY_BOUNDS, vector);
    check(
        'works on a Vector3, preserving z and identity',
        returned === vector && vector.x === halfWidth && vector.y === minY && vector.z === 9,
    );
}

// ===== launch line =====
console.log('Launch line');
{
    check('LAUNCH_LINE_Y is the arena bottom edge', LAUNCH_LINE_Y === minY, `got ${LAUNCH_LINE_Y}`);
    check('the launch line is in-play at x = 0', contains(PLAY_BOUNDS, 0, LAUNCH_LINE_Y));
}

// ===== debug rect =====
console.log('Debug rect');
{
    const rect = createDebugRect(PLAY_BOUNDS);
    const position = rect.geometry.getAttribute('position');
    const expected: Array<[number, number]> = [
        [-halfWidth, minY],
        [halfWidth, minY],
        [halfWidth, maxY],
        [-halfWidth, maxY],
    ];

    // Closed Line (not LineLoop): 4 corners + a repeat of the first to close it.
    check(
        'has a point per corner plus a closing point',
        position.count === 5,
        `got ${position.count}`,
    );

    let matches = true;
    let flat = true;
    for (let i = 0; i < expected.length; i += 1) {
        if (position.getX(i) !== expected[i][0] || position.getY(i) !== expected[i][1])
            matches = false;
        if (position.getZ(i) !== 0) flat = false;
    }
    check('corners match PLAY_BOUNDS exactly', matches);
    check(
        'the last point closes the loop',
        position.getX(4) === expected[0][0] && position.getY(4) === expected[0][1],
    );
    check('lies on the play plane', flat);

    let everyCornerInside = true;
    for (const aspect of aspects) {
        const distance = createCamera(aspect).position.z;
        const halfViewH = distance * tanHalf;
        const halfViewW = halfViewH * aspect;

        for (let i = 0; i < expected.length; i += 1) {
            const ndcX = position.getX(i) / halfViewW;
            const ndcY = (position.getY(i) - centerY) / halfViewH;
            if (Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) everyCornerInside = false;
        }
    }
    check('stays fully in frame at every target aspect', everyCornerInside);
}

// ===== projector regression =====
console.log('Projector regression');
{
    const camera = createCamera(9 / 19.5);
    applyFraming(camera, PLAY_BOUNDS, 16 / 9);
    const project = createSwipeProjector(camera);
    const out = new Vector3();

    let onPlane = true;
    for (const [ndcX, ndcY] of [
        [0, 0],
        [1, 1],
        [-1, -1],
        [0.6, -0.9],
        [-0.3, 0.8],
    ] as const) {
        project(ndcX, ndcY, out);
        if (Math.abs(out.z - GAME_PLANE_DEPTH) > 1e-9) onPlane = false;
    }
    check('reframing keeps the swipe ray on the play plane', onPlane);
}

if (failures > 0) {
    throw new Error(`${failures} playfield check(s) failed`);
}

console.log('\nALL PASS');
