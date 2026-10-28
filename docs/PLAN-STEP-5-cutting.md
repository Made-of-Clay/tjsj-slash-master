# Step 5 — Cutting

Index: [PLAN.md](../PLAN.md).

- **Scope** — segments cut pooled objects: hit test, score, two pieces, recycle.
- **Contracts** — pure 3D sphere-vs-segment plus `CUT.pad`; the cut runs inside the drain, pre-move; score and pieces fire before `pool.release`; pieces are a debris ring, never the pool; one payout per object per drain.
- **Files** — `game/Collision.ts`, `Slicer.ts`, `Score.ts`, `Debris.ts`, `rendering/DebrisViews.ts`, `config.ts`.
- **Acceptance** — `verify:cut` (hit test, slicer, score, debris); a multi-segment stroke pays once; no allocation in the cut path.
- **Not doing** — HUD or round (6), authored halves beyond the seam (7), instanced debris (8), juice (9).
- **Decisions** — 5A–5E.

> **Status note.** Step 4 landed the consumable input: `swipes.drain()` runs at
> the top of `fixedUpdate` (pre-spawner/physics, Decision 4C), so cut tests see
> **pre-move positions**. `Collision.ts` is still the step-4 stub — this step
> replaces it. Drain hands out ring-owned segments valid only for the duration
> of the call; the cut is immediate, so nothing needs to copy.

## Session start (before workstream A)

- [I] Read: `src/game/Swipes.ts` (drain contract), `src/game/Physics.ts`,
  `src/game/Pool.ts` (release-during-iteration semantics),
  `src/rendering/ObjectViews.ts` (geometry/material sharing pattern),
  `docs/PERF-BUDGET.md` (Allocations).
- [I] Run `pnpm dev`; flick through spawned objects with `DEBUG_SWIPE` on — those
  logged segments are exactly what the hit test will receive.
- [You] (non-blocking) carried-over tuning may ride along: `SWIPE.gateDistance` by
  thumb, on-device portrait check, step 2/3 look tuning, deferred `GRAVITY` naming.

## What step 5 is really about

1. **The player can finally touch the sim.** Steps 3–4 built a one-way movie:
   spawn → arc → despawn. Step 5 closes the loop — buffered segments become game
   events and the first score changes hands.
2. **Cut exactly once.** The hazard is double-accounting: one object hit by
   several segments in one drain (a long stroke arrives as a chain), or hit again
   after its slot was recycled mid-drain. Release-during-iteration semantics and
   first-hit-wins are the core correctness work.
3. **Pieces are presentation, not gameplay.** They must never be re-sliceable,
   scoreable, or compete with the spawner for pool slots — hence a separate
   debris ring (Decision A) rather than reusing the object pool.

## Decisions (locked 2026-10-21, pre-session)

> Detail + rationale only. Canonical one-line rows: [DECISIONS.md](DECISIONS.md).

| #   | Decision          | Choice                                                                                                                                                                                                                                  | Rationale                                                                                                                                                                              |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Pieces home       | Separate debris ring: `game/Debris.ts` (sim) + `rendering/DebrisViews.ts` (meshes). NOT the main object pool                                                                                                                            | Pool pressure: late-round cuts + batch spawns would starve the spawner. No re-slice/score guard flags. `SpawnedObject` stays "sliceable game object". Geometry cache needed either way |
| B   | Piece geometry    | Scaled clone of the parent's geometry (~`CUT.pieceScale`), cached per defId, prebuilt at boot. **Seam:** `GameObjectDefinition.pieces?: readonly ObjectModel[]` — authored pieces at final size, used as-is; absent → two scaled clones | [You]: "scaled clone for now, but make a way to define custom modeled pieces". Survives step 7's real models; theme stays rendering-injected (Decision 3D)                             |
| C   | Piece motion      | Spawn offset ± along the slice normal; velocity = parent's × `inherit` + ±normal × `separation`; counter-spin                                                                                                                           | PLAN §5: "velocity and direction of sliced parts according to slice direction and velocity at slice"                                                                                   |
| D   | Score carrier     | `SpawnedObject.score`, set from `def.score` at launch (`Spawner.#configure`), zeroed in reset                                                                                                                                           | No defId→score map lookups on the cut path; reset keeps recycling clean (PERF-BUDGET discipline)                                                                                       |
| E   | Score display     | None in step 5 — `Score.ts` model + `DEBUG_CUT` dev log only                                                                                                                                                                            | Display lands with timer + game-over in step 6; cuts are already visible via debris                                                                                                    |
| F   | Hit test          | `game/Collision.ts` pure function: 3D sphere-vs-segment, scalar math only, `CUT.pad` added to the radius                                                                                                                                | Decision 3B (depth band ±1 makes it 3D). Scalar math = no scratch vectors, allocation-free, bun-testable                                                                               |
| G   | Cut orchestration | New `game/Slicer.ts`: `cut(pool, segment)` scans `pool.each`, first hit wins; score/piece sinks + `rand` injected via constructor                                                                                                       | `main.ts` stays wiring; fakes under bun; injectable `rand` = Decision 3F (spin/separation jitter)                                                                                      |
| H   | Debris lifecycle  | Ring cap ~64, drop-oldest; despawn below the launch line (mirrors Physics) + hard `CUT.life` expiry                                                                                                                                     | Bounded worst case; familiar semantics; zero pool interplay                                                                                                                            |
| I   | Config            | `CUT = { pad, pieceScale, inherit, separation, spin, life }` in `src/config.ts`                                                                                                                                                         | Config convention: every tunable lives there; [You] tunes the numbers                                                                                                                  |

