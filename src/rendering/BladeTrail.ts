import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    DynamicDrawUsage,
    Mesh,
    MeshBasicMaterial,
    Scene,
    Vector3,
} from 'three/webgpu';
import { BLADE } from '../config';

const VERTS_PER_SAMPLE = 3;
const INDICES_PER_SEGMENT = 12;
const WHITE = new Color(0xffffff);
/** A stalled frame must not consume the whole fade in one update. */
const MAX_STEP_SECONDS = 0.1;

/**
 * Theme colour as a blade tint. `palette.top` is near-black in linear space, so
 * a straight lerp toward white erases the hue (chroma 0.009 at 0.65): the
 * colour is normalised to full brightness first, which makes `whiteMix` a real
 * saturation knob — 0 = the theme hue, 1 = white.
 */
export function bladeTint(hex: string, whiteMix: number): Color {
    const tint = new Color(hex);
    const brightest = Math.max(tint.r, tint.g, tint.b);
    if (brightest > 0) {
        tint.r /= brightest;
        tint.g /= brightest;
        tint.b /= brightest;
    }
    return tint.lerp(WHITE, whiteMix);
}

export interface BladeTrailOptions {
    /** Theme colour; lightened toward white so additive blending has headroom. */
    tint: string;
    /** Snap off instead of fading — `prefers-reduced-motion`. */
    reducedMotion?: boolean;
}

export interface BladeTrail {
    start: (world: Vector3) => void;
    add: (world: Vector3) => void;
    end: () => void;
    flash: () => void;
    update: (nowMs: number) => void;
}

/**
 * Slash ribbon: three vertices per sample (outer left, core, outer right) in one
 * additive mesh. Fade is written into RGB because additive ignores alpha.
 *
 * Samples live in a preallocated array with a `first`/`count` window, so the
 * age trim only moves indices. `update` takes an injected clock, like Effects'
 * `rand`; the stroke handlers stamp against the last one they saw.
 */
