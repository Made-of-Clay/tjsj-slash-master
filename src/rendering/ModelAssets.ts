import { Vector3 } from 'three/webgpu';
import type { BufferGeometry, Color, Mesh, Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjectModel } from '../content/types';
import { bakeModel, STRIPPED, writeVertexColors } from './Model';

/**
 * Resolves every model the theme draws, once, before any view exists. `parts`
 * bake synchronously; an `asset` is fetched as GLB and flattened into the same
 * shape — one indexed geometry, vertex colours, no materials of its own — so
 * the render path and `bakeModel` stay one contract.
 */

/** Harnesses read the same bytes off disk; the browser fetches them. */
export type AssetBytes = (url: string) => Promise<ArrayBuffer> | ArrayBuffer;

const resolved = new Map<ObjectModel, BufferGeometry>();

/** Fetches each distinct asset once; safe to call with overlapping models. */
export async function preloadModels(
    models: readonly ObjectModel[],
    readBytes: AssetBytes = fetchBytes,
): Promise<void> {
    const pending = new Map<string, Promise<BufferGeometry>>();

    await Promise.all(
        models.map(async (model) => {
            if (resolved.has(model)) return;

            if (model.kind === 'parts') {
                resolved.set(model, bakeModel(model));
                return;
            }

            const key = `${model.url}|${model.size}`;
            let loading = pending.get(key);
            if (!loading) {
                loading = loadAsset(model.url, model.size, readBytes);
                pending.set(key, loading);
            }
            resolved.set(model, await loading);
        }),
    );
}

/** The preloaded geometry; throws rather than fetching during a frame. */
export function modelGeometry(model: ObjectModel): BufferGeometry {
    const geometry = resolved.get(model);
    if (!geometry) {
        throw new Error('modelGeometry: preloadModels has not resolved this model');
    }
    return geometry;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}

async function loadAsset(
    url: string,
    size: number,
    readBytes: AssetBytes,
): Promise<BufferGeometry> {
    const data = await readBytes(url);
    const gltf = await new Promise<GLTF>((resolve, reject) => {
        new GLTFLoader().parse(data, '', resolve, reject);
    });
    return flattenScene(gltf.scene, size);
}

/**
 * Merges a glTF scene into one geometry, colour baked per vertex from each
 * primitive's material, then centred and scaled to a `size` box — the same
 * contract `bakeModel` gives `parts`.
 */
function flattenScene(scene: Object3D, size: number): BufferGeometry {
    scene.updateMatrixWorld(true);

    const baked: BufferGeometry[] = [];
    scene.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) baked.push(bakeMesh(mesh));
    });
    if (baked.length === 0) {
        throw new Error('flattenScene: the scene has no meshes');
    }

    // mergeGeometries requires all primitives indexed or all non-indexed.
    const indexed = baked.filter((geometry) => geometry.index !== null).length;
    if (indexed !== 0 && indexed !== baked.length) {
        for (let index = 0; index < baked.length; index += 1) {
            if (baked[index].index !== null) {
                const flat = baked[index].toNonIndexed();
                baked[index].dispose();
                baked[index] = flat;
            }
        }
    }

    const merged = mergeGeometries(baked, false);
    for (const geometry of baked) {
        geometry.dispose();
    }
    if (!merged) {
        throw new Error('flattenScene: primitives disagree on attributes');
    }

    fitToSize(merged, size);
    return merged;
}

/** One glTF primitive: world transform baked in, material colour to vertices. */
function bakeMesh(mesh: Mesh): BufferGeometry {
    if (Array.isArray(mesh.material)) {
        throw new Error('flattenScene: one material per glTF primitive, not a group');
    }
    const color = (mesh.material as { color?: Color }).color;
    if (!color) {
        throw new Error('flattenScene: every primitive material needs a base colour');
    }

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    for (const attribute of STRIPPED) {
        geometry.deleteAttribute(attribute);
    }
    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }

    writeVertexColors(geometry, `#${color.getHexString()}`);
    return geometry;
}

/** Gameplay reads `size` as a box, so the asset is normalised into it. */
function fitToSize(geometry: BufferGeometry, size: number): void {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;

    const extent = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    if (!(extent > 0)) return;

    const centre = box.getCenter(new Vector3());
    geometry.translate(-centre.x, -centre.y, -centre.z);
    geometry.scale(size / extent, size / extent, size / extent);
}
