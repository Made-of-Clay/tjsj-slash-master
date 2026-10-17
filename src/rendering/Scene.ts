import { AmbientLight, DirectionalLight, Scene } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { LIGHTING } from '../config';
import type { Theme } from '../content/types';
import { createBackgroundNode } from './Materials';

/** `backgroundNode` exists at runtime (three 0.185) but not in @types/three's Scene. */
type SceneWithBackgroundNode = Scene & { backgroundNode: Node | null };

/**
 * Scene plus its lighting, driven by `theme`.
 *
 * High-contrast three-point setup (PLAN.md step 2): warm key, cool fill, rim to
 * separate objects from the background. Tints come from the theme; intensities
 * intensities live in config.ts (LIGHTING). No shadow maps (decision E).
 */
export function createScene(theme: Theme): Scene {
    const scene = new Scene();

    // Decision C: the themeable TSL background is the single source of truth.
    (scene as SceneWithBackgroundNode).backgroundNode = createBackgroundNode(theme.background);

    const lights = theme.lighting;

    const ambient = new AmbientLight(lights.ambient, LIGHTING.ambient);
    scene.add(ambient);

    const key = new DirectionalLight(lights.key, LIGHTING.key);
    key.position.set(4, 6, 8);
    scene.add(key);

    const fill = new DirectionalLight(lights.fill, LIGHTING.fill);
    fill.position.set(-6, 2, 4);
    scene.add(fill);

    const rim = new DirectionalLight(lights.rim, LIGHTING.rim);
    rim.position.set(0, 3, -8);
    scene.add(rim);

    return scene;
}
