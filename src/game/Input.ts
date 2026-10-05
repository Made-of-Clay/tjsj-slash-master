import { Vector2, Vector3 } from 'three/webgpu';

/** Maps a normalized device coordinate onto the gameplay plane. */
export type Projector = (ndcX: number, ndcY: number, out: Vector3) => void;

/**
 * A swipe stroke, in world space on the gameplay plane.
 *
 * `from` and `to` are reused instances. Handlers must copy them if they keep
 * the values past the call (step 5 will, when it builds slice geometry).
 */
export interface SwipeSegment {
    readonly from: Vector3;
    readonly to: Vector3;
}

export type SwipeHandler = (segment: SwipeSegment) => void;

// Sub-pixel jitter from a resting finger; ignored so we don't emit stubs.
const MIN_SEGMENT_NDC = 0.004;

/**
 * Pointer input, normalised to swipe segments.
 *
 * Pointer Events only: mouse, touch and pen all arrive as PointerEvents, so
 * there is exactly one code path and no `touchstart`/`mousedown` divergence.
 *
 * `project` is injected instead of importing the camera, which keeps `game/`
 * free of `rendering/` imports.
 */
export class Input {
    #target: HTMLElement;
    #project: Projector;
    #handlers: SwipeHandler[] = [];

    /** The pointer currently dragging. A second finger must not hijack it. */
    #pointerId: number | null = null;
    #hasPrevious = false;

    // Cached on pointerdown: reading getBoundingClientRect per move can force
    // a layout flush, and a resize mid-swipe is not a case worth paying for.
    #rect: DOMRect | null = null;

    #previous = new Vector2();
    #current = new Vector2();
    #from = new Vector3();
    #to = new Vector3();

    constructor(target: HTMLElement, project: Projector) {
        this.#target = target;
        this.#project = project;

        target.addEventListener('pointerdown', this.#onPointerDown);
        target.addEventListener('pointermove', this.#onPointerMove);
        target.addEventListener('pointerup', this.#onPointerUp);
        target.addEventListener('pointercancel', this.#onPointerUp);
    }

    onSwipe(handler: SwipeHandler): void {
        this.#handlers.push(handler);
    }

    dispose(): void {
        this.#target.removeEventListener('pointerdown', this.#onPointerDown);
        this.#target.removeEventListener('pointermove', this.#onPointerMove);
        this.#target.removeEventListener('pointerup', this.#onPointerUp);
        this.#target.removeEventListener('pointercancel', this.#onPointerUp);
        this.#handlers.length = 0;
        this.#pointerId = null;
    }

    #onPointerDown = (event: PointerEvent): void => {
        if (this.#pointerId !== null) return;

        this.#pointerId = event.pointerId;
        this.#rect = this.#target.getBoundingClientRect();
        if (!this.#toNdc(event, this.#previous)) return;

        // Capture keeps the stroke alive if the finger leaves the canvas, which
        // is the normal case for a full-screen swipe.
        this.#target.setPointerCapture(event.pointerId);
        this.#hasPrevious = true;
    };

    #onPointerMove = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId || !this.#hasPrevious) return;

        // A fast flick on a 120Hz screen can pack several samples into one
        // frame. Coalesced events recover the intermediate positions instead of
        // aliasing a long stroke down to a single segment.
        const samples = event.getCoalescedEvents();
        if (samples.length === 0) {
            this.#emit(event);
            return;
        }

        for (const sample of samples) {
            this.#emit(sample);
        }
    };

    #onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId) return;

        this.#pointerId = null;
        this.#hasPrevious = false;
        this.#rect = null;

        if (this.#target.hasPointerCapture(event.pointerId)) {
            this.#target.releasePointerCapture(event.pointerId);
        }
    };

    #emit(event: PointerEvent): void {
        if (!this.#toNdc(event, this.#current)) return;

        if (this.#current.distanceToSquared(this.#previous) < MIN_SEGMENT_NDC * MIN_SEGMENT_NDC) {
            return;
        }

        this.#project(this.#previous.x, this.#previous.y, this.#from);
        this.#project(this.#current.x, this.#current.y, this.#to);
        this.#previous.copy(this.#current);

        if (this.#handlers.length === 0) return;

        // Single reused segment: no garbage per segment.
        const segment: SwipeSegment = { from: this.#from, to: this.#to };
        for (const handler of this.#handlers) {
            handler(segment);
        }
    }

    #toNdc(event: PointerEvent, out: Vector2): boolean {
        const rect = this.#rect ?? this.#target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        out.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        );
        return true;
    }
}
