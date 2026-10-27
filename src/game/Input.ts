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
export type StrokeStartHandler = (world: Vector3) => void;
export type StrokeMoveHandler = (world: Vector3) => void;
export type StrokeEndHandler = () => void;

// A resting finger, or a hand holding a mouse button, trembles a pixel or two.
// Anything shorter than this is noise, not a swipe — and because the sample is
// compared against the last *emitted* point, jitter around a fixed spot never
// adds up, while a slow deliberate drag still emits once it crosses the floor.
// CSS pixels, not NDC: the floor must mean the same on a phone and a desktop.
const MIN_SEGMENT_PX = 6;

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
    #strokeStartHandlers: StrokeStartHandler[] = [];
    #strokeMoveHandlers: StrokeMoveHandler[] = [];
    #strokeEndHandlers: StrokeEndHandler[] = [];

    /** The pointer currently dragging. A second finger must not hijack it. */
    #pointerId: number | null = null;
    #hasPrevious = false;

    // Cached on pointerdown: reading getBoundingClientRect per move can force
    // a layout flush, and a resize mid-swipe is not a case worth paying for.
    #rect: DOMRect | null = null;

    /** CSS-pixel positions; only converted to NDC when projecting. */
    #previous = new Vector2();
    #current = new Vector2();
    #from = new Vector3();
    #to = new Vector3();
    /** Reused wrapper over `#from`/`#to`; handlers must copy what they keep. */
    #segment: SwipeSegment = { from: this.#from, to: this.#to };

    constructor(target: HTMLElement, project: Projector) {
        this.#target = target;
        this.#project = project;

        target.addEventListener('pointerdown', this.#pointerDownHandler);
        target.addEventListener('pointermove', this.#pointerMoveHandler);
        target.addEventListener('pointerup', this.#pointerUpHandler);
        target.addEventListener('pointercancel', this.#pointerUpHandler);
    }

    onSwipe(handler: SwipeHandler): void {
        this.#handlers.push(handler);
    }

    onStrokeStart(handler: StrokeStartHandler): void {
        this.#strokeStartHandlers.push(handler);
    }

    onStrokeMove(handler: StrokeMoveHandler): void {
        this.#strokeMoveHandlers.push(handler);
    }

    onStrokeEnd(handler: StrokeEndHandler): void {
        this.#strokeEndHandlers.push(handler);
    }

    /**
     * Ends any in-flight stroke without a pointerup (tab hidden, app switched,
     * cancelled gesture) and re-arms input for the next pointerdown.
     */
    cancelStroke(): void {
        if (this.#pointerId === null) return;

        if (this.#target.hasPointerCapture(this.#pointerId)) {
            this.#target.releasePointerCapture(this.#pointerId);
        }
        for (const handler of this.#strokeEndHandlers) {
            handler();
        }

        this.#pointerId = null;
        this.#hasPrevious = false;
        this.#rect = null;
    }

    dispose(): void {
        this.#target.removeEventListener('pointerdown', this.#pointerDownHandler);
        this.#target.removeEventListener('pointermove', this.#pointerMoveHandler);
        this.#target.removeEventListener('pointerup', this.#pointerUpHandler);
        this.#target.removeEventListener('pointercancel', this.#pointerUpHandler);
        this.#handlers.length = 0;
        this.#strokeStartHandlers.length = 0;
        this.#strokeMoveHandlers.length = 0;
        this.#strokeEndHandlers.length = 0;
        this.#pointerId = null;
    }

    /** Handler passed as callback to event listener */
    #pointerDownHandler = (event: PointerEvent): void => {
        if (this.#pointerId !== null) return;

        this.#pointerId = event.pointerId;
        this.#rect = this.#target.getBoundingClientRect();
        if (!this.#toPixels(event, this.#previous)) return;

        // Capture keeps the stroke alive if the finger leaves the canvas, which
        // is the normal case for a full-screen swipe.
        this.#target.setPointerCapture(event.pointerId);
        this.#hasPrevious = true;
        this.#projectPixels(this.#previous, this.#from);
        for (const handler of this.#strokeStartHandlers) {
            handler(this.#from);
        }
    };

    /** Handler passed as callback to event listener  */
    #pointerMoveHandler = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId || !this.#hasPrevious) return;

        // A fast flick on a 120Hz screen can pack several samples into one
        // frame. Coalesced events recover the intermediate positions instead of
        // aliasing a long stroke down to a single segment. Older Safari has no
        // such API, and then the event itself is the only sample.
        const samples =
            typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
        if (samples.length === 0) {
            this.#emit(event);
            return;
        }

        for (const sample of samples) {
            this.#emit(sample);
        }
    };

    /** Handler passed as callback to event listener  */
    #pointerUpHandler = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId) return;
        this.cancelStroke();
    };

    #emit(event: PointerEvent): void {
        if (!this.#toPixels(event, this.#current)) return;

        if (this.#current.distanceToSquared(this.#previous) < MIN_SEGMENT_PX * MIN_SEGMENT_PX) {
            return;
        }

        this.#projectPixels(this.#previous, this.#from);
        this.#projectPixels(this.#current, this.#to);
        this.#previous.copy(this.#current);

        for (const handler of this.#strokeMoveHandlers) {
            handler(this.#to);
        }

        if (this.#handlers.length === 0) return;

        for (const handler of this.#handlers) {
            handler(this.#segment);
        }
    }

    #toPixels(event: PointerEvent, out: Vector2): boolean {
        const rect = this.#rect ?? this.#target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        out.set(event.clientX - rect.left, event.clientY - rect.top);
        return true;
    }

    #projectPixels(point: Vector2, out: Vector3): void {
        const rect = this.#rect ?? this.#target.getBoundingClientRect();
        this.#project((point.x / rect.width) * 2 - 1, -((point.y / rect.height) * 2 - 1), out);
    }
}
