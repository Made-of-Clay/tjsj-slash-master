import {
    BufferAttribute,
    BufferGeometry,
    Line,
    LineBasicMaterial,
    Scene,
    Vector3,
} from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import { createSwipeProjector } from './Camera';

/**
 * Creates a blade trail effect for slashing. Returns singleton for app lifespan.
 * @param scene The scene to add the trail to.
 * @param camera The camera used for projection.
 * @param max The maximum number of points in the trail.
 * @returns An object with methods to control the trail.
 */
export function createBladeTrail(
    scene: Scene,
    camera: PerspectiveCamera,
    max = 32,
): {
    start: (world: Vector3) => void;
    add: (world: Vector3) => void;
    end: () => void;
} {
    const projector = createSwipeProjector(camera);
    void projector;

    const points: Vector3[] = [];
    const geometry = new BufferGeometry();
    const positions = new Float32Array(max * 3);
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
    });

    const line = new Line(geometry, material);
    scene.add(line);
    line.visible = false;

    let last: Vector3 | null = null;

    function updateGeom(): void {
        const pos = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const idx = i * 3;
            pos[idx + 0] = p.x;
            pos[idx + 1] = p.y;
            pos[idx + 2] = p.z;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.setDrawRange(0, points.length);
    }

    function start(world: Vector3): void {
        points.length = 0;
        last = world.clone();
        points.push(last);
        line.visible = true;
        updateGeom();
    }

    function add(world: Vector3): void {
        if (last !== null && world.distanceToSquared(last) < 1e-4) {
            return;
        }
        if (points.length >= max) {
            points.shift();
        }
        last = world.clone();
        points.push(last);
        updateGeom();
    }

    function end(): void {
        line.visible = false;
        points.length = 0;
        geometry.setDrawRange(0, 0);
        last = null;
    }

    return { start, add, end };
}
