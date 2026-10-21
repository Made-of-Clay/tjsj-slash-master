import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from 'three/webgpu';
import type { BufferGeometry, Scene } from 'three/webgpu';
import type { GameObjectDefinition, ObjectCategory, ThemeAccents } from '../content/types';
import type { SpawnedObject } from '../game/SpawnedObject';

/**
 * View layer for pooled objects (step 3B): one mesh per pool slot,
 * geometry shared per model, one material per category for the whole game.
 *
 * Reads theme ACCENTS — rendering-side only. Gameplay never sees a colour
 * (step 3 decision D); it only ever sets `category` on a SpawnedObject.
 *
 * Allocation rule: everything here is built once. `syncViews` per frame only
 * writes references and copies transforms.
 */
export interface ObjectViews {
    /** Index-aligned with the pool's construction-order slots. */
    readonly meshes: readonly Mesh[];
    /** defId → shared geometry, resolved once at creation. */
    readonly geometries: Map<string, BufferGeometry>;
    /** One shared material per category, tinted from theme accents. */
    readonly materials: Record<ObjectCategory, MeshStandardMaterial>;
}

export function createGeometry(model: GameObjectDefinition['model']): BufferGeometry {
    if (model.kind === 'geometry') {
        // Theme-owned geometry; shared, never disposed by the view layer.
        return model.geometry;
    }

    switch (model.geometry) {
        case 'box':
            return new BoxGeometry(model.size, model.size, model.size);
        case 'sphere':
            // Low segment counts on purpose (docs/PERF-BUDGET.md: low-poly).
            return new SphereGeometry(model.size / 2, 16, 12);
        default:
            throw new Error('unknown primitive geometry');
    }
}

/**
 * Builds the per-slot meshes and adds them to `scene`, all invisible until
 * their object is checked out and `syncViews` runs.
 *
 * `count` is the pool size; models come from the theme.
 */
export function createObjectViews(
    scene: Scene,
    count: number,
    models: readonly GameObjectDefinition[],
    accents: ThemeAccents,
): ObjectViews {
    const geometries = new Map<string, BufferGeometry>();
    for (const model of models) {
        if (!geometries.has(model.id)) {
            geometries.set(model.id, createGeometry(model.model));
        }
    }

    const materials: Record<ObjectCategory, MeshStandardMaterial> = {
        target: new MeshStandardMaterial({ color: accents.target }),
        restricted: new MeshStandardMaterial({ color: accents.restricted }),
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

/**
 * Copies live sim state onto the slot meshes. Called from `render`, never
 * `fixedUpdate` — views are presentation, not simulation (plan decision A:
 * latest-state copy, no interpolation until step 9).
 *
 * Hidden slots get no transform writes: the next activation overwrites
 * position and rotation anyway, so skipping them is safe and branch-cheap.
 * An active object whose `defId` has no registered model is hidden rather
 * than drawn with a stale shape.
 */
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
