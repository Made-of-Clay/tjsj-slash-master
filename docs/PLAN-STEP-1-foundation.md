# Step 1 — Project foundation

Plan for [PLAN.md](../PLAN.md) §1. Extends it, doesn't replace it.

- Scope: project foundation only. Steps 2–10 untouched.
- Target: repo whose loop/input/pool/content contracts are settled, so step 2 drops in without rewrites.

## Decisions (locked)

| #   | Decision                                                       | Rationale                                                                                                                                                                                             |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `WebGPURenderer` from `three/webgpu` now; TSL from `three/tsl` | PLAN.md wants TSL in step 1 and TSL materials in step 8. Renderer auto-falls back to a WebGL2 backend, so no-WebGPU devices still work. Swapping the renderer later would rewrite all rendering code. |
| 2   | Working skeleton, not empty stubs                              | Stub-only means nothing is verifiable until step 2.                                                                                                                                                   |
| 3   | Prune starter template                                         | Dead code, plus `Addons.js` costs ~1.9 MB wasm.                                                                                                                                                       |
| 4   | Formatting baseline                                            | Done in `49a47e0`. `fmt:check` green; new code lands formatted.                                                                                                                                       |

## Already in place — no work

- Vite 8 + TypeScript 7 + pnpm 11, oxlint + oxfmt configured.
- PWA: precaching service worker, manifest, `registerSW({ immediate: true })` in `src/main.ts`.
- Device pixel ratio capped at 2.
- Mobile shell: `touch-action: none`, `100dvh`, safe-area CSS vars, `viewport-fit=cover`.
- `pnpm preview:mobile` (Caddy TLS on LAN) and the Firebase deploy workflow.
- Verified clean at `49a47e0`: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm fmt:check`.

## Gaps — this step's work

1. **Renderer swap** — `WebGLRenderer` → `WebGPURenderer`, `await renderer.init()`, `setAnimationLoop` as the only frame driver. Drop the dummy cube, the `PointLight` shadow config, and the per-frame `console.log('delta', delta)`.
   - Verified: `three/webgpu` and `three/tsl` both type-check under TS 7 + `@types/three` 0.185.4.
   - `three.module.js` and `three.webgpu.js` both import `./three.core.js`, so addons keep sharing core classes — no `instanceof` breakage, no duplicated core.
2. **Prune + restructure** to the PLAN.md tree.
3. **`game/GameLoop.ts`** — fixed timestep, no per-frame allocation.
4. **`game/Input.ts`** — pointer events only; one code path for mouse, touch, pen.
5. **`game/Pool.ts`** — fixed capacity, free-list, no growth.
6. **`config.ts`** — every tunable in one place.
7. **Bundle hygiene** — kill the decoders, verify `dist`.
8. **Contracts only, no data** — `content/types.ts`; `game/` stubs for the step 3+ systems.
9. **`docs/PERF-BUDGET.md`** — numbers + how to measure.

## Target tree

```
src/
  main.ts                  composition root only
  config.ts                tunables, incl. perf budget constants
  style.css
  game/
    Game.ts                stub
    GameLoop.ts            fixed timestep + pause + fps
    Input.ts               pointer → world-space swipe segment
    Pool.ts                fixed-capacity free list
    Spawner.ts             stub
    Physics.ts             stub
    Collision.ts           stub
    Score.ts               stub
  rendering/
    Scene.ts               scene + lights (absorbs getScene, addLights)
    Camera.ts              fixed camera, no controls
    Materials.ts           shared node materials, keyed by theme
  content/
    types.ts               GameObjectDefinition, Theme, SpawnRules
  ui/
    root.ts                overlay mount only, no widgets
```

### Deleted

`addHelpers.ts` · `ProjectCamera.ts` · `getGui.ts` · `getScene.ts` · `addLights.ts` · `helpers/animations.ts` · `helpers/fullscreen.ts` · `helpers/responsiveness.ts` (resize moves into `Camera.ts`/`main.ts`)

### Kept, moved

`getLoadingManager.ts` → `rendering/loading.ts` (needed once models arrive).

### Dependency changes

- `lil-gui` — remove. Config lives in `config.ts`; a GUI re-introduces ceremony the brief calls out.
- `stats.js` — keep, but dynamic-import behind `import.meta.env.DEV` so it never ships in the precache. Step 8 needs the FPS meter.

## Contracts

### `game/GameLoop.ts`

```ts
export interface LoopHooks {
  fixedUpdate(dt: number): void;
  render(alpha: number): void;
}

