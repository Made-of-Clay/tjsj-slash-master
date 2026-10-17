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
 * Full-width policy (step 2 course correction): the playfield height is the
 * fixed design dimension, the width is derived from the aspect, and the camera
 * sits at a constant distance so world scale is identical on every device.
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
import { CAMERA, GAME_PLANE_DEPTH, LAUNCH_LINE_Y, PLAYFIELD } from '../src/config.ts';
import {
    computePlayBounds,
    createCamera,
    createPlayField,
    createSwipeProjector,
} from '../src/rendering/Camera.ts';
import {
    clampToBounds,
    contains,
    createDebugRect,
    writeDebugRect,
} from '../src/rendering/PlayArea.ts';

const aspects = [21 / 9, 16 / 9, 4 / 3, 1, 3 / 4, 9 / 16, 9 / 19.5];
const tanHalf = Math.tan((CAMERA.fov * Math.PI) / 360);

// Bounds used by the pure contains/clamp checks, at the portrait design aspect.
const bounds = computePlayBounds(PLAYFIELD, CAMERA.fov, 9 / 16);
const { halfWidth, halfHeight, centerY } = bounds;
const minY = centerY - halfHeight;
const maxY = centerY + halfHeight;

// ===== bounds derivation (full-width) =====
console.log('Bounds derivation');
{
    let fixedHeight = true;
    let positive = true;
    let growsWithAspect = true;
    let spansMinusMargin = true;
    let insideView = true;
    let previous = Infinity;

    for (const aspect of aspects) {
        const b = computePlayBounds(PLAYFIELD, CAMERA.fov, aspect);
        const distance = createCamera(aspect).position.z;
        const halfViewW = distance * tanHalf * aspect;

        if (b.halfHeight !== PLAYFIELD.halfHeight || b.centerY !== PLAYFIELD.centerY)
            fixedHeight = false;
        if (b.halfWidth <= 0) positive = false;
        if (b.halfWidth > previous + 1e-9) growsWithAspect = false;
        previous = b.halfWidth;
        if (Math.abs(b.halfWidth - (halfViewW - PLAYFIELD.sideMargin)) > 1e-9)
            spansMinusMargin = false;
        if (b.halfWidth > halfViewW + 1e-9) insideView = false;
    }

    check('height and centre are the fixed design values', fixedHeight);
    check('width is positive at every target aspect', positive);
    check('width tracks the aspect (monotonic)', growsWithAspect);
    check('field spans the full width minus the side margin', spansMinusMargin);
    check('field never overflows the visible width', insideView);
}

// ===== camera distance =====
console.log('Camera distance');
{
    const distances = aspects.map((aspect) => createCamera(aspect).position.z);
    const spread = Math.max(...distances) - Math.min(...distances);
    check('distance is independent of aspect (no lurch)', spread < 1e-9, `spread=${spread}`);

    let everyCornerInside = true;
    for (const aspect of aspects) {
        const b = computePlayBounds(PLAYFIELD, CAMERA.fov, aspect);
        const halfViewH = createCamera(aspect).position.z * tanHalf;
        const halfViewW = halfViewH * aspect;

        for (const [dx, dy] of [
            [-b.halfWidth, -b.halfHeight],
            [b.halfWidth, -b.halfHeight],
            [b.halfWidth, b.halfHeight],
            [-b.halfWidth, b.halfHeight],
        ] as const) {
            const ndcX = dx / halfViewW;
            const ndcY = (dy - b.centerY) / halfViewH;
            if (Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) everyCornerInside = false;
        }
    }
    check('every field corner lands inside NDC at all target aspects', everyCornerInside);
}

