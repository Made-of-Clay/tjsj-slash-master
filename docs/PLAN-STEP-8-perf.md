# Step 8 — Performance pass

Plan for [PLAN.md](../PLAN.md) §8. Extends it, doesn't replace it.

- Scope: the render path, not the rules — collapse the 128-slot mesh ceiling
  into a handful of instanced draws, then prove the steady frame allocates
  nothing and stays inside the frame budget.
- Target: identical gameplay and visuals on both themes; `renderer.info` draw
  calls ≤ 14 while swiping (12 instanced worst case + background + blade
  trail, down from a 128-mesh ceiling); no per-frame allocation; 60 FPS on a
  mid-range phone, WebGPU and WebGL2.
- Not in step 8: content/asset work (step 9), juice/HUD polish (step 9),
  runtime theme swap (step 10), spawn weighting, LOD, frustum-culling
  machinery beyond what instancing needs.

Owner tags: **[I]** assistant, **[You]** user, **[Pair]** scaffold-then-decide.
Workstreams run **sequentially A → B → C → D**; sessions: A | B | C | D.

> **Status — complete 2026-10-25.** A `b604f1e`, B `6549c87`, C `e3f19df`,
> D in the close-out commit; plus an unplanned mobile-input fix `93c1806`.
> Pools already existed (step 3) and geometry was already one baked mesh per
> def (step 7), so the change is **how slots become draws**: `Mesh` per slot →
> `InstancedMesh` per def. Rules, spawner, cut, debris ring and HUD are
> unchanged; the sim/view loops were retuned for allocation only (B).

## Session start (before workstream A)

- [I] Read: `src/rendering/ObjectViews.ts`, `src/rendering/DebrisViews.ts`,
  `src/rendering/Materials.ts`, `src/game/SpawnedObject.ts`,
  `src/game/Debris.ts` (`pieceIndex`), `src/main.ts` (render hook),
  `docs/PERF-BUDGET.md` (frame + payload tables), `PLAN.md` §8.
- [I] Runtime smoke before rewriting: one `InstancedMesh` under
  `WebGPURenderer` in the dev app (the renderer compiles on the GPU, so no
  harness can prove it). Confirm it draws with a per-instance matrix and
  `DynamicDrawUsage` on both WebGPU and WebGL2.
- [You] (non-blocking) carried-over tuning: CUT/SWIPE feel, palettes, arcs.
- [You] Baseline capture on the target phone: Chrome Performance trace of a
  full 30 s round, `renderer.info.render.calls` peak, frame-time histogram.
  Step 8's success is measured against this, not against a desktop guess.

## What step 8 is really about

1. **The slot count is a rendering detail, not a scene-graph fact.** Today
   `POOL_SIZE` (64) + `CUT.capacity` (64) meshes sit in the scene, each a draw
   call. Instancing per def makes the scene graph size depend on the _theme_
   (3–4 defs), not on the pool size — and that invariant is what the harness
   can assert.
2. **One draw call per def in flight, not per category.** Geometry differs per
   def, so a category-level instanced draw would need a merged geometry and
   would erase per-def shapes. Materials stay per category; the draw unit is
   the def.
3. **Instancing must not buy draws with per-frame garbage.** Grouping by def
   each frame has to reuse scratch objects; a `Map` or array built per frame
   would trade draw calls for GC pauses on a phone.

## Decisions (step 8, locked 2026-10-25, [You])

