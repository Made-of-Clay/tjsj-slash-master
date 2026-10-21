import { Euler, Vector3 } from 'three/webgpu';
import type { ObjectCategory } from '../content/types';

/**
 * One pooled launchable object (PLAN.md §3). Pure state: no scene-graph
 * references — rendering binds a view to it (workstream B), gameplay never
 * touches a mesh.
 */
export interface SpawnedObject {
    position: Vector3;
    velocity: Vector3;
    rotation: Euler;
    angularVelocity: Vector3;
    /** Content id from `GameObjectDefinition`; gameplay's handle on "what". */
    defId: string;
    category: ObjectCategory;
    /** Bounding-sphere radius: despawn margins + step 5 collision. */
    radius: number;
    /** Points awarded when cut: `def.score` copied at launch (+ target, − restricted). */
    score: number;
    /**
     * Mirrors pool checkout. The pool's slot state governs iteration; this
     * flag exists for view layers (key `visible` off it) and debugging. The
     * launcher sets true on acquire, `resetSpawnedObject` sets false.
     */
    active: boolean;
}

/** Zeroed and ready for the pool. Called on every `pool.release`. */
export function createSpawnedObject(): SpawnedObject {
    return {
        position: new Vector3(),
        velocity: new Vector3(),
        rotation: new Euler(),
        angularVelocity: new Vector3(),
        defId: '',
        category: 'target',
        radius: 0,
        score: 0,
        active: false,
    };
}

/**
 * `pool.release`'s reset callback: wipes every field so a recycled object can
 * never inherit a stale velocity or category (PERF-BUDGET: rotation/scratch
 * reset is step 3's to own).
 */
export function resetSpawnedObject(object: SpawnedObject): void {
    object.position.set(0, 0, 0);
    object.velocity.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.angularVelocity.set(0, 0, 0);
    object.defId = '';
    object.category = 'target';
    object.radius = 0;
    object.score = 0;
    object.active = false;
}

/**
 * Bounding sphere of a `size`-ed cube. Rotation-invariant, so despawn and
 * (step 5) collision can use one number instead of the live orientation.
 */
export function boxBoundingRadius(size: number): number {
    return (size * Math.sqrt(3)) / 2;
}
