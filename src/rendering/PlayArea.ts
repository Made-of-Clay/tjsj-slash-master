import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three/webgpu';
import type { PlayBounds } from './Camera';

/**
 * The play-area contract step 3's `Spawner` consumes: pure, allocation-free
 * bounds tests. Kept out of `game/` because the bounds are a rendering-space
 * concern (world-space field), not a gameplay rule.
 */

/**
 * Is the world-space point `(x, y)` inside `bounds`? Edges are inclusive, so a
 * point exactly on the launch line or a side counts as in-play.
 */
export function contains(bounds: PlayBounds, x: number, y: number): boolean {
    return (
        x >= -bounds.halfWidth &&
        x <= bounds.halfWidth &&
        y >= bounds.centerY - bounds.halfHeight &&
        y <= bounds.centerY + bounds.halfHeight
    );
}

/** Anything with mutable `x`/`y` — a `Vector3`, `Vector2`, or a plain object. */
export interface ClampTarget {
    x: number;
    y: number;
}

/**
 * Writes the nearest in-bounds point into `out` and returns it.
 *
 * Mutates rather than returning a fresh point, so it is safe to call per swipe
 * segment with zero allocation (see docs/PERF-BUDGET.md). Generic in `out` so
 * the caller keeps its concrete type.
 */
export function clampToBounds<T extends ClampTarget>(bounds: PlayBounds, out: T): T {
    const minX = -bounds.halfWidth;
    const maxX = bounds.halfWidth;
    const minY = bounds.centerY - bounds.halfHeight;
    const maxY = bounds.centerY + bounds.halfHeight;

    out.x = Math.min(Math.max(out.x, minX), maxX);
    out.y = Math.min(Math.max(out.y, minY), maxY);

    return out;
}

/** Four corners plus a repeat of the first, to close the outline. */
const CORNERS: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
];

/**
 * Rewrites `rect`'s geometry to outline the current `bounds` on the play plane
 * (`z = 0`). Called on every resize, since the playfield width is derived from
 * the aspect.
 */
export function writeDebugRect(rect: Line, bounds: PlayBounds): void {
    const { halfWidth, halfHeight, centerY } = bounds;
    const position = rect.geometry.getAttribute('position') as BufferAttribute;

    CORNERS.forEach(([sx, sy], index) => {
        position.setXYZ(index, sx * halfWidth, centerY + sy * halfHeight, 0);
    });
    position.needsUpdate = true;
    rect.geometry.computeBoundingSphere();
}

/**
 * Debug-only closed `Line` outlining `bounds` on the play plane (`z = 0`).
 *
 * A `Line`, not a `LineLoop`: the WebGPU renderer rejects `LineLoop` outright
 * ("Objects of type THREE.LineLoop are not supported"), so the loop is closed by
 * repeating the first point instead.
 *
 * The caller gates this behind `DEBUG_PLAYFIELD`, so the rect and its geometry
 * are dropped from the production bundle. Useful while tuning `PLAYFIELD` to
 * confirm the drawn field matches the numbers the fit math uses.
 */
export function createDebugRect(bounds: PlayBounds): Line {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(CORNERS.length * 3), 3));

    const rect = new Line(geometry, new LineBasicMaterial({ color: 0x2ee6a0 }));
    writeDebugRect(rect, bounds);

    return rect;
}
