export type FlowState = 'ready' | 'playing' | 'paused';

/**
 * Screen-flow state (step 9D): boot waits on the start card, a round runs,
 * and a pause holds the sim without stopping the render loop. The hidden-tab
 * pause in `GameLoop` remains the authority underneath — this never touches it.
 */
export class Flow {
    #state: FlowState = 'ready';

    get state(): FlowState {
        return this.#state;
    }

    /** True only while a started round runs; `fixedUpdate` gates on this. */
    get active(): boolean {
        return this.#state === 'playing';
    }

    start(): void {
        if (this.#state === 'ready') this.#state = 'playing';
    }

    pause(): void {
        if (this.#state === 'playing') this.#state = 'paused';
    }

    resume(): void {
        if (this.#state === 'paused') this.#state = 'playing';
    }

    /** A restart is a second tap, so it skips the start card. */
    restart(): void {
        this.#state = 'playing';
    }

    reset(): void {
        this.#state = 'ready';
    }
}
