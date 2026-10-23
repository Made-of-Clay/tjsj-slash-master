## Change Log

Record **ultra-terse** changes below. Sentence fragments okay if clear. Only log relevant details. Agents aren't blogging.

## 2026-10-23

### Step 7 — harness + close-out (D)

- `scripts/verify-content.ts` + `pnpm verify:content` (111 checks): registry
  lookup/fallback, per-theme contract (unique ids, category/score, hex colours,
  range sanity, depth pinned), bake contract (attrs, stripped uv/uv1/tangent,
  colour count, box fits + centred, authored pieces fit their own size, asset
  throw, template untouched), spawn fit (radius ≤ `sideMargin`, slugs, size
  band), import-graph isolation (gameplay, main-only registry, rendering,
  content data-only), material config. Negative-tested with injected imports.
- `scripts/node-shim.d.ts`: minimal `node:fs` declarations (no `@types/node`).
- Close-out: AGENTS state/decisions/commands, README verify commands,
  PERF-BUDGET bake note + current payload numbers.
- Chain green: vendor 235.83 kB gzip, app 8.94 kB gzip, precache 1045.66 KiB;
  no decoder assets.

### Step 7 — Christmas theme + registry + boot selection (C)

- `content/models/christmas.ts`: procedural recipes — ornament (globe + cap +
  torus loop), candyCane (shaft + half-torus hook joined at the shaft top),
  gift (box + two ribbons + two bow spheres), snowGlobe (glass + base + tree).
  108–504 tris per def, all centered within 0.03 and inside `size`.
- `content/themes/christmas.ts`: icy palette, cool lighting, own accents and
  slightly tighter early spawn cadence — data-only swap proof.
- `content/themes/index.ts`: `THEMES` registry, `ThemeId`, `DEFAULT_THEME_ID`,
  `getTheme`, `resolveThemeId` (unknown/absent → default).
- `main.ts`: resolves `?theme=<id>` once at boot, logs `theme: <id>`, injects
  the resolved `Theme` everywhere (scene/views/spawner/debris/piece radii).
  No gameplay file touched.
- `README.md`: step 7 plan link + `?theme=christmas` note.
- Payload: vendor +0.3 kB gzip, app +0.5 kB gzip; precache 1045.66 KiB.
- Full chain green (foundation/playfield/launch/swipe/cut/rules + build).
- Pending eyeball: Christmas silhouettes/palette, both themes on device.

## 2026-10-23

### Step 7 — Halloween models + authored pumpkin halves (B)

- `content/models/halloween.ts`: full procedural recipes — pumpkin (body +
  stem), candy (barrel body + two wrapper cones), ghost (`LatheGeometry` profile
  - recessed eye spheres), skull (cranium + jaw + dark sockets). 80–376 tris
    per def, every part inside its `size` box.
- `content/themes/halloween.ts`: four defs (`pumpkin`/`candy`/`ghost` +1,
  `skull` −1); sizes 1.0–1.1 → radius ≤ 0.95 ≤ `PLAYFIELD.sideMargin`.
- Authored pieces: `createPumpkinHalves()` → two half-shells (`phiStart` 0/π)
  with flesh-coloured caps facing out of each half. Other defs keep the
  default `CUT.pieceScale` clone.
- `scripts/verify-launch.ts`: containment bound uses the largest theme radius
  (side launches offset by each def's own radius; mixed sizes broke the old
  pumpkin-only bound).
- Payload: vendor +0.3 kB gzip, app +0.2 kB gzip; precache 1042.77 KiB.
- Full chain green (foundation/playfield/launch/swipe/cut/rules + build).
- Pending eyeball: proportions/colours under ACES, emissive balance, cut halves.

## 2026-10-22

### Step 7 — model seam + bake (A)

