import { Vector3 } from 'three/webgpu';
import type { SwipeSegment } from './Input';

/**
 * Swipe capture for the fixed-step sim: a gated ring buffer (steps 4A–B).
 *
 * `Input` emits on `pointermove` — outside `GameLoop.fixedUpdate` — and its
 * `SwipeSegment` vectors are reused instances. This buffer copies each segment
 * into a preallocated slot at push time (PERF-BUDGET: no per-segment
 * allocation), so step 5's collision can test segments against sim state from
 * inside the step, deterministic with respect to render timing.
 *
 * **Gating (4B).** A stroke goes live once the pointer is `gateDistance` world
 * units away from where the stroke started; segments before that are dropped,
 * so a tap or a resting finger never slices. Distance from the origin, not
 * accumulated path length — a held finger trembles back and forth, and a
 * path-length gate opens on that alone. Once live the stroke stays live until it ends —
 * a slow deliberate drag keeps cutting (Fruit-Ninja behaviour). The segment
 * that opens the gate is buffered whole: it may start short of the threshold,
 * but segment chains stay contiguous (each `from` = previous `to`).
 *
 * Pure gameplay: no DOM, so `verify-swipe` can construct it under bun. The
 * visibility-based `clear()` is wired in `main.ts`, not here.
 */
export class Swipes {
    readonly #gateDistance: number;
    /** Unconsumed segments live in a fixed ring; overflow drops the oldest. */
    readonly #slots: SwipeSegment[];
    /** Next slot to overwrite on push. */
    #write = 0;
    /** Next slot to hand to a drain handler. */
    #read = 0;
    #pending = 0;
    /** First sample of the current stroke; the gate measures distance from it. */
    readonly #origin = new Vector3();
    #hasOrigin = false;
    /** Gate state: opens at `#gateDistance`, closes on the next stroke boundary. */
    #live = false;

    /**
     * @param gateDistance displacement from the stroke origin before segments
     *   count, world units on the play plane (0 = ungated)
     * @param capacity ring size, in segments
     */
    constructor(gateDistance: number, capacity = 32) {
        this.#gateDistance = gateDistance;
        const size = Math.max(1, Math.floor(capacity));
        this.#slots = Array.from({ length: size }, () => ({
            from: new Vector3(),
            to: new Vector3(),
        }));
    }

    /** Segments waiting for the next fixed step. */
    get pending(): number {
        return this.#pending;
    }

    /** Whether this stroke's gate has opened. */
    get live(): boolean {
        return this.#live;
    }

    /** Stroke boundary (`Input.onStrokeStart`): the gate opens from zero again. */
    beginStroke(): void {
        this.#hasOrigin = false;
        this.#live = false;
    }

    /**
     * Stroke boundary (`Input.onStrokeEnd`): resets gate state only — buffered
     * segments must still reach the next fixed step, so the ring is untouched.
     */
    endStroke(): void {
        this.#hasOrigin = false;
        this.#live = false;
    }

    /**
     * Copies `segment` into the ring, gated: while the stroke is under
     * `gateDistance` travel the segment only counts toward the gate, it is
     * not buffered. When the ring is full the oldest unconsumed segment is
     * dropped — a stale miss matters least.
     */
    push(segment: SwipeSegment): void {
        if (!this.#live) {
            if (!this.#hasOrigin) {
                this.#origin.copy(segment.from);
                this.#hasOrigin = true;
            }
            if (this.#origin.distanceTo(segment.to) < this.#gateDistance) return;
            this.#live = true;
        }

        const slot = this.#slots[this.#write];
        slot.from.copy(segment.from);
        slot.to.copy(segment.to);
        this.#write = (this.#write + 1) % this.#slots.length;

        if (this.#pending === this.#slots.length) {
            this.#read = (this.#read + 1) % this.#slots.length;
        } else {
            this.#pending += 1;
        }
    }

    /**
     * Hands every pending segment to `handler`, in capture order, and marks
     * them consumed. `handler` is optional so a step with no consumer (or no
     * debug logging) can still empty the ring without allocating a closure.
     *
     * Synchronous: `handler` must not call `push` (pointer events cannot run
     * during a fixed step — same thread). Segments passed to `handler` are
     * ring-owned and valid only for the duration of the call.
     *
     * @returns how many segments were consumed.
     */
    drain(handler?: (segment: SwipeSegment) => void): number {
        const count = this.#pending;
        while (this.#pending > 0) {
            handler?.(this.#slots[this.#read]);
            this.#read = (this.#read + 1) % this.#slots.length;
            this.#pending -= 1;
        }
        return count;
    }

    /**
     * Drops everything pending. Backlog discard only (tab switch/resume) —
     * never on stroke end: the stroke's final segments must still reach the
     * next fixed step.
     */
    clear(): void {
        this.#read = 0;
        this.#write = 0;
        this.#pending = 0;
    }
}
