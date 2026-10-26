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
 * **Gating (4B).** A stroke goes live once the pointer has travelled
 * `gateDistance` world units; segments before that are dropped, so a tap or a
 * resting finger never slices. Once live the stroke stays live until it ends —
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
    /** Pointer travel in the current stroke, counted since the gate last closed. */
    #traveled = 0;
    /** Gate state: opens at `#gateDistance`, closes on the next stroke boundary. */
    #live = false;
    /** Monotonic stroke id (step 9B): combo identity, never reset by clear(). */
    #stroke = 0;

    /**
     * @param gateDistance stroke travel before segments count, world units on
     *   the play plane (0 = ungated)
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

    /** Id of the latest stroke; advances on `beginStroke` only. */
    get stroke(): number {
        return this.#stroke;
    }

    /** Stroke boundary (`Input.onStrokeStart`): the gate opens from zero again. */
    beginStroke(): void {
        this.#stroke += 1;
        this.#traveled = 0;
        this.#live = false;
    }

    /**
     * Stroke boundary (`Input.onStrokeEnd`): resets gate state only — buffered
     * segments must still reach the next fixed step, so the ring is untouched.
     */
    endStroke(): void {
        this.#traveled = 0;
        this.#live = false;
    }

    /**
     * Copies `segment` into the ring, gated: while the stroke is under
     * `gateDistance` travel the segment only counts toward the gate, it is
     * not buffered. When the ring is full the oldest unconsumed segment is
     * dropped — a stale miss matters least.
     */
    push(segment: SwipeSegment): void {
        this.#traveled += segment.from.distanceTo(segment.to);

        if (!this.#live) {
            if (this.#traveled < this.#gateDistance) return;
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
