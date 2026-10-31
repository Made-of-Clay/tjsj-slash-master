import { COMBO } from '../config';

/**
 * Time-window combo (step 9B, reworked after the held-pointer bug): the k-th cut
 * of a live chain banks `COMBO.step × (k − 1)`. Every cut restarts the window;
 * when it lapses the bank pays out and the chain starts over.
 *
 * The window, not the pointer stroke, defines the chain — holding the pointer
 * down without cutting can no longer keep the multiplier climbing, and the
 * count on screen always matches cuts that landed in quick succession.
 */
export class Combo {
    #count = 0;
    #bank = 0;
    #remaining = 0;

    /** Cuts in the live chain (display only). */
    get count(): number {
        return this.#count;
    }

    /** Registers `cuts` hits: each extends the window and banks its step. */
    register(cuts: number): number {
        if (cuts <= 0) return this.#count;

        for (let index = 0; index < cuts; index += 1) {
            this.#count += 1;
            if (this.#count > 1) this.#bank += COMBO.step * (this.#count - 1);
        }
        this.#remaining = COMBO.windowSeconds;
        return this.#count;
    }

    /**
     * Ages the window by `dt` and returns the bank once it lapses (0 while the
     * chain is still open). Runs once per fixed step, before that step's cuts.
     */
    step(dt: number): number {
        if (this.#count === 0) return 0;

        this.#remaining -= dt;
        return this.#remaining > 0 ? 0 : this.flush();
    }

    /** Closes the chain early (pause, buzzer) and returns what it banked. */
    flush(): number {
        const paid = this.#bank;
        this.#count = 0;
        this.#bank = 0;
        this.#remaining = 0;
        return paid;
    }

    reset(): void {
        this.flush();
    }
}
