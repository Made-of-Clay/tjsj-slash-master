import { MeshStandardNodeMaterial } from 'three/webgpu';
import { color, mix, time } from 'three/tsl';

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
