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
    GRAVITY,
    LAUNCH_LINE_Y,
    MAX_PIXEL_RATIO,
    POOL_SIZE,
    TONE_MAPPING,
    TONE_MAPPING_EXPOSURE,
} from './config';
import type { ToneMappingMode } from './config';
import type { GameObjectDefinition } from './content/types';
import { halloween } from './content/themes/halloween';
import { GameLoop } from './game/GameLoop';
import { Input } from './game/Input';
import { Physics } from './game/Physics';
import { Pool } from './game/Pool';
import { boxBoundingRadius, createSpawnedObject, resetSpawnedObject } from './game/SpawnedObject';
import {
    createCamera,
    createPlayField,
    createSwipeProjector,
    createViewportSync,
} from './rendering/Camera';
import { createDebugRect, writeDebugRect } from './rendering/PlayArea';
import { createObjectViews, syncViews } from './rendering/ObjectViews';
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

    const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
    // Live playfield: width is derived from the aspect, so gameplay reads its
    // bounds from here rather than a constant.
    const playfield = createPlayField(camera);

    // Dev-only arena outline so the full-width bounds are visible against every
    // aspect ratio. Vite folds DEBUG_PLAYFIELD to false in the production build,
    // so the rect and its geometry are dropped from the bundle.
    const debugRect = DEBUG_PLAYFIELD ? createDebugRect(playfield.bounds) : undefined;
    if (debugRect) {
        scene.add(debugRect);
    }

    // Step 3A: pooled sim states + one fixed-step physics pass. The pool owns
    // reset (stale velocity can't survive a recycle); physics decides despawn.
    const objects = new Pool(POOL_SIZE, createSpawnedObject, resetSpawnedObject);
    const physics = new Physics();

    // Step 3B: view meshes for every pool slot. Models = theme object defs
    // (C/D fill the list) plus the temporary stub def the volley launches;
    // colour comes from theme accents, never from gameplay (decision D).
    const STUB_SIZE = 1;
    const STUB_RADIUS = boxBoundingRadius(STUB_SIZE);
    const stubModel: GameObjectDefinition = {
        id: 'stub',
        score: 0,
        category: 'target',
        model: { kind: 'primitive', geometry: 'box', size: STUB_SIZE },
    };
    const objectViews = createObjectViews(
        scene,
        objects.items.length,
        [stubModel, ...halloween.objects],
        halloween.accents,
    );

    // TEMP hand-launch stub: a volley at the launch line, relaunched whenever
    // the field empties, so the sim is visibly alive before Spawner exists.
    // Replaced wholesale by Spawner + SpawnRules in workstream D; only the
    // acquire → fill → active = true contract survives.
    function launchVolley(): void {
        const { bounds } = playfield;
        for (let index = 0; index < 3; index += 1) {
            const object = objects.acquire();
            if (!object) return; // pool exhausted: skip, never grow.

            const inset = Math.max(bounds.halfWidth - STUB_RADIUS, 0);
            const x = (Math.random() * 2 - 1) * inset;
            const vy = 17 + Math.random() * 4;
            // Closed-form aim at a jittered centre target; real aim ranges
            // (apex, side launches) are workstream D's.
            const tFlight = (2 * vy) / GRAVITY;
            const targetX = (Math.random() * 2 - 1) * 3;

            object.position.set(x, LAUNCH_LINE_Y - STUB_RADIUS, 0);
            object.velocity.set((targetX - x) / tFlight, vy, 0);
            object.rotation.set(0, 0, 0);
            object.angularVelocity.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
            );
            object.defId = 'stub';
            object.category = 'target';
            object.radius = STUB_RADIUS;
            object.active = true; // mirrors checkout; views key off it.
        }
    }

    // Bounds change with aspect, so the outline is redrawn on every reframe.
    const syncViewport = createViewportSync(renderer, playfield, (bounds) => {
        if (debugRect) writeDebugRect(debugRect, bounds);
    });
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
        fixedUpdate: (dt) => {
            // Refill before stepping so a fresh volley gets a full arc.
            if (objects.inUse === 0) launchVolley();
            physics.step(objects, playfield.bounds, dt);
        },
        render: () => {
            stats?.begin();
            syncViewport();
            syncViews(objectViews, objects.items);
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
