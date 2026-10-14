import { AmbientLight, DirectionalLight, Scene } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import type { Theme } from '../content/types';
import { createBackgroundNode } from './Materials';

/** `backgroundNode` exists at runtime (three 0.185) but not in @types/three's Scene. */
type SceneWithBackgroundNode = Scene & { backgroundNode: Node | null };

// Intensities are code-side tuning (workstream D); the palette owns the tints.
const AMBIENT_INTENSITY = 0.6;
const KEY_INTENSITY = 2.4;
const FILL_INTENSITY = 0.8;
const RIM_INTENSITY = 1.2;

/**
 * Scene plus its lighting, driven by `theme`.
 *
 * High-contrast three-point setup (PLAN.md step 2): warm key, cool fill, rim to
 * separate objects from the background. Tints come from the theme; intensities
 * are constants until workstream D tunes them. No shadow maps (decision E).
 */
export function createScene(theme: Theme): Scene {
    const scene = new Scene();

    // Decision C: the themeable TSL background is the single source of truth.
    (scene as SceneWithBackgroundNode).backgroundNode = createBackgroundNode(theme.background);

    const lights = theme.lighting;

    const ambient = new AmbientLight(lights.ambient, AMBIENT_INTENSITY);
    scene.add(ambient);

    const key = new DirectionalLight(lights.key, KEY_INTENSITY);
    key.position.set(4, 6, 8);
    scene.add(key);

    const fill = new DirectionalLight(lights.fill, FILL_INTENSITY);
    fill.position.set(-6, 2, 4);
    scene.add(fill);

    const rim = new DirectionalLight(lights.rim, RIM_INTENSITY);
    rim.position.set(0, 3, -8);
    scene.add(rim);

    return scene;
}
