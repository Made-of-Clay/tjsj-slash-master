## Change Log

Record **ultra-terse** changes below. Sentence fragments okay if clear. Only log relevant details. Agents aren't blogging.

## 2026-10-30

### Halloween background art

- `content/themes/halloween-background.jpeg` (1024², sRGB) is the halloween
  background. `ThemeGradient.image` (optional URL) carries it; `createBackgroundNode`
  samples it cover-fitted via `screenUV`/`screenSize`, so it stays centred, fills
  the window and crops the overflowing axis — no letterbox bars at any aspect.
- `rendering/Materials.ts`: `loadBackgroundImage` (`TextureLoader`, sRGB);
  `main.ts` fetches it alongside the models, before the scene exists.
- Halloween `vignetteStrength` 0.6 → 0.25: the art has its own falloff.
- Fix: cover had the crop fractions swapped — a wide window cropped x instead
  of y, so a 1:1 image filled the height and stretched across the width. It now
  crops the axis that actually overflows.
- Fix: `screenUV` is top-down (y = 0 at the top) in both backends, while a
  flipY upload puts the image's bottom row at v = 0 — the art rendered upside
  down. v is inverted for the image, and the gradient (christmas) now puts
  `top` at the top, matching `ThemeGradient`'s contract.

### Step 13 — blade trail

- `rendering/BladeTrail.ts`: `LineBasicMaterial` hairline → one additive ribbon,
  3 verts per sample, preallocated arrays and a once-filled index buffer. Width
  is a world-unit number now; `linewidth` never was.
- Tail is a time window (`BLADE.tailSeconds`), so a held pointer no longer
  leaves a permanent snake; `end()` fades over `BLADE.fadeSeconds` instead of
  snapping off; `flash()` on a cut widens and brightens for a beat.
- Tint derives from `theme.background.top` (lightened toward white for additive
  headroom) in `main.ts`; `rendering/` still imports no content.
- `depthTest: false` — the blade draws over fruit, so no z lift is needed.
- Reduced motion (`prefers-reduced-motion`) snaps off and skips the flash.
- `config.ts` `BLADE` block; `verify:perf` guards `writeGeometry`/`update` and
  asserts the tail trim, flash width, fade and reduced-motion paths (93 checks).
- Draw budget unchanged at 17: the trail is still one draw.
- `ThemePalette.blade` (`content/types.ts`, both themes): the blade hue is theme
  data now — ember `#ff8a3d` for halloween, ice `#8fd6ff` for christmas. Deriving
  from `background.top` made both blades the same teal (13E supersedes 13C).
  `verify:content` 160 → 165 checks (hex, own-choice, distinct hues).
- Fix: `BLADE.tintWhiteMix` was inert. `palette.top` is near-black in linear
  space, so lerping it to white left chroma 0.009. The tint is now normalised to
  full brightness first, making the knob a real saturation slider (0.30 chroma
  at 0.65); `verify:perf` asserts the hue survives (97 checks).

## 2026-10-29

### Skull ships as an authored asset

- `content/models/skull/`: generator, `.blend`, `.glb` (998 tris, 29 028 B) and
  the four previews. Solid superellipsoid cranium; two eye pockets and a nose are
  boolean intrudes with dark floors, the four teeth are surface-keyed prisms.
- `content/models/halloween.ts`: `createSkullModel` returns the GLB at
  `size: 1`; the procedural skull parts are gone.
- `verify:content` 157 → 160 checks (skull tri/byte/viewport budget).

## 2026-10-27

### Step 11 — card object legend

- `content/types.ts`: `GameObjectDefinition.name`; both themes author display
  names. Copy lives with the objects.
- `ui/objectIcons.ts`: boot-time thumbnails from each def's baked geometry —
  orthographic CPU projection with a z-buffer and flat shading, emitted as PNG
  data URLs. No GPU readback, no authored art, identical on both backends.
- `ui/hud.ts` + `style.css`: start, pause and game-over cards list every
  slashable object as icon + name + signed points; negatives in red.
- `main.ts`: thumbnails built once before the card; the HUD still receives
  primitives only (`name`, `score`, `icon`).
- `verify:content` 143 → 154 checks (names + a visible-icon render per def);
  `verify:docs` now expects eleven step docs.

## 2026-10-26

### Step 10 — built default + boot override

- `content/themes/index.ts`: `VITE_DEFAULT_THEME` read through
  `import.meta.env` (optional-chained, registry-validated, `halloween`
  fallback); `define` dropped — Vite 8 dev ignores it. `resolveDefaultThemeId`
  replaces the `resolveBootThemeId` alias.
- `main.ts`: `?theme=` resolved once at boot; log
  `theme: <id> (url|fallback|default)`; `theme-color` follows the resolved
  theme.
- `vite.config.ts`: imports the theme registry; manifest `theme_color` uses the
  built theme's `background.top`. `loadEnv(mode, '.', '')` avoids untyped
  `process.cwd()`.
- `verify:content` 133 → 143 checks; selection block moved above the failure
  gate (it previously ran after the summary and could not fail).