export interface LoopOptions {
  step?: number; // default config.FIXED_STEP
  maxSubSteps?: number; // default config.MAX_SUB_STEPS
}

export class GameLoop {
  constructor(hooks: LoopHooks, options?: LoopOptions);
  start(): void;
  stop(): void;
  dispose(): void;
  tick(timestamp: number): void; // passed to renderer.setAnimationLoop
  readonly running: boolean; // caller intent
  readonly paused: boolean; // hidden-tab suppression
  readonly active: boolean; // running && !paused
  readonly fps: number; // EMA, 0 while stopped
}
```

- `renderer.setAnimationLoop` drives it; no second rAF loop in the app.
- Accumulator + clamp. Without `maxSubSteps`, a long stall (backgrounded tab, GC) produces a catch-up spiral and the tab locks up.
- `visibilitychange` sets `paused`, and is registered **once in the constructor** rather than in `start()`/`stop()`. Binding it to start/stop means the first auto-pause unregisters the listener that has to resume the loop, leaving the tab frozen forever after one background.
- Pausing and `stop()` both discard the accumulator, so resuming never replays missed steps.
- `tick` is an arrow field, so `loop.tick` can go straight to `setAnimationLoop` with no `bind` allocation.
- No allocation in the hot path: accumulator, EMA state, and step bookkeeping are instance fields, not locals recreated per frame.

### `game/Input.ts`

```ts
export type Projector = (ndcX: number, ndcY: number, out: Vector3) => void;

export interface SwipeSegment {
  readonly from: Vector3; // reused instance — copy, don't retain
  readonly to: Vector3; // reused instance
}

export class Input {
  constructor(target: HTMLElement, project: Projector);
  onSwipe(handler: (segment: SwipeSegment) => void): void;
  dispose(): void;
}
```

- Pointer Events only. `pointerdown`/`pointermove`/`pointerup` cover mouse, touch, and pen — no separate mobile path.
- `setPointerCapture` on down so a swipe that leaves the canvas still delivers its `pointerup`.
- First `pointerId` wins; later pointers ignored, so a second finger can't hijack a swipe.
- `getCoalescedEvents()` on move, so a fast swipe yields multiple segments instead of one aliased jump.
- `from`/`to` are reused `Vector3`s to keep the swipe allocation-free. Documented on the interface: handlers must copy if they keep the values (step 5 will).
- `Projector` is injected rather than importing `Camera` — keeps `game/` free of `rendering/` imports, so the dependency arrow only points one way.
- Swipe trail rendering is step 4. Step 1 only proves events arrive.

### `game/Pool.ts`

```ts
export class Pool<T> {
  constructor(size: number, factory: () => T, reset: (item: T) => void);
  readonly size: number;
  readonly available: number;
  acquire(): T | undefined; // undefined when exhausted
  release(item: T): void;
}
```

- Pre-allocated in the constructor. Never grows — a pool that grows is an allocation in the frame that needed it.
- Free list is an index array; no splice, no wrapper objects.
- `reset` clears position/velocity/rotation/active state so a recycled object can't leak last life.

### `config.ts`

```ts
export const TARGET_FPS = 60;
export const MAX_PIXEL_RATIO = 2;
export const FIXED_STEP = 1 / 60;
export const MAX_SUB_STEPS = 5;
export const POOL_SIZE = 64; // objects in flight, tuned in step 3
```

### `content/types.ts`

```ts
export type ObjectCategory = "target" | "restricted";

export type ObjectModel =
  | { kind: "primitive"; geometry: "box" | "sphere"; size: number }
  | { kind: "geometry"; geometry: BufferGeometry; size: number };

export interface GameObjectDefinition {
  id: string;
  score: number;
  category: ObjectCategory;
  model: ObjectModel;
}

export interface SpawnRules {
  // step 3: intervals, launch speed range, arc variance, depth range
}

