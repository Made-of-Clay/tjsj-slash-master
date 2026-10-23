import { MeshStandardMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { color, mix, screenUV, smoothstep, vec2 } from 'three/tsl';
import { OBJECT_MATERIAL } from '../config';
import type { ThemeGradient } from '../content/types';

/**
 * Shared node materials.
 *
 * TSL runs through `colorNode` rather than the classic `color` property — that
 * difference is the whole reason for adopting WebGPURenderer in this step.
 */

/**
 * Full-screen TSL background: a vertical gradient with a radial vignette.
 *
 * Driven by `screenUV`, so the gradient is anchored to the screen and does not
 * move with camera framing or resize. One full-screen fragment, no geometry and
 * no post-processing (step 2 decision C).
 */
export function createBackgroundNode(palette: ThemeGradient): Node {
    // screenUV is (0,0) bottom-left -> (1,1) top-right in screen space.
    const gradient = mix(color(palette.bottom), color(palette.top), screenUV.y);

    // Radial distance from screen centre: 0 at centre, ~0.71 at a corner.
    const fromCentre = vec2(screenUV.x.sub(0.5), screenUV.y.sub(0.5)).length();
    const vignette = smoothstep(0.25, 0.75, fromCentre).mul(palette.vignetteStrength);

    return mix(gradient, color(palette.vignette), vignette);
}

/**
 * Shared object material (step 7): one per category for the whole game.
 *
 * Base colour comes from the baked model's vertex colours, so every def has
 * its own look without a material per def. The theme accent is the emissive
 * tint — subtle on targets, stronger on restricted objects, which is how the
 * category still reads at a glance.
 */
export function createObjectMaterial(
    accent: string,
    emissiveIntensity: number,
): MeshStandardMaterial {
    return new MeshStandardMaterial({
        vertexColors: true,
        color: '#ffffff',
        emissive: accent,
        emissiveIntensity,
        roughness: OBJECT_MATERIAL.roughness,
        metalness: OBJECT_MATERIAL.metalness,
    });
}
