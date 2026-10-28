# Step 3 — Object launching

Index: [PLAN.md](../PLAN.md).

- **Scope** — pooled objects launch on guaranteed arcs, integrate ballistically, despawn.
- **Contracts** — latest-state render, no interpolation; depth pinned `z = 0` (3B); radius ≤ `sideMargin`; an `undefined` acquire is a skip, not an error.
- **Files** — `game/SpawnedObject.ts`, `Physics.ts`, `Spawner.ts`, `rendering/ObjectViews.ts`, `content/types.ts`.
- **Acceptance** — `verify:launch` (aim, integration, despawn, weighted pick); arcs peak inside the frame on portrait; cadence follows `round.progress`.
- **Not doing** — slicing, rules, UI, instancing.
- **Decisions** — 3A–3F (3E replaced constant cadence on 2026-10-18).

> **Course correction (2026-10-18, [You], workstream C).** Decision E is
> overridden: spawn cadence and batch size now **ramp with round progress**
> (interval shrinks 1.2–2.0s → 0.6–1.1s, batch 1 → 2–3 across the round).
> `SpawnRules` therefore models `intervalRange`/`batchRange` as
> `RampRange { early, late }`; the other ranges stay constant tuples.
> Progress (0→1) is threaded by workstream D and stubbed until step 6 owns
> the round timer. Also: `PLAYFIELD.sideMargin` raised 0.6 → 1.0 so theme
> objects (edge-1.0 boxes, radius 0.87) stay inside the no-clip guard.

## What step 3 is really about

1. **First real sim work.** `GameLoop.fixedUpdate` currently only spins `DevCube`. This step
   makes the loop own spawn → integrate → despawn over a pooled set.
2. **The pool gets its consumer.** `Pool<T>` exists (64 slots, O(1), never grows). Step 3
   defines `SpawnedObject`, its `reset`, and the rule for when acquire returning `undefined`
   means "skip, don't throw".
3. **Trajectory math that can't miss.** Not "random velocity, hope it lands in frame": pick a
   spawn point on the launch line, a target X inside bounds, and an apex height; derive the
   velocity that guarantees the arc. Random velocity produces off-screen arcs on phones.

## Decisions (proposed — lock at session 1)

> Detail + rationale only. Canonical one-line rows: [DECISIONS.md](DECISIONS.md).

| #   | Decision      | Proposal                                                                                                                                               | Rationale                                                                                                                            |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Interpolation | **Defer.** Ignore `alpha`; render latest sim state                                                                                                     | 60 Hz sim on a 120 Hz screen judders slightly; fix in step 9 polish, not now. Keep `render(alpha)` signature.                        |
| B   | Depth (z)     | Small band, `depthRange` in `SpawnRules`, default `[-1, 1]`                                                                                            | PLAN §3 wants depth; step 5 collision must then be 3D sphere-vs-segment (already the plan). Band keeps objects near the slice plane. |
| C   | Meshes        | Plain `Mesh` per pool slot, shared geometry, 2 shared materials (target/restricted tinted from theme accents)                                          | 64 meshes max is nothing; `InstancedMesh` is step 8's call. No per-object material clones.                                           |
| D   | Theme access  | `main.ts` passes `theme.spawnRules`, `theme.objects`, `theme.accents` into constructors. Gameplay never imports the theme file or reads palette fields | Keeps the data/code split; `content/types.ts` is the only gameplay-visible contract.                                                 |
| E   | Difficulty    | ~~Constant spawn interval; no ramp~~ **Ramped with round progress** (course correction 2026-10-18)                                                     | [You] wants cadence + batch to grow across the round.                                                                                |
| F   | RNG           | Spawner takes `rand: () => number` (default `Math.random`)                                                                                             | Deterministic harness in E.                                                                                                          |

## Files touched

```
src/config.ts                    PHYSICS block (gravity) + SPAWN debug flag          [I] scaffold, [You] numbers
src/game/SpawnedObject.ts        new: state struct + factory + reset                 [I]
src/game/Physics.ts              real: integrate + rotation + despawn tests          [I]
src/game/Spawner.ts              real: timer, batches, aim-at-point velocity         [I] scaffold, [You] tuning
src/rendering/ObjectViews.ts     new: pool-slot meshes + sync(objects)               [I] scaffold, [You] look
src/content/types.ts             real SpawnRules shape                               [I] after [You] fixes fields
src/content/themes/halloween.ts  1 target + 1 restricted cube def, spawnRules        [You]
src/main.ts                      wiring: pool, spawner, physics, views               [I]
src/rendering/DevCube.ts         delete (real objects replace it)                    [I]
scripts/verify-launch.ts         new: trajectory + integration + despawn checks      [I]
package.json                     verify:launch script                                [I]
docs/PLAN-STEP-3-launching.md    this file
CHANGELOG.md / README.md         entry + link                                        [I]
```

---

## Workstream A — SpawnedObject + Physics (session 1)

**Skill:** fixed-step integration, pooled state design, allocation discipline.

**Prerequisite:** none.

### Session start

