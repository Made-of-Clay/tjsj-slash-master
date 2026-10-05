import { FIXED_STEP, FPS_SMOOTHING, MAX_FRAME_SECONDS, MAX_SUB_STEPS } from '../config';

export interface LoopHooks {
    /** Advance simulation by exactly one fixed step. */
    fixedUpdate(dt: number): void;
    /** Draw. `alpha` is 0..1 interpolation between the last two sim states. */
    render(alpha: number): void;
}

export interface LoopOptions {
    step?: number;
    maxSubSteps?: number;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Fixed-timestep loop.
 *
 * The frame source is supplied by the caller (`renderer.setAnimationLoop`), so
 * the app never has two rAF loops fighting each other.
 *
 * Allocation-free per frame: all state lives in fields.
 */
export class GameLoop {
    readonly step: number;
    readonly maxSubSteps: number;

    #hooks: LoopHooks;
    /** Caller intent: has start() been called? */
    #running = false;
    /** Hidden-tab suppression, independent of caller intent. */
    #paused = false;
    /** Whether #lastTimestamp holds a real frame time yet. */
    #primed = false;
    #lastTimestamp = 0;
    #accumulator = 0;
    #fps = 0;

    constructor(hooks: LoopHooks, options: LoopOptions = {}) {
        this.#hooks = hooks;
        this.step = options.step ?? FIXED_STEP;
        this.maxSubSteps = options.maxSubSteps ?? MAX_SUB_STEPS;

        // Registered once, for the lifetime of the object. Binding this to
        // start()/stop() instead would mean the first auto-pause unregisters
        // the very listener that has to resume the loop — the tab would stay
        // frozen forever after one background.
        document.addEventListener('visibilitychange', this.#onVisibilityChange);
    }

    get running(): boolean {
        return this.#running;
    }

    get paused(): boolean {
        return this.#paused;
    }

    /** True when a frame should actually be simulated and drawn. */
    get active(): boolean {
        return this.#running && !this.#paused;
    }

    /** Smoothed frames per second. Zero while stopped. */
    get fps(): number {
        return this.#fps;
    }

    start(): void {
        if (this.#running) return;

        this.#running = true;
        this.#fps = 0;
        this.#discardBacklog();
    }

    stop(): void {
        this.#running = false;
    }

    dispose(): void {
        document.removeEventListener('visibilitychange', this.#onVisibilityChange);
        this.#running = false;
    }

    /** Called by `renderer.setAnimationLoop`. Ignored while stopped. */
    tick = (timestamp: number): void => {
        if (!this.active) return;

        // First frame after a start or a resume: nothing to diff against yet.
        // A dedicated flag rather than a `timestamp === 0` sentinel, because 0
        // is a legal frame time.
        if (!this.#primed) {
            this.#primed = true;
            this.#lastTimestamp = timestamp;
            this.#hooks.render(0);
            return;
        }

        const rawDelta = (timestamp - this.#lastTimestamp) / 1000;
        this.#lastTimestamp = timestamp;

        // A backgrounded tab or a long GC hands us one enormous delta. Clamping
        // here — not just via maxSubSteps — is what stops the spiral, because
        // the accumulator never even sees the stall.
        const elapsed = Math.min(rawDelta, MAX_FRAME_SECONDS);

        if (elapsed > 0) {
            const instantFps = 1 / elapsed;
            this.#fps = this.#fps === 0 ? instantFps : lerp(this.#fps, instantFps, FPS_SMOOTHING);
        }

        this.#accumulator += elapsed;

        let steps = 0;
        while (this.#accumulator >= this.step && steps < this.maxSubSteps) {
            this.#hooks.fixedUpdate(this.step);
            this.#accumulator -= this.step;
            steps += 1;
        }

        // Out of sub-step budget: drop the backlog. Running slow beats spiraling.
        if (this.#accumulator >= this.step) {
            this.#accumulator = 0;
        }

        this.#hooks.render(this.#accumulator / this.step);
    };

    /**
     * Throws away the gap accumulated while not drawing.
     *
     * Without this, the first tick back owes every step missed during the
     * pause, and the tab locks up trying to catch up.
     */
    #discardBacklog(): void {
        this.#primed = false;
        this.#lastTimestamp = 0;
        this.#accumulator = 0;
    }

    #onVisibilityChange = (): void => {
        // Hidden tabs still get rAF in some browsers. Skipping the work is the
        // single biggest battery win available (PLAN.md step 8).
        this.#paused = document.hidden;
        this.#discardBacklog();
    };
}