| #   | Decision      | Choice                                                                                                                                                                                                                                         | Rationale                                                                                                         |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A   | Instance unit | One `InstancedMesh` **per defId** (objects) and per **(defId, pieceIndex)** (debris). Material = `materials[def.category]`.                                                                                                                    | Geometry is baked per def; per-category draws would need merged shapes. Def-level draws are the honest ceiling.   |
| B   | Capacity      | Objects: `POOL_SIZE` instances per def. Debris: `CUT.capacity` per mesh.                                                                                                                                                                       | Spawner picks defs uniformly, so every slot _can_ be one def; a single def+piece can fill the whole debris ring.  |
| C   | Sync          | Group active slots by defId per render (insertion order), write `setMatrixAt` with a reused `Object3D` dummy, set `.count`, `instanceMatrix.needsUpdate`, `DynamicDrawUsage`. Hidden def → `count = 0`.                                        | No slot-stable mapping needed: nothing reads an instance index back. No allocation, no per-instance attributes.   |
| D   | Culling       | `frustumCulled = false` on every instanced mesh.                                                                                                                                                                                               | Instances span the playfield, so whole-mesh culling is meaningless; triangles are 80–504 per def. Raycast unused. |
| E   | Scene graph   | Children = defs (objects) + 2 × defs (debris). Nothing per pool slot.                                                                                                                                                                          | The load-bearing regression invariant: `POOL_SIZE` stops costing draws or nodes.                                  |
| F   | Garbage       | Zero allocation in the steady frame; module-level scratch only. Audit every per-frame path, not just the views.                                                                                                                                | PLAN §8 "avoid per-frame garbage"; GC pauses are the phone failure mode.                                          |
| G   | Verification  | `scripts/verify-perf.ts` + `pnpm verify:perf` (54 checks): construction contract, sync contract (incl. upload-version bumps), scene-graph size, debris routing, materials, static allocation guard over six hot bodies. Headless, bun, no GPU. | Same harness style as steps 3–7; catches regressions `vite build` cannot.                                         |
| H   | Measurement   | Dev-only (`DEBUG_PERF`) once-per-second log of `renderer.info.render.calls/triangles`; stats.js stays dev-only. No HUD change.                                                                                                                 | Cheap readout for [You]'s trace; production pays nothing.                                                         |
| I   | Already done  | No new work: object pools, pixel-ratio cap (`MAX_PIXEL_RATIO = 2`), pause on hidden (`GameLoop` → `document.hidden`), low-poly models, TSL materials, no shadow maps, no textures/atlases.                                                     | PLAN §8 items that landed in earlier steps; verify, don't rebuild.                                                |
| J   | Dependencies  | None. `InstancedMesh` ships in `three/webgpu`. Payload delta is code only (≤ ~0.5 kB gzip); check `dist/assets` for draco/basis.                                                                                                               | PAYLOAD guard rails.                                                                                              |

## Files touched

```
src/rendering/ObjectViews.ts      per-def InstancedMesh; grouping sync            [I]
src/rendering/DebrisViews.ts      per-def×piece InstancedMesh; grouping sync       [I]
src/rendering/BladeTrail.ts       preallocated point ring, no clone/shift          [I]
src/rendering/Materials.ts        unchanged (materials shared per category)        —
src/game/Physics.ts               indexed pool.items + active, no per-step closure [I]
src/game/Slicer.ts                indexed pool.items + active, no per-segment closure [I]
src/game/Input.ts                 reused SwipeSegment; coalesced-events guard; cancelStroke [I]
src/game/Pool.ts                  iteration contract docs (items per frame, each one-shot) [I]
src/config.ts                     DEBUG_PERF flag                                  [I]
src/main.ts                       dev draw-call readout; visibilitychange → cancelStroke [I]
scripts/verify-perf.ts            new harness, 54 checks                           [I]
scripts/verify-swipe.ts           47 checks (coalesced fallback + cancelStroke)    [I]
package.json                      verify:perf script                               [I]
docs/PLAN-STEP-8-perf.md          this file                                        [I]
AGENTS.md / CHANGELOG.md / README.md  state + commands + link                       [I]
docs/PERF-BUDGET.md               draw-call + instance-memory budgets              [I]
```

`src/content/**`, `Spawner`, `Debris`, `Round`, `Score`, `ui/hud.ts` and the
step 1–7 verifiers stay untouched. Gameplay edits were confined to loop
iteration and input plumbing (workstream B) — no rule or behaviour changed.

---

## Workstream A — InstancedMesh swap (session 1)

**Skill:** turn a slot array into grouped instanced draws without touching
state ownership.

### Work

- [I] Renderer smoke: one `InstancedMesh` (two instances, `DynamicDrawUsage`,
  `frustumCulled = false`) drawn via `WebGPURenderer` + TSL material. Check
  both backends before the rewrite; if WebGPU instancing misbehaves at this
  three version, stop and report before building on it.
- [I] `rendering/ObjectViews.ts`:
  - `ObjectViews = { instanced: Map<string, InstancedMesh>; materials }`.
    One `InstancedMesh` per def: baked geometry, `materials[def.category]`,
    `POOL_SIZE` capacity, `visible = true`, `count = 0`, `frustumCulled =
false`, `instanceMatrix.setUsage(DynamicDrawUsage)`.
  - `syncViews`: reset per-def counts to 0; for each active slot with a known
    def, `dummy.position.copy(object.position)`,
    `dummy.rotation.copy(object.rotation)`, `dummy.updateMatrix()`,
    `mesh.setMatrixAt(mesh.count++, dummy.matrix)`; after the pass, set
    `instanceMatrix.needsUpdate = true` for defs with `count > 0`.
  - Module-level `Object3D` dummy; no `new`, no arrays, no maps per frame.
  - Drop the per-slot `meshes` array and the `geometries` map from the public
    interface (geometry lives on the instanced mesh).