- Read: `src/game/GameLoop.ts`, `src/game/Pool.ts`, `src/config.ts` (GAMEPLAY/PLAYFIELD), `docs/PERF-BUDGET.md` (Allocations).
- Run: `pnpm dev`; confirm DevCube spins.

### Work

- [I] `src/game/SpawnedObject.ts`: `{ position: Vector3, velocity: Vector3, rotation: Euler, angularVelocity: Vector3, defId: string, category: ObjectCategory, radius: number, active: boolean }`. `createSpawnedObject()` + `resetSpawnedObject(o)` zero everything (PERF-BUDGET: step 3 owns the rotation/scratch reset).
- [I] `Physics.ts` real: `step(objects, bounds, dt)` — integrate position, `velocity.y -= GRAVITY * dt`, Euler spin, despawn when `y < LAUNCH_LINE_Y - radius && velocity.y < 0` or laterally outside bounds while moving outward. Despawn = `pool.release`. Gravity constant lands in a new `PHYSICS` config block; tune by eye.
- [I] Wire into `main.ts`: pool of 64 states, `fixedUpdate` runs spawner (stub: hand-launch 3) + physics; despawned objects vanish. Delete `DevCube.ts` only in D — keep it as the lone visible thing until views exist.
- [You] Tune `GRAVITY` (start ~20 — game gravity, not Earth's) against the 14-unit-tall field.

### Success signal

Hand-launched cubes trace parabolas, spin, drop past the launch line and are recycled; pool `inUse` returns to 0; zero allocations in the steady-state frame (no `new` in physics path).

### Notes

- `dt` is always `FIXED_STEP`; physics must not integrate twice per render frame (loop already guarantees ≤5 sub-steps).
- Scratch vectors are module-level `const` in Physics, not per call.

---

## Workstream B — Object views (session 2)

**Skill:** pool ↔ scene-graph binding without per-frame garbage; shared geometry/materials.

**Prerequisite:** A merged.

### Session start

- Read: `src/game/Pool.ts`, `src/rendering/DevCube.ts`, `src/content/types.ts` (accents).
- Run: `pnpm dev`.

### Work

- [I] `src/rendering/ObjectViews.ts`: `createObjectViews(scene, count, models, accents)` → one `Mesh` per pool slot (index-aligned), geometry shared per model kind, material shared per category, `visible = false` initially. `syncViews(views, objects)` copies position/rotation and toggles visibility — called from `render`, not `fixedUpdate`.
- [You] Sanity-check the look: cubes readable against the Halloween background under both backends (`WebGPUBackend` + `WebGL2Backend`).

### Success signal

Cubes appear/move/vanish in sync with sim state; two materials, one geometry in the draw list; no material/geometry allocation after startup.

### Notes

- `syncViews` must tolerate `active: false` slots (hide, don't skip position write — cheap and branch-free is fine either way; pick one and comment).
- View layer reads `accents` (theme data) — this is the rendering side; gameplay still never sees colors (Decision D).

---

## Workstream C — SpawnRules type + halloween content (session 3)

**Skill:** the data/code split — gameplay consumes an interface, theme file fills it.

**Prerequisite:** B merged.

### Session start

- Read: `src/content/types.ts`, `src/content/themes/halloween.ts`, `src/config.ts`.
- Run: `pnpm dev`.

### Work

- [You] Propose `SpawnRules` fields by writing the halloween values first (fields follow data):
  `intervalRange`, `batchRange` (1..3), `speedRange`, `apexRange` (fraction of field height), `depthRange` (Decision B), `spinRange`, `sideLaunchChance`.
- [I] Type `SpawnRules` in `content/types.ts` from your fields; replace the throwaway `{}`.
- [You] Add halloween `objects`: one target cube + one restricted cube (`ObjectModel` primitive box, `size` ≤ `PLAYFIELD.sideMargin` covers radius), scores +1/−1.

### Success signal

`content/types.ts` has a real `SpawnRules` (no empty interface); halloween defines 2 objects + rules; swapping those numbers changes behavior with zero code edits.

### Notes

- `size` is edge length; radius = `size * √3/2` (bounding sphere). Spawner uses radius for despawn margin and step 5 uses it for collision.
- Field names are the contract — step 7's christmas.ts copies them.

---

## Workstream D — Spawner trajectories (session 4)

**Skill:** closed-form ballistic aiming; seedable randomness.

**Prerequisite:** C merged (rules exist), A merged (physics consumes states).

### Session start

- Read: `src/game/Spawner.ts`, `src/content/types.ts` (SpawnRules), `src/rendering/Camera.ts` (live bounds).
- Run: `pnpm dev`.

### Work

- [I] Real `Spawner`: internal timer accumulates `dt`; on fire, draw batch size from `batchRange`, spawn each at `x ∈ bounds` (uniform), `y = LAUNCH_LINE_Y - radius`, `z ∈ depthRange`. **Aim math** (no iterative solve):
  `vy = sqrt(2·g·(apexY − y0))`, `tFlight = 2·vy/g`, `vx = (targetX − x0)/tFlight`, `vz` small random drift. `apexY ∈ centerY + apexRange·halfHeight`, `targetX ∈ bounds` inset by radius.
- [I] Side launches: with `sideLaunchChance`, spawn at a side edge (just outside bounds), angle inward — same aim math with `targetX` pulled well inside.
- [I] `rand` injectable (Decision F). Pool exhausted → skip that spawn silently (count it in a dev log, don't grow the pool).
- [You] Tune `intervalRange`/`batchRange`/`apexRange`/`spinRange` until it feels like Fruit Ninja: mostly bottom-up arcs, occasional side toss, never a guaranteed hit.

### Success signal

Every arc stays inside the field horizontally at 21:9 and 9:16 (spawn X re-sampled against live bounds each spawn); no cube escapes through the top; ~60 FPS with a full 64-slot pool churning.

### Notes

- Spawn X uses the bounds captured at spawn time; mid-flight resizes do NOT re-clamp live objects (they're ballistic — fine).
- Spawner reads `bounds` from the live `PlayField` reference, never a copied snapshot.
- No launch sound/score/miss penalty — steps 6+.

---

## Workstream E — Verification + close-out (session 5)

**Skill:** the repo's verify-harness pattern; on-device sign-off.

**Prerequisite:** A–D merged.

### Session start

- Read: `scripts/verify-playfield.ts` (pattern), this file end to end.
- Run: `pnpm verify:playfield`, `pnpm build`.

### Work

- [I] `scripts/verify-launch.ts` (bun, same style as the other two) asserts, with the injected RNG seeded:
  - Aim math: launching at (x0, apexY, targetX) actually peaks within tolerance at apexY and lands at targetX (closed-form check of the integrator, N steps).
  - Integration: `p += v·dt` over N steps matches the closed-form ballistic curve within tolerance.
  - Despawn: object below launch line with `vy < 0` is released; pool `inUse` back to 0.
  - Pool exhaustion: 64 live → `acquire` returns `undefined` → spawner skips, no throw, no growth.
  - Side launches spawn outside bounds and first enter the field, never exit the far side before apex.
  - Regression: swipe projector still lands on `z = GAME_PLANE_DEPTH`.
- [I] Wire `verify:launch` into `package.json`; delete `DevCube.ts`; PERF-BUDGET "Not yet enforced" note resolved (scratch + rotation reset listed as done); CHANGELOG + README link.
- [You] On-device: `pnpm preview:mobile`, portrait — arcs land in frame, 60 FPS, both backends if available.

### Success signal

All harnesses green + the standard gate below; no DevCube in `dist`; device run clean.

---

## Boring work I take throughout

- `config.ts`: `PHYSICS` block (gravity), `DEBUG_SPAWN` flag.
- SpawnedObject/reset + Pool integration; Physics/Spawner real implementations.
- `ObjectViews.ts` scaffold; `main.ts` composition stays composition-only.
- Type-up `SpawnRules` after C fixes fields; harness + docs + commit hygiene.

## Verification

```bash
pnpm verify:foundation && pnpm verify:launch
pnpm exec tsc --noEmit && pnpm exec oxfmt --check && pnpm exec oxlint && pnpm build
ls dist/assets | grep -E 'draco|basis|ktx2' # expect no output
```

Dev smoke: cubes churn continuously, stats.js ~60 FPS, no console errors, tab-switch pauses (loop already handles it — confirm nothing re-spawns while paused).

Device: `pnpm preview:mobile` portrait — full arcs visible, no side clipping, `WebGL2Backend` path checked even if the phone has WebGPU.

## Risks / gotchas

- **Allocation discipline is the actual difficulty here.** Aim math + integration are trivial; a `new Vector3()` per spawn or per step is the failure mode this step exists to avoid. Scratch state is module-level; pool reset owns rotation.
- `Pool.acquire` returning `undefined` at 64 live objects will happen in playtests — decide skip-not-throw once, in Spawner, with a comment.
- Resize mid-flight: bounds change, live objects don't follow. Accept it; only spawn sampling uses current bounds.
- `sideMargin` must cover the largest cube radius or edge spawns clip (config comment already warns; C must verify).
- Euler rotation on fast spin can look aliased at 60 Hz sim — cap `spinRange` reasonably; quaternions only if it looks broken.
- Don't touch TSL this step; accents are plain `MeshStandardMaterial.color`.

## Definition of done

- [ ] Cubes launch continuously along tuned arcs from the launch line; spin; despawn below the line.
- [ ] Sim runs in `fixedUpdate` over the pool; views sync in `render`; zero steady-state allocations.
- [ ] `SpawnRules` typed and filled by halloween data; gameplay imports nothing from the theme file.
- [ ] Side launches + depth band present; pool exhaustion is a skip, not a crash.
- [ ] `pnpm verify:launch` green; tsc/lint/fmt/build green; no draco/basis.
- [ ] `DevCube.ts` deleted; PERF-BUDGET allocation note closed out.
- [ ] Verified on a phone in portrait before calling step 3 shippable.

## Commit plan

1. `feat: spawned-object physics on the fixed-step loop` (A)
2. `feat: pooled object views` (B)
3. `feat: spawn rules type + halloween object defs` (C)
4. `feat: trajectory spawner` (D)
5. `chore: launch verification harness, close step 3` + docs (E)
