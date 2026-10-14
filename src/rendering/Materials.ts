import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { color, mix, screenUV, smoothstep, time, vec2 } from 'three/tsl';

/**
 * Shared node materials.
 *
 * TSL runs through `colorNode` rather than the classic `color` property — that
 * difference is the whole reason for adopting WebGPURenderer in this step.
 */

/**
 * Smoke test for the TSL pipeline: a colour that cycles over time.
 *
 * If TSL is wired up wrong, this compiles to a flat colour or fails to build
 * the node graph, which is the signal step 2 needs before any real material
 * work starts.
 */
export function createPulseMaterial(primary: string, secondary: string): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial();

    // time is a float uniform node; sin maps it to 0..1 for the mix factor.
    const blend = time.mul(0.5).sin().mul(0.5).add(0.5);
    material.colorNode = mix(color(primary), color(secondary), blend);

    return material;
}

/**
 * Background palette. Temporary shape until workstream C moves theme data into
 * `content/themes/`; keep gameplay from ever reading this.
 */
export interface BackgroundPalette {
    /** Colour at the top of the screen. */
    top: string;
    /** Colour at the bottom of the screen. */
    bottom: string;
    /** Colour the screen corners fade toward. */
    vignette: string;
    /** 0 = no vignette, 1 = corners fully `vignette`. */
    vignetteStrength: number;
}

/**
 * Full-screen TSL background: a vertical gradient with a radial vignette.
 *
 * Driven by `screenUV`, so the gradient is anchored to the screen and does not
 * move with camera framing or resize. One full-screen fragment, no geometry and
 * no post-processing (step 2 decision C).
 */
export function createBackgroundNode(palette: BackgroundPalette): Node {
    // screenUV is (0,0) bottom-left -> (1,1) top-right in screen space.
    const gradient = mix(color(palette.bottom), color(palette.top), screenUV.y);

    // Radial distance from screen centre: 0 at centre, ~0.71 at a corner.
    const fromCentre = vec2(screenUV.x.sub(0.5), screenUV.y.sub(0.5)).length();
    const vignette = smoothstep(0.25, 0.75, fromCentre).mul(palette.vignetteStrength);

    return mix(gradient, color(palette.vignette), vignette);
}
