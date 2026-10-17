import {
    ACESFilmicToneMapping,
    NeutralToneMapping,
    NoToneMapping,
    SRGBColorSpace,
    WebGPURenderer,
} from 'three/webgpu';
import type { ToneMapping } from 'three/webgpu';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import {
    DEBUG_PLAYFIELD,
    MAX_PIXEL_RATIO,
    PLAY_BOUNDS,
    TONE_MAPPING,
    TONE_MAPPING_EXPOSURE,
} from './config';
import type { ToneMappingMode } from './config';
import { halloween } from './content/themes/halloween';
import { GameLoop } from './game/GameLoop';
import { Input } from './game/Input';
import { createCamera, createSwipeProjector, createViewportSync } from './rendering/Camera';
import { createDebugRect } from './rendering/PlayArea';
import { createScene } from './rendering/Scene';
import { createBladeTrail } from './rendering/BladeTrail';
import { createUiRoot } from './ui/root';

// No-op without a service worker, so this is safe in dev as well.
registerSW({ immediate: true });

const TONE_MAPPING_MODES: Record<ToneMappingMode, ToneMapping> = {
    none: NoToneMapping,
    aces: ACESFilmicToneMapping,
    neutral: NeutralToneMapping,
};

async function boot(): Promise<void> {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

    // Workstream D: tone mapping is part of the renderer's output transform, so
    // it shifts every colour on screen — including the theme background, which
    // is composited through the same transform. Set before any by-eye tuning.
    renderer.toneMapping = TONE_MAPPING_MODES[TONE_MAPPING];
    renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    // Already the default; pinned so the pipeline is explicit: tone map in
    // linear space, then encode sRGB — what you tune is what ships.
    renderer.outputColorSpace = SRGBColorSpace;

    // WebGPU device creation is async. Rendering before this resolves produces
    // empty frames, so nothing else may start until it lands.
    await renderer.init();

    // WebGPU where available, WebGL2 fallback otherwise — worth logging, since
    // the two backends do not behave identically.
    console.info(`backend: ${renderer.backend.constructor.name}`);

    const scene = createScene(halloween);

    // Dev-only arena outline so the fit math is visible against every aspect
    // ratio. Vite folds DEBUG_PLAYFIELD to false in the production build, so the
    // rect and its geometry are dropped from the bundle.
    if (DEBUG_PLAYFIELD) {
        scene.add(createDebugRect(PLAY_BOUNDS));
    }

    const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
    const syncViewport = createViewportSync(renderer, camera);
    syncViewport();

    createUiRoot();

    const input = new Input(canvas, createSwipeProjector(camera));

    const bladeTrail = createBladeTrail(scene, camera, 32);
    input.onStrokeStart((w) => bladeTrail.start(w));
    input.onStrokeMove((w) => bladeTrail.add(w));
    input.onStrokeEnd(() => bladeTrail.end());

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
