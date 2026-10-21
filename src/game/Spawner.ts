import { DEBUG_SPAWN, GRAVITY, LAUNCH_LINE_Y, SPAWN } from '../config';
import type { GameObjectDefinition, RampRange, SpawnRange, SpawnRules } from '../content/types';
import type { PlayBounds } from '../rendering/Camera';
import type { Pool } from './Pool';
import { boxBoundingRadius } from './SpawnedObject';
import type { SpawnedObject } from './SpawnedObject';

export interface SpawnerConfig {
    /** Theme-owned launch rules. Gameplay reads them; the theme file stays unseen. */
    rules: SpawnRules;
    /** Candidate object defs; each spawn picks one uniformly at random. */
    defs: readonly GameObjectDefinition[];
    /**
     * Injectable RNG (step 3 decision F), so the launch harness can seed a
     * deterministic arc. Production passes nothing and gets Math.random.
     */
    rand?: () => number;
}

function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Uniform sample from a constant `[min, max]`. */
function sampleRange(range: SpawnRange, rand: () => number): number {
    return range[0] + rand() * (range[1] - range[0]);
}

/**
 * Uniform sample from a range that ramps with round progress: `early` at
 * progress 0, `late` at 1. Written inline (no tuple allocation) because this
 * runs on the spawn path — the per-frame allocation budget has no room for a
 * throwaway `[min, max]`.
 */
function sampleRamp(ramp: RampRange, progress: number, rand: () => number): number {
    const t = clamp01(progress);
    const min = lerp(ramp.early[0], ramp.late[0], t);
    const max = lerp(ramp.early[1], ramp.late[1], t);
    return min + rand() * (max - min);
}

/** Batch size: an integer count, so the ramped range is rounded per endpoint. */
function sampleBatch(ramp: RampRange, progress: number, rand: () => number): number {
    const t = clamp01(progress);
    const min = Math.round(lerp(ramp.early[0], ramp.late[0], t));
    const max = Math.round(lerp(ramp.early[1], ramp.late[1], t));
    return Math.round(min + rand() * (max - min));
}

/**
 * Closed-form ballistic aim. These three are the whole trajectory contract and
 * are exported (pure, allocation-free) so `scripts/verify-launch.ts` can assert
 * the arc without driving the spawner's RNG:

 *   vy = sqrt(2·g·(apexY − y0))     reach `apexY` from `y0`
 *   tFlight = 2·vy / g              full up-and-down flight time
 *   vx = (targetX − x0) / tFlight   land at `targetX`
 */

/** Vertical launch speed that peaks at `apexY` (never NaN; clamps negative rise). */
export function launchVy(y0: number, apexY: number, gravity: number): number {
    return Math.sqrt(2 * gravity * Math.max(apexY - y0, 0));
}

/** Flight time of a vertical launch `vy` that returns to its launch height. */
export function flightTime(vy: number, gravity: number): number {
    return (2 * vy) / gravity;
}

/** Horizontal speed that carries `x0` to `targetX` over `tFlight`. */
export function aimVx(x0: number, targetX: number, tFlight: number): number {
    return (targetX - x0) / tFlight;
}

/**
 * Launches pooled objects along guaranteed on-screen arcs (PLAN.md §3, step 3D).
 *
 * The point of this class is the aim math: rather than drawing a random
 * velocity and hoping the arc stays in frame, it picks a spawn point, an apex
 * height and a target X, then derives the velocity that hits them in closed
 * form. Random velocity produces off-screen arcs on phone aspect ratios; this
 * cannot.
 *
 * Allocation-free: the only per-frame state is the timer, and every sample is
 * inline arithmetic. `step` re-reads the live `bounds` every spawn, so a resize
 * between spawns is picked up (live objects are ballistic and are not
 * re-clamped — see Physics).
 */
export class Spawner {
    #rules: SpawnRules;
    #defs: readonly GameObjectDefinition[];
    #rand: () => number;
    /** Seconds accumulated toward the next spawn event. */
    #timer = 0;
    /** Objects wanted but not spawned because the pool was full (diagnostics). */
    #skipped = 0;
    #warnedExhausted = false;

    constructor(config: SpawnerConfig) {
        if (config.defs.length === 0) {
            throw new Error('Spawner requires at least one object definition');
        }

        this.#rules = config.rules;
        this.#defs = config.defs;
        this.#rand = config.rand ?? Math.random;
    }

    /** Cumulative count of spawns the pool was too full to serve. */
    get skipped(): number {
        return this.#skipped;
    }