## Files touched

```
src/game/Collision.ts          rewrite stub: pure sphere-vs-segment            [I]
src/game/Slicer.ts             new: cut orchestration (scan + sinks)           [I]
src/game/Score.ts              new: total + add (reset per round, step 6)      [I]
src/game/SpawnedObject.ts      + score field; reset zeroes it                  [I]
src/game/Spawner.ts            set score from def at launch                    [I]
src/game/Debris.ts             new: piece ring sim (B)                         [I]
src/rendering/DebrisViews.ts   new: piece meshes + geometry cache (B)          [I]
src/content/types.ts           GameObjectDefinition.pieces?                    [I]
src/main.ts                    wire slicer/score/debris; DEBUG_CUT             [I]
src/config.ts                  CUT block                                       [I] scaffold, [You] numbers
scripts/verify-cut.ts          new harness (D)                                 [I]
package.json                   verify:cut script                               [I]
docs/PLAN-STEP-5-cutting.md    this file                                       [I]
AGENTS.md / CHANGELOG.md       state update at close-out                       [I]
```

---

## Workstream A — Hit test + cut (session 1)

**Skill:** pure geometry + cut-once orchestration.

### Session start

- Reads listed above; run `pnpm dev`, confirm `DEBUG_SWIPE` flow is unchanged.

### Work

- [I] `Collision.ts`: replace the stub with the pure test. Scalar signature along
  `hits(from, to, cx, cy, cz, radius): boolean` — closest point on segment:
  `t = clamp(dot(c−a, ab) / |ab|², 0, 1)`, hit iff distance² ≤ (radius + pad)².
  Zero-length segments degenerate to a point test (t = 0).
- [I] `SpawnedObject`: add `score`, zero it in `resetSpawnedObject`;
  `Spawner.#configure` sets it from `def.score` at launch.
- [I] `Score.ts`: `total`, `add(points)`, `reset()` (step 6 resets per round).
- [I] `Slicer.ts`: constructor takes `{ score, pieces, rand? }` (minimal sink
  interfaces, so bun fakes them); `cut(pool, segment)` scans `pool.each` — on hit:
  `score.add(object.score)`, `pieces(object, nx, ny)`, `pool.release(object)`.
  Normal = segment direction rotated 90° in the play plane.
- [I] `main.ts`: `swipes.drain((segment) => slicer.cut(objects, segment))` at the
  existing drain point; piece sink = no-op until B; `DEBUG_CUT` dev log (defId,
  score delta).
- [Pair] Confirm cut timing: the cut runs inside the drain, before
  spawner/physics — pieces inherit the parent's pre-move velocity (Decision 4C
  semantics preserved).

### Success signal

In dev: swiping through an object removes it and the `DEBUG_CUT` log shows defId +
score delta; no visual pieces yet; no double cuts across segment chains; full
chain green.

### Notes

- Release-during-iteration: `Pool.each` reads slot state per index; releasing the
  current item mid-scan is safe, and later segments in the same drain skip it
  naturally (state is FREE → not visited).
- Worst case per step: segments × pool = 32 × 64 scalar distance tests ≈ nothing.
- `verify:foundation` may assert `SpawnedObject`'s shape; extend the harness if so.

## Workstream B — Debris (session 2)

**Skill:** bounded ring sim + boot-prebuilt view cache.

