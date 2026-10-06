# Performance budget

Budgets, not aspirations. A step that blows one of these is the step that made
the game slow. Numbers are enforced by `src/config.ts`, not hardcoded inline.

## Frame budget

| Metric                | Budget                   | Enforced by         |
| --------------------- | ------------------------ | ------------------- |
| Frame rate            | 60 FPS                   | —                   |
| Frame time            | ≤ 16.67 ms               | `FIXED_STEP`        |
| Sim step              | 1/60 s, fixed            | `FIXED_STEP`        |
| Sub-steps per frame   | ≤ 5, then drop backlog   | `MAX_SUB_STEPS`     |
| Stall tolerance       | ≤ 250 ms of a long frame | `MAX_FRAME_SECONDS` |
| Pixel ratio           | ≤ 2                      | `MAX_PIXEL_RATIO`   |
| Live objects          | 64                       | `POOL_SIZE`         |
| FPS readout smoothing | 0.1 EMA                  | `FPS_SMOOTHING`     |

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

Not yet enforced anywhere: physics scratch vectors and spawned-object rotation
(euler/quaternion). Step 3 owns these — add them to `Pool`'s `reset` when the
objects exist.

## Rendering

- Pixel ratio capped at 2. A 3x phone display is a 2.25x fragment cost for no
  visible gain at canvas size.
- No post-processing. Every pass is a full-screen cost, and none is on the list.
- No shadow maps. WebGPU node shadows need explicit setup; step 2 has no use
  for them. Revisit only if a flat scene reads badly.
- TSL over hand-written shader complexity — the same look for less maintenance.

## Payload

Precache size is a cold-start budget. Every asset here is downloaded on first
load before the game can start.

|                  | At foundation        | Notes                               |
| ---------------- | -------------------- | ----------------------------------- |
| Precache entries | 20                   | workbox glob                        |
| Precache total   | 1020 kB              | what a first-time visitor downloads |
| Three.js chunk   | 831 kB (234 kB gzip) | `three/webgpu`; grows with imports  |

Guard rails learned the hard way at the foundation:

- **Never import `three/examples/jsm/Addons.js`.** It is a 297-module barrel;
  one `OrbitControls` import pulled 1.9 MB of draco/basis decoders. Use
  `three/addons/<path>`.
- Check `dist/assets` after adding any import: `ls dist/assets | grep -E
'draco|basis|ktx2'`. Those decoders should never reappear.
- Model and texture assets are step 9's problem. `POOL_SIZE`-sized geometry
  loaded up front will undo the payload win above.

## Measuring

### FPS meter

`stats.js` is loaded only under `import.meta.env.DEV`, so it never reaches the
precache. It appears in dev builds only.

A "60 FPS" reading on a desktop is not evidence of anything. The budget is a
mid-range phone.

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
pnpm verify:foundation   # 52 logic checks: loop, pool, input, projector
pnpm exec tsc --noEmit && pnpm exec oxfmt --check && pnpm exec oxlint && pnpm build
ls dist/assets | grep -E 'draco|basis|ktx2' # expect no output
```

`verify:foundation` is not a substitute for the build — it covers what the
build cannot see. A loop that runs zero steps and a projector that lands
off-plane both type-check clean.

Plus, on a phone: 60 FPS, swipes register, tab-switch pauses the loop, and the
precache total has not grown without a reason.