### A held pointer no longer slices

- Bug: holding touch/mousedown farmed combo and score — the blade kept
  cutting fruit that drifted under a stationary pointer.
- `game/Input.ts`: jitter floor is now **6 CSS px** (`MIN_SEGMENT_PX`, was
  0.004 NDC ≈ 1 px). A resting hand trembles 1–3 px, and the old floor emitted
  a segment per frame, which also fed the gate.
- `game/Swipes.ts`: gate measures **distance from the stroke origin**, not
  accumulated path length — scrubbing back and forth covered distance without
  displacing, so a held pointer opened the gate on its own.
- `verify:swipe` 47 → 51 checks (tremor emits nothing, tremor never opens the
  gate, slow drag still emits, scrubbing in place stays shut).

### Combo is keyed on time, not the pointer stroke

- Bug: holding touch/mousedown kept one stroke open forever, so every cut fed
  the same chain and the multiplier climbed without bound.
- `game/Combo.ts`: `register(cuts)` banks `COMBO.step × (k − 1)` and restarts
  `COMBO.window` (0.6 s); `step(dt)` pays the bank when the window lapses;
  `flush()` closes a chain early. `reset()` drops it.
- `main.ts`: chain ages before the drain, payout lands in `Score`, pause and
  the buzzer flush; `strokeActive`/`Swipes.stroke` removed (no other consumer).
- `verify:rules` 40 → 53 checks (window lapse, held pointer, mid-window cut,
  stepped accumulation, flush, reset).

### Dev overlays opt-in

- stats.js meter + playfield guide rect now require `?dev` on the dev server
  (both were always on in dev and the meter covered the pause button). Meter
  moved to bottom-left. Production still drops both.

## 2026-10-25

### Step 9 — flow + close-out (D)

- `game/Flow.ts`: `ready | playing | paused`, `active` gate,
  `start/pause/resume/restart/reset`; restart skips the start card.
- `ui/hud.ts`: start card at boot, pause button (safe-area top-left) + resume
  card, shared `.overlay` card builder; pause button hides while a card is up.
  Mute + pause are appended after the cards so both stay tappable.
- `main.ts`: `fixedUpdate` gated on `flow.active && !round.over`; start tap
  unlocks audio; pause cancels the stroke + clears the swipe buffer; round end
  hides the pause control; restart re-arms flow.
- `verify:polish` 51 checks (+16 flow: transitions, idempotence, restart/reset,
  frozen clock before start, held clock while paused, buzzer after resume).
- Docs close-out: AGENTS state/decisions/commands, README link + command,
  PERF-BUDGET step-9 allocations, spark memory, payload table + target
  revision (2.5 → measured 3.2 kB gzip).
- Chain green: foundation/playfield/launch/swipe(47)/cut(68)/rules(40)/
  content(133)/perf(79)/polish(51) + build. Vendor 865.48 kB (237.64 gzip),
  app 34.13 kB (12.44 gzip), precache 1061.77 KiB; no decoder/audio assets.
- Pending [You]: device pass — sparks/shake feel, combo linger, hazard read,
  audio mix, haptics, start/pause flow, `draws ≤ 17` at 60 FPS.

### Step 9 — audio + haptics (C)

- `audio/Audio.ts`: procedural `AudioEngine`, one lazy `AudioContext` unlocked
  inside the first gesture (`resume()` if suspended), failure latch; synth
  voices `swoosh/pop/boom/combo/over/ui`, master gain 0.5, 40 ms pop-stack cap;
  `last`/`unlocked`/`muted` exposed for the harness; no assets.
- `ui/haptics.ts`: `navigator.vibrate` patterns (`cut` 12 ms, `hazard`
  [24,40,60], `over` [60,60,120]); silent no-op without vibrate; follows mute.
- `ui/hud.ts`: mute button (safe-area top-right) with `aria-pressed`; state
  persisted as `slash-master.muted`, applied before unlock.
- `main.ts`: unlock on stroke start / mute tap, voices on cut/hazard/combo/
  over/ui, pulses on cut/hazard/over.
- `scripts/verify-polish.ts` + `pnpm verify:polish` (35 checks at C): unlock
  idempotence/failure latch, muted-silent-but-recorded, intensity threading,
  haptic patterns + absent platform, records best/mute persistence, garbage
  reads, throwing-storage fallback.
- Payload: app 32.73 kB (12.05 gzip).

### Step 9 — scoring depth (B)

- `game/Combo.ts`: per-stroke counter, k-th cut pays `COMBO.step × (k − 1)`
  (4-cut swipe = 6 × step); `Swipes.stroke` monotonic id as combo identity.
- `ui/hud.ts`: `Combo ×N` from the second cut, 700 ms hold + 300 ms fade,
  DOM writes only on change.
- `content/types.ts`: `hazard` category + `GameObjectDefinition.weight`
  (default 1); `ObjectCategory` material/spark accent; bomb (−3) / coal (−2)
  procedural models; weight 0.15 → ~3.6 % of spawns.
- `game/Spawner.ts`: boot-time prefix-sum weighted pick; all-default weights
  stay exactly uniform.
