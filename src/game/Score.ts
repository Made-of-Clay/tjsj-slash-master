/**
 * Running score (step 5, Decisions D/E) — a model only. Display, round timer
 * and the per-round reset call land in step 6. The sign convention lives in
 * theme data: target defs score positive, restricted defs negative, so this
 * class just accumulates.
 */
export class Score {
    #total = 0;

    /** Points accumulated this round. */
    get total(): number {
        return this.#total;
    }

    add(points: number): void {
        this.#total += points;
    }

    /** Step 6 calls this between rounds. */
    reset(): void {
        this.#total = 0;
    }
}
