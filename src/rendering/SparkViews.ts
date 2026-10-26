import {
    DynamicDrawUsage,
    InstancedMesh,
    MeshBasicMaterial,
    Object3D,
    TetrahedronGeometry,
} from 'three/webgpu';
import type { Scene } from 'three/webgpu';
import type { ObjectCategory, ThemeAccents } from '../content/types';
import type { Spark } from '../game/Effects';

/**
 * Cut sparks (step 9A): one `InstancedMesh` per category, shared shard
 * geometry, `count` as the draw count. One extra draw per category in flight.
 */
export interface SparkViews {
    readonly instanced: Map<ObjectCategory, InstancedMesh>;
    /** The same meshes, for allocation-free per-frame iteration. */
    readonly meshes: readonly InstancedMesh[];
}

const scratch = new Object3D();

export function createSparkViews(
    scene: Scene,
    capacity: number,
    accents: ThemeAccents,
): SparkViews {
    // Unit shard: the instance scale IS the world size (`spark.size`), so a
    // geometry radius here would silently multiply it a second time.
    const geometry = new TetrahedronGeometry(1);
    const instanced = new Map<ObjectCategory, InstancedMesh>();

    for (const [category, accent] of Object.entries(accents) as [ObjectCategory, string][]) {
        // Unlit: a spark should read as light, not as a shaded shard.
        const mesh = new InstancedMesh(
            geometry,
            new MeshBasicMaterial({ color: accent }),
            capacity,
        );
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        scene.add(mesh);
        instanced.set(category, mesh);
    }

    return { instanced, meshes: [...instanced.values()] };
}

/** Copies live sparks into per-category slots; shrinks each over its life. */
export function syncSparkViews(views: SparkViews, sparks: readonly Spark[]): void {
    const { instanced, meshes } = views;

    for (let index = 0; index < meshes.length; index += 1) {
        meshes[index].count = 0;
    }

    for (let index = 0; index < sparks.length; index += 1) {
        const spark = sparks[index];
        if (!spark.active) continue;

        const mesh = instanced.get(spark.category);
        if (!mesh || mesh.count >= mesh.instanceMatrix.count) continue;

        const remaining = 1 - spark.age / spark.life;
        scratch.position.copy(spark.position);
        scratch.rotation.set(0, 0, 0);
        scratch.scale.setScalar(spark.size * (0.4 + 0.6 * remaining));
        scratch.updateMatrix();
        mesh.setMatrixAt(mesh.count, scratch.matrix);
        mesh.count += 1;
    }

    for (let index = 0; index < meshes.length; index += 1) {
        const mesh = meshes[index];
        if (mesh.count > 0) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
