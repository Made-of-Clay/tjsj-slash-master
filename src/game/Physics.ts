import type { PlayBounds } from '../rendering/Camera';
import { GRAVITY } from '../config';
import type { Pool } from './Pool';
import type { SpawnedObject } from './SpawnedObject';

/**
 * Ballistic integration + despawn (step 3A). No physics engine — PLAN.md §3
 * specifies the integrator: position and Euler rotation advance by velocity
 * times the fixed step, gravity feeds velocity.
 */
export class Physics {
    /**
     * One fixed step for every checked-out object. Objects that fall past the
     * launch line or leave the field sideways are released back to `pool`
     * (reset included, via the pool's reset callback).
     *
     * `dt` is always `FIXED_STEP` — GameLoop guarantees it, so there is no
     * variable-delta guard here to maintain.
     */
    step(pool: Pool<SpawnedObject>, bounds: PlayBounds, dt: number): void {
        // Bottom edge of the live bounds; identical to LAUNCH_LINE_Y by
        // construction (both derive from PLAYFIELD), but this stays correct
        // if the bounds are ever re-derived for another reason.
        const bottom = bounds.centerY - bounds.halfHeight;
        const halfWidth = bounds.halfWidth;
        const items = pool.items;

        // Indexed over `items` + `active` (the checkout mirror): no per-step
        // callback closure, which `each()` would allocate.
        for (let index = 0; index < items.length; index += 1) {
            const object = items[index];
            if (!object.active) continue;

            // Integration order per PLAN.md §3: position first, then gravity.
            object.position.x += object.velocity.x * dt;
            object.position.y += object.velocity.y * dt;
            object.position.z += object.velocity.z * dt;
            object.velocity.y -= GRAVITY * dt;

            object.rotation.x += object.angularVelocity.x * dt;
            object.rotation.y += object.angularVelocity.y * dt;
            object.rotation.z += object.angularVelocity.z * dt;

            // Past the launch line while still falling: a miss. No penalty
            // until step 6; the slot is simply recycled.
            if (object.position.y < bottom - object.radius && object.velocity.y < 0) {
                pool.release(object);
                continue;
            }

            // Outside the field sideways while still moving outward. Side
            // launches *start* outside and travel in, so their velocity sign
            // opposes their position sign and they do not trip this.
            const x = object.position.x;
            if (
                Math.abs(x) > halfWidth + object.radius &&
                Math.sign(x) === Math.sign(object.velocity.x)
            ) {
                pool.release(object);
            }
        }
    }
}