export function createBladeTrail(scene: Scene, options: BladeTrailOptions): BladeTrail {
    const max = BLADE.maxPoints;
    const points = Array.from({ length: max }, () => new Vector3());
    const stamps = new Float64Array(max);

    let first = 0;
    let count = 0;
    let now = 0;
    let lastUpdate = 0;
    /** 1 while live, decays to 0 after release. */
    let fade = 0;
    let flashLevel = 0;
    let released = true;

    const positions = new Float32Array(max * VERTS_PER_SAMPLE * 3);
    const colors = new Float32Array(max * VERTS_PER_SAMPLE * 3);
    const indices = new Uint16Array((max - 1) * INDICES_PER_SEGMENT);

    for (let sample = 0; sample < max - 1; sample += 1) {
        const a = sample * VERTS_PER_SAMPLE;
        const b = a + VERTS_PER_SAMPLE;
        const at = sample * INDICES_PER_SEGMENT;
        indices[at] = a;
        indices[at + 1] = a + 1;
        indices[at + 2] = b + 1;
        indices[at + 3] = a;
        indices[at + 4] = b + 1;
        indices[at + 5] = b;
        indices[at + 6] = a + 1;
        indices[at + 7] = a + 2;
        indices[at + 8] = b + 2;
        indices[at + 9] = a + 1;
        indices[at + 10] = b + 2;
        indices[at + 11] = b + 1;
    }

    const geometry = new BufferGeometry();
    const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
    const colorAttribute = new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);

    const material = new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: DoubleSide,
    });

    const tint = bladeTint(options.tint, BLADE.tintWhiteMix);

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);

    function hide(): void {
        mesh.visible = false;
        geometry.setDrawRange(0, 0);
        first = 0;
        count = 0;
        fade = 0;
    }

    function profile(t: number): number {
        const taper = BLADE.taperStart;
        if (t < taper) return taper > 0 ? t / taper : 1;
        const span = 1 - taper;
        return 1 + (BLADE.headSwell - 1) * (span > 0 ? (t - taper) / span : 1);
    }

    function tailAlpha(t: number): number {
        return BLADE.tailFade > 0 && t < BLADE.tailFade ? t / BLADE.tailFade : 1;
    }

    function writeGeometry(): void {
        if (count < 2) {
            mesh.visible = false;
            geometry.setDrawRange(0, 0);
            return;
        }

        const halfWidth = BLADE.width * 0.5 * (1 + flashLevel * BLADE.flashWidth);
        const glow = fade * (1 + flashLevel * BLADE.flashIntensity);
        const last = first + count - 1;
        let dirX = 1;
        let dirY = 0;

        for (let i = 0; i < count; i += 1) {
            const sample = first + i;
            const previous = sample > first ? sample - 1 : sample;
            const next = sample < last ? sample + 1 : sample;
            const dx = points[next].x - points[previous].x;
            const dy = points[next].y - points[previous].y;
            const length = Math.hypot(dx, dy);
            if (length > 1e-6) {
                dirX = dx / length;
                dirY = dy / length;
            }

            const t = count > 1 ? i / (count - 1) : 1;
            const half = halfWidth * profile(t);
            const intensity = glow * tailAlpha(t);
            const nx = -dirY * half;
            const ny = dirX * half;
            const point = points[sample];
            const at = i * VERTS_PER_SAMPLE * 3;
            const edge = BLADE.edgeIntensity * intensity;

            positions[at] = point.x - nx;
            positions[at + 1] = point.y - ny;
            positions[at + 2] = point.z;
            positions[at + 3] = point.x;
            positions[at + 4] = point.y;
            positions[at + 5] = point.z;
            positions[at + 6] = point.x + nx;
            positions[at + 7] = point.y + ny;
            positions[at + 8] = point.z;

            colors[at] = tint.r * edge;
            colors[at + 1] = tint.g * edge;
            colors[at + 2] = tint.b * edge;
            colors[at + 3] = intensity;
            colors[at + 4] = intensity;
            colors[at + 5] = intensity;
            colors[at + 6] = tint.r * edge;
            colors[at + 7] = tint.g * edge;
            colors[at + 8] = tint.b * edge;
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        geometry.setDrawRange(0, (count - 1) * INDICES_PER_SEGMENT);
        mesh.visible = true;
    }

    function start(world: Vector3): void {
        first = 0;
        count = 1;
        points[0].copy(world);
        stamps[0] = now;
        released = false;
        fade = 1;
        flashLevel = 0;
        writeGeometry();
    }

    function add(world: Vector3): void {
        // A held pointer ages the whole tail out, so a stroke can resume from
        // an empty window.
        if (released || count === 0) {
            start(world);
            return;
        }

        if (world.distanceToSquared(points[first + count - 1]) < 1e-4) return;

        if (first + count === max) {
            for (let index = 1; index < count; index += 1) {
                points[first + index - 1].copy(points[first + index]);
                stamps[first + index - 1] = stamps[first + index];
            }
            count -= 1;
        }

        points[first + count].copy(world);
        stamps[first + count] = now;
        count += 1;
        writeGeometry();
    }

    function end(): void {
        if (released) return;
        released = true;
        if (options.reducedMotion || BLADE.fadeSeconds <= 0) hide();
    }

    function flash(): void {
        if (options.reducedMotion) return;
        flashLevel = 1;
        // The cut path is not the sample path: rewrite now so a stopped
        // pointer still shows the flash.
        if (count >= 2) writeGeometry();
    }

    function update(nowMs: number): void {
        const delta = Math.min(Math.max((nowMs - lastUpdate) / 1000, 0), MAX_STEP_SECONDS);
        lastUpdate = nowMs;
        now = nowMs;

        let dirty = false;

        if (flashLevel > 0) {
            const previous = flashLevel;
            flashLevel =
                BLADE.flashSeconds > 0 ? Math.max(0, flashLevel - delta / BLADE.flashSeconds) : 0;
            dirty = flashLevel !== previous;
        }

        if (released) {
            if (count === 0) return;
            fade -= BLADE.fadeSeconds > 0 ? delta / BLADE.fadeSeconds : 1;
            if (fade <= 0) {
                hide();
                return;
            }
            writeGeometry();
            return;
        }

        // A held pointer would otherwise keep every slot forever: the tail is
        // a time window, not a sample count.
        const tail = BLADE.tailSeconds * 1000;
        while (count > 0 && nowMs - stamps[first] > tail) {
            first += 1;
            count -= 1;
            dirty = true;
        }

        if (!dirty) return;
        if (count < 2) hide();
        else writeGeometry();
    }

    return { start, add, end, flash, update };
}
