import { Mesh } from 'three/webgpu';
import type { BufferGeometry, Scene } from 'three/webgpu';
import type { MeshStandardMaterial } from 'three/webgpu';
import { CUT } from '../config';
import type { GameObjectDefinition, ObjectCategory } from '../content/types';
import type { DebrisPiece } from '../game/Debris';
import { bakeModel } from './Model';

/**
 * View layer for sliced pieces (step 5B): one mesh per Debris ring slot,
 * geometry resolved per def and piece index, materials shared with the
 * object views (one per category for the whole game).
 *
 * Allocation rule: the geometry cache is built once here, so the cut path
 * never resolves geometry at runtime. `syncDebrisViews` per frame only
 * writes references and copies transforms.
 */
export interface DebrisViews {
    /** Index-aligned with the Debris ring slots. */
    readonly meshes: readonly Mesh[];
    /** defId → [piece 0 geometry, piece 1 geometry]. */
    readonly geometries: Map<string, readonly BufferGeometry[]>;
    /** Shared per-category materials (ObjectViews owns them). */
    readonly materials: Record<ObjectCategory, MeshStandardMaterial>;
}

/**
 * Builds the piece meshes and adds them to `scene`, all invisible until
 * their piece is spawned and `syncDebrisViews` runs.
 *
 * `count` is the debris capacity; models come from the theme. Authored
 * `def.pieces` entries are used at final size (Decision B); the default is a
 * clone of the baked parent geometry with `CUT.pieceScale` baked in.
 */
export function createDebrisViews(
    scene: Scene,
    count: number,
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

    const geometries = new Map<string, BufferGeometry[]>();
    for (const def of models) {
        const pair: BufferGeometry[] = [];
        for (let index = 0; index < 2; index += 1) {
            const authored = def.pieces?.[index];
            pair.push(authored ? bakeModel(authored) : scaledClone(def));
        }
        geometries.set(def.id, pair);
    }

    const meshes: Mesh[] = [];
    for (let index = 0; index < count; index += 1) {
        const mesh = new Mesh();
        mesh.visible = false;
        scene.add(mesh);
        meshes.push(mesh);
    }

    return { meshes, geometries, materials };
}

/**
 * Copies live piece state onto the slot meshes. Called from `render`, never
 * `fixedUpdate` — presentation, not simulation. Hidden slots get no
 * transform writes; a piece whose `defId` resolves to nothing is hidden
 * rather than drawn with a stale shape.
 */
export function syncDebrisViews(views: DebrisViews, pieces: readonly DebrisPiece[]): void {
    const { meshes, geometries, materials } = views;

    for (let index = 0; index < pieces.length; index += 1) {
        const piece = pieces[index];
        const mesh = meshes[index];

        if (!piece.active) {
            mesh.visible = false;
            continue;
        }

        const geometry = geometries.get(piece.defId)?.[piece.pieceIndex];
        if (!geometry) {
            mesh.visible = false;
            continue;
        }

        mesh.geometry = geometry;
        mesh.material = materials[piece.category];
        mesh.position.copy(piece.position);
        mesh.rotation.copy(piece.rotation);
        mesh.visible = true;
    }
}
