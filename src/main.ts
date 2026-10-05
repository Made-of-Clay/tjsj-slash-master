import { WebGPURenderer } from 'three/webgpu';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { MAX_PIXEL_RATIO } from './config';
import { GameLoop } from './game/GameLoop';
import { Input } from './game/Input';
import { createCamera, createSwipeProjector, createViewportSync } from './rendering/Camera';
import { createPlaceholder } from './rendering/placeholder';
import { createScene } from './rendering/Scene';
import { createUiRoot } from './ui/root';

// No-op without a service worker, so this is safe in dev as well.
registerSW({ immediate: true });

async function boot(): Promise<void> {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

    // WebGPU device creation is async. Rendering before this resolves produces
    // empty frames, so nothing else may start until it lands.
    await renderer.init();

    // WebGPU where available, WebGL2 fallback otherwise — worth logging, since
    // the two backends do not behave identically.
    console.info(`backend: ${renderer.backend.constructor.name}`);

    const scene = createScene();
    scene.add(createPlaceholder());

    const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
    const syncViewport = createViewportSync(renderer, camera);
    syncViewport();

    createUiRoot();

    const input = new Input(canvas, createSwipeProjector(camera));

    // Dev probe: proves pointer events reach the world-space projection. Step 4
    // replaces it with collision tests.
    if (import.meta.env.DEV) {
        input.onSwipe(({ from, to }) => {
            console.info(
                `swipe ${from.x.toFixed(2)},${from.y.toFixed(2)} -> ${to.x.toFixed(2)},${to.y.toFixed(2)}`,
            );
        });
    }

    // Dev-only overlay. Vite drops the whole block from the production build,
    // so it never reaches the service worker's precache.
    const stats = import.meta.env.DEV ? new (await import('stats.js')).default() : undefined;
    if (stats) {
        document.body.appendChild(stats.dom);
    }

    const loop = new GameLoop({
        // Empty until step 3 gives the simulation something to advance.
        fixedUpdate: () => {},
        render: () => {
            stats?.begin();
            syncViewport();
            renderer.render(scene, camera);
            stats?.end();
        },
    });

    // The renderer owns the only frame loop in the app.
    renderer.setAnimationLoop(loop.tick);

    loop.start();
}

void boot().catch((error: unknown) => {
    console.error('boot failed', error);
});
