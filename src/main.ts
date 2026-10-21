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
    CUT,
    DEBUG_CUT,
    DEBUG_PLAYFIELD,
    DEBUG_SWIPE,
    LAUNCH_LINE_Y,
    MAX_PIXEL_RATIO,
    POOL_SIZE,
    ROUND,
    SWIPE,
    TONE_MAPPING,
    TONE_MAPPING_EXPOSURE,
} from './config';
import type { ToneMappingMode } from './config';
import { halloween } from './content/themes/halloween';
import { GameLoop } from './game/GameLoop';
import { Input } from './game/Input';
import type { SwipeSegment } from './game/Input';
import { Physics } from './game/Physics';
import { Round } from './game/Round';
import { Debris } from './game/Debris';
import { Spawner } from './game/Spawner';
import { Pool } from './game/Pool';
import { Swipes } from './game/Swipes';
import { Slicer } from './game/Slicer';
import { Score } from './game/Score';
import { boxBoundingRadius, createSpawnedObject, resetSpawnedObject } from './game/SpawnedObject';
import {
    createCamera,
    createPlayField,
    createSwipeProjector,
    createViewportSync,
} from './rendering/Camera';
import { createDebugRect, writeDebugRect } from './rendering/PlayArea';
import { createObjectViews, syncViews } from './rendering/ObjectViews';
import { createDebrisViews, syncDebrisViews } from './rendering/DebrisViews';
import { createScene } from './rendering/Scene';
import { createBladeTrail } from './rendering/BladeTrail';
import { createHud } from './ui/hud';
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

    // Step 3B: view meshes for every pool slot. Models = the theme's object
    // defs; colour comes from theme accents, never from gameplay (decision D).
    const objectViews = createObjectViews(
        scene,
        objects.items.length,
        halloween.objects,
        halloween.accents,
    );

    // Step 3D: the real launcher. It reads theme spawn rules + object defs
    // (decision D) and the live bounds each spawn, so it follows a resize.
    const spawner = new Spawner({
        rules: halloween.spawnRules,
        defs: halloween.objects,
    });

    // Step 5B: sliced pieces are presentation, not gameplay — their own
    // capped ring, integrated after physics, never competing with the
    // spawner (plan Decision A). Piece bounding radii come from the same
    // boot pass: authored `def.pieces` from their own size, the default
    // clone scaled — mirroring the geometry resolution in DebrisViews
    // (Decision B), so the cut path allocates nothing.
    const pieceRadii = new Map<string, readonly [number, number]>();
    for (const def of halloween.objects) {
        const radiusAt = (index: number): number => {
            const authored = def.pieces?.[index];
            return authored
                ? boxBoundingRadius(authored.size)
                : boxBoundingRadius(def.model.size) * CUT.pieceScale;
        };
        pieceRadii.set(def.id, [radiusAt(0), radiusAt(1)]);
    }

    function radiiFor(defId: string): readonly [number, number] {
        return pieceRadii.get(defId) ?? [0, 0];
    }

    const debris = new Debris(CUT.capacity, radiiFor);
    const debrisViews = createDebrisViews(
        scene,
        CUT.capacity,
        halloween.objects,
        objectViews.materials,
    );

    // Bounds change with aspect, so the outline is redrawn on every reframe.
    const syncViewport = createViewportSync(renderer, playfield, (bounds) => {
        if (debugRect) writeDebugRect(debugRect, bounds);
    });
    syncViewport();

    const hud = createHud(createUiRoot());

    const input = new Input(canvas, createSwipeProjector(camera));

    const bladeTrail = createBladeTrail(scene, camera, 32);
    input.onStrokeStart((w) => bladeTrail.start(w));
    input.onStrokeMove((w) => bladeTrail.add(w));
    input.onStrokeEnd(() => bladeTrail.end());

    // Steps 4A–B: input emits on pointer events (outside the sim); segments
    // are captured here — gated per stroke (SWIPE.gateDistance) — and drained
    // at the top of each fixed step, where step 5's Slicer cuts against
    // pre-move pool state.
    const swipes = new Swipes(SWIPE.gateDistance);
    input.onSwipe((segment) => swipes.push(segment));
    input.onStrokeStart(() => swipes.beginStroke());
    input.onStrokeEnd(() => swipes.endStroke());

    // Step 5: drained segments become cuts; each cut scores and spawns two
    // debris pieces. Cuts run inside the drain — before spawner/physics move
    // anything — so the hit test and the pieces' inherited velocity both see
    // pre-move state (Decision 4C).
    const score = new Score();
    const slicer = new Slicer({
        score,
        pieces: (parent, nx, ny) => debris.spawn(parent, nx, ny),
        onCut: DEBUG_CUT ? logCut : undefined,
    });

    // Discarded with the loop's backlog on a hidden tab, so a stale stroke
    // never hits the resumed sim. The listener lives here rather than in
    // Swipes so the class stays DOM-free for verify-swipe (bun).
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) swipes.clear();
    });

    // Consumed from fixedUpdate below; function declarations so the sim path
    // never allocates a closure per step.
    function logSwipe(segment: SwipeSegment): void {
        console.info(
            `step swipe ${segment.from.x.toFixed(2)},${segment.from.y.toFixed(2)} -> ${segment.to.x.toFixed(2)},${segment.to.y.toFixed(2)}`,
        );
    }

    function logCut(defId: string, points: number): void {
        console.info(`cut ${defId} ${points >= 0 ? '+' : ''}${points}`);
    }

    function cutSwipe(segment: SwipeSegment): void {
        if (DEBUG_SWIPE) logSwipe(segment);
        slicer.cut(objects, segment);
    }

    // Dev-only overlay. Vite drops the whole block from the production build,
    // so it never reaches the service worker's precache.
    const stats = import.meta.env.DEV ? new (await import('stats.js')).default() : undefined;
    if (stats) {
        document.body.appendChild(stats.dom);
    }

    // Step 6: the round clock. `progress` finally un-stubs the spawn ramp
    // (Decision 3E); `over` freezes the board mid-air (Decision C) and the
    // card's restart re-arms everything (Decision G).
    const round = new Round(ROUND.duration);

    // Every mutable system back to boot state — or round 2 silently differs
    // from round 1. View sync picks the resets up on the next frame.
    function restart(): void {
        score.reset();
        round.reset();
        spawner.reset();
        objects.releaseAll();
        debris.clear();
        swipes.clear();
    }

    hud.onRestart(restart);

    const loop = new GameLoop({
        fixedUpdate: (dt) => {
            if (round.over) return;

            // Step 5A: drain first, before spawner/physics move anything —
            // segments are cut against pre-move positions. Once per fixed
            // step, not per render: a frame with 0 sub-steps leaves the
            // segments for the next step to consume.
            swipes.drain(cutSwipe);
            spawner.step(objects, playfield.bounds, dt, round.progress);
            physics.step(objects, playfield.bounds, dt);
            // Step 5B: pieces tumble after the sim that spawned them; the
            // launch line doubles as their floor (Physics despawn semantics).
            debris.step(dt, LAUNCH_LINE_Y);
            // Clock last: the step that crosses the buzzer completes fully,
            // every later step is frozen (step 6 Decision B).
            round.step(dt);
        },
        render: () => {
            stats?.begin();
            syncViewport();
            syncViews(objectViews, objects.items);
            syncDebrisViews(debrisViews, debris.pieces);
            // HUD reads latest state (never steps); both calls no-op when
            // nothing changed, so the steady frame does no DOM work.
            hud.sync(score.total, round.secondsLeft);
            if (round.over) hud.showGameOver(score.total);
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