- [I] `rendering/DebrisViews.ts`: same pattern keyed by `def.id` →
  `[InstancedMesh, InstancedMesh]`; capacity `CUT.capacity` each. Piece
  geometry resolution (authored bake vs scaled clone) and the `pieceIndex`
  lookup stay exactly as they are.
- [I] `main.ts`: sync call sites keep their signatures; only the internals
  change. No gameplay edits.
- [I] `config.ts`: `DEBUG_PERF` (dev-only) + a comment on where the instance
  budgets live; the capacities derive from `POOL_SIZE`/`CUT.capacity`, not new
  constants.

### Success signal

Both themes look and play exactly as in step 7. `renderer.info.render.calls`
during a busy round drops from the current per-slot count to ≤ 14 while
swiping (Christmas: 4 object + 8 debris instanced draws, plus background and
blade trail; Halloween 11). Scene children count is 9/12. Cut debris still
tumbles with the right half/scale per def.

### Notes

- `InstancedMesh.count` is the draw count: a def with no live slots costs
  nothing. Do **not** hide the mesh (`visible = false`) — leave it true and
  let `count` speak, so material compilation happens once.
- Instance order follows activation order and may shuffle frame to frame;
  nothing indexes an instance back, so that is fine.
- Instance buffers are 64 × 64 B = 4 KiB each (≤ 48 KiB total) — trivial
  against the 64 removed mesh nodes. Full-buffer upload per frame is fine;
  `updateRanges` is a later optimisation, not step 8.
- `instanceMatrix.needsUpdate` while idle (count 0 everywhere) is skipped, so
  the game-over freeze does no uploads.
- Frustum culling being off is deliberate (Decision D) — the camera is
  straight-on and objects spawn below the frame for a few frames; a stale
  whole-mesh bounding sphere would pop them.

---

## Workstream B — Steady-frame allocation audit (session 2)

**Prerequisite:** A merged (the views are the known hot path).

**Skill:** find the allocations the profiler hides; remove them without
changing behaviour.

### Work

- [I] Audit every per-frame path for `new`, `.clone()`, `.map()`, `.filter()`,
  `.slice()`, `Array.from`, object/array literals, and closure creation:
  `GameLoop.tick`, `main.ts` `fixedUpdate`/`render`, `Physics.step`,
  `Spawner.step`/launch, `Debris.step`/`spawn`, `Swipes.drain`, `Slicer`,
  `Round.step`, `Score`, `hud.sync`, `syncViewport`, both view syncs.
- [I] Replace any steady-frame allocation with module-level scratch owned by
  the module that needs it (the `SpawnedObject`/`Swipes` pattern already in
  the repo). Constructor-time and event-time allocation stays allowed.
- [I] Confirm DOM writes stay gated (HUD integer change, debug rect on
  reframe only) and that `hud.sync` is a no-op on a steady frame.
- [I] Record the audit result in the plan/CHANGELOG: file → allocation →
  remedy (or "already clean"). No speculative rewrites.

### Success signal

A 10 s idle-plus-spawning round under `--trace-gc` (Chrome) shows no
steady-frame scavenges attributable to game code; `syncViews` /
`syncDebrisViews` contain no allocation constructs (harness-enforced in C).

### Notes

- `Vector3`/`Euler`/`Matrix4` temporaries are the usual suspects; the
  `Object3D` dummy in A is the model to copy.
- Do not "optimise" by caching per-frame values across modules — that trades
  garbage for stale state, which the step-3 no-interpolation decision exists
  to avoid.
- `renderer.info` itself is allocation-free to read.

---

## Workstream C — Perf harness (session 3)

**Skill:** assert the rendering contract headlessly, before a phone is
involved.

### Work

- [I] `scripts/verify-perf.ts` + `pnpm verify:perf` (plain `check(...)`, bun,
  no DOM/GPU):

  - **Construction (~4 per theme):** one `InstancedMesh` per def, material is
    the category material (identity), capacity `POOL_SIZE` /
    `CUT.capacity`, `instanceMatrix` usage is dynamic, `frustumCulled` is
    false.
  - **Scene graph (~2 per theme):** child count = defs + 2 × defs and
    **independent of `POOL_SIZE`** (assert against the constant, not a magic
    number); no `Mesh` per slot remains.
  - **Sync contract (~6):** feed a fake pool with known transforms (active in
    several defs, interleaved, plus inactive and unknown-`defId` slots); assert
    per-def `count`, matrix elements equal the composed transform, inactive and
    unknown slots contribute nothing, a second sync after emptying resets
    every `count` to 0, and `needsUpdate` is set only when `count > 0`.
  - **Allocation guard (~6):** read the hot bodies (`syncViews`,
    `syncDebrisViews`, `Physics.step`, `Slicer.cut`, `Input.#emit`,
    `BladeTrail.add`) and assert no `new `, `.clone(`, `.map(`, `.filter(`,
    `.slice(`, `.concat(`, `Array.from`, `Object.assign` or object spread.
  - **Materials (~1):** both categories still share one material instance
    across objects and debris.

