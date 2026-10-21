/**
 * Round clock (step 6, Decisions A/B): pure scalar state, no DOM.
 *
 * `over` latches at the buzzer; `fixedUpdate` early-returns on it and runs
 * `step(dt)` last, so the step that crosses the buzzer completes fully and
 * every later step is frozen. `progress` feeds the spawn ramp (Decision 3E).
 */
export class Round {
    readonly duration: number;
    #elapsed = 0;
    #over = false;

    constructor(duration: number) {
        if (!(duration > 0)) {
            throw new Error('Round requires a positive duration');
        }
        this.duration = duration;
    }

    /** True once time is up; stays true until reset(). */
    get over(): boolean {
        return this.#over;
    }

    /** Round completion, 0..1. Spawner's ramp reads this. */
    get progress(): number {
        return Math.min(this.#elapsed / this.duration, 1);
    }

    /** Whole seconds remaining, for the timer display (30 at start, 0 at 0). */
    get secondsLeft(): number {
        return Math.max(0, Math.ceil(this.duration - this.#elapsed));
    }

    step(dt: number): void {
        if (this.#over) return;

        this.#elapsed = Math.min(this.#elapsed + dt, this.duration);
        if (this.#elapsed >= this.duration) {
            this.#over = true;
        }
    }

    /** Back to boot state — round 2 must equal round 1. */
    reset(): void {
        this.#elapsed = 0;
        this.#over = false;
    }
}
