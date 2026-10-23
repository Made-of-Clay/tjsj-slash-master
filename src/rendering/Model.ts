import { BufferAttribute, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelPart, ObjectModel } from '../content/types';

/**
 * Bakes a content model into one geometry per def — one mesh per pool slot,
 * zero per-frame cost. GPU-free, so `verify-content` runs it under bun.
 */

/** No textures or tangents in step 7. */
const STRIPPED = ['uv', 'uv1', 'tangent'] as const;

const ZERO: readonly [number, number, number] = [0, 0, 0];
const ONE: readonly [number, number, number] = [1, 1, 1];

/** Throws on empty parts, an asset model, or incompatible part attributes. */
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

    // mergeGeometries requires all parts indexed or all non-indexed.
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
    // Never transform the content-owned template.
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

/** Vertex colours must be linear; `setStyle` converts from sRGB. */
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