- [I] Negative-test the harness (inject a per-slot `new Mesh` or a per-frame
  `.map`, watch it fail), then revert — same discipline as step 7D.
- [I] Full chain: `npx tsc --noEmit` → `npx oxlint` → foundation → playfield →
  launch → swipe → cut → rules → content → **perf** → `npx vite build` →
  `ls dist/assets | grep -E 'draco|basis|ktx2'` (expect none) → precache delta
  in CHANGELOG.

### Success signal

`pnpm verify:perf` green and meaningful (fails when a per-slot mesh returns);
full chain green; precache delta code-only.

### Notes

- Headless `InstancedMesh` needs no GPU: construction, `setMatrixAt` and
  `needsUpdate` are CPU state. Importing `three/webgpu` under bun is already
  proven by `verify-content`.
- Compare matrices with a small epsilon; `Euler` → quaternion → matrix
  composition is exact enough at `1e-6` for the values used.
- Keep the harness honest about what it cannot see: no GPU, no draw-call
  count, no frame time. Those are [You]'s trace in D.

---

## Workstream D — Measure + close-out (session 4)

**Prerequisite:** A + C merged; B's audit clean.

### Work

- [I] `config.ts` `DEBUG_PERF` + `main.ts` render hook: in dev, log
  `renderer.info.render.calls/triangles` once per second (no HUD, no DOM
  churn). Off in production builds.
- [I] `PERF-BUDGET.md`: draw-call budget (≤ 14 while swiping, 12 instanced
  worst case, 9 Halloween, plus the "scene graph is theme-sized, not
  pool-sized" invariant), instance memory (~48 KiB), measurement recipe
  (`renderer.info`, Chrome trace, GC trace), and the note that
  textures/atlases remain N/A (no textures).
- [I] `AGENTS.md` (state → step 8 complete, decisions A–J, commands, next step
  9), `CHANGELOG.md` (A–D + measured deltas), `README.md` plan link +
  `verify:perf`.
- [You] Device pass: repeat the baseline trace on the same phone — draw calls
  ≤ 14, frame time still ≤ 16.67 ms, no GC sawtooth, both WebGPU and WebGL2,
  both themes, portrait.

### Success signal

Draw-call ceiling met and measured on device; frame budget unchanged or
better; docs reflect real numbers, not hopes.

### Notes

- If the phone trace disagrees with `renderer.info` (e.g. WebGPU pass
  overhead), report the numbers before adding more "optimisations" — the
  remaining deltas belong to step 9 (asset payload, juice).
- Keep the old per-slot code path out of the repo; no feature flag, no
  fallback branch.

## Locked decisions carried in

- Step 3C: plain meshes were a deliberate step-8 placeholder — this step
  replaces them, doesn't add a parallel path.
- Step 7C: baked geometry is already one geometry per def, one material per
  category; instancing consumes both unchanged.
- Step 3A: no interpolation — sync keeps copying latest state, never lerping.
- Step 6B/E: the game-over freeze must also freeze instance uploads; restart
  re-arms views by `count`, no dispose/rebuild.
- PERF-BUDGET: no shadow maps, no textures, pixel-ratio cap 2, pause on
  hidden — unchanged.

## Explicitly NOT in step 8

- Texture atlases / glTF / draco (step 9: no textures exist to atlas).
- LOD, occlusion culling, `updateRanges` partial uploads, GPU-side motion.
- Spawn weighting, difficulty tuning, HUD juice, sound/particles.
- Runtime theme swap / dispose-on-switch (step 10).
- Changing `POOL_SIZE` or `CUT.capacity` (numbers stay [You]'s).

## Risks / gotchas

- **WebGPU instancing at this three version** is the one unproven assumption:
  smoke it first (session A), not after the rewrite.
- **Count vs visible**: hiding an instanced mesh would defer material
  compilation and leak a stale `count`; always drive `count`.
- **Grouping allocation creep** is the easy regression — the harness's static
  guard exists because the frame-rate win is small enough to mask a GC loss.
- **Instance order churn** is harmless today; if a future step needs stable
  instance ids (per-instance colours, trails), that becomes a real design
  decision.
- **Debris capacity**: the ring is global (64), so per-mesh capacity is
  `CUT.capacity` even though one def+piece rarely exceeds a handful — a safe
  upper bound worth 4 KiB each.
- **Measuring on desktop tells you nothing**: the step is only done when
  [You]'s phone trace says so.
