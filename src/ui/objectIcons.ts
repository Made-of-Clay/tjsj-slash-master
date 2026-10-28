import { Euler, Matrix4, Vector3 } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import type { ObjectModel } from '../content/types';
import { modelGeometry } from '../rendering/ModelAssets';

/**
 * Boot-time legend thumbnails: the theme's own baked geometry, orthographically
 * projected and z-buffered on the CPU. No GPU readback, so the icons are
 * identical on WebGPU and the WebGL fallback, and need no authored art.
 */

/** Internal pixels; the DOM renders it smaller, so the browser antialiases. */
const ICON_SIZE = 96;
/** Keep every silhouette off the edge of its tile. */
const ICON_MARGIN = 0.1;
const VIEW = new Matrix4().makeRotationFromEuler(new Euler(0.18, -0.42, 0, 'YXZ'));
const LIGHT = new Vector3(-0.45, 0.7, 0.8).normalize();
const AMBIENT = 0.5;
const DIFFUSE = 0.5;
/** Lift near-black models (bomb, coal) off the dark card. */
const FLOOR = 0.02;

/** Returns RGBA pixels, row-major, transparent where the model is not. */
export function renderObjectIconPixels(
    geometry: BufferGeometry,
    size = ICON_SIZE,
): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(size * size * 4);
    if (size <= 0) return pixels;

    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const count = position.count;

    // Rotate once into view space and capture the framing from the result,
    // so every model fills the same tile regardless of its authored size.
    const view = new Float32Array(count * 3);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const point = new Vector3();

    for (let index = 0; index < count; index += 1) {
        point.fromBufferAttribute(position, index).applyMatrix4(VIEW);
        const offset = index * 3;
        view[offset] = point.x;
        view[offset + 1] = point.y;
        view[offset + 2] = point.z;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    const span = Math.max(maxX - minX, maxY - minY);
    if (!(span > 0)) return pixels;

    const scale = (size * (1 - ICON_MARGIN * 2)) / span;
    const centreX = (minX + maxX) / 2;
    const centreY = (minY + maxY) / 2;
    const half = size / 2;

    const screen = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        screen[offset] = half + (view[offset] - centreX) * scale;
        screen[offset + 1] = half - (view[offset + 1] - centreY) * scale;
        screen[offset + 2] = view[offset + 2];
    }

    const index = geometry.index;
    const triangleCount = (index ? index.count : count) / 3;
    const depthBuffer = new Float32Array(size * size).fill(Number.NEGATIVE_INFINITY);

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const slot = triangle * 3;
        const i0 = index ? index.getX(slot) : slot;
        const i1 = index ? index.getX(slot + 1) : slot + 1;
        const i2 = index ? index.getX(slot + 2) : slot + 2;

        const o0 = i0 * 3;
        const o1 = i1 * 3;
        const o2 = i2 * 3;
        const x0 = screen[o0];
        const y0 = screen[o0 + 1];
        const x1 = screen[o1];
        const y1 = screen[o1 + 1];
        const x2 = screen[o2];
        const y2 = screen[o2 + 1];

        const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (area === 0) continue;

        const z0 = screen[o0 + 2];
        const z1 = screen[o1 + 2];
        const z2 = screen[o2 + 2];

        // Flat-shaded face normal in view space; two-sided, so a flipped
        // winding never turns a model inside-out.
        let nx =
            (view[o1 + 1] - view[o0 + 1]) * (view[o2 + 2] - view[o0 + 2]) -
            (view[o1 + 2] - view[o0 + 2]) * (view[o2 + 1] - view[o0 + 1]);
        let ny =
            (view[o1 + 2] - view[o0 + 2]) * (view[o2] - view[o0]) -
            (view[o1] - view[o0]) * (view[o2 + 2] - view[o0 + 2]);
        let nz =
            (view[o1] - view[o0]) * (view[o2 + 1] - view[o0 + 1]) -
            (view[o1 + 1] - view[o0 + 1]) * (view[o2] - view[o0]);
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        if (nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }
        const shade = AMBIENT + DIFFUSE * Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);

        const red = (color.getX(i0) + color.getX(i1) + color.getX(i2)) / 3;
        const green = (color.getY(i0) + color.getY(i1) + color.getY(i2)) / 3;
        const blue = (color.getZ(i0) + color.getZ(i1) + color.getZ(i2)) / 3;
        const r = linearToSrgb(red * shade + FLOOR);
        const g = linearToSrgb(green * shade + FLOOR);
        const b = linearToSrgb(blue * shade + FLOOR);

        const startX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
        const endX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
        const startY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
        const endY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));

        for (let y = startY; y <= endY; y += 1) {
            const py = y + 0.5;
            for (let x = startX; x <= endX; x += 1) {
                const px = x + 0.5;
                const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
                if (w0 < 0) continue;
                const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
                if (w1 < 0) continue;
                const w2 = 1 - w0 - w1;
                if (w2 < 0) continue;

                const depth = w0 * z0 + w1 * z1 + w2 * z2;
                const offset = y * size + x;
                if (depth <= depthBuffer[offset]) continue;

                depthBuffer[offset] = depth;
                const pixel = offset * 4;
                pixels[pixel] = r;
                pixels[pixel + 1] = g;
                pixels[pixel + 2] = b;
                pixels[pixel + 3] = 255;
            }
        }
    }

    return pixels;
}

function linearToSrgb(value: number): number {
    const clamped = Math.min(1, Math.max(0, value));
    const encoded =
        clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
}

/** One transparent PNG data URL, or null if the model cannot be baked. */
export function createObjectIcon(model: ObjectModel, size = ICON_SIZE): string | null {
    const pixels = renderObjectIconPixels(modelGeometry(model), size);
    let drawn = false;
    for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) {
            drawn = true;
            break;
        }
    }
    if (!drawn) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(size, size);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
}

/** defId → thumbnail for every object in the theme; boot-time only. */
export function createObjectIcons(
    defs: readonly { id: string; model: ObjectModel }[],
): Map<string, string> {
    const icons = new Map<string, string>();
    for (const def of defs) {
        const icon = createObjectIcon(def.model);
        if (icon) icons.set(def.id, icon);
    }
    return icons;
}