    /**
     * Advance the spawn clock by one fixed step and fire as many whole events as
     * `dt` covers. `progress` (0..1) is the round's completion; step 6 owns the
     * real timer, so it is threaded in rather than stored.
     */
    step(pool: Pool<SpawnedObject>, bounds: PlayBounds, dt: number, progress: number): void {
        this.#timer += dt;

        // Re-sample the interval after each fire so a batch's size and the gap
        // that follows it are independent draws, and so the ramp is honoured
        // across a multi-event step.
        let interval = this.#nextInterval(progress);
        while (this.#timer >= interval) {
            this.#timer -= interval;
            this.#fire(pool, bounds, progress);
            interval = this.#nextInterval(progress);
        }
    }

    #nextInterval(progress: number): number {
        return sampleRamp(this.#rules.intervalRange, progress, this.#rand);
    }

    #fire(pool: Pool<SpawnedObject>, bounds: PlayBounds, progress: number): void {
        const batch = sampleBatch(this.#rules.batchRange, progress, this.#rand);

        for (let index = 0; index < batch; index += 1) {
            const object = pool.acquire();
            if (!object) {
                // Pool exhausted: drop the rest of this batch silently, count
                // it, and never grow the pool (step 3 decision — skip, no throw).
                this.#skipped += batch - index;
                this.#warnExhausted();
                return;
            }

            this.#configure(object, bounds);
        }
    }

    /**
     * Builds one launch. Spawn point, apex and target are chosen first; the
     * velocity falls out of the ballistic closed form:
     *
     *   vy = sqrt(2·g·(apexY − y0))     (reach the apex, then fall back)
     *   tFlight = 2·vy / g              (symmetric up/down)
     *   vx = (targetX − x0) / tFlight   (arrive at targetX when it lands)
     *
     * `apexRange` follows the `SpawnRules` contract ("apex height as a fraction
     * of FULL field height above the launch line"), so a value of 0.8 peaks at
     * 80% of the way up the field, never near the top edge.
     *
     * `speedRange` scales vy, which shifts the apex but not the horizontal aim:
     * the object still lands at targetX, it just doesn't climb as high — the
     * "never a guaranteed hit" jitter. Because that jitter can only push the
     * apex up, vy is finally clamped so the arc can never leave the top of the
     * field — the guarantee holds for any theme data, not just tuned data.
     */
    #configure(object: SpawnedObject, bounds: PlayBounds): void {
        const def =
            this.#defs[
                Math.min(Math.floor(this.#rand() * this.#defs.length), this.#defs.length - 1)
            ];
        const radius = boxBoundingRadius(def.model.size);
        const inset = Math.max(bounds.halfWidth - radius, 0);
        const y0 = LAUNCH_LINE_Y - radius;

        // Field bottom is the launch line; "full field height" is 2*halfHeight.
        const apexY =
            LAUNCH_LINE_Y + sampleRange(this.#rules.apexRange, this.#rand) * 2 * bounds.halfHeight;
        let vy = launchVy(y0, apexY, GRAVITY) * sampleRange(this.#rules.speedRange, this.#rand);

        // Hard ceiling: cap vy so the jittered peak cannot exceed the field top.
        // Binds only when apexRange + speedRange are aggressive, so tuned data
        // is untouched while untuned data still cannot launch off-screen.
        const ceilingVy = launchVy(y0, bounds.centerY + bounds.halfHeight, GRAVITY);
        if (vy > ceilingVy) {
            vy = ceilingVy;
        }

        const tFlight = flightTime(vy, GRAVITY);

        const sideLaunch = this.#rand() < this.#rules.sideLaunchChance;
        let x0: number;
        let targetX: number;

        if (sideLaunch) {
            // Start just outside one edge and aim well inside the far half, so
            // the object crosses the field and cannot exit before the apex.
            const side = this.#rand() < 0.5 ? -1 : 1;
            x0 = side * (bounds.halfWidth + radius);
            targetX = -side * inset * SPAWN.sideTargetInset;
        } else {
            x0 = (this.#rand() * 2 - 1) * inset;
            targetX = (this.#rand() * 2 - 1) * inset;
        }

        const vx = aimVx(x0, targetX, tFlight);
        const vz = (this.#rand() * 2 - 1) * SPAWN.depthDrift;

        object.position.set(x0, y0, sampleRange(this.#rules.depthRange, this.#rand));
        object.velocity.set(vx, vy, vz);
        object.rotation.set(0, 0, 0);
        object.angularVelocity.set(
            sampleRange(this.#rules.spinRange, this.#rand),
            sampleRange(this.#rules.spinRange, this.#rand),
            sampleRange(this.#rules.spinRange, this.#rand),
        );
        object.defId = def.id;
        object.category = def.category;
        object.radius = radius;
        // Mirrors checkout; the view layer keys mesh visibility off it.
        object.active = true;
    }

    #warnExhausted(): void {
        if (this.#warnedExhausted) return;
        this.#warnedExhausted = true;

        if (DEBUG_SPAWN) {
            console.warn('spawner: pool exhausted — skipping spawns (the pool never grows)');
        }
    }
}