export interface Theme {
  id: string;
  background: unknown; // step 2 owns the real shape
  objects: GameObjectDefinition[];
  spawnRules: SpawnRules;
}
```

- No theme data in this step. `content/themes/` arrives with step 7.
- `ObjectModel` is a union so `primitives` (step 3 cubes) and real geometry (step 9) share one field. Gameplay reads `id`/`score`/`category` only, never `model` — that's the step 7 guarantee, enforced now by not writing the code that would break it.
- `background: unknown` is deliberate: typing it now would invent a shape step 2 hasn't decided.

### Stubs (`Game.ts`, `Spawner.ts`, `Physics.ts`, `Collision.ts`, `Score.ts`)

Each exports its real signature and throws `new Error('not implemented: step N')`, naming the step that fills it in. This keeps `tsc` honest about the surface without pretending the systems exist.

## Bundle hygiene

- `src/ProjectCamera.ts` imports `three/examples/jsm/Addons.js` — a 297-module barrel. That's why `dist/assets` currently ships `draco_*` and `basis_*` decoders (~1.9 MB wasm) for a single `OrbitControls` use.
- Fix: import `three/addons/controls/OrbitControls.js` directly, or drop controls entirely. Step 1 drops them — PLAN.md step 2 wants a fixed camera, and `OrbitControls` captures the canvas pointer, which collides with the swipe handler that owns it.
- Accept: `three` is ESM with `sideEffects: ["./src/nodes/**/*"]`, so unused modules tree-shake.
- Re-check `vite.config.ts` `manualChunks` afterwards: the `vendor` split was sized around the old graph.

## Verification

```bash
pnpm exec tsc --noEmit # clean
pnpm lint # clean
pnpm fmt:check # clean
pnpm build # succeeds
```

Then assert:

- `ls dist/assets` — no `draco_*`, no `basis_*`. Record the before/after sizes.
- `pnpm dev` — placeholder scene renders; `stats.js` FPS meter shows 60; switching tabs stops the loop (watch the meter freeze, and CPU drop in devtools).
- Desktop: drag across the canvas, confirm swipe segments fire.
- Phone: `pnpm preview:mobile`, confirm the same path works under touch, and confirm which renderer backend was chosen.

## Risks

- **WebGPU is unverifiable locally.** Only Firefox is installed and `navigator.gpu` is unavailable in node, so the WebGL2 fallback has to be validated on a real device via `pnpm preview:mobile`. A green desktop run proves nothing about the fallback.
- **WebGL2 fallback has no storage buffers** (emulated via PBO textures). Don't reach for compute in the MVP.
- **`await renderer.init()` makes startup async.** Nothing may render before it resolves.
- **TS 7 + Vite 8/rolldown** are new; a toolchain regression would look like a game bug. Keep build and lint green every commit so the failure is attributable.

## Definition of done

- [ ] `src/` matches the target tree; no starter-template files remain.
- [ ] `WebGPURenderer` initialized and driving frames via `setAnimationLoop`.
- [ ] `GameLoop` runs a fixed 1/60 step, clamps sub-steps, pauses when hidden, reports fps.
- [ ] `Input` emits world-space swipe segments from pointer events; mouse and touch share one path.
- [ ] `Pool` acquire/release with no growth and no per-frame garbage.
- [ ] `content/types.ts` compiles; no theme data.
- [ ] `dist/assets` free of draco/basis; before/after sizes recorded in `CHANGELOG.md`.
- [ ] `docs/PERF-BUDGET.md` written; `README.md` links it.
- [ ] `pnpm build`, `pnpm lint`, `pnpm fmt:check` all green.
- [ ] `CHANGELOG.md` entry for the step.

## Commits

1. `refactor: prune starter template, adopt WebGPURenderer + TSL`
2. `feat: game skeleton — loop, input, pool, config`
3. `perf: drop three addons barrel, verify bundle`
4. `docs: performance budget`

## Needs you (not automatable)

- `firebase.json` `hosting.site` and the `deploy.yml` `target` are both still `tjsj-REPLACE-ME` — CI cannot deploy until the real site id is in.
- `firebase.json` uses `"//"` string keys as comments. Check that firebase-tools doesn't reject them as unknown properties; if it does, convert to real `//` line comments.