- `ui/records.ts`: guarded `localStorage` best (`slash-master.best`) with
  in-memory fallback; HUD card shows `Best N` / `New best! N`, written once
  per round.
- Harness: rules 40 (+8 combo), launch +2 weighted pick, content 133 (+22
  hazard/weight/bake).
- Payload: app 30.01 kB (10.98 gzip); draw budget row → ≤ 17.

### Step 9 — cut juice (A)

- `game/Effects.ts`: fixed spark ring (`EFFECTS.capacity` 128, 7 per cut,
  0.45 s life), burst along the slice normal, overflow recycles the oldest.
- `rendering/SparkViews.ts`: one `InstancedMesh` per category over a shared
  unit shard (instance scale = world size, no double scaling), dynamic usage,
  culling off, allocation-free sync.
- `rendering/Shake.ts`: scalar trauma, quadratic falloff, sine phases, base
  camera pose captured; `apply()` after `syncViewport`.
- `main.ts`: cut sink bursts sparks + shake before `pool.release`; restart
  clears both.
- Harness: perf 79 (+25 spark construction/sync/scene-graph + allocation
  guard over `Effects.step`, spark sync, `Shake.apply`).
- Payload: app 29.72 kB (10.88 gzip).

### Step 8 — close-out (D)

- `config.ts` `DEBUG_PERF` (dev-only) + `main.ts` `logPerf()`: 1 Hz
  `draws: N triangles: N` from `renderer.info.render`, read after the draw.
  Production pays nothing.
- `docs/PERF-BUDGET.md`: draw-call row (≤ 14 while swiping = 12 instanced
  worst case + background + blade trail), instance memory (64 × 64 B per mesh,
  ≤ 48 KiB), draw-call measurement recipe, step-8 allocation list, refreshed
  payload table.
- `AGENTS.md` state → step 8 complete (+ decisions A–J, `verify:perf` in the
  done-chain), `README.md` plan link + verify command, plan-doc accuracy pass.
- Chain green: foundation/playfield/launch/swipe(47)/cut(68)/rules(32)/
  content(111)/perf(54) + build. Vendor 862.70 kB (236.61 gzip), app 24.71 kB
  (9.22 gzip), precache 1049.05 KiB; no draco/basis/ktx2.
- Pending [You]: phone trace — `draws ≤ 14` while swiping, 60 FPS on WebGPU +
  WebGL2, both themes.

### Step 8 — perf harness (C)

- `scripts/verify-perf.ts` + `pnpm verify:perf` (54 checks): per-def
  construction (shared material, `POOL_SIZE`/`CUT.capacity` capacity, dynamic
  usage, culling off, zero counts), scene graph = defs × 3 and independent of
  `POOL_SIZE`, sync contract (per-def grouping, composed matrices at 1e-6,
  inactive/unknown skipped, empty sync resets counts and uploads nothing, data
  sync bumps `instanceMatrix.version` once per drawn def, count capped),
  debris routing by `pieceIndex`, material identity across both layers, and a
  static allocation guard over six hot bodies.
- Negative-tested: injected `new` in `syncViews`, an extra scene node per def
  and a doubled debris count each fail loudly; reverted.

### Step 8 — steady-frame allocation pass (B)

- `Physics`/`Slicer`: index `pool.items` and skip `!active` instead of
  `pool.each(callback)` — no per-step or per-segment closure. `Pool.each` is
  now documented as one-shot only.
- `ObjectViews`/`DebrisViews`: flat `meshes` arrays, indexed reset/write loops.
- `Input`: one reused `SwipeSegment` wrapper (`#segment`) instead of a fresh
  literal per move.
- `BladeTrail`: point ring preallocated (`Vector3[]` + one position buffer);
  `clone()`/`shift()` gone, dead camera/projector parameter dropped.
- Audit: remaining `new`/`Array.from` sit in constructors and boot only.

### Step 8 — instanced object and debris views (A)

- `rendering/ObjectViews.ts`: one `InstancedMesh` per def (`POOL_SIZE`
  instances), category material, `DynamicDrawUsage`, `frustumCulled = false`,
  `count = 0` until synced; `syncViews` resets counts, writes grouped matrices
  through one module-level `Object3D`, uploads only drawn defs.
- `rendering/DebrisViews.ts`: one `InstancedMesh` per (def × pieceIndex),
  `CUT.capacity` each, same sync contract.
- Scene children now 9 (Halloween) / 12 (Christmas) regardless of
  `POOL_SIZE`; per-slot `Mesh` path deleted, no fallback flag.
- Runtime smoke: WebGPU draws `instanceCount = count`, `count = 0` → no draw;
  both backends verified in the dev app.

### Fix — mobile swipe input

- Older Safari lacks `PointerEvent.getCoalescedEvents` → fall back to the
  event itself instead of throwing.
- A stroke interrupted by an app switch never saw `pointerup`, leaving swipe
  state stuck; `Input.cancelStroke()` now runs on `visibilitychange` (alongside
  `swipes.clear()`). Confirmed working on device by [You].

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
