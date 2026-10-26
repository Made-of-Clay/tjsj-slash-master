import type { PerspectiveCamera } from 'three/webgpu';
import { SHAKE } from '../config';

/**
 * Screen shake (step 9A): trauma decays to zero, quadratic falloff drives a
 * small camera offset. The base pose is captured once and restored on every
 * `apply`, so the playfield never drifts.
 */
export interface Shake {
    /** Adds trauma; total is clamped to 1. */
    add(trauma: number): void;
    /** Advances the decay and phases — fixed step, alongside the sim. */
    step(dt: number): void;
    /** Writes the current offset onto the camera; call after reframing. */
    apply(): void;
    /** Drops all trauma and restores the base pose. */
    reset(): void;
    /** Current trauma, 0..1 (harness/debug). */
    readonly trauma: number;
}

export function createShake(camera: PerspectiveCamera): Shake {
    const baseX = camera.position.x;
    const baseY = camera.position.y;
    const baseZ = camera.position.z;
    let trauma = 0;
    let phase = 0;

    function add(amount: number): void {
        trauma = Math.min(1, trauma + amount);
    }

    function step(dt: number): void {
        if (trauma <= 0) return;

        trauma = Math.max(0, trauma - SHAKE.decay * dt);
        phase += dt;
    }

    function apply(): void {
        if (trauma <= 0) {
            camera.position.set(baseX, baseY, baseZ);
            camera.rotation.z = 0;
            return;
        }

        const force = trauma * trauma;
        camera.position.set(
            baseX + Math.sin(phase * 47) * SHAKE.amplitude * force,
            baseY + Math.sin(phase * 61 + 1.7) * SHAKE.amplitude * force,
            baseZ,
        );
        camera.rotation.z = Math.sin(phase * 53 + 0.6) * SHAKE.roll * force;
    }

    function reset(): void {
        trauma = 0;
        phase = 0;
        camera.position.set(baseX, baseY, baseZ);
        camera.rotation.z = 0;
    }

    return {
        add,
        step,
        apply,
        reset,
        get trauma() {
            return trauma;
        },
    };
}
