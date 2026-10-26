import { DynamicDrawUsage, InstancedMesh, Object3D } from 'three/webgpu';
import type { MeshStandardMaterial, Scene } from 'three/webgpu';
import { OBJECT_MATERIAL } from '../config';
import type { GameObjectDefinition, ObjectCategory, ThemeAccents } from '../content/types';
import type { SpawnedObject } from '../game/SpawnedObject';
import { createObjectMaterial } from './Materials';
import { bakeModel } from './Model';

/**
 * One `InstancedMesh` per def. `count` is the draw count, so a def with no
 * live slots costs nothing and `POOL_SIZE` no longer costs scene nodes.
 */
export interface ObjectViews {
    /** defId → instanced mesh; one draw call per def in flight. */
    readonly instanced: Map<string, InstancedMesh>;
    /** One shared material per category, tinted from theme accents. */
    readonly materials: Record<ObjectCategory, MeshStandardMaterial>;
}

const scratch = new Object3D();

/** Builds per-def instanced meshes with zero live instances; models bake here. */
export function createObjectViews(
    scene: Scene,
    capacity: number,
    models: readonly GameObjectDefinition[],
    accents: ThemeAccents,
): ObjectViews {
    const materials: Record<ObjectCategory, MeshStandardMaterial> = {
        target: createObjectMaterial(accents.target, OBJECT_MATERIAL.targetEmissive),
        restricted: createObjectMaterial(accents.restricted, OBJECT_MATERIAL.restrictedEmissive),
    };

    const instanced = new Map<string, InstancedMesh>();
    for (const def of models) {
        if (instanced.has(def.id)) continue;

        const mesh = new InstancedMesh(bakeModel(def.model), materials[def.category], capacity);
        mesh.count = 0;
        // Instances span the playfield, so whole-mesh culling only pops spawns.
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        scene.add(mesh);
        instanced.set(def.id, mesh);
    }

    return { instanced, materials };
}

/** Copies live state into per-def instance slots; presentation only. */
export function syncViews(views: ObjectViews, objects: readonly SpawnedObject[]): void {
    const { instanced } = views;

    for (const mesh of instanced.values()) {
        mesh.count = 0;
    }

    for (const object of objects) {
        if (!object.active) continue;

        const mesh = instanced.get(object.defId);
        if (!mesh || mesh.count >= mesh.instanceMatrix.count) continue;

        scratch.position.copy(object.position);
        scratch.rotation.copy(object.rotation);
        scratch.updateMatrix();
        mesh.setMatrixAt(mesh.count, scratch.matrix);
        mesh.count += 1;
    }

    for (const mesh of instanced.values()) {
        if (mesh.count > 0) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
