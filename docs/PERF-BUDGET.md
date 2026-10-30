# Performance budget

Budgets, not aspirations. A step that blows one of these is the step that made
the game slow. Numbers are enforced by `src/config.ts`, not hardcoded inline.

## Frame budget

| Metric                | Budget                   | Enforced by                                                      |
| --------------------- | ------------------------ | ---------------------------------------------------------------- |
| Frame rate            | 60 FPS                   | —                                                                |
| Frame time            | ≤ 16.67 ms               | `FIXED_STEP`                                                     |
| Sim step              | 1/60 s, fixed            | `FIXED_STEP`                                                     |
| Sub-steps per frame   | ≤ 5, then drop backlog   | `MAX_SUB_STEPS`                                                  |
| Stall tolerance       | ≤ 250 ms of a long frame | `MAX_FRAME_SECONDS`                                              |
| Pixel ratio           | ≤ 2                      | `MAX_PIXEL_RATIO`                                                |
| Live objects          | 64                       | `POOL_SIZE`                                                      |
| Draw calls            | ≤ 17 while swiping       | `InstancedMesh` per def (step 8) + per category (sparks, step 9) |
| FPS readout smoothing | 0.1 EMA                  | `FPS_SMOOTHING`                                                  |

Subtract from that 16.67 ms, per frame:

- **Fixed sim**: ~2 ms target. If physics gets expensive, profile before
  adding iterations.
- **Render**: ~8 ms target on a mid-range phone, not a desktop.
- **Input + pooling**: ~0 ms. Anything measurable here is a per-frame
  allocation.

## Allocations

The rule the budget enforces: **no allocation in the steady-state frame.**

Already handled in the foundation:

- `Pool<T>` — all 64 slots built in the constructor, `acquire`/`release` O(1) via
  an index stack. Never grows.
- `Input` — reuses one `Vector3` pair and one `Vector2` pair. Swipe segments are
  reused instances; copy before retaining them.
- `GameLoop` — accumulator and EMA state are instance fields.
- `Camera.createSwipeProjector` — raycaster, plane and NDC vector allocated once
  per projector, not per segment.

Step 3 (physics + launcher):

- `Physics` integrates in place on the pooled object — no scratch vectors; the
  update order (position, then gravity) is arithmetic on fields that already
  exist.
- `Spawner` is allocation-free: the aim math is inline arithmetic and the only
  state is a timer. Its `rand` seam is a function reference, injected once.
- `SpawnedObject` reset — `pool.release` zeroes position, velocity, rotation,
  angular velocity, `defId`, `radius` and `active`, so a recycled object can
  never inherit stale state. This closes the rotation/scratch item step 3 owned.

Step 8 (perf pass):

- `ObjectViews`/`DebrisViews` — one `InstancedMesh` per def (objects) and per
  def × piece index (debris). Sync zeroes counts, writes matrices through one
  module-level `Object3D`, and iterates flat `meshes` arrays by index: no
  iterators, no closures.
- `Physics`/`Slicer` — index over `pool.items` and skip inactive slots, instead
  of `pool.each(callback)`. No per-step or per-segment closure. `Pool.each()`
  is now for one-shot passes only.
- `Input` — one reused `SwipeSegment` wrapper (the old one allocated per move).
- `BladeTrail` — point ring preallocated; adding a sample copies into it
  (`clone()` and `shift()` are gone).
- Step 13: the trail is one additive ribbon — position/colour arrays and the
  index buffer are built once, `writeGeometry` overwrites in place, and the
  age trim only moves `first`/`count`. Still one draw.
- `verify:perf` statically guards those hot bodies against allocation
  constructs, so the rule is enforced rather than remembered.

Step 9 (polish):

- `Effects` — fixed ring of plain objects built in the constructor; `burst`
  writes fields, `step` swaps-and-shrinks in place. Overflow recycles the
  oldest slot instead of growing.
- `SparkViews` — one `InstancedMesh` per category, matrices written through one
  module-level `Object3D`; a category with no live sparks resets its count.
- `Shake` — scalar trauma; `apply` recomposes the offset from the captured
  base pose every frame, no vectors allocated.
- `Combo`/`Flow`/`Round` — scalar state only; the combo bonus is arithmetic on
  the cut path.
- HUD combo timers are event-driven (`setTimeout` on a state change), never
  per-frame DOM writes; the audio voices allocate disposable WebAudio nodes
  per event by design (WebAudio nodes are single-use), never in the frame
  path.
- `verify:perf`'s allocation guard now also covers `Effects.step`,
  `syncSparkViews` and `Shake.apply`.

## Rendering

- Pixel ratio capped at 2. A 3x phone display is a 2.25x fragment cost for no
  visible gain at canvas size.
- No post-processing. Every pass is a full-screen cost, and none is on the list.
- Background is a theme `backgroundNode` (step 2): three draws it as one
  full-screen background mesh — a single draw call, one full-screen fragment, no
  post pass. Swapping the palette rebuilds that one fragment; it adds no scene
  geometry and no extra pass.