- Plan: `docs/PLAN-STEP-7-content.md` (decisions A–L locked 2026-10-22).
- `content/types.ts`: `ObjectModel` → `{ kind:'parts', parts: ModelPart[], size }`
  | `{ kind:'asset', url, size }` (step-9 loader seam, bake throws). `ModelPart`
  = geometry + sRGB `color` + optional local transform. `primitive`/`geometry`
  variants deleted.
- `rendering/Model.ts`: `bakeModel` — clone parts (never mutate templates),
  strip uv/uv1/tangent, normalise indexing, bake transform, linear vertex
  colours, `mergeGeometries` → one geometry per def. Boot-only, GPU-free.
- `rendering/Materials.ts`: `createObjectMaterial` — one shared material per
  category, `vertexColors`, theme accent as emissive (restricted stronger).
  `OBJECT_MATERIAL` config (roughness/metalness/emissive).
- `ObjectViews`/`DebrisViews` consume baked geometry; authored pieces bake at
  final size, default pieces clone the baked parent × `pieceScale`.
- `content/models/halloween.ts`: 7A two-part stand-ins (pumpkin body+stem,
  skull cranium+jaw), marked for 7B replacement. Bounding radius unchanged
  (`size` 1.0 → 0.87 ≤ `sideMargin`).
- Harness fake defs migrated to parts models (`verify-cut`, `verify-rules`).
- Payload: vendor +1.6 kB gzip (`BufferGeometryUtils.mergeGeometries`); no
  draco/basis/ktx2 in `dist/assets`. Precache 1040.90 KiB.
- Full chain green (foundation/playfield/launch/swipe/cut/rules + build).
- Pending 7A eyeball: model proportions/colours, emissive balance.

## 2026-10-21

### Step 6 — harness + close-out (C–D)

- `scripts/verify-rules.ts` + `pnpm verify:rules` (32 checks): Round clock
  (buzzer latches exactly once at duration and persists, ceil `secondsLeft`,
  fractional progress, reset), `Spawner.reset` (cadence credit, skip counter),
  `Pool.releaseAll` (reset items; empty/full/double-safe), Round × Spawner
  (ramp bites: 7 launches vs 2 at flat progress; progress 0 vs 1 endpoints),
  config sanity.
