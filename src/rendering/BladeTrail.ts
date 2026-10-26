import {
    BufferAttribute,
    BufferGeometry,
    Line,
    LineBasicMaterial,
    Scene,
    Vector3,
} from 'three/webgpu';

/**
 * Creates a blade trail effect for slashing. Returns singleton for app lifespan.
 *
 * Allocation-free per stroke sample: points live in a preallocated ring-backed
 * array and each new sample copies into it. When full, the tail is dropped by
 * shifting the preallocated vectors left.
 *
 * @param scene The scene to add the trail to.
 * @param max The maximum number of points in the trail.
 * @returns An object with methods to control the trail.
 */
export function createBladeTrail(
    scene: Scene,
    max = 32,
): {
    start: (world: Vector3) => void;
    add: (world: Vector3) => void;
    end: () => void;
} {
    const points = Array.from({ length: max }, () => new Vector3());
    let count = 0;

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

    function updateGeom(): void {
        for (let index = 0; index < count; index += 1) {
            const point = points[index];
            const offset = index * 3;
            positions[offset] = point.x;
            positions[offset + 1] = point.y;
            positions[offset + 2] = point.z;
        }

        (geometry.attributes.position as BufferAttribute).needsUpdate = true;
        geometry.setDrawRange(0, count);
    }

    function start(world: Vector3): void {
        count = 1;
        points[0].copy(world);
        line.visible = true;
        updateGeom();
    }

    function add(world: Vector3): void {
        if (count > 0 && world.distanceToSquared(points[count - 1]) < 1e-4) {
            return;
        }

        if (count === max) {
            for (let index = 1; index < max; index += 1) {
                points[index - 1].copy(points[index]);
            }
            count = max - 1;
        }

        points[count].copy(world);
        count += 1;
        updateGeom();
    }

    function end(): void {
        line.visible = false;
        count = 0;
        geometry.setDrawRange(0, 0);
    }

    return { start, add, end };
}
