import { AmbientLight, Color, DirectionalLight, Scene } from 'three/webgpu';

/**
 * Scene plus its lighting.
 *
 * High-contrast three-point setup (PLAN.md step 2): warm key, cool fill, rim to
 * separate objects from the background. No shadow maps yet — WebGPU node
 * shadows need explicit setup, and step 2 has no call for them.
 */
export function createScene(): Scene {
    const scene = new Scene();
    scene.background = new Color('#050e11');

    const ambient = new AmbientLight('#ffffff', 0.6);
    scene.add(ambient);

    const key = new DirectionalLight('#fff4e0', 2.4);
    key.position.set(4, 6, 8);
    scene.add(key);

    const fill = new DirectionalLight('#8fb4ff', 0.8);
    fill.position.set(-6, 2, 4);
    scene.add(fill);

    const rim = new DirectionalLight('#ffffff', 1.2);
    rim.position.set(0, 3, -8);
    scene.add(rim);

    return scene;
}