- No shadow maps. WebGPU node shadows need explicit setup; step 2 has no use
  for them. Revisit only if a flat scene reads badly.
- TSL over hand-written shader complexity — the same look for less maintenance.
- Content models bake once at boot (step 7): parts are merged into one
  vertex-coloured geometry per def. Step 8 draws them with one `InstancedMesh`
  per def (objects) and per def × piece (debris). Scene children = defs × 3 —
  independent of `POOL_SIZE` — and a def with no live slots draws nothing.
  Instance buffers are 64 × 64 B each (≤ 48 KiB total). Frustum culling is off
  on instanced meshes: instances span the field, so whole-mesh culling would
  only pop spawns. Step 9 sparks add one mesh per category (3) with
  `EFFECTS.capacity` (128) instances — 128 × 64 B = 8 KiB per category, ≤ 24
  KiB — drawn from one shared unit shard with instance scale carrying the size.
  No textures, no network, no per-frame geometry work.

## Payload

Precache size is a cold-start budget. Every asset here is downloaded on first
load before the game can start.

|                  | Current              | Notes                               |
| ---------------- | -------------------- | ----------------------------------- |
| Precache entries | 20                   | workbox glob                        |
| Precache total   | 1062 kB              | what a first-time visitor downloads |
| Three.js chunk   | 865 kB (238 kB gzip) | `three/webgpu`; grows with imports  |
| Game chunk       | 34 kB (12.5 kB gzip) | steps 1–9; +3.2 kB gzip over step 8 |

Step 9 adds no assets: sound is synthesised in `audio/Audio.ts`, sparks are one
instanced unit shard, the hint cards are DOM. The +3.2 kB gzip is code — above
the ~2.5 kB hope, kept because the alternative was cutting feel.

Step 10 adds no assets and no frame-path work: one build-time env read, both
theme registries stay in the bundle by design. App chunk +0.45 kB
(0.14 kB gzip) over step 9.

Guard rails learned the hard way at the foundation:

- **Never import `three/examples/jsm/Addons.js`.** It is a 297-module barrel;
  one `OrbitControls` import pulled 1.9 MB of draco/basis decoders. Use
  `three/addons/<path>`.
- Check `dist/assets` after adding any import: `ls dist/assets | grep -E
'draco|basis|ktx2'`. Those decoders should never reappear.
- Audio/image assets stay out: sound is synthesised and models are procedural,
  so the precache is code only. A single texture atlas or audio sprite would
  cost more than every step since 7.

## Measuring

### FPS meter

`stats.js` is loaded only under `import.meta.env.DEV`, so it never reaches the
precache. It appears in dev builds only.

A "60 FPS" reading on a desktop is not evidence of anything. The budget is a
mid-range phone.

### Draw calls

`main.ts` logs `draws: N triangles: N` once per second in dev (step 8D,
`DEBUG_PERF`). Budget is ≤ 17 while swiping (12 instanced defs in the Christmas
worst case + 3 spark meshes + background + blade trail); an idle field is much
lower. Read it after a busy round, not at boot.

### In-browser, desktop

- Chrome DevTools → Performance → record while the game runs. Look for
  long tasks, GC pauses, and whether `fixedUpdate` or `render` dominates.
- Rendering → paint flashing, to confirm the loop really is paused when the tab
  is backgrounded.

### On device

```bash
pnpm preview:mobile
```

Real build, real phone, real touch. This is the only measurement that counts —
desktop GPUs hide fill-rate and thermal problems, and touch reveals input bugs
that a mouse never will.

On Android, Chrome DevTools can attach over USB (`chrome://inspect`) for the
same Performance panel on the phone.

### Backend

`main.ts` logs the renderer backend at startup:

```
backend: WebGPUBackend
```

Seeing `WebGL2Backend` means the fallback path is running. Both paths have to
hit 60 FPS — check which one the device actually used before signing off a
perf improvement.

## Before calling a step done

```bash
pnpm verify:foundation   # loop, pool, input, projector
pnpm verify:playfield    # full-width bounds, contains/clamp, debug rect
pnpm verify:launch       # aim math, integration, despawn, spawner guarantees
pnpm verify:swipe        # buffer, gate, Input
pnpm verify:cut          # hit test, slicer, score, debris
pnpm verify:rules        # round, reset, spawn ramp
pnpm verify:content      # themes, bake, import-graph isolation
pnpm verify:perf         # instanced views, draw-call ceiling, allocation guard
pnpm verify:polish       # audio/haptics/records/flow state machines
pnpm exec tsc --noEmit && pnpm exec oxfmt --check && pnpm exec oxlint && pnpm build
ls dist/assets | grep -E 'draco|basis|ktx2' # expect no output
```

`verify:foundation` is not a substitute for the build — it covers what the
build cannot see. A loop that runs zero steps and a projector that lands
off-plane both type-check clean.

Plus, on a phone: 60 FPS, swipes register, tab-switch pauses the loop, and the
precache total has not grown without a reason.
