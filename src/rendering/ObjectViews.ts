import { Mesh } from 'three/webgpu';
import type { BufferGeometry, MeshStandardMaterial, Scene } from 'three/webgpu';
import { OBJECT_MATERIAL } from '../config';
import type { GameObjectDefinition, ObjectCategory, ThemeAccents } from '../content/types';
import type { SpawnedObject } from '../game/SpawnedObject';
import { createObjectMaterial } from './Materials';
import { bakeModel } from './Model';

/**
 * One mesh per pool slot, geometry baked once per def, one material per
 * category. Built once; `syncViews` only writes references and transforms.
 */
export interface ObjectViews {
    /** Index-aligned with the pool's construction-order slots. */
    readonly meshes: readonly Mesh[];
    /** defId → baked geometry, resolved once at creation. */
    readonly geometries: Map<string, BufferGeometry>;
    /** One shared material per category, tinted from theme accents. */
    readonly materials: Record<ObjectCategory, MeshStandardMaterial>;
}

/** Builds invisible per-slot meshes; models are baked here. */
export function createObjectViews(
    scene: Scene,
    count: number,
    models: readonly GameObjectDefinition[],
    accents: ThemeAccents,
): ObjectViews {
    const geometries = new Map<string, BufferGeometry>();
    for (const model of models) {
        if (!geometries.has(model.id)) {
            geometries.set(model.id, bakeModel(model.model));
        }
    }

    const materials: Record<ObjectCategory, MeshStandardMaterial> = {
        target: createObjectMaterial(accents.target, OBJECT_MATERIAL.targetEmissive),
        restricted: createObjectMaterial(accents.restricted, OBJECT_MATERIAL.restrictedEmissive),
    };

    const meshes: Mesh[] = [];
    for (let index = 0; index < count; index += 1) {
        // Default geometry/material until first activation; the mesh is
        // invisible, so nothing of it is ever drawn or compiled first.
        const mesh = new Mesh();
        mesh.visible = false;
        scene.add(mesh);
        meshes.push(mesh);
    }

    return { meshes, geometries, materials };
}

/** Copies live state to slot meshes; presentation only, no interpolation. */
export function syncViews(views: ObjectViews, objects: readonly SpawnedObject[]): void {
    const { meshes, geometries, materials } = views;

    for (let index = 0; index < objects.length; index += 1) {
        const object = objects[index];
        const mesh = meshes[index];

        if (!object.active) {
            mesh.visible = false;
            continue;
        }

        const geometry = geometries.get(object.defId);
        if (!geometry) {
            mesh.visible = false;
            continue;
        }

        mesh.geometry = geometry;
        mesh.material = materials[object.category];
        mesh.position.copy(object.position);
        mesh.rotation.copy(object.rotation);
        mesh.visible = true;
    }
}
