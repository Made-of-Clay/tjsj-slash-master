import { BufferAttribute, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelPart, ObjectModel } from '../content/types';

/**
 * Content model → one GPU-ready geometry (step 7).
 *
 * The pooled view layer keeps exactly one mesh per slot, so a model's parts are
 * baked into a single geometry at boot: local transforms applied to copies,
 * per-part colours written as a vertex-colour attribute, then merged. No
 * per-frame cost, no extra draw calls, no scene-graph nesting.
 *
 * Runs without a rendering context (plain geometry math), so `verify-content`
 * can exercise it under bun.
 *
 * Step-9 loader seam: `{ kind: 'asset' }` is typed but not baked. The async
 * path is a preload before view creation — `main.boot` already awaits
 * `renderer.init()`, so it can equally await `GLTFLoader.loadAsync(url)` and
 * convert the loaded meshes into `ModelPart`s (or a resolved geometry map)
 * before `createObjectViews`.
 */

/** Attributes a bake does not need: no textures in step 7, no tangents. */
const STRIPPED = ['uv', 'uv1', 'tangent'] as const;

const ZERO: readonly [number, number, number] = [0, 0, 0];
const ONE: readonly [number, number, number] = [1, 1, 1];

/**
 * Bakes `model` into a single indexed-or-non-indexed geometry with
 * `position` / `normal` / `color`. Throws on an empty parts list, an asset
 * model (step-9 seam), or a merge failure (incompatible part attributes — a
 * content bug, not a runtime condition).
 */
export function bakeModel(model: ObjectModel): BufferGeometry {
    if (model.kind === 'asset') {
        throw new Error(
            `bakeModel: asset models are the step-9 loader seam (${model.url}); bake \`parts\` instead`,
        );
    }
    if (model.parts.length === 0) {
        throw new Error('bakeModel: ObjectModel.parts must not be empty');
    }

    const baked = model.parts.map(bakePart);

    // mergeGeometries requires all inputs indexed or all non-indexed. Standard
    // three primitives are indexed, so this only fires for a custom part.
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
        throw new Error(
            'bakeModel: mergeGeometries failed — parts disagree on attributes or indexing',
        );
    }

    return merged;
}

/** Clones one part, bakes its transform, and writes its vertex colours. */
function bakePart(part: ModelPart): BufferGeometry {
    // Clone first: content-owned geometry is a shared template and must never
    // be transformed by a bake.
    const geometry = part.geometry.clone();
    for (const attribute of STRIPPED) {
        geometry.deleteAttribute(attribute);
    }

    const [px, py, pz] = part.position ?? ZERO;
    const [rx, ry, rz] = part.rotation ?? ZERO;
    const [sx, sy, sz] = part.scale ?? ONE;

    const matrix = new Matrix4().compose(
        new Vector3(px, py, pz),
        new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
        new Vector3(sx, sy, sz),
    );
    geometry.applyMatrix4(matrix);

    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }

    writeVertexColors(geometry, part.color);
    return geometry;
}

/**
 * Expands one part colour across the geometry's vertices. `Color.setStyle`
 * converts the sRGB hex into the renderer's working (linear) space, which is
 * what a vertex-colour attribute is expected to hold.
 */
function writeVertexColors(geometry: BufferGeometry, style: string): void {
    const color = new Color().setStyle(style);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);

    for (let vertex = 0; vertex < count; vertex += 1) {
        const offset = vertex * 3;
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 3));
}
