import { Mesh, SphereGeometry } from 'three/webgpu';
import { GAME_PLANE_DEPTH } from '../config';
import { createPulseMaterial } from './Materials';

/**
 * Placeholder object, so the foundation is verifiable: it proves the renderer
 * initialised, the TSL graph compiles, and the camera frames the play plane.
 *
 * Deleted in step 2, when the playfield replaces it.
 */
export function createPlaceholder(): Mesh<SphereGeometry, ReturnType<typeof createPulseMaterial>> {
    const geometry = new SphereGeometry(1.6, 32, 32);
    const material = createPulseMaterial('#22c1c3', '#ff7a45');
    const mesh = new Mesh(geometry, material);

    // On the gameplay plane, so a swipe passes through it.
    mesh.position.z = GAME_PLANE_DEPTH;

    return mesh;
}