**Prerequisite:** A merged.

### Work

- [I] `game/Debris.ts`: fixed ring of piece slots
  `{ position, velocity, rotation, angularVelocity, defId, category, radius, age, active }`.
  API: `spawn(parent, nx, ny)` — 2 pieces per Decision C; `step(dt, bottomY)` —
  GRAVITY integration in place, despawn `y < bottomY − radius` or `age > CUT.life`,
  drop-oldest on overflow; `each()` for views; `clear()`.
- [I] `rendering/DebrisViews.ts`: mesh per slot, transform-only sync (the
  ObjectViews pattern); geometry cache per defId — `def.pieces` used as-is, else a
  scaled clone of the parent's geometry (bake the scale into the clone);
  shared per-category materials (reuse the existing materials record).
- [I] `config.ts`: `CUT` block (Decision I). `main.ts`: real piece sink →
  `debris.spawn`; `debris.step` after physics in `fixedUpdate`; sync debris views
  in `render`.
- [You] Cut feel: separation/spin/inherit by eye — pieces must read as "the object
  split", not confetti.

### Success signal

Swipe → object splits into two half-scale pieces that separate along the slice
direction, tumble, fall, and vanish below the launch line. Zero steady-state
allocation; the object pool is untouched by cuts.

### Notes

- Custom pieces (`pieces?`) are authored at final size — `pieceScale` applies only
  to the default scaled clone. Document it in `content/types.ts`.
- Piece radius derives from each piece model's `size` (`boxBoundingRadius`) for
  the despawn margin. Box-flavoured name, size-generic behaviour; fine while all
  models are primitives.
- ~64 extra plain meshes worst case (Decision 3C — no InstancedMesh until step 8);
  only active slots are visible/drawn.

## Workstream C — Feel defaults + cleanup (session 2, same session as B)

### Work

- [I] Sane `CUT` defaults (then [You] by eye / on device).
- [I] Keep `DEBUG_CUT` (step 6's scoring smoke test); trim anything noisy; blade
  trail untouched.

### Success signal

`npx tsc --noEmit` + `npx oxlint` clean; config documented; no stray probes.

## Workstream D — Verification harness (session 3)

**Skill:** pure-function regression harness (step-3/4 style).

### Work

- [I] `scripts/verify-cut.ts` + `pnpm verify:cut` (~50 checks):
  - hit test (~15): through-center, clear miss, exact graze at the radius,
    endpoint hits, segment fully inside, off-plane center within/without reach
    (depth band), zero-length segment, pad effect;
  - Slicer (~10): cut releases exactly once, score delta ±1 from the object's
    score, inactive slots skipped, one segment cutting several objects, chain
    (2nd segment skips the released object), allocation proxy;
  - Score (~4): accumulate, negative, reset;
  - Debris (~12): spawn → 2 pieces with correct offsets/velocities/spin, ring cap
    drop-oldest, despawn below the line + life expiry, reset semantics;
  - config sanity + `SpawnedObject.score` zeroed on reset (~4).
- [Pair] Drive the full drain→cut→debris pipeline by direct API calls (no DOM
  needed); synthetic `Swipes` input only if it stays trivial.

### Success signal

Harness green; check count reported in the step-3 style (e.g. "50 checks").

## Workstream E — Close-out (session 3)

- [I] Full chain: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` →
  `pnpm verify:playfield` → `pnpm verify:launch` → `pnpm verify:swipe` →
  `pnpm verify:cut` → `npx vite build`.
- [I] Update `AGENTS.md` (state, locked decisions, next-step pointer to step 6
  game rules), `CHANGELOG.md`, README plan link.
- [You] On-device portrait: cuts register with a thumb, pieces hold 60 FPS, both
  backends.

## Locked decisions carried in

- 3A no interpolation → tests use the latest sim state; 4C drain-at-top →
  pre-move positions.
- 3B depth band ±1 → the hit test is 3D.
- 3C plain meshes (step 8 owns InstancedMesh) — debris views too.
- 3D gameplay never imports the theme — piece models arrive via defs injected at
  boot.
- 3F injectable `rand` — Slicer's jitter.
- PERF-BUDGET: no allocation in the steady-state frame — cut path included.

## Explicitly NOT in step 5

- Score display, round timer, game-over, miss penalty (step 6).
- Authored piece models for the Halloween defs (step 7 — only the seam exists).
- InstancedMesh for debris (step 8).
- Combos, juice/particles, screen shake, true mesh slicing, trail polish (step 9).
