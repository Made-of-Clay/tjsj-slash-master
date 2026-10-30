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
    EFFECTS,
    DEBUG_PERF,
    DEBUG_PLAYFIELD,
    DEBUG_SWIPE,
    LAUNCH_LINE_Y,
    MAX_PIXEL_RATIO,
    POOL_SIZE,
    ROUND,
    SHAKE,
    SWIPE,
    TONE_MAPPING,
    TONE_MAPPING_EXPOSURE,
} from './config';
import type { ToneMappingMode } from './config';
import { getTheme, resolveThemeId } from './content/themes';
import { preloadModels } from './rendering/ModelAssets';
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
import { Combo } from './game/Combo';
import { Flow } from './game/Flow';
import { boxBoundingRadius, createSpawnedObject, resetSpawnedObject } from './game/SpawnedObject';
import type { SpawnedObject } from './game/SpawnedObject';
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
import { createSparkViews, syncSparkViews } from './rendering/SparkViews';
import { createShake } from './rendering/Shake';
import { Effects } from './game/Effects';
import { createHud } from './ui/hud';
import { createObjectIcons } from './ui/objectIcons';
import { createRecords } from './ui/records';
import { createAudio } from './audio/Audio';
import { createHaptics } from './ui/haptics';
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

    const params = new URLSearchParams(window.location.search);
    // Dev-only overlays are opt-in (`?dev`): the stats meter and the playfield
    // guide otherwise sit on top of the HUD controls.
    const devTools = import.meta.env.DEV && params.has('dev');
    const urlTheme = params.get('theme');
    const theme = getTheme(resolveThemeId(urlTheme));
    const themeSource = urlTheme === null ? 'default' : theme.id === urlTheme ? 'url' : 'fallback';
    console.info(`theme: ${theme.id} (${themeSource})`);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta instanceof HTMLMetaElement) {
        themeColorMeta.content = theme.background.top;
    }

    // Models resolve once, before any view exists: `parts` bake, the authored
    // GLBs are fetched. Awaiting here keeps every downstream bake synchronous.
    await preloadModels(theme.objects.flatMap((def) => [def.model, ...(def.pieces ?? [])]));

    const scene = createScene(theme);

    const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
    // Live playfield: width is derived from the aspect, so gameplay reads its
    // bounds from here rather than a constant.
    const playfield = createPlayField(camera);

    // Dev-only arena outline so the full-width bounds are visible against every
    // aspect ratio. Vite folds DEBUG_PLAYFIELD to false in the production build,
    // so the rect and its geometry are dropped from the bundle.
    const debugRect = DEBUG_PLAYFIELD && devTools ? createDebugRect(playfield.bounds) : undefined;
    if (debugRect) {
        scene.add(debugRect);
    }

    // Step 3A: pooled sim states + one fixed-step physics pass. The pool owns
    // reset (stale velocity can't survive a recycle); physics decides despawn.
    const objects = new Pool(POOL_SIZE, createSpawnedObject, resetSpawnedObject);
    const physics = new Physics();

    // Step 8A: one instanced mesh per def; `count` is the draw count. Models =
    // the theme's object defs; colour comes from theme accents, never from
    // gameplay (step 3 decision D).
    const objectViews = createObjectViews(
        scene,
        objects.items.length,
        theme.objects,
        theme.accents,
    );

    // Step 3D: the real launcher. It reads theme spawn rules + object defs
    // (decision D) and the live bounds each spawn, so it follows a resize.
    const spawner = new Spawner({
        rules: theme.spawnRules,
        defs: theme.objects,
    });

    // Step 5B: sliced pieces are presentation, not gameplay — their own
    // capped ring, integrated after physics, never competing with the
    // spawner (plan Decision A). Piece bounding radii come from the same
    // boot pass: authored `def.pieces` from their own size, the default
    // clone scaled — mirroring the geometry resolution in DebrisViews
    // (Decision B), so the cut path allocates nothing.
    const pieceRadii = new Map<string, readonly [number, number]>();
    for (const def of theme.objects) {
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
        theme.objects,
        objectViews.materials,
    );

    // Step 9A: cut feedback. Sparks are a fixed ring (presentation only); the
    // shake base pose is captured here, before any offset is applied.
    const effects = new Effects(EFFECTS.capacity);
    const sparkViews = createSparkViews(scene, EFFECTS.capacity, theme.accents);
    const shake = createShake(camera);

    // Bounds change with aspect, so the outline is redrawn on every reframe.
    const syncViewport = createViewportSync(renderer, playfield, (bounds) => {
        if (debugRect) writeDebugRect(debugRect, bounds);
    });
    syncViewport();

    // Step 11: the cards' object legend. Thumbnails come from the theme's own
    // baked models, so they follow any content change without authored art.
    const icons = createObjectIcons(theme.objects);
    const hud = createHud(
        createUiRoot(),
        theme.objects.map((def) => ({
            name: def.name,
            score: def.score,
            icon: icons.get(def.id) ?? null,
        })),
    );
    const records = createRecords();
    // Step 9D: boot waits on the start card; restart skips it.
    const flow = new Flow();
    hud.showStart();

    // Step 9C: audio unlocks on the first gesture (iOS rule); haptics are a
    // silent no-op where the platform has no vibrate. Mute silences both.
    const audio = createAudio();
    const haptics = createHaptics();
    let muted = records.muted;
    audio.setMuted(muted);
    hud.setMuted(muted);

    function pulse(kind: 'cut' | 'hazard' | 'over'): void {
        if (!muted) haptics.pulse(kind);
    }

    const input = new Input(canvas, createSwipeProjector(camera));

    // Step 13: the trail is one additive ribbon; the theme owns the hue and the
    // trail normalises it for additive headroom.
    const bladeTrail = createBladeTrail(scene, {
        tint: theme.palette.blade,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    input.onStrokeStart((w) => bladeTrail.start(w));
    input.onStrokeMove((w) => bladeTrail.add(w));
    input.onStrokeEnd(() => bladeTrail.end());

    // Steps 4A–B: input emits on pointer events (outside the sim); segments
    // are captured here — gated per stroke (SWIPE.gateDistance) — and drained
    // at the top of each fixed step, where step 5's Slicer cuts against
    // pre-move pool state.
    const swipes = new Swipes(SWIPE.gateDistance);
    const score = new Score();
    const combo = new Combo();
    input.onSwipe((segment) => swipes.push(segment));
    input.onStrokeStart(() => {
        // Inside the gesture: this is the only moment iOS allows an
        // AudioContext to start.
        audio.unlock();
        audio.play('swoosh');
        swipes.beginStroke();
    });
    input.onStrokeEnd(() => swipes.endStroke());

    // Step 5: drained segments become cuts; each cut scores and spawns two
    // debris pieces. Cuts run inside the drain — before spawner/physics move
    // anything — so the hit test and the pieces' inherited velocity both see
    // pre-move state (Decision 4C).

    // Step 9A: every cut answers with pieces, sparks and a shake kick — all
    // read from the parent before `pool.release` zeroes it (step 5E).
    function cutFeedback(parent: SpawnedObject, nx: number, ny: number): void {
        debris.spawn(parent, nx, ny);
        effects.burst(parent.position.x, parent.position.y, parent.radius, nx, ny, parent.category);
        shake.add(
            parent.category === 'target'
                ? SHAKE.cutTrauma
                : parent.category === 'hazard'
                  ? SHAKE.hazardTrauma
                  : SHAKE.hitTrauma,
        );

        if (parent.category === 'hazard') {
            audio.play('boom');
            pulse('hazard');
        } else {
            audio.play('pop');
            pulse('cut');
        }
    }

    const slicer = new Slicer({
        score,
        pieces: cutFeedback,
        onCut: DEBUG_CUT ? logCut : undefined,
    });

    // Discarded with the loop's backlog on a hidden tab, so a stale stroke
    // never hits the resumed sim. The listener lives here rather than in
    // Swipes so the class stays DOM-free for verify-swipe (bun). Input needs
    // the same reset: a stroke interrupted by the app switch never sees its
    // pointerup, and without this every later touch is ignored.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        input.cancelStroke();
        swipes.clear();
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

        const cuts = slicer.cut(objects, segment);
        if (cuts > 0) {
            // Step 13: the blade brightens for a beat so the hit reads.
            bladeTrail.flash();
            // Step 9B: the chain banks its own bonus; `combo.step` pays it out.
            const count = combo.register(cuts);
            if (count > 1) audio.play('combo', count);
        }
    }

    // Step 8D: dev draw-call readout. `renderer.info` resets per render, so it
    // is read after the draw; throttled to 1 Hz to keep the console readable.
    let nextPerfLog = 0;
    function logPerf(): void {
        const now = performance.now();
        if (now < nextPerfLog) return;
        nextPerfLog = now + 1000;

        const info = renderer.info.render;
        console.info(`draws: ${info.calls} triangles: ${info.triangles}`);
    }

    // Dev-only overlay. Vite drops the whole block from the production build,
    // so it never reaches the service worker's precache.
    const stats = devTools ? new (await import('stats.js')).default() : undefined;
    if (stats) {
        // stats.js pins itself top-left, where the pause button lives.
        stats.dom.style.top = 'auto';
        stats.dom.style.bottom = '0';
        document.body.appendChild(stats.dom);
    }

    // Step 6: the round clock. `progress` finally un-stubs the spawn ramp
    // (Decision 3E); `over` freezes the board mid-air (Decision C) and the
    // card's restart re-arms everything (Decision G).
    const round = new Round(ROUND.duration);

    // Every mutable system back to boot state — or round 2 silently differs
    // from round 1. View sync picks the resets up on the next frame.
    function restart(): void {
        audio.play('ui');
        flow.restart();
        hud.setPlaying(true);
        score.reset();
        combo.reset();
        round.reset();
        spawner.reset();
        objects.releaseAll();
        debris.clear();
        effects.clear();
        shake.reset();
        swipes.clear();
        overShown = false;
    }

    hud.onRestart(restart);

    hud.onStart(() => {
        // The card is DOM, so this tap never reaches Input: unlock here.
        audio.unlock();
        audio.play('ui');
        flow.start();
        hud.setPlaying(true);
    });

    hud.onPause(() => {
        if (!flow.active || round.over) return;

        flow.pause();
        hud.setPlaying(false);
        hud.showPaused();
        // A stroke interrupted by the card must not cut on resume.
        input.cancelStroke();
        swipes.clear();
        score.add(combo.flush());
        audio.play('ui');
    });

    hud.onResume(() => {
        flow.resume();
        hud.setPlaying(true);
        audio.play('ui');
    });

    hud.onMute(() => {
        audio.unlock();
        muted = !muted;
        records.setMuted(muted);
        audio.setMuted(muted);
        hud.setMuted(muted);
        audio.play('ui');
    });

    // The card is shown once, so the record is written once per round.
    let overShown = false;

    const loop = new GameLoop({
        fixedUpdate: (dt) => {
            if (!flow.active || round.over) return;

            // Step 5A: drain first, before spawner/physics move anything —
            // segments are cut against pre-move positions. Once per fixed
            // step, not per render: a frame with 0 sub-steps leaves the
            // segments for the next step to consume.
            // The chain ages before this step's cuts: one that lapsed between
            // steps pays out instead of absorbing a cut that arrived late.
            score.add(combo.step(dt));
            swipes.drain(cutSwipe);
            spawner.step(objects, playfield.bounds, dt, round.progress);
            physics.step(objects, playfield.bounds, dt);
            // Step 5B: pieces tumble after the sim that spawned them; the
            // launch line doubles as their floor (Physics despawn semantics).
            debris.step(dt, LAUNCH_LINE_Y);
            effects.step(dt);
            shake.step(dt);
            // Clock last: the step that crosses the buzzer completes fully,
            // every later step is frozen (step 6 Decision B).
            round.step(dt);
            // The buzzer can land mid-chain: bank what the chain earned.
            if (round.over) score.add(combo.flush());
        },
        render: () => {
            stats?.begin();
            syncViewport();
            // After the reframe: the shake offset is reapplied from the base
            // pose every frame, never accumulated into camera state.
            shake.apply();
            syncViews(objectViews, objects.items);
            syncDebrisViews(debrisViews, debris.pieces);
            syncSparkViews(sparkViews, effects.sparks);
            // Presentation-only clock: the trail's tail, fade and flash are
            // visual, never part of the fixed-step sim (Decision 4E).
            bladeTrail.update(performance.now());
            // HUD reads latest state (never steps); both calls no-op when
            // nothing changed, so the steady frame does no DOM work.
            const liveCombo = round.over ? 0 : combo.count;
            hud.sync(score.total, round.secondsLeft, liveCombo);
            if (round.over && !overShown) {
                overShown = true;
                const isBest = records.submit(score.total);
                hud.showGameOver(score.total, records.best, isBest);
                hud.setPlaying(false);
                audio.play('over');
                pulse('over');
            }
            renderer.render(scene, camera);
            if (DEBUG_PERF) logPerf();
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
