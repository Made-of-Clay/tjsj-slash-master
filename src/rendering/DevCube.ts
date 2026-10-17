import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three/webgpu';
import { GAME_PLANE_DEPTH, PLAY_BOUNDS } from '../config';

/**
 * Temporary lit subject for step-2 tuning (lighting, tone mapping, palette).
 *
 * The placeholder sphere was deleted in workstream F; this is its stand-in
 * until step 3 spawns real objects. Delete once those land.
 */

const SIZE = 2;
const X_TILT = Math.PI / 7;
const Z_TILT = Math.PI / 7;
const SPIN_SPEED = 0.8;

export interface DevCube {
    mesh: Mesh<BoxGeometry, MeshStandardMaterial>;
    update(dt: number): void;
}

export function createDevCube(): DevCube {
    const mesh = new Mesh(
        new BoxGeometry(SIZE, SIZE, SIZE),
        new MeshStandardMaterial({ color: '#ff7a45' }),
    );

    // Centre of the play field, on the gameplay plane so a swipe passes through.
    mesh.position.set(0, PLAY_BOUNDS.centerY, GAME_PLANE_DEPTH);
    mesh.rotation.x = X_TILT;
    mesh.rotation.z = Z_TILT;

    return {
        mesh,
        update(dt) {
            mesh.rotation.y += SPIN_SPEED * dt;
        },
    };
}
