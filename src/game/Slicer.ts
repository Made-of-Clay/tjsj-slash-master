import { CUT } from '../config';
import { segmentSphere } from './Collision';
import type { SwipeSegment } from './Input';
import type { Pool } from './Pool';
import type { Score } from './Score';
import type { SpawnedObject } from './SpawnedObject';

/**
 * Called for each cut with the object about to be released and the slice
 * normal (unit length, on the play plane). Absent until step 5B wires the
 * debris ring. The sink must copy what it keeps — `pool.release` zeroes the
 * object right after the call.
 */
export type PieceSink = (parent: SpawnedObject, nx: number, ny: number) => void;

export interface SlicerConfig {
    /** Score model; each cut adds the object's def score (+ target, − restricted). */
    score: Score;
    /** Piece visual sink; optional until 5B lands. */
    pieces?: PieceSink;
    /** Optional dev hook (DEBUG_CUT): defId + points per cut. */
    onCut?: (defId: string, points: number) => void;
    /** Fires once for each hazard cut. */
    onHazard?: () => void;
}

/**
 * Turns drained swipe segments into cuts (step 5, Decision G).
 *
 * Runs inside `swipes.drain(...)` at the top of `fixedUpdate`, so every test
 * is against pre-move pool state (Decision 4C) and the latest sim state
 * (Decision 3A — no interpolation). Deterministic: no RNG here — the piece
 * sink owns any jitter (Decision 3F lives with the debris ring in 5B).
 *
 * Cut semantics: every live object the segment touches is cut — first hit
 * wins per object, because `pool.release` inside the scan makes later
 * segments (and any residual overlap) skip the freed slot. Score and pieces
 * are handed off BEFORE the release zeroes the object.
 */
export class Slicer {
    #score: Score;
    #pieces: PieceSink | undefined;
    #onCut: SlicerConfig['onCut'];
    #onHazard: SlicerConfig['onHazard'];
    /** Cumulative objects cut — for harnesses and debug. */
    #cuts = 0;

    constructor(config: SlicerConfig) {
        this.#score = config.score;
        this.#pieces = config.pieces;
        this.#onCut = config.onCut;
        this.#onHazard = config.onHazard;
    }

    get cuts(): number {
        return this.#cuts;
    }

    /**
     * Tests one segment against the whole pool. `pad` (`CUT.pad`) widens each
     * object's sphere a little — forgiveness on the cut path.
     *
     * @returns how many objects were cut.
     */
    cut(pool: Pool<SpawnedObject>, segment: SwipeSegment): number {
        // Slice normal: the segment direction rotated 90° in the play plane.
        // Segments are near-degenerate only below Input's jitter filter, so
        // the zero-length fallback (pointing +x) never fires in practice.
        const dx = segment.to.x - segment.from.x;
        const dy = segment.to.y - segment.from.y;
        const lengthSq = dx * dx + dy * dy;
        let nx = 1;
        let ny = 0;
        if (lengthSq > 0) {
            const inverse = 1 / Math.sqrt(lengthSq);
            nx = -dy * inverse;
            ny = dx * inverse;
        }

        let cutCount = 0;
        const items = pool.items;

        // Indexed over `items` + `active`: no per-segment callback closure.
        for (let index = 0; index < items.length; index += 1) {
            const object = items[index];
            if (!object.active) continue;

            if (!segmentSphere(segment.from, segment.to, object.position, object.radius, CUT.pad)) {
                continue;
            }

            this.#score.add(object.score);
            this.#pieces?.(object, nx, ny);
            this.#onCut?.(object.defId, object.score);
            if (object.category === 'hazard') this.#onHazard?.();
            pool.release(object);
            cutCount += 1;
        }

        this.#cuts += cutCount;
        return cutCount;
    }
}