- Review fixes while [human] eyeballed: `.game-over[hidden] { display: none }`
  (CSS `display` beat the `hidden` attribute), `pointer-events: auto` on the
  card (the root's `none` let taps fall through to the canvas), final score
  labelled `Score N`, HUD re-laid as a centered `Score: N / Time: T` bar.
- Handoff docs: AGENTS state, CHANGELOG, README plan link.

### Step 6 — round clock + HUD + restart (A–B)

- Plan: `docs/PLAN-STEP-6-rules.md` (decisions A–J locked 2026-10-21; C =
  freeze mid-air). Commits `765e40c` + `a4cf524`.
- **A:** `game/Round.ts` (duration/progress/over/secondsLeft/reset; rejects
  non-positive duration); `ROUND.duration = 30`; `Spawner.reset()` +
  `Pool.releaseAll()`; `fixedUpdate` early-returns while `over` (board freezes,
  clock runs last so the buzzer step completes fully) and the spawn ramp runs
  on real `round.progress` for the first time (Decision 3E un-parked).
- **B:** `ui/hud.ts` — score/timer widgets (DOM writes only when a displayed
  integer changes) + game-over card (real `<button>`, whole card taps
  restart); `main.ts` `restart()` re-arms score/round/spawner, pool,
  debris, swipes; HUD + card styles in `style.css`.

## 2026-10-21

### Chopping-bug fix — depth pinned to z=0

- **Symptom:** "some cubes aren't chopping; inconsistent" — root cause: the
  blade segment lives on z = 0 while spawns used `depthRange [-1, 1]` + `vz`
  drift. Three compounding effects: (1) dead zone — `|z| > radius + pad`
  (0.97) is mathematically unchoppable; (2) in-plane reach shrinks with depth
  (`√(0.97² − z²)` → 0.55 at z = 0.8); (3) perspective parallax — a deep cube's
  screen position maps to a shifted z=0 point, so aiming at what you see misses
  the true x/y. Shallow cubes cut fine, deep ones barely or never.
- **Fix (data-only, per [You]: keep z = 0 — simplest):** theme
  `depthRange: [-1, 1] → [0, 0]`; `SPAWN.depthDrift: 0.4 → 0`. No Spawner code
  change (`vz = drift × …` → 0; z sampled from `[0, 0]`).
- `Collision`/`types`/`config` comments rewritten: the 3D test stays (Decision
  3B), but a restored band must revisit the hit model (per-plane reprojection
  along the camera ray), not just data.
- `scripts/verify-cut.ts` 65 → **68 checks**: theme spawns on the play plane ·
  depth drift off · every spawn z within blade reach (`maxZ ≤ boxBoundingRadius
  - CUT.pad`) — all three fail if a band sneaks back without a hit-model change.

### Step 5 — harness + close-out (D–E)

- `scripts/verify-cut.ts` + `pnpm verify:cut` (65 checks): sphere-vs-segment cases (through-center/miss/graze/endpoint/inside-span/depth-band/diagonal/t-clamp/pad), Slicer cut-once + release ordering + mixed-score multi-cut + pad end-to-end + zero-length segment, Score model, Debris spawn math (offset/velocity/tumble, wobble pinned via `rand`) + integration + floor/life despawn + drop-oldest + allocation proxy, config sanity, Spawner→`SpawnedObject.score` wiring.
- Handoff docs: AGENTS state, CHANGELOG, README plan link.
- Pending [human]: `CUT` knob feel by eye; on-device portrait — cuts + pieces at 60 FPS, both backends.

### Step 5 — debris pieces (B–C)

- **B (`77a428d`):** `game/Debris.ts` — capped piece ring (64), presentation-only: never re-sliced/scored, no pool competition. 2 pieces per cut: offset ± slice normal (0.4× parent radius), velocity = parent × `inherit` + ±normal × `separation`, opposed z-tumble + halved parent spin, one wobble draw per pair (Decision 3F). Integration mirrors Physics; despawn below launch line or `CUT.life`; drop-oldest.
- `rendering/DebrisViews.ts` — mesh per slot; boot-built geometry cache: `GameObjectDefinition.pieces?` authored at final size, else parent geometry scaled clone (`pieceScale` baked); materials shared with ObjectViews.
- **C:** full `CUT` config block (pad/pieceScale/inherit/separation/offset/spin/life/capacity); `createGeometry` exported; stale ObjectViews comment fixed.

### Step 5 — hit test + cut (A)

- Plan: `docs/PLAN-STEP-5-cutting.md`. Commit `565b017`.
- **A:** `game/Collision.ts` — pure `segmentSphere` (3D sphere-vs-segment, scalar math, Decision 3B depth band); `game/Slicer.ts` — `cut(pool, segment)`: scan `pool.each`, first hit wins, score → pieces → release; `game/Score.ts` + `SpawnedObject.score` (launch-set, reset-zeroed); `main.ts` cuts inside the drain at the pre-move point; `DEBUG_CUT`.
- Plan deviations: `CUT.pad` config block landed in A (Slicer needed it); injectable `rand` moved to Debris (jitter lives where pieces spawn); `pieces?` sink optional until B.

## 2026-10-20

### Step 4 — verification + close-out (D–E)

- `scripts/verify-swipe.ts` + `pnpm verify:swipe` (44 checks): buffer mechanics + arrival→consumption pairing, FIFO/overflow/clamp/clear, copy semantics, gate (tap/crossing/exact-threshold/fast-flick/slow-drag/stroke boundaries), allocation proxy (identity reuse ≤ ring capacity), `SWIPE.gateDistance` sanity, `Input` driven by synthetic pointer events on a minimal `EventTarget` (bun has no DOM).
- Commit `898db5e` (D). Handoff: AGENTS state, CHANGELOG, README plan link.
- Pending [human]: `SWIPE.gateDistance` by thumb; on-device portrait — trail latency both backends, gate feel.

### Step 4 — swipe buffer + stroke gating (A–C)

- Plan: `docs/PLAN-STEP-4-swipe.md`. Commit `9c52911`.
- **A:** `game/Swipes.ts` — gated ring buffer (cap 32, copy-on-push, drop-oldest, `pending`/`drain`/`clear`); `main.ts` drains at top of `fixedUpdate` (pre-spawner/physics — step 5 tests pre-move positions), `visibilitychange` → `clear()`.
- **B:** `SWIPE = { gateDistance: 0.5 }` world units on the play plane (0 = ungated); gate opens once per stroke and holds until stroke end, crossing segment buffered whole; `beginStroke`/`endStroke` wired from `Input`.
- **C:** dev `onSwipe` probe removed; `Collision.ts` header → Step 5; `DEBUG_SWIPE` logs consumption only.

### Step 3 — verification + close-out (E)

- `scripts/verify-launch.ts` + `pnpm verify:launch` (38 checks): aim math against the closed form, fixed-step integration vs the analytic curve, despawn (line + sideways), pool exhaustion = skip/count/no-growth, side-launch containment, arc containment at 21:9/16:9/9:16, projector regression.
- Aim helpers `launchVy`/`flightTime`/`aimVx` exported pure from `Spawner.ts` so the harness tests the real formula, not a copy (allocation-free).
- PERF-BUDGET allocation item closed: `Physics` integrates in place, `Spawner` is allocation-free, `SpawnedObject` reset zeroes rotation on recycle.
- `DevCube.ts` already gone (removed at the 3C close). Real models/assets remain step 7 (content) / step 9 (payload).
- Pending [human]: on-device portrait run (`pnpm preview:mobile`) — arcs in frame, 60 FPS.

## 2026-10-19

### Step 3 — Spawner trajectories (D)

- `game/Spawner.ts` real: `dt` timer; `RampRange` interval/batch interpolated on round `progress` (0→1); closed-form aim (`vy=√(2g·Δy)`, `tFlight=2vy/g`, `vx=Δx/tFlight`); side launches at `sideLaunchChance`; injectable `rand` (decision F); pool exhaustion = skip + count, never grows.
- Aim guarantee: `apexRange` read as the `SpawnRules` contract (fraction of **full** field height above the launch line), plus a hard `vy` ceiling so no theme data can launch an arc off the top.
- `config.ts`: `SPAWN` block (`depthDrift`, `sideTargetInset`) + `DEBUG_SPAWN` (one-time exhaustion warn).
- `main.ts`: TEMP hand-launch volley deleted; `spawner.step(objects, bounds, dt, 0)` in `fixedUpdate`. `progress` stubbed at 0 until step 6 owns the round timer.
- Pending [human]: tune interval/batch/apex/spin + `GRAVITY` by eye.

## 2026-10-18

### Step 3 — object launching (A–C)

- Plan: `docs/PLAN-STEP-3-launching.md`. Workstreams A–C landed; D (Spawner) and E (harness) follow in the 10-19/10-20 entries.
- **A (`72f13ad`):** `game/SpawnedObject.ts` (pooled state, full reset on recycle, `boxBoundingRadius`); `game/Physics.ts` fixed-step integration + despawn → `pool.release`; `Pool.items` getter (slot binding); `GRAVITY = 20` in new `PHYSICS` config block.
- **B (`95ba761`):** `rendering/ObjectViews.ts` — one mesh per slot, geometry shared per model, one material per category from `theme.accents`; `syncViews` in `render`, no interpolation (decision A).
- **C (`d906a88`):** real `SpawnRules` (`RampRange{early,late}` for interval/batch, tuples for the rest); `halloween.ts` `pumpkin` (target +1) / `skull` (restricted −1) boxes; `sideMargin` 0.6 → 1.0.
- Course correction (decision E overridden): interval/batch **ramp with round progress** (1.2–2.0s → 0.6–1.1s, batch 1 → 2–3); `progress` stubbed until step 6.
- `rendering/DevCube.ts` deleted — pooled cubes are the lit subject.
- TEMP: `main.ts` hand-launch volley (3 at a time, random theme def, closed-form aim); workstream D replaces it.
- Real models/assets: not now — step 7 (content), step 9 (payload). `ObjectModel` union already supports the swap.

## 2026-10-16

### Step 2 — playfield course correction (full-width)

- Decision B flipped fit-bounds → **full-width**. `PLAY_BOUNDS` replaced by `PLAYFIELD` (`halfHeight` fixed, `centerY`, `sideMargin`); width is derived from the aspect and the camera distance is constant, so wide screens get a wider field instead of background margin.
- `Camera.ts`: `computeFitDistance`/`applyFraming` → `computePlayBounds` + `createPlayField` (live, in-place bounds). `createViewportSync` reframes the playfield and fires an `onReframe` callback.
- `PlayArea.ts`: debug rect is now a writable `Line` — `createDebugRect` + `writeDebugRect` (redrawn on every reframe). Still DEV-gated; confirmed dead-code-eliminated from `dist` (grep `3074208`/`2ee6a0` → none).
- `rendering/DevCube.ts`: temporary lit subject (2-unit cube, 45° X tilt, spins on Y) for by-eye lighting / tone-mapping / palette tuning.
- Both harnesses rewritten for the new policy (`verify-foundation` camera-fit, `verify-playfield` bounds/debug-rect).
- Pending [human]: `PLAYFIELD.halfHeight`/`sideMargin` + launch line, lighting/palette tuning, aspect-matrix + on-device sign-off.

## 2026-10-15

### Step 2 — MVP playfield

- Camera fit-to-bounds (`rendering/Camera.ts`): `computeFitDistance` + `applyFraming`, straight-on (decision A), re-derived from aspect on every resize. `PLAY_BOUNDS`/`CAMERA`/`LAUNCH_LINE_Y` in `config.ts`.
- Background: `scene.backgroundNode` TSL vertical gradient + vignette (`rendering/Materials.ts`), palette-driven (decision C). Missing from `@types/three` → typed cast. Dead CSS canvas gradient removed.
- Theme data: `content/themes/halloween.ts` + typed `Theme.background` (`ThemeGradient`/`ThemeLighting`); palette threads through `Scene.ts` lights + background. Gameplay never reads it.
- Tone mapping (default ACES) + `LIGHTING` intensities in `config.ts`; wired in `main.ts` (`toneMapping`/`toneMappingExposure`/`outputColorSpace`). Gotcha: the background composites through the same output transform, so tone mapping shifts palette colours.
- Play area: `rendering/PlayArea.ts` — allocation-free `contains`/`clampToBounds` (step 3 `Spawner` contract) + DEV `LineLoop` rect, dropped from the production bundle.
- `placeholder.ts` + its pulse material deleted; `main.ts` is a composition root only.
- Harness: `scripts/verify-playfield.ts`, `pnpm verify:playfield`. Decision E holds: no shadow maps.
- Pending [human]: final `PLAY_BOUNDS`/launch-line numbers, lighting/palette tuning, aspect-matrix + on-device sign-off.

## 2026-10-05

### Step 1 — project foundation

- Renderer: `WebGLRenderer` → `WebGPURenderer` (`three/webgpu`), TSL from `three/tsl`. Auto-falls back to WebGL2. `await renderer.init()` gates rendering; backend logged at startup.
- Structure: `src/game|rendering|content|ui` per plan. `main.ts` is a composition root only. Deleted `addHelpers`, `addLights`, `getGui`, `getScene`, `ProjectCamera`, `helpers/*`; `getLoadingManager` → `rendering/loading.ts`.
- `game/GameLoop.ts` — fixed 1/60 timestep, accumulator + `MAX_SUB_STEPS` clamp, pauses on `visibilitychange`, smoothed FPS, zero per-frame allocation. Driven by `renderer.setAnimationLoop`; no second rAF loop.
- `game/Input.ts` — pointer events only, so mouse/touch/pen share one path. `setPointerCapture`, first-pointer-wins, `getCoalescedEvents()`, NDC → world segment via an injected projector. `game/` imports nothing from `rendering/`.
- `game/Pool.ts` — fixed capacity, O(1) acquire/release, never grows, resets on release.
- `config.ts` — every tunable in one place, incl. the perf budget constants.
- `content/types.ts` — `GameObjectDefinition` / `Theme` / `SpawnRules` contracts only. Gameplay never reads `model`, so art can be swapped without touching rules.
- `rendering/Materials.ts` — TSL smoke test (`time`-driven `mix`), proves the node pipeline compiles.
- `rendering/Camera.ts` — fixed camera, no orbit controls. Viewport sync on resize/orientation events rather than a per-frame layout read.
- Removed `lil-gui`; `stats.js` now dynamic-imported under `import.meta.env.DEV`, so it is stripped from the production build.
- Package renamed `threejs-starter-vite` → `slash-master`.

Payload, after dropping the `three/examples/jsm/Addons.js` barrel (it was pulling every loader/exporter in for one `OrbitControls` import):

|                      | before                  | after                   |
| -------------------- | ----------------------- | ----------------------- |
| precache entries     | 25                      | 20                      |
| precache total       | 1631.60 kB              | 1020.47 kB              |
| three.js chunk       | 584.58 kB (gzip 146.71) | 831.49 kB (gzip 233.64) |
| draco/basis decoders | 1899.63 kB              | 0                       |

Net −611 kB precached. The three.js chunk grew ~247 kB because `three/webgpu`
is a much larger build than the WebGL-only one — the cost of adopting WebGPU up
front, already paid.

Budgets and how to measure them: `docs/PERF-BUDGET.md`.

Fixes found by the logic harness, both in `GameLoop`:

- Missing `this.#primed = true` meant every frame re-primed and returned: zero fixed steps ever ran and alpha stayed 0. Rendered a static scene at a healthy FPS while simulating nothing.
- `visibilitychange` was registered in `start()` and removed in `stop()`, so the first auto-pause unregistered the listener that had to resume the loop — one background left the tab frozen permanently. Now registered once in the constructor, with `#paused` separate from `#running`.

- Harness: `scripts/verify-foundation.ts`, 52 checks, run with `pnpm verify:foundation` (needs Bun — `src/` uses extensionless imports, which Node's ESM loader rejects). Added to `tsconfig`'s `include` so it type-checks on every `pnpm build` and cannot rot silently. No framework: plain assertions, no new dependency.

Caveat: WebGL2 fallback and on-device touch are still unverified — no Chrome locally, and `navigator.gpu` is unavailable in node. Fallback must be checked on a phone via `pnpm preview:mobile`.

### Earlier

- PWA: installable via `vite-plugin-pwa` — precache service worker + manifest, generated in `pnpm build`, registered from `src/main.ts`. Silent auto-update.
- Icons: 5 sizes generated from `public/icons/*.svg`; `pnpm icons` regenerates.
- Phone testing: `pnpm preview:mobile` builds, runs `vite preview` on loopback, proxies over TLS via Caddy. Device must trust Caddy's root CA once — SWs need a secure context, so plain `http://<lan-ip>` won't register the worker.
- Mobile shell: `touch-action: none` on canvas, `100dvh`, safe-area vars, notch/landscape/iOS meta.
- `firebase.json`: `no-cache` on `sw.js` + manifest, immutable on hashed assets.
- Fix: `pnpm build` was already broken at HEAD — unused `#cameraFolder` private field tripped `noUnusedLocals`. CI deploy was failing too.
- Caveat: keep `workbox-window` an explicit devDep. pnpm's auto-installed peer isn't resolvable by Rolldown, so the build fails without it.
