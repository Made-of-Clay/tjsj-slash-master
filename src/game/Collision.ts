import type { Object3D } from 'three/webgpu';

/** Swipe-versus-object hit test. Step 4. */
export class Collision {
    intersects(swipe: unknown, object: Object3D): boolean {
        void swipe;
        void object;
        throw new Error('not implemented: Collision arrives in step 4');
    }
}
