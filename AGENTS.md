# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 8 COMPLETE (`docs/PLAN-STEP-8-perf.md`)

Workstreams **A → B → C → D** landed 2026-10-25. Steps 1–7 remain closed;
pending [You] eyeball tuning carries over, nothing blocks on it.

- **A — instancing:** `b604f1e`. `ObjectViews` = one `InstancedMesh` per def,
  `DebrisViews` = one per (def × pieceIndex); capacities `POOL_SIZE` /
  `CUT.capacity`, `DynamicDrawUsage`, `frustumCulled = false`, `count = 0`
  until synced. `syncViews`/`syncDebrisViews` group active slots per def
  through one module-level `Object3D`; `count` is the draw count, so a def with
  no live slots draws nothing. Scene children = defs × 3 (9 Halloween, 12
  Christmas), independent of `POOL_SIZE`; ≤ 12 instanced draws (+ background +
  blade trail) vs the old 128-mesh ceiling.
- **B — allocations:** `6549c87`. `Physics`/`Slicer` index over `pool.items`
  and skip inactive slots (no per-step/per-segment closure; `Pool.each` is now
  one-shot only). `Input` reuses one `SwipeSegment` wrapper; `BladeTrail`
  preallocates its point ring (no `clone`/`shift`); view syncs iterate flat
  `meshes` arrays by index.
- **C — harness:** `e3f19df`. `scripts/verify-perf.ts` + `pnpm verify:perf`
  (54 checks): per-def construction (materials, capacities, dynamic usage,
  culling off, zero counts), scene graph = defs × 3 and capacity-independent,
  sync contract (grouping, composed matrices, inactive/unknown skipped, empty
  reset uploads nothing, count capped at capacity), debris routing by piece
  index, material sharing, and a static allocation guard over six hot function
  bodies. Negative-tested (injected `new`, extra scene node, wrong count).
- **D — measurement:** `DEBUG_PERF` dev-only 1 Hz `renderer.info` readout
  (`draws: N triangles: N`); PERF-BUDGET draw-call row + instance memory +
  `verify:perf` in the done-chain.
- **Unplanned fix (`93c1806`):** mobile touch was dead. Older Safari lacks
  `getCoalescedEvents` (now falls back to the event), and a stroke interrupted
  by an app switch never saw its `pointerup` (now `Input.cancelStroke()` on
  `visibilitychange`). Confirmed working on device by [You].
- **Not built (deliberate):** texture atlases/glTF (step 9), LOD/occlusion/
  partial instance uploads, spawn weighting, runtime theme swap (step 10).

### Open items for next session

- **[You] Step 8 by eye/on device:** repeat the phone trace — `draws ≤ 14`
  while swiping, 60 FPS on WebGPU + WebGL2, both themes, no GC sawtooth.
- **[You] carry-over tuning:** `CUT`/`SWIPE` feel, lighting/palette,
  `PLAYFIELD` numbers, arcs, HUD sizes/copy, `ROUND.duration` + ramp feel.
- **Next step:** step 9 (polish per PLAN §9) — write
  `docs/PLAN-STEP-9-*.md` at session start; step 8's baseline is instanced
  draws, a theme-sized scene graph, and a zero-allocation steady frame.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) _(band pinned to z=0 2026-10-21 — chopping bug; collision stays 3D)_ · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.
**Step 5:** A pieces = separate debris ring, never the object pool (re-slice/score impossible by construction) · B piece geometry = `def.pieces?` authored at final size, else scaled clone (`pieceScale`) · C score rides on `SpawnedObject.score` (launch-set, reset-zeroed) · D hit test = pure scalar 3D sphere-vs-segment + `CUT.pad` · E cut runs inside the drain (pre-move); score + pieces fire BEFORE release.
**Step 6:** A round clock = `game/Round.ts` (scalar state, `over` latch) · B `round.step` runs last in `fixedUpdate`; `over` → freeze mid-air · C `round.progress` feeds the spawn ramp (3E un-parked) · D HUD = `ui/hud.ts` on the step-1 root, DOM writes only on integer change · E restart re-arms every mutable system (score/round/spawner/pool/debris/swipes) · F missed fruit: no consequence (PLAN §6).
**Step 7:** A procedural parts models, no assets · B `ObjectModel` parts | asset (asset = step-9 seam) · C bake once at boot, one geometry per def · D one material per category, accent = emissive · E boot-time `?theme=` registry · F default `pieceScale` clone, pumpkin authored halves · G `size` = max extent, radius ≤ `sideMargin` · H gameplay never imports themes/models (harness) · I Christmas per PLAN §7 · J no deps; only `BufferGeometryUtils` addon · K HUD unchanged · L `getTheme` + boot resolution; `setTheme` is step 10.
**Step 8:** A one `InstancedMesh` per def (per-category would need merged shapes) · B capacity = `POOL_SIZE` / `CUT.capacity` · C `count` is the draw count; one reused `Object3D`; no instance ids · D `frustumCulled = false` · E scene graph = defs × 3, pool-size independent · F zero steady-frame allocation, harness-guarded · G `verify:perf` headless; draw calls + frame time measured on device · H `DEBUG_PERF` 1 Hz readout · I pools/pixel cap/hidden pause/low-poly/TSL already done · J no deps.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (47 checks)
pnpm verify:cut          # bun scripts/verify-cut.ts — hit test/slicer/score/debris (68 checks)
pnpm verify:rules        # bun scripts/verify-rules.ts — round/reset/ramp (32 checks)
pnpm verify:content      # bun scripts/verify-content.ts — theme/bake/isolation (111 checks)
pnpm verify:perf         # bun scripts/verify-perf.ts — instances/draw ceiling/no-allocation (54 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:playfield` → `pnpm verify:launch` → `pnpm verify:swipe` → `pnpm verify:cut` → `pnpm verify:rules` → `pnpm verify:content` → `pnpm verify:perf` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- **Code comments:** aim for 0 (self-documenting names/structure). 1–2 lines when
  a why, invariant, or non-obvious contract must be stated; 4+ only for real
  gotchas. Never narrate what the code visibly does. Update stale comments with
  the code — a wrong comment is worse than none.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
