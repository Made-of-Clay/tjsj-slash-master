import { DynamicDrawUsage, InstancedMesh, Object3D } from 'three/webgpu';
import type { BufferGeometry, MeshStandardMaterial, Scene } from 'three/webgpu';
import { CUT } from '../config';
import type { GameObjectDefinition, ObjectCategory } from '../content/types';
import type { DebrisPiece } from '../game/Debris';
import { bakeModel } from './Model';

/**
 * View layer for sliced pieces: one `InstancedMesh` per (def, piece index),
 * `count` = draw count. Geometry resolves once here, so the cut path never
 * resolves geometry at runtime.
 */
export interface DebrisViews {
    /** defId → [piece 0, piece 1] instanced meshes. */
    readonly instanced: Map<string, readonly [InstancedMesh, InstancedMesh]>;
    /** Shared per-category materials (ObjectViews owns them). */
    readonly materials: Record<ObjectCategory, MeshStandardMaterial>;
}

const scratch = new Object3D();

function createPieceMesh(
    scene: Scene,
    capacity: number,
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
}

/** Authored pieces bake at final size; defaults clone the parent × `pieceScale`. */
export function createDebrisViews(
    scene: Scene,
    capacity: number,
    models: readonly GameObjectDefinition[],
    materials: Record<ObjectCategory, MeshStandardMaterial>,
): DebrisViews {
    const scaledClones = new Map<string, BufferGeometry>();
    const scaledClone = (def: GameObjectDefinition): BufferGeometry => {
        let geometry = scaledClones.get(def.id);
        if (!geometry) {
            geometry = bakeModel(def.model);
            geometry.scale(CUT.pieceScale, CUT.pieceScale, CUT.pieceScale);
            scaledClones.set(def.id, geometry);
        }
        return geometry;
    };

    const instanced = new Map<string, readonly [InstancedMesh, InstancedMesh]>();
    for (const def of models) {
        if (instanced.has(def.id)) continue;

        const material = materials[def.category];
        const geometryAt = (index: number): BufferGeometry => {
            const authored = def.pieces?.[index];
            return authored ? bakeModel(authored) : scaledClone(def);
        };

        instanced.set(def.id, [
            createPieceMesh(scene, capacity, geometryAt(0), material),
            createPieceMesh(scene, capacity, geometryAt(1), material),
        ]);
    }

    return { instanced, materials };
}

/** Copies live piece state into per-def, per-piece instance slots. */
export function syncDebrisViews(views: DebrisViews, pieces: readonly DebrisPiece[]): void {
    const { instanced } = views;

    for (const pair of instanced.values()) {
        for (const mesh of pair) {
            mesh.count = 0;
        }
    }

    for (const piece of pieces) {
        if (!piece.active) continue;

        const mesh = instanced.get(piece.defId)?.[piece.pieceIndex];
        if (!mesh || mesh.count >= mesh.instanceMatrix.count) continue;

        scratch.position.copy(piece.position);
        scratch.rotation.copy(piece.rotation);
        scratch.updateMatrix();
        mesh.setMatrixAt(mesh.count, scratch.matrix);
        mesh.count += 1;
    }

    for (const pair of instanced.values()) {
        for (const mesh of pair) {
            if (mesh.count > 0) {
                mesh.instanceMatrix.needsUpdate = true;
            }
        }
    }
}
