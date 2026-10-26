import { COMBO } from '../config';

/**
 * Per-stroke combo (step 9B): counts cuts inside one stroke and pays an
 * additive bonus for every cut past the first.
 *
 * Stroke identity comes from `Swipes.stroke`, which only advances when a new
 * stroke begins — pointer-event timing never leaks into scoring, and a gated
 * tap cannot break a combo. `Score` stays an add-only accumulator.
 */
export class Combo {
    /** Stroke the count belongs to; -1 = none yet. */
    #stroke = -1;
    #count = 0;

    /** Cuts in the current stroke (display only). */
    get count(): number {
        return this.#count;
    }

    /**
     * Registers `cuts` hits from stroke `stroke` and returns the bonus owed for
     * them: the k-th cut of a stroke pays `COMBO.step × (k − 1)`.
     */
    register(stroke: number, cuts: number): number {
        if (stroke !== this.#stroke) {
            this.#stroke = stroke;
            this.#count = 0;
        }

        let bonus = 0;
        for (let index = 0; index < cuts; index += 1) {
            this.#count += 1;
            if (this.#count > 1) {
                bonus += COMBO.step * (this.#count - 1);
            }
        }
        return bonus;
    }

    /** New stroke: the count restarts, so a stale combo never displays. */
    beginStroke(): void {
        this.#count = 0;
    }

    reset(): void {
        this.#stroke = -1;
        this.#count = 0;
    }
}
