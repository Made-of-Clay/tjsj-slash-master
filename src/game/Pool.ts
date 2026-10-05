const FREE = 0;
const IN_USE = 1;

/**
 * Fixed-capacity object pool.
 *
 * Sized and filled once in the constructor. It never grows: a pool that grows
 * allocates in exactly the frame that needed the object, which is the frame
 * with no headroom for it.
 *
 * `acquire`/`release` are O(1) — an index stack plus a Map for reverse lookup,
 * both built up front. No splice, no per-item wrapper objects, no garbage.
 */
export class Pool<T> {
    readonly size: number;

    #items: T[] = [];
    #slots = new Map<T, number>();
    #free: number[] = [];
    #state: Uint8Array;
    #reset: (item: T) => void;
    #inUse = 0;

    constructor(size: number, factory: () => T, reset: (item: T) => void) {
        this.size = size;
        this.#reset = reset;
        this.#state = new Uint8Array(size);

        for (let index = 0; index < size; index += 1) {
            const item = factory();
            this.#items.push(item);
            this.#slots.set(item, index);
            this.#free.push(index);
        }
    }

    get available(): number {
        return this.#free.length;
    }

    get inUse(): number {
        return this.#inUse;
    }

    /** Undefined when exhausted. Callers decide: skip, or recycle oldest. */
    acquire(): T | undefined {
        const index = this.#free.pop();
        if (index === undefined) return undefined;

        this.#state[index] = IN_USE;
        this.#inUse += 1;
        return this.#items[index];
    }

    /** Safe to call twice on the same item; the second call is a no-op. */
    release(item: T): void {
        const index = this.#slots.get(item);
        if (index === undefined || this.#state[index] === FREE) return;

        this.#state[index] = FREE;
        this.#reset(item);
        this.#free.push(index);
        this.#inUse -= 1;
    }

    /** Iterate only the checked-out items. Allocation-free. */
    each(visit: (item: T) => void): void {
        for (let index = 0; index < this.size; index += 1) {
            if (this.#state[index] === IN_USE) {
                visit(this.#items[index]);
            }
        }
    }
}
