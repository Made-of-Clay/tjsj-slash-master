import { Vector3 } from 'three/webgpu';
import { EFFECTS } from '../config';
import type { ObjectCategory } from '../content/types';

/** One spark shard (step 9A). Presentation only: never scored or re-sliced. */
export interface Spark {
    position: Vector3;
    velocity: Vector3;
    /** Seconds lived; despawns at `life`. */
    age: number;
    life: number;
    /** World size at spawn; the view shrinks it over `life`. */
    size: number;
    /** View dispatch: which category's spark mesh to draw. */
    category: ObjectCategory;
    active: boolean;
}

/**
 * Cut-spark ring (step 9A). Fixed capacity, drop-oldest on overflow, ballistic
 * integration mirroring `Debris` so sparks and pieces read as one event.
 *
 * Pure gameplay-side state: no DOM, no scene graph — `SparkViews` binds them.
 */
export class Effects {
    /** Construction-order view of every slot; views key off `active`. */
    readonly sparks: readonly Spark[];
    /** Next slot to overwrite — ring order is spawn order. */
    #write = 0;
    #rand: () => number;

    constructor(capacity: number = EFFECTS.capacity, rand?: () => number) {
        const size = Math.max(1, Math.floor(capacity));
        this.#rand = rand ?? Math.random;
        this.sparks = Array.from({ length: size }, (): Spark => ({
            position: new Vector3(),
            velocity: new Vector3(),
            age: 0,
            life: 0,
            size: 0,
            category: 'target',
            active: false,
        }));
    }

    /**
     * Emits one burst at `(x, y)` along the slice normal `(nx, ny)`.
     *
     * @returns how many sparks were spawned.
     */
    burst(
        x: number,
        y: number,
        radius: number,
        nx: number,
        ny: number,
        category: ObjectCategory,
    ): number {
        const count = EFFECTS.perCut;

        for (let index = 0; index < count; index += 1) {
            const spark = this.sparks[this.#write];
            this.#write = (this.#write + 1) % this.sparks.length;

            // Spread the origins along the cut, not at a single point.
            const along = (this.#rand() * 2 - 1) * radius * 0.5;
            const side = (this.#rand() * 2 - 1) * radius * 0.35;
            spark.position.set(x + nx * along - ny * side, y + ny * along + nx * side, 0);

            // Opposed halves of the burst, so the cut opens like the pieces do.
            const direction = index % 2 === 0 ? 1 : -1;
            const outward = EFFECTS.speed * (0.35 + this.#rand() * 0.9) * direction;
            const scatter = (this.#rand() * 2 - 1) * EFFECTS.speed * EFFECTS.spread;
            spark.velocity.set(nx * outward - ny * scatter, ny * outward + nx * scatter, 0);

            spark.age = 0;
            spark.life = EFFECTS.life * (0.6 + this.#rand() * 0.8);
            spark.size = EFFECTS.size * (0.6 + this.#rand() * 0.8);
            spark.category = category;
            spark.active = true;
        }

        return count;
    }

    step(dt: number): void {
        const damping = Math.max(0, 1 - EFFECTS.damping * dt);
        const sparks = this.sparks;

        for (let index = 0; index < sparks.length; index += 1) {
            const spark = sparks[index];
            if (!spark.active) continue;

            spark.age += dt;
            if (spark.age >= spark.life) {
                spark.active = false;
                continue;
            }

            spark.velocity.x *= damping;
            spark.velocity.y = spark.velocity.y * damping - EFFECTS.gravity * dt;
            spark.position.x += spark.velocity.x * dt;
            spark.position.y += spark.velocity.y * dt;
        }
    }

    clear(): void {
        for (let index = 0; index < this.sparks.length; index += 1) {
            this.sparks[index].active = false;
        }
    }
}