// ===== contains =====
console.log('contains');
{
    check('centre is inside', contains(bounds, 0, centerY));
    check('left edge is inside (inclusive)', contains(bounds, -halfWidth, centerY));
    check('right edge is inside (inclusive)', contains(bounds, halfWidth, centerY));
    check('bottom edge is inside (inclusive)', contains(bounds, 0, minY));
    check('top edge is inside (inclusive)', contains(bounds, 0, maxY));
    check('just outside left is out', !contains(bounds, -halfWidth - 1e-6, centerY));
    check('just outside right is out', !contains(bounds, halfWidth + 1e-6, centerY));
    check('just outside bottom is out', !contains(bounds, 0, minY - 1e-6));
    check('just outside top is out', !contains(bounds, 0, maxY + 1e-6));
    check('far outside is out', !contains(bounds, 1e6, -1e6));
    check('a corner is inside (inclusive)', contains(bounds, halfWidth, maxY));
}

// ===== clampToBounds =====
console.log('clampToBounds');
{
    const inside = { x: 1, y: centerY + 1 };
    check('returns the same object (no allocation)', clampToBounds(bounds, inside) === inside);
    check('an inside point is unchanged', inside.x === 1 && inside.y === centerY + 1);

    check(
        'x clamps to the right edge',
        clampToBounds(bounds, { x: halfWidth + 5, y: centerY }).x === halfWidth,
    );
    check(
        'x clamps to the left edge',
        clampToBounds(bounds, { x: -halfWidth - 5, y: centerY }).x === -halfWidth,
    );
    check('y clamps to the top edge', clampToBounds(bounds, { x: 0, y: maxY + 5 }).y === maxY);
    check('y clamps to the bottom edge', clampToBounds(bounds, { x: 0, y: minY - 5 }).y === minY);

    const corner = clampToBounds(bounds, { x: -1e6, y: 1e6 });
    check('a far corner clamps on both axes', corner.x === -halfWidth && corner.y === maxY);

    let allContained = true;
    for (let x = -20; x <= 20; x += 0.5) {
        for (let y = -20; y <= 20; y += 0.5) {
            const point = clampToBounds(bounds, { x, y });
            if (!contains(bounds, point.x, point.y)) allContained = false;
        }
    }
    check('every clamped point is contained', allContained);

    const vector = new Vector3(halfWidth * 4, minY * 4, 9);
    const returned = clampToBounds(bounds, vector);
    check(
        'works on a Vector3, preserving z and identity',
        returned === vector && vector.x === halfWidth && vector.y === minY && vector.z === 9,
    );
}

// ===== launch line =====
console.log('Launch line');
{
    check('LAUNCH_LINE_Y is the field bottom edge', LAUNCH_LINE_Y === minY, `got ${LAUNCH_LINE_Y}`);
    check('the launch line is in-play at x = 0', contains(bounds, 0, LAUNCH_LINE_Y));
}

// ===== debug rect =====
console.log('Debug rect');
{
    const rect = createDebugRect(bounds);
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

    // Geometry is float32 on the GPU, so compare within float32 tolerance.
    const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-5;

    let matches = true;
    let flat = true;
    for (let i = 0; i < expected.length; i += 1) {
        if (!near(position.getX(i), expected[i][0]) || !near(position.getY(i), expected[i][1]))
            matches = false;
        if (position.getZ(i) !== 0) flat = false;
    }
    check('corners match the bounds', matches);
    check(
        'the last point closes the loop',
        near(position.getX(4), expected[0][0]) && near(position.getY(4), expected[0][1]),
    );
    check('lies on the play plane', flat);

    // Reframe to a wide aspect and confirm the rect follows the new width.
    const wide = computePlayBounds(PLAYFIELD, CAMERA.fov, 21 / 9);
    writeDebugRect(rect, wide);
    const updated = rect.geometry.getAttribute('position');
    check(
        'writeDebugRect rewrites the outline for new bounds',
        near(updated.getX(0), -wide.halfWidth) &&
            near(updated.getY(0), wide.centerY - wide.halfHeight),
    );
    check('the rewritten outline still closes', near(updated.getX(4), updated.getX(0)));
}

// ===== projector regression =====
console.log('Projector regression');
{
    const camera = createCamera(9 / 19.5);
    createPlayField(camera).reframe(16 / 9);
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
