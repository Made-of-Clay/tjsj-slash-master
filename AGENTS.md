# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 5 COMPLETE (`docs/PLAN-STEP-5-cutting.md`)

Workstreams **A → B → C → D → E** all landed (`565b017` + `77a428d` + `4b6a0f6`,
2026-10-21). Steps 1–4 are committed and closed; their pending [You] eyeball
tuning (gate feel, lighting/palette, `PLAYFIELD` numbers, arcs by eye) is still
welcome, nothing blocks on it.

- **A — hit test + cut:** `565b017`. `game/Collision.ts` pure `segmentSphere`
  (3D sphere-vs-segment, scalar math, `CUT.pad`); `game/Slicer.ts` — `cut(pool,
segment)` scans `pool.each`, first hit wins, score → pieces → release order;
  `game/Score.ts` + `SpawnedObject.score` (set at launch from `def.score`,
  zeroed in reset); `main.ts` cuts inside the drain (pre-move, Decision 4C);
  `DEBUG_CUT` logs defId + delta.
- **B–C — debris + seam:** `77a428d`. `game/Debris.ts` capped ring (64):
  presentation-only pieces — never re-sliced/scored, no pool competition; 2 per
  cut: offset ± along the slice normal, vel = parent × `inherit` + ±normal ×
  `separation`, opposed z-tumble, one wobble draw per pair (Decision 3F);
  `step` = GRAVITY integration, despawn below launch line / `life`, drop-oldest.
  `rendering/DebrisViews.ts` — boot-built geometry cache: `def.pieces?` authored
  at final size, else scaled clone (`pieceScale`); materials shared with
  ObjectViews. Full `CUT` config block.
- **D — verification:** `4b6a0f6`. `scripts/verify-cut.ts` + `pnpm verify:cut`
  (65 checks): hit-test cases (graze/endpoint/depth-band/diagonal/pad),
  cut-once and release ordering, mixed-score multi-cut, Score model, debris
  spawn math/despawn/ring/allocation proxy, config sanity, Spawner→score
  wiring.
- Blade trail unchanged. `progress` still stubbed at `0` until step 6 owns the
  round timer.
- Real models/assets are **not now**: step 7 (content) / step 9 (payload).

### Open items for next session

- **[You] Step 5 by eye/thumb:** `CUT` knobs (pad/separation/spin/inherit) in
  `pnpm dev` — cuts forgiving but not magnetized, pieces read as "split" not
  confetti; on-device portrait (`pnpm preview:mobile`) — cuts + pieces at 60 FPS,
  both backends.
- **[You] Step 2/3/4 tuning (carry-over):** lighting/palette, `PLAYFIELD`
  numbers, aspect sign-off; interval/batch/apex/spin + `GRAVITY` by eye;
  `SWIPE.gateDistance` by thumb; arcs in frame, 60 FPS.
- **[You] deferred — `GRAVITY` name (2026-10-20).** It is literal acceleration in `Physics`,
  but the Spawner's closed-form aim (`vy=√(2g·Δy)`, `tFlight=2vy/g`) cancels it out of the
  apex — so it tunes arc **tempo**, not height (`apexRange` is the height knob). Options:
  keep + doc · `ARC_GRAVITY` · `ARC_TEMPO` · reshape for real-gravity feel. Config comment
  is stale. **No change made.**
- **Next step:** step 6 (game rules) — write `docs/PLAN-STEP-6-rules.md` at session
  start (same pattern as steps 3–5). 30 s round timer (`progress` un-stubbed),
  score display (the `Score` model exists), game-over screen + restart; missed
  fruit explicitly has no consequence in MVP.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.
**Step 5:** A pieces = separate debris ring, never the object pool (re-slice/score impossible by construction) · B piece geometry = `def.pieces?` authored at final size, else scaled clone (`pieceScale`) · C score rides on `SpawnedObject.score` (launch-set, reset-zeroed) · D hit test = pure scalar 3D sphere-vs-segment + `CUT.pad` · E cut runs inside the drain (pre-move); score + pieces fire BEFORE release.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (44 checks)
pnpm verify:cut          # bun scripts/verify-cut.ts — hit test/slicer/score/debris (65 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:launch` → `pnpm verify:swipe` → `pnpm verify:cut` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
